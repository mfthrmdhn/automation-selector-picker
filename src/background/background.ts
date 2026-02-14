chrome.commands.onCommand.addListener((command: string) => {
  if (command !== 'toggle-picker') return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) return;

    chrome.scripting
      .executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      })
      .catch(() => {
        // e.g. chrome:// or extension page - injection not allowed
      });
  });
});
