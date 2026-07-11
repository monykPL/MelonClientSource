const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('accountsAPI', {
  list: () => ipcRenderer.invoke('accounts:list'),
  add: (nickname) => ipcRenderer.invoke('accounts:add', nickname),
  remove: (id) => ipcRenderer.invoke('accounts:remove', id),
  select: (id) => ipcRenderer.invoke('accounts:select', id),
  loginMicrosoft: () => ipcRenderer.invoke('accounts:loginMicrosoft'),
  pickSkin: () => ipcRenderer.invoke('accounts:pickSkin'),
  setSkin: (accountId, filePath, variant) => ipcRenderer.invoke('accounts:setSkin', accountId, filePath, variant),
  listCapes: (accountId) => ipcRenderer.invoke('accounts:listCapes', accountId),
  setActiveCape: (accountId, capeId) => ipcRenderer.invoke('accounts:setActiveCape', accountId, capeId)
});

contextBridge.exposeInMainWorld('profilesAPI', {
  list: () => ipcRenderer.invoke('profiles:list'),
  add: (payload) => ipcRenderer.invoke('profiles:add', payload),
  rename: (id, newName) => ipcRenderer.invoke('profiles:rename', id, newName),
  remove: (id) => ipcRenderer.invoke('profiles:remove', id),
  select: (id) => ipcRenderer.invoke('profiles:select', id),
  updateOptions: (id, options) => ipcRenderer.invoke('profiles:updateOptions', id, options),
  addMods: (id, mods) => ipcRenderer.invoke('profiles:addMods', id, mods),
  removeMod: (id, modId, source) => ipcRenderer.invoke('profiles:removeMod', id, modId, source),
  pickIcon: () => ipcRenderer.invoke('profiles:pickIcon'),
  openFolder: (id) => ipcRenderer.invoke('profiles:openFolder', id)
});

contextBridge.exposeInMainWorld('settingsAPI', {
  get: () => ipcRenderer.invoke('settings:get'),
  setCurseForgeKey: (key) => ipcRenderer.invoke('settings:setCurseForgeKey', key),
  setJavaPath: (javaPath) => ipcRenderer.invoke('settings:setJavaPath', javaPath)
});

contextBridge.exposeInMainWorld('curseforgeAPI', {
  search: (query) => ipcRenderer.invoke('curseforge:search', query)
});

contextBridge.exposeInMainWorld('minecraftAPI', {
  launch: (profileId) => ipcRenderer.invoke('minecraft:launch', profileId),
  kill: () => ipcRenderer.invoke('minecraft:kill'),
  onLog: (cb) => ipcRenderer.on('minecraft:log', (e, msg) => cb(msg)),
  onProgress: (cb) => ipcRenderer.on('minecraft:progress', (e, data) => cb(data)),
  onStarted: (cb) => ipcRenderer.on('minecraft:started', (e, data) => cb(data)),
  onClosed: (cb) => ipcRenderer.on('minecraft:closed', (e, code) => cb(code)),
  onError: (cb) => ipcRenderer.on('minecraft:error', (e, msg) => cb(msg))
});
