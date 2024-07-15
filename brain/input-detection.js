try {
    const {logF,watcherConsoleDisplay,errorHandler,pageData,getCommander} = require('../utils/errorHandlers')
    const { app, ipcMain, BrowserWindow,webContents  } = require('electron');
    const {logs,logs_error} = require('../utils/logConfig')
    const {updatePreviousMaxLines} = require('../utils/loungeClientStore')
    const Store = require('electron-store');
    const windowItemsStore = new Store({ name: 'electronWindowIds'})
    const thisWindow = windowItemsStore.get('electronWindowIds')
    const client = BrowserWindow.fromId(thisWindow.win);
    const path = require('path')
    const fs = require('fs')
    const colorize = require('json-colorizer')
    // const {fetcher} = require('./brain_functions')
    const { brain_ThargoidSample_socket, eventDataStore } = require('../sockets/taskManager')
    const { redisValidator,findActiveSocketKey } = require('../events-brain/brain_functions')
    
    //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    //List of events that require a brain to do work in the background. This brain handles the below.
    //          > Event Handler
    //          < Brain Event
    //          ^ Socket Handler
    //          * Socket Complete
  
    //!Functions!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    function dataHistory(fileName) {
      try {
      let response = null;
      const FET = {
        filePath: [`../events/Appendix/${fileName}.json`]
      }
        let gPath = path.join(__dirname,FET.filePath[0])
        gPath = path.normalize(gPath)
        const fetched = fs.readFileSync(gPath,'utf8', (err) => { if (err) return logs(err); });
        response = JSON.parse(fetched)
        return response
      }
      catch(e) { errorHandler(e,e.name)}
    }
    function findMatObject(obj, key, value, parentKey = null) {
      if (typeof obj === 'object' && obj !== null) {
        if (obj[key] === value) {
          return { ...obj, type: parentKey };
        }
        for (const prop in obj) {
          const foundObject = findMatObject(obj[prop], key, value, prop);
          if (foundObject) {
            if (parentKey !== null) {
              foundObject.type = parentKey;
            }
            return foundObject;
          }
        }
      }
      return null;
    }
    function distances(cmdrLocation,type) {
      const searchType = dataHistory("itemSearchTable")
      let arrayDistances = {}
      searchType[type].forEach(tl=>{
        const distance = Math.sqrt(Math.pow(tl.x - cmdrLocation[0],2) + Math.pow(tl.y - cmdrLocation[1],2) + Math.pow(tl.z - cmdrLocation[2],2));
        const cmdrDistance = distance.toFixed(2);
        arrayDistances[tl.titan] = cmdrDistance 
      })
      const distancesArray = Object.entries(arrayDistances)
      distancesArray.sort((a, b) => parseFloat(a[1]) - parseFloat(b[1]));
      const sortedDistances = Object.fromEntries(distancesArray);
      return sortedDistances
    }
    async function redisUpdaterSetup(dataEvent,thargoidSampling,compiledArray,sendIt) {
      // console.log(dataEvent)
      // Order of events from login:
      // Cargo -> Commander -> Location -> Loadout
      // Cargo resets all variables
      // FSDJump is added to the launchToRedis variable if detected
      //        intended so that it doesn't compete with Location event.
      // Location is purely for if a user login in intended system to sample in.
      // CollectCargo will be the final nail in the coffin to determine by sample type if the user has collected a sample.
      // Completion of all events will trigger save.
      // After a save, the redisFirstUpdateflag flag will be set to "True", indicating that the user setup for the system has already been completed.
      //     preventing the redisUpdaterSetu function from starting.
      // An FSDJump/CarrierJump event will trigger all variables to be reset and the process can start again.
      // The redis server will determine if the user is already setup, if it is, it simply ignores the request.
      try {
        const event = 'brain-ThargoidSample-SETUP'
        if (checkSetupFlag()) {
          //Remove Duplicates
          launchToRedis = [...new Set(launchToRedis)]
          //Check to make sure all the launch Events are in thargoidSampling
          const matching = launchToRedis.every((event) => { 
            // logs("[BE TS]".bgRed,`${event}`.red,"thargoidSample variable MALFORMED".yellow)
            return Object.values(thargoidSampling).some((item) => item.event === event)
          })
          //! ERROR CHECKING
          //! ERROR CHECKING
          const errorChecking = 1 // [1: On] [0: Off]
          //! ERROR CHECKING
          //! ERROR CHECKING
          if (errorChecking) {
            let missingEvents = null
            if (!matching) {
              logs_error('[BRAIN]'.bgRed,"Missing Events from Startup".magenta)
              Object.keys(thargoidSampling).forEach(i=>{logs(`[${i}]`.green)})
              missingEvents = launchToRedis.filter((event) => {
                return !Object.values(thargoidSampling).some((item) => item.event === event);
              });
              // const matching = missingEvents.length === 0;
              logs_error(missingEvents.forEach(i=>{logs(`[${i}]`.red)}))
            }
            else { logs_error("Missing Events:".bgGreen,logF(missingEvents),"All Events Present:".yellow,`${matching}`.green) }
          }
          //! ERROR CHECKING
          if (matching 
            // && thargoidSampling.Loadout.combinedData.researchLimpetControllers >= 2 
            && thargoidSampling.Loadout.combinedData.causticProtection >= 16
            && currentSystemState != ''
            ) {
              store.set('redisFirstUpdateflag',matching)
              // if (errorChecking) { logs("[BE TS]".bgCyan,`${event} Sent to Redis`.green,logF(thargoidSampling)); }
              if (errorChecking) { logs("[BE TS]".bgCyan,`${event} Sent to Redis`.green); }
              
              let response = await brain_ThargoidSample_socket(thargoidSampling,event,findActiveSocketKey(FASK_rooms,FASK_titanState),compiledArray,sendIt)
              if (response) { store.set(`socketRooms.${response.socketInfo}`, response.titanSocket) }
              return response
          }
          else { store.set('redisFirstUpdateflag',false) 
            if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${event} Allow more events until updater stop`) }
            logs("redisUpdaterSetup")
            logs("matching:",matching)
            logs("causticProtection:",thargoidSampling.Loadout.combinedData.causticProtection >= 16)
            logs("currentSystemState:",currentSystemState != '')
          }
        }
      }
      catch(e) { logs_error("redisUpdaterSetup Failure".bgMagenta,e);  }
    }
    function checkSetupFlag(event) {
      if (store.get('redisFirstUpdateflag')) { 
        if (event) { logs(`${event}`.bgCyan,"{",`{redisFirstUpdateflag:`.green,store.get('redisFirstUpdateflag'),"}") }
        return true
      }
      if (!store.get('redisFirstUpdateflag')) {
        if (event) { logs(`${event}`.bgCyan,"{",`redisFirstUpdateflag:`.red,store.get('redisFirstUpdateflag'),"}") }
        return false
      }
    }
    function blastToUI(data,review) {
      review = false
      // if (data.event == 'FSDJump' || data.event == 'Location') { logs("Review:".yellow,logF(data)) }
      if (windowItemsStore.get('currentPage') == thisBrain) {
        if (review && data.event != 'FSDJump' && data.event != 'Location') { logs("Review:".yellow,logF(data.event)) }
        const client = BrowserWindow.fromId(thisWindow.win);
        if (client) { client.webContents.send("from_brain-ThargoidSample", data); }
      }
    }
    function updateCurrentTitanSocket(eventData) {
        const request = {
          "from": "dcohSystems-sample",
          "description":"systems",
          "type": "redisRequest",
          "method": "GET",
          "data": {
            "dcohSystems": [
              "$.systems[*].thargoidLevel['name']",
              "$.systems[*].maelstrom['name']",
              "$.systems[*].systemAddress",
            ]
          },
          "keys": [
            "state",
            "titan",
            "systemAddress",
          ]
      }
      if (redisValidator(request)) { 
        eventDataStore(request, (response) => {
          if (response) {
            const system = response.response.redisResult.find(x => x.systemAddress === eventData.combinedData.thisSampleSystem)
            store.set(`brain_ThargoidSample.currentTitanState`,`${thisBrain}_${system.titan}_${system.state}`)
          }
        })
      }
    }
    function masterTimestamp(timestamp,test) {
      const now = new Date();
      const timeDifference = new Date(now.toISOString()) - new Date(timestamp)
      const timestampMaxAge = 2 * 60 * 60 * 1000 //2 hrs
      if (test) { 
        logs("now timestmap:",new Date(now.toISOString()))
        logs("db  timestamp:",new Date(timestamp))
        logs("timeDifference: ",timeDifference)
        logs("timestampMaxAge:",timestampMaxAge)
        logs("timeDifference <= timestampMaxAge:",timeDifference <= timestampMaxAge)
      }
      return [timeDifference,timestampMaxAge]
    }
    function isWordPresent(array,item) {
      array = array.toLowerCase();
      item = item.toLowerCase();
      return array.includes(item)
    }
    function inWingStuff(timestamp,action) {
      let compiledArray = { "event": "InWing", "brain": thisBrain, "systemAddress": store.get('systemAddress'),"combinedData": {timestamp: timestamp, wingStatus: action }, "FID": FID }
      compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
      thargoidSampling["InWing"] = compiledArray
      store.set('wingStatus',compiledArray) //Initialize the object in the store.
      blastToUI(compiledArray)
      brain_ThargoidSample_socket(compiledArray,"InWing",findActiveSocketKey(FASK_rooms,FASK_titanState))
    }
    //!BRAIN EVENT######################################################
    //!Startup Variables
    const thisBrain = 'brain-ThargoidSample'
    const visible = 0 //! Sets watcher visibility locally. watchervisibility will still have to be enabled globally in errorHandlers
    const store = new Store({ name: `${thisBrain}` })
    const FASK_rooms = store.get('socketRooms')
    const FASK_titanState = store.get('brain_ThargoidSample.currentTitanState')
    if (!store.get('Fileheader')) { store.set('Fileheader',false) }
    if (!store.get('redisFirstUpdateflag')) { store.set('redisFirstUpdateflag',false) }
    if (!store.get('marketJSON')) { store.set('marketJSON',false) }
    if (!store.get('systemAddress')) { store.set('systemAddress',false) }
    if (!store.get('thisSampleSystem')) { store.set('thisSampleSystem',false) }
    if (!store.get('activeStarSystem')) { store.set('activeStarSystem',false) }
    if (!store.get('currentCarrierMarket')) { store.set('currentCarrierMarket',false) }
    let thargoidSampling = {}
    //!                   List all events that will be looked for by this brain.
    const eventNames = [
      "MarketJSON",
      "Fsd Charging",
      // "CollectCargo",
      // "EjectCargo",
      // "MarketSell",
      "MarketBuy",
      "Shutdown",
      // "Fileheader",
      // "LaunchDrone",
      // "StartJump",
      "FSDTarget",
      // "NavRouteClear",
      "FSSSignalDiscovered",
      // "Docked",
      "DockingRequested",
      "DockingGranted",
      "DockingCancelled",
      // "Undocked",
      "FactionKillBond",
      "CarrierJumpRequest",
      "CarrierJump",
      "CarrierJumpCancelled",
      "CarrierNameChanged",
      "USSDrop",
      "Music",
      // "ReceiveText",
      "Supercruise",
      "Fsd Charging",
      "SystemMap",
      "GalaxyMap",
      "SupercruiseExit",
      "SupercruiseEntry",
      "SupercruiseDestinationDrop",
      "Died",
      "Ressurect",
      "HullDamage",
      "Interdicted",
      "HeatWarning",
      "BuyDrones",
      "SystemsShutdown",
      // "CargoTransfer",
    ]
    //!                   Events that must be present in the store for thargoid sample to fire to redis.
    let launchToRedis = [
      'Fileheader',
      'LaunchDrone',
      'Cargo',
      'Location',
      'Commander',
      'Loadout',
    ]
    let currentSystemState = "";
    let FID = getCommander().FID
    let FSDChargeCount = 0
    let supercruiseCount = 0;
    let guifocus = 0;
    let wingSetupCount = 0
    let launchQueue = []
    let launchQueueNum = launchQueue.length
    let inprog = 0
    //!BRAIN EVENTs######################################################
    app.on('window-all-closed', () =>{ store.set('redisFirstUpdateflag',false) })
    ipcMain.on(thisBrain, async (receivedData) => {
      // logs(`${receivedData.event}`.cyan)
      // store.set('masterTimestamp',receivedData.timestamp)
      if (receivedData.event == 'template') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('thisSampleSystem'), "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
            if (store.get('redisFirstUpdateflag')) { 
              blastToUI(compiledArray)
              brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
            }
          }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'WingJoin') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('thisSampleSystem'), "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
            if (store.get('redisFirstUpdateflag')) { 
              inWingStuff(receivedData.timestamp,1)
            }
          }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'WingLeave') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('thisSampleSystem'), "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
            if (store.get('redisFirstUpdateflag')) { 
              inWingStuff(receivedData.timestamp,0)
            }
          }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'Status') {
        // Setup initial wing to the JSON file.
        if (wingSetupCount == 0) {
          if (!store.get('wingStatus')) {
            if (receivedData.Flags1.includes('In Wing')) { inWingStuff(receivedData.timestamp,1); wingSetupCount = 1 }
            else { inWingStuff(receivedData.timestamp,0); wingSetupCount = 1 }
          }
        }
        
        // logs("====================================")
        //Viewing GalaxyMap
        if (receivedData.GuiFocus == 6 && eventNames.includes('GalaxyMap') && guifocus != 6) { guifocus = 6
          try {
            let compiledArray = { "event": "GalaxyMap", "brain": thisBrain, "combinedData": {"status":1,"timestamp":receivedData.timestamp}, "systemAddress": store.get('systemAddress'), "FID": FID }
            compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
            if (store.get('redisFirstUpdateflag')) {
              blastToUI(compiledArray)
              brain_ThargoidSample_socket(compiledArray,"GalaxyMap",findActiveSocketKey(FASK_rooms,FASK_titanState))
            }
          }
          catch(e) { errorHandler(e,e.name)}
        }
        if (receivedData.GuiFocus == 0 && eventNames.includes('GalaxyMap') && guifocus == 6) { guifocus = 0
          try {
            let compiledArray = { "event": "GalaxyMap", "brain": thisBrain, "combinedData": {"status":0,"timestamp":receivedData.timestamp}, "systemAddress": store.get('systemAddress'), "FID": FID }
            compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
            if (store.get('redisFirstUpdateflag')) {
              blastToUI(compiledArray)
              brain_ThargoidSample_socket(compiledArray,"GalaxyMap",findActiveSocketKey(FASK_rooms,FASK_titanState))
            }
          }
          catch(e) { errorHandler(e,e.name)}
        }
        //Viewing SystemMap
        if (receivedData.GuiFocus == 7 && eventNames.includes('SystemMap') && guifocus != 7) { guifocus = 7
          try {
            let compiledArray = { "event": "SystemMap", "brain": thisBrain, "combinedData": {"status":1,"timestamp":receivedData.timestamp}, "systemAddress": store.get('systemAddress'), "FID": FID }
            compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
            if (store.get('redisFirstUpdateflag')) {
              blastToUI(compiledArray)
              brain_ThargoidSample_socket(compiledArray,"SystemMap",findActiveSocketKey(FASK_rooms,FASK_titanState))
            }
          }
          catch(e) { errorHandler(e,e.name)}
        }
        if (receivedData.GuiFocus == 0 && eventNames.includes('SystemMap') && guifocus == 7) { guifocus = 0
          try {
            let compiledArray = { "event": "SystemMap", "brain": thisBrain, "combinedData": {"status":0,"timestamp":receivedData.timestamp}, "systemAddress": store.get('systemAddress'), "FID": FID }
            compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
            if (store.get('redisFirstUpdateflag')) {
              blastToUI(compiledArray)
              brain_ThargoidSample_socket(compiledArray,"SystemMap",findActiveSocketKey(FASK_rooms,FASK_titanState))
            }
          }
          catch(e) { errorHandler(e,e.name)}
        }
        //Supercruise
        if (receivedData.Flags1.includes('Supercruise') && eventNames.includes('Supercruise') && supercruiseCount < 1) {
          try {
            let compiledArray = { "event": 'Supercruise', "brain": thisBrain, "combinedData": {"status":1,"timestamp":receivedData.timestamp,"activeStarSystem":store.get('activeStarSystem')}, "systemAddress": store.get('systemAddress'), "FID": FID }
            compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
            if (store.get('redisFirstUpdateflag')) {
              blastToUI(compiledArray)
              brain_ThargoidSample_socket(compiledArray,'Supercruise',findActiveSocketKey(FASK_rooms,FASK_titanState))
            }
              supercruiseCount++
              FSDChargeCount = 0;
            }
          catch(e) { errorHandler(e,e.name)}
        }
        if (!receivedData.Flags1.includes('Supercruise') && eventNames.includes('Supercruise') && supercruiseCount >= 1) { 
          supercruiseCount = 0
          FSDChargeCount = 0
        }
        //FSD Charging 
        if (receivedData.Flags1.includes('Fsd Charging') && eventNames.includes('Fsd Charging') && FSDChargeCount < 1) {
          try {
            let compiledArray = { "event": 'StartJump_Charging', "brain": thisBrain, "combinedData": {"status":1,"timestamp":receivedData.timestamp}, "systemAddress": store.get('systemAddress'), "FID": FID }
            compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
              if (store.get('redisFirstUpdateflag')) {
                // const indexToRemove = eventNames.indexOf('FSDTarget');
                // if (indexToRemove !== -1) { eventNames.splice(indexToRemove, 1); }
                // setTimeout(()=>{ eventNames.push('FSDTarget') },5000)
  
                // const indexToRemove2 = eventNames.indexOf('Fsd Charging');
                // if (indexToRemove !== -1) { eventNames.splice(indexToRemove, 1); }
                // setTimeout(()=>{ eventNames.push('Fsd Charging') },5000)
                
                blastToUI(compiledArray)
                brain_ThargoidSample_socket(compiledArray,'StartJump_Charging',findActiveSocketKey(FASK_rooms,FASK_titanState))
              }
              FSDChargeCount++
              // logs("FSDChargeCount",FSDChargeCount)
            }
          catch(e) { errorHandler(e,e.name)}
        }
        if (!receivedData.Flags1.includes('Fsd Charging') && !receivedData.Flags1.includes('Supercruise') && FSDChargeCount >= 1) { 
          FSDChargeCount = 0
          // logs("FSDChargeCount",FSDChargeCount)
          let compiledArray = { "event": 'StartJump_Charging', "brain": thisBrain, "combinedData": {"status":0,"timestamp":receivedData.timestamp}, "systemAddress": store.get('systemAddress'), "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
  
            if (store.get('redisFirstUpdateflag')) {
              // const indexToRemove = eventNames.indexOf('FSDTarget');
              // if (indexToRemove !== -1) { eventNames.splice(indexToRemove, 1); }
              // setTimeout(()=>{ eventNames.push('FSDTarget') },5000)
  
              // const indexToRemove2 = eventNames.indexOf('Fsd Charging');
              // if (indexToRemove !== -1) { eventNames.splice(indexToRemove, 1); }
              // setTimeout(()=>{ eventNames.push('Fsd Charging') },5000)
              
              blastToUI(compiledArray)
              brain_ThargoidSample_socket(compiledArray,'StartJump_Charging',findActiveSocketKey(FASK_rooms,FASK_titanState))
            }
        }
        // -------------------------- TEST CODE BELOW
        // console.log("status test code:",receivedData.Flags1.includes('Lights On'),FID,windowItemsStore.get('specifyDev'))
        if (receivedData.Flags1.includes('Lights On') && windowItemsStore.get('specifyDev')) {
          checkSetupFlag("LIGHTS ON!!!!");
          const indexToRemove = launchToRedis.indexOf('FSDJump');
          if (indexToRemove !== -1) { launchToRedis.splice(indexToRemove, 1); }
          let combinedData = {}
          let compiledArray = {
            "event": "reset",
            "brain": thisBrain,
            "systemAddress": store.get('thisSampleSystem'),
            "combinedData": combinedData, 
            "FID": FID
          }
          store.set('redisFirstUpdateflag',false)
          const response = await brain_ThargoidSample_socket(compiledArray,compiledArray.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
          logs("RESET:".bgCyan,logF(response)),"redisFirstUpdateflag:",store.get('redisFirstUpdateflag')
          const sendIt = { "event":"reset","systemAddress":store.get('systemAddress'),"FID": FID }
          blastToUI(sendIt)
        }
        // -------------------------- TEST CODE ABOVE
      }
      if (receivedData.event == 'CollectCargo') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          if (currentSystemState != "") {
            let compiledArray = { "event": receivedData.event, "brain": thisBrain, "systemAddress": store.get('systemAddress'),"combinedData": receivedData, "FID": FID }
            thargoidSampling[receivedData.event] = compiledArray
            if (store.get('redisFirstUpdateflag')) {
              compiledArray.combinedData["thisSampleSystem"] = store.get('systemAddress')
              store.set('thisSampleSystem',store.get('systemAddress'))
              blastToUI(compiledArray)
              brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
            }
          }
        }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'EjectCargo') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          if (currentSystemState != "") {
            let compiledArray = { "event": receivedData.event, "brain": thisBrain, "systemAddress": store.get('systemAddress'),"combinedData": receivedData, "FID": FID }
            thargoidSampling[receivedData.event] = compiledArray
            if (store.get('redisFirstUpdateflag') && store.get('thisSampleSystem') == store.get('systemAddress')) {
              compiledArray.combinedData["thisSampleSystem"] = store.get('systemAddress')
              blastToUI(compiledArray)
              brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
            }
          }
        }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'Cargo') {
        //! This is from the Cargo.json file, it will not be iterated on during the initial load.
        //! Cargo will only change if there's a Buy, Sell, Transfer, Collection, Ejection, or Launch.
        //! Simply put, it is not necessary and will impede counting if its iterated on during initial launch of epl.
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try{
          
          let combinedData = { "sampleCargo":[],"SampleCargoCount":0,"notSampleCargoCount":0,"notSampleCargo": [],"limpets": 0 }
          let compiledArray = {
            "event": receivedData.event,
            "brain": thisBrain,
            "systemAddress": store.get('systemAddress'),
            "combinedData": combinedData, 
            "FID": FID
          }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
          const itemSearchTable = dataHistory("itemSearchTable")
          receivedData.Inventory.forEach(item => {
            item['Name_Cargo'] = item.Name
            specificItem = findMatObject(itemSearchTable.marketData, "Name_Cargo",item.Name_Cargo)
            if (item.Name == "drones") { combinedData.limpets = item.Count }
            if (specificItem != null && specificItem.Name_Cargo == item.Name_Cargo) {
              // logs(item.Name,"FOUND".green)
              // logs(colorize(specificItem, { pretty: true }))
              combinedData.sampleCargo.push(item)
              combinedData.SampleCargoCount = combinedData.SampleCargoCount + item.Count
            }
            else {
              // logs(item.Name,"NOT FOUND".red)
              // logs(colorize(item, { pretty: true }))
              combinedData.notSampleCargo.push(item)
              combinedData.notSampleCargoCount = combinedData.notSampleCargoCount + item.Count
            }
          })
          compiledArray.combinedData.timestamp = receivedData.timestamp
          // logs("NOT FOUND ARRAY".yellow)
          // logs(colorize(compiledArray.combinedData.notSampleCargo, { pretty: true }))
          // logs(colorize(compiledArray, { pretty: true }))
          // if (redisFirstUpdateflag) { ipcMain.emit(`event-callback-${receivedData.event}`,compiledArray) }
          thargoidSampling[receivedData.event] = compiledArray
          store.set('cargo',compiledArray)
          if (store.get('redisFirstUpdateflag')) { 
            blastToUI(compiledArray)
            brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
          }
        }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'Commander') {
        // logs("2".red)
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try{
          // used to clear the variable on a soft exit to the menu.
          //JSON Files log files will always have first priority.
          thargoidSampling = {}
          store.set('redisFirstUpdateflag',false);
          currentSystemState = "";
          const indexToRemove = launchToRedis.indexOf('FSDJump');
          if (indexToRemove !== -1) {
            launchToRedis.splice(indexToRemove, 1);
          }
          //JSON Files log files will always have first priority.
          //
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "systemAddress": store.get('systemAddress'), "combinedData": receivedData, "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
          // if (store.get('redisFirstUpdateflag')) { ipcMain.emit(`event-callback-${receivedData.event}`,compiledArray) }
          thargoidSampling["Cargo"] = store.get('cargo')
          thargoidSampling[receivedData.event] = compiledArray
        }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'Loadout') {
        // logs("4".red)
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try{
          const itemSearchTable = dataHistory("itemSearchTable")
          let specificItem = null;
          let cargoLoadout = {
            ship: receivedData.Ship,
            causticProtection: 0,
            cargoCapacity: receivedData.CargoCapacity,
            researchLimpetControllers: 0,
          }
          receivedData.Modules.forEach(i=>{
            const keysToFindFromItemSearchTable = [
              'cargoracks',
              'researchControllers'
            ]
            keysToFindFromItemSearchTable.forEach(key=>{
              specificItem = findMatObject(itemSearchTable[key], "name",i.Item)
              if (specificItem) {
                if (specificItem.causticProtect) { 
                  cargoLoadout.causticProtection = cargoLoadout.causticProtection + specificItem.capacity
                }
                if (specificItem.maximumLimpet) {
                  cargoLoadout.researchLimpetControllers = cargoLoadout.researchLimpetControllers + specificItem.maximumLimpet
                }
              }
            })
          })
  
          let compiledArray = {  "event": receivedData.event, "brain": thisBrain, "systemAddress": store.get('systemAddress'), "combinedData": cargoLoadout, "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
          compiledArray.combinedData.timestamp = receivedData.timestamp
          thargoidSampling[receivedData.event] = compiledArray
          if (store.get('redisFirstUpdateflag')) {
            blastToUI(compiledArray)
            brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState)) 
          }
          if (store.get('redisFirstUpdateflag') && compiledArray.combinedData.causticProtection == 0 && compiledArray.combinedData.researchLimpetControllers == 0) {
            thargoidSampling = {}
            store.set('redisFirstUpdateflag',false);
            currentSystemState = "";
            const indexToRemove = launchToRedis.indexOf('FSDJump');
            if (indexToRemove !== -1) {
              launchToRedis.splice(indexToRemove, 1);
            }
          }
        }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'Docked') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('systemAddress'), "FID": FID }
          store.set('currentCarrierMarket',receivedData.MarketID)
          compiledArray.combinedData["stationType"] = receivedData.StationType
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
          if (store.get('redisFirstUpdateflag')) { 
            blastToUI(compiledArray)
            brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
          }
        }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'Undocked') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          store.set('currentCarrierMarket',receivedData.MarketID)
          thargoidSampling['stationType'] = false
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('systemAddress'), "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
          if (store.get('redisFirstUpdateflag')) { 
            blastToUI(compiledArray)
            brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
          }
        }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'Location') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try{
          
          const propCheck = [
            'DistFromStarLS',
            'Docked',
            'StationName',
            'StationType',
            'MarketID',
            'StarSystem',
            'SystemAddress',
            'StarPos',
            'SystemSecurity_Localised',
            'Population',
            'ThargoidWar',
            'timestamp',
          ]
          let combinedData = {}
          const thisSampleSystem = store.get('thisSampleSystem')
          store.set('systemAddress',receivedData.SystemAddress) 
          store.set('activeStarSystem',receivedData.StarSystem) 
          currentSystemState = "";
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "systemAddress": receivedData.SystemAddress, "combinedData":combinedData, "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = thisSampleSystem
          if (receivedData.Docked && receivedData.StationType == 'FleetCarrier') { 
            store.set('currentCarrierMarket',receivedData.MarketID)
          }
          propCheck.forEach(ele => {
            if (receivedData.hasOwnProperty(ele)) {
              if (ele == "ThargoidWar") {
                combinedData['WarProgress'] = receivedData.ThargoidWar.WarProgress
                combinedData['CurrentState'] = receivedData.ThargoidWar.CurrentState
                currentSystemState = combinedData.CurrentState;
              }
              else { combinedData[ele] = receivedData[ele] }
            }
          })
          let nearestTitanToCmdr = distances(combinedData.StarPos,'titanLocation')
          const [titan,ly] = Object.entries(nearestTitanToCmdr)[0]
          nearestTitanToCmdr = {[titan]:ly}
          combinedData.nearestTitan = nearestTitanToCmdr
          thargoidSampling[receivedData.event] = compiledArray
          if (!receivedData.hasOwnProperty("DistFromStarLS")) {
            compiledArray.combinedData["DistFromStarLS"] = 0
          }
          //Send location to server regardless
          //! Relog Handling
          if (thisSampleSystem) {
            if (receivedData.SystemAddress == thisSampleSystem) {
              compiledArray.combinedData.SystemAddress = receivedData.SystemAddress
            }
            if (receivedData.SystemAddress != thisSampleSystem) {
              compiledArray.combinedData.SystemAddress = thisSampleSystem
            }
            
            updateCurrentTitanSocket(compiledArray)
            const response = await brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
            const broadcastability = response.find(item =>  item.hasOwnProperty('presentFID')).presentFID
            const timestamp = response.find(item =>  item.hasOwnProperty('timestamp')).timestamp
            const [timeDifference,timestampMaxAge] = masterTimestamp(timestamp,0) //second parameter is a console log
  
            if (broadcastability != null && timeDifference <= timestampMaxAge) { 
              // logs("Previous Sampling System and less than 2 hours:",broadcastability && timeDifference <= timestampMaxAge);
              store.set('redisFirstUpdateflag',true); 
              blastToUI(compiledArray)
            }
            else {store.set('redisFirstUpdateflag',false);}
            //! For Console display:
            //! For Console display:
            const showJumps = 0
            //! For Console display:
            //! For Console display:
            if (showJumps) {
              const request = [
                {
                  "from": "brain-ThargoidSample",
                  "description":`population: ${receivedData.event}`,
                  "type": "redisRequest",
                  "method": "GET",
                  "data": {
                    "dcohSystems": [
                      "$.systems[*].systemAddress",
                      "$.systems[*].populationOriginal",
                    ]
                  },
                  "keys": [
                    "systemAddress",
                    "populationOriginal",
                    
                  ]
                }
              ]
              let stuff = {
                "timestamp": receivedData.timestamp,
                "System": combinedData.StarSystem, 
                "SystemAddress": combinedData.SystemAddress, 
                "WarProgress": combinedData.WarProgress, 
                "State":combinedData.CurrentState ? combinedData.CurrentState: "Clean",
              }
              eventDataStore(request[0], (message) => {
                if (!message) { logs("[EDL]".red,"DCOH Cache empty.")}
                message.response.redisResult.forEach(item => {
                  if (item.systemAddress == receivedData.SystemAddress) {
                    stuff["Original Population"] = item.populationOriginal
                    stuff[`LY to ${titan}`] = Object.values(combinedData.nearestTitan)[0] ? Object.values(combinedData.nearestTitan)[0] : ""
                    
                    logs("[EDL]".red,receivedData.event,logF(stuff))
                  }
                })
              })
            }
          }
        }
        catch(e) { errorHandler(e,e.name) }
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'FSDJump' || receivedData.event == 'CarrierJump') {
        try {
          supercruiseCount = 0;
          if (store.get('thisSampleSystem') == receivedData.SystemAddress) {
            store.set('redisFirstUpdateflag',true)
          }
          const propCheck = [
            'SystemAddress',
            'StarSystem',
            'ThargoidWar',
            'Population',
            'StarPos',
            'SystemSecurity_Localised',
            'timestamp',
          ]
          let combinedData = {}
          currentSystemState = ""
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "systemAddress": store.get('systemAddress'), "combinedData":combinedData, "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
          propCheck.forEach(ele => {
            if (receivedData.hasOwnProperty(ele)) {
              if (ele == "ThargoidWar") {
                combinedData['WarProgress'] = receivedData.ThargoidWar.WarProgress
                combinedData['CurrentState'] = receivedData.ThargoidWar.CurrentState
                currentSystemState = compiledArray.combinedData.CurrentState;
              }
              else { combinedData[ele] = receivedData[ele] }
            }
          })
          let nearestTitanToCmdr = distances(compiledArray.combinedData.StarPos,'titanLocation')
          const [titan,ly] = Object.entries(nearestTitanToCmdr)[0]
          nearestTitanToCmdr = {[titan]:ly}
          compiledArray.combinedData.nearestTitan = nearestTitanToCmdr
          //Begin the saving process...
          thargoidSampling[receivedData.event] = compiledArray
          let saveBrain = []
          //Only save current system information that is gathered.
          saveBrain["Commander"] = thargoidSampling.Commander 
          saveBrain["Loadout"] = thargoidSampling.Loadout 
          saveBrain["FSDJump"] = thargoidSampling.FSDJump 
          saveBrain["Location"] = thargoidSampling.Location
          saveBrain["Cargo"] = store.get('cargo')
          //Clear old accrued data from every event that has occured.
          thargoidSampling = saveBrain
          //Insert current information
          saveBrain.forEach(i=>{ thargoidSampling[Object.keys(i)[0]] = i })
          blastToUI(compiledArray)
          
          // if (combinedData.CurrentState != '' && store.get('thisSampleSystem') != receivedData.SystemAddress) {
            // store.set('redisFirstUpdateflag',false)
          if (combinedData.CurrentState != '') {
            launchToRedis.push('FSDJump')
          }
          //Send location to server regardless
          //Conditions are now set if this is a system that is differen't from previous sampling system.
          store.set('systemAddress',receivedData.SystemAddress)
          store.set('activeStarSystem',receivedData.StarSystem) 
          // updateCurrentTitanSocket(compiledArray)
          brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
          
    
          //! For Console display:
          //! For Console display:
          const showJumps = 1
          //! For Console display:
          //! For Console display:
          if (showJumps) {
            
            const request = [
              {
                "from": "brain-ThargoidSample",
                "description":`population: ${receivedData.event}`,
                "type": "redisRequest",
                "method": "GET",
                "data": {
                  "dcohSystems": [
                    "$.systems[*].systemAddress",
                    "$.systems[*].populationOriginal",
                  ]
                },
                "keys": [
                  "systemAddress",
                  "populationOriginal",
                ]
              }
            ]
            let stuff = {
              "timestamp": receivedData.timestamp,
              "System": combinedData.StarSystem, 
              "SystemAddress": combinedData.SystemAddress, 
              "WarProgress": combinedData.WarProgress, 
              "State":combinedData.CurrentState ? combinedData.CurrentState : "Clean",
            }
            eventDataStore(request[0], (message) => {
              if (!message) { logs("[EDL]".red,"DCOH Cache empty.")}
              message.response.redisResult.forEach(item => {
                if (item.systemAddress == receivedData.SystemAddress) {
                  stuff["Original Population"] = item.populationOriginal
                  stuff[`LY to ${titan}`] = Object.values(combinedData.nearestTitan)[0] ? Object.values(combinedData.nearestTitan)[0] : ""
                  // logs(colorize(stuff, { pretty: true }))
                  logs("[EDL]".red,receivedData.event,logF(stuff))
                }
              })
            })
          }
        }
        catch(e) { logs(e) }
      }
      if (receivedData.event == 'ShipyardSwap') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try{
          let combinedData = {
            "ShipType": receivedData.shipType,
            "ShipType_Localised": receivedData.ShipType_Localised,
          }
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "systemAddress": store.get('systemAddress'), "combinedData": combinedData, "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
          compiledArray.combinedData.timestamp = receivedData.timestmap
          if (store.get('redisFirstUpdateflag')) { ipcMain.emit(`event-callback-${receivedData.event}`,compiledArray) }
          
          thargoidSampling[receivedData.event] = compiledArray
          if (store.get('redisFirstUpdateflag')) { 
            // blastToUI(compiledArray)
          }
        }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'Market') {
        store.set('currentCarrierMarket',receivedData.MarketID)
        let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('systemAddress'), "FID": FID }
        compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
        thargoidSampling[receivedData.event] = compiledArray
      }
      if (receivedData.event == 'MarketJSON') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          // const searchFor = [
          //   {
          //     id: 128824468,
          //     Name: '$thargoidscouttissuesample_name;',
          //     Name_Localised: 'Thargoid Scout Tissue Sample'
          //   }
          // ]
          const itemSearchTable = dataHistory("itemSearchTable")
          let combinedData = { marketSample: [] }
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": combinedData, "systemAddress": store.get('systemAddress'), "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
          receivedData.Items.forEach(item => {
            specificItem = findMatObject(itemSearchTable.marketData, "id",item.id)
            if (specificItem) {
              combinedData.marketSample.push({
                Name: item.Name,
                Name_Localised: item.Name_Localised,
                Name_Cargo: specificItem.Name_Cargo,
                id: item.id,
                MarketID: receivedData.MarketID,
                StationName: receivedData.StationName,
                StarSystem: receivedData.StarSystem,
                DemandBracket: item.DemandBracket,
                Demand: item.Demand,
                StockBracket: item.StockBracket,
                Stock: item.Stock,
                BuyPrice: item.BuyPrice,
              })
            }
            else {
              // logs("no",item.id)
            }
          })
          thargoidSampling[receivedData.event] = compiledArray
          store.set('marketJSON',compiledArray)
          if (store.get('redisFirstUpdateflag')) { 
            blastToUI(compiledArray)
            brain_ThargoidSample_socket(compiledArray,'Market',findActiveSocketKey(FASK_rooms,FASK_titanState))
          }
        }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'CargoTransfer') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('systemAddress'), "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
          compiledArray.combinedData["stationType"] = 'FleetCarrier'
          let samplesTransferedToCarrier = 0
          compiledArray.combinedData.Transfers.forEach(item => {
            const searchItem = isWordPresent(item.Type,"thargoidscouttissuesample")
            if (searchItem && item.Direction == "tocarrier") {
              samplesTransferedToCarrier = samplesTransferedToCarrier + item.Count
            }
            if (searchItem && item.Direction == "toship") {
              samplesTransferedToCarrier = samplesTransferedToCarrier - item.Count
            }
          })
          compiledArray.combinedData["Type_Localised"] = 'Samples'
          compiledArray.combinedData['Count'] = samplesTransferedToCarrier
          if (store.get('redisFirstUpdateflag') && samplesTransferedToCarrier != 0) { 
            // Selling to a Fleet Carrier
            
            blastToUI(compiledArray)
            brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
          }
        }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'MarketSell') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('systemAddress'), "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
          // console.log(colorize(compiledArray,{pretty: true}))
          // console.log(store.get('currentCarrierMarket'))
          const stationType = Object.values(thargoidSampling.Market)[2].StationType
          const sampleCount = Object.values(thargoidSampling).find(i=>i.event === 'Cargo').combinedData.SampleCargoCount
          
          thargoidSampling[receivedData.event] = compiledArray
          const cargo = store.get('cargo')
          const market = store.get('marketJSON')
          let demand = null
          cargo.combinedData.sampleCargo.forEach(sample => {
            let specificItem = market.combinedData.marketSample.find(item => item.Name_Cargo === sample.Name)
            if (specificItem && compiledArray.combinedData.Type == specificItem.Name_Cargo) {
              demand = specificItem.Demand - compiledArray.combinedData.Count
              if (demand < 0) { demand = 0 }
              // specificItem["Demand"] = demand
              //todo Need to update specificItem.Demand with the new demand value. Incase somebody only sells a portion of the total.
              //todo Currently, its coded to update the whole total to 0 demand once Sold. So doing marketSell twice will result in an incorrect Demand value on the UI
            }
          })
          compiledArray.combinedData['Demand'] = demand
          compiledArray.combinedData['stationType'] = stationType
  
          if (store.get('redisFirstUpdateflag') && sampleCount >= 0) {
            blastToUI(compiledArray)
            brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
          }
        }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'LaunchDrone') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          //todo NEED TO REVIEW THE LOADOUT FROM thargoidSampling array BEFORE ALLOWING THIS TO FIRE
          if (currentSystemState != "") {
            let compiledArray = { "event": receivedData.event, "brain": thisBrain, "systemAddress": store.get('systemAddress'), "combinedData": receivedData, "FID": FID }
            if (!thargoidSampling.Cargo) {  thargoidSampling["Cargo"] = store.get('cargo') }
            if (!thargoidSampling.Fileheader) { thargoidSampling["Fileheader"] = store.get('Fileheader') }
            thargoidSampling[receivedData.event] = compiledArray
            thargoidSampling["InWing"] = store.get('wingStatus')
            store.set('thisSampleSystem',store.get('systemAddress'))
            compiledArray.combinedData["thisSampleSystem"] = store.get('systemAddress')
  
            launchQueue.push(compiledArray)
            async function processLaunchQueue() {
              for (const launchItem of launchQueue) {
                if (!launchItem.processed) {
                  // console.log("Add compiledArray".blue, launchItem.combinedData.timestamp.split("+")[1], launchItem);
                  // console.log("Add compiledArray".blue, launchItem.combinedData.timestamp.split("+")[1], launchItem.combinedData.timestamp);
                  launchItem.processed = true; // Mark as processed to avoid duplicates
                  
                  // console.log("Start Sequence:".yellow, launchItem.combinedData.timestamp.split("+")[1]);
  
                  const sendIt = {"event":"Initialize-Client","systemAddress":store.get('systemAddress'),"FID": FID,"events":Object.values(thargoidSampling)}
                  let response = null;
                  
                  response = await redisUpdaterSetup(receivedData.event,thargoidSampling,launchItem,sendIt)
                  // const presentFID = response.find(item => item.hasOwnProperty('presentFID')).presentFID
                  const presentFID = response.ret[3]
                  // console.log(response.ret[3])
                  if (presentFID) {
                    // console.log("presentFID:".green, presentFID)
                    store.set('redisFirstUpdateflag',true)
                    blastToUI(launchItem); 
                  }
                }
              }
            }
            async function processLaunchItems() {
              for (const launchItem of launchQueue) {
                processLaunchQueue(launchItem);
                  await new Promise(resolve => setTimeout(resolve, 5000)); // Add a delay between processing each launch item
              }
            }
            processLaunchItems()
          }
        }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'Shutdown') {
        thargoidSampling = {}
        currentSystemState = "";
        FSDChargeCount = 0
        supercruiseCount = 0;
        guifocus = 0;
        const indexToRemove = launchToRedis.indexOf('FSDJump');
        if (indexToRemove !== -1) { launchToRedis.splice(indexToRemove, 1); }
        let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('systemAddress'), "FID": FID }
        compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
        compiledArray.combinedData["systemName"] = store.get('activeStarSystem')
        if (store.get('redisFirstUpdateflag')) {
          inWingStuff(receivedData.timestamp,0)
          blastToUI(compiledArray)
          brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
          store.set('redisFirstUpdateflag',false);
        }
      }
      if (receivedData.event == 'SupercruiseDestinationDrop') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('systemAddress'), "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
  
            if (store.get('redisFirstUpdateflag')) {
              const indexToRemove = eventNames.indexOf('SupercruiseExit');
              if (indexToRemove !== -1) { eventNames.splice(indexToRemove, 1); }
              setTimeout(()=>{ eventNames.push('SupercruiseExit') },10000)
              blastToUI(compiledArray)
              brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
            }
          }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'StartJump') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('systemAddress'), "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
  
            if (store.get('redisFirstUpdateflag')) {
              const indexToRemove = eventNames.indexOf('FSDTarget');
              if (indexToRemove !== -1) { eventNames.splice(indexToRemove, 1); }
              if (FSDChargeCount == 0) { eventNames.push('FSDTarget') }
              
              blastToUI(compiledArray)
              brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
            }
          }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'NavRouteClear') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try {
          let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('systemAddress'), "FID": FID }
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
  
            if (store.get('redisFirstUpdateflag')) {
              supercruiseCount = 0
              blastToUI(compiledArray)
              brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
            }
          }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      if (receivedData.event == 'Fileheader') {
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
        try { 
          let compiledArray = { 
            "event": receivedData.event, 
            "brain": thisBrain, 
            "combinedData": receivedData, 
            "systemAddress": store.get('systemAddress'), 
            "FID": FID 
          } 
          compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
          compiledArray.combinedData['logFile'] = await updatePreviousMaxLines([0,1])
          compiledArray.combinedData.logFile[0].firstLoad['timestamp'] = compiledArray.combinedData.logFile[0].firstLoad.timestamp + "+1"
          thargoidSampling[receivedData.event] = compiledArray
          store.set('Fileheader',compiledArray)
          brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
          }
        catch(e) { errorHandler(e,e.name)}
        if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
      }
      else {
        eventNames.forEach(eventName =>{
          if (receivedData.event === eventName) {
            if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Wait`.yellow); }
            try {
              let compiledArray = { "event": receivedData.event, "brain": thisBrain, "combinedData": receivedData, "systemAddress": store.get('systemAddress'), "FID": FID }
              compiledArray.combinedData["thisSampleSystem"] = store.get('thisSampleSystem')
              if (store.get('redisFirstUpdateflag')) {
                blastToUI(compiledArray)
                brain_ThargoidSample_socket(compiledArray,receivedData.event,findActiveSocketKey(FASK_rooms,FASK_titanState))
              }
            }
            catch(e) { errorHandler(e,e.name)}
            if (watcherConsoleDisplay('BrainEvent') && visible) { logs("[BE TS]".bgCyan,`${receivedData.event} Comp`.green); }
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
    errorHandler(error,error.name)
  }
  
  
  
  
  
  
  
  
  
  // if (store.get('redisFirstUpdateflag')) { ipcMain.emit(`event-callback-${receivedData.event}`,compiledArray) }