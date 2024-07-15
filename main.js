const {logs,logs_error} = require('./utils/logConfig')
const { errorHandler} = require('./utils/errorHandlers')
// require('./systems')
// updatePreviousMaxLines([1,2])

if (logs) { main(); }
function main() {
  try {
    const { dialog, nativeTheme, webContents, app, BrowserWindow, ipcMain, Menu } = require('electron')
    const Store = require('electron-store');
    const path = require('path')
    const fs = require('fs')
    
    const colors = require('colors')
    const { wingData, windowPosition,requestCmdr } = require('./utils/loungeClientStore')
    const theCommander = requestCmdr().commander
    const electronWindowIds = new Store({ name: "electronWindowIds" });
    electronWindowIds.set('currentPage','test');
    electronWindowIds.set('socketServerStatus','Not Connected to Server');
    electronWindowIds.set('appVersion',app.getVersion());
    electronWindowIds.set('socketRooms',{})
    electronWindowIds.set('mainStayOnTop',false);
    if (app.isPackaged) { electronWindowIds.set('specifyDev',0); }
    else { electronWindowIds.set('specifyDev',1) }
    if (!electronWindowIds.get('electronWindowIds')) {
      electronWindowIds.set('electronWindowIds',{
        "loadingScreen": 1,
        "win": 2,
        "appStatus": "clean"
      })
    }
    // setTimeout(() => {
    //   logs("procecss detection script")
    // },2000)
    function loadBrains() {
        // Contains all ipcRenderer event listeners that must perform a PC related action.
        // Brains Directory: Loop through all files and load them.
        let brainsDirectory = null;
        if (app.isPackaged) {
            brainsDirectory = path.join(process.cwd(),'resources','app','events-brain')
        }
        else {
            brainsDirectory = path.join(process.cwd(),'events-brain')
        }
        fs.readdir(brainsDirectory, (err, files) => {
            if (err) {
                logs(err)
                return;
            }
            files.forEach((file,index) => {
                index++
                const filePath = path.join(brainsDirectory, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) {
                        logs(err)
                    return;
                    }
                    if (stats.isFile()) {
                        logs('[BRAIN]'.bgCyan,"File:", `${file}`.magenta);
                        try {  require(filePath) }
                        catch(e) { console.log(e); }
                    if (files.length == index) { 
                        // const loadTime = (Date.now() - appStartTime) / 1000;
                        // if (watcherConsoleDisplay("globalLogs")) { logs("App-Initialization-Timer".bgMagenta,loadTime,"Seconds") }
                    }
                    } else if (stats.isDirectory()) {
                        logs(`Directory: ${file}`);
                    }
                });
            });
        });
    }
    async function autoUpdaterStuff() {
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
          // if (!info) { 
          //   win.setTitle(`Elite Pilots Lounge - ${JSON.stringify(app.getVersion())} Checking for Updates "NONE"`)
          // }
          // else {
          //   win.setTitle(`Elite Pilots Lounge - ${JSON.stringify(app.getVersion())} Checking for Updates ${info}`)
          // }
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
    logs("=ELITE PILOTS LOUNGE= START".green,"isPackaged:".yellow,`${JSON.stringify(app.isPackaged,null,2)}`.cyan, "Version:".yellow,`${JSON.stringify(app.getVersion(),null,2)}`.cyan);
    const { autoUpdater } = require('electron-updater')
    const { mainMenu,rightClickMenu } = require('./menumaker')
    nativeTheme.themeSource = 'dark'
    
    //! Dev mode declaration
    const isNotDev = app.isPackaged

    //! Begin creating the electron window
    let appStartTime = null;

    //! Start splash screen
    let win
    let loadingScreen = null
    
    app.on('ready', () => { createLoadingScreen(); });
    function createLoadingScreen() {
        // Create a loading screen window
        loadingScreen = new BrowserWindow({
          width: 0,
          height: 0,
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            nodeIntegrationInWorker: true,
            contextIsolation: true,
          },
          show: false,
          frame: false, // Remove window frame
          alwaysOnTop: electronWindowIds.get('mainStayOnTop'), // Make the loading screen always on top
          // Additional options
        });
      
        // Load your loading screen HTML file
        loadingScreen.loadFile('loading.html');
        // Wait for the main window to be ready
        
        app.whenReady().then(() => {
        })
        loadingScreen.on("ready-to-show", () => {
          const windowPositionz = windowPosition(win,1)
          loadingScreen.setPosition(windowPositionz.moveTo[0],windowPositionz.moveTo[1])
          loadingScreen.setSize(windowPositionz.resizeTo[0],windowPositionz.resizeTo[1])
          loadingScreen.show()
          if (!isNotDev) { loadingScreen.webContents.openDevTools(); }
          
          appStartTime = Date.now()
          loadBrains()
          require('./fromRenderer')
          require('./utils/processDetection')
          let displayMessages = [
            {launcherWait: 'Please launch Elite: Dangerous',class:'w3-vivid-yellow'},
            {allEventsInCurrentLogFile: 'Started to read Journal...',class:'font-BLOCKY-green'},
            {journalInProgress: 'Loading Events...',class:''},
            {journalCompleted: 'Loading Events... Completed',class:'w3-large font-BLOCKY-green'},
            {journalPercent:'',class:''}, //DONT CHANGE THIS INDEX
          ]
          let percentShown = 0;
          function giveItemMSG(action) {  return displayMessages.find(item => action in item); }
          loadingScreen.webContents.send('displayMessage',giveItemMSG('launcherWait'))
          ipcMain.on('eliteProcess', (receivedData) => {
            if (receivedData && loadingScreen) { 
              const {allEventsInCurrentLogFile} = require('./sockets/taskManager')
              allEventsInCurrentLogFile((callback)=>{
                if (callback == 'starting-allEventsInCurrentLogFile') { loadingScreen.webContents.send('displayMessage',giveItemMSG('allEventsInCurrentLogFile')) }
                if (callback.current == 1) { loadingScreen.webContents.send('displayMessage',giveItemMSG('journalInProgress')) }
                if (callback.percent == '25%' && percentShown == 0) { logs('[EH]'.green,"LatestLogsRead:".yellow, "25%".cyan); percentShown = 1; }
                if (callback.percent == '50%' && percentShown == 1) { logs('[EH]'.green,"LatestLogsRead:".yellow, "50%".cyan); percentShown = 0; }
                if (callback.percent == '75%' && percentShown == 0) { logs('[EH]'.green,"LatestLogsRead:".yellow, "75%".cyan); percentShown = 1; }
                if (callback.percent == '100%' && percentShown == 0) { logs('[EH]'.green,"LatestLogsRead:".yellow, "100%".cyan); percentShown = 1; }
                if (typeof callback == 'object') {
                  const data = `Loading Events... ${callback.current} of ${callback.total} ${callback.percent} events`
                  displayMessages[4].journalPercent = data
                  loadingScreen.webContents.send("displayMessage", displayMessages[4]);
                }
                if (callback == 'journalLoadComplete') {
                  loadingScreen.webContents.send("displayMessage", giveItemMSG('journalCompleted'));
                  const watcher = require('./utils/watcher')
                  watcher.tailFile(watcher.savedGameP)
                  Menu.setApplicationMenu(mainMenu);
                  createWindow();
                }
              })
            }
            // else {
            //   logs_error('[PD]'.yellow,"GameStatus??".green,"Elite Not Running")
            // }
          })
        })
    }
    const createWindow = () => {
        try {
            win = new BrowserWindow({
                title: `Elite Pilots Lounge`,
                width: !isNotDev ? 1000 : 500,
                height: 800,
                webPreferences: {
                    preload: path.join(__dirname, 'preload.js'),
                    nodeIntegration: false,
                    nodeIntegrationInWorker: true,
                    contextIsolation: true,
                },
                show: false,
                alwaysOnTop: electronWindowIds.get('mainStayOnTop'),
              })
              // const derp = app.isPackaged
              // win.webContents.executeJavaScript(`window.isPackaged = ${derp}`)
              
                  // !For navigation stuff when coded
                  // frame: false,
                  // transparent: true,
                  // icon: <path-to-icon-file>
            
            win.webContents.on("context-menu", () => {
                rightClickMenu.popup(win.webContents);
            })
            win.loadFile(path.join(__dirname, './renderers/test/test.html'));
            win.on("ready-to-show", () => {
              // logs("splash",electronWindowIds.get('electronWindowIds'))
              
              
              win.setTitle(`${theCommander.commander} | Elite Pilots Lounge - ${electronWindowIds.get('socketServerStatus')} - ${app.getVersion()}`)
              
              const windowPositionz = windowPosition(win,1)
              win.setPosition(windowPositionz.moveTo[0],windowPositionz.moveTo[1])
              win.setSize(windowPositionz.resizeTo[0],windowPositionz.resizeTo[1])
              win.show()
              if (!isNotDev) { win.webContents.openDevTools(); }
            })
            // const primaryDisplay = screen.getPrimaryDisplay();
            // logs(primaryDisplay)
            
            win.on('resize', () => { windowPosition(win,0) })
            win.on('moved', () => { windowPosition(win,0); })


            let winids = {}
            let isLoadFinished = false;

            const handleLoadFinish = () => {
              setTimeout(() => {
                  autoUpdaterStuff()
                },5000)
             
              if (!isLoadFinished) {
                isLoadFinished = true;      
                const loadTime = (Date.now() - appStartTime) / 1000;
                logs("App-Initialization-Timer".bgMagenta,`${loadTime} Seconds`.cyan)       
                if (loadingScreen.id != null) {
                  winids['loadingScreen'] = loadingScreen.id
                  winids['win'] = win.id
                  winids['appStatus'] = 'clean'
                  electronWindowIds.set('electronWindowIds',winids)
                  // logs("splash",electronWindowIds.get('electronWindowIds'))
                  // setTimeout(() => {
                  // },2000)
                  loadingScreen.close();
                  loadingScreen = null
                  
                }
                else {
                  winids['win'] = win.id
                  winids['appStatus'] = 'clean'
                  electronWindowIds.set('electronWindowIds',winids)
                  // logs("nosplash",electronWindowIds.get('electronWindowIds'))
                }
              }
            };
            
            const cwd = app.isPackaged ? path.join(process.cwd(),'resources','app') : process.cwd()
            win.webContents.on('did-finish-load',handleLoadFinish)
            module.exports = { win, cwd };
        }
        catch(e) {
            logs("failed to load load window",e)
            return;
        }
    }
    app.on('window-all-closed', () =>{
      logs("=ELITE PILOTS LOUNGE= CLOSED".red,"isPackaged:".yellow,`${JSON.stringify(app.isPackaged,null,2)}`.cyan, "Version:".yellow,`${JSON.stringify(app.getVersion(),null,2)}`.cyan);
      // watcher.wat.watcher.close()
      const roomCache = {
        Inviter: 0,
        Others: [],
        Rooms: [],
        leave: 1
      }
      wingData(roomCache,0)
      // logs(`App Quit`.red)
      if (process.platform !== 'darwin') app.quit()
      return
    })
    process.on('uncaughtException', (error,origin) => {
      errorHandler(error,origin)
      //  logs('ReferenceError occurred:'.red, error.stack);
    })
    .on('unhandledRejection', (error, origin) => {
        errorHandler(error,origin)
    })
    .on('TypeError', (error,origin) => {
        errorHandler(error,origin)
        // logs(error)
    })
    .on('ReferenceError', (error,origin) => {
      errorHandler(error,origin)
        // logs(error)
    })
    .on('warning', (warning) => {
      errorHandler(warning.stack,warning.name)
      // logs('ReferenceError occurred:'.red, warning.stack);
    })
    .on('ERR_INVALID_ARG_TYPE', (error,origin) => {
        errorHandler(error,origin)
        // logs(error)
    })
    
    //todo need to add unhandledPromises error handling.
    //The errorHandlers functions sometimes dont capture errors that are the resultant of another function on a different page.
  }
  catch(e) {
      logs_error("MAIN PROCESS ERROR".yellow,e.stack)
  }
}