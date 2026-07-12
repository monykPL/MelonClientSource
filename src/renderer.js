const navLinks = document.querySelectorAll('.nav-link');
const pages = {
  home: document.getElementById('page-home'),
  profiles: document.getElementById('page-profiles'),
  accounts: document.getElementById('page-accounts'),
  settings: document.getElementById('page-settings'),
};

function showPage(name) {
  Object.entries(pages).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
  navLinks.forEach(btn => btn.classList.toggle('active', btn.dataset.page === name));
  if (name === 'profiles') renderProfilesGrid();
}

navLinks.forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));
document.getElementById('accountBadge').addEventListener('click', () => showPage('accounts'));
document.getElementById('openProfile').addEventListener('click', () => showPage('profiles'));

function headUrl(nickname) {
  if (!nickname) return '';
  return `https://mc-heads.net/avatar/${encodeURIComponent(nickname)}/100`;
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function initials(name) {
  return (name || '?').trim().slice(0, 2).toUpperCase();
}

let accountsState = { accounts: [], activeId: null };

async function refreshAccounts() {
  accountsState = await window.accountsAPI.list();
  renderNavbar();
  renderHome();
  renderAccountsList();
}
function getActiveAccount() {
  return accountsState.accounts.find(a => a.id === accountsState.activeId) || null;
}
function renderNavbar() {
  const active = getActiveAccount();
  const navNick = document.getElementById('navNick');
  const navHead = document.getElementById('navHead');
  if (active) { navNick.textContent = active.nickname; navHead.src = active.localSkinHeadPath || headUrl(active.nickname); }
  else { navNick.textContent = 'Dodaj konto'; navHead.src = ''; }
}
function renderAccountsList() {
  const list = document.getElementById('accountsList');
  list.innerHTML = '';
  if (accountsState.accounts.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Nie masz jeszcze żadnego konta. Dodaj nick powyżej.';
    list.appendChild(empty);
    return;
  }
  accountsState.accounts.forEach(acc => {
    const row = document.createElement('div');
    row.className = 'account-item' + (acc.id === accountsState.activeId ? ' selected' : '');
    row.innerHTML = `
      <img src="${acc.localSkinHeadPath || headUrl(acc.nickname)}" alt="" />
      <span class="acc-name">${escapeHtml(acc.nickname)}</span>
      <span class="acc-tag">${acc.type === 'offline' ? 'Offline' : 'Microsoft'}</span>
      <button class="select-btn" data-id="${acc.id}">${acc.id === accountsState.activeId ? 'Wybrane' : 'Wybierz'}</button>
      <button class="remove-btn" data-id="${acc.id}">Usuń</button>
    `;
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openAccountContextMenu(e.clientX, e.clientY, acc.id);
    });
    list.appendChild(row);
  });
  list.querySelectorAll('.select-btn').forEach(btn => btn.addEventListener('click', async () => {
    await window.accountsAPI.select(btn.dataset.id); await refreshAccounts();
  }));
  list.querySelectorAll('.remove-btn').forEach(btn => btn.addEventListener('click', async () => {
    await window.accountsAPI.remove(btn.dataset.id); await refreshAccounts();
  }));
}

const nickInput = document.getElementById('nickInput');
const addAccountBtn = document.getElementById('addAccountBtn');
const accountError = document.getElementById('accountError');
async function addAccount() {
  accountError.textContent = '';
  try {
    await window.accountsAPI.add(nickInput.value);
    nickInput.value = '';
    await refreshAccounts();
    showPage('home');
  } catch (e) { accountError.textContent = cleanErr(e); }
}
addAccountBtn.addEventListener('click', addAccount);
nickInput.addEventListener('keydown', e => { if (e.key === 'Enter') addAccount(); });

function cleanErr(e) {
  return (e.message || String(e)).replace(/^Error invoking remote method '[^']+': Error:\s*/, '');
}

/* ----- Logowanie Microsoft (Premium) ----- */
const loginMicrosoftBtn = document.getElementById('loginMicrosoftBtn');
loginMicrosoftBtn.addEventListener('click', async () => {
  const errBox = document.getElementById('microsoftError');
  errBox.textContent = '';
  loginMicrosoftBtn.disabled = true;
  loginMicrosoftBtn.innerHTML = '<span>🪟</span> Otwieram okno logowania Microsoft...';
  try {
    await window.accountsAPI.loginMicrosoft();
    await refreshAccounts();
  } catch (e) {
    errBox.textContent = cleanErr(e);
  }
  loginMicrosoftBtn.disabled = false;
  loginMicrosoftBtn.innerHTML = '<span>🪟</span> Zaloguj przez Microsoft (Premium)';
});

/* ----- Menu kontekstowe konta ----- */
const accountContextMenu = document.getElementById('accountContextMenu');
let accountContextMenuId = null;

function openAccountContextMenu(x, y, accountId) {
  accountContextMenuId = accountId;
  accountContextMenu.style.left = x + 'px';
  accountContextMenu.style.top = y + 'px';
  accountContextMenu.classList.remove('hidden');
}
function closeAccountContextMenu() {
  accountContextMenu.classList.add('hidden');
  accountContextMenuId = null;
}
document.addEventListener('click', (e) => {
  if (!accountContextMenu.contains(e.target)) closeAccountContextMenu();
});
accountContextMenu.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = accountContextMenuId;
  closeAccountContextMenu();
  if (!id) return;

  if (action === 'options') openAccountOptionsModal(id);
  if (action === 'select') { await window.accountsAPI.select(id); await refreshAccounts(); }
  if (action === 'delete') { await window.accountsAPI.remove(id); await refreshAccounts(); }
});

/* ----- Modal: Opcje konta (skin + peleryny) ----- */
const accountOptionsModal = document.getElementById('accountOptionsModal');
let accountOptionsId = null;

function openAccountOptionsModal(accountId) {
  accountOptionsId = accountId;
  const account = accountsState.accounts.find(a => a.id === accountId);
  if (!account) return;

  document.getElementById('accountOptionsTitle').textContent = `Opcje konta — ${account.nickname}`;
  document.getElementById('accountSkinError').textContent = '';

  const preview = document.getElementById('accountSkinPreview');
  const localOrHead = account.localSkinHeadPath || headUrl(account.nickname);
  preview.innerHTML = `<img src="${localOrHead}" alt="" />`;

  const note = document.getElementById('accountSkinNote');
  if (account.type === 'microsoft') {
    note.textContent = 'Konto Premium: skin zostanie wysłany na Twoje prawdziwe konto Mojang — zobaczą go WSZYSCY gracze, wszędzie.';
  } else {
    note.textContent = '⚠️ Konto offline (non-premium): ten skin będzie widoczny TYLKO lokalnie w MelonClient na tym komputerze. Żeby inni gracze (także premium) widzieli go na serwerze, ten serwer musi mieć wtyczkę typu SkinsRestorer — sam launcher tego nie obejdzie.';
  }

  const capesSection = document.getElementById('capesSection');
  if (account.type === 'microsoft') {
    capesSection.classList.remove('hidden');
    loadCapes(accountId);
  } else {
    capesSection.classList.add('hidden');
  }

  accountOptionsModal.classList.remove('hidden');
}
document.getElementById('closeAccountOptionsModal').addEventListener('click', () => accountOptionsModal.classList.add('hidden'));

document.getElementById('pickAccountSkinBtn').addEventListener('click', async () => {
  const errBox = document.getElementById('accountSkinError');
  errBox.textContent = '';
  try {
    const filePath = await window.accountsAPI.pickSkin();
    if (!filePath) return;
    const data = await window.accountsAPI.setSkin(accountOptionsId, filePath, 'classic');
    accountsState = data;
    await refreshAccounts();
    openAccountOptionsModal(accountOptionsId); // odśwież podgląd
  } catch (e) {
    errBox.textContent = cleanErr(e);
  }
});

async function loadCapes(accountId) {
  const list = document.getElementById('capesList');
  const errBox = document.getElementById('capesError');
  errBox.textContent = '';
  list.innerHTML = '<p class="muted">Ładowanie peleryn...</p>';
  try {
    const capes = await window.accountsAPI.listCapes(accountId);
    list.innerHTML = '';
    if (!capes || capes.length === 0) {
      list.innerHTML = '<p class="muted">To konto nie ma żadnych peleryn na Mojang.</p>';
      return;
    }
    capes.forEach(cape => {
      const card = document.createElement('div');
      card.className = 'cape-card' + (cape.state === 'ACTIVE' ? ' selected' : '');
      card.innerHTML = `
        <img src="${cape.url}" alt="" />
        <span class="cape-name">${escapeHtml(cape.alias || cape.id)}</span>
        <span class="tile-tag loader">${cape.state === 'ACTIVE' ? 'Aktywna' : 'Ustaw'}</span>
      `;
      card.addEventListener('click', async () => {
        try {
          await window.accountsAPI.setActiveCape(accountId, cape.id);
          loadCapes(accountId);
        } catch (e) {
          errBox.textContent = cleanErr(e);
        }
      });
      list.appendChild(card);
    });
  } catch (e) {
    list.innerHTML = '';
    errBox.textContent = cleanErr(e);
  }
}

/* =========================================================
   PROFILE
========================================================= */
let profilesState = { profiles: [], activeProfileId: null };
let mcVersions = [];

async function refreshProfiles() {
  profilesState = await window.profilesAPI.list();
  renderHome();
  renderProfilesGrid();
}
function getActiveProfile() {
  return profilesState.profiles.find(p => p.id === profilesState.activeProfileId) || null;
}

const loaderLabel = { vanilla: 'Vanilla', fabric: 'Fabric', forge: 'Forge', quilt: 'Quilt' };
const loaderIcon = { vanilla: '🧱', fabric: '🧩', forge: '🔨', quilt: '🪡' };

/* ----- Stan działającej gry (do przełączania PLAY <-> ZAMKNIJ) ----- */
let gameRunning = false;
let runningProfileId = null;

function updatePlayButtonVisual() {
  const playBtn = document.getElementById('playBtn');
  if (gameRunning) {
    playBtn.innerHTML = `<span class="play-icon">✕</span> ZAMKNIJ`;
    playBtn.classList.add('play-btn-close');
    playBtn.disabled = false;
  } else {
    playBtn.innerHTML = `<span class="play-icon">▶</span> PLAY`;
    playBtn.classList.remove('play-btn-close');
  }
}

function renderHome() {
  const active = getActiveAccount();
  const homeNick = document.getElementById('homeNick');
  const homeHead = document.getElementById('homeHead');
  const statusBadge = document.getElementById('statusBadge');
  const playBtn = document.getElementById('playBtn');

  if (active) {
    homeNick.textContent = active.nickname;
    homeHead.src = active.localSkinHeadPath || headUrl(active.nickname);
    statusBadge.textContent = 'Online';
    statusBadge.classList.remove('offline');
  } else {
    homeNick.textContent = 'Brak konta';
    homeHead.src = '';
    statusBadge.textContent = 'Brak konta';
    statusBadge.classList.add('offline');
  }

  const profile = getActiveProfile();
  const homeProfileName = document.getElementById('homeProfileName');
  const homeProfileRowLabel = document.getElementById('homeProfileRowLabel');
  const chipRow = document.getElementById('homeChipRow');
  chipRow.innerHTML = '';

  if (profile) {
    homeProfileName.textContent = profile.name;
    homeProfileRowLabel.textContent = `📁 ${profile.name}`;
    chipRow.innerHTML = `
      <span class="chip chip-orange">🧊 ${escapeHtml(profile.version)}</span>
      <span class="chip chip-blue">${loaderIcon[profile.loader] || '🧩'} ${loaderLabel[profile.loader] || profile.loader}</span>
      <span class="chip chip-brown">☕ Java 21+</span>
      <span class="chip chip-cyan">💾 ${profile.ram.min}-${profile.ram.max}GB</span>
    `;
  } else {
    homeProfileName.textContent = 'Brak profilu';
    homeProfileRowLabel.textContent = '📁 Wybierz profil';
  }

  playBtn.disabled = gameRunning ? false : !(active && profile);
  updatePlayButtonVisual();
}

function renderProfilesGrid() {
  const grid = document.getElementById('profilesGrid');
  grid.innerHTML = '';

  profilesState.profiles.forEach(p => {
    const tile = document.createElement('div');
    tile.className = 'profile-tile' + (p.id === profilesState.activeProfileId ? ' active' : '');
    const iconInner = p.iconUrl
      ? `<img class="tile-icon-img" src="${p.iconUrl}" alt="" />`
      : (loaderIcon[p.loader] || '🧱');
    tile.innerHTML = `
      <div class="tile-icon">${iconInner}</div>
      <div class="tile-name">${escapeHtml(p.name)}</div>
      <div class="tile-tags">
        <span class="tile-tag version">${escapeHtml(p.version)}</span>
        <span class="tile-tag loader">${loaderLabel[p.loader] || p.loader}</span>
      </div>
    `;
    tile.addEventListener('click', async () => {
      await window.profilesAPI.select(p.id);
      await refreshProfiles();
    });
    tile.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, p.id);
    });
    grid.appendChild(tile);
  });

  const addTile = document.createElement('div');
  addTile.className = 'add-profile-tile';
  addTile.innerHTML = `<span class="plus">+</span><span>Dodaj profil</span>`;
  addTile.addEventListener('click', openAddProfileModal);
  grid.appendChild(addTile);
}

let allVersionsManifest = [];

async function loadMcVersions() {
  const select = document.getElementById('newProfileVersion');
  const showSnapshots = document.getElementById('showSnapshotsCheckbox').checked;
  select.innerHTML = '<option>Ładowanie wersji...</option>';
  try {
    if (allVersionsManifest.length === 0) {
      const res = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
      const json = await res.json();
      allVersionsManifest = json.versions;
    }
    mcVersions = allVersionsManifest.filter(v => showSnapshots ? (v.type === 'release' || v.type === 'snapshot') : v.type === 'release');
    select.innerHTML = mcVersions.map(v => `<option value="${v.id}">${v.id}${v.type === 'snapshot' ? ' (snapshot)' : ''}</option>`).join('');
  } catch (e) {
    select.innerHTML = `<option value="1.21.4">1.21.4 (offline, brak listy)</option>`;
  }
}
document.getElementById('showSnapshotsCheckbox').addEventListener('change', loadMcVersions);

const addProfileModal = document.getElementById('addProfileModal');
let pickedIconPath = null;
function openAddProfileModal() {
  document.getElementById('newProfileName').value = '';
  document.getElementById('newProfileError').textContent = '';
  document.getElementById('newProfileLoader').value = 'vanilla';
  document.getElementById('showSnapshotsCheckbox').checked = false;
  pickedIconPath = null;
  document.getElementById('iconPreview').innerHTML = '🧱';
  addProfileModal.classList.remove('hidden');
  loadMcVersions();
}

document.getElementById('pickIconBtn').addEventListener('click', async () => {
  const filePath = await window.profilesAPI.pickIcon();
  if (filePath) {
    pickedIconPath = filePath;
    document.getElementById('iconPreview').innerHTML = `<img src="file://${filePath}" alt="" />`;
  }
});
document.getElementById('clearIconBtn').addEventListener('click', () => {
  pickedIconPath = null;
  document.getElementById('iconPreview').innerHTML = '🧱';
});
document.getElementById('addProfileBtn').addEventListener('click', openAddProfileModal);
document.getElementById('cancelAddProfile').addEventListener('click', () => addProfileModal.classList.add('hidden'));

document.getElementById('confirmAddProfile').addEventListener('click', async () => {
  const name = document.getElementById('newProfileName').value;
  const version = document.getElementById('newProfileVersion').value;
  const loader = document.getElementById('newProfileLoader').value;
  const errBox = document.getElementById('newProfileError');
  errBox.textContent = '';
  try {
    await window.profilesAPI.add({ name, version, loader, iconPath: pickedIconPath });
    addProfileModal.classList.add('hidden');
    await refreshProfiles();
  } catch (e) { errBox.textContent = cleanErr(e); }
});

const contextMenu = document.getElementById('profileContextMenu');
let contextMenuProfileId = null;

function openContextMenu(x, y, profileId) {
  contextMenuProfileId = profileId;
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.remove('hidden');
}
function closeContextMenu() {
  contextMenu.classList.add('hidden');
  contextMenuProfileId = null;
}
document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target)) closeContextMenu();
});

contextMenu.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = contextMenuProfileId;
  closeContextMenu();
  if (!id) return;

  if (action === 'options') openOptionsModal(id);
  if (action === 'launch') doLaunch(id);
  if (action === 'openFolder') window.profilesAPI.openFolder(id);
  if (action === 'rename') openRenameModal(id);
  if (action === 'delete') {
    await window.profilesAPI.remove(id);
    await refreshProfiles();
  }
});

async function doLaunch(id) {
  await window.profilesAPI.select(id);
  await refreshProfiles();
  const p = profilesState.profiles.find(p => p.id === id);
  const acc = getActiveAccount();
  if (!acc) { alert('Najpierw dodaj konto w zakładce Accounts.'); return; }

  openLaunchModal(p.name);
  try {
    await window.minecraftAPI.launch(id);
    appendLaunchLog('Żądanie uruchomienia wysłane. Trwa przygotowywanie plików gry (może to potrwać przy pierwszym uruchomieniu)...');
  } catch (e) {
    appendLaunchLog('Błąd: ' + cleanErr(e));
    document.getElementById('launchStatus').textContent = 'Nie udało się uruchomić.';
  }
}

const launchModal = document.getElementById('launchModal');
function openLaunchModal(profileName) {
  document.getElementById('launchModalTitle').textContent = `Uruchamianie — ${profileName}`;
  document.getElementById('launchStatus').textContent = 'Przygotowywanie...';
  document.getElementById('launchLog').innerHTML = '';
  launchModal.classList.remove('hidden');
}
document.getElementById('closeLaunchModal').addEventListener('click', () => launchModal.classList.add('hidden'));

document.getElementById('clearLogBtn').addEventListener('click', () => {
  document.getElementById('launchLog').innerHTML = '';
});

document.getElementById('copyLogBtn').addEventListener('click', async () => {
  const copyBtn = document.getElementById('copyLogBtn');
  const text = document.getElementById('launchLog').innerText;
  try {
    await navigator.clipboard.writeText(text);
    const original = copyBtn.textContent;
    copyBtn.textContent = '✅ Skopiowano!';
    setTimeout(() => { copyBtn.textContent = original; }, 1500);
  } catch (e) {
    alert('Nie udało się skopiować logów: ' + e.message);
  }
});

function openLogsModal() {
  const hasLogs = document.getElementById('launchLog').children.length > 0;
  document.getElementById('launchModalTitle').textContent = 'Logi uruchamiania';
  if (!hasLogs) {
    document.getElementById('launchStatus').textContent = 'Brak logów — kliknij PLAY, żeby uruchomić grę i zobaczyć logi na żywo.';
  }
  launchModal.classList.remove('hidden');
}
document.getElementById('viewLogsBtn').addEventListener('click', openLogsModal);

function colorizeLogLine(rawLine) {
  let escaped = escapeHtml(rawLine);

  const rules = [
    { regex: /(BŁĄD|błąd|error|exception|fatal|failed|could not|crash(?:ed)?)/gi, cls: 'log-error' },
    { regex: /(warn(?:ing)?s?|duplicate|conflict(?:s)?|deprecated|already exists|konflikt|nadpisz)/gi, cls: 'log-warn' },
    { regex: /(\bOK\b|Downloaded(?: assets)?|Collected class paths|Set launch options|wystartował|Uruchomiono|Java OK|✅)/gi, cls: 'log-good' }
  ];
  rules.forEach(rule => {
    escaped = escaped.replace(rule.regex, (m) => `<span class="${rule.cls}">${m}</span>`);
  });
  return escaped;
}

function appendLaunchLog(msg) {
  const log = document.getElementById('launchLog');
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = colorizeLogLine(msg);
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}
function updateLaunchProgress(data) {
  const status = document.getElementById('launchStatus');
  if (data && data.type) {
    status.textContent = `Pobieranie: ${data.type} (${data.task || 0}/${data.total || 0})`;
  }
}

window.minecraftAPI.onLog((msg) => appendLaunchLog(msg));
window.minecraftAPI.onProgress((data) => updateLaunchProgress(data));
window.minecraftAPI.onStarted((data) => {
  gameRunning = true;
  runningProfileId = data.profileId;
  updatePlayButtonVisual();
});
window.minecraftAPI.onClosed((code) => {
  appendLaunchLog(`Minecraft został zamknięty (kod: ${code}).`);
  document.getElementById('launchStatus').textContent = 'Zakończono.';
  gameRunning = false;
  runningProfileId = null;
  updatePlayButtonVisual();
});
window.minecraftAPI.onError((msg) => {
  appendLaunchLog('Błąd: ' + msg);
  document.getElementById('launchStatus').textContent = 'Wystąpił błąd.';
  gameRunning = false;
  runningProfileId = null;
  updatePlayButtonVisual();
});

const renameModal = document.getElementById('renameModal');
let renameProfileId = null;
function openRenameModal(id) {
  renameProfileId = id;
  const p = profilesState.profiles.find(p => p.id === id);
  document.getElementById('renameInput').value = p ? p.name : '';
  document.getElementById('renameError').textContent = '';
  renameModal.classList.remove('hidden');
}
document.getElementById('cancelRename').addEventListener('click', () => renameModal.classList.add('hidden'));
document.getElementById('confirmRename').addEventListener('click', async () => {
  const errBox = document.getElementById('renameError');
  try {
    await window.profilesAPI.rename(renameProfileId, document.getElementById('renameInput').value);
    renameModal.classList.add('hidden');
    await refreshProfiles();
  } catch (e) { errBox.textContent = cleanErr(e); }
});

const optionsModal = document.getElementById('optionsModal');
let optionsProfileId = null;
let selectedMods = new Map();

function openOptionsModal(id) {
  optionsProfileId = id;
  const p = profilesState.profiles.find(p => p.id === id);
  if (!p) return;

  document.getElementById('optionsProfileTitle').textContent = `Opcje — ${p.name}`;
  document.getElementById('optLoader').value = p.loader;
  document.getElementById('ramMin').value = p.ram.min;
  document.getElementById('ramMax').value = p.ram.max;
  document.getElementById('ramMinVal').textContent = p.ram.min;
  document.getElementById('ramMaxVal').textContent = p.ram.max;

  selectedMods = new Map();
  document.getElementById('modsResults').innerHTML = '';
  document.getElementById('modSearchInput').value = '';
  document.getElementById('modSearchError').textContent = '';
  updateSelectedCount();
  renderInstalledMods(p);

  switchTab('general');
  optionsModal.classList.remove('hidden');
}
document.getElementById('closeOptionsModal').addEventListener('click', () => optionsModal.classList.add('hidden'));

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.getElementById('tab-general').classList.toggle('hidden', name !== 'general');
  document.getElementById('tab-mods').classList.toggle('hidden', name !== 'mods');
}

document.getElementById('ramMin').addEventListener('input', (e) => {
  document.getElementById('ramMinVal').textContent = e.target.value;
});
document.getElementById('ramMax').addEventListener('input', (e) => {
  document.getElementById('ramMaxVal').textContent = e.target.value;
});

document.getElementById('saveGeneralOptions').addEventListener('click', async () => {
  const loader = document.getElementById('optLoader').value;
  const min = parseInt(document.getElementById('ramMin').value, 10);
  const max = parseInt(document.getElementById('ramMax').value, 10);
  const ram = { min: Math.min(min, max), max: Math.max(min, max) };
  await window.profilesAPI.updateOptions(optionsProfileId, { loader, ram });
  await refreshProfiles();
  optionsModal.classList.add('hidden');
});

document.getElementById('modSearchBtn').addEventListener('click', searchMods);
document.getElementById('modSearchInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchMods(); });

async function searchMods() {
  const source = document.getElementById('modSource').value;
  const query = document.getElementById('modSearchInput').value.trim();
  const errBox = document.getElementById('modSearchError');
  const resultsBox = document.getElementById('modsResults');
  errBox.textContent = '';
  resultsBox.innerHTML = '<p class="muted">Szukam...</p>';

  try {
    let items = [];
    if (source === 'modrinth') {
      items = await searchModrinth(query);
    } else {
      items = await window.curseforgeAPI.search(query);
    }
    renderModResults(items);
  } catch (e) {
    resultsBox.innerHTML = '';
    errBox.textContent = cleanErr(e);
  }
}

async function searchModrinth(query) {
  const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=[["project_type:mod"]]&limit=20`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Modrinth API zwróciło błąd: ${res.status}`);
  const json = await res.json();
  return (json.hits || []).map(h => ({
    id: h.project_id,
    source: 'modrinth',
    name: h.title,
    description: h.description,
    iconUrl: h.icon_url || '',
    author: h.author || 'Nieznany',
    url: `https://modrinth.com/mod/${h.slug}`
  }));
}

function renderModResults(items) {
  const resultsBox = document.getElementById('modsResults');
  resultsBox.innerHTML = '';
  if (items.length === 0) {
    resultsBox.innerHTML = '<p class="muted">Brak wyników.</p>';
    return;
  }
  items.forEach(mod => {
    const key = `${mod.source}:${mod.id}`;
    const card = document.createElement('div');
    card.className = 'mod-card' + (selectedMods.has(key) ? ' selected' : '');
    card.innerHTML = `
      <img class="mod-icon" src="${mod.iconUrl || ''}" alt="" onerror="this.style.visibility='hidden'" />
      <div class="mod-info">
        <div class="mod-name">${escapeHtml(mod.name)}</div>
        <div class="mod-desc">${escapeHtml(mod.description || '')}</div>
        <div class="mod-author">
          <span class="mod-author-avatar">${initials(mod.author)}</span>
          ${escapeHtml(mod.author)}
        </div>
      </div>
      <div class="mod-check">${selectedMods.has(key) ? '✓' : ''}</div>
    `;
    card.addEventListener('click', () => toggleModSelection(mod, card));
    resultsBox.appendChild(card);
  });
}

function toggleModSelection(mod, card) {
  const key = `${mod.source}:${mod.id}`;
  if (selectedMods.has(key)) {
    selectedMods.delete(key);
    card.classList.remove('selected');
    card.querySelector('.mod-check').textContent = '';
  } else {
    selectedMods.set(key, mod);
    card.classList.add('selected');
    card.querySelector('.mod-check').textContent = '✓';
  }
  updateSelectedCount();
}
function updateSelectedCount() {
  document.getElementById('modsSelectedCount').textContent = `Wybrano: ${selectedMods.size}`;
}

document.getElementById('addModsBtn').addEventListener('click', async () => {
  if (selectedMods.size === 0) return;
  const mods = Array.from(selectedMods.values());
  const data = await window.profilesAPI.addMods(optionsProfileId, mods);
  profilesState = data;
  selectedMods = new Map();
  document.querySelectorAll('.mod-card').forEach(c => { c.classList.remove('selected'); c.querySelector('.mod-check').textContent = ''; });
  updateSelectedCount();
  const p = profilesState.profiles.find(p => p.id === optionsProfileId);
  renderInstalledMods(p);
  renderProfilesGrid();
});

function renderInstalledMods(profile) {
  const box = document.getElementById('modsInstalled');
  box.innerHTML = '';
  if (!profile || profile.mods.length === 0) {
    box.innerHTML = '<p class="muted">Brak zainstalowanych modów.</p>';
    return;
  }
  profile.mods.forEach(m => {
    const row = document.createElement('div');
    row.className = 'mod-installed-row';
    row.innerHTML = `
      <img class="mod-icon" src="${m.iconUrl || ''}" alt="" onerror="this.style.visibility='hidden'" />
      <span class="mod-name">${escapeHtml(m.name)}</span>
      <span class="tile-tag loader">${m.source}</span>
      <button data-id="${m.id}" data-source="${m.source}">Usuń</button>
    `;
    row.querySelector('button').addEventListener('click', async () => {
      const data = await window.profilesAPI.removeMod(profile.id, m.id, m.source);
      profilesState = data;
      renderInstalledMods(profilesState.profiles.find(p => p.id === profile.id));
      renderProfilesGrid();
    });
    box.appendChild(row);
  });
}

async function loadSettingsPage() {
  const s = await window.settingsAPI.get();
  document.getElementById('cfKeyInput').value = s.curseforgeApiKey || '';
  document.getElementById('javaPathInput').value = s.javaPath || '';
}
document.getElementById('saveCfKeyBtn').addEventListener('click', async () => {
  const msg = document.getElementById('cfKeyMsg');
  await window.settingsAPI.setCurseForgeKey(document.getElementById('cfKeyInput').value);
  msg.style.color = 'var(--green)';
  msg.textContent = 'Zapisano.';
  setTimeout(() => { msg.textContent = ''; }, 2000);
});
document.getElementById('saveJavaPathBtn').addEventListener('click', async () => {
  const msg = document.getElementById('javaPathMsg');
  await window.settingsAPI.setJavaPath(document.getElementById('javaPathInput').value);
  msg.style.color = 'var(--green)';
  msg.textContent = 'Zapisano.';
  setTimeout(() => { msg.textContent = ''; }, 2000);
});

/* =========================================================
   PLAY
========================================================= */
document.getElementById('playBtn').addEventListener('click', async () => {
  if (gameRunning) {
    const playBtn = document.getElementById('playBtn');
    playBtn.disabled = true;
    try {
      await window.minecraftAPI.kill();
      appendLaunchLog('Wymuszono zamknięcie Minecrafta (jak "Zakończ zadanie" w Menadżerze Zadań).');
    } catch (e) {
      appendLaunchLog('Błąd przy zamykaniu: ' + cleanErr(e));
    }
    gameRunning = false;
    runningProfileId = null;
    updatePlayButtonVisual();
    return;
  }

  const active = getActiveAccount();
  const profile = getActiveProfile();
  if (!active || !profile) return;
  doLaunch(profile.id);
});

(async () => {
  await refreshAccounts();
  await refreshProfiles();
  await loadSettingsPage();
  if (accountsState.accounts.length === 0) showPage('accounts');
})();
