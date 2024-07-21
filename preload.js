try {

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
  })
  contextBridge.exposeInMainWorld('electronStoreMaterials', {
    set: (storeName, key, value) => {
      const store = new Store({ name: storeName })
      store.set(key, value)
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

  
}
catch(e) { console.log(e) }