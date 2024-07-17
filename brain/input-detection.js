const { logs, logs_error } = require('../utils/logConfig')
try {
    const {logF,watcherConsoleDisplay,pageData} = require('../utils/utilities')
    const { app, ipcMain, BrowserWindow, webContents  } = require('electron');
    const Store = require('electron-store');
    const windowItemsStore = new Store({ name: 'electronWindowIds'})
    const thisWindow = windowItemsStore.get('electronWindowIds')
    const path = require('path')
    const fs = require('fs')
    const HID = require('node-hid');
    //!Functions!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    function blastToUI(data,deviceInfo,receiver) {
      if (windowItemsStore.get('currentPage') == thisBrain) {
        const client = BrowserWindow.fromId(thisWindow.win);
        const package = {
          data: data,
          deviceInfo: deviceInfo
        }
        if (client) { client.webContents.send(receiver, package); }
        else { console.log("no client")}
      }
    }
    function initializeUI(data,deviceInfo,receiver) { 
      if (windowItemsStore.get('currentPage') == thisBrain) {
        const client = BrowserWindow.fromId(thisWindow.win);
        const package = {
          data: data,
          deviceInfo: deviceInfo
        }
        deviceSetup[deviceInfo]
        if (client) { client.webContents.send(receiver, package); }
        else { console.log("no client")}
      }
    }
    //!BRAIN EVENT######################################################
    //!Startup Variables
    const thisBrain = 'dashboard'
    const store = new Store({ name: `${thisBrain}` })
    // if (!store.get('currentCarrierMarket')) { store.set('currentCarrierMarket',false) }
    let input_devices = {}
    //!BRAIN EVENTs######################################################
    app.on('window-all-closed', () =>{ store.set('redisFirstUpdateflag',false) })

    // Your joystick logic here
    let devices = HID.devices()
    const uniqueDevices = Array.from(new Map(devices
      .filter(device => device.product !== '') // Remove entries where product is blank
      .map(device => [device.product, device])))
      .map(([key, value]) => value);
  
    const deviceList = uniqueDevices.map(i=> ({
      product: i.product,
      productId: i.productId,
      vendorId: i.vendorId
    }))
    console.log(deviceList)
    // const joystick = devices.find(device => device.vendorId === 13124 && device.productId === 505);
        // const joystick1 = devices.find(device => device.vendorId === 13124 && device.productId === 33779)
    // const joystick2 = devices.find(device => device.vendorId === 13124 && device.productId === 17396)
    // const joystick3 = devices.find(device => device.vendorId === 13124 && device.productId === 505)
    const devicesRequested = {
      "js1": { 
        "vendorId": 13124, 
        "productId": 33779 
      },
      "js2": { 
        "vendorId": 13124, 
        "productId": 17396 
      },
      "js3": { 
        "vendorId": 13124, 
        "productId": 505 
      }
    }
    const foundDevices = {};
    for (const [key, { vendorId, productId }] of Object.entries(devicesRequested)) {
      foundDevices[key] = devices.find(device => device.vendorId === vendorId && device.productId === productId);
    }
    const { js1: joystick1, js2: joystick2, js3: joystick3 } = foundDevices;
    let deviceSetup = {
      js1: 0,
      js2: 0,
      js3: 0
    }
    // if (joystick1) {
    //   const device = new HID.HID(joystick1.path);
    //   device.on('data', data => {
    //     // Process joystick data
    //     const buffer = Buffer.from(data)
       
    //     const pedalAxis = buffer.readUInt16LE(1)
    //     //console.log("L-STICK: ",pedalAxis);
    //     // mainWindow.webContents.send('joystick-data', data);
    //   });

    //   device.on('error', err => {
    //     console.error('Joystick error:', err);
    //   });
    // } else {
    //   console.error('Joystick not found');
    // }
    if (joystick2) {
      const device = new HID.HID(joystick2.path);
      device.on('data', data => {
        // console.log("deviceSetup.js2 = ",deviceSetup.js2)
        const buffer = Buffer.from(data)
        if (deviceSetup.js2 == 0) { initializeUI(buffer,"js2","from_brain-detection-initialize"); deviceSetup.js2 = 1 }
        // const xAxis = buffer.readUInt16LE(1)
        if (deviceSetup.js2 == 2) { blastToUI(buffer,"js2","from_brain-detection") }
        // console.log(xAxis)
        // console.log("R-STICK: ",pedalAxis);
        // mainWindow.webContents.send('joystick-data', data);
      });

      device.on('error', err => {
        console.error('Joystick error:', err);
      });
    } else {
      console.error('Joystick not found');
    }
    // if (joystick3) {
    //   const device = new HID.HID(joystick3.path);
    //   device.on('data', data => {
    //     // Process joystick data
    //     const buffer = Buffer.from(data)
    //     const pedalAxis = buffer.readUInt16LE(1)
    //     // console.log("PEDALS: ",pedalAxis);
    //     // mainWindow.webContents.send('joystick-data', data);
    //   });
      
    //   device.on('error', err => {
    //     console.error('Joystick error:', err);
    //   });
    // } else {
    //   console.error('Joystick not found');
    // }




    ipcMain.on(thisBrain, async (receivedData) => {
      // logs(`${receivedData.event}`.cyan)
      // store.set('masterTimestamp',receivedData.timestamp)
      if (receivedData.event == 'template') {
        if (watcherConsoleDisplay('BrainEvent')) { logs("[BE DET]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('thisSampleSystem'), "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
            if (store.get('redisFirstUpdateflag')) { 
              blastToUI(compiledArray)
            }
          }
        catch(e) { logs_error(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent')) { logs("[BE DET]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      else {
        eventNames.forEach(eventName =>{
          if (receivedData.event === eventName) {
            if (watcherConsoleDisplay('BrainEvent')) { logs("[BE DET]".bgCyan,`${receivedData.event} Wait`.yellow); }
            try {
              let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('systemAddress'), "FID": FID }
              compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
              if (store.get('redisFirstUpdateflag')) {
                blastToUI(compiledArray)
                
              }
            }
            catch(e) { logs_error(e,e.name)}
            if (watcherConsoleDisplay('All')) { logs("[BE DET]".bgCyan,`${receivedData.event} Comp`.green); }
          }
        })
      }
      //!end of Brain
      //!end of Brain
      //!end of Brain
      //!end of Brain
      //!end of Brain
    })
  }
  catch (error) {
    logs_error(error,error.name)
  }
  
  
  
  
  
  
  
  
  
  // if (store.get('redisFirstUpdateflag')) { ipcMain.emit(`event-callback-${receivedData.event}`,compiledArray) }