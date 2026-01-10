const { logs, logs_error, logs_debug } = require('../utils/logConfig')
try {
    const { app,ipcMain, BrowserWindow,webContents  } = require('electron');
    const Store = require('electron-store').default
    const store = new Store({ name: 'electronWindowIds'})
    const viewerLogs = new Store({ name: 'viewerLogs'})
    const thisWindow = store.get('electronWindowIds')
    const client = BrowserWindow.fromId(thisWindow.win);
    const path = require('path')
    const fs = require('fs')

    const utilities = {
        keybindLoad: function() {
            let missingStuff = []
            try {
                const { convertXML,client_path } = require('../utils/utilities')
                const actionmaps = new Store({ name: 'actionmapsJSON'})
                actionmaps.delete('discoveredKeybinds')
                actionmaps.delete('actionmaps')
                const chokidar = require('chokidar')
                const showConsoleMessages = store.get('showConsoleMessages')
                
                if (!actionmaps.get('discoveredKeybinds') && !actionmaps.get('actionmaps')) {
                    const rsi_actionmapsPath = client_path().rsi_actionmapsPath
                    watcherPath = chokidar.watch(rsi_actionmapsPath, {
                        persistent: true,
                        ignoreInitial: false,
                        ignored: [
                            `${rsi_actionmapsPath}/attributes.xml`,
                            `${rsi_actionmapsPath}/HintStatus.xml`,
                            `${rsi_actionmapsPath}/profile.xml`
                        ]
                    })
                    watcherPath.on('ready', async function() {
                        watcherPath.on('error',error => { logs_error("[DET]".red,error.stack) })
                        watcherPath.on("change", rsi_actionmapsPath => {
                            evaluateActionmaps()
                            if (showConsoleMessages) { logs_debug("[DET]".bgYellow,"Detected file change: actionmaps.xml") }
                        })
                    })
                    evaluateActionmaps()
                    
                    async function evaluateActionmaps() {
                        const stat = await convertXML(client_path().rsi_actionmaps)
                        if (stat == true) {
                            const json = actionmaps.get('actionmaps')
                            const jsonDevices = json.ActionMaps.ActionProfiles[0].options
                                .filter(device => device.$.type === "joystick" && device.$.hasOwnProperty('Product'))
                                .map(device => device.$)
                            const cleanedDevices = jsonDevices.map(device => {
                                const cleanedProduct = device.Product.replace(/\s*\{.*\}/, '').trim()
                                return {
                                    ...device,
                                    type: device.type === 'joystick' ? 'js' : device.type,
                                    Product: cleanedProduct
                                }
                            })
                            if (showConsoleMessages) { logs_debug("Detected Devices".yellow,cleanedDevices) }
                            const actionmap = json.ActionMaps.ActionProfiles[0].actionmap
                            const deviceMap = cleanedDevices.reduce((map, device) => {
                                const prefix = `${device.type}${device.instance}_`
                                map[prefix] = `${device.type}${device.instance}`
                                return map
                                }, {})
                
                            function sortKeybinds(actionmap) {
                                const buttons = {}
                
                                actionmap.forEach(category => {
                                    const categoryName = category.$?.name
                                    if (!categoryName) {
                                        logs_error('Category name is missing')
                                        return
                                    }
                                    
                                    const actions = Array.isArray(category.action) ? category.action : [category.action]
                                    actions.forEach(action => {
                                        if (action.rebind) {
                                            const rebinds = Array.isArray(action.rebind) ? action.rebind : [action.rebind]
                                            rebinds.forEach(rebind => {
                                                const input = rebind.$?.input
                                                if (typeof input === 'string') {
                                                    const prefix = Object.keys(deviceMap).find(p => input.startsWith(p))
                                                    if (prefix) {
                                                        const newKey = input.replace(prefix, deviceMap[prefix] + '_')
                                                        const parts = newKey.split('_')
                                                        const keyName = parts[0] + (parts[1] ? '_' + parts[1] : '')
                                                        // if (keyName == "js1_x") {
                                                        //     console.log(`Processed key: ${keyName}, Original input: ${input}, Category: ${categoryName}`)
                                                        // }
                
                                                        if (!buttons[keyName]) {
                                                            buttons[keyName] = []
                                                        }
                                                        const existingCategory = buttons[keyName].find(entry => entry.categoryName === categoryName)
                                                        if (existingCategory) {
                                                            existingCategory.actions.push(action.$?.name)
                                                        } else {
                                                            buttons[keyName].push({
                                                                categoryName: categoryName,
                                                                actions: [action.$?.name]
                                                            });
                                                        }
                                                    } else {
                                                        // logs_debug(`No prefix found for input: ${input}`)
                                                    }
                                                } else {
                                                    // logs_debug(`Invalid input type: ${input}`)
                                                }
                                            });
                                        }
                                    });
                                });
                            
                                // logs_debug("Keys before sorting:", Object.keys(buttons))
                            
                
                                const sortedButtons = {}
                                Object.keys(buttons)
                                    .sort((a, b) => {
                                        const [aPrefix, aButton] = a.split('_')
                                        const [bPrefix, bButton] = b.split('_')
                                        if (aPrefix !== bPrefix) {
                                            return aPrefix.localeCompare(bPrefix)
                                        }
                                        const aNum = parseInt(aButton.replace('button', ''), 10) || 0
                                        const bNum = parseInt(bButton.replace('button', ''), 10) || 0
                                        return aNum - bNum
                                    })
                                    .forEach(key => {
                                        sortedButtons[key] = buttons[key]
                                    })
                                // logs_debug("Keys after sorting:", Object.keys(sortedButtons))
                                return sortedButtons
                            }
                            const sortedKeybinds = sortKeybinds(actionmap)
                            actionmaps.set('discoveredKeybinds',sortedKeybinds)
                            if (showConsoleMessages) { logs_debug("[DET]".bgGreen,"Initialized") }
                            logs("[keybinds-detection]".bgGreen,"Initialized")
                        }










                        //!###### not used ##############
                        // function listCategories(actionmap) {
                        //     return actionmap.map(category => {
                        //         if (category.$ && category.$.name) {
                        //             return category.$.name;
                        //         }
                        //         return null; // Return null if the name is not found
                        //     }).filter(name => name !== null); // Filter out null values
                        // }
                        // function findCategory(actionmap, categoryName) {
                        //     for (const category of actionmap) {
                        //         if (category.$ && category.$.name === categoryName) {
                        //             return category;
                        //         }
                        //     }
                        //     return null; // Return null if category is not found
                        // }
                        // function findAndRenameCategoryWithActions(actionmap, categoryName) {
                        //     for (const category of actionmap) {
                        //         if (category.$ && category.$.name === categoryName) {
                        //             const newCategoryName = category.$.name
                        //             const renamedActions = category.action.map(action => {
                        //                 if (action.$) {
                        //                     const newActionName = action.$.name;
                        //                     return {
                        //                         [newActionName]: {
                        //                             rebind: action.rebind
                        //                         }
                        //                     }
                        //                 }
                        //                 return action; 
                        //             });
                        //             return {
                        //                 [newCategoryName]: renamedActions
                        //             }
                        //         }
                        //     }
                        //     return null
                        // }
                        // const categories = listCategories(actionmap)
                        //!Individual Category Name
                        // const category = "spaceship_general"
                        // const getCat = Object.values(findCategory(actionmap,category))[0].name

                        // categories.forEach(category => {
                        //     const thisCategory = findAndRenameCategoryWithActions(actionmap,category)
                        //     // console.log(thisCategory)
                        // })
                        //!###### not used ##############
                    }
                }
                else {
                    logs_error("discoveredKeybinds & actionmaps exists. They are supposed to be deleted. keybinds-detection.js")
                }
            }
            catch (error) {
                logs_error("[ERROR]".red,error.stack)
            }
        },
        blastToLogger: function(package) {
            let logs = viewerLogs.get('log')
    
            if (!Array.isArray(logs)) {
            logs = []
            }
    
            logs.push(package?.message ?? package)
            viewerLogs.set('log', logs)
        },
        blastToUI: function (package) {
            if (!client) {
                console.log('no client')
                return
            }
            client.webContents.send(package.receiver, package)
            let logs = viewerLogs.get('log')
    
            if (!Array.isArray(logs)) {
            logs = []
            }
    
            logs.push(package?.message ?? package)
            viewerLogs.set('log', logs)
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
    logs_error(e,e.name)
}