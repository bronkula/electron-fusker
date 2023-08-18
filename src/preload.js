const {ipcRenderer, contextBridge} = require('electron');

contextBridge.exposeInMainWorld('api', {
    send: (channel, data) => {
        ipcRenderer.send(channel, data);
    },
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    receive: (channel, func) => {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
    },
    showOpenDialog: async () => {
        const result = await ipcRenderer.invoke('show-open-dialog');
        return result;
    },
});