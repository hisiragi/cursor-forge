// ── State ─────────────────────────────────────────────────────────────────
let state = {
  enabled: true,
  disabledSites: [],
  theme: 'dark',
  currentHostname: '',
};

// ── DOM refs ──────────────────────────────────────────────────────────────
const app          = document.getElementById('app');
const body         = document.body;
const globalToggle = document.getElementById('globalToggle');
const globalDesc   = document.getElementById('globalDesc');
const themeBtn     = document.getElementById('themeBtn');
const themeIconD   = document.getElementById('themeIconDark');
const themeIconL   = document.getElementById('themeIconLight');
const siteHostname = document.getElementById('siteHostname');
const siteStatus   = document.getElementById('siteStatus');
const siteToggleBtn= document.getElementById('siteToggleBtn');
const siteFavicon  = document.getElementById('siteFavicon');
const disabledList = document.getElementById('disabledList');
const emptyState   = document.getElementById('emptyState');
const siteCount    = document.getElementById('siteCount');
const shortcutText = document.getElementById('shortcutText');

// ── Shortcut detection (Mac vs others) ────────────────────────────────────
const isMac = navigator.platform.toLowerCase().includes('mac');
shortcutText.textContent = isMac ? '⌃⇧C' : 'Alt+Shift+C';

// ── Render ────────────────────────────────────────────────────────────────
function render() {
  const { enabled, disabledSites, theme, currentHostname } = state;

  // Theme
  body.className = theme;
  if (theme === 'dark') {
    themeIconD.style.display = '';
    themeIconL.style.display = 'none';
  } else {
    themeIconD.style.display = 'none';
    themeIconL.style.display = '';
  }

  // Global toggle
  globalToggle.checked = enabled;
  globalDesc.textContent = enabled ? 'すべてのサイトで有効' : '無効（全サイト）';
  body.classList.toggle('global-off', !enabled);

  // Current site
  siteHostname.textContent = currentHostname || '（特定不能なページ）';

  // Favicon
  siteFavicon.innerHTML = '';
  if (currentHostname) {
    const img = document.createElement('img');
    img.src = `https://www.google.com/s2/favicons?domain=${currentHostname}&sz=32`;
    img.onerror = () => {
      siteFavicon.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/></svg>`;
    };
    siteFavicon.appendChild(img);
  } else {
    siteFavicon.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/></svg>`;
  }

  const siteDisabled = currentHostname && disabledSites.includes(currentHostname);
  const siteActive   = enabled && !siteDisabled;

  if (!currentHostname) {
    siteStatus.textContent = '特定できません';
    siteStatus.className = 'site-status';
    siteToggleBtn.style.display = 'none';
  } else if (siteDisabled) {
    siteStatus.textContent = '常にオフ（除外済み）';
    siteStatus.className = 'site-status disabled';
    siteToggleBtn.textContent = '除外を解除';
    siteToggleBtn.className = 'site-toggle-btn remove';
    siteToggleBtn.style.display = '';
  } else {
    siteStatus.textContent = enabled ? '有効（カーソル強制表示中）' : '無効（グローバル設定）';
    siteStatus.className = 'site-status' + (enabled ? ' active' : '');
    siteToggleBtn.textContent = 'このサイトをオフに';
    siteToggleBtn.className = 'site-toggle-btn add';
    siteToggleBtn.style.display = currentHostname ? '' : 'none';
  }

  // Disabled sites list
  renderDisabledList(disabledSites, currentHostname);
}

function renderDisabledList(sites, currentHostname) {
  siteCount.textContent = sites.length;

  // Remove old items
  const items = disabledList.querySelectorAll('.disabled-item');
  items.forEach(el => el.remove());

  if (sites.length === 0) {
    emptyState.style.display = '';
    return;
  }
  emptyState.style.display = 'none';

  sites.forEach(hostname => {
    const item = document.createElement('div');
    item.className = 'disabled-item';
    item.innerHTML = `
      <span class="disabled-item-dot"></span>
      <span class="disabled-item-host" title="${hostname}">${hostname}</span>
      <button class="disabled-item-remove" title="除外を解除">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    `;
    item.querySelector('.disabled-item-remove').addEventListener('click', () => {
      removeSite(hostname);
    });
    disabledList.appendChild(item);
  });
}

// ── State updates ─────────────────────────────────────────────────────────
function sendState(patch) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'setState', patch }, resolve);
  });
}

async function toggleGlobal() {
  const enabled = !state.enabled;
  state.enabled = enabled;
  render();
  await sendState({ enabled });
}

async function toggleSite() {
  const { currentHostname, disabledSites } = state;
  if (!currentHostname) return;

  let sites;
  if (disabledSites.includes(currentHostname)) {
    sites = disabledSites.filter(s => s !== currentHostname);
  } else {
    sites = [...disabledSites, currentHostname];
  }
  state.disabledSites = sites;
  render();
  await sendState({ disabledSites: sites });
}

async function removeSite(hostname) {
  const sites = state.disabledSites.filter(s => s !== hostname);
  state.disabledSites = sites;
  render();
  await sendState({ disabledSites: sites });
}

async function toggleTheme() {
  const theme = state.theme === 'dark' ? 'light' : 'dark';
  state.theme = theme;
  render();
  await sendState({ theme });
}

// ── Event listeners ───────────────────────────────────────────────────────
globalToggle.addEventListener('change', toggleGlobal);
siteToggleBtn.addEventListener('click', toggleSite);
themeBtn.addEventListener('click', toggleTheme);

// ── Init ──────────────────────────────────────────────────────────────────
chrome.runtime.sendMessage({ type: 'getState' }, (response) => {
  if (response) {
    state = { ...state, ...response };
  }
  render();
});
