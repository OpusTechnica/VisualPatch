// VisualPatch v2.3.0 — Popup Controller

async function triggerAction(action) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    try {
      // Direct runtime message to content script
      const response = await chrome.tabs.sendMessage(tab.id, { action });
      if (response && response.success) {
        window.close();
        return;
      }
    } catch (msgErr) {
      // If content script was not yet loaded on this tab, inject dynamically
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { action });
          } catch (e) {}
        }, 100);
      } catch (e) {}
    }
  } catch (e) {}
  window.close();
}

document.getElementById('send-agent-btn')?.addEventListener('click', () => {
  triggerAction('SEND_TO_AGENT');
});

document.getElementById('toggle-screenshot')?.addEventListener('click', () => {
  triggerAction('TOGGLE_SCREENSHOT');
});

document.getElementById('toggle-inspect')?.addEventListener('click', () => {
  triggerAction('TOGGLE_INSPECT');
});

document.getElementById('toggle-toolbar')?.addEventListener('click', () => {
  triggerAction('SHOW_TOOLBAR');
});
