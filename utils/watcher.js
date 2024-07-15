//! Watcher Console Display is located in errorHandler.js

const {watcherConsoleDisplay,errorHandler,pageData} = require('./errorHandlers')
try {
    const { app, ipcMain, BrowserWindow,webContents  } = require('electron');
    const {logs,logs_error} = require('./logConfig')
    const Store = require('electron-store');
    const store = new Store({ name: 'electronWindowIds'})
    const thisWindow = store.get('electronWindowIds')
    Tail = require('tail').Tail;
    const path = require('path')
    // require('./processDetection')
    const fs = require('fs')
    const chokidar = require('chokidar') //Monitors File Changes in the Saved Games\ED\ folder.
    const { initializeEvent } = require('./eventsHandler')
    let lcs = require('./loungeClientStore')
    let lcsStuff = lcs.savedGameLocation("lcsStuff watcher.js");
    let eventsArray = []
    
    if (lcs.requestCmdr() != false && lcs.requestCmdr() != 'undefined') {
        const savedGamePath = lcsStuff.savedGamePath;
        const wat = {
            eliteIO: { status: null, event: "gameStatus" },
            savedGameP: lcsStuff.savedGamePath,
            norm: function(a,b,ext) {
                let fixed = path.normalize(`${a}/${b}.${ext}`)
                return fixed
            },
            // eliteProcess: function(processName, callback) { //I dont even know if this is usable anymore. as processDetection.js handles everything.
            //     isProcessRunning(processName, (err, result) => {
            //         if (err) {
            //         console.error(`Error checking if ${processName} is running: ${err}`);
            //         return callback(err, null);
            //         }
            //         //logs(`The ${processName} process is ${result ? "" : "not "}running`);
                    
            //         callback(null, result);
            //     });
            // },
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
                continueWatcherBuild(currentJournalLog)
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
        
        watcherPath.on('ready', function() { //! Required to know what file to look at once the game loads.
            watcherPath.on('error',error => { logs(error);})
            
            //APP IS LAUNCHED AND THEN CHECKS TO SEE IF IT IS RUNNING.
            //todo CALL lcs.readLogFile(savedGamePath) to input data into lcs.readLogFileData object Ex: lcs.readLogFileData.commander
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
            //todo need to figure out how to create a single function to loop all these through.
            //todo The STATUS.JSON is a single line entry and is handled on its own.
            //todo the other json files are multi line and are handled by tail as being read from the beginning, because they are not
            //todo saved to the disk, they are only saved in memory.
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
            //! { "timestamp":"2023-03-16T00:07:37Z", "event":"ModuleInfo" } (notice the "event" name (MODULE) NO "S")
            //! Only writes to the "*.log" file with this, nothing more.
            //! Re-Wrote the Event to actually take the renamed event. see wat.tailJsonFile(modulesInfoArray,"ModulesInfo")
            //todo Rewrite all the code below into 1 function.
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
            // cargoArray = new Array();
            // const tailLogOptionsCargo = { separator: /(\r\n|\n|\r)/gm, fromBeginning: true}
            // const JSONtailCargo = new Tail(savedGamePath + 'Cargo' + '.json',tailLogOptionsCargo);
            // JSONtailCargo.on("line", function(data) { 
            //     if (wat.eliteIO.status && data) { 
            //         cargoArray = cargoArray + data;
            //         if (data.includes(" ] }")) {
            //             const newString = JSON.stringify(cargoArray)
            //             wat.tailJsonFile(JSON.parse(newString),"Cargo")
            //             cargoArray = [''];
            //         }
            //     }
            // });
            shipLockerArray = new Array();
            const tailLogOptionsShipLocker = { separator: /(\r\n|\n|\r)/gm, fromBeginning: true}
            const JSONtailShipLocker = new Tail(savedGamePath + 'ShipLocker' + '.json',tailLogOptionsShipLocker);
            JSONtailShipLocker.on("line", function(data) { 
                if (wat.eliteIO.status && data) { 
                    shipLockerArray = shipLockerArray + data;
                    if (data.includes(" ] }")) {
                        const newString = JSON.stringify(shipLockerArray)
                        wat.tailJsonFile(JSON.parse(newString),"ShipLocker")
                        shipLockerArray = [''];
                    }
                }
            });
            shipyardArray = new Array();
            const tailLogOptionsShipyard = { separator: /(\r\n|\n|\r)/gm, fromBeginning: true}
            const JSONtailShipyard = new Tail(savedGamePath + 'Shipyard' + '.json',tailLogOptionsShipyard);
            JSONtailShipyard.on("line", function(data) { 
                if (wat.eliteIO.status && data) { 
                    shipyardArray = shipyardArray + data;
                    if (data.includes(" ] }")) {
                        const newString = JSON.stringify(shipyardArray)
                        wat.tailJsonFile(JSON.parse(newString),"Shipyard")
                        shipyardArray = [''];
                    }
                }
            });
            outfittingArray = new Array();
            const tailLogOptionsOutfitting = { separator: /(\r\n|\n|\r)/gm, fromBeginning: true}
            const JSONtailOutfitting = new Tail(savedGamePath + 'Outfitting' + '.json',tailLogOptionsOutfitting);
            JSONtailOutfitting.on("line", function(data) { 
                if (wat.eliteIO.status && data) { 
                    outfittingArray = outfittingArray + data;
                    if (data.includes(" ] }")) {
                        const newString = JSON.stringify(outfittingArray)
                        wat.tailJsonFile(JSON.parse(newString),"Outfitting")
                        outfittingArray = [''];
                    }
                }
            });
            // navRouteArray = new Array();
            // const tailLogOptionsNavRoute = { separator: /(\r\n|\n|\r)/gm, fromBeginning: true}
            // const JSONtailNavRoute = new Tail(savedGamePath + 'NavRoute' + '.json',tailLogOptionsNavRoute);
            // JSONtailNavRoute.on("line", function(data) { 
            //     if (wat.eliteIO.status && data) { 
            //         navRouteArray = navRouteArray + data;
            //         if (data.includes(" ] }")) {
            //             const newString = JSON.stringify(navRouteArray)
            //             wat.tailJsonFile(JSON.parse(newString),"NavRoute")
            //             navRouteArray = [''];
            //         }
            //     }
            // });
            // marketArray = new Array();
            // const tailLogOptionsMarket = { separator: /(\r\n|\n|\r)/gm, fromBeginning: true}
            // const JSONtailMarket = new Tail(savedGamePath + 'Market' + '.json',tailLogOptionsMarket);
            // JSONtailMarket.on("line", function(data) { 
            //     if (wat.eliteIO.status && data) { 
            //         marketArray = marketArray + data;
            //         if (data.includes(" ] }")) {
            //             const newString = JSON.stringify(marketArray)
            //             wat.tailJsonFile(JSON.parse(newString),"Market")
            //             marketArray = [''];
            //         }
            //     }
            // });
            backPackArray = new Array();
            const tailLogOptionsBackpack = { separator: /(\r\n|\n|\r)/gm, fromBeginning: true}
            const JSONtailBackpack = new Tail(savedGamePath + 'Backpack' + '.json',tailLogOptionsBackpack);
            JSONtailBackpack.on("line", function(data) { 
                if (wat.eliteIO.status && data) { 
                    backPackArray = backPackArray + data;
                    if (data.includes(" ] }")) {
                        const newString = JSON.stringify(backPackArray)
                        wat.tailJsonFile(JSON.parse(newString),"Backpack")
                        backPackArray = [''];
                    }
                }
            });
            const fcmaterials_path = path.join(savedGamePath,'FCMaterials.json')
            try {
                fs.statSync(fcmaterials_path)
                fcMaterialsArray = new Array();
                const tailLogOptionsFCMaterials = { separator: /(\r\n|\n|\r)/gm, fromBeginning: true}
                const JSONtailFCMaterials = new Tail(savedGamePath + 'FCMaterials' + '.json',tailLogOptionsFCMaterials);
                JSONtailFCMaterials.on("line", function(data) {
                    if (wat.eliteIO.status && data) { 
                        fcMaterialsArray = fcMaterialsArray + data;
                        if (data.includes(" ] }")) {
                            const newString = JSON.stringify(fcMaterialsArray)
                            wat.tailJsonFile(JSON.parse(newString),"FCMaterials")
                            fcMaterialsArray = [''];
                        }
                    }
                });
            }
            catch(e) {
                const contentsToWrite = 
                    { "timestamp":"2024-02-03T01:43:23Z", 
                    "event":"FCMaterials", 
                    "MarketID":3709451776, 
                    "CarrierName":"[xsf] killer's sabre", 
                    "CarrierID":"J0T-68X", "Items":[] 
                }
                fs.writeFileSync(fcmaterials_path, JSON.stringify(contentsToWrite), { encoding: 'utf8', flag: 'w' })
            }
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