//! Watcher Console Display is located in errorHandler.js

const {watcherConsoleDisplay,errorHandler} = require('./utilities')
try {
    const { app, ipcMain, BrowserWindow,webContents  } = require('electron');
    const {logs,logs_error} = require('./logConfig')
    const Store = require('electron-store');
    const store = new Store({ name: 'electronWindowIds'})
    const thisWindow = store.get('electronWindowIds')
    Tail = require('tail').Tail;
    const path = require('path')
    const fs = require('fs')
    const chokidar = require('chokidar') //Monitors File Changes in the Saved Games\ED\ folder.
    
    if (lcs.requestCmdr() != false && lcs.requestCmdr() != 'undefined') {
        const wat = {
            client_path: "",
            ignoreEvent: function(ignoreEventName) {
                try {
                    let ignoreEventsJSON;
                    if (app.isPackaged) {
                        ignoreEventsJSON = fs.readFileSync(path.join(process.cwd(),'resources','app','events','Appendix','ignoreEvents.json'), (err) => { if (err) return logs(err); });
                    }
                    else {
                        ignoreEventsJSON = fs.readFileSync(path.join(process.cwd(),'.','events','Appendix','ignoreEvents.json'), (err) => { if (err) return logs(err); });
                    }
                    ignoreEventsJSON = JSON.parse(ignoreEventsJSON) 
                    for (const event of ignoreEventsJSON.events) {
                        if (event.event === ignoreEventName) {
                            // logs("IGNORE TEST".red,ignoreEventName)
                            return event.event;
                        }
                    }
                    return null; // Return null if event name not found
                }
                catch(e) { errorHandler(e,"wat.ignoreEvent")}
            },
            tailFile: function(savedGamePath) { //called from wat.eliteProcess() function. Only for *.log files. *.json files are handled at the bottom of this page with watcher.on('change')
                const currentJournalLog = lcs.latestLog(savedGamePath,"log")
                //continueWatcherBuild(currentJournalLog)
                function continueWatcherBuild(currentJournalLog) {
                    if (watcherConsoleDisplay('globalLogs')) { 
                        logs("[TAIL]".green,"Monitoring:".green ,path.parse(currentJournalLog).base)
                    }
                    const tailLogOptions = { separator: /\n/ }
                    const tailLog = new Tail(currentJournalLog,tailLogOptions);
                    tailLog.on("line", function(data) { 
                        if (watcherConsoleDisplay('showBuffer')) {  logs("BEGINNING OF BUFFER ===".blue,`\n ${data}`.cyan,"\n","========= END OF BUFFER".blue); }
                        let inspectedEvent = null
                        try {
                            inspectedEvent = JSON.parse(data) //turn string into a JSON array
                            //  wat.sendlogEvent(inspectedEvent)
                            //! CHECK TO SEE IF EVENT IS IN THE IGNORE FILE....
                            
                            //!Increment Event Index number
                            lcs.eventIndexNumber++
                            lcs.updateEventIndexNumber(lcs.eventIndexNumber,`JL-${inspectedEvent.event}`)
                            const now = new Date(inspectedEvent.timestamp);
                            inspectedEvent["timestamp"] = now.toISOString() + `+${lcs.eventIndexNumber}`
                            // console.log(index, readEventsList.totalLines, formattedNumber)
                            //!
                            // console.log(`JL-${inspectedEvent["timestamp"]}`.cyan,`${inspectedEvent.event}`)
                            //!


                            const askIgnoreFile = wat.ignoreEvent(inspectedEvent.event)
                            //! CHECKED, gathers a category name if it is found, if not, it will return null
                            if (askIgnoreFile == null && inspectedEvent != null) {
                                // logs("1: Watcher.... ".bgCyan,`${inspectedEvent.event}`.yellow)
                                if (watcherConsoleDisplay(inspectedEvent.event)) { logs("1: Watcher.... ".bgCyan,`${inspectedEvent.event}`.yellow) }
                                const result = initializeEvent.startEventSearch(inspectedEvent,0)
                               
                                // 1 returnable result, 0 no returnable result. // logs("result of commander",commander); }
                            }
                        }
                        catch(e) {
                            logs_error("[TAIL]".red, "The current Journal Log is corrupted, can not continue with unknown event:",`${data}`.red)
                            errorHandler(e,e.name)
                        }
                    });
                    tailLog.on("error", function(error) { logs_error('ERROR: ', error); });
                    // logs('emitting tailState')
                    // ipcMain.emit('tailState',tailLog.isWatching)
                }
            },
            tailJsonFile: function(data,eventMod) { //For JSON files only
                if (data) { 
                    try {
                        if (watcherConsoleDisplay('showBuffer')) {  logs("BEGINNING OF BUFFER ===".blue,`\n ${data}`.cyan,"\n","========= END OF BUFFER".blue); }
                        let dataObj = JSON.parse(data)
                        const event = dataObj.event
                        if (dataObj.event === 'Market') { dataObj['event'] = 'MarketJSON' }
                        //!NavRoute.json contains NavRouteClear (event key) upon route clearing.
                        //!Journal log contains event called "NavRouteClear" as well. Both contain same data.
                        //! Use journal log so it captured in socket server.
                        if (dataObj.event === 'NavRouteClear') { return }
                        if (eventMod != undefined) {   
                            if (watcherConsoleDisplay(event)) { logs("1: Watcher.... ".bgCyan,`${eventMod}`.yellow); } 
                        }
                        else {
                            if (watcherConsoleDisplay(event)) { logs("1: Watcher.... ".bgCyan,`${event}`.yellow); }
                        }
                        
                  
                        const exceptionList = [
                            'Cargo',
                        ]
                        const now = new Date(dataObj.timestamp);
                        if (exceptionList.includes(dataObj.event)) {
                            dataObj["timestamp"] = now.toISOString() + `+${lcs.eventIndexNumber + 1}`
                        }
                        else {
                            dataObj["timestamp"] = now.toISOString() + `-0`
                        }
                        //!
                        // console.log(`JS-${dataObj["timestamp"]}`.cyan,`${dataObj.event}`)
                        //!
                    
                        const result = sendJSONevent = initializeEvent.startEventSearch(dataObj,0,eventMod);
                        // 1 returnable result, 0 no returnable result. // logs("result of commander",commander); }
                    }
                    catch(e) {
                        logs_error("JSON PARSE FAIL".yellow,"Could not parse:".red,"EventMod:".red,eventMod,"Data:".red,data,e)
                    }
                }
                else { 
                    logs("No Data in JSON, watcher tailJsonFile.".red,data)
                }
            }
        }

        //! BEGIN WATCHING ELITE DANGEROUS FOLDER
        watcherPath = chokidar.watch(savedGamePath, {
            persistent: true,
            ignoreInitial: false,
            ignored: [
                `${savedGamePath}/*.cache`, 
                `${savedGamePath}/lounge-client.json`,
                `${savedGamePath}/edmc-journal-lock.txt`
            ],
        })
        
        watcherPath.on('ready', function() { //! Required to know what file to look at
            watcherPath.on('error',error => { logs(error);})
            watcherPath.on("add", savedGamePath => {
                if (wat.eliteIO.status) {
                    //! Look for hte journal ('.log') file that was added. 
                    //! This file is created as soon as you see the Odyssey logo.
                    // logs(savedGamePath)
                    if (path.parse(savedGamePath).ext == '.log') {
                        const thargoidBrain = new Store({ name: `brain-ThargoidSample` })
                        thargoidBrain.set('data',{})
                        lcs.eventIndexNumber = 0;
                        if (watcherConsoleDisplay('globalLogs')) { 
                            logs("[TAIL] New Journal Log Created... ".green, path.parse(savedGamePath).base)
                        }
                        //todo keep all the events for tailLog in 1 spot. (located in the wat functions variable)
                        const newPath = path.parse(savedGamePath).dir
                        wat.tailFile(newPath)
                        
                        // wat.eliteProcess("EliteDangerous", () => (err,result) => {
                        //     if (err) { logs("error with detecting if elite is running".bgMagenta); return; } 
                        //     wat.eliteIO['status'] = result
                        //     if (result) { wat.tailFile(savedGamePath) }
                        // })
                    }
                }
            })

            const tailLogOptionsStatus = { separator: /\n/, fromBeginning: true}
            const JSONtailStatus = new Tail(savedGamePath + 'Status' + '.json',tailLogOptionsStatus);
            JSONtailStatus.on("line", function(data) {
                if (wat.eliteIO.status) { wat.tailJsonFile(data) }
            });
            const jsonFiles = [
                // 'Status.json',
                // 'ModulesInfo.json',
                'Cargo.json',
                // 'ShipLocker.json',
                'NavRoute.json',
                // 'Outfitting.json',
                // 'Shipyard.json',
                'Market.json',
                // 'Backpack.json',
                // 'FCMaterials.json',
                // 'ShipLockerOriginal.json'
            ]
            watcherPath.on('change', (specifiedFile) => {
                const pFile = path.basename(specifiedFile)
                if (jsonFiles.includes(pFile)) { 
                    fs.readFile(specifiedFile, 'utf8', (err, data) => {
                        if (err) {
                          logs_error(`Error reading file: ${err}`);
                          return;
                        }
                        if (wat.eliteIO.status && data) { wat.tailJsonFile(data); }
                    });
                 }
            })
            const tailLogOptionsModulesInfo = { separator: /(\r\n|\n|\r)/gm, fromBeginning: true, flushAtEOF: true}
            let JSONtailModulesInfo = new Tail(savedGamePath + 'ModulesInfo' + '.json',tailLogOptionsModulesInfo);
            modulesInfoArray = new Array();
            JSONtailModulesInfo.on("line", (data) => {
                if (wat.eliteIO.status) { 
                    modulesInfoArray = modulesInfoArray + data;
                    if (data.includes(" ] }")) {
                        const newString = JSON.stringify(modulesInfoArray)
                        wat.tailJsonFile(JSON.parse(newString),"ModulesInfo")
                        modulesInfoArray = [''];
                    }
                }
            });
        })
        module.exports = wat
    }
    else { 
        if (watcherConsoleDisplay('globalLogs')) { 
            logs("[WATCHER]".yellow," No commander!".red)
        }
        lcs.requestCmdr()
        const commanderPresent = false
        module.exports = commanderPresent
    }
}
catch (error) {
    errorHandler(error,error.name)
    // console.error(error);
}