const {pageData} = require('./utils/errorHandlers')
const {Menu, BrowserWindow, ipcMain} = require('electron')
const {logs,logs_error} = require('./utils/logConfig')
const { autoUpdater } = require('./utils/autoUpdate')
const {cwd,latestLogRead,latestLog,savedGameLocation} = require('./utils/loungeClientStore')
const Store = require('electron-store');
const store = new Store({ name: 'electronWindowIds'})
const {socket_leaveRoom} = require('./sockets/taskManager')
const path = require('path')
const fs = require('fs')
function findActiveSocketKey() {
    const rooms = store.get('socketRooms')
    const entry = Object.entries(rooms).find(([key, value]) => value === true);
    if (entry) { 
        const array = entry[0].split("_")
        const roomObj = {brain:array[0],name:array[1],state:array[2]}
        socket_leaveRoom(roomObj)
     }
}
const links = {
    dashboard: async function() {
        BrowserWindow.fromId(2).loadURL(`file://${path.join(cwd, 'renderers/dashboard/dashboard.html')}`)
        pageData.currentPage = "Dashboard"
        store.set('currentPage',pageData.currentPage)
        findActiveSocketKey()
    },
    friends: async function() {
        BrowserWindow.fromId(2).loadURL(`file://${path.join(cwd, 'renderers/friends/friends.html')}`)
        pageData.currentPage = "Friends"
        store.set('currentPage',pageData.currentPage)
        findActiveSocketKey()
    },
    statistics: async function() {
        BrowserWindow.fromId(2).loadURL(`file://${path.join(cwd, 'renderers/statistics/statistics.html')}`)
        pageData.currentPage = "Statistics"
        store.set('currentPage',pageData.currentPage)
        findActiveSocketKey()
    },
    engineerProgress: async function() {
        BrowserWindow.fromId(2).loadURL(`file://${path.join(cwd, 'renderers/engineerProgress/engineerProgress.html')}`)
        pageData.currentPage = "Engineer Progress"
        store.set('currentPage',pageData.currentPage)
        findActiveSocketKey()
    },
    materials: async function() {
        BrowserWindow.fromId(2).loadURL(`file://${path.join(cwd, 'renderers/materials/materials.html')}`)
        pageData.currentPage = "Materials"
        store.set('currentPage',pageData.currentPage)
        findActiveSocketKey()
    }, 
    sampling: async function() {
        // const response = await socket_joinRoom('brain-ThargoidSample')
        // console.log(response)
        // if (response) { 
            BrowserWindow.fromId(2).loadURL(`file://${path.join(cwd, 'renderers/sampling/sample.html')}`)
            pageData.currentPage = "brain-ThargoidSample"
            store.set('currentPage',pageData.currentPage)
        //  }
        //  else { BrowserWindow.fromId(2).setTitle('Elite Pilots Lounge - !!!!!!!Socket Server Failure!!!!!!!') }
    },
    logs: async function() {
        BrowserWindow.fromId(2).loadURL(`file://${path.join(cwd, 'logs/logs.html')}`)
        pageData.currentPage = "Logs"
        store.set('currentPage',pageData.currentPage)
        findActiveSocketKey()
    },
    test: async function() {
        BrowserWindow.fromId(2).loadURL(`file://${path.join(cwd, 'renderers/test/test.html')}`)
        pageData.currentPage = "Test"
        store.set('currentPage',pageData.currentPage)
        findActiveSocketKey()
    },
    toEdsy: async function() {
        try {
            const zlib = require('zlib')
            const base64 = require('base64-url')
            let REL = await latestLogRead(latestLog(savedGameLocation().savedGamePath,"log"),['Loadout'])
            // console.log("TOEDSY:".yellow,REL.reverse[0])
            const message = REL.reverse[0]
            if (message) { 
                const loadoutString = JSON.stringify(message)
                const gzippedData = zlib.gzipSync(loadoutString)
                const encodedData = base64.encode(gzippedData)
                const url = `https://edsy.org/#/I=${encodedData}`
                require('electron').shell.openExternal(url)
                
            }
        }
        catch (e) {
            logs_error(e)
        }
    },
    checkForUpdates: async function() {
        try {
            autoUpdater()
        }
        catch (e) {
            logs_error(e)
        }
    }
}

const template = [
    // {
    //     label: 'Dashboard',
    //     click: ()=>{links.dashboard();} 
    // },
    
    // {
    //     label: 'Friends',
    //     click: ()=>{links.friends();} 
    // },
    // {
    //     label: 'Information',
    //     // click: ()=>{links.statistics();} 
    //     submenu: [
    //         {
    //             label: 'Statistics',
    //             click: ()=>{links.statistics()}
    //         },
    //         {
    //             label: 'Engineer Progress',
    //             click: ()=>{links.engineerProgress()}
    //         }
    //     ]
    // },
    {
        label: 'Thargoid Sampling',
        // click: ()=>{links.statistics();} 
        click: ()=>{links.sampling()}
        // submenu: [
        //     {
        //         label: 'Sampling',
        //         click: ()=>{links.sampling()}
        //     },
        //     // {
        //     //     label: 'Test',
        //     //     click: ()=>{links.test()}
        //     // }
        // ]
    },
    {
        label: 'Materials',
        click: ()=>{links.materials();} 
    },
    {
        label: 'Loadout -> EDSY',
        click: ()=>{links.toEdsy();} 
    },
    {
        label: 'About',
        submenu: [
            {
                label: 'Check for Updates',
                click: ()=>{links.checkForUpdates()}
            },
        ]
    },
    // {
    //     label: 'Logs',
    //     click: ()=>{links.logs()} 
    // },
    // {
    //     label: 'Test',
    //     click: ()=>{links.test()} 
    // }
]
const contextMenu = [
    {
        label: 'Test',
        // click: ()=>{links.test()} 
    }
]

module.exports.mainMenu = Menu.buildFromTemplate(template)
module.exports.rightClickMenu = Menu.buildFromTemplate(contextMenu)