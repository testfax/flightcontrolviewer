const { logs_warn, logs, logs_error, logs_debug } = require('../utils/logConfig')
const HID = require('node-hid')
const { blastToUI } = require('../brain/input-functions')
const { app, ipcMain, BrowserWindow, webContents } = require('electron')
const Store = require('electron-store').default
const deviceInfo = new Store({ name: 'deviceInfo' })
const windowItemsStore = new Store({ name: 'electronWindowIds' })
const actionmaps = new Store({ name: 'actionmapsJSON' })
const showConsoleMessages = windowItemsStore.get('showConsoleMessages')
const staticData = require('../staticData.json')

function toHex4(n) {
  return Number(n).toString(16).toUpperCase().padStart(4, '0')
}
function listAllJoysticks() {
  return HID.devices().filter(d => d && d.path && d.usagePage === 1 && d.usage === 4)
}
function getDevicesStore() {
  const cur = deviceInfo.get('devices')
  if (cur && typeof cur === 'object') return cur
  return {}
}
function setDevicesStore(obj) {
  deviceInfo.set('devices', obj)
}
function deviceKeyFromHidInfo(d) {
  const vid = toHex4(d.vendorId || 0)
  const pid = toHex4(d.productId || 0)
  const iface = (d.interface != null) ? String(d.interface) : 'na'
  return `${vid}:${pid}|if=${iface}`
}
function nextJsIndex(devicesObj) {
  let max = 0
  for (const k of Object.keys(devicesObj)) {
    const n = Number(devicesObj[k] && devicesObj[k].jsIndex)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}
function getOrAssignJsIndexForKey(deviceKey) {
  const devices = getDevicesStore()
  const entry = devices[deviceKey]
  if (entry && Number.isInteger(entry.jsIndex) && entry.jsIndex > 0) {
    return entry.jsIndex
  }
  const idx = nextJsIndex(devices)
  if (entry) {
    entry.jsIndex = idx
    devices[deviceKey] = entry
  } else {
    devices[deviceKey] = { jsIndex: idx }
  }
  setDevicesStore(devices)
  return idx
}
function jsPrefixForDevice(d) {
  const key = deviceKeyFromHidInfo(d)
  const idx = getOrAssignJsIndexForKey(key)
  return `js${idx}_`
}
// ---------- dump parsing / descriptor extraction ----------
function parseAllHexBytesFromLine(line) {
  const m = String(line).match(/\b[0-9a-fA-F]{2}\b/g)
  if (!m) return []
  return m.map(x => x.toUpperCase())
}
function isLikelyDescriptorStartLine(line) {
  return /^\s*DESCRIPTOR\s*:?\s*$/i.test(line) ||
    /^\s*REPORT\s+DESCRIPTOR\s*:?\s*$/i.test(line) ||
    /^\s*HID\s+REPORT\s+DESCRIPTOR\s*:?\s*$/i.test(line)
}
function isDeviceHeaderForVidPid(line, vidHex, pidHex) {
  const s = String(line)

  if (new RegExp(`^\\s*${vidHex}\\s+${pidHex}\\s*[:\\-]`, 'i').test(s)) return true
  if (new RegExp(`\\b${vidHex}\\s*[:]\\s*${pidHex}\\b`, 'i').test(s)) return true

  const vidRe = new RegExp(`\\bVID\\s*[:=]\\s*${vidHex}\\b`, 'i')
  const pidRe = new RegExp(`\\bPID\\s*[:=]\\s*${pidHex}\\b`, 'i')
  if (vidRe.test(s) && pidRe.test(s)) return true

  if (new RegExp(`\\bvid\\b.*\\b${vidHex}\\b.*\\bpid\\b.*\\b${pidHex}\\b`, 'i').test(s)) return true

  return false
}
function hexPartsToBuffer(hexParts) {
  const nums = hexParts.map(h => parseInt(h, 16)).filter(n => Number.isFinite(n))
  return Buffer.from(nums)
}
// IMPORTANT CHANGE:
// Extract descriptor by matching the EXACT PATH block for this device, not just VID/PID.
// This prevents grabbing the wrong colXX/mi_XX descriptor (which looks "random").
function normalizeDumpPath(s) {
  return String(s || '').trim().toLowerCase()
}
function normalizeHidPath(s) {
  return String(s || '').trim().toLowerCase()
}
function extractDescriptorBufferFromDump(dumpText, d) {
  const lines = String(dumpText || '').split(/\r?\n/)
  const wantPath = normalizeHidPath(d.path)

  // 1) find exact PATH line match
  let pathIndex = -1
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    if (!/^PATH\s*:/i.test(line)) continue
    const gotPath = normalizeDumpPath(line.replace(/^PATH\s*:\s*/i, ''))
    if (gotPath === wantPath) {
      pathIndex = i
      break
    }
  }

  if (pathIndex === -1) {
    return { ok: 0, reason: 'PATH not found in dump for this device', buf: null }
  }

  // 2) optional sanity: check we are near the right VID/PID header
  const vidHex = toHex4(d.vendorId)
  const pidHex = toHex4(d.productId)

  let headerIndex = -1
  for (let i = pathIndex; i >= 0 && i >= pathIndex - 8; i -= 1) {
    if (isDeviceHeaderForVidPid(lines[i], vidHex, pidHex)) {
      headerIndex = i
      break
    }
  }
  if (headerIndex === -1) headerIndex = pathIndex

  // 3) find DESCRIPTOR marker after PATH
  let descStart = -1
  for (let i = pathIndex; i < Math.min(lines.length, pathIndex + 60); i += 1) {
    if (isLikelyDescriptorStartLine(lines[i])) {
      descStart = i + 1
      break
    }
  }

  if (descStart === -1) {
    return { ok: 0, reason: 'DESCRIPTOR marker not found after PATH', buf: null }
  }

  const bytes = []
  for (let i = descStart; i < lines.length; i += 1) {
    const b = parseAllHexBytesFromLine(lines[i])
    if (!b.length) {
      if (bytes.length) break
      continue
    }
    bytes.push(...b)
    if (bytes.length > 8192) break
  }

  if (!bytes.length) return { ok: 0, reason: 'No hex bytes found under DESCRIPTOR', buf: null }

  return { ok: 1, reason: `path-based extraction (headerLine=${headerIndex})`, buf: hexPartsToBuffer(bytes) }
}
// ---------- Bit helpers ----------
function readBitsAsUnsignedLE(buf, bitOffset, bitSize) {
  let value = 0
  for (let i = 0; i < bitSize; i += 1) {
    const b = bitOffset + i
    const byteIndex = Math.floor(b / 8)
    const bitIndex = b % 8
    const bit = (buf[byteIndex] || 0) & (1 << bitIndex)
    if (bit) value |= (1 << i)
  }
  return value >>> 0
}
function toSigned(valueUnsigned, bitSize) {
  if (bitSize <= 0) return 0
  if (bitSize > 31) return valueUnsigned
  const signBit = 1 << (bitSize - 1)
  if ((valueUnsigned & signBit) === 0) return valueUnsigned
  const fullMask = (1 << bitSize) - 1
  return -(((~valueUnsigned) & fullMask) + 1)
}
function usageName(usagePage, usage) {
  if (usagePage === 0x01) {
    switch (usage) {
      case 0x30: return 'x'
      case 0x31: return 'y'
      case 0x32: return 'z'
      case 0x33: return 'rotx'
      case 0x34: return 'roty'
      case 0x35: return 'rz'
      case 0x36: return 'slider'
      case 0x37: return 'dial'
      case 0x38: return 'wheel'
      default: return `gd_${usage.toString(16)}`
    }
  }
  if (usagePage === 0x02) return `sim_${usage.toString(16)}`
  return `up${usagePage.toString(16)}_${usage.toString(16)}`
}
// ---------- Parse descriptor -> buttons + axes ----------
function parseInputsFromReportDescriptor(descBuf) {
  const state = {
    usagePage: 0,
    reportId: 0,
    reportSize: 0,
    reportCount: 0,
    logicalMin: 0,
    logicalMax: 0,
    usages: [],
    usageMin: null,
    usageMax: null
  }

  const reportIdsSeen = new Set()
  const bitCursor = new Map()
  const buttonsByReport = new Map()
  const axesByReport = new Map()

  function cursorGet(rid) {
    const v = bitCursor.get(rid)
    if (typeof v === 'number') return v
    return 0
  }

  function cursorSet(rid, v) {
    bitCursor.set(rid, v)
  }

  function localsReset() {
    state.usages = []
    state.usageMin = null
    state.usageMax = null
  }

  function usagesFromRange(min, max) {
    const out = []
    for (let u = min; u <= max; u += 1) out.push(u)
    return out
  }

  function addButton(rid, usage, bitOffset, bitSize) {
    if (!buttonsByReport.has(rid)) buttonsByReport.set(rid, [])
    buttonsByReport.get(rid).push({ usage, bitOffset, bitSize })
  }

  function addAxis(rid, usagePage, usage, bitOffset, bitSize, logicalMin, logicalMax) {
    if (!axesByReport.has(rid)) axesByReport.set(rid, [])
    axesByReport.get(rid).push({
      usagePage,
      usage,
      name: usageName(usagePage, usage),
      bitOffset,
      bitSize,
      logicalMin,
      logicalMax
    })
  }

  let i = 0
  while (i < descBuf.length) {
    const b0 = descBuf[i++]

    if (b0 === 0xFE) {
      const dataSize = descBuf[i++]
      i += 1
      i += dataSize
      continue
    }

    const sizeCode = (b0 & 0x03)
    const dataSize = sizeCode === 3 ? 4 : sizeCode
    const type = (b0 >> 2) & 0x03
    const tag = (b0 >> 4) & 0x0F

    let value = 0
    if (dataSize === 1) value = descBuf[i]
    if (dataSize === 2) value = descBuf[i] | (descBuf[i + 1] << 8)
    if (dataSize === 4) value = (descBuf[i] | (descBuf[i + 1] << 8) | (descBuf[i + 2] << 16) | (descBuf[i + 3] << 24)) >>> 0
    i += dataSize

    // Global
    if (type === 1) {
      if (tag === 0x0) state.usagePage = value
      else if (tag === 0x7) state.reportSize = value
      else if (tag === 0x9) state.reportCount = value
      else if (tag === 0x8) { state.reportId = value; reportIdsSeen.add(value) }
      else if (tag === 0x1) {
        if (dataSize === 1 && (value & 0x80)) state.logicalMin = value - 256
        else if (dataSize === 2 && (value & 0x8000)) state.logicalMin = value - 65536
        else state.logicalMin = value
      } else if (tag === 0x2) {
        if (dataSize === 1 && (value & 0x80)) state.logicalMax = value - 256
        else if (dataSize === 2 && (value & 0x8000)) state.logicalMax = value - 65536
        else state.logicalMax = value
      }
      continue
    }

    // Local
    if (type === 2) {
      if (tag === 0x0) state.usages.push(value)
      else if (tag === 0x1) state.usageMin = value
      else if (tag === 0x2) state.usageMax = value
      continue
    }

    // Main
    if (type === 0 && tag === 0x8) { // Input
      const inputFlags = value
      const isConstant = (inputFlags & 0x01) !== 0
      const isVariable = (inputFlags & 0x02) !== 0

      const rid = state.reportId || 0
      const count = state.reportCount || 0
      const sizeBits = state.reportSize || 0

      let fieldUsages = []
      if (state.usages.length) fieldUsages = state.usages.slice()
      else if (state.usageMin != null && state.usageMax != null) fieldUsages = usagesFromRange(state.usageMin, state.usageMax)

      const startBit = cursorGet(rid)
      cursorSet(rid, startBit + (count * sizeBits))

      if (!isConstant && isVariable && sizeBits > 0 && sizeBits <= 31) {
        if (state.usagePage === 0x09) {
          for (let idx = 0; idx < count; idx += 1) {
            let usage = fieldUsages[idx]
            if (usage == null) usage = (idx + 1)
            addButton(rid, usage, startBit + (idx * sizeBits), sizeBits)
          }
        } else {
          for (let idx = 0; idx < count; idx += 1) {
            const usage = fieldUsages[idx]
            if (usage == null) continue
            addAxis(rid, state.usagePage, usage, startBit + (idx * sizeBits), sizeBits, state.logicalMin, state.logicalMax)
          }
        }
      }

      localsReset()
      continue
    }

    if (type === 0) localsReset()
  }

  for (const [rid, arr] of buttonsByReport.entries()) arr.sort((a, b) => a.usage - b.usage)
  for (const [rid, arr] of axesByReport.entries()) arr.sort((a, b) => (a.name > b.name ? 1 : -1))

  return { hasReportIds: reportIdsSeen.size > 0, buttonsByReport, axesByReport }
}
function readButtonBit(buf, bitOffset) {
  const byteIndex = Math.floor(bitOffset / 8)
  const bitIndex = bitOffset % 8
  const byte = buf[byteIndex] || 0
  return (byte & (1 << bitIndex)) !== 0
}
function computeAxisCenterAndThreshold(axis, percent) {
  let min = axis.logicalMin
  let max = axis.logicalMax
  if (typeof min !== 'number' || typeof max !== 'number' || min === max) {
    min = 0
    max = (1 << Math.min(axis.bitSize, 16)) - 1
  }
  const range = Math.abs(max - min) || 1
  const center = Math.round((min + max) / 2)
  const threshold = Math.max(1, Math.round(range * percent))
  return { min, max, range, center, threshold }
}
function bufferToHexString(buf) {
  return Buffer.from(buf).toString('hex').toUpperCase()
}
function inputsMapsToPlain(parsed) {
  const buttons = {}
  const axes = {}

  for (const [rid, arr] of parsed.buttonsByReport.entries()) {
    buttons[String(rid)] = arr.map(b => ({ usage: b.usage, bitOffset: b.bitOffset, bitSize: b.bitSize }))
  }
  for (const [rid, arr] of parsed.axesByReport.entries()) {
    axes[String(rid)] = arr.map(a => ({
      usagePage: a.usagePage,
      usage: a.usage,
      name: a.name,
      bitOffset: a.bitOffset,
      bitSize: a.bitSize,
      logicalMin: a.logicalMin,
      logicalMax: a.logicalMax
    }))
  }

  return { hasReportIds: parsed.hasReportIds ? 1 : 0, buttonsByReport: buttons, axesByReport: axes }
}
function plainToInputsMaps(plain) {
  const buttonsByReport = new Map()
  const axesByReport = new Map()

  const buttons = plain && plain.buttonsByReport ? plain.buttonsByReport : {}
  const axes = plain && plain.axesByReport ? plain.axesByReport : {}

  Object.keys(buttons).forEach(ridStr => {
    const rid = Number(ridStr)
    const arr = buttons[ridStr] || []
    buttonsByReport.set(rid, arr.map(b => ({ usage: b.usage, bitOffset: b.bitOffset, bitSize: b.bitSize })))
  })

  Object.keys(axes).forEach(ridStr => {
    const rid = Number(ridStr)
    const arr = axes[ridStr] || []
    axesByReport.set(rid, arr.map(a => ({
      usagePage: a.usagePage,
      usage: a.usage,
      name: a.name,
      bitOffset: a.bitOffset,
      bitSize: a.bitSize,
      logicalMin: a.logicalMin,
      logicalMax: a.logicalMax
    })))
  })

  return { hasReportIds: plain && plain.hasReportIds ? true : false, buttonsByReport, axesByReport }
}
function learnAndPersistDevice(d, dumpText) {
  // IMPORTANT CHANGE: pass the full device so we can match by PATH
  const extracted = extractDescriptorBufferFromDump(dumpText, d)
  if (!extracted.ok || !extracted.buf) return null

  const parsed = parseInputsFromReportDescriptor(extracted.buf)
  // console.log('PARSED:'.red, parsed.hasReportIds)

  let totalButtons = 0
  for (const arr of parsed.buttonsByReport.values()) totalButtons += arr.length
  let totalAxes = 0
  for (const arr of parsed.axesByReport.values()) totalAxes += arr.length
  // console.log('TotalButtons:'.green, totalButtons, 'TotalAxes:'.green, totalAxes)

  if (totalButtons === 0 && totalAxes === 0) return null

  const key = deviceKeyFromHidInfo(d)
  const devices = getDevicesStore()
  const jsIndex = getOrAssignJsIndexForKey(key)

  devices[key] = {
    key: key,
    jsIndex: jsIndex,
    prefix: `js${jsIndex}_`,
    vendorId: d.vendorId,
    productId: d.productId,
    interface: d.interface,
    usagePage: d.usagePage,
    usage: d.usage,
    product: d.product,
    manufacturer: d.manufacturer,
    path: d.path,
    descriptorHex: bufferToHexString(extracted.buf),
    parsedInputs: inputsMapsToPlain(parsed),
    savedAt: Math.floor(Date.now() / 1000)
  }

  if (showConsoleMessages) { console.log('Learned Device:'.cyan, devices[key].product) }
  logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, 'Learned Device:'.cyan, devices[key].product)
  setDevicesStore(devices)
  return parsed
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
function startInputLoggerForDevice(d, parsed) {
  correctControls()
  const prefix = jsPrefixForDevice(d)
  let device = null
  try {
    device = new HID.HID(d.path)
  } catch (e) {
    logs_error(prefix + 'open_failed', d.path)
    // console.error(prefix + 'open_failed', d.path)
    return
  }

  const warmed = new Set()
  const lastButtons = new Map()

  // axis state
  const axisActive = new Map()
  const axisLastVal = new Map()
  const axisLastEmit = new Map()

  // NEW: suppress repeats if the exact same control was the last one reported
  let lastReported = ''

  function reportOnce(keyStr) {
    if (keyStr === lastReported) return false
    lastReported = keyStr
    return true
  }

  // tune these without changing behavior elsewhere
  const CENTER_PERCENT = 0.10
  const MOVE_PERCENT = 0.02
  const AXIS_COOLDOWN_MS = 250

  device.on('data', (data) => {
    let rid = 0
    let payload = data

    if (parsed.hasReportIds) {
      rid = data[0]
      payload = data.slice(1)
    }

    const buttons = parsed.buttonsByReport.get(rid) || []
    const axes = parsed.axesByReport.get(rid) || []
    if (!buttons.length && !axes.length) return

    if (!warmed.has(rid)) {
      for (const b of buttons) lastButtons.set(`${rid}:${b.usage}`, readButtonBit(payload, b.bitOffset))

      for (const a of axes) {
        const key = `${rid}:${a.name}`
        const rawU = readBitsAsUnsignedLE(payload, a.bitOffset, a.bitSize)
        let val = rawU
        if (a.logicalMin < 0) val = toSigned(rawU, a.bitSize)
        axisLastVal.set(key, val)
        axisActive.set(key, false)
        axisLastEmit.set(key, 0)
      }

      if (axes.length) {
        const names = axes.map(x => x.name).join(',')
        if (showConsoleMessages) { console.log(prefix + `axes_rid${rid}=` + names, 'loaded'.green) }
        logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, prefix + `axes_rid${rid}=` + names, 'loaded'.green)
      }

      warmed.add(rid)
      return
    }

    // Buttons: press-only, suppress repeat of same button as last reported
    for (const b of buttons) {
      const key = `${rid}:${b.usage}`
      const prev = lastButtons.get(key) || false
      const down = readButtonBit(payload, b.bitOffset)

      if (down && !prev) {
        const out = `${prefix}button${b.usage}`
        if (reportOnce(out)) {
          if (showConsoleMessages) { console.log(out.blue) }
          gatherAfterDeviceInputs(out,d)
        }
      }

      lastButtons.set(key, down)
    }

    // Axes: log on meaningful movement (no rest), suppress repeat of same axis as last reported
    for (const a of axes) {
      const key = `${rid}:${a.name}`
      const rawU = readBitsAsUnsignedLE(payload, a.bitOffset, a.bitSize)
      let val = rawU
      if (a.logicalMin < 0) val = toSigned(rawU, a.bitSize)

      const cfg = computeAxisCenterAndThreshold(a, CENTER_PERCENT)
      const centerDelta = Math.abs(val - cfg.center)

      const prevVal = axisLastVal.get(key)
      axisLastVal.set(key, val)

      const now = Date.now()
      const lastEmit = axisLastEmit.get(key) || 0

      const wasActive = axisActive.get(key) || false
      const isActive = centerDelta >= cfg.threshold

      let movedEnough = false
      if (typeof prevVal === 'number') {
        const moveThreshold = Math.max(1, Math.round(cfg.range * MOVE_PERCENT))
        if (Math.abs(val - prevVal) >= moveThreshold) movedEnough = true
      }

      if (init == 0) {
        if (!wasActive && isActive) {
          const out = `${prefix}axis_${a.name}`
          if (reportOnce(out)) {
            if (showConsoleMessages) { console.log(out.cyan) }
          }
          axisLastEmit.set(key, now)
        } else if (movedEnough && (now - lastEmit) >= AXIS_COOLDOWN_MS) {
          const out = `${prefix}axis_${a.name}`
          if (reportOnce(out)) {
            if (showConsoleMessages) { console.log(out.red) }
            gatherAfterDeviceInputs(out,d)
          }
          axisLastEmit.set(key, now)
        }
      }

      axisActive.set(key, isActive)
    }
  })

  device.on('error', (err) => {
    // console.error(prefix + 'hid_error', err && err.stack ? err.stack : err)
    logs_error(err)
  })
}
function findKeybind(key, discoveredKeybinds) {
  if (showConsoleMessages) { console.log('[findKeyBind]'.yellow, key) }
  if (key in discoveredKeybinds) {
    if (showConsoleMessages) { console.log('[findKeyBind]'.green, discoveredKeybinds[key]) }
    return discoveredKeybinds[key]
  } else {
    if (showConsoleMessages) { console.log('[findKeyBind]'.red, key) }
    return 0
  }
}
function pidVidFromHidPath(path) {
  if (typeof path !== 'string') return null

  const match = path.match(/VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})/)
  if (!match) return null

  const [, vid, pid] = match
  return `${vid.toUpperCase()}:${pid.toUpperCase()}`
}
function gatherAfterDeviceInputs(data,d) {
  const joyInfo = data.split('_')
  let result
  if (joyInfo[1] == 'axis') {
    result = findKeybind(`${joyInfo[0]}_${joyInfo[2]}`, actionmaps.get('discoveredKeybinds'))
  } else {
    result = findKeybind(`${joyInfo[0]}_${joyInfo[1]}`, actionmaps.get('discoveredKeybinds'))
  }
  // console.log(d)
  const deviceSpecs = {
    key: pidVidFromHidPath(d.path),
    joyInput: data,
    product: d.product,
    vid: d.vendorId,
    pid: d.productId,
    keybindArray: result,
    position: joyInfo[0].slice(-1),
    prefix: joyInfo[0],
    keybindArticulation: staticData.keybindArticulation
  }
  // console.log("deviceSpecs:".yellow,deviceSpecs.key)

  joySubmit(deviceSpecs)
}
function correctControls() {
  const controlStuff = actionmaps.get('actionmaps')
  const devices = deviceInfo.get('devices')

  const stickSetupInGame = controlStuff.ActionMaps.ActionProfiles[0].options

  for (const items of stickSetupInGame) {
    for (const [k, actionmaps] of Object.entries(items)) {
      if (actionmaps.hasOwnProperty('Product')) {
        const match = actionmaps.Product.match(/\{([^}]+)\}/)
        if (!match) continue
        const guid = match[1].split('-')[0].slice(0, 4)

        const deviceKey = Object.keys(devices)
          .find(k => k.includes(guid))
        if (!devices) { console.log('[BRAIN]'.red, 'input-detection'.yellow, 'No devices ready...'); return }
        if (!deviceKey || !devices[deviceKey].savedAt) continue

        switch (actionmaps.type) {
          case 'joystick':
            devices[deviceKey].prefix = 'js' + actionmaps.instance + '_'
            devices[deviceKey].jsIndex = Number(actionmaps.instance)
            break
          case 'keyboard':
            devices[deviceKey].prefix = 'kb' + actionmaps.instance + '_'
            devices[deviceKey].jsIndex = Number(actionmaps.instance)
            break
          case 'gamepad':
            devices[deviceKey].prefix = 'gp' + actionmaps.instance + '_'
            devices[deviceKey].jsIndex = Number(actionmaps.instance)
            break
        }

        if (showConsoleMessages) { console.log('Devices Reordered...'.green, devices[deviceKey].product, devices[deviceKey].prefix, devices[deviceKey].jsIndex) }
        // logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, 'Devices Reordered...'.green, devices[deviceKey].product, devices[deviceKey].prefix, devices[deviceKey].jsIndex)
        devices[deviceKey].savedAt = Math.floor(Date.now() / 1000)
      }
    }
  }
  setDevicesStore(devices)
}
function joySubmit(data) {
  if (showConsoleMessages) { console.log(data) }
  let package = {}
  package = { 
    ...data, 
    ...{receiver: "from_brain-detection"},
  }
  // console.log("package:".yellow,package)
  blastToUI(package)
}
async function main() {
  const devices = listAllJoysticks()
  if (!devices.length) {
    console.log('[input-detection] No joystick-class devices found (usagePage=1 usage=4)')
    logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, '[input-detection] No joystick-class devices found (usagePage=1 usage=4)'.yellow)
    return
  }

  const dumpStatus = deviceInfo.get('hidDescriptorDumpStatus')
  const dumpText = deviceInfo.get('hidDescriptorDump')
  const dumpAvailable = (dumpStatus && dumpStatus.ok === 1 && dumpText)

  const stored = getDevicesStore()

  for (const d of devices) {
    const key = deviceKeyFromHidInfo(d)
    getOrAssignJsIndexForKey(key)
    const entry = stored[key]

    if (entry && entry.parsedInputs) {
      // for (const reportId in entry.parsedInputs.axesByReport) {
      //   entry.parsedInputs.axesByReport[reportId] = entry.parsedInputs.axesByReport[reportId].map(axis => {
      //     if (axis.name === 'rx') axis.name = 'rotx'
      //     else if (axis.name === 'ry') axis.name = 'roty'
      //     return axis
      //   })
      // }
      if (entry.path !== d.path) {
        entry.path = d.path
        entry.savedAt = Math.floor(Date.now() / 1000)
        stored[key] = entry
        setDevicesStore(stored)
      }
      const parsed = plainToInputsMaps(entry.parsedInputs)
      startInputLoggerForDevice(d, parsed)
      continue
    }

    if (!dumpAvailable) {
      const prefix = jsPrefixForDevice(d)
      if (showConsoleMessages) { console.log(prefix + 'unlearned_no_dump') }
      logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, prefix + 'unlearned_no_dump'.red)
      continue
    }

    const prefix = jsPrefixForDevice(d)
    let learned = null
    let tries = 0

    while (!learned && tries < 5) {
      tries += 1
      if (showConsoleMessages) { console.log(prefix + `learn_attempt_${tries}`.yellow) }
      logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, prefix + `learn_attempt_${tries}`.yellow)
      learned = learnAndPersistDevice(d, dumpText)
      if (!learned && tries < 5) {
        await sleep(1000)
      }
    }

    if (!learned) {
      if (showConsoleMessages) { console.log(prefix + `unlearned_descriptor_failed_after_${tries}_tries`.red) }
       logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, `unlearned_descriptor_failed_after_${tries}_tries`.red)
      continue
    }

    if (showConsoleMessages) { console.log(prefix + `learned_after_${tries}_tries`.green) }

    startInputLoggerForDevice(d, learned)
  }
  initializeUI(getDevicesStore(),"from_brain-detection-initialize")
}
function initializeUI(data, receiver) {
  if (windowItemsStore.get('currentPage') == 'dashboard' || windowItemsStore.get('currentPage') == 'joyview') {
    let package = {}
    for (const item in data) {
      if (!data[item].product) continue
      const prod = data[item].key
      const parsed = data[item].parsedInputs
      if (!package[prod]) {
        package[prod] = {
          key: data[item].key.split("|")[0],
          product: data[item].product,
          vid: data[item].vendorId,
          pid: data[item].productId,
          prefix: data[item].prefix.split("_")[0],
          position: data[item].jsIndex,
          buttons:  data[item].parsedInputs.buttonsByReport['1']?.length || 0,
          axes: []
        }
      }
      const axesArr = parsed.axesByReport?.['1'] || []
      package[prod].axes = axesArr.map(a => a.name)
    }
    let sortedPackage = Object.values(package)
      .sort((a, b) => a.position - b.position)
    sortedPackage['receiver'] = receiver

    // console.log(sortedPackage)

    blastToUI(sortedPackage)
    // logs_warn(sortedPackage)
  }
}

//VERY FIRST TIME RUN ONLY!!!!
let init = 1
setTimeout(() => {
    init = 0
    logs('=== Ready to Receive Inputs ==='.green)
}, 2000)
main()
//#############################

ipcMain.on('changePage', async (receivedData) => {
  setTimeout(() => {
      if (showConsoleMessages) { logs_debug("[RENDERER]".bgGreen,"Page Change:".yellow,windowItemsStore.get('currentPage')) }
      init = 1
      initializeUI(getDevicesStore(),"from_brain-detection-initialize")

      setTimeout(() => {
        init = 0
        console.log('=== Ready to Receive Inputs ==='.green)
      }, 2000)

  },300)
})
ipcMain.on('initializer-response', (event,message) => {
    logs("[RENDERER-Init]".bgGreen,message)
})
ipcMain.on('renderer-response-error', (event,message,location) => {
    logs_error("[RENDERER-ERROR]".red,message,location)
})
ipcMain.on('renderer-response-unhandled-error', (event,message,location) => {
    logs_error("[RENDERER-UNHANDLED-ERROR]".bgRed,message,location)
})