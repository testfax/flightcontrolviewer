const { Menu, BrowserWindow, ipcMain, app } = require('electron')
const { logs, logs_error, logs_debug } = require('./utils/logConfig')
const { autoUpdater, cwd } = require('./utils/utilities')
const Store = require('electron-store').default
const store = new Store({ name: 'electronWindowIds' })
const path = require('path')
const fs = require('fs')

const menuState = {
  logsEnabled: false
}

const links = {
  clearLocalData: async function () {
    logs("[APP]".bgMagenta, "Clearing Local User Data")
    const filesToDelete = [
      'actionmapsJSON.json',
      'deviceInfo.json',
      'electronWindowIds.json',
      'viewerLogs.json',
      'layoutIndex.json'
    ]
    deleteAppJsonFiles(filesToDelete)
    function deleteAppJsonFiles(filesToDelete) {
      const userDataPath = app.getPath('userData')

      for (const file of filesToDelete) {
        const fullPath = path.join(userDataPath, file)
        try {
          if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true, force: true })
            logs_debug("[APP]".bgMagenta, `Deleted Local JSON files: ${fullPath}`.green)
          }
        } catch (err) {
          logs_error("[APP]".bgMagenta, `Failed to delete Local JSON files: ${fullPath}`, err)
        }
      }

      if (app.isPackaged) restartApp()
    }
    function restartApp() {
      app.relaunch({ args: process.argv.slice(1), execPath: process.execPath })
      for (const w of BrowserWindow.getAllWindows()) {
        try { w.destroy() } catch {}
      }
      setImmediate(() => {
        try { app.exit(0) } catch {}
        setTimeout(() => process.exit(0), 150)
      })
    }
  },

  logs: async function () {
    const filesToDelete = [
    //   'deviceInfo.json',
      'viewerLogs.json'
    ]
    deleteAppJsonFiles(filesToDelete)
    function deleteAppJsonFiles(filesToDelete) {
      const userDataPath = app.getPath('userData')

      for (const file of filesToDelete) {
        const fullPath = path.join(userDataPath, file)
        try {
          if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true, force: true })
            logs_debug("[APP]".bgMagenta, `Deleted Local JSON files: ${fullPath}`.green)
          }
        } catch (err) {
          logs_error("[APP]".bgMagenta, `Failed to delete Local JSON files: ${fullPath}`, err)
        }
      }
    }

    store.set('currentPage', 'setup')
    ipcMain.emit('setupPage', 'change')
    const win = BrowserWindow.fromId(1)
    if (win) win.loadURL(`file://${path.join(cwd, 'renderers/setup/setup.html')}`)
  },

  joyview: async function () {
    store.set('currentPage', 'joyview')
    ipcMain.emit('changePage', 'change')
    const win = BrowserWindow.fromId(1)
    if (win) win.loadURL(`file://${path.join(cwd, 'renderers/joyview/joyview.html')}`)
  },

  checkForUpdates: async function () {
    try {
      autoUpdater()
    } catch (e) {
      logs_error(e)
    }
  }
}

function buildMainMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Logs',
          id: 'menu_logs_open',
          enabled: menuState.logsEnabled,
          click: () => { links.logs() }
        },
        { type: 'separator' },
        {
          label: 'Clear Local Data',
          click: () => { links.clearLocalData() }
        }
      ]
    },
    {
      label: 'Joystick Viewer',
      click: () => { links.joyview() }
    },
    {
      label: 'About',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => { links.checkForUpdates() }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  module.exports.mainMenu = menu
  return menu
}

function buildRightClickMenu() {
  const contextTemplate = [
    { label: 'Test' }
  ]
  const menu = Menu.buildFromTemplate(contextTemplate)
  module.exports.rightClickMenu = menu
  return menu
}

function setLogsMenuEnabled(enabled) {
  menuState.logsEnabled = !!enabled
  buildMainMenu()
}

ipcMain.on('menumaker-logs-enabled', (evt, enabled) => {
  setLogsMenuEnabled(enabled)
})

buildMainMenu()
buildRightClickMenu()

module.exports.setLogsMenuEnabled = setLogsMenuEnabled
