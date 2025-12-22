const HID = require('node-hid')
const Store = require('electron-store').default

const deviceInfo = new Store({ name: 'deviceInfo' })

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

function extractDescriptorBufferFromDump(dumpText, vendorId, productId) {
  const vidHex = toHex4(vendorId)
  const pidHex = toHex4(productId)
  const lines = String(dumpText || '').split(/\r?\n/)

  let headerIndex = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (isDeviceHeaderForVidPid(lines[i], vidHex, pidHex)) {
      headerIndex = i
      break
    }
  }
  if (headerIndex === -1) return { ok: 0, reason: 'VID/PID header not found in dump', buf: null }

  let descStart = -1
  for (let i = headerIndex; i < Math.min(lines.length, headerIndex + 500); i += 1) {
    if (isLikelyDescriptorStartLine(lines[i])) {
      descStart = i + 1
      break
    }
  }

  if (descStart !== -1) {
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
    if (bytes.length) return { ok: 1, reason: 'marker-based extraction', buf: hexPartsToBuffer(bytes) }
  }

  let bestBlock = []
  let current = []
  for (let i = headerIndex; i < Math.min(lines.length, headerIndex + 1000); i += 1) {
    const b = parseAllHexBytesFromLine(lines[i])
    if (b.length) {
      current.push(...b)
      if (current.length > 8192) break
    } else {
      if (current.length > bestBlock.length) bestBlock = current
      current = []
    }
  }
  if (current.length > bestBlock.length) bestBlock = current

  if (bestBlock.length >= 20) return { ok: 1, reason: 'fallback contiguous hex block', buf: hexPartsToBuffer(bestBlock) }

  return { ok: 0, reason: 'no descriptor-like hex bytes found after VID/PID header', buf: null }
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
      case 0x33: return 'rx'
      case 0x34: return 'ry'
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

function startInputLoggerForDevice(d, parsed) {
  const prefix = jsPrefixForDevice(d)

  let device = null
  try {
    device = new HID.HID(d.path)
  } catch (e) {
    console.error(prefix + 'open_failed', d.path)
    return
  }

  const warmed = new Set()
  const lastButtons = new Map()

  // axis state
  const axisActive = new Map()
  const axisLastVal = new Map()
  const axisLastEmit = new Map()

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

      // one-time summary per report id
      if (axes.length) {
        const names = axes.map(x => x.name).join(',')
        console.log(prefix + `axes_rid${rid}=` + names)
      }

      warmed.add(rid)
      return
    }

    // Buttons: press-only
    for (const b of buttons) {
      const key = `${rid}:${b.usage}`
      const prev = lastButtons.get(key) || false
      const down = readButtonBit(payload, b.bitOffset)
      if (down && !prev) console.log(`${prefix}button${b.usage}`)
      lastButtons.set(key, down)
    }

    // Axes: log when it meaningfully moves OR crosses center threshold (no spam)
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

      // "active" = outside 10% from center
      const wasActive = axisActive.get(key) || false
      const isActive = centerDelta >= cfg.threshold

      // movement-based trigger (2% of range change since last sample)
      let movedEnough = false
      if (typeof prevVal === 'number') {
        const moveThreshold = Math.max(1, Math.round(cfg.range * MOVE_PERCENT))
        if (Math.abs(val - prevVal) >= moveThreshold) movedEnough = true
      }

      if (!wasActive && isActive) {
        console.log(`${prefix}axis_${a.name}`)
        axisLastEmit.set(key, now)
      } else if (movedEnough && (now - lastEmit) >= AXIS_COOLDOWN_MS) {
        console.log(`${prefix}axis_${a.name}`)
        axisLastEmit.set(key, now)
      } else if (wasActive && !isActive) {
        console.log(`${prefix}axis_${a.name}_rest`)
        axisLastEmit.set(key, now)
      }

      axisActive.set(key, isActive)
    }
  })

  device.on('error', (err) => {
    console.error(prefix + 'hid_error', err && err.stack ? err.stack : err)
  })
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
  const extracted = extractDescriptorBufferFromDump(dumpText, d.vendorId, d.productId)
  if (!extracted.ok || !extracted.buf) return null

  const parsed = parseInputsFromReportDescriptor(extracted.buf)

  let totalButtons = 0
  for (const arr of parsed.buttonsByReport.values()) totalButtons += arr.length

  let totalAxes = 0
  for (const arr of parsed.axesByReport.values()) totalAxes += arr.length

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
    savedAt: Date.now()
  }

  setDevicesStore(devices)
  return parsed
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const devices = listAllJoysticks()
  if (!devices.length) {
    console.log('[input-detection] No joystick-class devices found (usagePage=1 usage=4)')
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
      if (entry.path !== d.path) {
        entry.path = d.path
        entry.savedAt = Date.now()
        stored[key] = entry
        setDevicesStore(stored)
      }
      const parsed = plainToInputsMaps(entry.parsedInputs)
      startInputLoggerForDevice(d, parsed)
      continue
    }

    if (!dumpAvailable) {
      const prefix = jsPrefixForDevice(d)
      console.log(prefix + 'unlearned_no_dump')
      continue
    }

    const prefix = jsPrefixForDevice(d)
    let learned = null
    let tries = 0

    while (!learned && tries < 5) {
      tries += 1
      console.log(prefix + `learn_attempt_${tries}`.yellow)
      learned = learnAndPersistDevice(d, dumpText)

      if (!learned && tries < 5) {
        await sleep(1000)
      }
    }

    if (!learned) {
      console.log(prefix + `unlearned_descriptor_failed_after_${tries}_tries`.red)
      continue
    }

    console.log(prefix + `learned_after_${tries}_tries`.green)
    startInputLoggerForDevice(d, learned)
  }
}

main()



// const { logs, logs_error, logs_debug } = require('../utils/logConfig')
// try {
//   const staticData = require('../staticData.json')
//   const throttle = require('lodash.throttle');
//   const { blastToUI } = require('../brain/input-functions')
//   const { app, ipcMain, BrowserWindow, webContents  } = require('electron');
//   const Store = require('electron-store').default
//   const windowItemsStore = new Store({ name: 'electronWindowIds'})
//   const actionmaps = new Store({ name: 'actionmapsJSON'})
//   const deviceStateData = new Store({ name: "deviceInfo" });
//   const thisWindow = windowItemsStore.get('electronWindowIds')
//   // const showConsoleMessages = 1
//   const showConsoleMessages = windowItemsStore.get('showConsoleMessages')
//   const HID = require('node-hid')
//   //!Functions!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   function initializeUI(data,deviceInfo,receiver) {
//     if (windowItemsStore.get('currentPage') == 'dashboard' || windowItemsStore.get('currentPage') == 'getbuffer') {
//       const package = {
//         data: data,
//         deviceInfo: deviceInfo
//       }
//       deviceSetup[deviceInfo]
//       const client = BrowserWindow.fromId(thisWindow.win)
//       if (client) { client.webContents.send(receiver, package) }
//       else { logs_error("no client") }
//     }
//   }
//   function processAxisBuffer(buffer,buttonArray,medianDistance,bufferVals,jsId) {
//     let detection = false;
//     let ind = null;
//     let val = null;
//     let build = null
//     const joystickAxisNames = {
//       1: 'x',
//       3: 'y',
//       5: 'roty',
//       7: 'rotx',
//       9: 'slider',
//       11: 'z'
//     };
//     const joystickAxes = [1, 3, 5, 7, 11];
//     //For Virpil
//     try {
//       const sliderIndex = 9;
//       const sliderValue = buffer[sliderIndex];
//       if (sliderValue !== undefined && sliderValue > 30000) {
//         detection = "slider";
//         ind = Object.entries(buttonArray).findIndex(([key, value]) => key === detection)
//         bufferVals.slider_val = sliderValue
//         bufferVals.slider = detection == 'slider' ? (bufferVals.slider_val >= 30000) : false
//         bufferVals['slider_detection'] = "slider"
//         bufferVals['slider_ind'] = ind
//         build = { "detection":detection, "ind":bufferVals[detection + '_ind'] }
//         if (showConsoleMessages) { console.log(sliderIndex,bufferVals[detection],"HIT".red,jsId,'BID'.blue,detection) }
//         return build
//       }
//     }
//     catch (e) {
//       console.log(e)
//     }
//     //
//     joystickAxes.forEach(index => {
//       const bufferValue = buffer[index]
//       if (bufferValue !== undefined && bufferValue !== medianDistance) {
//         const axisName = joystickAxisNames[index]
//         detection = axisName;
//         ind = Object.entries(buttonArray).findIndex(([key, value]) => key === axisName)
//         val = buffer[index]
//         //For Virpil, sets a distance value away from center that the stick must move before it is triggered in the app.
//         // Helps for when you're pushing buttons and not have an Axis show up
//         const buffValHi = 40000
//         const buffValLo = 20000
//         if (axisName == 'x') { bufferVals.x_val = val; checker(bufferVals.x_val) }
//         if (axisName == 'y') { bufferVals.y_val = val; checker(bufferVals.y_val) }
//         if (axisName == 'z') { bufferVals.z_val = val; checker(bufferVals.z_val) }
//         if (axisName == 'roty') { bufferVals.roty_val = val; checker(bufferVals.roty_val) }
//         if (axisName == 'rotx') { bufferVals.rotx_val = val; checker(bufferVals.rotx_val) }
//         function checker(input) {
//           let state = false;
//           if (input >= buffValHi) { state = true }
//           if (input <= buffValLo) { state = true }
//           bufferVals[axisName] = state
//           bufferVals[axisName + '_detection'] = axisName
//           bufferVals[axisName + '_ind'] = ind
//           if (state) {
//             build = { "detection": axisName, "ind":bufferVals[axisName + '_ind'] }
//             if (showConsoleMessages) { console.log(index,bufferVals[axisName],"HIT".red,jsId,'BID'.blue,axisName,build) }
//             return { build }
//           }
//         }
//         //
//         //vor Virpil
//       }
//     })
//     return build
//   }
//   function virpil_processButtonBuffer(buffer,buttonArray) { //FOR VIRPIL
//     let detection = false;
  
//     for (const [buttonName, indexes] of Object.entries(buttonArray)) {
//       if (parseInt(Object.keys(indexes)[0]) >= 20) { 
//         for (const [index, values] of Object.entries(indexes)) {
//           const bufferValue = buffer[parseInt(index)];
//           if (bufferValue !== undefined && values.includes(bufferValue)) {
//             // logs(`Detected ${buttonName} at buffer index ${index} with value ${bufferValue}`);
//             detection = buttonName;
//             ind = Object.entries(buttonArray)
//             .findIndex(([key, value]) => key === buttonName);
//           }
//         }
//       }
//     }
    
//     if (detection) {
//       return { detection, ind }
//     }
//   }
//   function analyzeBuffer(data) {
//     let byteArray = []
//     const lastBuffer = data.length -1
//     for (let i = 0; i < data.length; i++) {
//         //For Virpil
//         if (i != lastBuffer) { 
//           byteArray.push(data.readUInt16LE(i))
//         }
//         //
//     }
//     return byteArray
//   }
//   function findKeybind(key,discoveredKeybinds) {
//     // if (showConsoleMessages) { console.log("[findKeyBind]".yellow,discoveredKeybinds) }
//     if (showConsoleMessages) { console.log("[findKeyBind]".yellow,key) }
//     if (key in discoveredKeybinds) { 
//       if (showConsoleMessages) { console.log("[findKeyBind]".green, discoveredKeybinds[key]) }
//       return discoveredKeybinds[key] 
//     } 
//     else { 
//       if (showConsoleMessages) { console.log("[findKeyBind]".red, key) }
//       return 0 
//     }
//   }
//   //!Startup Variables!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//   let devices = HID.devices()

// // console.log('All HID devices:')
// // devices.forEach(d => {
// //   if (d.vendorId && d.productId) {
// //     console.log(`Vendor: ${d.vendorId}, Product: ${d.productId}, ProductName: ${d.product}`)
// //   }
// // })
// const HIDDesc = require('hid-desc')
// const VENDOR_ID = 13124
// const PRODUCT_ID = 17396


//   /**
//    * @JSON
//    * Get the devices from the user setup.
//    */
//   let devicesRequested = {}
//   if (!deviceStateData.get("devicesRequested")) { deviceStateData.set('devicesRequested','') }
//   else { devicesRequested = deviceStateData.get('devicesRequested') }

//   /**
//    * @object
//    * @key @value pair
//    * object containing the requested devices.
//    */
//   const foundDevices = {};
//   for (const [key, { vendorId, productId }] of Object.entries(devicesRequested)) {
//     foundDevices[key] = devices.find(device => device.vendorId === vendorId && device.productId === productId);
//   }

//   /**
//    * @object
//    * Dynamically add the deviceSetup items so we can plug them in when UI initialization is done.
//    * Contains state information for the UI. 
//    * Once the UI is setup, it changes flags so that new joystick information can be sent to the UI.
//    * Controls joystick buffer information flow to the UI.
//    */
//   //

//   ipcMain.on('changePage', async (receivedData) => {
//     deviceInit.forEach(device => device.removeAllListeners())
//     setTimeout(() => {
//         if (showConsoleMessages) { logs_debug("[RENDERER]".bgGreen,"Page Change:".yellow,windowItemsStore.get('currentPage')) }
//         ZeroDeviceSetup(deviceSetup,foundDevices,devicesRequested,deviceInit,bufferVals)
//     },300)
//   })
//   let deviceInit = []
//   const deviceSetup = {}
//   let bufferVals = {
//     x_val: 0,
//     y_val: 0,
//     z_val: 0,
//     rotx_val: 0,
//     roty_val: 0,
//     slider_val: 0,
//     x: false,
//     y: false,
//     z: false,
//     rotx: false,
//     roty: false,
//     slider: false,
//     x_detection: null,
//     y_detection: null,
//     z_detection: null,
//     slider_detection: null,
//     rotx_detection: null,
//     roty_detection: null,
//     x_ind: null,
//     y_ind: null,
//     z_ind: null,
//     roty_ind: null,
//     rotx_ind: null,
//   }
//   ZeroDeviceSetup(deviceSetup,foundDevices,devicesRequested,deviceInit,bufferVals)
//   function ZeroDeviceSetup(deviceSetup,foundDevices,devicesRequested,deviceInit,bufferVals) {
//     return
//     console.log("Found Devcies".yellow,foundDevices)
//     for (const key of Object.keys(foundDevices)) { deviceSetup[key] = 0 }
//     const keys = Object.keys(foundDevices)
//     keys.forEach(jsId => {
//       if (foundDevices[jsId] != undefined) {
//         try {
//           // logs(jsId)
//           // logs(foundDevices[jsId])
          
//           const buttonArray = staticData.deviceBufferDecode.vendorIds[foundDevices[jsId].vendorId]?.products[foundDevices[jsId].productId]
//           const device = new HID.HID(foundDevices[jsId].path)
//           deviceInit.push(device)
//           let gripHandle_current = null
//           let gripHandle_previous = null
//           let gripHandle_grip = null
//           let gripHandle_flip = null
//           let gripAxis_current = null
//           let gripAxis_previous = 'derp'
//           let virpil_pedal_movementDetected = false
//           let virpil_pedal_distance = null
//           const requestedDevices = devicesRequested[jsId]
//           const handleData = throttle((data) => {
//             const byteArray = analyzeBuffer(data)
//             //!Get Buffer
//             if (windowItemsStore.get('currentPage') == 'getbuffer') {
//               if (deviceSetup[jsId] == 0) { initializeUI(byteArray,requestedDevices,"from_brain-detection-initialize-getbuffer"); deviceSetup[jsId] = 1 }
//               if (deviceSetup[jsId] == 2) {
//                 const package = {
//                   data: byteArray,
//                   deviceInfo: requestedDevices,
//                   receiver: "from_brain-detection-getbuffer",
//                   keybindArray: 0
//                 }
//                 blastToUI(package)
//               }
//             }

//             //! Dashboard
//             if (windowItemsStore.get('currentPage') == 'dashboard' || windowItemsStore.get('currentPage') == 'joyview') {
//               if (deviceSetup[jsId] == 0) { initializeUI(buttonArray.bufferDecoded,requestedDevices,"from_brain-detection-initialize"); deviceSetup[jsId] = 1 }
//               //TODO Detect axis travel some how to get median distance
//               let medianDistance = 30000
//               if (foundDevices[jsId].vendorId == 13124) { //virpil shows median on all x,y,z,z(pedals) devices as 30000
//                 medianDistance = 30000
//                 bufferVals.x_val = medianDistance
//                 bufferVals.y_val = medianDistance
//                 bufferVals.z_val = medianDistance
//                 bufferVals.rotx_val = medianDistance
//                 bufferVals.roty_val = medianDistance
//               }
//               const specificDevices = {
//                 virpil_vpc_ace_torq_rudder: foundDevices[jsId].vendorId == 13124 && foundDevices[jsId].productId == 505
//               }
//               // const specificDevices.virpil_vpc_ace_torq_rudder = foundDevices[jsId].vendorId == 13124 && foundDevices[jsId].productId == 505
//               let result_processAxisBuffer = null;
//               if (!specificDevices.virpil_vpc_ace_torq_rudder) {
//                 result_processAxisBuffer = processAxisBuffer(byteArray,buttonArray.bufferDecoded,medianDistance,bufferVals,jsId)
//               }

//               //!virpil VPC ACE-Torq Rudder (START)
//               if (specificDevices.virpil_vpc_ace_torq_rudder) {
//                 virpil_pedal_distance = byteArray[1] //buffer value between 0-30000 (left pedal) and 30000-60000 (right pedal)
//                 const virpil_processAxisBuffer = { detection: 'z', ind: 0, val: virpil_pedal_distance }
//                 if (!virpil_pedal_movementDetected
//                   && virpil_pedal_distance !== medianDistance
//                 ) {
//                   virpil_pedal_movementDetected = true
//                   if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Axis:`, virpil_processAxisBuffer.detection, virpil_processAxisBuffer) }
//                   if (deviceSetup[jsId] == 2) {
//                     const package = {
//                       keybindArray: null,
//                       data: virpil_processAxisBuffer,
//                       deviceInfo: requestedDevices,
//                       receiver: "from_brain-detection",
//                       keybindArticulation: staticData.keybindArticulation
//                     }
//                     package.keybindArray = findKeybind(`${requestedDevices.position}_${virpil_processAxisBuffer.detection}`,actionmaps.get('discoveredKeybinds'))
//                     blastToUI(package)
//                   }
//                 }
//                 else if (virpil_pedal_movementDetected && virpil_pedal_distance === medianDistance) {
//                   virpil_pedal_movementDetected = false
//                 }
//               }
//               //!virpil VPC ACE-Torq Rudder (END)
//               //! AXIS
//               if (result_processAxisBuffer && !specificDevices.virpil_vpc_ace_torq_rudder) {
//                 const package = {
//                   keybindArray: null,
//                   data: result_processAxisBuffer,
//                   deviceInfo: requestedDevices,
//                   receiver: "from_brain-detection",
//                   keybindArticulation: staticData.keybindArticulation
//                 }
//                 try {
//                   gripAxis_current = package.data.detection
//                   if (!specificDevices.virpil_vpc_ace_torq_rudder
//                     && (bufferVals.x || bufferVals.y || bufferVals.z || bufferVals.slider || bufferVals.rotx || bufferVals.roty)
//                     && (gripAxis_current != gripAxis_previous)
//                   ) {
//                     // package.data = buffer_current
//                     if (foundDevices[jsId].vendorId == 13124) {
//                       if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Axis:`, result_processAxisBuffer) }
//                       if (deviceSetup[jsId] == 2) {
//                         package.keybindArray = findKeybind(`${requestedDevices.position}_${package.data.detection}`,actionmaps.get('discoveredKeybinds'))
//                         blastToUI(package)
//                       }
//                     }
//                     else {
//                       if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Axis:`, result_processAxisBuffer) }
//                       if (deviceSetup[jsId] == 2) {
//                         package.keybindArray = findKeybind(`${requestedDevices.position}_${package.data.detection}`,actionmaps.get('discoveredKeybinds'))
//                         blastToUI(package)
//                       }
//                     }
//                     gripAxis_previous = gripAxis_current
//                   }
//                 }
//                 catch (e) {
//                   console.log(e)
//                 }
//               }
//               //! BUTTON
//               const result_processButtonBuffer = virpil_processButtonBuffer(byteArray,buttonArray.bufferDecoded)
//               if (result_processButtonBuffer) {
//                 gripHandle_current = result_processButtonBuffer.detection
//                 if (
//                     gripHandle_current !== gripHandle_previous 
//                   && gripHandle_current !== gripHandle_grip
//                   || gripHandle_flip == 3 
//                 ) {
//                   const package = {
//                     keybindArray: null,
//                     data: result_processButtonBuffer,
//                     deviceInfo: requestedDevices,
//                     receiver: "from_brain-detection",
//                     keybindArticulation: staticData.keybindArticulation
//                   }
//                   if (foundDevices[jsId].vendorId == 13124) { //virpil buttons 1 through 5 have a lever(button3) that can actuate 2 different states. However, star citizen does not recognize the lever(button3) as a button+button combo.
//                     switch (gripHandle_current) {
//                       case 'button1':
//                         if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`, result_processButtonBuffer); }
//                           gripHandle_grip = gripHandle_current;
//                           if (deviceSetup[jsId] == 2) {
//                             package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
//                             blastToUI(package); 
//                           }
//                           break;
//                       case 'button2':
//                           if (gripHandle_flip != 3) { 
//                             if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`, result_processButtonBuffer); }
//                             if (deviceSetup[jsId] == 2) {
//                               package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
//                               blastToUI(package) 
//                             }
//                           }
//                           gripHandle_grip = gripHandle_current;
//                           gripHandle_flip = 2;
//                           break;
//                       case 'button3':
//                           if (gripHandle_flip == 2 || gripHandle_flip == 4) { 
//                             if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`,result_processButtonBuffer)  }
//                             if (deviceSetup[jsId] == 2) {
//                               package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
//                               blastToUI(package) 
//                             }
//                           }
//                           gripHandle_flip = 3; 
//                           break;
//                       case 'button4':
//                         if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`,result_processButtonBuffer) }
//                           gripHandle_flip = 4;
//                           if (deviceSetup[jsId] == 2) {
//                             package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
//                             blastToUI(package) 
//                           }
//                           break;
//                       case 'button5':
//                         if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`,result_processButtonBuffer) }
//                           gripHandle_flip = 5;
//                           if (deviceSetup[jsId] == 2) {
//                             package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
//                             blastToUI(package) 
//                           }
//                           break;
//                       default:
//                         if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`, result_processButtonBuffer); }
//                           if (deviceSetup[jsId] == 2) {
//                             package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
//                             blastToUI(package) 
//                           }
//                           break;
//                     }
//                   }
//                   else {
//                     if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`, result_processButtonBuffer); }
//                     gripHandle_grip = gripHandle_current
//                     if (deviceSetup[jsId] == 2) {
//                       package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
//                       blastToUI(package); 
//                     }
//                   }
                  
//                   // Update previous state to current after processing
//                   gripHandle_previous = gripHandle_current
//                 }
                
//               }
//             }
//           }, 100) //! Throttled for 100ms. Only processes if the buffer is different than last check
//           device.on('data', handleData)
//           device.on('error', err => { logs_error(`Joystick ${jsId.replace(/^js/,'')} error:`, err.stack) })
//           device.on('stop-listeners', () => { device.removeAllListeners() })
//         }
//         catch (e) { logs_error(e.stack) }
//       }
//     }) 
//   }
//   /**
//    * @function
//    * Sets up all devices and watches for device buffers to enter and parses
//    */

//   //!Communications between frontside and backside (renderer and main(thisfile)).!!!!!!!!!!!!!!!!!!!
//   //Listener
//   //Emitter is in dashboard.js
//   //Waits for the renderer to initialize the UI before accepting data from the device.
//   ipcMain.on('initializer-response', (event,message) => { 
//     logs_debug("[RENDERER-Init]".bgGreen,message)
//     deviceSetup[message] = 2
//   })
// }
// catch (error) { logs_error("[ERROR]".red,error.stack) }