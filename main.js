const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let MLC = null;
try {
  MLC = require('minecraft-launcher-core');
} catch (e) {
  MLC = null;
}

let MSMC = null;
try {
  MSMC = require('msmc');
} catch (e) {
  MSMC = null;
}

let Jimp = null;
try {
  Jimp = require('jimp');
} catch (e) {
  Jimp = null;
}

process.on('uncaughtException', (err) => {
  console.error('Nieobsłużony wyjątek:', err);
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('minecraft:error', `BŁĄD (nieobsłużony wyjątek): ${err && err.message ? err.message : String(err)}`);
    }
  } catch (e2) {  }
  runningGameProcess = null;
  runningGameProfileId = null;
});
process.on('unhandledRejection', (reason) => {
  console.error('Nieobsłużone odrzucenie obietnicy:', reason);
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const msg = reason && reason.message ? reason.message : String(reason);
      mainWindow.webContents.send('minecraft:error', `BŁĄD (nieobsłużone odrzucenie): ${msg}`);
    }
  } catch (e2) {  }
  runningGameProcess = null;
  runningGameProfileId = null;
});

const ACCOUNTS_FILE = path.join(app.getPath('userData'), 'accounts.json');
const PROFILES_FILE = path.join(app.getPath('userData'), 'profiles.json');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
const ICONS_DIR = path.join(app.getPath('userData'), 'icons');
const INSTANCES_DIR = path.join(app.getPath('userData'), 'instances');

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return fallback;
  }
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

function loadAccounts() { return loadJson(ACCOUNTS_FILE, { accounts: [], activeId: null }); }
function saveAccounts(d) { saveJson(ACCOUNTS_FILE, d); }

function loadProfiles() { return loadJson(PROFILES_FILE, { profiles: [], activeProfileId: null }); }
function saveProfiles(d) { saveJson(PROFILES_FILE, d); }

function loadSettings() { return loadJson(SETTINGS_FILE, { curseforgeApiKey: '', javaPath: '' }); }
function saveSettings(d) { saveJson(SETTINGS_FILE, d); }

let mainWindow;
let runningGame = { proc: null, profileId: null };

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#0d0d10',
    title: 'MelonClient',
    icon: path.join(__dirname, 'src', 'assets', process.platform === 'win32' ? 'icon.ico' : 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('accounts:list', () => loadAccounts());

ipcMain.handle('accounts:add', (event, nickname) => {
  const data = loadAccounts();
  const clean = (nickname || '').trim();
  if (!clean) throw new Error('Nick nie może być pusty');
  if (clean.length > 16) throw new Error('Nick może mieć max 16 znaków');

  const exists = data.accounts.find(a => a.nickname.toLowerCase() === clean.toLowerCase());
  if (exists) {
    data.activeId = exists.id;
    saveAccounts(data);
    return data;
  }

  const account = {
    id: Date.now().toString(),
    nickname: clean,
    type: 'offline',
    addedAt: new Date().toISOString()
  };
  data.accounts.push(account);
  data.activeId = account.id;
  saveAccounts(data);
  return data;
});

ipcMain.handle('accounts:remove', (event, id) => {
  const data = loadAccounts();
  data.accounts = data.accounts.filter(a => a.id !== id);
  if (data.activeId === id) data.activeId = data.accounts.length ? data.accounts[0].id : null;
  saveAccounts(data);
  return data;
});

ipcMain.handle('accounts:select', (event, id) => {
  const data = loadAccounts();
  const found = data.accounts.find(a => a.id === id);
  if (found) data.activeId = id;
  saveAccounts(data);
  return data;
});

ipcMain.handle('accounts:loginMicrosoft', async () => {
  if (!MSMC) {
    throw new Error('Brak biblioteki "msmc". Uruchom w terminalu "npm install", zamknij i odpal aplikację ponownie.');
  }

  const { Auth } = MSMC;
  const authManager = new Auth('select_account');

  const xboxManager = await authManager.launch('electron');
  const token = await xboxManager.getMinecraft();
  const mclcToken = token.mclc();

  const data = loadAccounts();
  let account = data.accounts.find(a => a.uuid && a.uuid === mclcToken.uuid);
  if (!account) {
    account = { id: newId(), addedAt: new Date().toISOString() };
    data.accounts.push(account);
  }
  account.type = 'microsoft';
  account.nickname = mclcToken.name;
  account.uuid = mclcToken.uuid;
  account.mclcToken = mclcToken;

  data.activeId = account.id;
  saveAccounts(data);
  return data;
});

ipcMain.handle('accounts:pickSkin', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Wybierz plik skina (.png)',
    filters: [{ name: 'Obrazy PNG', extensions: ['png'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

async function generateHeadFromSkin(skinPath, destPath) {
  if (!Jimp) throw new Error('Brak biblioteki "jimp" - uruchom "npm install" i spróbuj ponownie.');

  const img = await Jimp.read(skinPath);
  const face = img.clone().crop(8, 8, 8, 8);

  try {
    const hat = img.clone().crop(40, 8, 8, 8);
    face.composite(hat, 0, 0);
  } catch (e) {

  }

  face.resize(128, 128, Jimp.RESIZE_NEAREST_NEIGHBOR);
  await face.writeAsync(destPath);
}

ipcMain.handle('accounts:setSkin', async (event, accountId, filePath, variant) => {
  const data = loadAccounts();
  const account = data.accounts.find(a => a.id === accountId);
  if (!account) throw new Error('Nie znaleziono konta.');

  if (account.type === 'microsoft' && account.mclcToken) {

    const buf = fs.readFileSync(filePath);
    const form = new FormData();
    form.append('variant', variant === 'slim' ? 'slim' : 'classic');
    form.append('file', new Blob([buf], { type: 'image/png' }), 'skin.png');

    const res = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
      method: 'POST',
      headers: { Authorization: `Bearer ${account.mclcToken.access_token}` },
      body: form
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`BŁĄD: nie udało się wgrać skina na serwery Mojanga (status ${res.status}). ${text}`);
    }
    account.skinAppliedOfficially = true;
  } else {
    // Konto offline (non-premium) - zapisujemy skina TYLKO lokalnie.
    // WAŻNE: to będzie widoczne tylko w tym MelonClient, na tym komputerze.
    // Żeby inni gracze (w tym premium) widzieli ten skin na serwerze, serwer musi mieć
    // wtyczkę typu SkinsRestorer - to jedyny uniwersalny sposób, launcher tego nie obejdzie.
    const skinsDir = path.join(app.getPath('userData'), 'skins');
    fs.mkdirSync(skinsDir, { recursive: true });
    const dest = path.join(skinsDir, `${account.id}.png`);
    fs.copyFileSync(filePath, dest);
    account.localSkinPath = `file://${dest.split(path.sep).join('/')}`;

    const headDest = path.join(skinsDir, `${account.id}-head.png`);
    try {
      await generateHeadFromSkin(dest, headDest);
      account.localSkinHeadPath = `file://${headDest.split(path.sep).join('/')}`;
    } catch (err) {

      delete account.localSkinHeadPath;
    }
  }

  saveAccounts(data);
  return data;
});

ipcMain.handle('accounts:listCapes', async (event, accountId) => {
  const data = loadAccounts();
  const account = data.accounts.find(a => a.id === accountId);
  if (!account || account.type !== 'microsoft' || !account.mclcToken) {
    throw new Error('Peleryny Minecraft są dostępne tylko dla kont Premium (Microsoft).');
  }

  const res = await fetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${account.mclcToken.access_token}` }
  });
  if (!res.ok) throw new Error(`BŁĄD: nie udało się pobrać profilu Mojang (status ${res.status}). Może trzeba zalogować się ponownie przez Microsoft.`);
  const profile = await res.json();
  return profile.capes || [];
});

ipcMain.handle('accounts:setActiveCape', async (event, accountId, capeId) => {
  const data = loadAccounts();
  const account = data.accounts.find(a => a.id === accountId);
  if (!account || account.type !== 'microsoft' || !account.mclcToken) {
    throw new Error('Peleryny Minecraft są dostępne tylko dla kont Premium (Microsoft).');
  }

  const res = await fetch('https://api.minecraftservices.com/minecraft/profile/capes/active', {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${account.mclcToken.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ capeId })
  });
  if (!res.ok) throw new Error(`BŁĄD: nie udało się ustawić peleryny (status ${res.status}).`);
  return { ok: true };
});

function newId() {
  return `${Date.now().toString()}-${Math.random().toString(36).slice(2, 7)}`;
}

ipcMain.handle('profiles:openFolder', (event, id) => {
  const instanceDir = path.join(INSTANCES_DIR, id);
  fs.mkdirSync(instanceDir, { recursive: true });
  shell.openPath(instanceDir);
  return { ok: true };
});

ipcMain.handle('profiles:list', () => loadProfiles());

ipcMain.handle('profiles:pickIcon', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Wybierz ikonę profilu',
    filters: [{ name: 'Obrazy', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});

ipcMain.handle('profiles:add', (event, payload) => {
  const data = loadProfiles();
  const name = (payload.name || '').trim();
  if (!name) throw new Error('Nazwa profilu nie może być pusta');
  if (!payload.version) throw new Error('Wybierz wersję Minecrafta');

  const profile = {
    id: newId(),
    name,
    version: payload.version,
    loader: payload.loader || 'vanilla',
    loaderVersion: payload.loaderVersion || null,
    ram: { min: 2, max: 4 },
    mods: [],
    iconUrl: null,
    createdAt: new Date().toISOString()
  };

  if (payload.iconPath) {
    try {
      fs.mkdirSync(ICONS_DIR, { recursive: true });
      const ext = path.extname(payload.iconPath) || '.png';
      const dest = path.join(ICONS_DIR, `${profile.id}${ext}`);
      fs.copyFileSync(payload.iconPath, dest);
      profile.iconUrl = `file://${dest.replace(/\\/g, '/')}`;
    } catch (e) {

    }
  }

  data.profiles.push(profile);
  data.activeProfileId = profile.id;
  saveProfiles(data);
  return data;
});

ipcMain.handle('profiles:rename', (event, id, newName) => {
  const data = loadProfiles();
  const clean = (newName || '').trim();
  if (!clean) throw new Error('Nazwa nie może być pusta');
  const p = data.profiles.find(p => p.id === id);
  if (p) p.name = clean;
  saveProfiles(data);
  return data;
});

ipcMain.handle('profiles:remove', (event, id) => {
  const data = loadProfiles();
  data.profiles = data.profiles.filter(p => p.id !== id);
  if (data.activeProfileId === id) {
    data.activeProfileId = data.profiles.length ? data.profiles[0].id : null;
  }
  saveProfiles(data);
  return data;
});

ipcMain.handle('profiles:select', (event, id) => {
  const data = loadProfiles();
  const found = data.profiles.find(p => p.id === id);
  if (found) data.activeProfileId = id;
  saveProfiles(data);
  return data;
});

ipcMain.handle('profiles:updateOptions', (event, id, options) => {
  const data = loadProfiles();
  const p = data.profiles.find(p => p.id === id);
  if (!p) throw new Error('Nie znaleziono profilu');
  if (options.ram) p.ram = options.ram;
  if (options.loader) p.loader = options.loader;
  if ('loaderVersion' in options) p.loaderVersion = options.loaderVersion;
  saveProfiles(data);
  return data;
});

ipcMain.handle('profiles:addMods', (event, id, mods) => {
  const data = loadProfiles();
  const p = data.profiles.find(p => p.id === id);
  if (!p) throw new Error('Nie znaleziono profilu');
  mods.forEach(m => {
    const already = p.mods.find(x => x.id === m.id && x.source === m.source);
    if (!already) p.mods.push(m);
  });
  saveProfiles(data);
  return data;
});

ipcMain.handle('profiles:removeMod', (event, id, modId, source) => {
  const data = loadProfiles();
  const p = data.profiles.find(p => p.id === id);
  if (!p) throw new Error('Nie znaleziono profilu');
  p.mods = p.mods.filter(m => !(m.id === modId && m.source === source));
  saveProfiles(data);
  return data;
});

ipcMain.handle('settings:get', () => loadSettings());

ipcMain.handle('settings:setCurseForgeKey', (event, key) => {
  const s = loadSettings();
  s.curseforgeApiKey = (key || '').trim();
  saveSettings(s);
  return s;
});

ipcMain.handle('settings:setJavaPath', (event, javaPath) => {
  const s = loadSettings();
  s.javaPath = (javaPath || '').trim();
  saveSettings(s);
  return s;
});

/* =========================================================
   CURSEFORGE - wyszukiwanie modów (wymaga klucza API)
========================================================= */

ipcMain.handle('curseforge:search', async (event, query) => {
  const s = loadSettings();
  if (!s.curseforgeApiKey) {
    throw new Error('Brak klucza API CurseForge — dodaj go w Ustawieniach.');
  }

  const url = `https://api.curseforge.com/v1/mods/search?gameId=432&classId=6&searchFilter=${encodeURIComponent(query)}&pageSize=20`;
  const res = await fetch(url, {
    headers: { 'x-api-key': s.curseforgeApiKey, Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`CurseForge API zwróciło błąd: ${res.status}`);

  const json = await res.json();
  return (json.data || []).map(m => ({
    id: String(m.id),
    source: 'curseforge',
    name: m.name,
    description: m.summary,
    iconUrl: m.logo ? m.logo.thumbnailUrl : '',
    author: (m.authors && m.authors[0] && m.authors[0].name) || 'Nieznany',
    url: m.links ? m.links.websiteUrl : ''
  }));
});

/* =========================================================
   URUCHAMIANIE MINECRAFTA (minecraft-launcher-core)
========================================================= */

function verifyJava(javaPath) {
  const { execFileSync } = require('child_process');
  const bin = javaPath || 'java';
  try {
    const out = execFileSync(bin, ['-version'], { timeout: 8000, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, info: out.toString().trim() };
  } catch (e) {

    if (e.stderr) return { ok: true, info: String(e.stderr).trim() };
    return { ok: false, error: e.message || String(e) };
  }
}

function parseJavaMajor(versionOutput) {
  const match = versionOutput.match(/version "([^"]+)"/);
  if (!match) return null;
  const v = match[1];
  if (v.startsWith('1.')) {
    const parts = v.split('.');
    return parseInt(parts[1], 10); // np. 1.8.0_481 -> 8
  }
  return parseInt(v.split('.')[0], 10); // np. 21.0.2 -> 21
}

function requiredJavaFor(mcVersion) {
  const v = mcVersion || '';
  // Snapshoty (np. "25w03a") nie pasują do formatu x.y.z - we współczesnych snapshotach

  if (/^\d{2}w\d{2}[a-z]$/i.test(v)) return 21;

  const parts = v.split('.').map(n => parseInt(n, 10));
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;
  if (minor > 20 || (minor === 20 && patch >= 5)) return 21;
  if (minor >= 18) return 17;
  if (minor === 17) return 16;
  return 8;
}

const JAVA_MANIFEST_URL = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json';

function getPlatformKey() {
  const plat = process.platform;
  const arch = process.arch;
  if (plat === 'win32') {
    if (arch === 'arm64') return 'windows-arm64';
    if (arch === 'x64') return 'windows-x64';
    return 'windows-x86';
  }
  if (plat === 'darwin') return arch === 'arm64' ? 'mac-os-arm64' : 'mac-os';
  return arch === 'x64' ? 'linux' : 'linux-i386';
}

function parseMajorFromVersionName(name) {
  if (!name) return null;
  const uMatch = name.match(/^(\d+)u/);
  if (uMatch) return parseInt(uMatch[1], 10);
  const dotMatch = name.match(/^(\d+)\./);
  if (dotMatch) return parseInt(dotMatch[1], 10);
  const soloMatch = name.match(/^(\d+)$/);
  if (soloMatch) return parseInt(soloMatch[1], 10);
  return null;
}

async function downloadFilesWithConcurrency(fileEntries, installDir, concurrency, onProgress) {
  let idx = 0;
  let done = 0;
  const total = fileEntries.length;

  async function worker() {
    while (idx < fileEntries.length) {
      const i = idx++;
      const [relPath, info] = fileEntries[i];
      const dest = path.join(installDir, relPath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const url = info.downloads && info.downloads.raw && info.downloads.raw.url;
      if (url) {
        const res = await fetch(url);
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(dest, buf);
        if (info.executable) {
          try { fs.chmodSync(dest, 0o755); } catch (e) {}
        }
      }
      done++;
      onProgress(done, total);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, fileEntries.length) || 1 }, () => worker());
  await Promise.all(workers);
}

function bundledJavaDir(requiredMajor) {
  return path.join(app.getPath('userData'), 'java', String(requiredMajor));
}
function bundledJavaBin(requiredMajor) {
  const dir = bundledJavaDir(requiredMajor);
  return process.platform === 'win32' ? path.join(dir, 'bin', 'java.exe') : path.join(dir, 'bin', 'java');
}

async function ensureBundledJava(requiredMajor, sendLog, sendProgress) {
  const installDir = bundledJavaDir(requiredMajor);
  const markerFile = path.join(installDir, '.installed');
  const javaBin = bundledJavaBin(requiredMajor);

  if (fs.existsSync(markerFile) && fs.existsSync(javaBin)) {
    sendLog(`OK: znaleziono wcześniej pobraną wbudowaną Javę ${requiredMajor} — nie trzeba nic instalować ręcznie.`);
    return javaBin;
  }

  sendLog(`Nie znaleziono pasującej Javy w systemie — MelonClient pobiera własną, wbudowaną Javę ${requiredMajor} (jednorazowo, dla tej wersji Minecrafta)...`);

  const manifestRes = await fetch(JAVA_MANIFEST_URL);
  if (!manifestRes.ok) throw new Error(`BŁĄD: nie udało się pobrać listy dostępnych wersji Javy (${manifestRes.status}).`);
  const manifest = await manifestRes.json();

  const platformKey = getPlatformKey();
  const platformData = manifest[platformKey];
  if (!platformData) throw new Error(`BŁĄD: brak dostępnej automatycznej Javy dla platformy "${platformKey}". Ustaw ścieżkę do Javy ręcznie w Settings.`);

  const componentNames = ['jre-legacy', 'java-runtime-alpha', 'java-runtime-beta', 'java-runtime-gamma', 'java-runtime-gamma-snapshot', 'java-runtime-delta'];

  let chosen = null;
  let chosenMajor = null;
  for (const name of componentNames) {
    const entries = platformData[name];
    if (!entries || !entries[0] || !entries[0].manifest) continue;
    const versionName = (entries[0].version && entries[0].version.name) || '';
    const major = parseMajorFromVersionName(versionName);
    if (major === null) continue;
    if (major >= requiredMajor && (chosenMajor === null || major < chosenMajor)) {
      chosen = entries[0];
      chosenMajor = major;
    }
  }
  if (!chosen) {
    for (const name of componentNames) {
      const entries = platformData[name];
      if (!entries || !entries[0]) continue;
      const versionName = (entries[0].version && entries[0].version.name) || '';
      const major = parseMajorFromVersionName(versionName);
      if (major !== null && (chosenMajor === null || major > chosenMajor)) {
        chosen = entries[0];
        chosenMajor = major;
      }
    }
  }
  if (!chosen) throw new Error('BŁĄD: nie znaleziono żadnej pasującej Javy do automatycznego pobrania na tę platformę.');

  const filesRes = await fetch(chosen.manifest.url);
  if (!filesRes.ok) throw new Error(`BŁĄD: nie udało się pobrać listy plików Javy (${filesRes.status}).`);
  const filesManifest = await filesRes.json();
  const allEntries = Object.entries(filesManifest.files || {});

  fs.mkdirSync(installDir, { recursive: true });
  allEntries.filter(([, v]) => v.type === 'directory').forEach(([relPath]) => {
    fs.mkdirSync(path.join(installDir, relPath), { recursive: true });
  });

  const fileEntries = allEntries.filter(([, v]) => v.type === 'file');
  await downloadFilesWithConcurrency(fileEntries, installDir, 8, (done, total) => {
    sendProgress({ type: `java-${requiredMajor}`, task: done, total });
  });

  fs.writeFileSync(markerFile, new Date().toISOString());
  sendLog(`OK: pobrano i zainstalowano wbudowaną Javę ${chosenMajor} (${fileEntries.length} plików).`);
  return javaBin;
}

ipcMain.handle('minecraft:kill', async () => {
  if (!runningGame.proc || !runningGame.proc.pid) {
    throw new Error('Brak uruchomionego procesu Minecrafta do zamknięcia.');
  }
  const pid = runningGame.proc.pid;
  const { execFileSync } = require('child_process');

  try {
    if (process.platform === 'win32') {

      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F']);
    } else {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch (e) {
        runningGame.proc.kill('SIGKILL');
      }
    }
  } catch (e) {

  }

  runningGame = { proc: null, profileId: null };
  return { killed: true };
});

async function ensureLoaderVersionJson(metaBase, mcVersion, instanceDir, sendLog, loaderLabel) {
  const listRes = await fetch(`${metaBase}/versions/loader/${encodeURIComponent(mcVersion)}`);
  if (!listRes.ok) throw new Error(`BŁĄD: nie udało się pobrać listy wersji ${loaderLabel} dla ${mcVersion} (status ${listRes.status}).`);
  const loaders = await listRes.json();
  if (!Array.isArray(loaders) || loaders.length === 0) {
    throw new Error(`BŁĄD: brak dostępnego ${loaderLabel} dla wersji Minecrafta ${mcVersion}.`);
  }
  const stable = loaders.find(l => l.loader && l.loader.stable) || loaders[0];
  const loaderVersion = stable.loader.version;

  const profileRes = await fetch(`${metaBase}/versions/loader/${encodeURIComponent(mcVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`);
  if (!profileRes.ok) throw new Error(`BŁĄD: nie udało się pobrać profilu ${loaderLabel} ${loaderVersion} (status ${profileRes.status}).`);
  const profileJson = await profileRes.json();

  const customId = profileJson.id || `${loaderLabel.toLowerCase()}-loader-${loaderVersion}-${mcVersion}`;
  const versionDir = path.join(instanceDir, 'versions', customId);
  fs.mkdirSync(versionDir, { recursive: true });
  fs.writeFileSync(path.join(versionDir, `${customId}.json`), JSON.stringify(profileJson, null, 2));

  sendLog(`OK: przygotowano ${loaderLabel} ${loaderVersion} dla Minecrafta ${mcVersion}.`);
  return customId;
}

async function ensureForgeInstaller(mcVersion, sendLog) {
  const promoRes = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
  if (!promoRes.ok) throw new Error(`BŁĄD: nie udało się pobrać listy wersji Forge (status ${promoRes.status}).`);
  const promo = await promoRes.json();

  const forgeVersion = (promo.promos && (promo.promos[`${mcVersion}-recommended`] || promo.promos[`${mcVersion}-latest`])) || null;
  if (!forgeVersion) throw new Error(`BŁĄD: brak dostępnej wersji Forge dla Minecrafta ${mcVersion}.`);

  const fullVersion = `${mcVersion}-${forgeVersion}`;
  const cacheDir = path.join(app.getPath('userData'), 'forge-installers');
  fs.mkdirSync(cacheDir, { recursive: true });
  const jarPath = path.join(cacheDir, `forge-${fullVersion}-installer.jar`);

  if (!fs.existsSync(jarPath)) {
    sendLog(`Pobieram instalator Forge ${fullVersion}...`);
    const url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-installer.jar`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`BŁĄD: nie udało się pobrać instalatora Forge (status ${res.status}). URL: ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(jarPath, buf);
    sendLog(`OK: pobrano instalator Forge ${fullVersion}.`);
  } else {
    sendLog(`OK: znaleziono wcześniej pobrany instalator Forge ${fullVersion} — pomijam ponowne pobieranie.`);
  }

  return jarPath;
}

async function ensureModsInstalled(profile, instanceDir, sendLog) {
  if (!profile.mods || profile.mods.length === 0) return;

  const modsDir = path.join(instanceDir, 'mods');
  fs.mkdirSync(modsDir, { recursive: true });

  for (const mod of profile.mods) {
    try {
      let fileUrl = null;
      let fileName = null;

      if (mod.source === 'modrinth') {
        const loaderParam = encodeURIComponent(JSON.stringify([profile.loader]));
        const versionParam = encodeURIComponent(JSON.stringify([profile.version]));
        const res = await fetch(`https://api.modrinth.com/v2/project/${mod.id}/version?loaders=${loaderParam}&game_versions=${versionParam}`);
        if (!res.ok) {
          sendLog(`KONFLIKT: nie udało się sprawdzić wersji moda "${mod.name}" na Modrinth (status ${res.status}).`);
          continue;
        }
        const versions = await res.json();
        if (!versions || versions.length === 0) {
          sendLog(`KONFLIKT: brak wersji moda "${mod.name}" kompatybilnej z Minecraft ${profile.version} (${profile.loader}). Pomijam.`);
          continue;
        }
        const file = versions[0].files.find(f => f.primary) || versions[0].files[0];
        fileUrl = file.url;
        fileName = file.filename;
      } else if (mod.source === 'curseforge') {
        const settings = loadSettings();
        if (!settings.curseforgeApiKey) {
          sendLog(`KONFLIKT: brak klucza API CurseForge w Settings - pomijam mod "${mod.name}".`);
          continue;
        }
        const loaderTypeMap = { forge: 1, fabric: 4, quilt: 5 };
        const modLoaderType = loaderTypeMap[profile.loader] ?? 0;
        const url = `https://api.curseforge.com/v1/mods/${mod.id}/files?gameVersion=${encodeURIComponent(profile.version)}&modLoaderType=${modLoaderType}`;
        const res = await fetch(url, { headers: { 'x-api-key': settings.curseforgeApiKey } });
        if (!res.ok) {
          sendLog(`KONFLIKT: nie udało się sprawdzić plików moda "${mod.name}" na CurseForge (status ${res.status}).`);
          continue;
        }
        const json = await res.json();
        const found = (json.data || [])[0];
        if (!found || !found.downloadUrl) {
          sendLog(`KONFLIKT: brak dostępnego pliku do pobrania dla moda "${mod.name}" (autor może blokować pobieranie przez API) — pomijam.`);
          continue;
        }
        fileUrl = found.downloadUrl;
        fileName = found.fileName;
      } else {
        continue;
      }

      if (!fileUrl) continue;

      const dest = path.join(modsDir, fileName || `${mod.name}.jar`);
      if (fs.existsSync(dest)) {
        sendLog(`OK: mod "${mod.name}" już jest zainstalowany w tym profilu.`);
        continue;
      }

      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) {
        sendLog(`BŁĄD: nie udało się pobrać pliku moda "${mod.name}" (status ${fileRes.status}).`);
        continue;
      }
      const buf = Buffer.from(await fileRes.arrayBuffer());
      fs.writeFileSync(dest, buf);
      sendLog(`OK: zainstalowano mod "${mod.name}" (${fileName}).`);
    } catch (err) {
      sendLog(`BŁĄD: problem z instalacją moda "${mod.name}": ${err && err.message ? err.message : err}`);
    }
  }
}

ipcMain.handle('minecraft:launch', async (event, profileId) => {
  const send = (channel, payload) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
  };

  if (!MLC) {
    throw new Error('Brak biblioteki "minecraft-launcher-core". Uruchom w terminalu "npm install", zamknij i odpal aplikację ponownie.');
  }

  const profilesData = loadProfiles();
  const accountsData = loadAccounts();
  const profile = profilesData.profiles.find(p => p.id === profileId);
  const account = accountsData.accounts.find(a => a.id === accountsData.activeId);

  if (!profile) throw new Error('Nie znaleziono profilu.');
  if (!account) throw new Error('Najpierw dodaj i wybierz konto w zakładce Accounts.');

  (async () => {
    try {
      const settings = loadSettings();
      const requiredMajor = requiredJavaFor(profile.version);
      let resolvedJavaPath = null;

      if (settings.javaPath) {
        const manualCheck = verifyJava(settings.javaPath);
        if (manualCheck.ok) {
          const manualMajor = parseJavaMajor(manualCheck.info);
          if (manualMajor !== null && manualMajor >= requiredMajor) {
            resolvedJavaPath = settings.javaPath;
            send('minecraft:log', `OK: używam Javy ustawionej ręcznie w Settings (${manualCheck.info.split('\n')[0]}).`);
          } else {
            send('minecraft:log', `KONFLIKT: Java ustawiona w Settings to wersja ${manualMajor}, a ta wersja Minecrafta wymaga ${requiredMajor}+ — MelonClient pobierze własną Javę zamiast niej.`);
          }
        } else {
          send('minecraft:log', `KONFLIKT: ścieżka do Javy w Settings nie działa ("${settings.javaPath}") — MelonClient pobierze własną Javę.`);
        }
      }

      if (!resolvedJavaPath) {
        const systemCheck = verifyJava(null);
        if (systemCheck.ok) {
          const systemMajor = parseJavaMajor(systemCheck.info);
          if (systemMajor !== null && systemMajor >= requiredMajor) {
            resolvedJavaPath = 'java';
            send('minecraft:log', `OK: znaleziono odpowiednią Javę w systemie (${systemCheck.info.split('\n')[0]}).`);
          }
        }
      }

      if (!resolvedJavaPath) {
        resolvedJavaPath = await ensureBundledJava(
          requiredMajor,
          (msg) => send('minecraft:log', msg),
          (progress) => send('minecraft:progress', progress)
        );
      }

      const instanceDir = path.join(INSTANCES_DIR, profile.id);
      fs.mkdirSync(instanceDir, { recursive: true });

      const logFn = (msg) => send('minecraft:log', msg);

      let versionOpt = { number: profile.version, type: 'release' };
      let forgeJarPath = null;

      if (profile.loader === 'fabric') {
        const customId = await ensureLoaderVersionJson('https://meta.fabricmc.net/v2', profile.version, instanceDir, logFn, 'Fabric');
        versionOpt = { number: profile.version, type: 'release', custom: customId };
      } else if (profile.loader === 'quilt') {
        const customId = await ensureLoaderVersionJson('https://meta.quiltmc.org/v3', profile.version, instanceDir, logFn, 'Quilt');
        versionOpt = { number: profile.version, type: 'release', custom: customId };
      } else if (profile.loader === 'forge') {
        forgeJarPath = await ensureForgeInstaller(profile.version, logFn);
      }

      await ensureModsInstalled(profile, instanceDir, logFn);

      const { Client, Authenticator } = MLC;
      const launcher = new Client();

      launcher.on('debug', (e) => send('minecraft:log', String(e)));
      launcher.on('data', (e) => send('minecraft:log', String(e)));
      launcher.on('progress', (e) => send('minecraft:progress', e));

      const opts = {
        authorization: (account.type === 'microsoft' && account.mclcToken) ? account.mclcToken : Authenticator.getAuth(account.nickname),
        root: instanceDir,
        version: versionOpt,
        memory: { max: `${profile.ram.max}G`, min: `${profile.ram.min}G` },
        javaPath: resolvedJavaPath,
        overrides: {

          maxSockets: 16
        }
      };
      if (forgeJarPath) opts.forge = forgeJarPath;

      send('minecraft:log', `Startuję launcher dla wersji ${profile.version} (loader: ${profile.loader}, root: ${instanceDir})...`);

      const proc = await launcher.launch(opts);
      if (proc && typeof proc.on === 'function') {
        runningGame = { proc, profileId: profile.id };
        send('minecraft:log', `Proces Javy uruchomiony (PID: ${proc.pid || '?'}). Jeśli okno gry się nie pojawi, sprawdź logi powyżej pod kątem błędów Javy/LWJGL.`);
        send('minecraft:started', { profileId: profile.id, pid: proc.pid });

        proc.on('error', (err) => {
          send('minecraft:error', 'Błąd procesu Java: ' + (err.message || String(err)));
          if (runningGame.proc === proc) runningGame = { proc: null, profileId: null };
        });
        proc.on('exit', (code, signal) => {
          send('minecraft:closed', code !== null ? code : signal);
          if (runningGame.proc === proc) runningGame = { proc: null, profileId: null };
        });
      } else {
        send('minecraft:log', 'Launcher zwrócił obiekt bez referencji do procesu — nie mogę potwierdzić uruchomienia, sprawdź logi powyżej.');
      }
    } catch (err) {
      send('minecraft:error', err && err.message ? err.message : String(err));
    }
  })();

  return { started: true };
});
