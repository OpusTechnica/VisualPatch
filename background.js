// VisualPatch - Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('[VisualPatch] Extension installed successfully.');
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ status: 'OK' });
  } else if (request.action === 'SAVE_ANNOTATIONS') {
    chrome.storage.local.set({ [request.url]: request.annotations }, () => {
      sendResponse({ status: 'SAVED' });
    });
    return true;
  }
});
