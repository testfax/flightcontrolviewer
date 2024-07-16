try {
    const colors = require('colors')
    const fs = require('fs')
    const path = require('path')
    const log = require('electron-log')

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
        return { 
            rsi_path,
            rsi_savedMappings,
            rsi_activeMapping,
            rsi_requested
        }
    }
    const theCitizen = getCitizen()
    console.log("theCitizen:".yellow,theCitizen)

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