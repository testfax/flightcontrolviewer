try {
  //!Master Switch is responsible for reporting the logs to the server.
  const masterSwitch = 1 // 0 = Off, 1 = On.

  const os = require('os')
  const colors = require('colors')
  const fs = require('fs')
  const path = require('path')
  const log = require('electron-log')

  // ANSI Color Codes
  // https://talyian.github.io/ansicolors/
  const colorz = {
    reset: '\x1B[0m',
    key: '\x1B[32m', // Green for keys
    stringValue: '\x1B[38;5;208m', // Orange for string values
    numberValue: '\x1B[33m' // Yellow for number values
  }

  const INDENT = 2
  const pad = n => ' '.repeat(n)

  function coloredPrimitive(v) {
    if (typeof v === 'string') return `${colorz.stringValue}'${v}'${colorz.reset}`
    if (typeof v === 'number') return `${colorz.numberValue}${v}${colorz.reset}`
    if (typeof v === 'boolean') return `${colorz.numberValue}${v}${colorz.reset}`
    if (v === null) return 'null'
    if (v === undefined) return 'undefined'
    return String(v)
  }

  function isArrayLikeObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false

    // ✅ Don't treat Map/Set as array-like objects
    if (obj instanceof Map) return false
    if (obj instanceof Set) return false

    const keys = Object.keys(obj)
    const numeric = keys
      .filter(k => /^\d+$/.test(k))
      .map(k => Number(k))
      .sort((a, b) => a - b)

    if (!numeric.length) return false

    // must be 0..n-1 contiguous
    for (let i = 0; i < numeric.length; i++) {
      if (numeric[i] !== i) return false
    }

    return true
  }

  function formatValue(value, indent = 0) {
    // arrays
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]'

      const items = value
        .map(v => `${pad(indent + INDENT)}${formatValue(v, indent + INDENT)}`)
        .join(',\n')

      return `[\n${items}\n${pad(indent)}]`
    }

    // ✅ Sets
    if (value instanceof Set) {
      const arr = Array.from(value.values())
      if (arr.length === 0) return 'Set([])'

      const items = arr
        .map(v => `${pad(indent + INDENT)}${formatValue(v, indent + INDENT)}`)
        .join(',\n')

      return `Set([\n${items}\n${pad(indent)}])`
    }

    // ✅ Maps
    if (value instanceof Map) {
      const entries = Array.from(value.entries())
      if (entries.length === 0) return 'Map({})'

      const allStringKeys = entries.every(([k]) => typeof k === 'string')

      // Render Map with string keys like an object (but keep a Map label)
      if (allStringKeys) {
        const lines = entries
          .map(([k, v]) => {
            const coloredKey = `${colorz.key}${k}${colorz.reset}`
            if (v && typeof v === 'object') {
              return `${pad(indent + INDENT)}${coloredKey}: ${formatValue(v, indent + INDENT)}`
            }
            return `${pad(indent + INDENT)}${coloredKey}: ${coloredPrimitive(v)}`
          })
          .join(',\n')

        return `Map({\n${lines}\n${pad(indent)}})`
      }

      // Otherwise render as list of [key,value] pairs
      const items = entries
        .map(([k, v]) => {
          return `${pad(indent + INDENT)}[${formatValue(k, 0)}, ${formatValue(v, 0)}]`
        })
        .join(',\n')

      return `Map([\n${items}\n${pad(indent)}])`
    }

    // objects (including array-like objects)
    if (value && typeof value === 'object') {
      // treat { "0": ..., "1": ..., receiver: ... } as:
      // [
      //   ...,
      //   receiver: '...'
      // ]
      if (isArrayLikeObject(value)) {
        const numericKeys = Object.keys(value)
          .filter(k => /^\d+$/.test(k))
          .sort((a, b) => Number(a) - Number(b))

        const extraKeys = Object.keys(value).filter(k => !/^\d+$/.test(k))

        const parts = []

        for (const k of numericKeys) {
          parts.push(`${pad(indent + INDENT)}${formatValue(value[k], indent + INDENT)}`)
        }

        for (const k of extraKeys) {
          const coloredKey = `${colorz.key}${k}${colorz.reset}`
          const v = value[k]
          const rendered = (v && typeof v === 'object')
            ? formatValue(v, indent + INDENT)
            : coloredPrimitive(v)

          parts.push(`${pad(indent + INDENT)}${coloredKey}: ${rendered}`)
        }

        return `[\n${parts.join(',\n')}\n${pad(indent)}]`
      }

      const keys = Object.keys(value)
      if (keys.length === 0) return '{}'

      const lines = keys
        .map(k => {
          const coloredKey = `${colorz.key}${k}${colorz.reset}`
          const v = value[k]

          if (v && typeof v === 'object') {
            return `${pad(indent + INDENT)}${coloredKey}: ${formatValue(v, indent + INDENT)}`
          }

          return `${pad(indent + INDENT)}${coloredKey}: ${coloredPrimitive(v)}`
        })
        .join(',\n')

      return `{\n${lines}\n${pad(indent)}}`
    }

    // primitives
    return coloredPrimitive(value)
  }

  function colorizeAny(value) {
    return formatValue(value, 0)
  }

  function colorizeObject(obj) {
    return Object.entries(obj)
      .map(([key, value]) => {
        const coloredKey = `${colorz.key}"${key}"${colorz.reset}`
        let coloredValue

        if (typeof value === 'string') {
          coloredValue = `${colorz.stringValue}"${value}"${colorz.reset}`
        } else if (typeof value === 'number') {
          coloredValue = `${colorz.numberValue}${value}${colorz.reset}`
        } else if (typeof value === 'boolean') {
          coloredValue = `${colorz.numberValue}${value}${colorz.reset}`
        } else if (typeof value === 'object' && value !== null) {
          coloredValue = `{\n${colorizeObject(value)}\n}`
        } else {
          coloredValue = value
        }

        return `${coloredKey}: ${coloredValue}`
      })
      .join(',\n')
  }

  function colorizeJSON(jsonString) {
    const obj = JSON.parse(jsonString)
    const colored = colorizeObject(obj)
    return `{\n${colored}\n}`
  }

  function lastLogs(dir, ext, amount) {
    try {
      const files = fs.readdirSync(dir)
      const filteredFiles = files.filter(file => path.extname(file) === `.${ext}`)

      const sortedFiles = filteredFiles.sort((a, b) => {
        return (
          fs.statSync(path.join(dir, b)).mtime.getTime() -
          fs.statSync(path.join(dir, a)).mtime.getTime()
        )
      })

      const mostRecentFiles = sortedFiles.slice(...amount).map(file => path.join(dir, file))
      return mostRecentFiles
    } catch (error) {
      console.log('[LOGS]'.red, error)
    }
  }

  function getCitizen() {
    try {
      const extractHandle = (line) => {
        const regex = /Handle\[(.*?)\]/
        const match = line.match(regex)
        return match ? match[1] : null
      }

      const lastLog = lastLogs(client_path('LogBackups').rsi_requested, 'log', '0') // Select which one you want from the sorted index.
      let contents = fs.readFileSync(lastLog[0], 'utf8').split('\n')
      const handles = contents.map(extractHandle).filter(Boolean)

      let foundHandle = []
      if (handles.length > 0) {
        handles.forEach(handle => {
          foundHandle.push(handle)
        })
      }

      return foundHandle[0]
    } catch (e) {
      console.log('[LOGS]'.red, 'getCitizen: No Game Logs Yet...', e)
    }
  }

  function client_path(request) {
    function findStarCitizenLive() {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
      const gameLogPath = path.join(appData, 'Star Citizen', 'game.log')

      // 1️⃣ Read game.log and extract Executable path
      if (fs.existsSync(gameLogPath)) {
        try {
          const logText = fs.readFileSync(gameLogPath, 'utf8')

          // Example:
          // Executable: C:\Program Files\Roberts Space Industries\StarCitizen\LIVE\Bin64\StarCitizen.exe
          const match = logText.match(/^Executable:\s+(.+)$/m)

          if (match) {
            const exePath = match[1].trim()

            // Bin64 -> LIVE
            const livePath = path.resolve(path.dirname(exePath), '..')

            if (fs.existsSync(livePath)) {
              return livePath
            }
          }
        } catch (err) {
          console.error('Failed to read Star Citizen game.log', err)
        }
      }

      // 2️⃣ Final fallback: default install
      const defaultPath = path.join(
        'C:',
        'Program Files',
        'Roberts Space Industries',
        'StarCitizen',
        'LIVE'
      )

      if (fs.existsSync(defaultPath)) {
        return defaultPath
      }

      return null
    }

    let rsi_stockLocation = findStarCitizenLive()
    let rsi_path = path.normalize(rsi_stockLocation)
    const files = fs.readdirSync(rsi_path)

    let rsi_savedMappings = null
    let rsi_activeMapping = null
    let rsi_requested = null

    if (files) {
      rsi_savedMappings = path.join(rsi_path, 'user', 'client', '0', 'Controls', 'Mappings')
      rsi_activeMapping = path.join(rsi_path, 'user', 'client', '0', 'Profiles', 'default', 'activemaps.xml')

      if (request) {
        rsi_requested = path.join(rsi_path, request)
        rsi_requested = path.normalize(rsi_requested)
      }
    }

    return {
      rsi_path,
      rsi_savedMappings,
      rsi_activeMapping,
      rsi_requested
    }
  }

  const theCitizen = getCitizen()
  console.log('theCitizen:'.yellow, theCitizen)

  if (masterSwitch) {
    log.initialize({ preload: true })
    // log.transports.file.file = 'session.log' // Set a fixed filename for the log
    log.transports.file.level = 'verbose'
    log.transports.file.format = '{h}:{i}:{s}:{ms} [{level}] {text}' // Customize log formatpm2
    log.transports.file.maxSize = 10 * 1024 * 1024 // Set maximum log file size
    log.transports.file.maxFiles = 3 // Limit the number of log files

    log.transports.remote = (logData) => {
      const formattedLogData = {
        citizen: theCitizen,
        gameLog: path.basename(lastLogs(client_path('LogBackups').rsi_requested, 'log', '0')[0]),
        timestamp: new Date(),
        level: logData.level,
        message: logData.data
      }

      if (theCitizen) {
        try {
          const requestPromise = fetch('http://elitepilotslounge.com:3003/', {
            method: 'POST',
            body: JSON.stringify(formattedLogData),
            headers: { 'Content-Type': 'application/json' }
          })

          const timeoutPromise = new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('Request timeout'))
            }, 1000) // Set a 1000ms timeout
          })

          Promise.race([requestPromise, timeoutPromise])
            .then(response => {
              if (!response.status) {
                logsUtil.logs_error('HTTP error: ' + response.status)
              }
            })
            .catch(error => {
              // logsUtil.logs_error('logConfig->Fetch', error)
            })
        } catch (e) {
          console.log(e)
        }
      } else {
        logsUtil.logs_error('[LOGS]'.red, 'Remote Temp Disabled: NO CITIZEN'.yellow)
        return
      }
    }
  }

  const logsUtil = {
    logs_translate: (...input) => {
      const logMessage = input.map(item => {
        if (item && typeof item === 'object') return colorizeAny(item)
        return item
      }).join(' ')
      log.warn(logMessage)
    },

    logs_warn: (...input) => {
      const logMessage = input.map(item => {
        if (item && typeof item === 'object') return colorizeAny(item)
        return item
      }).join(' ')
      log.warn(logMessage)
    },

    logs: (...input) => {
      const logMessage = input.map(item => {
        if (item && typeof item === 'object') return colorizeAny(item)
        return item
      }).join(' ')
      log.info(logMessage)
    },

    logs_error: async (...input) => {
      const err = await input[0]

      if (typeof err === 'object') {
        // usually IPC main errors and has error object
        const serializeError = err => ({
          name: err.name,
          message: err.message,
          stack: err.stack,
          cause: err.cause ? serializeError(err.cause) : undefined
        })

        const logMessage = colorizeJSON(JSON.stringify(serializeError(err), null, 2))
        log.error(logMessage)
      } else {
        // usually renderer errors and has error string
        const logMessage = input.map(item => {
          if (item && typeof item === 'object') return colorizeAny(item)
          return item
        }).join(' ')
        log.error(logMessage)
      }
    },

    logs_debug: async (...input) => {
      const logMessage = input.map(item => {
        if (item && typeof item === 'object') return colorizeAny(item)
        return item
      }).join(' ')
      log.debug(logMessage)
    }
  }

  module.exports = logsUtil
} catch (e) {
  console.log('Logs Not Ready', e)
}
