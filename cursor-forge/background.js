// ── Storage helpers ──────────────────────────────────────────────────────────
async function getState() {
  return new Promise(resolve =>
    chrome.storage.sync.get({ enabled: true, disabledSites: [], theme: 'dark' }, resolve)
  );
}

async function setState(patch) {
  const current = await getState();
  const next = { ...current, ...patch };
  return new Promise(resolve => chrome.storage.sync.set(next, () => resolve(next)));
}

// ── Badge ────────────────────────────────────────────────────────────────────
async function updateBadge(tabId) {
  const { enabled, disabledSites } = await getState();
  let hostname = '';
  try {
    const tab = await chrome.tabs.get(tabId);
    hostname = new URL(tab.url || '').hostname;
  } catch {}

  const active = enabled && !disabledSites.includes(hostname);
  chrome.action.setBadgeText({ text: active ? 'ON' : 'OFF', tabId });
  chrome.action.setBadgeBackgroundColor({ color: active ? '#22c55e' : '#64748b', tabId });
}

// ── Broadcast state to all tabs ──────────────────────────────────────────────
async function broadcastState(data) {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'stateChanged',
        enabled: data.enabled,
        disabledSites: data.disabledSites,
      });
    } catch {}
  }
}

// ── Keyboard shortcut ────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-cursor-force') return;
  const { enabled, disabledSites } = await getState();
  const next = await setState({ enabled: !enabled });
  await broadcastState(next);

  // Update badge for active tab
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab) updateBadge(activeTab.id);
});

// ── Tab events: keep badge in sync ───────────────────────────────────────────
chrome.tabs.onActivated.addListener(({ tabId }) => updateBadge(tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') updateBadge(tabId);
});

// ── Messages from popup ──────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'getState') {
    getState().then(data => {
      // Also resolve current tab hostname
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        let hostname = '';
        try { hostname = new URL(tabs[0]?.url || '').hostname; } catch {}
        sendResponse({ ...data, currentHostname: hostname });
      });
    });
    return true; // keep channel open for async
  }

  if (msg.type === 'setState') {
    setState(msg.patch).then(async (next) => {
      await broadcastState(next);
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) updateBadge(activeTab.id);
      sendResponse({ ok: true });
    });
    return true;
  }
});
