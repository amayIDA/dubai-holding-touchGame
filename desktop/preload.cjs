const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('glowPlayers',{save:record=>ipcRenderer.invoke('players:save',record),config:()=>ipcRenderer.invoke('game:config'),reset:()=>ipcRenderer.invoke('players:reset'),onReset:callback=>ipcRenderer.on('players:reset-request',()=>callback())});
