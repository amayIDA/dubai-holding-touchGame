const { app, BrowserWindow, session, protocol, net, ipcMain } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
protocol.registerSchemesAsPrivileged([{ scheme: 'glowtap', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
function openGame() {
  const win = new BrowserWindow({ width: 1440, height: 960, minWidth: 700, minHeight: 560, title: '5K LED Run - Glow Tap', fullscreen: true, backgroundColor: '#08051d', autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, preload: path.join(__dirname,'preload.cjs') } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith('glowtap://game/')) event.preventDefault(); });
  win.webContents.on('before-input-event', (event, input) => {
    if(input.type==='keyDown'&&input.control&&input.key.toLowerCase()==='r'){event.preventDefault();win.webContents.send('players:reset-request');return;}
    if (input.type === 'keyDown' && input.key.toLowerCase() === 'f' && input.meta && input.control) { win.setFullScreen(!win.isFullScreen()); event.preventDefault(); }
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); event.preventDefault(); }
    if (input.type === 'keyDown' && input.key === 'Escape' && win.isFullScreen()) win.setFullScreen(false);
  });
  win.loadURL('glowtap://game/index.html');
}
app.whenReady().then(() => {
  const store=require('./player-store.cjs').createPlayerStore(path.join(app.getPath('documents'),'Glow Tap'));
  ipcMain.handle('players:save',(event,record)=>{if(!event.senderFrame.url.startsWith('glowtap://game/'))throw Error('Invalid sender');return store.save(record);});
  ipcMain.handle('players:reset',event=>{if(!event.senderFrame.url.startsWith('glowtap://game/'))throw Error('Invalid sender');return store.reset();});
  ipcMain.handle('game:config',async event=>{if(!event.senderFrame.url.startsWith('glowtap://game/'))throw Error('Invalid sender');const fs=require('node:fs/promises');const folder=app.isPackaged?(process.env.PORTABLE_EXECUTABLE_DIR||path.dirname(app.getPath('exe'))):path.resolve(__dirname,'..');const file=path.join(folder,'game-config.json');try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(error){if(error.code==='ENOENT'){const defaults={gameTimeSeconds:30};await fs.writeFile(file,JSON.stringify(defaults,null,2),'utf8');return defaults;}return{gameTimeSeconds:30};}});
  const root = path.resolve(__dirname, '../dist');
  protocol.handle('glowtap', request => {
    const url = new URL(request.url);
    if (url.host !== 'game') return new Response('Not found', { status: 404 });
    let file;
    try { file = path.resolve(root, '.' + decodeURIComponent(url.pathname)); } catch { return new Response('Bad request', { status: 400 }); }
    if (!file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  openGame();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) openGame(); });
});
app.on('window-all-closed', () => app.quit());


