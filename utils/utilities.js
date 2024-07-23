const { app, BrowserWindow } = require('electron')
const {logs,logs_error} = require('./logConfig')
const Store = require('electron-store');
const store = new Store({ name: 'electronWindowIds'})
const path = require('path')
const fs = require('fs')
const colors = require('colors')

const xml2js = require('xml2js');

const util = {
    convertXML: async(path) => {
        try {
            logs("[XML]".bgYellow,"Reading actionsmap.xml")
            const xmlArray = fs.readFileSync(path,'utf8', (err,data) => { if (err) return logs_error("[XML]".bgRed,err); return data });
            
            const parser = new xml2js.Parser({ explicitArray: false })
            let jsonResult = null;
            parser.parseString(xmlArray, (error, result) => {
                if (error) throw error
                else { jsonResult = result }
            })
            const actionmapsStore = new Store({ name: 'actionmapsJSON'})
            actionmapsStore.set('actionmaps',jsonResult.ActionMaps)
            util.buildXML()
        }
        catch (e) {
            logs_error("[XML]".bgRed,e);
        }
    },
    buildXML: async() => {
        const file = util.client_path().rsi_actionmaps
        const actionmapsStore = new Store({ name: 'actionmapsJSON'})
        
        logs("[XML]".bgYellow,"Building actionsmap.xml")
        // Read the actionmaps.xml file
        fs.readFile(file, 'utf8', (err, data) => {
            if (err) {
                logs_error("[XML]".bgRed,'Error reading the file:', err);
                return;
            }
            // Parse the XML data
            xml2js.parseString(data, (err, result) => {
                if (err) {
                    logs_error("[XML]".bgRed,'Error parsing XML:', err);
                    return;
                }
            
                // Find the actionmap with the name 'spaceship_movement' ActionMaps.ActionProfiles[0].actionmap.
                const actionmap = result.ActionMaps.ActionProfiles[0].actionmap.find(am => am.$.name === 'spaceship_movement');
                // console.log(actionmap)
                if (!actionmap) {
                    logs_error("[XML]".bgRed,'spaceship_movement actionmap not found.');
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
                    rebind: [{ $: { input: 'js2_x' } }]
                    });
                }
            
                if (!vPitchAction) {
                    actions.push({
                    $: { name: 'v_pitch' },
                    rebind: [{ $: { input: 'js2_y' } }]
                    });
                }
            
                // Update the actionmap actions
                actionmap.action = actions;

                // Build the updated XML
                const builder = new xml2js.Builder();
                const updatedXml = builder.buildObject(result);
            
                // Write the updated XML back to the file
                fs.writeFile(file, updatedXml, 'utf8', (err) => {
                    if (err) {
                        logs_error("[XML]".bgRed,'Error writing the file:', err);
                        return;
                    }
                    actionmapsStore.set('actionmaps',result)
                    logs("[XML]".bgGreen,"XML Built");
                });
            });
        });
    },
    cwd: app.isPackaged ? path.join(process.cwd(),'resources','app') : process.cwd(),
    autoUpdater: async () => {
        // Auto Updater
        if (app.isPackaged) { 
            const { autoUpdater } = require('electron-updater')
            logs("Running Auto-Updater Functions".yellow)
            autoUpdater.logger = require('electron-log')
            autoUpdater.checkForUpdatesAndNotify();

            // autoUpdater.logger.transports.file.level = 'info';
            // autoUpdater.autoDownload = true
            // autoUpdater.autoInstallOnAppQuit = true
            autoUpdater.on('download-progress', (progressObj) => {
                const thisPercent = progressObj.percent / 100
                const formattedNumber = (thisPercent).toLocaleString(undefined, { style: 'percent', minimumFractionDigits:1});
                    win.setTitle(`Flight Control Viewer - ${JSON.stringify(app.getVersion())} Downloading New Update ${formattedNumber}`)
                })
                autoUpdater.on('error',(error)=>{ 

                })
                autoUpdater.on('checking-for-update', (info)=>{
                    if (!info) { 
                        win.setTitle(`Flight Control Viewer - ${JSON.stringify(app.getVersion())} Checking for Updates "NONE"`) }
                    else {
                    win.setTitle(`Flight Control Viewer - ${JSON.stringify(app.getVersion())} Checking for Updates ${info}`)
                    }
                })
                autoUpdater.on('update-available',(info)=>{
                    win.setTitle(`Flight Control Viewer - ${JSON.stringify(app.getVersion())} - ${JSON.stringify(info.version)} Update Available, download pending... please wait...`)
                })
                autoUpdater.on('update-not-available',(info)=>{
                    // logs(`-AU update-not-available: ${JSON.stringify(info)}`)
                })
                autoUpdater.on('update-downloaded',(info)=>{
                dialog.showMessageBox({
                    type: 'info',
                    title: 'Update Available',
                    message: 'A new version of the app is available. App will now automatically install and restart once completed.',
                    buttons: ['Continue']
                }).then((result) => {
                    if (result.response === 0) {
                    // User chose to install now, quit the app and install the update.
                    // const appDataFolderPath = path.join(process.env.APPDATA, 'elitepilotslounge');
                    // //Removes the roaming folder for a clean install.
                    // //Have seen users not be able to load the program, due to corrupted roaming/elitepilotslounge.
                    // if (fs.existsSync(appDataFolderPath)) {
                    //   console.log(appDataFolderPath)
                    //   fs.rmdirSync(appDataFolderPath, { recursive: true });
                    // }
                    autoUpdater.quitAndInstall();
                    }
                });
            })
        }
    },
    windowPosition: function(win,init) {
        //Since the intent is to get the window Size and Position, lets call the function that validates the path of the lounge-client.json
        //After that is received, lets call the Store function to get the contents of that file.
        //Then, once you receive the result from getting the contents of the lounge-client.json
        //Update the object with what you want and then send it back as instructions, the function expects an object once you send it.
        let result = store.get("windowPosition")

        if (!result.hasOwnProperty('clientSize')) { 
            return {moveTo:[700,100], resizeTo:[366,600]}
        }
        if (init) {
            //If init is truthy, then return the result of the file contents and send back what you need.
            const moveTo = result.clientPosition; const resizeTo = result.clientSize;
            return { moveTo, resizeTo }
        }
        if (result) {
            const moved = win.getPosition()
            const resized = win.getSize()
            result["clientPosition"] = moved 
            result["clientSize"] = resized
            store.set("windowPosition",result)
        }
    },
    client_path: function(request) {
        // if (util.watcherConsoleDisplay('client_path') && request) {
        //     logs("[UTIL]".green,"client_path:".blue,request);
        // }
        let rsi_stockLocation = path.join('C:','Program Files','Roberts Space Industries','StarCitizen','LIVE')
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
    }
}

module.exports = util