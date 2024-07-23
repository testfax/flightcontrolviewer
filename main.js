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
    electronWindowIds.set('currentPage','dashboard');
    if (!electronWindowIds.get('theme')) {
      electronWindowIds.set('theme','dark')
    }
    electronWindowIds.set('appVersion',app.getVersion());
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
    nativeTheme.themeSource = electronWindowIds.get('theme')
    
    const isNotDev = app.isPackaged
    let appStartTime = null
    let win = null
    
    app.on('ready', () => { createwin(); })
    function createwin() {
      try {
        // Create a loading screen window
        win = new BrowserWindow({
          width: !isNotDev ? 1000 : 500,
          height: 800,
          webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            nodeIntegrationInWorker: true,
            contextIsolation: true,
          },
          show: false,
          alwaysOnTop: electronWindowIds.get('mainStayOnTop'), // Make the loading screen always on top
        })
        win.webContents.on("context-menu", () => {
          rightClickMenu.popup(win.webContents)
        })
        win.loadFile(path.join(__dirname, './renderers/dashboard/dashboard.html'))

        win.on("ready-to-show", () => {
          win.setTitle(`Flight Control Viewer - ${app.getVersion()}`)
          const windowPositionz = windowPosition(win,1)
          win.setPosition(windowPositionz.moveTo[0],windowPositionz.moveTo[1])
          win.setSize(windowPositionz.resizeTo[0],windowPositionz.resizeTo[1])
          win.show()
          if (!isNotDev) { win.webContents.openDevTools() }
          
          appStartTime = Date.now()
          loadBrains()
          Menu.setApplicationMenu(mainMenu)
        })
        win.on('resize', () => { windowPosition(win,0) })
        win.on('moved', () => { windowPosition(win,0); })

        let winids = {}
        let isLoadFinished = false;

        const handleLoadFinish = () => {
          setTimeout(() => {
              // autoUpdaterStuff()
            },5000)

          if (!isLoadFinished) {
            isLoadFinished = true
            const loadTime = (Date.now() - appStartTime) / 1000
            logs("App-Initialization-Timer".bgMagenta,`${loadTime} Seconds`.cyan)      
            winids['win'] = win.id
            winids['appStatus'] = 'clean'
            electronWindowIds.set('electronWindowIds',winids)
          }
        }
        const cwd = app.isPackaged ? path.join(process.cwd(),'resources','app') : process.cwd()
        win.webContents.on('did-finish-load',handleLoadFinish)
        module.exports = { win, cwd }
      }
      catch(e) {
        logs("failed to load load window",e)
        return
      }
    }
    
    app.on('window-all-closed', () =>{
      logs("=FLIGHT CONTROL VIEWER= CLOSED".red,"isPackaged:".yellow,`${JSON.stringify(app.isPackaged,null,2)}`.cyan, "Version:".yellow,`${JSON.stringify(app.getVersion(),null,2)}`.cyan);
      // logs(`App Quit`.red)
      if (process.platform !== 'darwin') app.quit()
      return
    })
    process.on('uncaughtException', (error,origin) => {
      logs_error(error,origin,error.stack)
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