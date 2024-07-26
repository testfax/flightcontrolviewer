const {Menu, BrowserWindow, ipcMain} = require('electron')
const {logs,logs_error, logs_debug} = require('./utils/logConfig')
const { autoUpdater, cwd } = require('./utils/utilities')
const Store = require('electron-store');
const store = new Store({ name: 'electronWindowIds'})
const path = require('path')
const fs = require('fs')
const links = {
    dashboard: async function() {
        store.set('currentPage','dashboard')
        ipcMain.emit('changePage','change')
        BrowserWindow.fromId(1).loadURL(`file://${path.join(cwd, 'renderers/dashboard/dashboard.html')}`)
    },
    getbuffer: async function() {
        store.set('currentPage','getbuffer')
        ipcMain.emit('changePage','change')
        BrowserWindow.fromId(1).loadURL(`file://${path.join(cwd, 'renderers/getbuffer/getbuffer.html')}`)
    },
    checkForUpdates: async function() {
        try {
            // ipcMain.emit('changePage','change')
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
        label: 'Dashboard',
        // click: ()=>{links.statistics();} 
        click: ()=>{links.dashboard()}
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
        label: 'Get Buffer',
        // click: ()=>{links.statistics();} 
        click: ()=>{links.getbuffer()}
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