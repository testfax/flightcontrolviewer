const {app} = require('electron')
const {logs,logs_error} = require('./logConfig')
const {watcherConsoleDisplay,errorHandler,logF} = require('./errorHandlers')
const {requestCmdr} = require('./loungeClientStore')
const theCommander = requestCmdr().commander
const Store = require('electron-store');
const store = new Store({ name: 'electronWindowIds'})
const win = store.get('electronWindowIds')
const { autoUpdater } = require('electron-updater')

const updater = {
    autoUpdater: async () => {
        // Auto Updater
        if (app.isPackaged) { 
            logs("Running Auto-Updater Functions".yellow)
            autoUpdater.logger = require('electron-log')
            autoUpdater.checkForUpdatesAndNotify();

            // autoUpdater.logger.transports.file.level = 'info';
            // autoUpdater.autoDownload = true
            // autoUpdater.autoInstallOnAppQuit = true
            autoUpdater.on('download-progress', (progressObj) => {
            const thisPercent = progressObj.percent / 100
            const formattedNumber = (thisPercent).toLocaleString(undefined, { style: 'percent', minimumFractionDigits:1});
            win.setTitle(`${theCommander.commander} | Elite Pilots Lounge - ${JSON.stringify(app.getVersion())} Downloading New Update ${formattedNumber}`)
            })
            autoUpdater.on('error',(error)=>{
            })
            autoUpdater.on('checking-for-update', (info)=>{
            if (!info) { 
              win.setTitle(`${theCommander.commander} | Elite Pilots Lounge - ${JSON.stringify(app.getVersion())} Checking for Updates "NONE"`)
            }
            else {
              win.setTitle(`${theCommander.commander} | Elite Pilots Lounge - ${JSON.stringify(app.getVersion())} Checking for Updates ${info}`)
            }
            })
            autoUpdater.on('update-available',(info)=>{
            win.setTitle(`${theCommander.commander} | Elite Pilots Lounge - ${JSON.stringify(app.getVersion())} - ${JSON.stringify(info.version)} Update Available, download pending... please wait...`)
            })
            autoUpdater.on('update-not-available',(info)=>{
            // logs(`-AU update-not-available: ${JSON.stringify(info)}`)
            })
            autoUpdater.on('update-downloaded',(info)=>{
            dialog.showMessageBox({
                type: 'info',
                title: 'Update Available',
                message: 'A new version of the app is available. App will now automatically install and restart once completed.',
                buttons: ['Continue']
            }).then((result) => {
                if (result.response === 0) {
                // User chose to install now, quit the app and install the update.
                // const appDataFolderPath = path.join(process.env.APPDATA, 'elitepilotslounge');
                // //Removes the roaming folder for a clean install.
                // //Have seen users not be able to load the program, due to corrupted roaming/elitepilotslounge.
                // if (fs.existsSync(appDataFolderPath)) {
                //   console.log(appDataFolderPath)
                //   fs.rmdirSync(appDataFolderPath, { recursive: true });
                // }
                autoUpdater.quitAndInstall();
                }
            });
            })
        }
    }
}

module.exports = updater