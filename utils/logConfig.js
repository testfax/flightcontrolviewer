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

        const keys = Object.keys(obj)
        const numeric = keys.filter(k => /^\d+$/.test(k)).map(k => Number(k)).sort((a,b) => a - b)
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

            const items = value.map(v => `${pad(indent + INDENT)}${formatValue(v, indent + INDENT)}`).join(',\n')
            return `[\n${items}\n${pad(indent)}]`
        }

        // objects (including array-like objects)
        if (value && typeof value === 'object') {
            // treat { "0": ..., "1": ..., receiver: ... } as:
            // [
            //   ...,
            //   receiver: '...'
            // ]
            if (isArrayLikeObject(value)) {
            const numericKeys = Object.keys(value).filter(k => /^\d+$/.test(k)).sort((a,b) => Number(a) - Number(b))
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

            const lines = keys.map(k => {
            const coloredKey = `${colorz.key}${k}${colorz.reset}`
            const v = value[k]

            if (v && typeof v === 'object') {
                return `${pad(indent + INDENT)}${coloredKey}: ${formatValue(v, indent + INDENT)}`
            }

            return `${pad(indent + INDENT)}${coloredKey}: ${coloredPrimitive(v)}`
            }).join(',\n')

            return `{\n${lines}\n${pad(indent)}}`
        }

        // primitives
        return coloredPrimitive(value)
    }
    function colorizeAny(value) {
        return formatValue(value, 0)
    }
    function colorizeObject(obj) {
        return Object.entries(obj).map(([key, value]) => {
            let coloredKey = `${colorz.key}"${key}"${colorz.reset}`
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
        }).join(',\n')
    }
    function colorizeJSON(jsonString) {
        const obj = JSON.parse(jsonString)
        const colored = colorizeObject(obj)
        return `{\n${colored}\n}`
    }
    function lastLogs(dir,ext,amount) {
        try {
            const files = fs.readdirSync(dir);
            const filteredFiles = files.filter(file => path.extname(file) === `.${ext}`);
            // console.log("Filtered files:", filteredFiles);
            const sortedFiles = filteredFiles.sort((a, b) => {
                return fs.statSync(path.join(dir, b)).mtime.getTime() -
                fs.statSync(path.join(dir, a)).mtime.getTime();
            });
            const mostRecentFiles = sortedFiles.slice(...amount).map(file => path.join(dir, file));
            return mostRecentFiles;
        } catch (error) {
            console.log("[LOGS]".red,error)
        }
    }
    function getCitizen() {
        try {
            const extractHandle = (line) => {
                const regex = /Handle\[(.*?)\]/
                const match = line.match(regex)
                return match ? match[1] : null
            }
            const lastLog = lastLogs(client_path("LogBackups").rsi_requested,"log","0") //Select which one you want from the sorted index.
            let contents = fs.readFileSync(lastLog[0],'utf8').split('\n')
            const handles = contents.map(extractHandle).filter(Boolean)
            let foundHandle = []
            if (handles.length > 0) {
                handles.forEach(handle => {
                    foundHandle.push(handle)
                })
            }
            return foundHandle[0]
        }
        catch(e) { console.log("[LOGS]".red,"getCitizen: No Game Logs Yet...",e) }
    }
    function client_path(request) {
        function findStarCitizenLive() {
            const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
            const rsiSettingsPath = path.join(appData, 'rsilauncher', 'settings.json')

            // 1️⃣ Try RSI launcher settings
            if (fs.existsSync(rsiSettingsPath)) {
                try {
                const settings = JSON.parse(fs.readFileSync(rsiSettingsPath, 'utf8'))
                const folders = settings?.library?.folders || []

                for (const folder of folders) {
                    const livePath = path.join(folder.path, 'StarCitizen', 'LIVE')
                    if (fs.existsSync(livePath)) {
                    return livePath
                    }
                }
                } catch (err) {
                console.error('Failed to parse RSI settings.json', err)
                }
            }

            // 2️⃣ Fallback: default install
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
        // let rsi_stockLocation = path.join('C:','Program Files','Roberts Space Industries','StarCitizen','LIVE')
        let rsi_path = path.normalize(rsi_stockLocation)
        const files = fs.readdirSync(rsi_path);
        let rsi_savedMappings = null
        let rsi_activeMapping = null
        let rsi_requested = null
        if (files) { 
            rsi_savedMappings = path.join(rsi_path,'user','client','0','Controls','Mappings')
            rsi_activeMapping = path.join(rsi_path,'user','client','0','Profiles','default','activemaps.xml')
            if (request) { 
                rsi_requested = path.join(rsi_path,request)
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
    console.log("theCitizen:".yellow,theCitizen)
    if (masterSwitch) {
        log.initialize({ preload: true });
        // log.transports.file.file = 'session.log'; // Set a fixed filename for the log
        log.transports.file.level = 'verbose';
        log.transports.file.format = '{h}:{i}:{s}:{ms} [{level}] {text}'; // Customize log formatpm2 
        log.transports.file.maxSize = 10 * 1024 * 1024; // Set maximum log file size
        log.transports.file.maxFiles = 3; // Limit the number of log files
        log.transports.remote = (logData) => { 
            const formattedLogData = {
                citizen: theCitizen,
                gameLog:  path.basename(lastLogs(client_path("LogBackups").rsi_requested,"log","0")[0]),
                timestamp: new Date(),
                level: logData.level,
                message: logData.data,
            };
            if (theCitizen) {
                try {
                    const requestPromise = fetch('http://elitepilotslounge.com:3003/', {
                        method: 'POST',
                        body: JSON.stringify(formattedLogData),
                        headers: { 'Content-Type': 'application/json' },
                    });
                    const timeoutPromise = new Promise((resolve, reject) => {
                    setTimeout(() => {
                        reject(new Error('Request timeout'));
                    }, 1000); // Set a 500ms timeout
                    });
    
                    Promise.race([requestPromise, timeoutPromise])
                    .then(response => {
                        if (!response.status) {
                            // throw new Error('HTTP error: ' + response.status);
                            logsUtil.logs_error('HTTP error: ' + response.status)
                        }
                        // Process the response here
                    })
                    .catch(error => {
                        // logsUtil.logs_error('logConfig->Fetch', error);
                    });
                }
                catch (e) {
                    console.log(e);
                }
                
            }
            else { 
                logsUtil.logs_error("[LOGS]".red,"Remote Temp Disabled: NO CITIZEN".yellow)
                return
            }
        }
        
    }
    const logsUtil = {
        logs_translate: (...input) => {
            // console.log("LOGS_TRANSLATE".bgCyan,input)
            const logMessage = input.map(item => {
                if (item && typeof item === 'object') return colorizeAny(item)
                return item
            }).join(' ')
            log.warn(logMessage)
        },
        logs_warn: (...input) => {
            // console.log("LOGS_WARN".bgCyan)
            const logMessage = input.map(item => {
                if (item && typeof item === 'object') return colorizeAny(item)
                return item
            }).join(' ')
            log.warn(logMessage)
        },
        logs: (...input) => {
            // console.log("LOGS".bgCyan)
            const logMessage = input.map(item => {
                if (item && typeof item === 'object') return colorizeAny(item)
                return item
            }).join(' ')
            log.info(logMessage)
        },
        logs_error: async (...input) => {
            const err = await input[0]
            // console.log("LOGS_ERROR".bgCyan,input)
            if (typeof err == 'object') {
                //usually IPC main errors and has error object
                const serializeError = err => ({
                    name: err.name,
                    message: err.message,
                    stack: err.stack,
                    cause: err.cause ? serializeError(err.cause) : undefined
                })
                serializeError(err)
                const logMessage = colorizeJSON(JSON.stringify(serializeError(err), null, 2))
                log.error(logMessage)
            }
            else {
                //usually renderer errors and has error string
                const logMessage = input.map(item => {
                    if (item && typeof item === 'object') return colorizeAny(item)
                    return item
                }).join(' ')
                log.info(logMessage)
            }
        },
        logs_debug: async (...input) => {
            // console.log("LOGS_DEBUG".bgCyan)
            let logMessage = input.map(item => {
                if (typeof item === 'object') {
                    return colorizeJSON(JSON.stringify(item, null, 2));
                } else {
                    return item;
                }
            }).join(' ');
            log.debug(logMessage)
        }
    };
    module.exports = logsUtil;
}
catch(e) { console.log("Logs Not Ready",e) }