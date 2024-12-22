const { logs, logs_error, logs_debug } = require('../utils/logConfig')
try {
  const staticData = require('../staticData.json')
  const throttle = require('lodash.throttle');
  const { blastToUI } = require('../brain/input-functions')
  const { app, ipcMain, BrowserWindow, webContents  } = require('electron');
  const Store = require('electron-store');
  const windowItemsStore = new Store({ name: 'electronWindowIds'})
  const actionmaps = new Store({ name: 'actionmapsJSON'})
  const deviceStateData = new Store({ name: "deviceInfo" });
  const thisWindow = windowItemsStore.get('electronWindowIds')
  // const showConsoleMessages = 1
  const showConsoleMessages = windowItemsStore.get('showConsoleMessages')
  const HID = require('node-hid')
  //!Functions!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  function initializeUI(data,deviceInfo,receiver) {
    if (windowItemsStore.get('currentPage') == 'dashboard' || windowItemsStore.get('currentPage') == 'getbuffer') {
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
  function processAxisBuffer(buffer,buttonArray,medianDistance,bufferVals,jsId) {
    let detection = false;
    let ind = null;
    let val = null;
    let build = null
    const joystickAxisNames = {
      1: 'x',
      3: 'y',
      5: 'roty',
      7: 'rotx',
      9: 'slider',
      11: 'z'
    };
    const joystickAxes = [1, 3, 5, 7, 11];
    //For Virpil
    try {
      const sliderIndex = 9;
      const sliderValue = buffer[sliderIndex];
      if (sliderValue !== undefined && sliderValue > 30000) {
        detection = "slider";
        ind = Object.entries(buttonArray).findIndex(([key, value]) => key === detection)
        bufferVals.slider_val = sliderValue
        bufferVals.slider = detection == 'slider' ? (bufferVals.slider_val >= 30000) : false
        bufferVals['slider_detection'] = "slider"
        bufferVals['slider_ind'] = ind
        build = { "detection":detection, "ind":bufferVals[detection + '_ind'] }
        if (showConsoleMessages) { console.log(sliderIndex,bufferVals[detection],"HIT".red,jsId,'BID'.blue,detection) }
        return build
      }
    }
    catch (e) {
      console.log(e)
    }
    //
    joystickAxes.forEach(index => {
      const bufferValue = buffer[index]
      if (bufferValue !== undefined && bufferValue !== medianDistance) {
        const axisName = joystickAxisNames[index]
        detection = axisName;
        ind = Object.entries(buttonArray).findIndex(([key, value]) => key === axisName)
        val = buffer[index]
        //For Virpil, sets a distance value away from center that the stick must move before it is triggered in the app.
        // Helps for when you're pushing buttons and not have an Axis show up
        const buffValHi = 40000
        const buffValLo = 20000
        if (axisName == 'x') { bufferVals.x_val = val; checker(bufferVals.x_val) }
        if (axisName == 'y') { bufferVals.y_val = val; checker(bufferVals.y_val) }
        if (axisName == 'z') { bufferVals.z_val = val; checker(bufferVals.z_val) }
        if (axisName == 'roty') { bufferVals.roty_val = val; checker(bufferVals.roty_val) }
        if (axisName == 'rotx') { bufferVals.rotx_val = val; checker(bufferVals.rotx_val) }
        function checker(input) {
          let state = false;
          if (input >= buffValHi) { state = true }
          if (input <= buffValLo) { state = true }
          bufferVals[axisName] = state
          bufferVals[axisName + '_detection'] = axisName
          bufferVals[axisName + '_ind'] = ind
          if (state) {
            build = { "detection": axisName, "ind":bufferVals[axisName + '_ind'] }
            if (showConsoleMessages) { console.log(index,bufferVals[axisName],"HIT".red,jsId,'BID'.blue,axisName,build) }
            return { build }
          }
        }
        //
        //vor Virpil
      }
    })
    return build
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
    const lastBuffer = data.length -1
    for (let i = 0; i < data.length; i++) {
        //For Virpil
        if (i != lastBuffer) { 
          byteArray.push(data.readUInt16LE(i))
        }
        //
    }
    return byteArray
  }
  function findKeybind(key,discoveredKeybinds) {
    // if (showConsoleMessages) { console.log("[findKeyBind]".yellow,discoveredKeybinds) }
    if (showConsoleMessages) { console.log("[findKeyBind]".yellow,key) }
    if (key in discoveredKeybinds) { 
      if (showConsoleMessages) { console.log("[findKeyBind]".green, discoveredKeybinds[key]) }
      return discoveredKeybinds[key] 
    } 
    else { 
      if (showConsoleMessages) { console.log("[findKeyBind]".red, key) }
      return 0 
    }
  }

  //!Startup Variables!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  let devices = HID.devices()
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

  /**
   * @object
   * Dynamically add the deviceSetup items so we can plug them in when UI initialization is done.
   * Contains state information for the UI. 
   * Once the UI is setup, it changes flags so that new joystick information can be sent to the UI.
   * Controls joystick buffer information flow to the UI.
   */
  //

  ipcMain.on('changePage', async (receivedData) => {
    deviceInit.forEach(device => device.removeAllListeners())
    setTimeout(() => {
        if (showConsoleMessages) { logs_debug("[RENDERER]".bgGreen,"Page Change:".yellow,windowItemsStore.get('currentPage')) }
        ZeroDeviceSetup(deviceSetup,foundDevices,devicesRequested,deviceInit,bufferVals)
    },300)
  })
  let deviceInit = []
  const deviceSetup = {}
  let bufferVals = {
    x_val: 0,
    y_val: 0,
    z_val: 0,
    rotx_val: 0,
    roty_val: 0,
    slider_val: 0,
    x: false,
    y: false,
    z: false,
    rotx: false,
    roty: false,
    slider: false,
    x_detection: null,
    y_detection: null,
    z_detection: null,
    slider_detection: null,
    rotx_detection: null,
    roty_detection: null,
    x_ind: null,
    y_ind: null,
    z_ind: null,
    roty_ind: null,
    rotx_ind: null,
  }
  ZeroDeviceSetup(deviceSetup,foundDevices,devicesRequested,deviceInit,bufferVals)
  function ZeroDeviceSetup(deviceSetup,foundDevices,devicesRequested,deviceInit,bufferVals) {
    for (const key of Object.keys(foundDevices)) { deviceSetup[key] = 0 }
    const keys = Object.keys(foundDevices)
    keys.forEach(jsId => {
      if (foundDevices[jsId] != undefined) {
        try {
          // logs(jsId)
          // logs(foundDevices[jsId])
          
          const buttonArray = staticData.deviceBufferDecode.vendorIds[foundDevices[jsId].vendorId]?.products[foundDevices[jsId].productId]
          const device = new HID.HID(foundDevices[jsId].path)
          deviceInit.push(device)
          let gripHandle_current = null
          let gripHandle_previous = null
          let gripHandle_grip = null
          let gripHandle_flip = null
          let gripAxis_current = null
          let gripAxis_previous = 'derp'
          let virpil_pedal_movementDetected = false
          let virpil_pedal_distance = null
          const requestedDevices = devicesRequested[jsId]
          const handleData = throttle((data) => {
            const byteArray = analyzeBuffer(data)
            //!Get Buffer
            if (windowItemsStore.get('currentPage') == 'getbuffer') {
              if (deviceSetup[jsId] == 0) { initializeUI(byteArray,requestedDevices,"from_brain-detection-initialize-getbuffer"); deviceSetup[jsId] = 1 }
              if (deviceSetup[jsId] == 2) {
                const package = {
                  data: byteArray,
                  deviceInfo: requestedDevices,
                  receiver: "from_brain-detection-getbuffer",
                  keybindArray: 0
                }
                blastToUI(package)
              }
            }

            //! Dashboard
            if (windowItemsStore.get('currentPage') == 'dashboard' || windowItemsStore.get('currentPage') == 'joyview') {
              if (deviceSetup[jsId] == 0) { initializeUI(buttonArray.bufferDecoded,requestedDevices,"from_brain-detection-initialize"); deviceSetup[jsId] = 1 }
              //TODO Detect axis travel some how to get median distance
              let medianDistance = 30000
              if (foundDevices[jsId].vendorId == 13124) { //virpil shows median on all x,y,z,z(pedals) devices as 30000
                medianDistance = 30000
                bufferVals.x_val = medianDistance
                bufferVals.y_val = medianDistance
                bufferVals.z_val = medianDistance
                bufferVals.rotx_val = medianDistance
                bufferVals.roty_val = medianDistance
              }
              const specificDevices = {
                virpil_vpc_ace_torq_rudder: foundDevices[jsId].vendorId == 13124 && foundDevices[jsId].productId == 505
              }
              // const specificDevices.virpil_vpc_ace_torq_rudder = foundDevices[jsId].vendorId == 13124 && foundDevices[jsId].productId == 505
              let result_processAxisBuffer = null;
              if (!specificDevices.virpil_vpc_ace_torq_rudder) {
                result_processAxisBuffer = processAxisBuffer(byteArray,buttonArray.bufferDecoded,medianDistance,bufferVals,jsId)
              }

              //!virpil VPC ACE-Torq Rudder (START)
              if (specificDevices.virpil_vpc_ace_torq_rudder) {
                virpil_pedal_distance = byteArray[1] //buffer value between 0-30000 (left pedal) and 30000-60000 (right pedal)
                const virpil_processAxisBuffer = { detection: 'z', ind: 0, val: virpil_pedal_distance }
                if (!virpil_pedal_movementDetected
                  && virpil_pedal_distance !== medianDistance
                ) {
                  virpil_pedal_movementDetected = true
                  if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Axis:`, virpil_processAxisBuffer.detection, virpil_processAxisBuffer) }
                  if (deviceSetup[jsId] == 2) {
                    const package = {
                      keybindArray: null,
                      data: virpil_processAxisBuffer,
                      deviceInfo: requestedDevices,
                      receiver: "from_brain-detection",
                      keybindArticulation: staticData.keybindArticulation
                    }
                    package.keybindArray = findKeybind(`${requestedDevices.position}_${virpil_processAxisBuffer.detection}`,actionmaps.get('discoveredKeybinds'))
                    blastToUI(package)
                  }
                }
                else if (virpil_pedal_movementDetected && virpil_pedal_distance === medianDistance) {
                  virpil_pedal_movementDetected = false
                }
              }
              //!virpil VPC ACE-Torq Rudder (END)
              //! AXIS
              if (result_processAxisBuffer && !specificDevices.virpil_vpc_ace_torq_rudder) {
                const package = {
                  keybindArray: null,
                  data: result_processAxisBuffer,
                  deviceInfo: requestedDevices,
                  receiver: "from_brain-detection",
                  keybindArticulation: staticData.keybindArticulation
                }
                try {
                  gripAxis_current = package.data.detection
                  if (!specificDevices.virpil_vpc_ace_torq_rudder
                    && (bufferVals.x || bufferVals.y || bufferVals.z || bufferVals.slider || bufferVals.rotx || bufferVals.roty)
                    && (gripAxis_current != gripAxis_previous)
                  ) {
                    // package.data = buffer_current
                    if (foundDevices[jsId].vendorId == 13124) {
                      if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Axis:`, result_processAxisBuffer) }
                      if (deviceSetup[jsId] == 2) {
                        package.keybindArray = findKeybind(`${requestedDevices.position}_${package.data.detection}`,actionmaps.get('discoveredKeybinds'))
                        blastToUI(package)
                      }
                    }
                    else {
                      if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Axis:`, result_processAxisBuffer) }
                      if (deviceSetup[jsId] == 2) {
                        package.keybindArray = findKeybind(`${requestedDevices.position}_${package.data.detection}`,actionmaps.get('discoveredKeybinds'))
                        blastToUI(package)
                      }
                    }
                    gripAxis_previous = gripAxis_current
                  }
                }
                catch (e) {
                  console.log(e)
                }
              }
              //! BUTTON
              const result_processButtonBuffer = virpil_processButtonBuffer(byteArray,buttonArray.bufferDecoded)
              if (result_processButtonBuffer) {
                gripHandle_current = result_processButtonBuffer.detection
                if (
                    gripHandle_current !== gripHandle_previous 
                  && gripHandle_current !== gripHandle_grip
                  || gripHandle_flip == 3 
                ) {
                  const package = {
                    keybindArray: null,
                    data: result_processButtonBuffer,
                    deviceInfo: requestedDevices,
                    receiver: "from_brain-detection",
                    keybindArticulation: staticData.keybindArticulation
                  }
                  if (foundDevices[jsId].vendorId == 13124) { //virpil buttons 1 through 5 have a lever(button3) that can actuate 2 different states. However, star citizen does not recognize the lever(button3) as a button+button combo.
                    switch (gripHandle_current) {
                      case 'button1':
                        if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`, result_processButtonBuffer); }
                          gripHandle_grip = gripHandle_current;
                          if (deviceSetup[jsId] == 2) {
                            package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
                            blastToUI(package); 
                          }
                          break;
                      case 'button2':
                          if (gripHandle_flip != 3) { 
                            if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`, result_processButtonBuffer); }
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
                            if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`,result_processButtonBuffer)  }
                            if (deviceSetup[jsId] == 2) {
                              package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
                              blastToUI(package) 
                            }
                          }
                          gripHandle_flip = 3; 
                          break;
                      case 'button4':
                        if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`,result_processButtonBuffer) }
                          gripHandle_flip = 4;
                          if (deviceSetup[jsId] == 2) {
                            package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
                            blastToUI(package) 
                          }
                          break;
                      case 'button5':
                        if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`,result_processButtonBuffer) }
                          gripHandle_flip = 5;
                          if (deviceSetup[jsId] == 2) {
                            package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
                            blastToUI(package) 
                          }
                          break;
                      default:
                        if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`, result_processButtonBuffer); }
                          if (deviceSetup[jsId] == 2) {
                            package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
                            blastToUI(package) 
                          }
                          break;
                    }
                  }
                  else {
                    if (showConsoleMessages) { logs_debug(`${jsId.toUpperCase()} Button:`, result_processButtonBuffer); }
                    gripHandle_grip = gripHandle_current
                    if (deviceSetup[jsId] == 2) {
                      package.keybindArray = findKeybind(`${requestedDevices.position}_${gripHandle_current}`,actionmaps.get('discoveredKeybinds'))
                      blastToUI(package); 
                    }
                  }
                  
                  // Update previous state to current after processing
                  gripHandle_previous = gripHandle_current
                }
                
              }
            }
          }, 100) //! Throttled for 100ms. Only processes if the buffer is different than last check
          device.on('data', handleData)
          device.on('error', err => { logs_error(`Joystick ${jsId.replace(/^js/,'')} error:`, err.stack) })
          device.on('stop-listeners', () => { device.removeAllListeners() })
        }
        catch (e) { logs_error(e.stack) }
      }
    }) 
  }
  /**
   * @function
   * Sets up all devices and watches for device buffers to enter and parses
   */

  //!Communications between frontside and backside (renderer and main(thisfile)).!!!!!!!!!!!!!!!!!!!
  //Listener
  //Emitter is in dashboard.js
  //Waits for the renderer to initialize the UI before accepting data from the device.
  ipcMain.on('initializer-response', (event,message) => { 
    logs_debug("[RENDERER-Init]".bgGreen,message)
    deviceSetup[message] = 2
  })
}
catch (error) { logs_error("[ERROR]".red,error.stack) }