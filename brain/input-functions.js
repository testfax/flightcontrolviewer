try {
    const {watcherConsoleDisplay,errorHandler,pageData} = require('../utils/errorHandlers')
    const { app,ipcMain, BrowserWindow,webContents  } = require('electron');
    const {logs} = require('../utils/logConfig')
    const Store = require('electron-store');
    const store = new Store({ name: 'electronWindowIds'})
    const thisWindow = store.get('electronWindowIds')
    const client = BrowserWindow.fromId(thisWindow.win);
    const path = require('path')
    const fs = require('fs')

    const utilities = {
        findActiveSocketKey: function(rooms,titanState) {
            const entry = Object.entries(rooms).find(([key, value]) => value === true);
            return entry ? entry[0] : titanState
        },
        redisValidator: function(redisRequestObject) {
            const directory = {
                "from": {
                isEmpty: false,
                isString: true,
                isObject: false,
                isNumber: false,
                numberInString: false
                },
                "description": {
                isEmpty: false,
                isString: true,
                isObject: false,
                isNumber: false,
                numberInString: false
                },
                "type": {
                isEmpty: false,
                isString: true,
                isObject: false,
                isNumber: false,
                numberInString: false
                },
                "method": {
                isEmpty: false,
                isString: true,
                isObject: false,
                isNumber: false,
                numberInString: false
                },
                "data": {
                isEmpty: false,
                isString: false,
                isObject: true,
                isNumber: false,
                numberInString: false
                },
                "keys": {
                isEmpty: false,
                isString: false,
                isObject: true,
                isNumber: false,
                numberInString: false
                },
            }
            let failures = []
            for (const key of Object.keys(directory)) {
                if (!(key in redisRequestObject)) {
                failures.push(`MISSING: ${key}`);
                }
                else {
                let value = redisRequestObject[key];
                const regex = /\d/;
                if (typeof value === 'string') { value = value.replace(/\s/g, ''); }
                // logs(`${key}`.cyan, Object.keys(value).length, typeof value);
                const summary = {
                    isEmpty: Object.keys(value).length === 0,
                    isString: typeof value === 'string',
                    isObject: typeof value === 'object',
                    isNumber: typeof value === 'number',
                    numberInString: regex.test(value),
                };
                const directoryEntry = directory[key];
                for (const [k, v] of Object.entries(summary)) {
                    if (v !== directoryEntry[k]) {
                    failures.push(`${key}.${k}`)
                    }
                }
                }
            }
            if (failures.length) {
                return false
            }
            else {
                return true;
            }
        },
        fetcher: async function(FET,callback) {
            // console.log("fetcher".red,FET)
            if (watcherConsoleDisplay('globalIPC')) { 
                logs("[IPC]".bgMagenta,`brain_functions: {fetcher}`);
            }
            const d = { FET, "option": FET.type };
            let options = { 
                method: FET.method, 
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'mode': 'same-origin' }, 
            };
            let fetched = [];
            let response = []
            if (FET.method == "POST") { 
                options['body'] = JSON.stringify(d)
                //logs(colorize(FET, { pretty: true }))
                ipcMain.emit('fetcherMain',"no event parameter. its for ipcRenderer",FET)
                
            }
            else {
                try {
                    for (let a in FET.filePath) {
                        let gPath = path.join(__dirname,FET.filePath[0])
                        gPath = path.normalize(gPath)
                        fetched[a] = fs.readFileSync(gPath,'utf8', (err) => { if (err) return logs(err); });
                        response[a] = JSON.parse(fetched[a])
                    }
                    if (typeof callback === 'function') {
                        callback(fetched);
                    }
                    return response
                }
                catch(e) {
                    logs("FETCH FAILURE",errorHandler(e,e.name)) 
                    // let gPath = path.join(__dirname,FET.filePath[0])
                    // gPath = path.normalize(gPath)
                    // let fetched = fs.readFileSync(gPath,'utf8', (err) => { if (err) return logs(err); });
                    // fetched = JSON.parse(fetched)

                    // if (typeof callback === 'function') {
                    //     callback(fetched);
                    // }
                    // return fetched
                }
            }
        },
        fetcherMain: function(FET) { 
            if (watcherConsoleDisplay('globalIPC')) { 
                logs("[FETCHER]".bgMagenta,`fromRenderer: {fetcherMain} ${FET.type} | Current Page: ${pageData.currentPage}`);
                // if (isJSONvalid(FET)) { 
                //   logs(colorize(FET, { pretty: true }))
                    console.log(FET)
                // }
                // else { logs("[IPC]".bgRed,`fromRenderer: {fetcherMain} is not proper JSON...`) }
            }       
            let result
            try {
                if (app.isPackaged) {
                    result = fs.readFileSync(path.join(process.cwd(),'resources','app',FET.filePath[0]), 'utf8', (err) => { if (err) return logs(err); });
                }
                else {
                    result = fs.readFileSync(path.join(process.cwd(),FET.filePath[0]), 'utf8', (err) => { if (err) return logs(err); });
                }
            }
            catch(e) { errorHandler(e,e.name)}
            result = JSON.parse(result);
            let newData = null
            if (FET.type && FET.type == "QRM") {
                try {
                    Object.values(result).forEach((value) => {
                        if (Array.isArray(value)) {
                            value.forEach((material) => {
                                if (material.Name === FET.selectedMat.Name) {
                                material.StateQRM = FET.selectedMat.StateQRM;
                            }
                        });
                        }
                    });
                    newData = JSON.stringify(result, null, 2);
                }
                catch (e) {
                    console.log(e)
                }
            }
            if (FET.type && FET.type == "Materials") {
                Object.values(result).forEach((value) => {
                    if (Array.isArray(value)) {
                    value.forEach((material) => {
                        if (material.Group === FET.category) {
                        material.State = FET.state;
                        }
                    });
                    }
                });
                newData = JSON.stringify(result, null, 2);
            }
            if (FET.type && FET.type == "materialHistory") {
                //If the incoming material matches the timestamp and name of the history timestamp and name. exit the process.
                if (FET.material[0].timeStamp.includes("+")) { 
                    FET.material[0].timeStamp = FET.material[0].timeStamp.split("+")[[0]]
                }
                const timeStampMatch = result.data.find(ts => {
                    
                    if (ts.timeStamp.includes("+")) { 
                        ts.timeStamp = ts.timeStamp.split("+")[[0]]
                    }
                    // console.log(ts.timeStamp, ts.Name)
                    ts.timeStamp === FET.material[0].timeStamp && ts.Name === FET.material[0].Name
                    if (ts.timeStamp === FET.material[0].timeStamp && ts.Name === FET.material[0].Name) { 
                        // logs(ts.Name, FET.material[0].Name,ts.timeStamp, FET.material[0].timeStamp)
                        return true
                    }
                    return false
                    
                })
                if (timeStampMatch) {
                    // logs("timestampmatch".yellow,timeStampMatch.Name)
                    if (watcherConsoleDisplay('globalIPC')) { logs("[FETCHER]".bgMagenta,"materialHistory: Data already present. Exiting".bgRed) }
                    return
                }
                //Remove 1 element to allow room for the next. Max 10. 
                if (result.data.length >= 10) {
                    result.data.splice(9);
                }
                let maxCount = null;
                const gradeStuff = gradeInfos(FET.material[0].Grade)
                // logs(FET.material[0].Total, gradeStuff[0])
                if (FET.material[0].Total > gradeStuff[0]) { maxCount = gradeStuff[0] }
                else { maxCount = FET.material[0].Total }
                
                result.data.unshift({
                    Name: FET.material[0].Name,
                    Name_Localised: FET.material[0].Name_Localised,
                    Count:  FET.material[0].Count,
                    Grade: FET.material[0].Grade,
                    Operator: FET.material[0].Operator,
                    Operator_Sign: FET.material[0].Operator_Sign,
                    timeStamp: FET.material[0].timeStamp,
                    Total: maxCount
                })
                result.data.sort((a, b) => new Date(b.timeStamp) - new Date(a.timeStamp));
                newData = JSON.stringify(result, null, 2);
                function findMatObject(obj, key, value) {
                    if (typeof obj === 'object' && obj !== null) {
                    if (obj[key] === value) {
                        return obj;
                    }
                    for (const prop in obj) {
                        const foundObject = findMatObject(obj[prop], key, value);
                        if (foundObject) {
                        return foundObject;
                        }
                    }
                    }
                    return null;
                }
                function gradeInfos(x) {
                    try {
                        let findGrade = null;
                        
                        const gradeCountArray = [
                            { grade: "101", count: 1 },
                            { grade: "1", count: "300" },
                            { grade: "2", count: "250" },
                            { grade: "3", count: "200" },
                            { grade: "4", count: "150" },
                            { grade: "5", count: "100" }
                        ]
                        findGrade = gradeCountArray.find(i => i.grade == x)
                        // logs(findGrade)
                        return [ findGrade.count ];
                    }
                    catch(e) { 
                        if (!x) { logs("GRADEINFOS: Missing variable data: Material Grade FET.material[0].Grade") }
                    }
                }
            }
            if (FET.method == "POST") {
                try {
                    if (app.isPackaged) {
                        fs.writeFileSync(path.join(process.cwd(),'resources','app',FET.filePath[0]), newData, { flag: 'w' }, (err) => { if (err) return logs(err); });
                    }
                    else {
                        fs.writeFileSync(path.join(process.cwd(),FET.filePath[0]), newData, { flag: 'w' }, (err) => { if (err) return logs(err); });
                    }
                }
                catch (e) {
                    logs(e,e.stack)
                }
            }
        
            //If Lounge Client is on the Materials Page, then send to the renderer process functions.js
            if (FET.type && FET.type == "materialHistory" && pageData.currentPage == 'Materials') {
                const client = BrowserWindow.fromId(thisWindow.win);
                client.webContents.send('fetcherMatHistory', FET.material);
            }
        }
    }
    module.exports = utilities 
    ipcMain.on('fetcherMain', (event,FET) => {
        event = 'string'
        utilities.fetcherMain(FET);
    });
}
catch(e) {
    // logs(e)
    errorHandler(e,e.name)
}