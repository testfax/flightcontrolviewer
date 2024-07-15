try {
    const { error } = require('console');
    const { contextBridge, ipcRenderer } = require('electron')
    const fs = require('fs')
    const path = require('path')
    const Store = require('electron-store');
    const storez = new Store();
  
    contextBridge.exposeInMainWorld('ipcRenderer', {
      send: (channel, data) => {
        ipcRenderer.send(channel, data);
      },
      on: (channel, func) => {
          ipcRenderer.on(channel, (event, ...args) => func(...args));
      },
      once: (channel, func) => {
        ipcRenderer.once(channel, (event, ...args) => func(...args));
      },
      removeListener: (channel, func) => {
        ipcRenderer.removeListener(channel, func);
      },
    });
    contextBridge.exposeInMainWorld('electronStoreMaterials', {
      set: (storeName, key, value) => {
        const store = new Store({ name: storeName });
        store.set(key, value);
        // console.log(storeName,key,value);
      },
      get: (storeName,key) => {
        const store = new Store({ name: storeName });
        store.get(key)
        console.log(storeName,key)
      },
    });
    contextBridge.exposeInMainWorld('electronStore', {
      get: (key) => storez.get(key),
      set: (key, value) => storez.set(key, value),
      delete: (key) => storez.delete(key),
      has: (key) => storez.has(key),
      clear: () => storez.clear(),
      get size() { return storez.size },
      get store() { return storez.store },
      onDidChange: (key, callback) => storez.onDidChange(key, callback),
      offDidChange: (key, callback) => storez.offDidChange(key, callback),
    });
    contextBridge.exposeInMainWorld('eliteEvent', {
      multiStores: getEventsArray()
    })
    async function getEventsArray() {
      // function ignoreEvents(ignoreEventName) {
      //   let ignoreEventsJSON = fs.readFileSync('./events/Appendix/ignoreEvents.json', (err) => { if (err) return console.log(err); });
      //   ignoreEventsJSON = JSON.parse(ignoreEventsJSON) 
      //   for (const event of ignoreEventsJSON.events) {
      //       if (event.event === ignoreEventName) {
      //           return event.category;
      //       }
      //   }
      //   return null; // Return null if event name not found
      // }
      // const theEvents = await fs.readFileSync('./events/Appendix/events.json','utf-8', (err) => { if (err) return console.log(err); })
      // const eventList = JSON.parse(theEvents);
   
      let eventList = null
      try {
        eventList = fs.readFileSync(path.join(process.cwd(),'resources','app','events','Appendix','events.json'),'utf-8')
      }
      catch(notreallyanerror) {
        eventList = fs.readFileSync(path.join(process.cwd(),'events','Appendix','events.json'),'utf-8')
      }
      eventList = JSON.parse(eventList); 
      
      let nameList = []
      if (eventList) { 
        eventList.events.forEach((item) => {
          nameList.push(item.event)
        })
      }
      else {
        console.log("eventList doest have shit")
      }
      const multiStores = nameList.map((name) => {
        const store = new Store({name:name})
        return {
          multiStore: {
            get: (key) => store.get(key),
            set: (key, value) => store.set(key, value),
            delete: (key) => store.delete(key),
            has: (key) => store.has(key),
            clear: () => store.clear(),
            get size() { return store.size },
            get store() { return store.store },
            onDidChange: (key, callback) => store.onDidChange(key, callback),
            offDidChange: (key, callback) => store.offDidChange(key, callback),
        },
        store,
        };
      })
  
      multiStores.forEach(({ multiStore, store }) => {
        if (!store.get('data')) {
          store.set('data',{})
        }
        // multiStore.set('key', 'value');
        // console.log(multiStore.get('key'));
      
        // store.set('key2', 'value2');
        // console.log(store.get('key2'));
      });
      return multiStores
    }
  }
  catch(e) { console.log(e) }