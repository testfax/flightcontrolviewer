//!Each time a tab is clicked within the SC options menu, it saves to file OR when Return to Game is clicked.
const { logs, logs_error, logs_debug } = require('../utils/logConfig')
const { keybindLoad } = require('./input-functions')
try {
    keybindLoad()
} 
catch (error) {
    logs_error("[ERROR]".red,error.stack)
}
// try {
//     const { convertXML,client_path } = require('../utils/utilities')
//     const Store = require('electron-store').default
//     const actionmaps = new Store({ name: 'actionmapsJSON'})
//     actionmaps.delete('discoveredKeybinds')
//     actionmaps.delete('actionmaps')
//     console.log("maps deleted.cyan")
//     const chokidar = require('chokidar')
//     const windowItemsStore = new Store({ name: 'electronWindowIds'})
//     const showConsoleMessages = windowItemsStore.get('showConsoleMessages')
    
//     if (!actionmaps.get('discoveredKeybinds') && !actionmaps.get('actionmaps')) {
//         const rsi_actionmapsPath = client_path().rsi_actionmapsPath
//         watcherPath = chokidar.watch(rsi_actionmapsPath, {
//             persistent: true,
//             ignoreInitial: false,
//             ignored: [
//                 `${rsi_actionmapsPath}/attributes.xml`,
//                 `${rsi_actionmapsPath}/HintStatus.xml`,
//                 `${rsi_actionmapsPath}/profile.xml`
//             ]
//         })
//         watcherPath.on('ready', async function() {
//             watcherPath.on('error',error => { logs_error("[DET]".red,error.stack) })
//             watcherPath.on("change", rsi_actionmapsPath => {
//                 evaluateActionmaps()
//                 if (showConsoleMessages) { logs_debug("[DET]".bgYellow,"Detected file change: actionmaps.xml") }
//             })
//         })
//         evaluateActionmaps()
        
//         async function evaluateActionmaps() {
//             const stat = await convertXML(client_path().rsi_actionmaps)
//             if (stat == true) {
//                 const json = actionmaps.get('actionmaps')
//                 const jsonDevices = json.ActionMaps.ActionProfiles[0].options
//                     .filter(device => device.$.type === "joystick" && device.$.hasOwnProperty('Product'))
//                     .map(device => device.$)
//                 const cleanedDevices = jsonDevices.map(device => {
//                     const cleanedProduct = device.Product.replace(/\s*\{.*\}/, '').trim()
//                     return {
//                         ...device,
//                         type: device.type === 'joystick' ? 'js' : device.type,
//                         Product: cleanedProduct
//                     }
//                 })
//                 if (showConsoleMessages) { logs_debug("Detected Devices".yellow,cleanedDevices) }
//                 const actionmap = json.ActionMaps.ActionProfiles[0].actionmap
//                 const deviceMap = cleanedDevices.reduce((map, device) => {
//                     const prefix = `${device.type}${device.instance}_`
//                     map[prefix] = `${device.type}${device.instance}`
//                     return map
//                     }, {})
    
//                 function sortKeybinds(actionmap) {
//                     const buttons = {}
    
//                     actionmap.forEach(category => {
//                         const categoryName = category.$?.name
//                         if (!categoryName) {
//                             logs_error('Category name is missing')
//                             return
//                         }
                
//                         const actions = Array.isArray(category.action) ? category.action : [category.action]
//                         actions.forEach(action => {
//                             if (action.rebind) {
//                                 const rebinds = Array.isArray(action.rebind) ? action.rebind : [action.rebind]
//                                 rebinds.forEach(rebind => {
//                                     const input = rebind.$?.input
//                                     if (typeof input === 'string') {
//                                         const prefix = Object.keys(deviceMap).find(p => input.startsWith(p))
//                                         if (prefix) {
//                                             const newKey = input.replace(prefix, deviceMap[prefix] + '_')
//                                             const parts = newKey.split('_')
//                                             const keyName = parts[0] + (parts[1] ? '_' + parts[1] : '')
//                                             // if (keyName == "js1_x") {
//                                             //     console.log(`Processed key: ${keyName}, Original input: ${input}, Category: ${categoryName}`)
//                                             // }
    
//                                             if (!buttons[keyName]) {
//                                                 buttons[keyName] = []
//                                             }
//                                             const existingCategory = buttons[keyName].find(entry => entry.categoryName === categoryName)
//                                             if (existingCategory) {
//                                                 existingCategory.actions.push(action.$?.name)
//                                             } else {
//                                                 buttons[keyName].push({
//                                                     categoryName: categoryName,
//                                                     actions: [action.$?.name]
//                                                 });
//                                             }
//                                         } else {
//                                             // logs_debug(`No prefix found for input: ${input}`)
//                                         }
//                                     } else {
//                                         // logs_debug(`Invalid input type: ${input}`)
//                                     }
//                                 });
//                             }
//                         });
//                     });
                
//                     // logs_debug("Keys before sorting:", Object.keys(buttons))
                
    
//                     const sortedButtons = {}
//                     Object.keys(buttons)
//                         .sort((a, b) => {
//                             const [aPrefix, aButton] = a.split('_')
//                             const [bPrefix, bButton] = b.split('_')
//                             if (aPrefix !== bPrefix) {
//                                 return aPrefix.localeCompare(bPrefix)
//                             }
//                             const aNum = parseInt(aButton.replace('button', ''), 10) || 0
//                             const bNum = parseInt(bButton.replace('button', ''), 10) || 0
//                             return aNum - bNum
//                         })
//                         .forEach(key => {
//                             sortedButtons[key] = buttons[key]
//                         })
//                     // logs_debug("Keys after sorting:", Object.keys(sortedButtons))
//                     return sortedButtons
//                 }
//                 const sortedKeybinds = sortKeybinds(actionmap)
//                 actionmaps.set('discoveredKeybinds',sortedKeybinds)
//                 if (showConsoleMessages) { logs_debug("[DET]".bgGreen,"Initialized") }
//                 logs("[keybinds-detection]".bgGreen,"Initialized")
//             }










//             //!###### not used ##############
//             // function listCategories(actionmap) {
//             //     return actionmap.map(category => {
//             //         if (category.$ && category.$.name) {
//             //             return category.$.name;
//             //         }
//             //         return null; // Return null if the name is not found
//             //     }).filter(name => name !== null); // Filter out null values
//             // }
//             // function findCategory(actionmap, categoryName) {
//             //     for (const category of actionmap) {
//             //         if (category.$ && category.$.name === categoryName) {
//             //             return category;
//             //         }
//             //     }
//             //     return null; // Return null if category is not found
//             // }
//             // function findAndRenameCategoryWithActions(actionmap, categoryName) {
//             //     for (const category of actionmap) {
//             //         if (category.$ && category.$.name === categoryName) {
//             //             const newCategoryName = category.$.name
//             //             const renamedActions = category.action.map(action => {
//             //                 if (action.$) {
//             //                     const newActionName = action.$.name;
//             //                     return {
//             //                         [newActionName]: {
//             //                             rebind: action.rebind
//             //                         }
//             //                     }
//             //                 }
//             //                 return action; 
//             //             });
//             //             return {
//             //                 [newCategoryName]: renamedActions
//             //             }
//             //         }
//             //     }
//             //     return null
//             // }
//             // const categories = listCategories(actionmap)
//             //!Individual Category Name
//             // const category = "spaceship_general"
//             // const getCat = Object.values(findCategory(actionmap,category))[0].name

//             // categories.forEach(category => {
//             //     const thisCategory = findAndRenameCategoryWithActions(actionmap,category)
//             //     // console.log(thisCategory)
//             // })
//             //!###### not used ##############
//         }
//     }
//     else {
//         logs_error("discoveredKeybinds & actionmaps exists. They are supposed to be deleted. keybinds-detection.js")
//     }
// }
// catch (error) {
//     logs_error("[ERROR]".red,error.stack)
// }