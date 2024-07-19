const { logs, logs_error } = require('../utils/logConfig')
try {
  const throttle = require('lodash.throttle');
  const {logF,pageData} = require('../utils/utilities')
  const { app, ipcMain, BrowserWindow, webContents  } = require('electron');
  const Store = require('electron-store');
  const windowItemsStore = new Store({ name: 'electronWindowIds'})
  const thisWindow = windowItemsStore.get('electronWindowIds')

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
  function processAxisBuffer(buffer,buttonArray,hasMoved) {
    let detection = false;
    let ind = null;
    const joystickAxisNames = {
      1: 'x',
      3: 'y',
      5: 'rY',
      7: 'rX',
      9: 'slider',
      11: 'z'
    };
    
    const joystickAxes = [1, 3, 5, 7, 11];
    joystickAxes.forEach(index => {
      const bufferValue = buffer[index];
      if (bufferValue !== undefined && bufferValue !== 30000) {
        const axisName = joystickAxisNames[index];
        detection = axisName;
        ind = Object.entries(buttonArray)
        .findIndex(([key, value]) => key === axisName);
        hasMoved = true
      }
    });
  
    const sliderIndex = 9;
    const sliderValue = buffer[sliderIndex];
    if (sliderValue !== undefined && sliderValue > 0) {
      detection = "slider";
      ind = ind = Object.entries(buttonArray)
      .findIndex(([key, value]) => key === detection);
      hasMoved = true
    }
    if (joystickAxes.every(index => buffer[index] === 30000)) {
      hasMoved = false;
    }
    if (detection) {
      return { detection, ind }
    }
  }
  function processButtonBuffer(buffer,buttonArray) {
    let detection = false;
  
    for (const [buttonName, indexes] of Object.entries(buttonArray)) {
      if (parseInt(Object.keys(indexes)[0]) >= 20) { 
        for (const [index, values] of Object.entries(indexes)) {
          const bufferValue = buffer[parseInt(index)];
          if (bufferValue !== undefined && values.includes(bufferValue)) {
            // console.log(`Detected ${buttonName} at buffer index ${index} with value ${bufferValue}`);
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
        if (i != 36) { 
          byteArray.push(data.readUInt16LE(i))
        }
    }
    return byteArray
  }
  //!Startup Variables!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  const thisBrain = 'dashboard'
  const store = new Store({ name: `${thisBrain}` })
  // if (!store.get('currentCarrierMarket')) { store.set('currentCarrierMarket',false) }
  // app.on('window-all-closed', () =>{ store.set('redisFirstUpdateflag',false) })
  let devices = HID.devices()
  const uniqueDevices = Array.from(new Map(devices
    .filter(device => device.product !== '')
    .map(device => [device.product, device])))
    .map(([key, value]) => value);
    
  const deviceList = uniqueDevices.map(i=> ({
    product: i.product,
    productId: i.productId,
    vendorId: i.vendorId
  }))
  console.log(deviceList)

  //TODO Devices Requested needs to be turned into a store item.
  const devicesRequested = {
    "js1": {
      "position": "js1",
      "product": 'L-VPC Stick WarBRD-D',
      "vendorId": 13124, 
      "productId": 33779 
    },
    "js2": { 
      "position": "js2",
      "product": 'R-VPC Stick WarBRD-D',
      "vendorId": 13124, 
      "productId": 17396 
    },
    "js3": { 
      "position": "js3",
      "product": 'VPC ACE-Torq Rudder',
      "vendorId": 13124, 
      "productId": 505 
    }
  }
  const foundDevices = {};
  for (const [key, { vendorId, productId }] of Object.entries(devicesRequested)) {
    foundDevices[key] = devices.find(device => device.vendorId === vendorId && device.productId === productId);
  }

  //TODO Need a way to functionally create each device dynamically.
  const { 
    js1: joystick1, 
    js2: joystick2, 
    js3: joystick3, 
    js4: joystick4, 
    js5: joystick5, 
    js6: joystick6, 
    js7: joystick7, 
    js8: joystick8, 
    js9: joystick9, 
    js10: joystick10 
  } = foundDevices;
  let deviceSetup = {
    js1: 0,
    js2: 0,
    js3: 0,
    js4: 0,
    js5: 0,
    js6: 0,
    js7: 0,
    js8: 0,
    js9: 0,
    js10: 0
  }

  //! Functionally setup the frontside once and then watch the joystick buffer for events.
  if (joystick1) {
    const buttonArray = {
      x: {
        "1": [30000]
      },
      y: {
        "3": [30000]
      },
      rY: {
        "5": [30000]
      },
      rX: {
        "7": [30000],
      },
      slider: {
        "9": [0]
      },
      z: {
        "11": [30000]
      },
      button1: {
        "20": [256],
        "21": [1],
      }, 
      button2: {
        "20": [512],
        "21": [2],
      }, 
      button3: {
        "20": [1024],
        "21": [4],
      },
      button4: {
        "20": [2304,3072],
        "21": [9,12]
      },
      button5: {
        "20": [6400,7168],
        "21": [25,28]
      },
      button6: {
        "20": [8448,8704],
        "21": [33,34]
      },
      button7: {
        "20": [16640,16896],
        "21": [65,66]
      },
      button8: {
        "20": [33024,33280],
        "21": [129,130]
      },
      button9: {
        "21": [257,258],
        "22": [1,1]
      },
      button10: {
        "21": [513,514],
        "22": [2,2]
      },
      button11: {
        "21": [1025,1026],
        "22": [4,4]
      },
      button12: {
        "21": [2049,2050],
        "22": [8,8]
      },
      button13: {
        "21": [4097,4098],
        "22": [16,16]
      },
      button14: {
        "21": [8193,8194],
        "22": [32,32]
      },
      button15: {
        "21": [16385,16386],
        "22": [64,64]
      },
      button16: {
        "21": [32769,32770],
        "22": [128,128]
      },
      button17: {
        "22": [256],
        "23": [1]
      },
      button18: {
        "22": [512],
        "23": [2]
      },
      button19: {
        "22": [1024],
        "23": [4]
      },
      button20: {
        "22": [3072],
        "23": [12]
      },
      button21: {
        "22": [4096],
        "23": [16]
      },
      button22: {
        "22": [8192],
        "23": [32]
      },
      button23: {
        "22": [16384],
        "23": [64]
      },
      button24: {
        "22": [32768],
        "23": [128]
      },
      button25: {
        "23": [256],
        "24": [1]
      },
      button26: {
        "23": [512],
        "24": [2]
      },
      button27: {
        "23": [1024],
        "24": [4]
      },
      button28: {
        "23": [2048],
        "24": [8]
      },
      button29: {
        "23": [4096],
        "24": [16]
      },
      button30: {
        "23": [8192],
        "24": [32]
      },
      button31: {
        "23": [16384],
        "24": [64]
      },
      button32: {
        "23": [32768],
        "24": [128]
      }
    }
    const device = new HID.HID(joystick1.path)
    let hasMoved = false;
    let gripHandle_current = null;
    let gripHandle_previous = null;
    let gripHandle_grip = null;
    let gripHandle_flip = null;
    let gripAxis_current = null;
    let gripAxis_previous = null;
    try {
      if (deviceSetup.js1 == 0) { initializeUI(buttonArray,devicesRequested.js1,"from_brain-detection-initialize",); deviceSetup.js1 = 1 }

      const handleData = throttle((data) => {
        const byteArray = analyzeBuffer(data)
        
        const result_processAxisBuffer = processAxisBuffer(byteArray,buttonArray,hasMoved);
        if (result_processAxisBuffer) { 
          gripAxis_current = result_processAxisBuffer.detection;
          if (gripAxis_current !== gripAxis_previous) {
              switch (gripAxis_current) {
                  case 'x':
                      console.log('Axis:', result_processAxisBuffer);
                      if (deviceSetup.js1 == 2) { blastToUI(result_processAxisBuffer,devicesRequested.js1,"from_brain-detection") }
                      break;
                  case 'y':
                      console.log('Axis:', result_processAxisBuffer);
                      if (deviceSetup.js1 == 2) { blastToUI(result_processAxisBuffer,devicesRequested.js1,"from_brain-detection") }
                      break;
                  default:
                      console.log('Axis:', result_processAxisBuffer);
                      if (deviceSetup.js1 == 2) { blastToUI(result_processAxisBuffer,devicesRequested.js1,"from_brain-detection") }
                      break;
              }
              // Update previous state to current after processing
              gripAxis_previous = gripAxis_current;
          }
        }
        const result_processButtonBuffer = processButtonBuffer(byteArray,buttonArray)
        if (result_processButtonBuffer) {
          gripHandle_current = result_processButtonBuffer.detection;
          if (
               gripHandle_current !== gripHandle_previous 
            && gripHandle_current !== gripHandle_grip
            || gripHandle_flip == 3 
          ) {
              switch (gripHandle_current) {
                  case 'button1':
                      console.log('Button:', result_processButtonBuffer);
                      gripHandle_grip = gripHandle_current;
                      if (deviceSetup.js1 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js1,"from_brain-detection") }
                      break;
                  case 'button2':
                      if (gripHandle_flip != 3) { 
                        console.log('Button:', result_processButtonBuffer);
                        if (deviceSetup.js1 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js1,"from_brain-detection") }
                      }
                      gripHandle_grip = gripHandle_current;
                      gripHandle_flip = 2;
                      break;
                  case 'button3':
                      if (gripHandle_flip == 2 || gripHandle_flip == 4) { 
                        console.log('Button:',result_processButtonBuffer) 
                        if (deviceSetup.js1 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js1,"from_brain-detection") }
                      }
                      gripHandle_flip = 3; 
                      break;
                  case 'button4':
                      console.log('Button:',result_processButtonBuffer)
                      gripHandle_flip = 4;
                      if (deviceSetup.js1 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js1,"from_brain-detection") }
                      break;
                  case 'button5':
                      console.log('Button:',result_processButtonBuffer)
                      gripHandle_flip = 5;
                      if (deviceSetup.js1 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js1,"from_brain-detection") }
                      break;
                  default:
                      console.log('Button:', result_processButtonBuffer);
                      if (deviceSetup.js1 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js1,"from_brain-detection") }
                      break;
              }
              // Update previous state to current after processing
              gripHandle_previous = gripHandle_current;
          }
          
        }
      }, 100);

      device.on('data', handleData);
      device.on('error', err => {
        console.error('Joystick 1 error:', err);
      })
    }
    catch (e) {
      console.log(e)
    } 
  } else { console.error('Joystick 1 not found') }
  if (joystick2) {
    //!buttonArray is specific to VPC Alpha Prime Grip - R
    const buttonArray = {
      x: {
        "1": [30000]
      },
      y: {
        "3": [30000]
      },
      rY: {
        "5": [30000]
      },
      rX: {
        "7": [30000],
      },
      slider: {
        "9": [0]
      },
      z: {
        "11": [30000]
      },
      button1: {
        "20": [256],
        "21": [1],
      }, 
      button2: {
        "20": [512],
        "21": [2],
      }, 
      button3: {
        "20": [1024],
        "21": [4],
      },
      button4: {
        "20": [2304,3072],
        "21": [9,12]
      },
      button5: {
        "20": [6400,7168],
        "21": [25,28]
      },
      button6: {
        "20": [8448,8704],
        "21": [33,34]
      },
      button7: {
        "20": [16640,16896],
        "21": [65,66]
      },
      button8: {
        "20": [33024,33280],
        "21": [129,130]
      },
      button9: {
        "21": [257,258],
        "22": [1,1]
      },
      button10: {
        "21": [513,514],
        "22": [2,2]
      },
      button11: {
        "21": [1025,1026],
        "22": [4,4]
      },
      button12: {
        "21": [2049,2050],
        "22": [8,8]
      },
      button13: {
        "21": [4097,4098],
        "22": [16,16]
      },
      button14: {
        "21": [8193,8194],
        "22": [32,32]
      },
      button15: {
        "21": [16385,16386],
        "22": [64,64]
      },
      button16: {
        "21": [32769,32770],
        "22": [128,128]
      },
      button17: {
        "22": [256],
        "23": [1]
      },
      button18: {
        "22": [512],
        "23": [2]
      },
      button19: {
        "22": [1024],
        "23": [4]
      },
      button20: {
        "22": [3072],
        "23": [12]
      },
      button21: {
        "22": [4096],
        "23": [16]
      },
      button22: {
        "22": [8192],
        "23": [32]
      },
      button23: {
        "22": [16384],
        "23": [64]
      },
      button24: {
        "22": [32768],
        "23": [128]
      },
      button25: {
        "23": [256],
        "24": [1]
      },
      button26: {
        "23": [512],
        "24": [2]
      },
      button27: {
        "23": [1024],
        "24": [4]
      },
      button28: {
        "23": [2048],
        "24": [8]
      },
      button29: {
        "23": [4096],
        "24": [16]
      },
      button30: {
        "23": [8192],
        "24": [32]
      },
      button31: {
        "23": [16384],
        "24": [64]
      },
      button32: {
        "23": [32768],
        "24": [128]
      }
    }
    const device = new HID.HID(joystick2.path)
    let hasMoved = false;
    let gripHandle_current = null;
    let gripHandle_previous = null;
    let gripHandle_grip = null;
    let gripHandle_flip = null;
    let gripAxis_current = null;
    let gripAxis_previous = null;
    try {
      if (deviceSetup.js2 == 0) { initializeUI(buttonArray,devicesRequested.js2,"from_brain-detection-initialize",); deviceSetup.js2 = 1 }

      const handleData = throttle((data) => {
        const byteArray = analyzeBuffer(data)
        
        const result_processAxisBuffer = processAxisBuffer(byteArray,buttonArray,hasMoved);
        if (result_processAxisBuffer) { 
          gripAxis_current = result_processAxisBuffer.detection;
          if (gripAxis_current !== gripAxis_previous) {
              switch (gripAxis_current) {
                  case 'x':
                      console.log('Axis:', result_processAxisBuffer);
                      if (deviceSetup.js2 == 2) { blastToUI(result_processAxisBuffer,devicesRequested.js2,"from_brain-detection") }
                      break;
                  case 'y':
                      console.log('Axis:', result_processAxisBuffer);
                      if (deviceSetup.js2 == 2) { blastToUI(result_processAxisBuffer,devicesRequested.js2,"from_brain-detection") }
                      break;
                  default:
                      console.log('Axis:', result_processAxisBuffer);
                      if (deviceSetup.js2 == 2) { blastToUI(result_processAxisBuffer,devicesRequested.js2,"from_brain-detection") }
                      break;
              }
              // Update previous state to current after processing
              gripAxis_previous = gripAxis_current;
          }
        }
        const result_processButtonBuffer = processButtonBuffer(byteArray,buttonArray)
        if (result_processButtonBuffer) {
          
          gripHandle_current = result_processButtonBuffer.detection;
          if (
               gripHandle_current !== gripHandle_previous 
            && gripHandle_current !== gripHandle_grip
            || gripHandle_flip == 3 
          ) {
              switch (gripHandle_current) {
                  case 'button1':
                      console.log('Button:', result_processButtonBuffer);
                      gripHandle_grip = gripHandle_current;
                      if (deviceSetup.js2 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js2,"from_brain-detection") }
                      break;
                  case 'button2':
                      if (gripHandle_flip != 3) { 
                        console.log('Button:', result_processButtonBuffer);
                        if (deviceSetup.js2 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js2,"from_brain-detection") }
                      }
                      gripHandle_grip = gripHandle_current;
                      gripHandle_flip = 2;
                      break;
                  case 'button3':
                      if (gripHandle_flip == 2 || gripHandle_flip == 4) { 
                        console.log('Button:',result_processButtonBuffer) 
                        if (deviceSetup.js2 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js2,"from_brain-detection") }
                      }
                      gripHandle_flip = 3; 
                      break;
                  case 'button4':
                      console.log('Button:',result_processButtonBuffer)
                      gripHandle_flip = 4;
                      if (deviceSetup.js2 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js2,"from_brain-detection") }
                      break;
                  case 'button5':
                      console.log('Button:',result_processButtonBuffer)
                      gripHandle_flip = 5;
                      if (deviceSetup.js2 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js2,"from_brain-detection") }
                      break;
                  default:
                      console.log('Button:', result_processButtonBuffer);
                      if (deviceSetup.js2 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js2,"from_brain-detection") }
                      break;
              }
              // Update previous state to current after processing
              gripHandle_previous = gripHandle_current;
          }
          
        }
      }, 100);

      device.on('data', handleData);
      device.on('error', err => {
        console.error('Joystick 2 error:', err);
      })
    }
    catch (e) {
      console.log(e)
    } 
  } else { console.error('Joystick 2 not found') }
  if (joystick3) {
    const buttonArray = {
      z: {
        "1": [30000]
      }
    }
    const device = new HID.HID(joystick3.path)
    let hasMoved = false;
    let gripHandle_current = null;
    let gripHandle_previous = null;
    let gripHandle_grip = null;
    let gripHandle_flip = null;
    let gripAxis_current = null;
    let gripAxis_previous = null;
    try {
      if (deviceSetup.js3 == 0) { initializeUI(buttonArray,devicesRequested.js3,"from_brain-detection-initialize",); deviceSetup.js3 = 1 }

      const handleData = throttle((data) => {
        const byteArray = analyzeBuffer(data)
        
        const result_processAxisBuffer = processAxisBuffer(byteArray,buttonArray,hasMoved);
        if (result_processAxisBuffer) { 
          gripAxis_current = result_processAxisBuffer.detection;
          if (gripAxis_current !== gripAxis_previous) {
              switch (gripAxis_current) {
                  case 'x':
                      console.log('Axis:', result_processAxisBuffer);
                      if (deviceSetup.js3 == 2) { blastToUI(result_processAxisBuffer,devicesRequested.js3,"from_brain-detection") }
                      break;
                  case 'y':
                      console.log('Axis:', result_processAxisBuffer);
                      if (deviceSetup.js3 == 2) { blastToUI(result_processAxisBuffer,devicesRequested.js3,"from_brain-detection") }
                      break;
                  default:
                      console.log('Axis:', result_processAxisBuffer);
                      if (deviceSetup.js3 == 2) { blastToUI(result_processAxisBuffer,devicesRequested.js3,"from_brain-detection") }
                      break;
              }
              // Update previous state to current after processing
              gripAxis_previous = gripAxis_current;
          }
        }
        const result_processButtonBuffer = processButtonBuffer(byteArray,buttonArray)
        if (result_processButtonBuffer) {
          gripHandle_current = result_processButtonBuffer.detection;
          if (
               gripHandle_current !== gripHandle_previous 
            && gripHandle_current !== gripHandle_grip
            || gripHandle_flip == 3 
          ) {
              switch (gripHandle_current) {
                  case 'button1':
                      console.log('Button:', result_processButtonBuffer);
                      gripHandle_grip = gripHandle_current;
                      if (deviceSetup.js3 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js3,"from_brain-detection") }
                      break;
                  case 'button2':
                      if (gripHandle_flip != 3) { 
                        console.log('Button:', result_processButtonBuffer);
                        if (deviceSetup.js3 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js3,"from_brain-detection") }
                      }
                      gripHandle_grip = gripHandle_current;
                      gripHandle_flip = 2;
                      break;
                  case 'button3':
                      if (gripHandle_flip == 2 || gripHandle_flip == 4) { 
                        console.log('Button:',result_processButtonBuffer) 
                        if (deviceSetup.js3 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js3,"from_brain-detection") }
                      }
                      gripHandle_flip = 3; 
                      break;
                  case 'button4':
                      console.log('Button:',result_processButtonBuffer)
                      gripHandle_flip = 4;
                      if (deviceSetup.js3 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js3,"from_brain-detection") }
                      break;
                  case 'button5':
                      console.log('Button:',result_processButtonBuffer)
                      gripHandle_flip = 5;
                      if (deviceSetup.js3 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js3,"from_brain-detection") }
                      break;
                  default:
                      console.log('Button:', result_processButtonBuffer);
                      if (deviceSetup.js3 == 2) { blastToUI(result_processButtonBuffer,devicesRequested.js3,"from_brain-detection") }
                      break;
              }
              // Update previous state to current after processing
              gripHandle_previous = gripHandle_current;
          }
          
        }
      }, 100);

      device.on('data', handleData);
      device.on('error', err => {
        console.error('Joystick 3 error:', err);
      })
    }
    catch (e) {
      console.log(e)
    } 
  } else { console.error('Joystick 3 not found') }

  //!Communications between frontside and backside (renderer and main).!!!!!!!!!!!!!!!!!!!
  //Listener
  //Emitter is in dashboard.js
  ipcMain.on('initializer-response', (event,message) => { 
    logs("[RENDERER]".bgMagenta,logF(message));
    deviceSetup[message] = 2
  })
  // ipcMain.on(thisBrain, async (receivedData) => {
  //   // logs(`${receivedData}`.cyan)
  // })
}
catch (error) {
  logs_error(error,error.name)
}