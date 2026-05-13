const TOGGLE_MESSAGE = 'toggle-picker';

function sendToggleToTab(tabId: number): void {
  console.log('[background] sendToggleToTab called with tabId:', tabId);
  chrome.tabs.sendMessage(tabId, TOGGLE_MESSAGE).catch((error) => {
    console.log('[background] sendMessage failed, attempting injection:', error);
    // Content script not loaded (e.g. tab opened before extension, or restricted page) — inject then send
    chrome.scripting
      .executeScript({ target: { tabId }, files: ['content.js'] })
      .then(() => {
        console.log('[background] Script injection succeeded, waiting 50ms before retry');
        setTimeout(() => chrome.tabs.sendMessage(tabId, TOGGLE_MESSAGE).catch((retryError) => {
          console.log('[background] Retry sendMessage failed:', retryError);
        }), 50);
      })
      .catch((injectError) => {
        console.log('[background] Script injection failed:', injectError);
        // e.g. chrome:// or extension page — injection not allowed
      });
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Open setup page on first install
    chrome.tabs.create({
      url: chrome.runtime.getURL('setup.html'),
    });
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'open-shortcuts') {
    chrome.tabs.create({
      url: 'chrome://extensions/shortcuts',
    });
    sendResponse({ success: true });
  }
  return true;
});

chrome.commands.onCommand.addListener((command: string) => {
  console.log('[background] command received:', command);
  if (command !== 'toggle-picker') return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    console.log('[background] tabs query result:', tabs.length, 'tabs');
    const tab = tabs[0];
    if (!tab?.id) {
      console.log('[background] No active tab found');
      return;
    }
    console.log('[background] Found active tab:', tab.id);
    sendToggleToTab(tab.id);
  });
});