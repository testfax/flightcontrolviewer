const {logs,logs_error,logs_debug} = require('./utils/logConfig')

if (logs) { main(); }
function main() {
  try {
    const { dialog, nativeTheme, webContents, app, BrowserWindow, ipcMain, Menu } = require('electron')
    // ✅ If another instance is already running, immediately close this one
    const gotLock = app.requestSingleInstanceLock()

    if (!gotLock) {
      app.exit(0)
    } 
    else {
      // Optional: when someone tries to launch again, focus the existing window
      app.on('second-instance', () => {
        const win = BrowserWindow.getAllWindows()[0]
        if (win) {
          if (win.isMinimized()) win.restore()
          win.show()
          win.focus()
        }
      })
    }
    const Store = require('electron-store').default
    const path = require('path')
    const fs = require('fs')
    
    const colors = require('colors')
    const { devicesObjBuilder, windowPosition, autoUpdater, runWinHidDump, getWinHidDumpPath } = require('./utils/utilities')
    const electronWindowIds = new Store({ name: "electronWindowIds" })
    const deviceInfo = new Store({ name: "deviceInfo" })
    const viewerLogs = new Store({ name: "viewerLogs" })
    const layoutIndex = new Store({ name: "layoutIndex" })

    //! RESETS DEVICES TO DETECT NEW DEVICES
    // deviceInfo.set('devices', {})
    if (!layoutIndex.get('devices')) {
      layoutIndex.set('devices',{})
    }
    devicesObjBuilder()
    if (!viewerLogs.get('log')) {
      viewerLogs.set('log','[]')
    }
    electronWindowIds.set('currentPage','joyview')
    if (!electronWindowIds.get('theme')) {
      electronWindowIds.set('theme','dark')
    }
    if (!electronWindowIds.get('showConsoleMessages')) {
      electronWindowIds.set('showConsoleMessages',0)
    }
    electronWindowIds.set('appVersion',app.getVersion())
    electronWindowIds.set('mainStayOnTop',false)
    if (app.isPackaged) { electronWindowIds.set('specifyDev',0) }
    else { electronWindowIds.set('specifyDev',1) }
    if (!electronWindowIds.get('electronWindowIds')) {
      electronWindowIds.set('electronWindowIds',{
        "win": 1,
        "appStatus": "clean"
      })
    }

    
    function loadBrains() {
      // Files listed here are loaded first, in this exact order.
      // Any other .js files NOT listed here will still be loaded afterward.
      const brainLoadOrder = [
        'input-functions.js',
        'keybinds-detection.js',
        'input-detection.js'
      ]

      let brainsDirectory = null

      if (app.isPackaged) {
        brainsDirectory = path.join(process.cwd(), 'resources', 'app', 'brain')
      } else {
        brainsDirectory = path.join(process.cwd(), 'brain')
      }

      fs.readdir(brainsDirectory, (err, files) => {
        if (err) {
          logs(err)
          return
        }

        // Only .js files
        const allJsFiles = files.filter(file => file.endsWith('.js'))

        // Build the prioritized list (only those that exist in the folder)
        const prioritized = brainLoadOrder.filter(name => allJsFiles.includes(name))

        // Everything else not listed still gets loaded (preserve original order)
        const unlisted = allJsFiles.filter(name => !brainLoadOrder.includes(name))

        // Final load list: prioritized first, then the rest
        const jsFiles = [...prioritized, ...unlisted]

        jsFiles.forEach((file, index) => {
          index++

          const filePath = path.join(brainsDirectory, file)

          fs.stat(filePath, (err, stats) => {
            if (err) {
              logs(err)
              return
            }

            if (!stats.isFile()) return

            logs('[BRAIN]'.bgCyan, 'File:', `${file}`.magenta)

            try {
              require(filePath)
            } catch (e) {
              console.log(e)
            }

            if (jsFiles.length === index) {
              // done loading brains
            }
          })
        })
      })
    }


    logs_debug("=FLIGHT CONTROL VIEWER= START".green,"isPackaged:".yellow,`${JSON.stringify(app.isPackaged,null,2)}`.cyan, "Version:".yellow,`${JSON.stringify(app.getVersion(),null,2)}`.cyan)
    const { mainMenu,rightClickMenu } = require('./menumaker')
    nativeTheme.themeSource = electronWindowIds.get('theme')

    const isNotDev = app.isPackaged
    let appStartTime = null
    let win = null
    app.commandLine.appendSwitch('disable-logging')
    app.commandLine.appendSwitch('log-level', '3') 
    app.on('ready', () => {
      // Run win-hid-dump automatically before creating window
      try {
        const dumpText = runWinHidDump()
        deviceInfo.set('hidDescriptorDump', dumpText)
        deviceInfo.set('hidDescriptorDumpStatus', {
          ok: 1,
          exePath: getWinHidDumpPath(),
          length: dumpText.length,
          time: Date.now()
        })
        logs('[HID]'.bgCyan, 'win-hid-dump OK'.green, `len=${dumpText.length}`.magenta)
      } catch (e) {
        deviceInfo.set('hidDescriptorDump', '')
        deviceInfo.set('hidDescriptorDumpStatus', {
          ok: 0,
          exePath: getWinHidDumpPath(),
          err: String(e && e.message ? e.message : e),
          time: Date.now()
        })
        logs_error('[HID] win-hid-dump FAILED'.red, getWinHidDumpPath(), e && e.stack ? e.stack : e)
      }

      createwin()
    })

    function createwin() {
      try {
        // Create a loading screen window
        win = new BrowserWindow({
          width: !app.isPackaged ? 800 : 800,
          height: 1000,
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
        win.loadFile(path.join(__dirname, './renderers/joyview/joyview.html'))

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
        win.on('moved', () => { windowPosition(win,0) })

        let winids = {}
        let isLoadFinished = false

        const handleLoadFinish = () => {
          setTimeout(() => {
            autoUpdater()
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
        logs_error("failed to load load window",e)
        return
      }
    }


    //Closed app handling and log flushing
    const log = require('electron-log')
    let quitLoggedOnce = false
    async function flushLogs() {
      // give remote transport a moment to run
      await new Promise(r => setTimeout(r, 200))

      // flush file transport if available
      try {
        if (log?.transports?.file?.flush) log.transports.file.flush()
      } catch (e) {}
    }
    app.on('before-quit', async (e) => {
      if (quitLoggedOnce) return
      quitLoggedOnce = true

      // pause shutdown so logs can actually write
      e.preventDefault()

      try {
        await logs_debug("=FLIGHT CONTROL VIEWER= CLOSED".red, "Version:".yellow, app.getVersion())
        await flushLogs()
      } catch (err) {
        // last resort: don't block quitting forever
      }

      // continue shutdown
      app.quit()
    })

    process.on('uncaughtException', (error,origin) => {
      logs_error(error,origin,error.stack)
      //  logs('ReferenceError occurred:'.red, error.stack);
    })
    .on('unhandledRejection', (error, origin) => {
      logs_error(error,origin,error.stack)
      
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
