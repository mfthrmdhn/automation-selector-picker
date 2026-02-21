/**
 * Playwright locator generator.
 *
 * Generates multiple Playwright locator candidates following best practices:
 *
 * STRATEGY ORDER (priority per Playwright docs):
 *  1. getByRole with name       – page.getByRole('button', { name: 'Submit' })
 *  2. getByRole without name    – page.getByRole('button')
 *  3. getByLabel                – page.getByLabel('Email')
 *  4. getByPlaceholder          – page.getByPlaceholder('Search...')
 *  5. getByText                 – page.getByText('Sign in')
 *  6. getByAltText              – page.getByAltText('Logo')
 *  7. getByTitle                – page.getByTitle('Settings')
 *  8. getByTestId               – page.getByTestId('submit-btn')
 *  9. chained locator           – page.locator('form').getByRole('button', { name: 'Submit' })
 * 10. filter locator            – page.getByRole('listitem').filter({ hasText: 'Product' })
 * 11. page.locator(css)         – CSS fallback
 * 12. page.locator('//...') – XPath fallback (last resort)
 *
 * Additionally, for non-unique base locators:
 * - .first() / .last() / .nth(n) – positional narrowing
 *
 * All candidates are collected, scored, and returned ranked by quality.
 */

import type { AttributeAnalysis } from '../core/attribute-analyzer';
import type { ScoredPlaywright } from '../types/locator.types';
import { escapeSingleQuoted } from '../utils/string-utils';
import { scorePlaywright } from '../core/playwright-scorer';

export interface LocatorContext {
  xpath: string;
  css: string;
  attrs: AttributeAnalysis;
  testIdAttribute?: string;
}

// ---------------------------------------------------------------------------
// Internal candidate type (before scoring)
// ---------------------------------------------------------------------------
interface PlaywrightCandidate {
  locator: string;
  strategy: string;
}

// ---------------------------------------------------------------------------
// Semantic ancestors for chained locators
// ---------------------------------------------------------------------------
const SEMANTIC_ANCESTORS = [
  'form', 'nav', 'main', 'section', 'header', 'footer',
  'dialog', 'aside', 'article',
];

// ---------------------------------------------------------------------------
// Uniqueness check helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a Playwright locator string to the set of matching DOM elements.
 * Uses simple heuristics to avoid circular deps with the full verifier.
 */
function getMatchedElements(locator: string, refElement: Element): Element[] {
  const doc = refElement.ownerDocument;
  try {
    // getByTestId → attribute selector
    let m = locator.match(/^page\.getByTestId\('(.+?)'\)$/);
    if (m) {
      return Array.from(doc.querySelectorAll(`[data-testid="${m[1]}"]`));
    }

    // getByRole with name
    m = locator.match(/^page\.getByRole\('(.+?)',\s*\{\s*name:\s*'(.+?)'\s*\}\)$/);
    if (m) {
      const [, role, name] = m;
      const byAttr = doc.querySelectorAll(`[role="${role}"]`);
      const byTag = getImplicitRoleElements(doc, role);
      const all = [...Array.from(byAttr), ...byTag.filter((el) => !el.hasAttribute('role'))];
      return all.filter((el) => getAccessibleName(el).includes(name));
    }

    // getByRole without name
    m = locator.match(/^page\.getByRole\('(.+?)'\)$/);
    if (m) {
      const byAttr = Array.from(doc.querySelectorAll(`[role="${m[1]}"]`));
      const byTag = getImplicitRoleElements(doc, m[1]);
      return [...new Set([...byAttr, ...byTag])];
    }

    // getByLabel
    m = locator.match(/^page\.getByLabel\('(.+?)'\)$/);
    if (m) {
      const results: Element[] = [];
      doc.querySelectorAll('label').forEach((label) => {
        const lt = (label.textContent ?? '').trim();
        if (lt.includes(m![1])) {
          const forId = label.getAttribute('for');
          if (forId) {
            const target = doc.getElementById(forId);
            if (target) results.push(target);
          } else {
            const inner = label.querySelector('input, select, textarea');
            if (inner) results.push(inner);
          }
        }
      });
      if (results.length) return results;
      return Array.from(doc.querySelectorAll(`[aria-label="${m[1]}"]`));
    }

    // getByPlaceholder
    m = locator.match(/^page\.getByPlaceholder\('(.+?)'\)$/);
    if (m) return Array.from(doc.querySelectorAll(`[placeholder="${m[1]}"]`));

    // getByText
    m = locator.match(/^page\.getByText\('(.+?)'\)$/);
    if (m) {
      const text = m[1];
      const results: Element[] = [];
      doc.querySelectorAll('*').forEach((el) => {
        const direct = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent ?? '')
          .join('')
          .trim();
        if (direct && direct.includes(text)) results.push(el);
      });
      return results;
    }

    // getByAltText
    m = locator.match(/^page\.getByAltText\('(.+?)'\)$/);
    if (m) return Array.from(doc.querySelectorAll(`[alt="${m[1]}"]`));

    // getByTitle
    m = locator.match(/^page\.getByTitle\('(.+?)'\)$/);
    if (m) return Array.from(doc.querySelectorAll(`[title="${m[1]}"]`));

    // page.locator(css)
    m = locator.match(/^page\.locator\('(.+?)'\)$/);
    if (m && !m[1].startsWith('//')) {
      return Array.from(doc.querySelectorAll(m[1]));
    }

    // For chained/filter/xpath, can't easily resolve – return [refElement]
    return [refElement];
  } catch {
    return [];
  }
}

/**
 * Count how many elements match a Playwright locator in the document.
 */
function countMatches(locator: string, element: Element): number {
  return getMatchedElements(locator, element).length;
}

/**
 * Find the 0-based index of `target` among the elements matching `locator`.
 * Returns -1 if the target is not found in the match set.
 */
function findMatchIndex(locator: string, target: Element): number {
  const matched = getMatchedElements(locator, target);
  return matched.indexOf(target);
}

// Implicit role helpers (lightweight version)
const IMPLICIT_ROLE_MAP: Record<string, string[]> = {
  button: ['button', 'input[type="button"]', 'input[type="submit"]', 'input[type="reset"]'],
  link: ['a[href]'],
  textbox: ['input:not([type])', 'input[type="text"]', 'input[type="email"]', 'input[type="tel"]', 'input[type="url"]', 'input[type="search"]', 'input[type="password"]', 'textarea'],
  checkbox: ['input[type="checkbox"]'],
  radio: ['input[type="radio"]'],
  heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  img: ['img[alt]'],
  listitem: ['li'],
  list: ['ul', 'ol'],
  combobox: ['select'],
  option: ['option'],
  navigation: ['nav'],
  main: ['main'],
  dialog: ['dialog'],
};

function getImplicitRoleElements(doc: Document, role: string): Element[] {
  const selectors = IMPLICIT_ROLE_MAP[role];
  if (!selectors) return [];
  const results: Element[] = [];
  for (const sel of selectors) {
    doc.querySelectorAll(sel).forEach((el) => results.push(el));
  }
  return results;
}

function getAccessibleName(el: Element): string {
  return (
    el.getAttribute('aria-label') ??
    el.getAttribute('title') ??
    (el.textContent ?? '').trim()
  );
}

// ---------------------------------------------------------------------------
// Candidate collector
// ---------------------------------------------------------------------------

function collectPlaywrightCandidates(
  element: Element,
  { xpath, css, attrs }: LocatorContext,
): PlaywrightCandidate[] {
  const candidates: PlaywrightCandidate[] = [];
  const seen = new Set<string>();

  function push(locator: string, strategy: string) {
    if (seen.has(locator)) return;
    seen.add(locator);
    candidates.push({ locator, strategy });
  }

  const esc = escapeSingleQuoted;

  // 1. getByRole with name
  if (attrs.role && attrs.accessibleName) {
    const name = esc(attrs.accessibleName.trim());
    push(`page.getByRole('${attrs.role}', { name: '${name}' })`, 'getByRole-name');
  }

  // 2. getByRole without name
  if (attrs.role) {
    push(`page.getByRole('${attrs.role}')`, 'getByRole-noname');
  }

  // 3. getByLabel (for form controls)
  const labelText = findLabelText(element);
  if (labelText) {
    push(`page.getByLabel('${esc(labelText)}')`, 'getByLabel');
  }

  // 4. getByPlaceholder
  if (attrs.placeholder) {
    push(`page.getByPlaceholder('${esc(attrs.placeholder)}')`, 'getByPlaceholder');
  }

  // 5. getByText
  if (attrs.textContent && attrs.textContent.length < 100 && !attrs.textContent.includes('\n')) {
    push(`page.getByText('${esc(attrs.textContent)}')`, 'getByText');
  }

  // 6. getByAltText
  if (attrs.alt) {
    push(`page.getByAltText('${esc(attrs.alt)}')`, 'getByAltText');
  }

  // 7. getByTitle
  if (attrs.title) {
    push(`page.getByTitle('${esc(attrs.title)}')`, 'getByTitle');
  }

  // 8. getByTestId
  if (attrs.testId) {
    push(`page.getByTestId('${esc(attrs.testId)}')`, 'getByTestId');
  }
  if (attrs.customId) {
    push(`page.getByTestId('${esc(attrs.customId)}')`, 'getByTestId');
  }

  // 9. Chained locator – find nearest semantic ancestor and chain
  tryChainedLocator(element, attrs, candidates, seen);

  // 10. Filter locator – try narrowing ambiguous getByRole with hasText
  tryFilterLocator(element, attrs, candidates, seen);

  // 11. CSS fallback
  if (css && css.length < 200) {
    push(`page.locator('${esc(css)}')`, 'css-locator');
  }

  // 12. XPath fallback — XPath string literals use double quotes so no escaping needed.
  // The replace is kept as a safety net for any edge-case single quotes (e.g. concat expressions).
  if (xpath) {
    push(`page.locator('${xpath.replace(/'/g, "\\'")}')`, 'xpath-locator');
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Strategy helpers
// ---------------------------------------------------------------------------

/** Find the text of a <label> associated with this form element. */
function findLabelText(element: Element): string | null {
  const doc = element.ownerDocument;
  const tag = element.tagName.toLowerCase();
  if (!['input', 'select', 'textarea'].includes(tag)) return null;

  // Check for label[for=id]
  const id = element.id;
  if (id) {
    const label = doc.querySelector(`label[for="${id}"]`);
    if (label) {
      const text = (label.textContent ?? '').trim();
      if (text) return text;
    }
  }

  // Check for parent label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    const text = (parentLabel.textContent ?? '').trim();
    if (text) return text;
  }

  return null;
}

/** Try to generate a chained locator via a semantic ancestor. */
function tryChainedLocator(
  element: Element,
  attrs: AttributeAnalysis,
  candidates: PlaywrightCandidate[],
  seen: Set<string>,
) {
  let ancestor: Element | null = element.parentElement;
  while (ancestor) {
    const tag = ancestor.tagName.toLowerCase();
    if (SEMANTIC_ANCESTORS.includes(tag)) {
      // Build ancestor selector
      let ancestorSel: string | null = null;
      const ancestorId = ancestor.getAttribute('aria-label');
      const ancestorName = ancestor.getAttribute('name');
      const ancestorTestId = ancestor.getAttribute('data-testid');

      if (ancestorTestId) {
        ancestorSel = `[data-testid="${ancestorTestId}"]`;
      } else if (ancestorId) {
        ancestorSel = `${tag}[aria-label="${ancestorId}"]`;
      } else if (ancestorName) {
        ancestorSel = `${tag}[name="${ancestorName}"]`;
      } else {
        ancestorSel = tag;
      }

      // Build the chained part
      const esc = escapeSingleQuoted;
      if (attrs.role && attrs.accessibleName) {
        const name = esc(attrs.accessibleName.trim());
        const locator = `page.locator('${esc(ancestorSel)}').getByRole('${attrs.role}', { name: '${name}' })`;
        if (!seen.has(locator)) {
          seen.add(locator);
          candidates.push({ locator, strategy: 'chained' });
        }
      } else if (attrs.role) {
        const locator = `page.locator('${esc(ancestorSel)}').getByRole('${attrs.role}')`;
        if (!seen.has(locator)) {
          seen.add(locator);
          candidates.push({ locator, strategy: 'chained' });
        }
      }
      break;
    }
    ancestor = ancestor.parentElement;
  }
}

/** Try to generate a filter-based locator for ambiguous role matches. */
function tryFilterLocator(
  _element: Element,
  attrs: AttributeAnalysis,
  candidates: PlaywrightCandidate[],
  seen: Set<string>,
) {
  if (!attrs.role || !attrs.textContent) return;
  const text = attrs.textContent.trim();
  if (!text || text.length > 60) return;

  const esc = escapeSingleQuoted;
  const locator = `page.getByRole('${attrs.role}').filter({ hasText: '${esc(text)}' })`;
  if (!seen.has(locator)) {
    seen.add(locator);
    candidates.push({ locator, strategy: 'filter' });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate ranked Playwright locator candidates for an element.
 * Returns scored candidates sorted by score descending (best first).
 *
 * The primary (first) locator is guaranteed to be unique (matches exactly
 * 1 element). If no unique candidate exists, the highest-scored candidate
 * is used as a fallback. Alternatives may be non-unique.
 */
export function generateRankedPlaywright(
  element: Element,
  context: LocatorContext,
): ScoredPlaywright[] {
  const candidates = collectPlaywrightCandidates(element, context);

  // Derive .nth() / .first() / .last() variants from non-unique candidates
  const nthCandidates = deriveNthCandidates(candidates, element);
  const allCandidates = [...candidates, ...nthCandidates];

  const scored = allCandidates.map((c) => {
    const matchCount = countMatches(c.locator, element);
    return scorePlaywright(c.locator, c.strategy, matchCount);
  });

  scored.sort((a, b) => b.score - a.score);

  // Enforce strict uniqueness for the primary locator: promote the
  // highest-scored unique candidate to position 0.
  const uniqueIdx = scored.findIndex((c) => c.breakdown.uniqueness === 100);
  if (uniqueIdx > 0) {
    const [unique] = scored.splice(uniqueIdx, 1);
    scored.unshift(unique);
  }

  return scored;
}

/**
 * For non-unique base locators, derive .first() / .last() / .nth(n) variants
 * so that the target element can be pinpointed by position.
 */
function deriveNthCandidates(
  candidates: PlaywrightCandidate[],
  target: Element,
): PlaywrightCandidate[] {
  const derived: PlaywrightCandidate[] = [];
  const seen = new Set<string>();

  for (const c of candidates) {
    const matchCount = countMatches(c.locator, target);
    if (matchCount <= 1) continue;

    const idx = findMatchIndex(c.locator, target);
    if (idx < 0) continue;

    // .first()
    if (idx === 0) {
      const loc = `${c.locator}.first()`;
      if (!seen.has(loc)) {
        seen.add(loc);
        derived.push({ locator: loc, strategy: 'first' });
      }
    }

    // .last()
    if (idx === matchCount - 1) {
      const loc = `${c.locator}.last()`;
      if (!seen.has(loc)) {
        seen.add(loc);
        derived.push({ locator: loc, strategy: 'last' });
      }
    }

    // .nth(n) – always add (covers first/last as well as middle positions)
    const nthLoc = `${c.locator}.nth(${idx})`;
    if (!seen.has(nthLoc)) {
      seen.add(nthLoc);
      derived.push({ locator: nthLoc, strategy: 'nth' });
    }
  }

  return derived;
}

/**
 * Backward-compatible wrapper: returns the best Playwright locator string.
 */
export function getPlaywrightLocator(
  element: Element,
  context: LocatorContext,
): string {
  const ranked = generateRankedPlaywright(element, context);
  return ranked[0]?.locator ?? `page.locator('${context.xpath.replace(/'/g, "\\'")}')`;

}
