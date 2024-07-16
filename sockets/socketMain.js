const {app, BrowserWindow} = require('electron')

const {logs} = require('../utils/logConfig')
const {watcherConsoleDisplay,errorHandler} = require('../utils/errorHandlers')
const { Manager } = require('socket.io-client')
const {requestCmdr,wingData} = require('../utils/loungeClientStore')
const theCommander = requestCmdr().commander
const Store = require('electron-store');
const store = new Store({ name: 'electronWindowIds'})
const thargoidSampling_store = new Store({ name: 'brain-ThargoidSample'})
let options = { timeZone: 'America/New_York',year: 'numeric',month: 'numeric',day: 'numeric',hour: 'numeric',minute: 'numeric',second: 'numeric',},myTime = new Intl.DateTimeFormat([], options);
const jwt = require('jsonwebtoken')
try {
    let commander = JSON.stringify(requestCmdr().commander)
    const payload = {
        user: commander.commander,
        userID: commander.FID,
        // logs: updatePreviousMaxLines()
    }
    const secretKey = 'somefatcat'
    const token = jwt.sign(payload, secretKey)
    // if (watcherConsoleDisplay("globalLogs")) { logs("[SOCKET CLIENT]".blue," STATUS:"," OPERATIONAL ".green) }
    const manager = new Manager('https://elitepilotslounge.com/socket.io/', {
        secure: true,
        query: { 'clientpilot': commander, 'type': 'client', 'version':app.getVersion(), token: token},
        path: '/socket.io/',
        upgrade: true,
        rememberUpgrade: true,
        withCredentials: true,
        auth: { token: token }
    })
    //todo Need to add Auth: {} validation when hitting this endpoint. Probably need to include a discord login due to injection of game files.
    const socket = manager.socket("/")
    manager.open((err) => {
        if (err) {
            logs('connect error. error code generated from socketMain.js')
        } else {
            logs("connection succ")
        }
    });
    const sockF = {
        test: function(data) {
            logs("test".yellow,`${data}`.yellow)
            return data
        },
    }

    module.exports = { sockF, socket }
    //#
    //#
    //#
    //#

    //#
    //#
    //#
    //#
    //#
    //#
    //todo Need to code for total Bytes Uploaded/Downloaded through the socket for the lifetime of the App.
    const registeredRooms = [
        "brain-ThargoidSample_Leigong_Controlled",
        "brain-ThargoidSample_Leigong_Alert",
        "brain-ThargoidSample_Leigong_Invasion",
        "brain-ThargoidSample_Indra_Controlled",
        "brain-ThargoidSample_Indra_Alert",
        "brain-ThargoidSample_Indra_Invasion",
        "brain-ThargoidSample_Hadad_Invasion",
        "brain-ThargoidSample_Hadad_Alert",
        "brain-ThargoidSample_Hadad_Invasion",
        "brain-ThargoidSample_Thor_Controlled",
        "brain-ThargoidSample_Thor_Alert",
        "brain-ThargoidSample_Thor_Invasion",
        "brain-ThargoidSample_Cocijo_Controlled",
        "brain-ThargoidSample_Cocijo_Alert",
        "brain-ThargoidSample_Cocijo_Invasion",
        "brain-ThargoidSample_Raijin_Controlled",
        "brain-ThargoidSample_Raijin_Alert",
        "brain-ThargoidSample_Raijin_Invasion",
        "brain-ThargoidSample_Oya_Controlled",
        "brain-ThargoidSample_Oya_Alert",
        "brain-ThargoidSample_Oya_Invasion",
        "brain-ThargoidSample_Taranis_Controlled",
        "brain-ThargoidSample_Taranis_Alert",
        "brain-ThargoidSample_Taranis_Invasion",
    ]
    if (!thargoidSampling_store.get('brain_ThargoidSample')) { thargoidSampling_store.set('brain_ThargoidSample.currentTitanState',"unknown"); } 
    if (!thargoidSampling_store.get('socketRooms')) { thargoidSampling_store.set('socketRooms',{}); } 
    if (!thargoidSampling_store.get('registeredRooms')) { thargoidSampling_store.set('registeredRooms',registeredRooms) }
    socket.on("connect", () => {
        function socketReconnect(data) { 
            if (data != 'unknown') {
                return new Promise(async (resolve,reject) => {
                    try { socket.emit('joinRoom',data, async (response) => { 
                        resolve(response);
                        if (data.includes("brain-ThargoidSample")) {
                            thargoidSampling_store.set(`socketRooms.${data}`, response);
                        }
                    }); }
                    catch(error) { errorHandler(error,error.name); reject(error) }
                })
            }
        }
        if (watcherConsoleDisplay("globalLogs")) { logs("[SOCKET CLIENT]".blue,"Socket ID: ",`${socket.id}`.green) }
        //! Add other sockets with if statements
        //Thargoid Sampling
        if (store.get('currentPage') == 'brain-ThargoidSample' && thargoidSampling_store.get('brain_ThargoidSample.currentTitanState')) { 
            socketReconnect(thargoidSampling_store.get('brain_ThargoidSample.currentTitanState'))
        }
        //Finally send to browser
        if (BrowserWindow.fromId(2)) { BrowserWindow.fromId(2).setTitle(`${theCommander.commander} | Elite Pilots Lounge - ${app.getVersion()} - Connected to Server`) }
        store.set('socketServerStatus','Connected to Server')
    })
    socket.on("disconnect", (reason) => {
        if (watcherConsoleDisplay("globalLogs")) { logs("[SOCKET CLIENT]".blue,"Disconnect Reason: ".bgRed,reason) }
        if (BrowserWindow.fromId(2)) { BrowserWindow.fromId(2).setTitle(`${theCommander.commander} | Elite Pilots Lounge - ${app.getVersion()} - Server Disconnected: ${JSON.stringify(reason)}`) }
        if (reason == 'transport error') {
            console.log(reason)
            // setTimeout(function() {
            //     // Your code to be executed after 5 seconds
            //   }, 5000);
        }
        // else {reconnect()}
        function reconnect() {
            store.set('socketServerStatus','Server Disconnected')
            const roomCache = {
                Inviter: 0,
                Others: [],
                Rooms: [],
                leave: 1
            }
            
            registeredRooms.forEach(i=>{ thargoidSampling_store.set(`socketRooms.${i}`, false) })
            wingData(roomCache,0)
        }
        // else the socket will automatically try to reconnect
    });
    socket.on("error", (e) => {
        if (watcherConsoleDisplay("globalLogs")) { logs("[SOCKET CLIENT]".blue,"ERROR:".red,e) }
        const roomCache = {
            Inviter: 0,
            Others: [],
            Rooms: [],
            leave: 1
        }
        registeredRooms.forEach(i=>{ thargoidSampling_store.set(`socketRooms.${i}`, false) })
        wingData(roomCache,0)
    })

    socket.io.on("reconnect_attempt", (e) => {
        if (watcherConsoleDisplay("globalLogs")) { logs("[SOCKET CLIENT]".blue,"Reconnect Attempt # ".red,e) }
        store.set('socketServerStatus','Server Reconnect')
        if (BrowserWindow.fromId(2)) { BrowserWindow.fromId(2).setTitle(`${theCommander.commander} | Elite Pilots Lounge - ${app.getVersion()} - Server Reconnect Attempt: #${JSON.stringify(e)}`) }
    })
    //todo Code listeners from server.
}
catch(error) {
    errorHandler(error,error.name)
    
}