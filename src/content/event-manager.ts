/**
 * Manages overlay and panel DOM and event listeners for the picker.
 */

import { updateHighlight, createHighlightElement, getHighlightStyles } from './highlighter';
import { getLocatorsForElement } from '../core/selector-engine';
import type { ScoredXPath } from '../types/locator.types';

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

  function getScoreColor(score: number): string {
    if (score >= 75) return '#22c55e';
    if (score >= 50) return '#eab308';
    return '#ef4444';
  }

  function createXPathCandidateRow(
    candidate: ScoredXPath,
    index: number
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'selector-picker-row selector-picker-xpath-row';

    const header = document.createElement('div');
    header.className = 'selector-picker-xpath-header';

    const labelEl = document.createElement('label');
    const labelText = index === 0 ? 'XPath' : `XPath (Alt ${index})`;
    labelEl.textContent = labelText;
    const rowId = `picker-xpath-${index}`;
    labelEl.htmlFor = rowId;

    const meta = document.createElement('span');
    meta.className = 'selector-picker-xpath-meta';

    const scoreBadge = document.createElement('span');
    scoreBadge.className = 'selector-picker-score-badge';
    scoreBadge.textContent = `${Math.round(candidate.score)}`;
    scoreBadge.style.borderColor = getScoreColor(candidate.score);
    scoreBadge.style.color = getScoreColor(candidate.score);

    const strategyTag = document.createElement('span');
    strategyTag.className = 'selector-picker-strategy-tag';
    strategyTag.textContent = candidate.strategy;

    meta.appendChild(scoreBadge);
    meta.appendChild(strategyTag);
    header.appendChild(labelEl);
    header.appendChild(meta);

    const pre = document.createElement('pre');
    pre.id = rowId;
    pre.textContent = candidate.xpath || '—';
    pre.setAttribute('contenteditable', 'false');

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy';
    copyBtn.className = 'selector-picker-copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(candidate.xpath || '').then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = 'Copy';
        }, 1500);
      });
    });

    row.appendChild(header);
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

      function appendDivider() {
        const hr = document.createElement('hr');
        hr.className = 'selector-picker-divider';
        container!.appendChild(hr);
      }

      container.appendChild(createLocatorRow('Playwright', locators.playwright, 'picker-playwright'));

      appendDivider();

      // Primary XPath (always visible)
      const xpathCandidates = locators.xpathCandidates.slice(0, 3);
      if (xpathCandidates.length > 0) {
        container.appendChild(createXPathCandidateRow(xpathCandidates[0], 0));
      }

      // Alternative XPaths in a collapsible section (collapsed by default)
      if (xpathCandidates.length > 1) {
        const altSection = document.createElement('div');
        altSection.className = 'selector-picker-xpath-alts';

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'selector-picker-alts-toggle';
        toggle.innerHTML = '<span class="selector-picker-alts-chevron">&#9654;</span> XPATH Alternatives <span class="selector-picker-alts-count">' + (xpathCandidates.length - 1) + '</span>';
        toggle.setAttribute('aria-expanded', 'false');

        const altContent = document.createElement('div');
        altContent.className = 'selector-picker-alts-content';

        for (let i = 1; i < xpathCandidates.length; i++) {
          altContent.appendChild(createXPathCandidateRow(xpathCandidates[i], i));
        }

        toggle.addEventListener('click', () => {
          const expanded = altContent.classList.toggle('selector-picker-alts-expanded');
          toggle.setAttribute('aria-expanded', String(expanded));
          const chevron = toggle.querySelector('.selector-picker-alts-chevron');
          if (chevron) chevron.innerHTML = expanded ? '&#9660;' : '&#9654;';
        });

        altSection.appendChild(toggle);
        altSection.appendChild(altContent);
        container.appendChild(altSection);
      }

      appendDivider();

      container.appendChild(createLocatorRow('CSS', locators.css, 'picker-css'));

      const otherEntries = Object.entries(locators.other);
      if (otherEntries.length > 0) {
        appendDivider();
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
