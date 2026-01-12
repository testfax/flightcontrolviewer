const devMode = { devMode: 0 }
const { setLogsMenuEnabled } = require('../menumaker')
const { logs_translate, logs_warn, logs, logs_error, logs_debug } = require('../utils/logConfig')
const { blastToUI } = require('../brain/input-functions')
const { runWinHidDump, getWinHidDumpPath } = require('../utils/utilities')
const HID = require('node-hid')
const { app, ipcMain, BrowserWindow, webContents } = require('electron')
const Store = require('electron-store').default
const deviceInfo = new Store({ name: 'deviceInfo' })
const windowItemsStore = new Store({ name: 'electronWindowIds' })
const actionmaps = new Store({ name: 'actionmapsJSON' })
const layoutIndex = new Store({ name: "layoutIndex" })
const showConsoleMessages = windowItemsStore.get('showConsoleMessages')
const staticData = require('../staticData.json')
const fs = require('fs')
const path = require('path')


const { pathToFileURL } = require('url')
const colors = require('colors')

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
  // ✅ Persist "true live" axes detected during warmup so UI can show only real axes
function setDeviceUsableAxes(d, axisNames) {
  const key = deviceKeyFromHidInfo(d)
  const devices = getDevicesStore()
  if (!devices[key]) return

  const uniq = Array.from(new Set(axisNames)).filter(Boolean)
  logs("UNIQUE ENTRY:".yellow, d.product, uniq)
  devices[key].usableAxes = uniq
  devices[key].usableAxesSavedAt = Math.floor(Date.now() / 1000)

  setDevicesStore(devices)
}
  //---------- dump parsing / descriptor extraction ----------
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
// ------------------------------
// HID Usage naming
// ------------------------------
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
      case 0x39: return 'hat1' // ✅ Hat Switch (POV) is NOT a button and not an analog axis; we will treat specially
      default: return `gd_${usage.toString(16)}`
    }
  }
  if (usagePage === 0x02) return `sim_${usage.toString(16)}`
  return `up${usagePage.toString(16)}_${usage.toString(16)}`
}
// Filter out "junk axes" that show up as variable inputs but are not meaningful controls
function shouldKeepAxis(usagePage, usage, bitSize, logicalMin, logicalMax) {
  // undefined / unknown usage almost always means "not a real axis" for our UI
  if (usagePage === 0 || usage === 0) return false

  // 1-bit "axis" is almost always a button/flag that got described outside Button page
  if (bitSize === 1) return false

  if (bitSize <= 0 || bitSize > 31) return false

  // if the descriptor claims no meaningful range, it's usually padding/constant-ish
  if (typeof logicalMin === 'number' && typeof logicalMax === 'number' && logicalMin === logicalMax) return false

  return true
}
// Hat Switch: commonly 4 bits with values 0-7 and 8/15 meaning "neutral"
function isHatAxis(usagePage, usage, name) {
  if (usagePage === 0x01 && usage === 0x39) return true
  if (name === 'hat' || String(name).startsWith('hat')) return true
  return false
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

  // Ensure axis "name" is unique per report to avoid collisions in runtime maps
  function uniqueAxisNameForReport(rid, baseName) {
    const arr = axesByReport.get(rid) || []
    let name = baseName
    let n = 2
    while (arr.some(x => x && x.name === name)) {
      name = `${baseName}${n}`
      n += 1
    }
    return name
  }

  function addAxis(rid, usagePage, usage, bitOffset, bitSize, logicalMin, logicalMax) {
    if (!axesByReport.has(rid)) axesByReport.set(rid, [])

    const baseName = usageName(usagePage, usage)
    const name = uniqueAxisNameForReport(rid, baseName)

    axesByReport.get(rid).push({
      usagePage,
      usage,
      name,
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
          // Buttons (Button Page)
          for (let idx = 0; idx < count; idx += 1) {
            let usage = fieldUsages[idx]
            if (usage == null) usage = (idx + 1)
            addButton(rid, usage, startBit + (idx * sizeBits), sizeBits)
          }
        } else {
          // Axes / other variable inputs
          for (let idx = 0; idx < count; idx += 1) {
            const usage = fieldUsages[idx]
            if (usage == null) continue

            // ✅ Drop junk "axes" (like up0_0) and 1-bit flags masquerading as axes
            if (!shouldKeepAxis(state.usagePage, usage, sizeBits, state.logicalMin, state.logicalMax)) continue

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

  // ✅ NEW: record total bits per report so we can match packets by payload length
  const reportBitsByReport = new Map()
  const allRids = new Set([
    ...buttonsByReport.keys(),
    ...axesByReport.keys(),
    ...bitCursor.keys()
  ])
  for (const rid of allRids) {
    reportBitsByReport.set(rid, cursorGet(rid))
  }

  return { hasReportIds: reportIdsSeen.size > 0, buttonsByReport, axesByReport, reportBitsByReport }
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
  const bits = {}

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

  // ✅ NEW: persist bits per RID so we can resolve missing report-id byte reliably
  if (parsed.reportBitsByReport && typeof parsed.reportBitsByReport.entries === 'function') {
    for (const [rid, v] of parsed.reportBitsByReport.entries()) {
      bits[String(rid)] = v
    }
  }

  return {
    hasReportIds: parsed.hasReportIds ? 1 : 0,
    buttonsByReport: buttons,
    axesByReport: axes,
    reportBitsByReport: bits
  }
}
function plainToInputsMaps(plain) {
  const buttonsByReport = new Map()
  const axesByReport = new Map()
  const reportBitsByReport = new Map()

  const buttons = plain && plain.buttonsByReport ? plain.buttonsByReport : {}
  const axes = plain && plain.axesByReport ? plain.axesByReport : {}
  const bits = plain && plain.reportBitsByReport ? plain.reportBitsByReport : {}

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

  Object.keys(bits).forEach(ridStr => {
    const rid = Number(ridStr)
    const v = Number(bits[ridStr])
    if (Number.isFinite(v)) reportBitsByReport.set(rid, v)
  })

  return {
    hasReportIds: plain && plain.hasReportIds ? true : false,
    buttonsByReport,
    axesByReport,
    reportBitsByReport
  }
}
function addToIndexDevices(learned) {
  const pidvid = pidVidFromHidPath(learned.path,learned.key)
  if (!pidvid) return
  const storeAll = structuredClone(layoutIndex.store || {})
  const hasNested = storeAll.layoutIndex && typeof storeAll.layoutIndex === 'object'
  const data = hasNested ? storeAll.layoutIndex : storeAll
  if (!data.devices || typeof data.devices !== 'object') data.devices = {}
  if (!data.deviceList || typeof data.deviceList !== 'object') data.deviceList = {}
  if (!data.schema) data.schema = 1
  const productRaw = String(learned.product || '')
  const productNorm = productRaw.trim().toLowerCase()
  let layoutFile = data.deviceList[learned.product] || null
  if (!layoutFile) {
    const matchKey = Object.keys(data.deviceList).find(k => String(k).trim().toLowerCase() === productNorm) || null
    if (matchKey) layoutFile = data.deviceList[matchKey]
  }

  if (!layoutFile) {
    logs_warn(
      '[BRAIN]'.bgCyan,
      'input-detection'.yellow,
      'No deviceList match for product',
      learned.product,
      'pidvid',
      pidvid
    )
    return
  }

  data.devices[pidvid] = layoutFile
  
  if (hasNested) {
    layoutIndex.set('layoutIndex', data)
  } else {
    layoutIndex.set('devices', data.devices)
    layoutIndex.set('schema', data.schema)
    layoutIndex.set('deviceList', data.deviceList)
  }

  // logs_debug(
  //   '[BRAIN]'.bgCyan,
  //   'input-detection'.yellow,
  //   'Mapped pidvid -> layout',
  //   pidvid,
  //   '->',
  //   layoutFile
  // )
}
function learnAndPersistDevice(d, dumpText) {
  // IMPORTANT CHANGE: pass the full device so we can match by PATH
  const extracted = extractDescriptorBufferFromDump(dumpText, d)
  if (!extracted.ok || !extracted.buf) return null

  const parsed = parseInputsFromReportDescriptor(extracted.buf)

  let totalButtons = 0
  for (const arr of parsed.buttonsByReport.values()) totalButtons += arr.length
  let totalAxes = 0
  for (const arr of parsed.axesByReport.values()) totalAxes += arr.length
  if (totalButtons === 0 && totalAxes === 0 && d.product != "vJoy - Virtual Joystick") return null
  

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
  addToIndexDevices(devices[key])
  if (showConsoleMessages) { console.log('Learned Device:'.cyan, devices[key].product) }
  logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, 'Learned Device:'.cyan, devices[key].product)
  blastToUI(package = {
    ...data = { message: `Input-Detection: Learned Device: ${devices[key].product}` },
    ...{ receiver: "from_brain-detection" },
  })
  setDevicesStore(devices)

  return parsed
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
//Collect ALL axes across all report IDs (instead of only report '1')
//✅ Exclude hats from axis list (they will be represented as POV/virtual buttons)
function collectAllAxisNamesFromPlain(parsedInputs) {
  const byRid = parsedInputs && parsedInputs.axesByReport ? parsedInputs.axesByReport : {}
  const out = []
  for (const ridStr of Object.keys(byRid)) {
    const arr = byRid[ridStr] || []
    for (const a of arr) {
      if (!a || !a.name) continue
      if (isHatAxis(a.usagePage, a.usage, a.name)) continue
      out.push(a.name)
    }
  }
  return out
}
// Convert HID hat value to virtual direction buttons
// Common: 0=Up,1=UpRight,2=Right,3=DownRight,4=Down,5=DownLeft,6=Left,7=UpLeft, 8 or 15 = neutral
function hatValueToDirs(v) {
  const val = Number(v)
  if (!Number.isFinite(val)) return { up: 0, right: 0, down: 0, left: 0, neutral: 1 }

  if (val === 8 || val === 15) return { up: 0, right: 0, down: 0, left: 0, neutral: 1 }

  const dirs = {
    up: (val === 0 || val === 1 || val === 7) ? 1 : 0,
    right: (val === 1 || val === 2 || val === 3) ? 1 : 0,
    down: (val === 3 || val === 4 || val === 5) ? 1 : 0,
    left: (val === 5 || val === 6 || val === 7) ? 1 : 0,
    neutral: 0
  }
  return dirs
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
function pidVidFromHidPath(path, key) {
  const fromHidPath = v => {
    if (typeof v !== 'string') return null
    const m = v.match(/VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})/)
    return m ? `${m[1].toUpperCase()}:${m[2].toUpperCase()}` : null
  }

  const fromKey = v => {
    if (typeof v !== 'string') return null
    const m = v.match(/^([0-9A-Fa-f]{4}):([0-9A-Fa-f]{4})/)
    return m ? `${m[1].toUpperCase()}:${m[2].toUpperCase()}` : null
  }

  return fromHidPath(path) || fromKey(key)
}
function resolveLayoutsDir(app, path) {
  return path.join(app.getAppPath(), 'layouts')
}
function gatherAfterDeviceInputs(data, d) {
  const joyInfo = data.split('_')
  logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, 'joyInfo'.cyan, joyInfo)
  let result

  if (joyInfo[1] == 'axis') {
    result = findKeybind(`${joyInfo[0]}_${joyInfo[2]}`, actionmaps.get('discoveredKeybinds'))
  }
  else if (String(joyInfo[1] || '').startsWith('hat')) {
    result = findKeybind(`${joyInfo[0]}_${joyInfo[1]}_${joyInfo[2]}`, actionmaps.get('discoveredKeybinds'))
  }
  else {
    result = findKeybind(`${joyInfo[0]}_${joyInfo[1]}`, actionmaps.get('discoveredKeybinds'))
  }

  const deviceSpecs = {
    key: pidVidFromHidPath(d.path,d.key),
    joyInput: data,
    product: d.product,
    vid: d.vendorId,
    pid: d.productId,
    keybindArray: result,
    position: joyInfo[0].slice(-1),
    prefix: joyInfo[0],
    keybindArticulation: staticData.keybindArticulation
  }

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
        if (!devices) {
          logs('[BRAIN]'.red, 'input-detection'.yellow, 'No devices ready...')
          blastToUI(package = {
            ...data = { message: "Input-Detection: No devices ready..." },
            ...{ receiver: "from_brain-detection" },
          })
          return
        }
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
    ...{ receiver: "from_brain-detection" },
  }
  blastToUI(package)
}
// Collect ALL buttons across all report IDs (instead of only report '1')
function countAllButtonsFromPlain(parsedInputs) {
  const byRid = parsedInputs && parsedInputs.buttonsByReport ? parsedInputs.buttonsByReport : {}
  let count = 0
  for (const ridStr of Object.keys(byRid)) {
    const arr = byRid[ridStr] || []
    count += arr.length
  }

  const HARD_CAP = 128
  if (count > HARD_CAP) count = HARD_CAP

  return count
}
async function main() {
  const devices = listAllJoysticks()
  if (!devices.length) {
    console.log('[input-detection] No joystick-class devices found (usagePage=1 usage=4)')
    logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, '[input-detection] No joystick-class devices found (usagePage=1 usage=4)'.yellow)
    blastToUI(package = {
      ...data = { message: `Input-Detection: No joystick-class devices found (usagePage=1 usage=4)` },
      ...{ receiver: "from_brain-detection" },
    })
    return
  }

  // ✅ IMPORTANT: reorder prefixes ONCE before attaching listeners (prevents mid-stream prefix changes)
  try {
    correctControls()
  } catch (e) {
    // don't brick startup if actionmaps aren't ready yet
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
      if (entry.path !== d.path) {
        entry.path = d.path
        entry.savedAt = Math.floor(Date.now() / 1000)
        stored[key] = entry
        setDevicesStore(stored)
      }
      const parsed = plainToInputsMaps(entry.parsedInputs)
      if (page == 'joyview') startInputLoggerForDevice(d, parsed)
      continue
    }

    if (!dumpAvailable) {
      const prefix = jsPrefixForDevice(d)
      if (showConsoleMessages) { console.log(prefix + 'unlearned_no_dump') }
      logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, prefix + 'unlearned_no_dump'.red)
      blastToUI(package = {
        ...data = { message: `Input-Detection: ${prefix}unlearned_no_dump` },
        ...{ receiver: "from_brain-detection" },
      })
      continue
    }

    const prefix = jsPrefixForDevice(d)
    let learned = null
    let tries = 0

    while (!learned && tries < 5) {
      tries += 1
      if (showConsoleMessages) { console.log(prefix + `learn_attempt_${tries}`.yellow) }
      logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, prefix + `learn_attempt_${tries}`.yellow)
      blastToUI(package = {
        ...data = { message: `Input-Detection: ${prefix}learn_attempt_${tries}` },
        ...{ receiver: "from_brain-detection" },
      })
      learned = learnAndPersistDevice(d, dumpText)
      if (!learned && tries < 5) {
        await sleep(1000)
      }
    }

    if (!learned) {
      if (showConsoleMessages) { console.log(prefix + `unlearned_descriptor_failed_after_${tries}_tries`.red) }
      logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, `unlearned_descriptor_failed_after_${tries}_tries`.red)
      blastToUI(package = {
        ...data = { message: `Input-Detection: unlearned_descriptor_failed_after_${tries}_tries` },
        ...{ receiver: "from_brain-detection" },
      })
      continue
    }

    if (showConsoleMessages) { console.log(prefix + `learned_after_${tries}_tries`.green) }

    if (page == 'joyview') startInputLoggerForDevice(d, learned)
  }

  // ✅ FIX: always send initialization once listeners are attached
  if (page == 'joyview') {
    initializeUI(getDevicesStore(), "from_brain-detection-initialize")
  }

  if (page == 'setup') { setupUI(getDevicesStore(), "from_brain-detection") }
}
function initializeUI(data, receiver) {
  if (windowItemsStore.get('currentPage') === 'joyview') {
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
          buttons: countAllButtonsFromPlain(data[item].parsedInputs),
          axes: [],
          hats: []
        }
      }

      const persistedUsable = data[item].usableAxes
      if (Array.isArray(persistedUsable) && persistedUsable.length) {
        package[prod].axes = persistedUsable
      } else {
        package[prod].axes = collectAllAxisNamesFromPlain(parsed)
      }

      const byRid = parsed && parsed.axesByReport ? parsed.axesByReport : {}
      const hats = new Set()
      for (const ridStr of Object.keys(byRid)) {
        const arr = byRid[ridStr] || []
        for (const a of arr) {
          if (!a || !a.name) continue
          if (isHatAxis(a.usagePage, a.usage, a.name)) hats.add(a.name)
        }
      }
      package[prod].hats = Array.from(hats)
    }
    let sortedPackage = Object.values(package)
      .sort((a, b) => a.position - b.position)
    sortedPackage['receiver'] = receiver
    sortedPackage = { ...sortedPackage, ...devMode }
    const pkg = {
      receiver,
      appVersion: app.getVersion(),
      message: JSON.stringify(sortedPackage, null, 2),
      devMode
    }
    blastToUI(sortedPackage)
    // logs_warn(pkg) dont enable
    setTimeout(() => {
      init = 0
      const package = { receiver: "from_brain-detection-ready", data: 1 }
      blastToUI(package)
      setLogsMenuEnabled(true)
      logs_debug('=== Ready to Receive Inputs ==='.green)
    }, 2000)
  }
}
function setupUI(data, receiver) {
  if (windowItemsStore.get('currentPage') !== 'setup') return
  logs('[BRAIN]'.bgCyan, 'input-detection'.yellow, 'Clicked Setup Page'.green)
  const byProd = {}

  for (const item in data) {
    if (!data[item]?.product) continue

    const prod = data[item].key
    const parsed = data[item].parsedInputs

    if (!byProd[prod]) {
      byProd[prod] = {
        key: String(data[item].key).split('|')[0],
        product: data[item].product,
        vid: data[item].vendorId,
        pid: data[item].productId,
        prefix: String(data[item].prefix).split('_')[0],
        position: data[item].jsIndex,
        buttons: countAllButtonsFromPlain(parsed),
        axes: [],
        hats: []
      }
    }

    const persistedUsable = data[item].usableAxes
    if (Array.isArray(persistedUsable) && persistedUsable.length) {
      byProd[prod].axes = persistedUsable
    } else {
      byProd[prod].axes = collectAllAxisNamesFromPlain(parsed)
    }

    const byRid = parsed && parsed.axesByReport ? parsed.axesByReport : {}
    const hats = new Set()
    for (const ridStr of Object.keys(byRid)) {
      const arr = byRid[ridStr] || []
      for (const a of arr) {
        if (!a || !a.name) continue
        if (isHatAxis(a.usagePage, a.usage, a.name)) hats.add(a.name)
      }
    }
    byProd[prod].hats = Array.from(hats)
  }

  let sortedPackage = Object.values(byProd).sort((a, b) => a.position - b.position)
  delete sortedPackage.keybindArticulation
  const pkg = {
    receiver,
    appVersion: app.getVersion(),
    message: JSON.stringify(sortedPackage, null, 2),
    devMode
  }

  blastToUI(pkg)
  logs_warn(pkg)

  const package1 = { receiver: "from_brain-detection", data: deviceInfo.get() }
  blastToUI(package1)

  init = 0
  const package = { receiver: "from_brain-detection-ready", data: 1 }
  blastToUI(package)
  logs('=== Ready to Receive Inputs ==='.green)
}
function startInputLoggerForDevice(d, parsed) {
  const prefix = jsPrefixForDevice(d)
  let device = null
  try {
    device = new HID.HID(d.path)
  } catch (e) {
    logs_error("[ERROR] " + prefix + 'open_failed', d.path)
    return
  }

  const lastButtons = new Map()

  // axis state (KEYED BY OUTPUT STRING NOW)
  const axisActive = new Map()
  const axisLastVal = new Map()
  const axisLastEmit = new Map()

  // rotx/roty gating
  const rotArmed = new Map() // outKey -> boolean
  const rotHome = new Map()  // outKey -> learned center value at rest (from warmup)

  // Hat tracking for virtual buttons (per hat name)
  const hatLastDirs = new Map() // hatOutPrefix -> {up,right,down,left,neutral}

  // warmup sampling (UI only; NEVER blocks reporting)
  const axisMin = new Map() // outKey -> min observed
  const axisMax = new Map() // outKey -> max observed
  const axisSeen = new Map() // outKey -> samples
  const WARMUP_MS = 2000
  const WARMUP_EPS = 8
  const WARMUP_MIN_SAMPLES = 8
  let warmupStartedAt = 0
  let usableAxesPersisted = false

  // suppress repeats if the exact same control was the last one reported
  let lastReported = ''

  // block axis reporting for 1s after any button press
  let lastButtonAt = 0
  const AXIS_BLOCK_AFTER_BUTTON_MS = 1000

  const CENTER_PERCENT = 0.10
  const MOVE_PERCENT = 0.02
  const AXIS_COOLDOWN_MS = 1000

  // --- DEBUG: axes-by-rid dump + rid sampling (does not affect behavior) ---
  const DEBUG_RID = 1
  let axesByRidDumped = false

  function dumpAxesByRidOnce() {
    if (!DEBUG_RID) return
    if (axesByRidDumped) return
    axesByRidDumped = true

    try {
      const rows = []
      for (const pair of parsed.axesByReport.entries()) {
        const rid = pair[0]
        const list = pair[1] || []
        const names = list
          .filter(a => a && a.name)
          .map(a => a.name)
          .join(', ')
        rows.push({ rid, axes: names })
      }
      rows.sort((a, b) => a.rid - b.rid)

      logs('[AXES BY RID]'.bgCyan, prefix, d.product)
      for (const r of rows) {
        logs('  rid'.yellow, String(r.rid).cyan, '=>'.yellow, r.axes || '(none)')
      }
    } catch (err) {
      logs('[AXES BY RID] dump failed'.bgRed, err)
    }
  }

  let ridSampleUntil = 0
  let ridLastPrintedAt = 0
  const RID_SAMPLE_MS = 150

  global.dumpRudderRid = (ms = 2000) => {
    ridSampleUntil = Date.now() + Math.max(250, Number(ms) || 2000)
    logs('[RID]'.bgBlue, prefix, 'sampling enabled for'.yellow, (ridSampleUntil - Date.now()) + 'ms')
  }

  let pktSampleUntil = 0
  let pktLastPrintedAt = 0
  const PKT_SAMPLE_MS = 250

  global.dumpRudderPackets = (ms = 2000) => {
    pktSampleUntil = Date.now() + Math.max(250, Number(ms) || 2000)
    logs('[PKT]'.bgMagenta, prefix, 'sampling enabled for'.yellow, (pktSampleUntil - Date.now()) + 'ms')
  }
  // ------------------------------------------------------------------------

  // SINGLE-AXIS EXCEPTION (do not change behavior; just keep your existing logic)
  const axisNames = new Set()
  for (const list of parsed.axesByReport.values()) {
    for (const a of list) {
      if (!isHatAxis(a.usagePage, a.usage, a.name)) axisNames.add(a.name)
    }
  }
  const isSingleAxisDevice = axisNames.size === 1
  let singleAxisOutKey = null
  if (isSingleAxisDevice) {
    singleAxisOutKey = `${prefix}axis_${Array.from(axisNames)[0]}`
  }

  // warn once per unexpected RID per device
  const unknownRidWarned = new Set()

  function reportOnce(keyStr) {
    if (keyStr === lastReported) {
      if (!(isSingleAxisDevice && keyStr === singleAxisOutKey)) return false
    }
    lastReported = keyStr
    return true
  }

  // ✅ pick RID by expected payload length (fixes VKB "firstByte looks random" cases)
  function expectedPayloadLenForRid(rid) {
    if (!parsed.reportBitsByReport || !parsed.reportBitsByReport.has(rid)) return null
    const bits = parsed.reportBitsByReport.get(rid) || 0
    const bytes = Math.ceil(bits / 8)
    if (!Number.isFinite(bytes) || bytes <= 0) return null
    return bytes
  }

  function resolveRidAndPayload(dataBuf) {
    let rid = 0
    let payload = dataBuf

    if (!parsed.hasReportIds) {
      return { rid, payload }
    }

    const ridCandidate = dataBuf[0]

    const candidateKnown =
      parsed.buttonsByReport.has(ridCandidate) || parsed.axesByReport.has(ridCandidate)

    if (candidateKnown) {
      const exp = expectedPayloadLenForRid(ridCandidate)
      const slicedLen = dataBuf.length - 1

      if (exp != null && exp === slicedLen) {
        rid = ridCandidate
        payload = dataBuf.slice(1)
        return { rid, payload }
      }

      if (exp == null) {
        rid = ridCandidate
        payload = dataBuf.slice(1)
        return { rid, payload }
      }
    }

    const haveRids = Array.from(new Set([
      ...parsed.buttonsByReport.keys(),
      ...parsed.axesByReport.keys()
    ])).sort((a, b) => a - b)

    // match a RID whose expected payload length matches full buffer length (RID byte missing from stream)
    let bestRid = null
    for (const r of haveRids) {
      const exp = expectedPayloadLenForRid(r)
      if (exp == null) continue
      if (exp === dataBuf.length) {
        bestRid = r
        break
      }
    }

    if (bestRid != null) {
      rid = bestRid
      payload = dataBuf

      if (!unknownRidWarned.has(ridCandidate)) {
        unknownRidWarned.add(ridCandidate)
        logs_warn('[BRAIN]'.bgYellow, 'input-detection'.yellow, 'ReportId missing from data stream (matched by payload length)'.yellow, {
          gotFirstByte: ridCandidate,
          assumedRid: bestRid,
          len: dataBuf.length,
          product: d.product,
          path: d.path
        })
      }

      return { rid, payload }
    }

    const hasRid1 = parsed.buttonsByReport.has(1) || parsed.axesByReport.has(1)
    const hasRid0 = parsed.buttonsByReport.has(0) || parsed.axesByReport.has(0)

    if (hasRid1 && !hasRid0) {
      rid = 1
      payload = dataBuf

      if (!unknownRidWarned.has(ridCandidate)) {
        unknownRidWarned.add(ridCandidate)
        logs_warn('[BRAIN]'.bgYellow, 'input-detection'.yellow, 'ReportId missing from data stream (fallback rid=1)'.yellow, {
          gotFirstByte: ridCandidate,
          assumedRid: 1,
          len: dataBuf.length,
          product: d.product,
          path: d.path
        })
      }

      return { rid, payload }
    }

    rid = 0
    payload = dataBuf

    if (!unknownRidWarned.has(ridCandidate)) {
      unknownRidWarned.add(ridCandidate)
      logs_warn('[BRAIN]'.bgYellow, 'input-detection'.yellow, 'Unknown RID from device (falling back to rid=0)'.red, {
        gotRid: ridCandidate,
        haveRids,
        len: dataBuf.length,
        product: d.product,
        path: d.path
      })
    }

    return { rid, payload }
  }

  // ✅ WARMUP FIX
  function persistUsableAxesOnce() {
    if (usableAxesPersisted) return
    if (warmupStartedAt === 0) return
    const age = Date.now() - warmupStartedAt
    if (age < WARMUP_MS) return

    const candidatesByName = new Map() // name -> { name, span, range }
    for (const list of parsed.axesByReport.values()) {
      for (const ax of list) {
        if (!ax || !ax.name) continue
        if (isHatAxis(ax.usagePage, ax.usage, ax.name)) continue

        const k = `${prefix}axis_${ax.name}`
        const seen = axisSeen.get(k) || 0
        if (seen < WARMUP_MIN_SAMPLES) continue

        const mn = axisMin.get(k)
        const mx = axisMax.get(k)
        const span = Math.abs((mx ?? 0) - (mn ?? 0))
        const range = Math.abs((ax.logicalMax ?? 0) - (ax.logicalMin ?? 0))

        const prev = candidatesByName.get(ax.name)
        if (!prev || span > prev.span) {
          candidatesByName.set(ax.name, { name: ax.name, span, range })
        }
      }
    }

    const uniq = Array.from(candidatesByName.values())

    let usableNow = uniq
      .filter(c => c.span > WARMUP_EPS)
      .sort((a, b) => b.span - a.span)
      .map(c => c.name)

    if (!usableNow.length && uniq.length) {
      uniq.sort((a, b) => (b.span - a.span) || (b.range - a.range))
      usableNow = [uniq[0].name]
    }

    if (!usableNow.length) {
      for (const list of parsed.axesByReport.values()) {
        for (const ax of list) {
          if (!ax || !ax.name) continue
          if (isHatAxis(ax.usagePage, ax.usage, ax.name)) continue
          usableNow = [ax.name]
          break
        }
        if (usableNow.length) break
      }
    }

    if (usableNow.length) {
      setDeviceUsableAxes(d, usableNow)
    }

    usableAxesPersisted = true
  }

  device.on('data', (data) => {
    const resolved = resolveRidAndPayload(data)
    const rid = resolved.rid
    const payload = resolved.payload

    // DEBUG: dump axes-per-rid once (first time we get data)
    dumpAxesByRidOnce()

    // DEBUG: RID sampling (only when enabled)
    if (DEBUG_RID && ridSampleUntil && Date.now() < ridSampleUntil) {
      const now = Date.now()
      if (now - ridLastPrintedAt >= RID_SAMPLE_MS) {
        ridLastPrintedAt = now
        logs(
          '[RID]'.bgBlue,
          prefix,
          'rid='.yellow, rid,
          'payloadLen='.yellow, payload.length,
          'rawLen='.yellow, data.length
        )
      }
    }

    // DEBUG: Packet sampling (optional)
    if (DEBUG_RID && pktSampleUntil && Date.now() < pktSampleUntil) {
      const now = Date.now()
      if (now - pktLastPrintedAt >= PKT_SAMPLE_MS) {
        pktLastPrintedAt = now
        logs(
          '[PKT]'.bgMagenta,
          prefix,
          'rid='.yellow, rid,
          'first16='.yellow,
          Array.from(payload.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
        )
      }
    }

    const buttons = parsed.buttonsByReport.get(rid) || []
    const axes = parsed.axesByReport.get(rid) || []
    if (!buttons.length && !axes.length) return

    // Lazily init baseline states
    for (const b of buttons) {
      const k = `${rid}:${b.usage}`
      if (!lastButtons.has(k)) {
        lastButtons.set(k, readButtonBit(payload, b.bitOffset))
      }
    }

    // Warmup sampling + lazy init
    for (const a of axes) {
      const outKey = `${prefix}axis_${a.name}`

      const rawU = readBitsAsUnsignedLE(payload, a.bitOffset, a.bitSize)
      let val = rawU
      if (a.logicalMin < 0) val = toSigned(rawU, a.bitSize)

      if (!axisLastVal.has(outKey)) axisLastVal.set(outKey, val)
      if (!axisActive.has(outKey)) axisActive.set(outKey, false)
      if (!axisLastEmit.has(outKey)) axisLastEmit.set(outKey, 0)

      if (isHatAxis(a.usagePage, a.usage, a.name)) {
        const hatBase = `${prefix}${a.name}`
        if (!hatLastDirs.has(hatBase)) hatLastDirs.set(hatBase, hatValueToDirs(val))
        continue
      }

      if (a.name === 'rotx' || a.name === 'roty') {
        if (!rotHome.has(outKey)) rotHome.set(outKey, val)
        if (!rotArmed.has(outKey)) rotArmed.set(outKey, true)
      }

      if (warmupStartedAt === 0) warmupStartedAt = Date.now()

      const min0 = axisMin.get(outKey)
      const max0 = axisMax.get(outKey)
      axisMin.set(outKey, (min0 == null) ? val : Math.min(min0, val))
      axisMax.set(outKey, (max0 == null) ? val : Math.max(max0, val))
      axisSeen.set(outKey, (axisSeen.get(outKey) || 0) + 1)
    }

    persistUsableAxesOnce()

    // Buttons
    for (const b of buttons) {
      const key = `${rid}:${b.usage}`
      const prev = lastButtons.get(key) || false
      const down = readButtonBit(payload, b.bitOffset)

      if (down && !prev) {
        lastButtonAt = Date.now()

        const out = `${prefix}button${b.usage}`
        if (reportOnce(out)) {
          if (showConsoleMessages) console.log(out.blue)
          gatherAfterDeviceInputs(out, d)
        }
      }

      lastButtons.set(key, down)
    }

    // Axes + hats
    for (const a of axes) {
      const out = `${prefix}axis_${a.name}`

      const rawU = readBitsAsUnsignedLE(payload, a.bitOffset, a.bitSize)
      let val = rawU
      if (a.logicalMin < 0) val = toSigned(rawU, a.bitSize)

      if (isHatAxis(a.usagePage, a.usage, a.name)) {
        axisLastVal.set(out, val)
        axisActive.set(out, false)

        const hatBase = `${prefix}${a.name}`
        const prevDirs = hatLastDirs.get(hatBase) || { up: 0, right: 0, down: 0, left: 0, neutral: 1 }
        const nowDirs = hatValueToDirs(val)

        const map = [
          ['up', `${hatBase}_up`],
          ['right', `${hatBase}_right`],
          ['down', `${hatBase}_down`],
          ['left', `${hatBase}_left`]
        ]

        for (const pair of map) {
          const k = pair[0]
          const outKey = pair[1]
          const was = prevDirs[k] === 1
          const is = nowDirs[k] === 1
          if (is && !was) {
            lastButtonAt = Date.now()
            if (reportOnce(outKey)) {
              if (showConsoleMessages) console.log(outKey.blue)
              gatherAfterDeviceInputs(outKey, d)
            }
          }
        }

        hatLastDirs.set(hatBase, nowDirs)
        continue
      }

      const cfg = computeAxisCenterAndThreshold(a, CENTER_PERCENT)
      const centerDelta = Math.abs(val - cfg.center)

      const prevVal = axisLastVal.get(out)
      axisLastVal.set(out, val)

      const now = Date.now()
      const lastEmit = axisLastEmit.get(out) || 0

      const wasActive = axisActive.get(out) || false
      const isActive = centerDelta >= cfg.threshold

      let movedEnough = false
      if (typeof prevVal === 'number') {
        const moveThreshold = Math.max(1, Math.round(cfg.range * MOVE_PERCENT))
        if (Math.abs(val - prevVal) >= moveThreshold) movedEnough = true
      }

      const buttonCooldownActive = (now - lastButtonAt) < AXIS_BLOCK_AFTER_BUTTON_MS

      const isRot = (a.name === 'rotx' || a.name === 'roty')
      if (isRot) {
        const home = rotHome.get(out)
        if (typeof home === 'number') {
          const rotDelta = Math.abs(val - home)

          const halfThrow = Math.max(1, Math.round(cfg.range * 0.50))
          const withinTen = Math.max(1, Math.round(cfg.range * 0.10))

          let armed = rotArmed.get(out)
          if (armed == null) armed = true

          if (!armed) {
            if (rotDelta <= withinTen) rotArmed.set(out, true)
            axisActive.set(out, isActive)
            continue
          }

          if (rotDelta < halfThrow) {
            axisActive.set(out, isActive)
            continue
          }
        }
      }

      if (init == 0 && !buttonCooldownActive) {
        if (!wasActive && isActive) {
          if (reportOnce(out)) {
            if (showConsoleMessages) console.log(out.cyan)
          }
          axisLastEmit.set(out, now)
        } else if (movedEnough && (now - lastEmit) >= AXIS_COOLDOWN_MS) {
          if (reportOnce(out)) {
            if (showConsoleMessages) console.log(out.red)
            gatherAfterDeviceInputs(out, d)
          }

          if (a.name === 'rotx' || a.name === 'roty') {
            rotArmed.set(out, false)
          }

          axisLastEmit.set(out, now)
        }
      }

      axisActive.set(out, isActive)
    }
  })

  device.on('error', (err) => {
    logs_error(err)
    console.log(err)
    setTimeout(() => {
      console.log('[BRAIN]'.bgCyan, 'RESTARTING AFTER DEVICE LOST'.red)
      app.relaunch()
      app.exit(0)
    }, 8000)
  })

  logs(`[${prefix}] listeners attached`, {
    data: device.listenerCount('data'),
    error: device.listenerCount('error'),
    path: d.path,
    product: d.product
  })
  blastToUI({
    receiver: 'from_brain-detection',
    message: `Input-Detection: ${prefix} listeners attached (data=${device.listenerCount('data')} error=${device.listenerCount('error')})`
  })
}

let init = 1
let page = 'joyview'
setTimeout(() => {
  main()
}, 250)

//#############################

ipcMain.handle('joyview:get-layout', async (event, { vidPidKey }) => {
  try {
    if (!vidPidKey || typeof vidPidKey !== 'string') {
      return { ok: 0, error: 'Invalid vidPidKey' }
    }

    let devicesMap = layoutIndex.get(layoutIndex)
    devicesMap = structuredClone(layoutIndex.store)

    if (!devicesMap || typeof devicesMap !== 'object') {
      return { ok: 0, error: 'layoutIndex.json missing "devices" map' }
    }
    const layoutFile = devicesMap.devices[vidPidKey]

    if (!layoutFile) {
      return { ok: 0, error: `No layout mapping for ${vidPidKey}` }
    }
    const dir = resolveLayoutsDir(app, path)
    const layoutPath = path.join(dir, layoutFile)
    if (!fs.existsSync(layoutPath)) {
      return { ok: 0, error: `Layout file not found: ${layoutPath}` }
    }

    const layoutJson = JSON.parse(fs.readFileSync(layoutPath, 'utf8'))
    let imageName = null
    if (layoutJson && layoutJson.overlays && typeof layoutJson.overlays === 'object') {
      const keys = Object.keys(layoutJson.overlays)
      if (keys.length) {
        const firstKey = keys[0]
        const ov = layoutJson.overlays[firstKey]
        if (ov && ov.image) imageName = ov.image
      }
    }
    
    if (!imageName && layoutJson && layoutJson.overlay && layoutJson.overlay.image) {
      imageName = layoutJson.overlay.image
    }

    if (!imageName) {
      return { ok: 0, error: `Layout ${layoutFile} missing overlays[view].image (or overlay.image)` }
    }

    const imagePath = path.join(dir, imageName)
    if (!fs.existsSync(imagePath)) {
      return { ok: 0, error: `Overlay image not found: ${imagePath}` }
    }
    const imageUrl = pathToFileURL(imagePath).toString()
    return { ok: 1, layoutFile, layoutJson, imageUrl }
  } catch (err) {
    return { ok: 0, error: err?.message || String(err) }
  }
})
ipcMain.on('setupPage', async (receivedData) => {
  setTimeout(() => {
    if (showConsoleMessages) { logs_debug("[RENDERER]".bgGreen, "Page Change:".yellow, windowItemsStore.get('currentPage')) }
    //get HID data dump
    try {
      const dumpText = runWinHidDump()
      deviceInfo.set('hidDescriptorDump', dumpText)
      deviceInfo.set('hidDescriptorDumpStatus', {
        ok: 1,
        exePath: getWinHidDumpPath(),
        length: dumpText.length,
        time: Date.now()
      })
      logs('[HID]'.bgCyan, 'win-hid-dump OK'.green, `len=${dumpText.length}`.magenta)
    }
    catch (e) {
      deviceInfo.set('hidDescriptorDump', '')
      deviceInfo.set('hidDescriptorDumpStatus', {
        ok: 0,
        exePath: getWinHidDumpPath(),
        err: String(e && e.message ? e.message : e),
        time: Date.now()
      })
      logs_error('[HID] win-hid-dump FAILED'.red, getWinHidDumpPath(), e && e.stack ? e.stack : e)
    }
    init = 1
    page = 'setup'
    main()
  }, 1000)
})
ipcMain.on('changePage', async (receivedData) => {
  setTimeout(() => {
    if (showConsoleMessages) { logs_debug("[RENDERER]".bgGreen, "Page Change:".yellow, windowItemsStore.get('currentPage')) }
    init = 1
    page = 'joyview'
    try {
      const filesToDelete = [
        'viewerLogs.json',
      ]
      deleteAppJsonFiles(filesToDelete)
      function deleteAppJsonFiles(filesToDelete) {
        const userDataPath = app.getPath('userData')

        for (const file of filesToDelete) {
          const fullPath = path.join(userDataPath, file)
          try {
            if (fs.existsSync(fullPath)) {
              fs.rmSync(fullPath, { recursive: true, force: true })
              logs_debug("[APP]".bgMagenta, `Deleted Local JSON files: ${fullPath}`.green)
            }
          }
          catch (err) {
            logs_error("[APP]".bgMagenta, `Failed to delete Local JSON files: ${fullPath}`, err)
          }
        }
      }
    }
    catch (error) {
      logs_error(error.stack)
    }
    initializeUI(getDevicesStore(), "from_brain-detection-initialize")
  }, 300)
})
ipcMain.on('initializer-response', (event, message) => {
  logs("[RENDERER-Init]".bgGreen, message)
})
ipcMain.on('renderer-response-error', (event, message, location) => {
  logs_error("[RENDERER-ERROR]".red, message, location)
})
ipcMain.on('renderer-response-unhandled-error', (event, message, location) => {
  logs_error("[RENDERER-UNHANDLED-ERROR]".bgRed, message, location)
})
ipcMain.on('renderer-response-report-translationIssues', (event, message) => {
  logs_translate("[RENDERER-translationIssues]".bgRed, message)
})
ipcMain.on('renderer-response-showSetupLog', (event, message) => {
  logs("[RENDERER-showSetupLog]".bgRed, message)
})