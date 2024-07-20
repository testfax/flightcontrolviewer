try {  
    const { contextBridge, ipcRenderer } = require('electron')
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
  }
  catch(e) { console.log(e) }