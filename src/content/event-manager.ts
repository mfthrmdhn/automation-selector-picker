/**
 * Manages overlay and panel DOM and event listeners for the picker.
 */

import { updateHighlight, createHighlightElement, getHighlightStyles } from './highlighter';
import { getLocatorsForElement } from '../core/selector-engine';
import { verifyLocator, detectLocatorType } from '../core/locator-verifier';
import type { ScoredXPath, ScoredPlaywright, ScoredCSS } from '../types/locator.types';

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
  const hint = document.createElement('span');
  hint.className = 'selector-picker-hint';
  hint.textContent = 'Click an element to get locators \u00b7 Esc to close panel \u00b7 Shortcut to exit';
  overlay.appendChild(hint);

  const highlight = createHighlightElement();
  root.appendChild(overlay);
  root.appendChild(highlight);

  const panel = document.createElement('div');
  panel.className = 'selector-picker-panel';

  const header = document.createElement('div');
  header.className = 'selector-picker-panel-header';
  const h3 = document.createElement('h3');
  h3.textContent = 'Element locators';
  const actions = document.createElement('div');
  actions.className = 'selector-picker-panel-actions';
  const verifyBtn = document.createElement('button');
  verifyBtn.type = 'button';
  verifyBtn.className = 'selector-picker-btn selector-picker-pick-another';
  verifyBtn.textContent = 'Verify Locator';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'selector-picker-btn selector-picker-close';
  closeBtn.textContent = 'Close';
  actions.appendChild(verifyBtn);
  actions.appendChild(closeBtn);
  header.appendChild(h3);
  header.appendChild(actions);

  // -- Verificator section --
  const verificator = document.createElement('div');
  verificator.className = 'selector-picker-verificator';

  const verifyRow = document.createElement('div');
  verifyRow.className = 'selector-picker-verify-row';

  const verifyInput = document.createElement('input');
  verifyInput.type = 'text';
  verifyInput.className = 'selector-picker-verify-input';
  verifyInput.placeholder = 'Type XPath, CSS, or Playwright locator\u2026';
  verifyInput.spellcheck = false;

  const verifyTypeBadge = document.createElement('span');
  verifyTypeBadge.className = 'selector-picker-verify-type';
  verifyTypeBadge.textContent = 'CSS';

  verifyRow.appendChild(verifyInput);
  verifyRow.appendChild(verifyTypeBadge);

  const verifyResultDiv = document.createElement('div');
  verifyResultDiv.className = 'selector-picker-verify-result';

  verificator.appendChild(verifyRow);
  verificator.appendChild(verifyResultDiv);

  // -- Verify highlight overlays container --
  const verifyHighlightsContainer = document.createElement('div');
  verifyHighlightsContainer.className = 'selector-picker-verify-highlights';

  function clearVerifyHighlights() {
    while (verifyHighlightsContainer.firstChild) {
      verifyHighlightsContainer.firstChild.remove();
    }
  }

  function highlightVerifyMatches(elements: Element[]) {
    clearVerifyHighlights();
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      const overlay = document.createElement('div');
      overlay.className = 'selector-picker-verify-highlight';
      overlay.style.top = `${rect.top}px`;
      overlay.style.left = `${rect.left}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      verifyHighlightsContainer.appendChild(overlay);
    }
  }

  function runVerification() {
    const input = verifyInput.value.trim();
    while (verifyResultDiv.firstChild) verifyResultDiv.firstChild.remove();
    clearVerifyHighlights();

    if (!input) return;

    const testIdAttr = (panel.dataset.testIdAttr) || 'data-testid';
    const result = verifyLocator(input, testIdAttr);

    if (result.error) {
      const errSpan = document.createElement('span');
      errSpan.className = 'selector-picker-verify-error';
      errSpan.textContent = result.error;
      verifyResultDiv.appendChild(errSpan);
      return;
    }

    const countBadge = document.createElement('span');
    countBadge.className = 'selector-picker-verify-match-count';
    const n = result.matches.length;
    if (n > 0) {
      countBadge.classList.add('match-found');
      countBadge.textContent = `${n} element${n === 1 ? '' : 's'} matched`;
    } else {
      countBadge.classList.add('match-none');
      countBadge.textContent = '0 elements matched';
    }
    verifyResultDiv.appendChild(countBadge);

    if (n > 0) {
      highlightVerifyMatches(result.matches);
    }
  }

  verifyInput.addEventListener('input', () => {
    const val = verifyInput.value.trim();
    verifyTypeBadge.textContent = val ? detectLocatorType(val).toUpperCase() : 'CSS';
  });

  verifyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      runVerification();
    }
  });

  verifyBtn.addEventListener('click', () => {
    runVerification();
  });

  const locatorsDiv = document.createElement('div');
  locatorsDiv.className = 'selector-picker-locators';

  panel.appendChild(header);
  panel.appendChild(verificator);
  panel.appendChild(locatorsDiv);
  root.appendChild(panel);
  root.appendChild(verifyHighlightsContainer);

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
    clearVerifyHighlights();
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

  function createPlaywrightCandidateRow(
    candidate: ScoredPlaywright,
    index: number
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'selector-picker-row selector-picker-xpath-row';

    const header = document.createElement('div');
    header.className = 'selector-picker-xpath-header';

    const labelEl = document.createElement('label');
    const rowId = `picker-pw-${index}`;
    labelEl.htmlFor = rowId;

    if (index === 0) {
      labelEl.textContent = 'Playwright';
      const uniqueBadge = document.createElement('span');
      uniqueBadge.className = 'selector-picker-unique-badge';
      uniqueBadge.textContent = 'exact match';
      labelEl.appendChild(document.createTextNode(' '));
      labelEl.appendChild(uniqueBadge);
    } else {
      labelEl.textContent = `Playwright (Alt ${index})`;
    }

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

    // Show match count hint for alternatives that may match multiple elements
    if (index > 0 && candidate.breakdown.uniqueness < 100) {
      const multiHint = document.createElement('span');
      multiHint.className = 'selector-picker-multi-hint';
      multiHint.textContent = 'may match multiple';
      meta.appendChild(multiHint);
    }

    header.appendChild(labelEl);
    header.appendChild(meta);

    const pre = document.createElement('pre');
    pre.id = rowId;
    pre.textContent = candidate.locator || '\u2014';
    pre.setAttribute('contenteditable', 'false');

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy';
    copyBtn.className = 'selector-picker-copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(candidate.locator || '').then(() => {
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

  function createCSSCandidateRow(
    candidate: ScoredCSS,
    index: number
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'selector-picker-row selector-picker-xpath-row';

    const header = document.createElement('div');
    header.className = 'selector-picker-xpath-header';

    const labelEl = document.createElement('label');
    const rowId = `picker-css-${index}`;
    labelEl.htmlFor = rowId;
    labelEl.textContent = index === 0 ? 'CSS' : `CSS (Alt ${index})`;

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
    pre.textContent = candidate.selector || '—';
    pre.setAttribute('contenteditable', 'false');

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = 'Copy';
    copyBtn.className = 'selector-picker-copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(candidate.selector || '').then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
      });
    });

    row.appendChild(header);
    row.appendChild(pre);
    row.appendChild(copyBtn);
    return row;
  }

  function showPanelForElement(element: Element) {
    chrome.storage.sync.get({ testIdAttribute: 'data-testid' }, (result) => {
      const testId = result.testIdAttribute || 'data-testid';
      panel.dataset.testIdAttr = testId;
      const locators = getLocatorsForElement(element, {
        testIdAttribute: testId,
      });
      const container = panel.querySelector('.selector-picker-locators');
      if (!container) return;
      while (container.firstChild) container.firstChild.remove();

      // Clear previous verify state
      clearVerifyHighlights();
      while (verifyResultDiv.firstChild) verifyResultDiv.firstChild.remove();

      function appendDivider() {
        const hr = document.createElement('hr');
        hr.className = 'selector-picker-divider';
        container!.appendChild(hr);
      }

      // Primary Playwright (always visible)
      const pwCandidates = locators.playwrightCandidates.slice(0, 3);
      if (pwCandidates.length > 0) {
        container.appendChild(createPlaywrightCandidateRow(pwCandidates[0], 0));
      }

      // Alternative Playwright locators in a collapsible section
      if (pwCandidates.length > 1) {
        const pwAltSection = document.createElement('div');
        pwAltSection.className = 'selector-picker-xpath-alts';

        const pwToggle = document.createElement('button');
        pwToggle.type = 'button';
        pwToggle.className = 'selector-picker-alts-toggle';
        const pwChevron = document.createElement('span');
        pwChevron.className = 'selector-picker-alts-chevron';
        pwChevron.textContent = '\u25b6';
        const pwToggleLabel = document.createTextNode('PW Alt (May return multiple elements)');
        const pwAltCount = document.createElement('span');
        pwAltCount.className = 'selector-picker-alts-count';
        pwAltCount.textContent = String(pwCandidates.length - 1);
        pwToggle.appendChild(pwChevron);
        pwToggle.appendChild(pwToggleLabel);
        pwToggle.appendChild(pwAltCount);
        pwToggle.setAttribute('aria-expanded', 'false');

        const pwAltContent = document.createElement('div');
        pwAltContent.className = 'selector-picker-alts-content';

        for (let i = 1; i < pwCandidates.length; i++) {
          pwAltContent.appendChild(createPlaywrightCandidateRow(pwCandidates[i], i));
        }

        pwToggle.addEventListener('click', () => {
          const expanded = pwAltContent.classList.toggle('selector-picker-alts-expanded');
          pwToggle.setAttribute('aria-expanded', String(expanded));
          pwChevron.textContent = expanded ? '\u25bc' : '\u25b6';
        });

        pwAltSection.appendChild(pwToggle);
        pwAltSection.appendChild(pwAltContent);
        container.appendChild(pwAltSection);
      }

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
        const chevron = document.createElement('span');
        chevron.className = 'selector-picker-alts-chevron';
        chevron.textContent = '\u25b6';
        const toggleLabel = document.createTextNode(' XPATH Alternatives ');
        const altCount = document.createElement('span');
        altCount.className = 'selector-picker-alts-count';
        altCount.textContent = String(xpathCandidates.length - 1);
        toggle.appendChild(chevron);
        toggle.appendChild(toggleLabel);
        toggle.appendChild(altCount);
        toggle.setAttribute('aria-expanded', 'false');

        const altContent = document.createElement('div');
        altContent.className = 'selector-picker-alts-content';

        for (let i = 1; i < xpathCandidates.length; i++) {
          altContent.appendChild(createXPathCandidateRow(xpathCandidates[i], i));
        }

        toggle.addEventListener('click', () => {
          const expanded = altContent.classList.toggle('selector-picker-alts-expanded');
          toggle.setAttribute('aria-expanded', String(expanded));
          chevron.textContent = expanded ? '\u25bc' : '\u25b6';
        });

        altSection.appendChild(toggle);
        altSection.appendChild(altContent);
        container.appendChild(altSection);
      }

      appendDivider();

      // Primary CSS (always visible)
      const cssCandidates = locators.cssCandidates.slice(0, 3);
      if (cssCandidates.length > 0) {
        container.appendChild(createCSSCandidateRow(cssCandidates[0], 0));
      } else {
        container.appendChild(createLocatorRow('CSS', locators.css, 'picker-css'));
      }

      // Alternative CSS selectors in a collapsible section
      if (cssCandidates.length > 1) {
        const cssAltSection = document.createElement('div');
        cssAltSection.className = 'selector-picker-xpath-alts';

        const cssToggle = document.createElement('button');
        cssToggle.type = 'button';
        cssToggle.className = 'selector-picker-alts-toggle';
        const cssChevron = document.createElement('span');
        cssChevron.className = 'selector-picker-alts-chevron';
        cssChevron.textContent = '\u25b6';
        const cssToggleLabel = document.createTextNode(' CSS Alternatives ');
        const cssAltCount = document.createElement('span');
        cssAltCount.className = 'selector-picker-alts-count';
        cssAltCount.textContent = String(cssCandidates.length - 1);
        cssToggle.appendChild(cssChevron);
        cssToggle.appendChild(cssToggleLabel);
        cssToggle.appendChild(cssAltCount);
        cssToggle.setAttribute('aria-expanded', 'false');

        const cssAltContent = document.createElement('div');
        cssAltContent.className = 'selector-picker-alts-content';

        for (let i = 1; i < cssCandidates.length; i++) {
          cssAltContent.appendChild(createCSSCandidateRow(cssCandidates[i], i));
        }

        cssToggle.addEventListener('click', () => {
          const expanded = cssAltContent.classList.toggle('selector-picker-alts-expanded');
          cssToggle.setAttribute('aria-expanded', String(expanded));
          cssChevron.textContent = expanded ? '\u25bc' : '\u25b6';
        });

        cssAltSection.appendChild(cssToggle);
        cssAltSection.appendChild(cssAltContent);
        container.appendChild(cssAltSection);
      }

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
  _overlay: HTMLDivElement,
  panel: HTMLDivElement,
  api: ReturnType<typeof createOverlay>
): () => void {
  // Use document-level capture listeners so native scroll is never blocked.
  // The overlay is pointer-events: none; all interactions go through the document.
  document.documentElement.classList.add('selector-picker-active');

  const onMouseMove = (e: MouseEvent) => {
    const target = e.target as Element | null;
    if (target?.closest(`#${ROOT_ID} .selector-picker-panel`)) return;
    api.onMove(e.clientX, e.clientY);
  };

  const onClick = (e: MouseEvent) => {
    const target = e.target as Element | null;
    if (target?.closest(`#${ROOT_ID}`)) return;
    e.preventDefault();
    e.stopPropagation();
    const el = api.onOverlayClick();
    if (el) api.showPanelForElement(el);
  };

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);

  panel.querySelector('.selector-picker-close')?.addEventListener('click', () => api.hidePanel());

  return () => {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.documentElement.classList.remove('selector-picker-active');
  };
}

export function getRootId(): string {
  return ROOT_ID;
}
