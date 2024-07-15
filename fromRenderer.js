const {webContents, clipboard, screen, app, BrowserWindow, ipcMain, Menu } = require('electron')
const Store = require('electron-store');
const store = new Store({ name: 'electronWindowIds'})
const thisWindow = store.get('electronWindowIds')
const {logs,logs_error} = require('./utils/logConfig') //for browser opening
const zlib = require('zlib')
const base64 = require('base64-url')
const path = require('path')
const fs = require('fs')
const {watcherConsoleDisplay,errorHandler,pageData,logF} = require('./utils/errorHandlers')
const {latestLogRead,latestLog,savedGameLocation,requestCmdr} = require('./utils/loungeClientStore')
const theCommander = requestCmdr().commander
const taskManager = require('./sockets/taskManager')
let redisValidatorMsg = null;
function redisValidator(redisRequestObject) {
  const directory = {
    "from": {
      isEmpty: false,
      isString: true,
      isObject: false,
      isNumber: false,
      numberInString: false
    },
    "description": {
      isEmpty: false,
      isString: true,
      isObject: false,
      isNumber: false,
      numberInString: false
    },
    "type": {
      isEmpty: false,
      isString: true,
      isObject: false,
      isNumber: false,
      numberInString: false
    },
    "method": {
      isEmpty: false,
      isString: true,
      isObject: false,
      isNumber: false,
      numberInString: false
    },
    "data": {
      isEmpty: false,
      isString: false,
      isObject: true,
      isNumber: false,
      numberInString: false
    },
    "keys": {
      isEmpty: false,
      isString: false,
      isObject: true,
      isNumber: false,
      numberInString: false
    },
  }
  let failures = []
  redisValidatorMsg = failures
  for (const key of Object.keys(directory)) {
    if (!(key in redisRequestObject)) {
      failures.push(`MISSING: ${key}`);
    }
    else {
      let value = redisRequestObject[key];
      const regex = /\d/;
      if (typeof value === 'string') { value = value.replace(/\s/g, ''); }
      // logs(`${key}`.cyan, Object.keys(value).length, typeof value);
      const summary = {
        isEmpty: Object.keys(value).length === 0,
        isString: typeof value === 'string',
        isObject: typeof value === 'object',
        isNumber: typeof value === 'number',
        numberInString: regex.test(value),
      };
      const directoryEntry = directory[key];
      for (const [k, v] of Object.entries(summary)) {
        if (v !== directoryEntry[k]) {
          failures.push(`${key}.${k}`)
        }
      }
    }
  }
  if (failures.length) {
    return false
  }
  else {
    return true;
  }
  
}
//! This file is for general comms FROM the renderer process. Allowing button interactions and ect with the computer.
ipcMain.on('launchEDSY', (event, message) => {
  if (watcherConsoleDisplay('globalIPC')) {
      logs("[IPC]".bgMagenta, "LAUNCH EDSY LOADOUT");
  }
  logs("[IPC]".bgMagenta, message);
  const loadoutString = JSON.stringify(message)
  const gzippedData = zlib.gzipSync(loadoutString)
  const encodedData = base64.fromByteArray(gzippedData)
  const url = `https://edsy.org/#/I=${encodedData}`
  require('electron').shell.openExternal(url)
});
ipcMain.on('fetchLatestLog', (event,message) => {
  //ipcRenderer.send('launchEDSY',LoadoutData);
  const readEventsList = latestLogRead(latestLog(savedGameLocation().savedGamePath,"log"),["All"])
  const client = BrowserWindow.fromId(thisWindow.win);
  client.webContents.send('buildLogsDisplay', readEventsList.firstLoad);
})
ipcMain.on('pushAutoUpdate', (event,message) => {
  const { autoUpdater } = require('electron-updater')
  autoUpdater.logger = require('electron-log')
  autoUpdater.checkForUpdatesAndNotify();
  autoUpdater.on('download-progress', (progressObj) => {
    const thisPercent = progressObj.percent / 100
    const formattedNumber = (thisPercent).toLocaleString(undefined, { style: 'percent', minimumFractionDigits:1});
    thisWindow.setTitle(`${theCommander.commander} | Elite Pilots Lounge - ${JSON.stringify(app.getVersion())} Downloading New Update ${formattedNumber}`)
  })
  autoUpdater.on('error',(error)=>{
  })
  autoUpdater.on('checking-for-update', (info)=>{
    // if (!info) { 
    //   thisWindow.setTitle(`Elite Pilots Lounge - ${JSON.stringify(app.getVersion())} Checking for Updates "NONE"`)
    // }
    // else {
    //   thisWindow.setTitle(`Elite Pilots Lounge - ${JSON.stringify(app.getVersion())} Checking for Updates ${info}`)
    // }
  })
  autoUpdater.on('update-available',(info)=>{
    thisWindow.setTitle(`${theCommander.commander} | Elite Pilots Lounge - ${JSON.stringify(app.getVersion())} - ${JSON.stringify(info.version)} Update Available, download pending... please wait...`)
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
        autoUpdater.quitAndInstall();
      }
    });
  })
  // const client = BrowserWindow.fromId(thisWindow.win);
  // client.webContents.send('buildLogsDisplay', readEventsList.firstLoad);
})
ipcMain.on('RedisData',(event,message)=> { //Implements a validator.
  if (watcherConsoleDisplay('globalIPC')) { logs("[IPC]".bgMagenta,"RETRIEVE: ",message.description); }
  // logs("[IPC]".bgMagenta,"RETRIEVE",message.description);
    if (redisValidator(message)) {
        taskManager.eventDataStore(message, (response) => {
          // logs(Object.values(response)[0].redisQueryResult);
          const client = BrowserWindow.fromId(thisWindow.win);
          client.webContents.send(`${message.from}`, response);
      })
    }
    else {
      logs("[REDIS Structure Validator]".bgRed,redisValidatorMsg)
    }
})
ipcMain.on('RedisData-SampleSystems',(event,message)=> { //No validator needed for this small task.
  if (watcherConsoleDisplay('globalIPC')) { logs("[IPC]".bgMagenta,"RETRIEVE: ",message.description); }
  taskManager.eventDataStore(message, (response) => {
    // console.log(response)
    // logs(Object.values(response)[0].redisResult);
    const client = BrowserWindow.fromId(thisWindow.win);
    client.webContents.send(`${message.from}`, response);
  })
});
ipcMain.on('joinSamplingRoom', (event,message) => {
  taskManager.socket_joinRoom(message)
})
ipcMain.on('leaveSamplingRoom', (event,message) => {
  taskManager.socket_leaveRoom(message)
})
ipcMain.on('logs', (event,message) => { 
  logs_error("[RENDERER]".bgMagenta,logF(message));
})