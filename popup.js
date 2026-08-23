async function triggerAction(action, keyEvtFunc) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    try {
      // 1. Try sending direct runtime message to content script
      const response = await chrome.tabs.sendMessage(tab.id, { action });
      if (response && response.success) {
        window.close();
        return;
      }
    } catch (msgErr) {
      // 2. If content script is not yet injected on this tab / port, inject dynamically!
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { action });
          } catch (e) {}
        }, 120);
      } catch (injectErr) {
        // 3. Fallback: Dispatch synthetic keyboard event
        try {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: keyEvtFunc
          });
        } catch (e) {}
      }
    }
  } catch (e) {}
  window.close();
}

document.getElementById('send-agent-btn').addEventListener('click', () => {
  triggerAction('SEND_TO_AGENT', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { ctrlKey: true, code: 'Enter', key: 'Enter', bubbles: true }));
  });
});

document.getElementById('toggle-screenshot').addEventListener('click', () => {
  triggerAction('TOGGLE_SCREENSHOT', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's', bubbles: true }));
  });
});

document.getElementById('toggle-inspect').addEventListener('click', () => {
  triggerAction('TOGGLE_INSPECT', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, code: 'KeyD', key: 'd', bubbles: true }));
  });
});

document.getElementById('toggle-toolbar').addEventListener('click', () => {
  triggerAction('SHOW_TOOLBAR', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, code: 'KeyT', key: 't', bubbles: true }));
  });
});
