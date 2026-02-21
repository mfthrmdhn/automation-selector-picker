/**
 * Generates CSS selectors for a given DOM element.
 *
 * STRATEGY ORDER (collectCSSCandidates):
 *  1.  id                – #submit-btn
 *  2.  data-testid       – [data-testid="submit"]
 *  3.  data-qa / data-cy / data-test-id
 *  4.  aria-label        – button[aria-label="Close dialog"]
 *  5.  name              – input[name="email"]
 *  6.  placeholder       – input[placeholder="Search..."]
 *  7.  alt               – img[alt="Company logo"]
 *  8.  title             – [title="Open settings"]
 *  9.  role              – [role="dialog"]
 * 10.  multi-class       – button.primary.submit
 * 11.  tag-class         – button.submit-btn
 * 12.  class             – .submit-btn
 * 13.  type-name         – input[type="email"][name="email"]
 * 14.  tag-type          – input[type="submit"]
 * 15.  structural        – form > div > button:nth-of-type(1)  (fallback)
 *
 * All unique candidates are collected, scored, and returned ranked by quality.
 */

import { isElement, getDocument, getTagName, getSameTagSiblings } from '../utils/dom-utils';
import { scoreCSS } from './css-scorer';
import type { ScoredCSS } from '../types/locator.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_ID_ATTRS = ['data-testid', 'data-qa', 'data-cy', 'data-test-id', 'data-qaid'] as const;

/** Heuristic: avoid long random-looking class names (e.g. CSS modules, Emotion hashes). */
const UNSTABLE_CLASS_PATTERN = /^[a-z0-9_-]{8,}$/i;
const MAX_CLASS_LENGTH = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStableClass(className: string): boolean {
  return className.length < MAX_CLASS_LENGTH && !UNSTABLE_CLASS_PATTERN.test(className);
}

/**
 * Escape a value for use inside a CSS attribute selector with double quotes.
 * e.g. `[aria-label="Hello \"World\""]`
 */
function escapeAttrValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Returns true if the selector matches exactly the given element (and only that element).
 */
function cssMatchesElement(doc: Document, selector: string, element: Element): boolean {
  try {
    const matches = doc.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === element;
  } catch {
    return false;
  }
}

/**
 * Returns how many elements in the document match the selector.
 */
function countCSS(doc: Document, selector: string): number {
  try {
    return doc.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Candidate type
// ---------------------------------------------------------------------------

interface CSSCandidate {
  selector: string;
  strategy: string;
}

// ---------------------------------------------------------------------------
// Structural path builder (fallback)
// ---------------------------------------------------------------------------

/**
 * Build a structural CSS path anchored at the nearest ancestor with a stable id,
 * then navigate down with child combinators and :nth-of-type indices.
 * Falls back to a full path from the root if no id anchor exists.
 */
function buildStructuralCSS(element: Element): string {
  const path: string[] = [];
  let el: Element | null = element;

  while (el && isElement(el)) {
    const t = getTagName(el);
    const idAttr = el.getAttribute('id');

    if (idAttr) {
      try {
        path.unshift('#' + CSS.escape(idAttr));
        break;
      } catch {
        /* ignore un-escapable id */
      }
    }

    const siblings = el.parentElement ? getSameTagSiblings(el) : [];
    const idx = siblings.indexOf(el) + 1;
    path.unshift(siblings.length === 1 ? t : `${t}:nth-of-type(${idx})`);
    el = el.parentElement;
  }

  return path.join(' > ');
}

// ---------------------------------------------------------------------------
// Candidate collector
// ---------------------------------------------------------------------------

function collectCSSCandidates(element: Element): CSSCandidate[] {
  const maybeDoc = getDocument(element);
  if (!maybeDoc || !isElement(element)) return [];
  const doc: Document = maybeDoc;

  const tag = getTagName(element);
  const candidates: CSSCandidate[] = [];
  const seen = new Set<string>();

  /**
   * Push a candidate only if the selector uniquely identifies the target element.
   * Returns true if pushed.
   */
  function pushIfUnique(selector: string, strategy: string): boolean {
    if (seen.has(selector)) return false;
    if (cssMatchesElement(doc, selector, element)) {
      seen.add(selector);
      candidates.push({ selector, strategy });
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Strategy 1: #id
  // ---------------------------------------------------------------------------
  const id = element.getAttribute('id');
  if (id) {
    try {
      pushIfUnique(`#${CSS.escape(id)}`, 'id');
    } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------------------
  // Strategy 2–3: data-testid / data-qa / data-cy / data-test-id
  // Try bare attribute selector first; then with tag qualifier for readability.
  // ---------------------------------------------------------------------------
  for (const attr of TEST_ID_ATTRS) {
    const val = element.getAttribute(attr);
    if (!val) continue;
    const escaped = escapeAttrValue(val);
    // Bare attribute selector is shorter and preferred
    if (!pushIfUnique(`[${attr}="${escaped}"]`, attr)) {
      // Tag-qualified fallback (still same strategy, same score)
      pushIfUnique(`${tag}[${attr}="${escaped}"]`, attr);
    }
  }

  // ---------------------------------------------------------------------------
  // Strategy 4: aria-label
  // ---------------------------------------------------------------------------
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    const escaped = escapeAttrValue(ariaLabel);
    if (!pushIfUnique(`${tag}[aria-label="${escaped}"]`, 'aria-label')) {
      pushIfUnique(`[aria-label="${escaped}"]`, 'aria-label');
    }
  }

  // ---------------------------------------------------------------------------
  // Strategy 5: name (form elements only)
  // ---------------------------------------------------------------------------
  const name = element.getAttribute('name');
  if (name && /^(input|button|select|textarea|form)$/i.test(element.tagName)) {
    pushIfUnique(`${tag}[name="${escapeAttrValue(name)}"]`, 'name');
  }

  // ---------------------------------------------------------------------------
  // Strategy 6: placeholder
  // ---------------------------------------------------------------------------
  const placeholder = element.getAttribute('placeholder');
  if (placeholder) {
    pushIfUnique(`${tag}[placeholder="${escapeAttrValue(placeholder)}"]`, 'placeholder');
  }

  // ---------------------------------------------------------------------------
  // Strategy 7: alt (images)
  // ---------------------------------------------------------------------------
  if (tag === 'img') {
    const alt = element.getAttribute('alt');
    if (alt) {
      pushIfUnique(`img[alt="${escapeAttrValue(alt)}"]`, 'alt');
    }
  }

  // ---------------------------------------------------------------------------
  // Strategy 8: title
  // ---------------------------------------------------------------------------
  const title = element.getAttribute('title');
  if (title) {
    const escaped = escapeAttrValue(title);
    if (!pushIfUnique(`${tag}[title="${escaped}"]`, 'title')) {
      pushIfUnique(`[title="${escaped}"]`, 'title');
    }
  }

  // ---------------------------------------------------------------------------
  // Strategy 9: role (explicit ARIA role attribute)
  // ---------------------------------------------------------------------------
  const role = element.getAttribute('role');
  if (role) {
    if (!pushIfUnique(`${tag}[role="${role}"]`, 'role')) {
      pushIfUnique(`[role="${role}"]`, 'role');
    }
  }

  // ---------------------------------------------------------------------------
  // Strategy 10–12: class-based selectors
  // Order: multi-class > tag+class > bare class (most to least specific)
  // ---------------------------------------------------------------------------
  const classAttr = element.getAttribute('class');
  if (classAttr) {
    const stableClasses = classAttr
      .trim()
      .split(/\s+/)
      .filter((c) => c && isStableClass(c));

    if (stableClasses.length > 0) {
      // Strategy 10: tag + all stable classes (most specific)
      if (stableClasses.length >= 2) {
        const multiSel = tag + stableClasses.map((c) => `.${CSS.escape(c)}`).join('');
        pushIfUnique(multiSel, 'multi-class');
      }

      // Strategy 11: tag + single class (try each stable class)
      for (const cls of stableClasses) {
        if (pushIfUnique(`${tag}.${CSS.escape(cls)}`, 'tag-class')) break;
      }

      // Strategy 12: bare class (try each stable class without tag qualifier)
      for (const cls of stableClasses) {
        if (pushIfUnique(`.${CSS.escape(cls)}`, 'class')) break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Strategy 13–14: type-based selectors (inputs)
  // ---------------------------------------------------------------------------
  const type = element.getAttribute('type');
  if (type && tag === 'input') {
    // Strategy 13: type + name combo (two conditions, more precise)
    if (name) {
      pushIfUnique(
        `input[type="${escapeAttrValue(type)}"][name="${escapeAttrValue(name)}"]`,
        'type-name',
      );
    }

    // Strategy 14: tag + type alone
    pushIfUnique(`input[type="${escapeAttrValue(type)}"]`, 'tag-type');
  }

  // ---------------------------------------------------------------------------
  // Strategy 15: structural path (always added as last-resort fallback)
  // ---------------------------------------------------------------------------
  const structural = buildStructuralCSS(element);
  if (structural && !seen.has(structural)) {
    seen.add(structural);
    // Verify it actually resolves to the element (structural path may collide in edge cases)
    const matchCount = countCSS(doc, structural);
    if (matchCount >= 1) {
      candidates.push({ selector: structural, strategy: 'structural' });
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate all unique CSS selector candidates for an element, scored and sorted best-first.
 */
export function generateRankedCSS(element: Element): ScoredCSS[] {
  const candidates = collectCSSCandidates(element);
  const scored = candidates.map((c) => scoreCSS(c.selector, c.strategy));
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Generate the single best CSS selector for an element.
 * Backward-compatible wrapper over generateRankedCSS.
 */
export function generateCSS(element: Element): string {
  const ranked = generateRankedCSS(element);
  if (ranked.length > 0) return ranked[0].selector;

  // Ultimate fallback: raw structural path
  return buildStructuralCSS(element) || getTagName(element);
}
