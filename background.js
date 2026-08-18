// VisualPatch - Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('[VisualPatch] Extension installed successfully.');
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ status: 'OK' });
  } else if (request.action === 'CAPTURE_VISIBLE_TAB') {
    // Native GPU Tab Capture: 0ms DOM lag, captures directly from Chromium GPU frame buffer
    const windowId = sender.tab ? sender.tab.windowId : null;
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError || !dataUrl) {
        sendResponse({ success: false, error: chrome.runtime.lastError?.message || 'Capture failed' });
      } else {
        sendResponse({ success: true, dataUrl: dataUrl });
      }
    });
    return true; // Keep message port open for async response
  } else if (request.action === 'SAVE_ANNOTATIONS') {
    chrome.storage.local.set({ [request.url]: request.annotations }, () => {
      sendResponse({ status: 'SAVED' });
    });
    return true;
  }
});
