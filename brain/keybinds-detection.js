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
        //Get Detected Devices
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
        console.log("Detected Devices".yellow,cleanedDevices)

    }
}
catch (error) {
    logs_error("[ERROR]".red,error,error.name)
}