import './popup.css';

const STORAGE_KEY = 'testIdAttribute';
const DEFAULT_TEST_ID_ATTR = 'data-testid';

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const shortcut = isMac ? 'Cmd+Shift+L' : 'Ctrl+Shift+L';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function kbd(text: string) {
  return el('kbd', {}, [text]);
}

function buildUI() {
  const savedSpan = el('span', { className: 'setting-saved' }, ['Saved']);
  savedSpan.style.display = 'none';

  const input = el('input', {
    id: 'test-id-attr',
    type: 'text',
    className: 'setting-input',
    placeholder: 'e.g. data-testid, data-qa',
    spellcheck: 'false',
  }) as HTMLInputElement;

  function showSaved() {
    savedSpan.style.display = '';
    setTimeout(() => { savedSpan.style.display = 'none'; }, 1500);
  }

  function saveTestIdAttribute(value: string) {
    const trimmed = value.trim() || DEFAULT_TEST_ID_ATTR;
    input.value = trimmed;
    chrome.storage.sync.set({ [STORAGE_KEY]: trimmed }, showSaved);
  }

  input.addEventListener('blur', () => saveTestIdAttribute(input.value));

  chrome.storage.sync.get({ [STORAGE_KEY]: DEFAULT_TEST_ID_ATTR }, (result) => {
    input.value = (result[STORAGE_KEY] as string) || DEFAULT_TEST_ID_ATTR;
  });

  const openBtn = el('button', { type: 'button', id: 'open-picker', className: 'btn' }, [
    'Open picker now',
  ]);

  openBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId === undefined) return;
      chrome.tabs.sendMessage(tabId, 'toggle-picker').catch(() => {
        chrome.scripting
          .executeScript({ target: { tabId }, files: ['content.js'] })
          .then(() => {
            setTimeout(() => chrome.tabs.sendMessage(tabId, 'toggle-picker').catch(() => {}), 50);
          })
          .catch(() => {});
      });
      window.close();
    });
  });

  const hintP = el('p', { className: 'hint' });
  hintP.append('Press ', kbd(shortcut), ' on any page to start the element picker.');

  const subP = el('p', { className: 'sub' });
  subP.append('Click an element to see locators. ', kbd('Esc'), ' closes the panel; ', kbd(shortcut), ' turns the picker off.');

  const popup = el('div', { className: 'popup' }, [
    el('h1', {}, ['Element Locator Picker']),
    hintP,
    subP,
    el('div', { className: 'setting' }, [
      el('label', { for: 'test-id-attr' }, ['Test ID attribute (Playwright / teams)']),
      el('div', { className: 'setting-row' }, [input, savedSpan]),
    ]),
    openBtn,
  ]);

  document.body.append(popup);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildUI);
} else {
  buildUI();
}
