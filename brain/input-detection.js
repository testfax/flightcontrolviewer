const { logs, logs_error } = require('../utils/logConfig')
try {
  const throttle = require('lodash.throttle');
  const { blastToUI } = require('../brain/input-functions')
  const { app, ipcMain, BrowserWindow, webContents  } = require('electron');
  const Store = require('electron-store');
  const windowItemsStore = new Store({ name: 'electronWindowIds'})
  const actionmaps = new Store({ name: 'actionmapsJSON'})
  const deviceBufferDecode = new Store({ name: 'deviceBufferDecode'})
  const deviceStateData = new Store({ name: "deviceInfo" });
  const thisWindow = windowItemsStore.get('electronWindowIds')
  const showConsoleMessages = windowItemsStore.get('showConsoleMessages')
  const HID = require('node-hid')
  //!Functions!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  function initializeUI(data,deviceInfo,receiver) { 
    if (windowItemsStore.get('currentPage') == 'dashboard') {
      const package = {
        data: data,
        deviceInfo: deviceInfo
      }
      deviceSetup[deviceInfo]
      const client = BrowserWindow.fromId(thisWindow.win)
      if (client) { client.webContents.send(receiver, package) }
      else { logs_error("no client") }
    }
  }
  function processAxisBuffer(buffer,buttonArray,medianDistance,hasMoved) {
    let detection = false;
    let ind = null;

    //vor Virpil
    const joystickAxisNames = {
      1: 'x',
      3: 'y',
      5: 'rY',
      7: 'rX',
      9: 'slider',
      11: 'z'
    };
    const joystickAxes = [1, 3, 5, 7, 11];
    //


    joystickAxes.forEach(index => {
      const bufferValue = buffer[index];
      if (bufferValue !== undefined && bufferValue !== medianDistance) {
        const axisName = joystickAxisNames[index];
        detection = axisName;
        ind = Object.entries(buttonArray)
        .findIndex(([key, value]) => key === axisName);
        hasMoved = true
      }
    })
  
    //For Virpil
    const sliderIndex = 9;
    const sliderValue = buffer[sliderIndex];
    if (sliderValue !== undefined && sliderValue > 0) {
      detection = "slider";
      ind = ind = Object.entries(buttonArray)
      .findIndex(([key, value]) => key === detection);
      hasMoved = true
    }
    //



    if (joystickAxes.every(index => buffer[index] === medianDistance)) {
      hasMoved = false;
    }
    if (detection) {
      return { detection, ind }
    }
  }
  function virpil_processButtonBuffer(buffer,buttonArray) { //FOR VIRPIL
    let detection = false;
  
    for (const [buttonName, indexes] of Object.entries(buttonArray)) {
      if (parseInt(Object.keys(indexes)[0]) >= 20) { 
        for (const [index, values] of Object.entries(indexes)) {
          const bufferValue = buffer[parseInt(index)];
          if (bufferValue !== undefined && values.includes(bufferValue)) {
            // logs(`Detected ${buttonName} at buffer index ${index} with value ${bufferValue}`);
            detection = buttonName;
            ind = Object.entries(buttonArray)
            .findIndex(([key, value]) => key === buttonName);
          }
        }
      }
    }
    
    if (detection) {
      return { detection, ind }
    }
  }
  function analyzeBuffer(data) {
    let byteArray = []
    for (let i = 0; i < data.length; i++) {
        //For Virpil
        if (i != 36) { 
          byteArray.push(data.readUInt16LE(i))
        }
        //
    }
    return byteArray
  }
  function findKeybind(key,discoveredKeybinds) {
    if (showConsoleMessages) { console.log("[findKeyBind]".yellow,key)}
    if (key in discoveredKeybinds) { return discoveredKeybinds[key] } 
    else { return 0 }
  }
  //!Startup Variables!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  let devices = HID.devices()
  // const uniqueDevices = Array.from(new Map(devices
  //   .filter(device => device.product !== '')
  //   .map(device => [device.product, device])))
  //   .map(([key, value]) => value);
  // const deviceList = uniqueDevices.map(i=> ({
  //   product: i.product,
  //   productId: i.productId,
  //   vendorId: i.vendorId
  // }))
  // actionmaps.set('deviceList',deviceList)

  /**
   * @JSON
   * Get the devices from the user setup.
   */
  let devicesRequested = {}
  if (!deviceStateData.get("devicesRequested")) { deviceStateData.set('devicesRequested','') }
  else { devicesRequested = deviceStateData.get('devicesRequested') }

  /**
   * @object
   * @key @value pair
   * object containing the requested devices.
   */
  const foundDevices = {};
  for (const [key, { vendorId, productId }] of Object.entries(devicesRequested)) {
    foundDevices[key] = devices.find(device => device.vendorId === vendorId && device.productId === productId);
  }
  if (!deviceBufferDecode.get("deviceBufferDecode")) { deviceBufferDecode.set('deviceBufferDecode',{}) }
  const dbd = deviceBufferDecode.get('deviceBufferDecode')

  /**
   * @object
   * Dynamically add the deviceSetup items so we can plug them in when UI initialization is done.
   * Contains state information for the UI. 
   * Once the UI is setup, it changes flags so that new joystick information can be sent to the UI.
   * Controls joystick buffer information flow to the UI.
   */
  //
  const deviceSetup = {};
    for (const key of Object.keys(foundDevices)) {
        deviceSetup[key] = 0;
    }
  /**
   * @function
   * Sets up all devices and watches for device buffers to enter and parses
   */
  const keys = Object.keys(foundDevices);
  keys.forEach(jsId => {
    if (foundDevices[jsId] != undefined) { 
      try {
        // logs(jsId)
        // logs(foundDevices[jsId])
        
        const buttonArray = dbd.vendorIds[foundDevices[jsId].vendorId]?.products[foundDevices[jsId].productId]
        const device = new HID.HID(foundDevices[jsId].path)
        let hasMoved = false;
        let gripHandle_current = null
        let gripHandle_previous = null
        let gripHandle_grip = null
        let gripHandle_flip = null
        let gripAxis_current = null
        let gripAxis_previous = null
        let virpil_pedal_movementDetected = false
        let virpil_pedal_distance = null
        const requestedDevices = devicesRequested[jsId]
        if (deviceSetup[jsId] == 0) { initializeUI(buttonArray.bufferDecoded,requestedDevices,"from_brain-detection-initialize",); deviceSetup[jsId] = 1 }
        const handleData = throttle((data) => {
          const byteArray = analyzeBuffer(data)
          
          //TODO Detect axis travel some how to get median distance
          let medianDistance = 30000
          if (foundDevices[jsId].vendorId == 13124) { //virpil shows median on all x,y,z,z(pedals) devices as 30000
            medianDistance = 30000
          }

          let result_processAxisBuffer = processAxisBuffer(byteArray,buttonArray.bufferDecoded,medianDistance,hasMoved)
          //!virpil VPC ACE-Torq Rudder (START)
          const device_virpil_pedals = foundDevices[jsId].vendorId == 13124 && foundDevices[jsId].productId == 505
          if (device_virpil_pedals) {
            virpil_pedal_distance = byteArray[1] //buffer value between 0-30000 (left pedal) and 30000-60000 (right pedal)
            result_processAxisBuffer = { detection: 'z', ind: 0 }
          }
          //!virpil VPC ACE-Torq Rudder (END)
          //! AXIS
          if (result_processAxisBuffer) {
            const package = {
              keybindArray: null,
              data: result_processAxisBuffer,
              deviceInfo: requestedDevices,
              receiver: "from_brain-detection"
            }
            gripAxis_current = result_processAxisBuffer.detection

            //!virpil VPC ACE-Torq Rudder (START)
            if (device_virpil_pedals) {
              gripAxis_current = virpil_pedal_distance
              if (!virpil_pedal_movementDetected && gripAxis_current !== medianDistance) {
                virpil_pedal_movementDetected = true
                if (showConsoleMessages) { logs(`${jsId.toUpperCase()} Axis:`, result_processAxisBuffer.detection, result_processAxisBuffer) }
                if (deviceSetup[jsId] == 2) {
                  package.keybindArray = findKeybind(`${requestedDevices.position}_${result_processAxisBuffer.detection}`,actionmaps.get('discoveredKeybinds'))
                  blastToUI(package) 
                }
                gripAxis_previous = gripAxis_current;
              } 
              else if (virpil_pedal_movementDetected && gripAxis_current === medianDistance) {
                virpil_pedal_movementDetected = false
              }
            }
            //!virpil VPC ACE-Torq Rudder (END)
            if (gripAxis_current !== gripAxis_previous 
              && !device_virpil_pedals
            ) {
              if (foundDevices[jsId].vendorId == 13124) {
                if (showConsoleMessages) { logs(`${jsId.toUpperCase()} Axis:`, result_processAxisBuffer);}
                if (deviceSetup[jsId] == 2) {
                  package.keybindArray = findKeybind(`${requestedDevices.position}_${gripAxis_current}`,actionmaps.get('discoveredKeybinds'))
                  blastToUI(package) 
                }
              }
              else {
                if (showConsoleMessages) { logs(`${jsId.toUpperCase()} Axis:`, result_processAxisBuffer);}
                if (deviceSetup[jsId] == 2) {
                  package.keybindArray = findKeybind(`${requestedDevices.position}_${gripAxis_current}`,actionmaps.get('discoveredKeybinds'))
                  blastToUI(package) 
                }
              }
              // Update previous state to current after processing
              gripAxis_previous = gripAxis_current;
            }
          }
          //! BUTTON
          const result_processButtonBuffer = virpil_processButtonBuffer(byteArray,buttonArray.bufferDecoded)
          if (result_processButtonBuffer) {
            gripHandle_current = result_processButtonBuffer.detection;
            if (
                 gripHandle_current !== gripHandle_previous 
              && gripHandle_current !== gripHandle_grip
              || gripHandle_flip == 3 
            ) {
              const package = {
                keybindArray: null,
                data: result_processButtonBuffer,
                deviceInfo: requestedDevices,
                receiver: "from_brain-detection"
              }
              if (foundDevices[jsId].vendorId == 13124) { //virpil buttons 1 through 5 have a lever(button3) that can actuate 2 different states. However, star citizen does not recognize the lever(button3) as a button+button combo.
                switch (gripHandle_current) {
                  case 'button1':
                    if (showConsoleMessages) { logs(`${jsId.toUpperCase()} Button:`, result_processButtonBuffer); }
                      gripHandle_grip = gripHandle_current;
                      if (deviceSetup[jsId] == 2) {
                        package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
                        blastToUI(package); 
                      }
                      break;
                  case 'button2':
                      if (gripHandle_flip != 3) { 
                        if (showConsoleMessages) { logs(`${jsId.toUpperCase()} Button:`, result_processButtonBuffer); }
                        if (deviceSetup[jsId] == 2) {
                          package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
                          blastToUI(package) 
                        }
                      }
                      gripHandle_grip = gripHandle_current;
                      gripHandle_flip = 2;
                      break;
                  case 'button3':
                      if (gripHandle_flip == 2 || gripHandle_flip == 4) { 
                        if (showConsoleMessages) { logs(`${jsId.toUpperCase()} Button:`,result_processButtonBuffer)  }
                        if (deviceSetup[jsId] == 2) {
                          package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
                          blastToUI(package) 
                        }
                      }
                      gripHandle_flip = 3; 
                      break;
                  case 'button4':
                    if (showConsoleMessages) { logs(`${jsId.toUpperCase()} Button:`,result_processButtonBuffer) }
                      gripHandle_flip = 4;
                      if (deviceSetup[jsId] == 2) {
                        package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
                        blastToUI(package) 
                      }
                      break;
                  case 'button5':
                    if (showConsoleMessages) { logs(`${jsId.toUpperCase()} Button:`,result_processButtonBuffer) }
                      gripHandle_flip = 5;
                      if (deviceSetup[jsId] == 2) {
                        package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
                        blastToUI(package) 
                      }
                      break;
                  default:
                    if (showConsoleMessages) { logs(`${jsId.toUpperCase()} Button:`, result_processButtonBuffer); }
                      if (deviceSetup[jsId] == 2) {
                        package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
                        blastToUI(package) 
                      }
                      break;
              }
              }
              else {
                if (showConsoleMessages) { logs(`${jsId.toUpperCase()} Button:`, result_processButtonBuffer); }
                gripHandle_grip = gripHandle_current
                if (deviceSetup[jsId] == 2) {
                  package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
                  blastToUI(package); 
                }
              }
              
              // Update previous state to current after processing
              gripHandle_previous = gripHandle_current;
            }
            
          }
        }, 100) //! Throttled for 100ms. Only processes if the buffer is different than last check
        device.on('data', handleData);
        device.on('error', err => { logs_error(`Joystick ${jsId.replace(/^js/,'')} error:`, err) })
      }
      catch (e) {
        logs_error(e)
      }
    }
  })

  //!Communications between frontside and backside (renderer and main(thisfile)).!!!!!!!!!!!!!!!!!!!
  //Listener
  //Emitter is in dashboard.js
  //Waits for the renderer to initialize the UI before accepting data from the device.
  ipcMain.on('initializer-response', (event,message) => { 
    logs("[RENDERER-Init]".bgGreen,message)
    deviceSetup[message] = 2
  })
}
catch (error) {
  logs_error(error,error.name)
}