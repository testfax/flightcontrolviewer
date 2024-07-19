const { logs, logs_error } = require('../utils/logConfig')
try {
    const { convertXML,client_path } = require('../utils/utilities')

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
}
catch (error) {
    logs_error("[ERROR]".red,error,error.name)
}