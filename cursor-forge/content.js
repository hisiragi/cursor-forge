(() => {
  const STYLE_ID = 'cursorforce-style';

  // Inject CSS that overrides cursor:none while preserving common cursor semantics
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      *, *::before, *::after {
        cursor: default !important;
      }
      a, button, [role="button"], [role="link"],
      [onclick], select, label,
      input[type="submit"], input[type="button"],
      input[type="reset"], input[type="checkbox"],
      input[type="radio"], input[type="file"],
      input[type="color"], input[type="range"],
      summary, [tabindex] {
        cursor: pointer !important;
      }
      input[type="text"], input[type="email"],
      input[type="password"], input[type="search"],
      input[type="url"], input[type="tel"],
      input[type="number"], input[type="date"],
      input[type="time"], input[type="datetime-local"],
      textarea, [contenteditable="true"], [contenteditable=""],
      .cm-content, .CodeMirror, .ace_editor {
        cursor: text !important;
      }
      input[type="ew-resize"], [style*="ew-resize"],
      ::-webkit-resizer { cursor: ew-resize !important; }
      [style*="ns-resize"] { cursor: ns-resize !important; }
      [style*="col-resize"] { cursor: col-resize !important; }
      [style*="row-resize"] { cursor: row-resize !important; }
      [style*="grab"] { cursor: grab !important; }
      [style*="zoom-in"] { cursor: zoom-in !important; }
      [style*="zoom-out"] { cursor: zoom-out !important; }
      [style*="crosshair"] { cursor: crosshair !important; }
    `;
    // Append to <html> so it works even before <body> exists
    (document.documentElement || document.head || document).appendChild(style);
  }

  function removeStyle() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  function getHostname() {
    try { return location.hostname || ''; } catch(e) { return ''; }
  }

  function applyState(enabled, disabledSites) {
    const hostname = getHostname();
    const siteDisabled = disabledSites.includes(hostname);
    if (enabled && !siteDisabled) {
      injectStyle();
    } else {
      removeStyle();
    }
  }

  // Initial load: read state from storage
  chrome.storage.sync.get({ enabled: true, disabledSites: [] }, (data) => {
    applyState(data.enabled, data.disabledSites);
  });

  // Listen for real-time toggle messages from popup/background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'stateChanged') {
      applyState(msg.enabled, msg.disabledSites);
    }
  });

  // Re-apply on dynamic DOM changes (some SPAs may reset styles)
  const observer = new MutationObserver(() => {
    chrome.storage.sync.get({ enabled: true, disabledSites: [] }, (data) => {
      if (data.enabled && !data.disabledSites.includes(getHostname())) {
        if (!document.getElementById(STYLE_ID)) injectStyle();
      }
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: false });
})();
