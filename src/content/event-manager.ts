/**
 * Manages overlay and panel DOM and event listeners for the picker.
 */

import { updateHighlight, createHighlightElement, getHighlightStyles } from './highlighter';
import { getLocatorsForElement } from '../core/selector-engine';

const ROOT_ID = 'selector-picker-root';

export type TeardownFn = () => void;

export function createOverlay(root: HTMLDivElement): {
  overlay: HTMLDivElement;
  highlight: HTMLDivElement;
  panel: HTMLDivElement;
  setCurrentElement: (el: Element | null) => void;
  getCurrentElement: () => Element | null;
  onMove: (clientX: number, clientY: number) => void;
  onOverlayClick: () => Element | null;
  showPanelForElement: (element: Element) => void;
  hidePanel: () => void;
} {
  let currentElement: Element | null = null;

  const overlay = document.createElement('div');
  overlay.className = 'selector-picker-overlay';
  overlay.innerHTML =
    '<span class="selector-picker-hint">Click an element to get locators · Esc to close panel · Shortcut to exit</span>';

  const highlight = createHighlightElement();
  root.appendChild(overlay);
  root.appendChild(highlight);

  const panel = document.createElement('div');
  panel.className = 'selector-picker-panel';
  panel.innerHTML = `
    <div class="selector-picker-panel-header">
      <h3>Element locators</h3>
      <div class="selector-picker-panel-actions">
        <button type="button" class="selector-picker-btn selector-picker-pick-another">Pick another</button>
        <button type="button" class="selector-picker-btn selector-picker-close">Close</button>
      </div>
    </div>
    <div class="selector-picker-locators"></div>
  `;
  root.appendChild(panel);

  function setCurrentElement(el: Element | null) {
    currentElement = el;
  }
  function getCurrentElement() {
    return currentElement;
  }
  function onMove(clientX: number, clientY: number) {
    currentElement = updateHighlight(highlight, ROOT_ID, clientX, clientY);
  }
  function onOverlayClick() {
    return currentElement;
  }
  function hidePanel() {
    panel.classList.remove('selector-picker-panel-visible');
  }

  function createLocatorRow(label: string, value: string, id: string): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'selector-picker-row';
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    labelEl.htmlFor = id;
    const pre = document.createElement('pre');
    pre.id = id;
    pre.textContent = value || '—';
    pre.setAttribute('contenteditable', 'false');
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy';
    copyBtn.className = 'selector-picker-copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(value || '').then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
        }, 1500);
      });
    });
    row.appendChild(labelEl);
    row.appendChild(pre);
    row.appendChild(copyBtn);
    return row;
  }

  function showPanelForElement(element: Element) {
    chrome.storage.sync.get({ testIdAttribute: 'data-testid' }, (result) => {
      const locators = getLocatorsForElement(element, {
        testIdAttribute: result.testIdAttribute || 'data-testid',
      });
      const container = panel.querySelector('.selector-picker-locators');
      if (!container) return;
      container.innerHTML = '';
      container.appendChild(createLocatorRow('XPath', locators.xpath, 'picker-xpath'));
      container.appendChild(createLocatorRow('CSS', locators.css, 'picker-css'));
      container.appendChild(createLocatorRow('Playwright', locators.playwright, 'picker-playwright'));
      const otherEntries = Object.entries(locators.other);
      if (otherEntries.length > 0) {
        const otherText = otherEntries.map(([k, v]) => `${k}: ${v}`).join('\n');
        container.appendChild(createLocatorRow('Other', otherText, 'picker-other'));
      }
      panel.classList.add('selector-picker-panel-visible');
    });
  }

  return {
    overlay,
    highlight,
    panel,
    setCurrentElement,
    getCurrentElement,
    onMove,
    onOverlayClick,
    showPanelForElement,
    hidePanel,
  };
}

export function injectStyles(root: HTMLDivElement): void {
  const style = document.createElement('style');
  style.textContent = getHighlightStyles(ROOT_ID);
  root.appendChild(style);
}

export function attachOverlayListeners(
  overlay: HTMLDivElement,
  panel: HTMLDivElement,
  api: ReturnType<typeof createOverlay>
): void {
  overlay.addEventListener('mousemove', (e) => {
    api.onMove(e.clientX, e.clientY);
  });
  overlay.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const el = api.onOverlayClick();
    if (el) api.showPanelForElement(el);
  });
  panel.querySelector('.selector-picker-close')?.addEventListener('click', () => api.hidePanel());
  panel.querySelector('.selector-picker-pick-another')?.addEventListener('click', () => {
    api.hidePanel();
  });
}

export function getRootId(): string {
  return ROOT_ID;
}
