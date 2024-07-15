try {
    const colors = require('colors')
    const fs = require('fs')
    const path = require('path')
    const log = require('electron-log'); 
    const getPath = require('platform-folders')
    let loungeClientFile = `${getPath.getHomeFolder()}/Saved Games/Frontier Developments/Elite Dangerous/lounge-client.json`
    loungeClientFile = path.normalize(loungeClientFile)
    let logspath = `${getPath.getHomeFolder()}/Saved Games/Frontier Developments/Elite Dangerous/`
    logspath = path.normalize(logspath)

    //! Initial lounge-client.json starting json
    const loungeClientObject = {
        file: loungeClientFile, 
        wing: {Inviter: "", Others: [], Rooms:[]}, 
        commander: {}, 
        clientPosition: [ 363, 50 ], 
        clientSize: [ 1000, 888 ]
    }
    try {
        const loungeClientCondition = fs.statSync(loungeClientFile)
        const loungeClientCondition2 = isJSONFileValid(loungeClientFile)
        if (!loungeClientCondition.size >=1 || !loungeClientCondition2) {
            loungeClientObject['commander'] = getCmdr() //Emplaced incase loss of lounge-client.json file integrity.
            const fileD = [loungeClientObject]
            fs.writeFileSync(loungeClientFile, JSON.stringify(fileD,null,2), { encoding: 'utf8', flag: 'w' })
            console.log("[LOGS]".red,"BYTES:".red,loungeClientCondition.size,"| VALID:".red,loungeClientCondition2,"|".red,"Re-Writing lounge-client.json with defaults")
        }
    }
    catch(e) {
        loungeClientObject['commander'] = getCmdr() //Emplaced incase loss of lounge-client.json file integrity.
        const fileD = [loungeClientObject]
        fs.writeFileSync(loungeClientFile, JSON.stringify(fileD,null,2), { encoding: 'utf8', flag: 'w' })
        console.log("[LOGS]".red,"Missing File. Created lounge-client.json file.")
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
            console.log(error)
        }
    }
    function isJSONFileValid(filePath) {
        try {
            const fileContents = fs.readFileSync(filePath, 'utf-8');
            const jsonObject = JSON.parse(fileContents);
            return true;
        } catch (err) {
            return false;
        }
    }
    function getCmdr() {
        try {
            const lastLog = latestLog()
            let contents = fs.readFileSync(lastLog,'utf8').split("\n")
            let cmdr = false
            let eventArray = []
            for (let index in contents) {
                let events = contents[index]
                events = events.replace(/\r/g, '');
                events = JSON.parse(events);
                eventArray.push(events.event)
                if (events.event === 'Commander') {
                    cmdr = {
                        commander: events.Name,
                        FID: events.FID
                    }
                    break;
                }
            } 
            if (eventArray.includes("Commander")) {
                return cmdr
            }
            if (!eventArray.includes("Commander")) {
                console.log("[LOGS]".red,"getCmdr: Player still in Main Menu, no Commander event found");
                return
            }
        }
        catch(e) { console.log("[LOGS]".red,"getCmdr: No Journal Logs Yet...",e); }
    }
    function latestLog() { 
        try {
            //if status.json file Flags = 1, then get previous log. The commander is on the main menu and current log commander event is not yet written.
            const pastLogs = lastLogs(logspath,"log",[0,2])
            let status = fs.readFileSync(path.join(logspath,"Status.json"),'utf8')
            status = JSON.parse(status)
            if (pastLogs.length >= 1 && status.Flags == 0) { return pastLogs[1] }
            else { return pastLogs[0] }
        }
        catch(error) {
            console.log("[LOGS]".red,"NO JOURNAL LOGS FOUND....",error)
            return "unknown.log" 
        }
    }

    const theCommander = getCmdr();
    log.initialize({ preload: true });
    // log.transports.file.file = 'session.log'; // Set a fixed filename for the log
    log.transports.file.level = 'verbose';
    log.transports.file.format = '{h}:{i}:{s}:{ms} [{level}] {text}'; // Customize log formatpm2 
    log.transports.file.maxSize = 10 * 1024 * 1024; // Set maximum log file size
    log.transports.file.maxFiles = 3; // Limit the number of log files
    log.transports.remote = (logData) => { 
        const formattedLogData = {
            commander: theCommander,
            journalLog:  path.basename(latestLog()),
            timestamp: new Date(),
            level: logData.level,
            message: logData.data,
        };
        if (theCommander) {
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
            logsUtil.logs_error("[LOGS]".red,"Remote Temp Disabled: NO COMMANDER".yellow)
            return
        }
    }

    const logsUtil = {
        logs: async (...input) => {
            let logMessage = input.join(' ');
            log.info(logMessage);
        },
        logs_error: async (...input) => {
            let logMessage = input.join(' ');
            log.error(logMessage);
        }
    }
    module.exports = logsUtil;
}
catch(e) { console.log("Logs Not Ready",e) }