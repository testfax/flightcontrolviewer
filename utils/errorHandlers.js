const { app, BrowserWindow } = require('electron')
const {logs,logs_error} = require('./logConfig')
const Store = require('electron-store');
const store = new Store({ name: 'electronWindowIds'})
const thisWindow = store.get('electronWindowIds')
const path = require('path')
const fs = require('fs')
const getPath = require('platform-folders')
const colors = require('colors')
// const {savedGameLocation} = require('./loungeClientStore')
const errorFunc = {
    pageData: { currentPage: "" },
    logF: (err) => { return JSON.stringify(err, null, 2) },
    getCommander: function(data) {
        let loungeClientFile = `${getPath.getHomeFolder()}/Saved Games/Frontier Developments/Elite Dangerous/lounge-client.json`
        loungeClientFile = path.normalize(loungeClientFile)
        let result = fs.readFileSync(loungeClientFile,'utf8', (err) => { if (err) return logs(err); });
        result = JSON.parse(result)
        return result[0].commander
    },
    watcherConsoleDisplay: function(event) {
        //!Leave blank or with a random string if you dont want to see events.
        //!If you want to see events, then type the name of the event verbatim in the Array
        //! Use "All" as index zero to see all events..
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        const eventType = [
            // "All",
            // "BrainEvent",
            // 'BrainCallbacks',
            // "showNoEventHandler",
            // "showNoEventHandlerShowArray",
            // "CarrierJump",
            // 'Commander',
            // "CommunityGoal",
            // "EjectCargo",
            // "EngineerApply",
            // "EngineerCraft",
            // "EngineerContribution",
            // "EngineerProgress",
            // "Docked",
            // "Undocked",
            // 'Fileheader',
            // 'Friends',
            // 'FSDJump',
            'gameStatus',
            'globalLogs',
            // 'globalIPC',
            "latestLogsRead",
            // 'LoadGame',
            // 'Loadout',
            // "Location",
            // "MaterialCollected",
            // "MaterialTrade",
            // "Missions",
            // "Market",
            // "MissionCompleted",
            // "Materials",
            // "Music",
            "requestCmdrLOGS",
            // "ReceiveText",
            // "Synthesis",
            // "savedGameLocationLOGS",
            // "Scan",
            // "Shutdown",
            // "startup-read",
            // "showBuffer",
            // "Statistics",
            // 'Status',
            // "Synthesis",
            // 'SupercruiseExit',
            // 'wingData',
            // 'WingAdd',
            // 'WingInvite',
            // 'WingJoin',
            // 'WingLeave'
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
        
    },
    logGenerator: function(errorGenReport) {
        errorGenReport.user = errorFunc.getCommander()
        Object.entries(thisWindow).forEach(([key, value])=>{
            let closureWindow = null;
            if (typeof value == 'number') { closureWindow = BrowserWindow.fromId(value) }
            store.set('electronWindowIds.appStatus',"error")
            if (closureWindow && typeof value == 'number') {
                logs("[ERROR]".red,`${key} Closed..`.yellow)
                const addKeys = { [key] : value }
                const oldKeys = errorGenReport.appWindows;
                errorGenReport.appWindows = {...oldKeys,...addKeys}
                // closureWindow.close();
            }
        })
        delete require.cache[require.resolve('./processDetection.js')];
        // eliteDangerousWatcher.stopWatching()
        logs("[LOG GEN]".red,`PRACTICE FOR LOG GENERATOR:`.bgMagenta)
        errorGenReport = Object.keys(errorGenReport).sort((a,b)=> b - a )
        // logs(errorGenReport)
        
        
    }
}

module.exports = errorFunc