const {logs,logs_error} = require('./utils/logConfig')

if (logs) { main(); }
function main() {
  try {
    const { dialog, nativeTheme, webContents, app, BrowserWindow, ipcMain, Menu } = require('electron')
    const Store = require('electron-store');
    const path = require('path')
    const fs = require('fs')
    
    const colors = require('colors')
    const { windowPosition } = require('./utils/utilities')
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
        "win": 1,
        "appStatus": "clean"
      })
    }

    function loadBrains() {
        // Contains all ipcRenderer event listeners that must perform a PC related action.
        // Brains Directory: Loop through all files and load them.
        let brainsDirectory = null;
        if (app.isPackaged) {
            brainsDirectory = path.join(process.cwd(),'resources','app','brain')
        }
        else {
            brainsDirectory = path.join(process.cwd(),'brain')
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

    logs("=FLIGHT CONTROL VIEWER= START".green,"isPackaged:".yellow,`${JSON.stringify(app.isPackaged,null,2)}`.cyan, "Version:".yellow,`${JSON.stringify(app.getVersion(),null,2)}`.cyan);
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
          frame: false,
          alwaysOnTop: electronWindowIds.get('mainStayOnTop'), // Make the loading screen always on top
        })

        loadingScreen.loadFile(path.join(__dirname, './renderers/dashboard/dashboard.html'))

        loadingScreen.on("ready-to-show", () => {
          const windowPositionz = windowPosition(win,1)
          loadingScreen.setPosition(windowPositionz.moveTo[0],windowPositionz.moveTo[1])
          loadingScreen.setSize(windowPositionz.resizeTo[0],windowPositionz.resizeTo[1])
          loadingScreen.show()
          if (!isNotDev) { loadingScreen.webContents.openDevTools(); }
          
          appStartTime = Date.now()
          loadBrains()
          Menu.setApplicationMenu(mainMenu);
          createWindow();

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
              
            win.webContents.on("context-menu", () => {
                rightClickMenu.popup(win.webContents);
            })
            win.loadFile(path.join(__dirname, './renderers/dashboard/dashboard.html'));
            win.on("ready-to-show", () => {

              win.setTitle(`Elite Pilots Lounge - ${app.getVersion()}`)
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
                  // autoUpdaterStuff()
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
      logs("=FLIGHT CONTROL VIEWER= CLOSED".red,"isPackaged:".yellow,`${JSON.stringify(app.isPackaged,null,2)}`.cyan, "Version:".yellow,`${JSON.stringify(app.getVersion(),null,2)}`.cyan);
      // logs(`App Quit`.red)
      if (process.platform !== 'darwin') app.quit()
      return
    })
    process.on('uncaughtException', (error,origin) => {
      logs_error(error,origin)
      //  logs('ReferenceError occurred:'.red, error.stack);
    })
    .on('unhandledRejection', (error, origin) => {
        logs_error(error,origin)
    })
    .on('TypeError', (error,origin) => {
        logs_error(error,origin)
        // logs(error)
    })
    .on('ReferenceError', (error,origin) => {
      logs_error(error,origin)
        // logs(error)
    })
    .on('warning', (warning) => {
      logs_error(warning.stack,warning.name)
      // logs('ReferenceError occurred:'.red, warning.stack);
    })
    .on('ERR_INVALID_ARG_TYPE', (error,origin) => {
        logs_error(error,origin)
        // logs(error)
    })
    //todo need to add unhandledPromises error handling.
    //The logs_errors functions sometimes dont capture errors that are the resultant of another function on a different page.
  }
  catch(e) {
      logs_error("MAIN PROCESS ERROR".yellow,e.stack)
  }
}