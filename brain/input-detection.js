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
    function blastToUI(data,review) {
      review = false
      // if (data.event == 'FSDJump' || data.event == 'Location') { logs("Review:".yellow,logF(data)) }
      if (windowItemsStore.get('currentPage') == thisBrain) {
        // if (review && data.event != 'FSDJump' && data.event != 'Location') { logs("Review:".yellow,logF(data.event)) }
        const client = BrowserWindow.fromId(thisWindow.win);
        if (client) { client.webContents.send("from_brain-detection", data); }
      }
    }
    //!BRAIN EVENT######################################################
    //!Startup Variables
    const thisBrain = 'brain-detection'
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
      vendorId: i.vendorId,
      path: i.path
    }))
    // console.log(deviceList)
    // const joystick = devices.find(device => device.vendorId === 13124 && device.productId === 505);
    const joystick1 = devices.find(device => device.vendorId === 13124 && device.productId === 33779)
    const joystick2 = devices.find(device => device.vendorId === 13124 && device.productId === 17396)
    const joystick3 = devices.find(device => device.vendorId === 13124 && device.productId === 505)
    
    
    if (joystick1) {
      const device = new HID.HID(joystick1.path);
      device.on('data', data => {
        // Process joystick data
        const buffer = Buffer.from(data)
       
        const pedalAxis = buffer.readUInt16LE(1)
        //console.log("L-STICK: ",pedalAxis);
        // mainWindow.webContents.send('joystick-data', data);
      });

      device.on('error', err => {
        console.error('Joystick error:', err);
      });
    } else {
      console.error('Joystick not found');
    }
    if (joystick2) {
      const device = new HID.HID(joystick2.path);
      device.on('data', data => {
        // Process joystick data
        const buffer = Buffer.from(data)
        const pedalAxis = buffer.readUInt16LE(1)
        // console.log(pedalAxis)
        // console.log("R-STICK: ",pedalAxis);
        // mainWindow.webContents.send('joystick-data', data);
      });

      device.on('error', err => {
        console.error('Joystick error:', err);
      });
    } else {
      console.error('Joystick not found');
    }
    if (joystick3) {
      const device = new HID.HID(joystick3.path);
      device.on('data', data => {
        // Process joystick data
        const buffer = Buffer.from(data)
        const pedalAxis = buffer.readUInt16LE(1)
        // console.log("PEDALS: ",pedalAxis);
        // mainWindow.webContents.send('joystick-data', data);
      });
      
      device.on('error', err => {
        console.error('Joystick error:', err);
      });
    } else {
      console.error('Joystick not found');
    }




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