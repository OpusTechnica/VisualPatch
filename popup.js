document.getElementById('toggle-toolbar').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, code: 'KeyT', key: 't', bubbles: true }));
      }
    });
    window.close();
  }
});

document.getElementById('toggle-inspect').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, code: 'KeyD', key: 'd', bubbles: true }));
      }
    });
    window.close();
  }
});

document.getElementById('toggle-screenshot').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's', bubbles: true }));
      }
    });
    window.close();
  }
});
