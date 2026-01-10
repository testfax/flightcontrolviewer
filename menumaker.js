const {Menu, BrowserWindow, ipcMain, app } = require('electron')
const {logs, logs_error, logs_debug} = require('./utils/logConfig')
const { autoUpdater, cwd } = require('./utils/utilities')
const Store = require('electron-store').default
const store = new Store({ name: 'electronWindowIds'})
const path = require('path')
const fs = require('fs')
const links = {
    clearLocalData: async function() {
        logs("[APP]".bgMagenta, "Clearing Local User Data")
        const filesToDelete = [
            'actionmapsJSON.json',
            'deviceInfo.json',
            'electronWindowIds.json',
            'viewerLogs.json'
        ]
        //todo change to setup page
        deleteAppJsonFiles(filesToDelete)
        function deleteAppJsonFiles(filesToDelete) {
            const userDataPath = app.getPath('userData')
           
            for (const file of filesToDelete) {
                const fullPath = path.join(userDataPath, file)
                try {
                    if (fs.existsSync(fullPath)) {
                        fs.rmSync(fullPath, { recursive: true, force: true })
                        logs_debug("[APP]".bgMagenta,`Deleted Local JSON files: ${fullPath}`.green)
                    }
                } 
                catch (err) {
                    logs_error("[APP]".bgMagenta,`Failed to delete Local JSON files: ${fullPath}`, err)
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
                // ultimate fallback if something still keeps the loop alive
                setTimeout(() => process.exit(0), 150)
            })

        }
    },
    setup: async function() {
        const filesToDelete = [
            'deviceInfo.json',
            'viewerLogs.json',
        ]
        deleteAppJsonFiles(filesToDelete)
        function deleteAppJsonFiles(filesToDelete) {
            const userDataPath = app.getPath('userData')
           
            for (const file of filesToDelete) {
                const fullPath = path.join(userDataPath, file)
                try {
                    if (fs.existsSync(fullPath)) {
                        fs.rmSync(fullPath, { recursive: true, force: true })
                        logs_debug("[APP]".bgMagenta,`Deleted Local JSON files: ${fullPath}`.green)
                    }
                } 
                catch (err) {
                    logs_error("[APP]".bgMagenta,`Failed to delete Local JSON files: ${fullPath}`, err)
                }
            }
            // if (app.isPackaged) restartApp()
        }
        function restartApp() {
            app.relaunch({ args: process.argv.slice(1), execPath: process.execPath })
            for (const w of BrowserWindow.getAllWindows()) {
                try { w.destroy() } catch {}
            }
            setImmediate(() => {
                try { app.exit(0) } catch {}
                // ultimate fallback if something still keeps the loop alive
                setTimeout(() => process.exit(0), 150)
            })

        }
        store.set('currentPage','setup')
        ipcMain.emit('setupPage','change')
        BrowserWindow.fromId(1).loadURL(`file://${path.join(cwd, 'renderers/setup/setup.html')}`)
    },
    joyview: async function() {
        store.set('currentPage','joyview')
        ipcMain.emit('changePage','change')
        BrowserWindow.fromId(1).loadURL(`file://${path.join(cwd, 'renderers/joyview/joyview.html')}`)
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
    {
        label: 'Setup',
        click: ()=>{links.setup();} 
    },
    
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
        label: 'Joystick Viewer',
        // click: ()=>{links.statistics();} 
        click: ()=>{links.joyview()}
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
            {
                label: 'Clear Local Data',
                click: ()=>{links.clearLocalData()}
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