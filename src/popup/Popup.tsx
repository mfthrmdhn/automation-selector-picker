import React from 'react';

const STORAGE_KEY = 'testIdAttribute';
const DEFAULT_TEST_ID_ATTR = 'data-testid';

export default function Popup() {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const shortcut = isMac ? 'Cmd+Shift+L' : 'Ctrl+Shift+L';
  const [testIdAttribute, setTestIdAttribute] = React.useState(DEFAULT_TEST_ID_ATTR);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_TEST_ID_ATTR }, (result) => {
      setTestIdAttribute(result[STORAGE_KEY] || DEFAULT_TEST_ID_ATTR);
    });
  }, []);

  function saveTestIdAttribute(value: string) {
    const trimmed = value.trim() || DEFAULT_TEST_ID_ATTR;
    setTestIdAttribute(trimmed);
    chrome.storage.sync.set({ [STORAGE_KEY]: trimmed }, () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  function openPicker() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const tabId = tab?.id;
      if (tabId === undefined) return;
      chrome.tabs.sendMessage(tabId, 'toggle-picker').catch(() => {
        // Content script not loaded — inject then send
        chrome.scripting
          .executeScript({ target: { tabId }, files: ['content.js'] })
          .then(() => {
            setTimeout(() => chrome.tabs.sendMessage(tabId, 'toggle-picker').catch(() => {}), 50);
          })
          .catch(() => {});
      });
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
        Click an element to see locators. <kbd>Esc</kbd> closes the panel; <kbd>{shortcut}</kbd> turns
        the picker off.
      </p>
      <div className="setting">
        <label htmlFor="test-id-attr">Test ID attribute (Playwright / teams)</label>
        <div className="setting-row">
          <input
            id="test-id-attr"
            type="text"
            className="setting-input"
            value={testIdAttribute}
            onChange={(e) => setTestIdAttribute(e.target.value)}
            onBlur={(e) => saveTestIdAttribute(e.target.value)}
            placeholder="e.g. data-testid, data-qa"
            spellCheck={false}
          />
          {saved && <span className="setting-saved">Saved</span>}
        </div>
      </div>
      <button type="button" id="open-picker" className="btn" onClick={openPicker}>
        Open picker now
      </button>
    </div>
  );
}
