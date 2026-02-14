export default function Popup() {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcut = isMac ? 'Cmd+Shift+L' : 'Ctrl+Shift+L';

  function openPicker() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;
      chrome.scripting
        .executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        })
        .catch(() => {});
      window.close();
    });
  }

  return (
    <div className="popup">
      <h1>Element Locator Picker</h1>
      <p className="hint">
        Press <kbd>{shortcut}</kbd> on any page to start the element picker.
      </p>
      <p className="sub">
        Click an element to see XPath, CSS, Playwright, Cypress, and Selenium locators. Press{' '}
        <kbd>Esc</kbd> to close.
      </p>
      <button type="button" id="open-picker" className="btn" onClick={openPicker}>
        Open picker now
      </button>
    </div>
  );
}
