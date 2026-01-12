const { app, BrowserWindow } = require('electron')
const {logs,logs_error,logs_debug} = require('./logConfig')
const Store = require('electron-store').default
const store = new Store({ name: 'electronWindowIds'})
const path = require('path')
const fs = require('fs')
const os = require('os')
const colors = require('colors')
const windowItemsStore = new Store({ name: 'electronWindowIds'})
const showConsoleMessages = windowItemsStore.get('showConsoleMessages')
const xml2js = require('xml2js')
const { execFileSync } = require('child_process')

const util = { 
    devicesObjBuilder: function() {
        function resolveLayoutsDir(app, path) {
            return path.join(app.getAppPath(), 'layouts')
        }
        try {
            const layoutIndex = new Store({ name: "layoutIndex" })
            const dir = resolveLayoutsDir(app, path)
            const indexPath = path.join(dir, 'index.json')
            if (!fs.existsSync(indexPath)) {
                logs_error("no layout/index.json file")
            }
            const indexJson = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
            layoutIndex.set(indexJson)
        }
        catch (err) {
            logs_error('[APP]'.bgRed, 'devicesObjBuilder - Failed to write layoutIndex', err.stack)
        }
    },
    formatJsonObject: function(obj, indent) {
        indent = indent || 0
        var spaces = ''
        for (var i = 0; i < indent; i++) spaces += ' '

        if (Array.isArray(obj)) {
            if (obj.every(function(v){ return v && v.rank_name && v.id })) {
                var items = obj.map(function(item){
                    return spaces + '    ' + JSON.stringify({ rank_name: item.rank_name, id: item.id })
                })
                return '[\n' + items.join(',\n') + '\n' + spaces + ']'
            } else {
                var items = obj.map(function(item){
                    return util.formatJsonObject(item, indent + 2)
                })
                var paddedItems = items.map(function(i){
                    var pad = ''
                    for (var j = 0; j < indent/2 + 1; j++) pad += '  '
                    return pad + i
                })
                return '[\n' + paddedItems.join(',\n') + '\n' + spaces + ']'
            }
        } else if (obj && typeof obj === 'object') {
            var entries = Object.entries(obj).map(function(entry){
                var key = entry[0]
                var val = entry[1]
                var keyValString = JSON.stringify(key) + ': ' + util.formatJsonObject(val, indent + 2)
                return spaces + '  ' + keyValString
            })
            return '{\n' + entries.join(',\n') + '\n' + spaces + '}'
        } else if (typeof obj === 'string') {
            return JSON.stringify(obj)
        } else {
            return String(obj)
        }
    },
    convertXML: async(path) => {
        try {
            if (showConsoleMessages) { logs_debug("[XML]".bgYellow,"Reading actionsmap.xml") }
            const xmlArray = fs.readFileSync(path,'utf8', (err,data) => { if (err) return logs_error("[XML]".bgRed,err.stack); return data });
            const XMLfile_path = util.client_path().rsi_actionmaps
            const xmlFile = fs.readFileSync(XMLfile_path,'utf8', (err,data) => { if (err) return logs_error("[XML]".bgRed,err.stack); return data });
            const parser = new xml2js.Parser({ explicitArray: false })
            let jsonResult = null;
            parser.parseString(xmlArray, (error, xmlFile) => {
                if (error) throw error
                else { jsonResult = xmlFile }
            })
            const actionmapsStore = new Store({ name: 'actionmapsJSON'})
            
            if (showConsoleMessages) { logs_debug("[XML]".bgYellow,"Building actionsmap.xml") }

            // Parse the XML data
            let returnables = null
            xml2js.parseString(xmlFile, (err, xmlFile_data) => {
                if (err) {
                    logs_error("[XML]".bgRed,'Error parsing XML:', err.stack);
                    return;
                }
            
                // Find the actionmap with the name 'spaceship_movement' ActionMaps.ActionProfiles[0].actionmap.
                const actionmap = xmlFile_data.ActionMaps.ActionProfiles[0].actionmap.find(am => am.$.name === 'spaceship_movement')
                // console.log(actionmap)
                if (!actionmap) {
                    logs_error("[XML]".bgRed,'spaceship_movement actionmap not found.')
                    return;
                }
            
                // Check if the actions v_yaw and v_pitch are present
                const actions = actionmap.action || [];
                const vYawAction = actions.find(a => a.$.name === 'v_yaw');
                const vPitchAction = actions.find(a => a.$.name === 'v_pitch');
    
                // Add missing actions
                if (!vYawAction) {
                    actions.push({
                    $: { name: 'v_yaw' },
                    rebind: [{ $: { input: 'js1_x' } }]
                    });
                }
            
                if (!vPitchAction) {
                    actions.push({
                    $: { name: 'v_pitch' },
                    rebind: [{ $: { input: 'js1_y' } }]
                    });
                }
            
                // Update the actionmap actions
                actionmap.action = actions;

                // Build the updated XML
                const builder = new xml2js.Builder();
                const updatedXml = builder.buildObject(xmlFile_data);
                actionmapsStore.set('actionmaps',xmlFile_data)

                // Write the updated XML back to the file

                const writen = fs.writeFileSync(XMLfile_path, updatedXml, 'utf8')//, (err,data) => { if (err) return logs_error("[XML]".bgRed,err.stack); return data });
                if (showConsoleMessages) { logs_debug("[XML]".bgGreen,"XML Built") }
                returnables = writen == writen ? true : false
                return returnables
            });
            return returnables
        }
        catch (e) {
            logs_error("[XML]".bgRed,e.stack)
        }
    },
    cwd: app.isPackaged ? path.join(process.cwd(),'resources','app') : process.cwd(),
    autoUpdater: async () => {
        if (!app.isPackaged) return

        const { BrowserWindow, dialog } = require('electron')
        const { autoUpdater } = require('electron-updater')

        // Prefer the existing window reference if you have it.
        // Fallback: first window.
        const win = BrowserWindow.getAllWindows()[0] || BrowserWindow.fromId(BrowserWindow.getFocusedWindow()?.id)

        if (!win) {
            logs_error('[AU] No window available to setTitle on')
            return
        }

        // Prevent duplicate listener stacking if this function can run again
        autoUpdater.removeAllListeners()

        logs_debug('[AU] Running Auto-Updater Functions'.yellow)
        autoUpdater.logger = require('electron-log')

        autoUpdater.on('checking-for-update', () => {
            win.setTitle(`Flight Control Viewer - ${app.getVersion()} Checking for updates...`)
        })

        autoUpdater.on('update-available', info => {
            win.setTitle(`Flight Control Viewer - ${app.getVersion()} - ${info.version} Update available, downloading...`)
        })

        autoUpdater.on('update-not-available', () => {
            win.setTitle(`Flight Control Viewer - ${app.getVersion()} up to date...`)
        })

        // autoUpdater.on('download-progress', p => {
        //     const formatted = (p.percent / 100).toLocaleString(undefined, {
        //     style: 'percent',
        //     minimumFractionDigits: 1
        //     })
        //     win.setTitle(`Flight Control Viewer - ${app.getVersion()} Downloading update ${formatted}`)
        // })
        autoUpdater.on('download-progress', (progressObj) => {
            const thisPercent = progressObj.percent / 100
            const formattedNumber = (thisPercent).toLocaleString(undefined, { style: 'percent', minimumFractionDigits:1});
            win.setTitle(`Flight Control Viewer - ${JSON.stringify(app.getVersion())} Downloading New Update ${formattedNumber}`)
        })

        autoUpdater.on('error', err => {
            logs_error('[AU] error', err && err.stack ? err.stack : err)
            win.setTitle(`Flight Control Viewer - ${app.getVersion()} Update error (see logs)`)
        })
        autoUpdater.on('update-downloaded', async () => {
            const result = await dialog.showMessageBox(win, {
            type: 'info',
            title: 'Update Available',
            message: 'A new version is ready. The app will now install and restart.',
            buttons: ['Continue']
            })
            if (result.response === 0) autoUpdater.quitAndInstall()
        })

        // Now start the check AFTER listeners are attached
        await autoUpdater.checkForUpdatesAndNotify()
    },
    windowPosition: function(win,init) {
        //Since the intent is to get the window Size and Position, lets call the function that validates the path of the lounge-client.json
        //After that is received, lets call the Store function to get the contents of that file.
        //Then, once you receive the result from getting the contents of the lounge-client.json
        //Update the object with what you want and then send it back as instructions, the function expects an object once you send it.
        let result = store.get("windowPosition") || {}
        function saveWindowPosition() {
            const moved = win.getPosition()
            const resized = win.getSize()
            result["clientPosition"] = moved 
            result["clientSize"] = resized
            store.set("windowPosition",result)
        }
        if (!result.hasOwnProperty('clientSize')) { 
            // return {moveTo:[700,100], resizeTo:[600,600]}
            saveWindowPosition()
            return {moveTo:[-876,13], resizeTo:[800,1000]}
            // return {moveTo:[639,18], resizeTo:[800,1000]}
        }
        if (init) {
            //If init is truthy, then return the result of the file contents and send back what you need.
            const moveTo = result.clientPosition; const resizeTo = result.clientSize;
            return { moveTo, resizeTo }
        }
        else { saveWindowPosition() }
        
        
    },
    client_path: function(request) {
        // if (util.watcherConsoleDisplay('client_path') && request) {
        //     logs_debug("[UTIL]".green,"client_path:".blue,request);
        // }
        function findStarCitizenLive() {
            const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
            const gameLogPath = path.join(appData, 'Star Citizen', 'game.log')

            // 1️⃣ Read game.log and extract Executable path
            if (fs.existsSync(gameLogPath)) {
                try {
                const log = fs.readFileSync(gameLogPath, 'utf8')

                // Example:
                // Executable: C:\Program Files\Roberts Space Industries\StarCitizen\LIVE\Bin64\StarCitizen.exe
                const match = log.match(/^Executable:\s+(.+)$/m)

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
        const files = fs.readdirSync(rsi_path);
        let rsi_savedMappings = null
        let rsi_actionmapsPath = null
        let rsi_actionmaps = null
        let rsi_requested = null
        if (files) { 
            rsi_savedMappings = path.join(rsi_path,'user','client','0','Controls','Mappings')
            rsi_actionmapsPath = path.join(rsi_path,'user','client','0','Profiles','default')
            rsi_actionmaps = path.join(rsi_path,'user','client','0','Profiles','default','actionmaps.xml')
            
            if (request) { 
                rsi_requested = path.join(rsi_path,request)
                rsi_requested = path.normalize(rsi_requested)
            }
        }

        // const client_path = {
        //     currentCitizen: {},
        //     file: rsi_path, 
        //     wing: {Inviter: "", Others: [], Rooms:[]}, 
        //     commander: "", 
        //     clientPosition: [ 363, 50 ], 
        //     clientSize: [ 1000, 888 ]
        // }

        return { 
            rsi_path, 
            rsi_savedMappings, 
            rsi_actionmapsPath, 
            rsi_actionmaps, 
            rsi_requested
        }
    },
    getWinHidDumpPath: function () {
        if (app.isPackaged) {
            // your install layout appears to be: resources\app\...
            return path.join(process.resourcesPath, 'app', 'helpers', 'winhiddump', 'winhiddump.exe')
        }

        // dev path (adjust to your repo layout)
        return path.join(__dirname, '..', 'helpers', 'winhiddump', 'winhiddump.exe')
    },
    runWinHidDump: function() {
        const exePath = util.getWinHidDumpPath()
        return execFileSync(exePath, [], { encoding: 'utf8', windowsHide: true })
    }
}

module.exports = util