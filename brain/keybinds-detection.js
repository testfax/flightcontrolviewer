const { logs, logs_error } = require('../utils/logConfig')
try {
    const { convertXML,client_path } = require('../utils/utilities')
    const Store = require('electron-store');
    const actionmaps = new Store({ name: 'actionmapsJSON'})
    const chokidar = require('chokidar')
    
    const rsi_actionmapsPath = client_path().rsi_actionmapsPath
    convertXML(client_path().rsi_actionmaps)
    
    watcherPath = chokidar.watch(rsi_actionmapsPath, {
        persistent: true,
        ignoreInitial: false,
        ignored: [
            `${rsi_actionmapsPath}/attributes.xml`,
            `${rsi_actionmapsPath}/HintStatus.xml`,
            `${rsi_actionmapsPath}/profile.xml`
        ],
    })
    watcherPath.on('ready', async function() {
        watcherPath.on('error',error => { logs(error);})
        watcherPath.on("change", rsi_actionmapsPath => {
            convertXML(client_path().rsi_actionmaps)
            console.log("Keybinds:".yellow,"Saved")
        })
    })

    evaluateActionmaps()
    function evaluateActionmaps() {
        const json = actionmaps.get('actionmaps')
        const jsonDevices = json.ActionProfiles.options
            .filter(device => device.$.type === "joystick" && device.$.hasOwnProperty('Product'))    
            .map(device => device.$)
        const cleanedDevices = jsonDevices.map(device => {
            const cleanedProduct = device.Product.replace(/\s*\{.*\}/, '').trim();
            return {
                ...device,
                type: device.type === 'joystick' ? 'js' : device.type,
                Product: cleanedProduct
            }
        })
        // console.log("Detected Devices".yellow,cleanedDevices)
        const actionmap = json.ActionProfiles.actionmap
        const deviceMap = cleanedDevices.reduce((map, device) => {
            const prefix = `${device.type}${device.instance}_`
            map[prefix] = `${device.type}${device.instance}`
            return map;
          }, {})
          
        function sortKeybinds(actionmap) {
            const buttons = {};
            actionmap.forEach(category => {
                const actions = Array.isArray(category.action) ? category.action : []
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
                                    if (!buttons[keyName]) {
                                        buttons[keyName] = []
                                    }
                                    const existingCategory = buttons[keyName].find(entry => entry.categoryName === category.$.name)
                                    if (existingCategory) {
                                        existingCategory.actions.push(action.$.name)
                                    } 
                                    else {
                                        buttons[keyName].push({
                                            categoryName: category.$.name,
                                            actions: [action.$.name]
                                        })
                                    }
                                }
                            }
                        })
                    }
                })
            })
            
            return buttons;
        }
        const sortedKeybinds = sortKeybinds(actionmap)
        actionmaps.set('discoveredKeybinds',sortedKeybinds)










        //!###### not used ##############
        function listCategories(actionmap) {
            return actionmap.map(category => {
                if (category.$ && category.$.name) {
                    return category.$.name;
                }
                return null; // Return null if the name is not found
            }).filter(name => name !== null); // Filter out null values
        }
        function findCategory(actionmap, categoryName) {
            for (const category of actionmap) {
                if (category.$ && category.$.name === categoryName) {
                    return category;
                }
            }
            return null; // Return null if category is not found
        }
        function findAndRenameCategoryWithActions(actionmap, categoryName) {
            for (const category of actionmap) {
                if (category.$ && category.$.name === categoryName) {
                    const newCategoryName = category.$.name
                    const renamedActions = category.action.map(action => {
                        if (action.$) {
                            const newActionName = action.$.name;
                            return {
                                [newActionName]: {
                                    rebind: action.rebind
                                }
                            }
                        }
                        return action; 
                    });
                    return {
                        [newCategoryName]: renamedActions
                    }
                }
            }
            return null
        }
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
catch (error) {
    logs_error("[ERROR]".red,error,error.name)
}