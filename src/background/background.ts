const TOGGLE_MESSAGE = 'toggle-picker';

function sendToggleToTab(tabId: number): void {
  chrome.tabs.sendMessage(tabId, TOGGLE_MESSAGE).catch(() => {
    // Content script not loaded (e.g. tab opened before extension, or restricted page) — inject then send
    chrome.scripting
      .executeScript({ target: { tabId }, files: ['content.js'] })
      .then(() => {
        setTimeout(() => chrome.tabs.sendMessage(tabId, TOGGLE_MESSAGE).catch(() => {}), 50);
      })
      .catch(() => {
        // e.g. chrome:// or extension page — injection not allowed
      });
  });
}

chrome.commands.onCommand.addListener((command: string) => {
  if (command !== 'toggle-picker') return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) return;
    sendToggleToTab(tab.id);
  });
});
