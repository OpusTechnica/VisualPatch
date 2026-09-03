// VisualPatch v2.3.0 — Background Service Worker (Manifest V3)

chrome.runtime.onInstalled.addListener(() => {
  console.log('[VisualPatch] Extension v2.3.0 installed successfully.');
});

// Maintain MV3 service worker responsiveness during active annotation sessions
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'visualpatch-keepalive') {
    port.onDisconnect.addListener(() => {
      // Session disconnected
    });
  }
});

// OS-Level Chrome Commands Listener (Alt+D, Alt+S, Alt+T, Ctrl+Shift+Enter)
if (chrome.commands) {
  chrome.commands.onCommand.addListener(async (command) => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) return;

      const actionMap = {
        'toggle-inspect': 'TOGGLE_INSPECT',
        'toggle-screenshot': 'TOGGLE_SCREENSHOT',
        'toggle-toolbar': 'TOGGLE_TOOLBAR',
        'send-to-agent': 'SEND_TO_AGENT'
      };

      const action = actionMap[command];
      if (action) {
        chrome.tabs.sendMessage(tab.id, { action }).catch(() => {
          // If content script is not yet injected or tab was asleep, inject dynamically
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(tab.id, { action }).catch(() => {});
            }, 120);
          }).catch(() => {});
        });
      }
    } catch (e) {
      console.warn('[VisualPatch] Command execution error:', e);
    }
  });
}

// Hardened Chromium Tab Capture Queue with Watchdog & Self-Healing
let lastCaptureTime = 0;
let lastCaptureDataUrl = null;
let lastWindowId = null;
let captureQueue = Promise.resolve();

function captureTabProtected(windowId) {
  return new Promise((resolve, reject) => {
    captureQueue = captureQueue
      .catch(() => {}) // Prevent unhandled rejection deadlock
      .then(() => {
        return new Promise((stepResolve) => {
          let hasFinished = false;

          // 1200ms Watchdog to prevent service worker from hanging forever
          const timer = setTimeout(() => {
            if (!hasFinished) {
              hasFinished = true;
              stepResolve();
              reject(new Error('GPU Capture Watchdog Timeout (1200ms)'));
            }
          }, 1200);

          try {
            // Use format 'jpeg' with quality 92 for ~25ms hardware capture (vs ~300ms for PNG)
            // The offscreen canvas cropper in content.js renders crisp PNG
            chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 92 }, (dataUrl) => {
              if (hasFinished) return;
              hasFinished = true;
              clearTimeout(timer);

              if (chrome.runtime.lastError || !dataUrl) {
                stepResolve();
                reject(new Error(chrome.runtime.lastError?.message || 'GPU Tab Capture failed'));
              } else {
                lastCaptureTime = Date.now();
                lastCaptureDataUrl = dataUrl;
                lastWindowId = windowId;
                stepResolve();
                resolve(dataUrl);
              }
            });
          } catch (err) {
            if (!hasFinished) {
              hasFinished = true;
              clearTimeout(timer);
              stepResolve();
              reject(err);
            }
          }
        });
      });
  });
}

// Runtime Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ status: 'OK', version: '2.3.0' });
    return false;
  }

  if (request.action === 'CAPTURE_VISIBLE_TAB') {
    const targetWindowId = (sender.tab && sender.tab.windowId) ? sender.tab.windowId : null;

    captureTabProtected(targetWindowId)
      .then((dataUrl) => {
        sendResponse({ success: true, dataUrl });
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep message channel open for async response
  }

  if (request.action === 'SAVE_ANNOTATIONS') {
    chrome.storage.local.set({ [request.url]: request.annotations }, () => {
      sendResponse({ status: 'SAVED' });
    });
    return true;
  }
});
