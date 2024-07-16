try {
    const {logs,logs_error} = require('../utils/logConfig')
    const {watcherConsoleDisplay,errorHandler,logF} = require('../utils/errorHandlers')
    const { io, Manager } = require('socket.io-client')
    const { app, BrowserWindow } = require('electron');
    const { socket } = require('./socketMain')
    let {
        latestLog,
        latestLogRead,
        requestCmdr,
        savedGameLocation,
        updateEventIndexNumber,
        updateInitialReadStatus,
        getInitialReadStatus,
        updateStartStop,
    } = require('../utils/loungeClientStore')
    const uuid = require('uuid');
    const fs = require('fs')
    const path = require('path')
    const statusFlags = require('../events/Appendix/statusFlags.json');
    const utilities = require('../events/eventUtilities');
    const { initializeEvent } = require('../utils/eventsHandler')
    
    const Store = require('electron-store');
    const windowItemsStore = new Store({ name: 'electronWindowIds'})
    const thargoidSampling_store = new Store({ name: 'brain-ThargoidSample'})
    let options = { timeZone: 'America/New_York',year: 'numeric',month: 'numeric',day: 'numeric',hour: 'numeric',minute: 'numeric',second: 'numeric',},myTime = new Intl.DateTimeFormat([], options);
    const theCommander = requestCmdr().commander
    //!########################################################
    //!############ SOCKET SERVER DIRECT EMITS ################

    socket.on('fromSocketServer', async (data) => { 
        // logs(`[SOCKET SERVER]`.blue, `${data.type}`.bgGreen, `${data.message}`.green)
        //Need to send the dcohSystem's data to the frontside so that it can update all the titan systems info. 
        if (data.type == 'dcohSystems' && windowItemsStore.get('currentPage') == "brain-ThargoidSample") {
            try {
                const client = BrowserWindow.fromId(2);
                client.webContents.send(`dcohSystems-sample`, data);
            }
            catch (e) {
                logs("[TM]".yellow,"'fromSocketServer'->No Thargoid Sample Window",)
            }
        } 
        if (data.type == 'findSystemResult') { 
            if (data.message == '0') { 
                taskList.datas = "0" 
            }
        }
        if (data.type == 'brain-ThargoidSample_socket' && windowItemsStore.get('currentPage') == "brain-ThargoidSample") {
            try {
                const client = BrowserWindow.fromId(2);
                client.webContents.send("from_brain-ThargoidSample", data);
                // if (!app.isPackaged) {
                //     client.webContents.send("from_brain-ThargoidSample-dev", `[SOCKET SERVER] ${data.commander} - ${data.message}`);
                //     // logs(`[SOCKET SERVER]`.blue, `${data.commander}`.bgGreen, `${data.message}`.green)
                // }
            }
            catch (e) {
                logs("[TM]".yellow,"No Thargoid Sample Window")
            }
        }
    }) 
    //!######################################################## 
    //!######################################################## 
    //!######################################################## 
    
    const taskList = {
        //! Transmits all events that the client receives to the server as long as Task Manager is being called from the "EVENT" js file.
        // This is the catch all...
        socket_joinRoom: async function(data) {
            // logs("SOCKETJOIN".yellow,logF(data))
            const titanState = `${data.brain}_${data.name}_${data.state}`
            return new Promise(async (resolve,reject) => {
                try { socket.emit('joinRoom',titanState, async (response) => { 
                    resolve(response);
                    if (data.brain == 'brain-ThargoidSample') { 
                        thargoidSampling_store.set(`socketRooms.${data.brain}_${data.name}_${data.state}`, response)
                        thargoidSampling_store.set('brain_ThargoidSample.currentTitanState',`${data.brain}_${data.name}_${data.state}`);
                    }
                 }); }
                catch(error) { errorHandler(error,error.name); reject(error) }
            })
        },
        socket_leaveRoom: async function(data) {
            // logs("SOCKETLEAVE".yellow,logF(data))
            const titanState = `${data.brain}_${data.name}_${data.state}`
            return new Promise(async (resolve,reject) => {
                try { socket.emit('leaveRoom',titanState, async (response) => { 
                    resolve(response);
                    if (data.brain == 'brain-ThargoidSample') { 
                        thargoidSampling_store.set(`socketRooms.${data.brain}_${data.name}_${data.state}`, response)
                        thargoidSampling_store.set('brain_ThargoidSample.currentTitanState',"");
                    }
                 }); }
                catch(error) { errorHandler(error,error.name); reject(error) }
            })
        },
        socket_rooms: async function(data) { 
            return new Promise(async (resolve,reject) => {
                try { socket.emit('roomStatus',data, async (response) => { 
                    resolve(response);
                 }); }
                catch(error) { errorHandler(error,error.name); reject(error) }
            })
        },
        brain_ThargoidSample_socket: async function(data,event,titanSocket) {
            return new Promise(async (resolve,reject) => {
                try {
                    const timerID = uuid.v4().slice(-5); 
                    if (watcherConsoleDisplay(data.event)) { console.time(timerID) }
                    dataList = {event,...data,"titanSocket":titanSocket,...theCommander }
                    socket.emit('eventTransmit',dataList, async (response) => { resolve(response) });
                }
                catch(error) { errorHandler(error,error.name); reject(error) }
            })
        },
        eventDataStore: function(data,callback) {
            try {
                const timerID = uuid.v4().slice(-5); 
                if (watcherConsoleDisplay(data.event)) { console.time(timerID) }
                // const theCommander = requestCmdr().commander
                data = {...data,...theCommander}
                let discuss = socket.emit('eventTransmit',data, (response) => {
                    //! No response necessarily needed, unless there's some kind of visual need to show on the client.
                    //! The below is for troubleshooting purposes.
                    
                    if (response.event === "WingInvite") { 
                        //A response from socketServer, Dont really need this.
                    }
                    if (response.event === "redisRequest") { 
                        callback({response})
                    }
                    if (response.event === "RedisData-SampleSystems") { 
                        callback({response})
                    }
                    if (watcherConsoleDisplay(data.event) && data.event != "Status") { 
                        logs(`[SOCKET SERVER - TASK MANAGER - '${data.event}']`.yellow)
                        logs("[TM]".green);
                        console.timeEnd(timerID)
                        logs(colorize(response, {pretty:true}))
                    }
                return discuss;
                });
            }
            catch(error) { errorHandler(error,error.name) }
        },
        // Reads current log file and pushes events through event handler. 3 Second Delay.
        allEventsInCurrentLogFile: async (callback) => {
            try {
                callback('starting-allEventsInCurrentLogFile')
                const searchEventList = ["All"]
                // This is all occurances as they happened in the past. That way things can be iterated on. Example being if you launch the client after you've been playing elite for an hour.
                // const firstLoadList = latestLogRead(latestLog(savedGameLocation("Development Mode taskManager.js").savedGamePath,"log"),searchEventList).firstLoad
                // if (firstLoadList) {
                //     const lastEventInFirstLoadList = firstLoadList[firstLoadList.length - 1].timestamp
                //     let currentDateTime = new Date();
                //     currentDateTime = currentDateTime.toISOString();
                //     if (new Date(lastEventInFirstLoadList) - new Date(currentDateTime) < new Date()) { logs(
                //         "Old.................................",
                //         new Date()
                //     )}
                // }
                // This is the latest occurance that happend of any particular event.
                let readEventsList = await latestLogRead(latestLog(savedGameLocation().savedGamePath,"log"),searchEventList)
                if (watcherConsoleDisplay("latestLogsRead")) {
                    logs(
                        "[TM]".yellow,
                        "Running latestLogRead: ".green,
                        `${readEventsList.totalLines}`.cyan,
                        "events",
                        //! propertise of readEventsList
                        //! found, notFound, listItems, listItemByTimestamp, listItemByTimestampNames, firstLoad
                    )
                }
                if (readEventsList.totalLines > 0) {
                    updateStartStop(true)
                    updateInitialReadStatus(true)
                    continueReadLatestLogTM(0) //Start journal entry from line 0.
                    function restartFailedEvent(startIndex) { //If the event handler fails to read the event data correctly on the first read, it will try another time.
                        logs("startStop initiated, 1000ms break:".red)
                        setTimeout(() => { readLatestLogTM(startIndex) },1000);
                    }
                    async function continueReadLatestLogTM(startIndex) { 
                        let index = startIndex;
                        let failedArray = []
                        for (const eventItem of readEventsList.firstLoad.slice(startIndex)) {
                            index++;
                            const percent = index / readEventsList.totalLines;
                            const formattedNumber = (percent).toLocaleString(undefined, { style: 'percent', minimumFractionDigits:0});
                            callback({current:index,total:readEventsList.totalLines,percent:formattedNumber})

                            updateEventIndexNumber(index,`[TM]-${eventItem.event}`)
                            
                            const now = new Date(eventItem.timestamp);
                            if (watcherConsoleDisplay('startup-read')) { logs("[STARTUP READ]".cyan,`${index}`.red,`${eventItem.event}`.yellow,`${eventItem.timestamp}`.cyan) }
                            if (now != 'Invalid Date') {
                                eventItem["timestamp"] = now.toISOString() + `+${index}`
                            }
                            else { //For invalid Timestamps.
                                // logs_error('[TM]'.red,'Timestamp Issue'.yellow,"event ITEM:".bgMagenta,now,"Invalid Date in [TM]. Exiting Client.".red)
                               
                                //attemptobject must be coded if below is used
                                // if(!attemptCount.hasOwnProperty(eventItem.event)) { attemptCount[eventItem.event] = { attempts: 0 }; }
                                // else {
                                //     attemptCount[eventItem.event].attempts++
                                //     logs_error("event ITEM:".bgMagenta,now,logF(attemptCount),"Invalid Date in [TM]. Exiting Client.".red)
                                //     // return 
                                //     app.quit();
                                // }
                            }
                            
                            let eventHandled = null;
                            //! Make the client wait on each event.
                            eventHandled = await initializeEvent.startEventSearch(eventItem,true)
                            updateStartStop(false)
                            if (eventHandled && (index + 1) <= readEventsList.totalLines) {
                                updateStartStop(true); 
                                setTimeout(() => {
                                    continueReadLatestLogTM(index)
                                }, 0);
                                break;
                            } 
                            //for failures, try again.
                            if (eventHandled == undefined && (index + 1) <= readEventsList.totalLines) {
                                if (!failedArray.includes(eventItem.event)) { failedArray.push(eventItem.event)}
                                //!!!!! retry a failed event.
                                // restartFailedEvent(startIndex);
                                //!!!!!
                                if (failedArray.includes(eventItem.event)) {
                                    BrowserWindow.fromId(1).send('handleFailure',`Failed to Handle Journal Event: ${eventItem.event}`)
                                    updateStartStop(true); 
                                    setTimeout(() => {
                                        continueReadLatestLogTM(index)
                                    }, 0);
                                }
                                break;
                                
                            }
                            if (watcherConsoleDisplay('startup-read')) {
                                if (!eventHandled) { logs_error("allEventsInCurrentLogFile FAIL".red,`${eventItem.event}`.cyan,`${eventHandled}`.cyan); return }
                                if (eventHandled) { logs("allEventsInCurrentLogFile".green,`${eventItem.event}`.cyan,`${eventHandled}`.cyan) }
                            }
                            if (index == readEventsList.totalLines && failedArray.length == 0) {
                                const loadTime = (Date.now() - readEventsList.findEventsStartTime) / 1000;
                                logs("[TM]".green,"LatestLogsRead ".green,`${loadTime} Seconds`.cyan,"LINES:".green,`${readEventsList.totalLines}`.cyan)
                                updateInitialReadStatus(false)
                                // logs("[TM]".green,"Set -> initialReadStatus:false".bgGreen,getInitialReadStatus())
                                callback('journalLoadComplete')
                                break;
                            }
                        }
                    }
                    
                }
            }
            catch (e) {
                // logs_error("ERROR STACK:".bgRed,e.stack,"ERROR ORIGIN:".yellow,e.origin,"[TM]".red,"allEventsInCurrentLogFile".yellow)
                // throw Error(e, {cause:e})
                errorHandler(e,"allEventsInCurrentLogFile");
                
            }
            
        },
        //! Transmits status of the elite dangerous process. There is a poll rate checking every 15 seconds right now.
        gameStatus: function(data) {
            try {
                const timerID = uuid.v4().slice(-5); 
                data = {...data,...requestCmdr().commander}
                let data2 = {...data}
                if (watcherConsoleDisplay(data.event)) { console.time(timerID); logs("[PD]".yellow,"GameStatus??".green,data.status) }
                //! No response necessarily needed, unless there's some kind of visual need to show on the client.
                socket.emit('gameStatus',data);
                
                
                //IF loungeclient is launched after the game is opened for any reason, it will check to see if the "STATUS.json" file contains
                //   an "In Wing" hex code and find the last WingInvite and WingJoin events and automatically put you back in the correct socket.
                if (data2.status) {
                    let jsonStatusFilePath = path.normalize(savedGameLocation("gameStatus taskManager.js").savedGamePath + "/Status.json")
                    let jsonStatus = fs.readFileSync(jsonStatusFilePath,'utf8', (err) => { if (err) return logs(err); })
                    try {
                        if (jsonStatus) { jsonStatus = JSON.parse(jsonStatus) }
                        //todo CODE WING STATUS?
                    }
                    catch(error) {
                        if (watcherConsoleDisplay('globalLogs')) {
                            const extra = `[LCS] ${path.parse(jsonStatusFilePath).base} not Valid JSON.`
                            errorHandler(error,error.name,extra) 
                        }
                    }
                    const inWingStatusFlag = utilities.flagsFinder(statusFlags.flags,jsonStatus.Flags)
                    const inWingStatus = inWingStatusFlag.find((element) => element === 'In Wing') || {}.execs || false
                    if (data2.wingStatus == 'In Wing') {
                        //! TESTING MODE 
                        //! TESTING MODE 
                        //Determines if you are in a wing or not. Taken from Status File.
                        data['wingStatus'] = inWingStatus //Live
                        // data2['wingStatus'] = "In Wing" //Test
                        //! TESTING MODE
                        //! TESTING MODE
                        // const searchEvents = ["WingInvite","WingJoin","WingLeave"]
                        const searchEvents = ["WingInvite","WingJoin","WingAdd"]
                        const readEvents = latestLogRead(latestLog(savedGameLocation("gameStatus taskManager.js").savedGamePath,"log"),searchEvents)
                        
                        if (readEvents.found.length >= 1) {
                            for (let a in readEvents.found) { 
                                const eventData = {...readEvents.found[a]}
                                if(readEvents.found[a].event == "WingInvite") {
                                    if (watcherConsoleDisplay(eventData.event)) { logs("1: Wing Startup Init Event.... ".bgCyan,`${eventData.event}`.yellow) }
                                    // callback... Must be 1
                                    initializeEvent.startEventSearch(eventData,0)
                                }
                                if(readEvents.found[a].event == "WingJoin") {
                                    if (watcherConsoleDisplay(eventData.event)) { logs("1: Wing Startup Init Event.... ".bgCyan,`${eventData.event}`.yellow) }
                                    //callback... Must be 1
                                    setTimeout(initializeEvent.startEventSearch,1000,eventData,0); 
                                }
                                if(readEvents.found[a].event == "WingAdd") {
                                    if (watcherConsoleDisplay(eventData.event)) { logs("1: Wing Startup Init Event.... ".bgCyan,`${eventData.event}`.yellow) }
                                    //callback... Must be 1
                                    setTimeout(initializeEvent.startEventSearch,1300,eventData,0); 
                                }
                            }
                        }
                    }
                }
            }
            catch(error) { 
                errorHandler(error,error.name) 
            }
        },
    }
    module.exports = taskList

    //! Mode
    //! Mode
    //Reads current log file and outputs as if the Events are occuring real time. Basically, if this is not enabled
    //      then the log file will NOT be read in its entirity at application startup.
    //      Will only result in events that last get read out of the journal.
    // if (taskList.journalRun) {  setTimeout(taskList.allEventsInCurrentLogFile,700) }
    // if (taskList.journalRun) {  taskList.allEventsInCurrentLogFile }
    // 
    // IS CALLED FROM MAIN PROCESS DURING LOAD 
    //
    //! Mode
    //! Mode
}
catch (error) {
    // console.error("Fix Stack Error".yellow,error);
    errorHandler(error.stack,"Task Manager")
}