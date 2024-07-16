const { app, BrowserWindow } = require('electron')
const {logs,logs_error} = require('./logConfig')
const Store = require('electron-store');
const store = new Store({ name: 'electronWindowIds'})
const path = require('path')
const fs = require('fs')
const colors = require('colors')
Tail = require('tail').Tail;
const xml2js = require('xml2js');

const util = {
    convertXML: async() => {
        let xmlArray = util.client_path().rsi_activeMapping
        const parser = new xml2js.Parser({ explicitArray: false });
        let jsonResult = null;
        parser.parseString(xmlArray, (error, result) => {
            if (error) { error = "Error Parsing XML" } 
            else { jsonResult = JSON.stringify(result, null, 2); }
        });
    },
    cwd: app.isPackaged ? path.join(process.cwd(),'resources','app') : process.cwd(),
    autoUpdater: async () => {
        const { autoUpdater } = require('electron-updater')
        // Auto Updater
        if (app.isPackaged) { 
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
        //
        if (!result.hasOwnProperty('clientSize')) { 
            return {moveTo:[700,100], resizeTo:[366,600]}
        }
        if (init) {
            //If init is truthy, then return the result of the file contents and send back what you need.
            const moveTo = result.clientPosition; const resizeTo = result.clientSize;
            return { moveTo, resizeTo }
        }
        if (result) {
            const moved = win.getPosition();
            const resized = win.getSize();
            result["clientPosition"] = moved 
            result["clientSize"] = resized
            store.set("windowPosition",result)
        }
    },
    norm: function(a,b,ext) {
        let fixed = path.normalize(`${a}/${b}.${ext}`)
        return fixed
    },
    client_path: function(request) {
        // if (util.watcherConsoleDisplay('client_path') && request) {
        //     logs("[UTIL]".green,"client_path:".blue,request);
        // }
        let rsi_stockLocation = path.join('C:','Program Files','Roberts Space Industries','StarCitizen','LIVE')
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
            rsi_activeMapping, 
            rsi_requested
        }
    },
    pageData: { currentPage: "" },
    logF: (err) => { return JSON.stringify(err, null, 2) },
    // getCommander: function(data) {
    //     let loungeClientFile = `${getPath.getHomeFolder()}/Saved Games/Frontier Developments/Elite Dangerous/lounge-client.json`
    //     loungeClientFile = path.normalize(loungeClientFile)
    //     let result = fs.readFileSync(loungeClientFile,'utf8', (err) => { if (err) return logs(err); });
    //     result = JSON.parse(result)
    //     return result[0].commander
    // },
    watcherConsoleDisplay: function(event) {
        //!Leave blank or with a random string if you dont want to see events.
        //!If you want to see events, then type the name of the event verbatim in the Array
        //! Use "All" as index zero to see all events..
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        const eventType = [
            "All",
        ] 
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

        for (let a in eventType) { 
            if (event === eventType[a] || eventType[0] === "All") { 
                return true; 
            } 
        }
        return false;
    },
    errorHandler: function(error,extra,origin) {
        if (!app.isPackaged) {
            if (BrowserWindow.fromId(1)) { 
                BrowserWindow.fromId(1).send('loading-eventActioned',error.stack)
            }
            logs_error("\n","[ERROR AREA]".bgYellow,`${extra}`.cyan,"\n","[ERROR STACK]".bgRed,error.stack,"\n","[ERROR ORIGIN]".bgYellow,origin)
            
            // if (origin == "ExperimentalWarning") return
            // let errorGenReport = {}
            // const currentDateTime = new Date()
            // errorGenReport.timestamp = currentDateTime.toISOString()
    
            // logs("[ERROR TYPE]".red,`${origin}`.yellow)
            // if (extra) {
            //     logs("[ERROR Extra]".red, `${extra}`.cyan)
            // }
            // let errArray = new Array() 
            // // logs("TEST".yellow,error);
            // if (typeof error == 'string') { errArray = error.split("/n") }
            // if (typeof error == 'object') { 
            //     let newError = { 
            //         name: error.name,
            //         message: error.message,
            //         stack: error.stack
            //     }
            //     Object.entries(newError).forEach(([key,value]) => {
            //         errArray.push(value)
            //     })
            //  }
            // errArray.forEach((err,index) => {
            //     if (index == 0) {  console.error("[ERROR PROBLEM]".red,`${err} `.yellow) }
            //     console.error("[ERROR]".red,`${index} ${err} `.cyan)
            // })
            // errorGenReport.stack =  error.stack
            
            // logs(`APP ${app.getName().bgBrightRed} exited by ${origin} handler... `.red)
            // errorFunc.logGenerator(errorGenReport);
        }
        if (app.isPackaged) {
            logs_error("\n","[ERROR AREA]".bgYellow,`${extra}`.cyan,"\n","[ERROR STACK]".bgRed,error.stack,"\n","[ERROR ORIGIN]".bgYellow,origin)
            if (BrowserWindow.fromId(1)) {
                //Send critical erro to loading screen
                BrowserWindow.fromId(1).send('loading-eventActioned',error.stack)
            }
            if (BrowserWindow.fromId(2)) {
                //Terminate the client if criticla error is discovered.
                app.quit();
            }
        }
        
    }
}

module.exports = util