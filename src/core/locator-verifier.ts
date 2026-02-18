/**
 * Locator verification engine.
 *
 * Accepts a raw locator string, auto-detects its type (XPath, CSS, or
 * Playwright), evaluates it against the live DOM, and returns matched elements.
 */

export type LocatorType = 'xpath' | 'css' | 'playwright';

export interface VerifyResult {
  type: LocatorType;
  matches: Element[];
  error?: string;
}

/**
 * Detect the locator type from the raw input string.
 */
export function detectLocatorType(input: string): LocatorType {
  const trimmed = input.trimStart();
  if (trimmed.startsWith('//') || trimmed.startsWith('/')) return 'xpath';
  if (trimmed.startsWith('page.')) return 'playwright';
  return 'css';
}

// ---------------------------------------------------------------------------
// XPath evaluation
// ---------------------------------------------------------------------------

function evaluateXPath(xpath: string, contextDoc?: Document): Element[] {
  const doc = contextDoc ?? document;
  try {
    const result = doc.evaluate(
      xpath,
      doc,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null,
    );
    const elements: Element[] = [];
    for (let i = 0; i < result.snapshotLength; i++) {
      const node = result.snapshotItem(i);
      if (node && node.nodeType === Node.ELEMENT_NODE) {
        elements.push(node as Element);
      }
    }
    return elements;
  } catch {
    throw new Error('Invalid XPath expression');
  }
}

// ---------------------------------------------------------------------------
// CSS evaluation
// ---------------------------------------------------------------------------

function evaluateCSS(selector: string, contextDoc?: Document): Element[] {
  const doc = contextDoc ?? document;
  try {
    return Array.from(doc.querySelectorAll(selector));
  } catch {
    throw new Error('Invalid CSS selector');
  }
}

// ---------------------------------------------------------------------------
// Playwright locator parser & evaluator
// ---------------------------------------------------------------------------

/** Extract `{ name: '...' }` option from an arguments string. */
function extractNameOption(argsStr: string): string | null {
  const m = argsStr.match(/name\s*:\s*['"](.+?)['"]/);
  return m ? m[1] : null;
}

/**
 * Map common HTML elements to their implicit ARIA roles so we can match
 * elements even when an explicit `role` attribute is absent.
 */
const IMPLICIT_ROLES: Record<string, string[]> = {
  button: ['button', 'input[type="button"]', 'input[type="submit"]', 'input[type="reset"]', 'summary'],
  link: ['a[href]', 'area[href]'],
  textbox: ['input:not([type])', 'input[type="text"]', 'input[type="email"]', 'input[type="tel"]', 'input[type="url"]', 'input[type="search"]', 'input[type="password"]', 'textarea'],
  checkbox: ['input[type="checkbox"]'],
  radio: ['input[type="radio"]'],
  heading: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  img: ['img[alt]'],
  list: ['ul', 'ol'],
  listitem: ['li'],
  navigation: ['nav'],
  main: ['main'],
  complementary: ['aside'],
  form: ['form[aria-label]', 'form[aria-labelledby]', 'form[name]'],
  region: ['section[aria-label]', 'section[aria-labelledby]'],
  table: ['table'],
  row: ['tr'],
  cell: ['td'],
  columnheader: ['th'],
  combobox: ['select', 'input[list]'],
  option: ['option'],
  dialog: ['dialog'],
  progressbar: ['progress'],
  separator: ['hr'],
};

/** Get the accessible name of an element (simplified). */
function getAccessibleName(el: Element): string {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  const ariaLabelledBy = el.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const doc = el.ownerDocument;
    const parts = ariaLabelledBy.split(/\s+/).map((id) => {
      const ref = doc.getElementById(id);
      return ref ? (ref.textContent ?? '').trim() : '';
    });
    const joined = parts.filter(Boolean).join(' ');
    if (joined) return joined;
  }

  const title = el.getAttribute('title');
  if (title) return title.trim();

  return (el.textContent ?? '').trim();
}

function evaluateGetByRole(
  role: string,
  name: string | null,
  contextDoc?: Document,
): Element[] {
  const doc = contextDoc ?? document;
  const candidates: Element[] = [];

  // Elements with explicit role attribute
  const explicit = doc.querySelectorAll(`[role="${role}"]`);
  explicit.forEach((el) => candidates.push(el));

  // Elements with implicit role
  const implicitSelectors = IMPLICIT_ROLES[role];
  if (implicitSelectors) {
    for (const sel of implicitSelectors) {
      doc.querySelectorAll(sel).forEach((el) => {
        if (!el.hasAttribute('role') && !candidates.includes(el)) {
          candidates.push(el);
        }
      });
    }
  }

  if (name === null) return candidates;

  return candidates.filter((el) => {
    const accName = getAccessibleName(el);
    return accName === name || accName.includes(name);
  });
}

function evaluateGetByText(
  text: string,
  contextDoc?: Document,
): Element[] {
  const doc = contextDoc ?? document;
  const all = doc.querySelectorAll('*');
  const matches: Element[] = [];
  all.forEach((el) => {
    // Only match if the element has direct text (not just inherited)
    const directText = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent ?? '')
      .join('')
      .trim();
    if (directText && (directText === text || directText.includes(text))) {
      matches.push(el);
    }
  });
  // Also check full textContent for elements with no direct text children match
  if (matches.length === 0) {
    all.forEach((el) => {
      const tc = (el.textContent ?? '').trim();
      if (tc === text || tc.includes(text)) {
        matches.push(el);
      }
    });
  }
  return matches;
}

function evaluateGetByLabel(
  labelText: string,
  contextDoc?: Document,
): Element[] {
  const doc = contextDoc ?? document;
  const labels = doc.querySelectorAll('label');
  const matches: Element[] = [];
  labels.forEach((label) => {
    const lt = (label.textContent ?? '').trim();
    if (lt === labelText || lt.includes(labelText)) {
      // via `for` attribute
      const forId = label.getAttribute('for');
      if (forId) {
        const target = doc.getElementById(forId);
        if (target) matches.push(target);
      }
      // via nested input
      const nested = label.querySelector('input, select, textarea');
      if (nested && !matches.includes(nested)) {
        matches.push(nested);
      }
    }
  });

  // Also check aria-label
  if (matches.length === 0) {
    const ariaMatches = doc.querySelectorAll(`[aria-label="${labelText}"]`);
    ariaMatches.forEach((el) => matches.push(el));
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Playwright .filter() chain support
// ---------------------------------------------------------------------------

/**
 * Find the index of the closing paren that matches the open paren at `start`.
 * Returns -1 if unbalanced.
 */
function findClosingParen(str: string, start: number): number {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    const prev = i > 0 ? str[i - 1] : '';
    if (prev === '\\') continue;
    if (ch === "'" && !inDouble && !inBacktick) inSingle = !inSingle;
    else if (ch === '"' && !inSingle && !inBacktick) inDouble = !inDouble;
    else if (ch === '`' && !inSingle && !inDouble) inBacktick = !inBacktick;
    else if (!inSingle && !inDouble && !inBacktick) {
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  return -1;
}

/**
 * Split a Playwright chain like
 *   `page.getByRole('listitem').filter({ hasText: 'Product' }).filter({ has: page.locator('img') })`
 * into `{ base, filters }` where base is the first locator call and filters
 * are the raw argument strings inside each `.filter(...)`.
 */
function splitPlaywrightChain(input: string): { base: string; filters: string[] } {
  // Find the end of the first method call (balanced parens)
  const firstParen = input.indexOf('(');
  if (firstParen === -1) return { base: input, filters: [] };

  const closeParen = findClosingParen(input, firstParen);
  if (closeParen === -1) return { base: input, filters: [] };

  const base = input.slice(0, closeParen + 1);
  let rest = input.slice(closeParen + 1);
  const filters: string[] = [];

  while (rest.startsWith('.filter(')) {
    const innerStart = '.filter('.length;
    const closeIdx = findClosingParen(rest, innerStart - 1);
    if (closeIdx === -1) break;
    // Extract the contents between the outer parens of .filter(...)
    filters.push(rest.slice(innerStart, closeIdx));
    rest = rest.slice(closeIdx + 1);
  }

  return { base, filters };
}

interface FilterOptions {
  hasText?: string;
  hasNotText?: string;
  hasLocator?: string;
  hasNotLocator?: string;
}

/**
 * Parse the raw argument string inside `.filter({ ... })`.
 * Supports: hasText, hasNotText, has, hasNot.
 */
function parseFilterOptions(raw: string): FilterOptions {
  const opts: FilterOptions = {};

  // hasText: 'string' or hasText: "string"
  let m = raw.match(/hasText\s*:\s*(['"])(.*?)\1/);
  if (m) opts.hasText = m[2];

  // hasNotText: 'string'
  m = raw.match(/hasNotText\s*:\s*(['"])(.*?)\1/);
  if (m) opts.hasNotText = m[2];

  // has: page.locator('...') or page.getBy...('...')
  m = raw.match(/has\s*:\s*(page\.[^,}]+)/);
  if (m) opts.hasLocator = m[1].trim();

  // hasNot: page.locator('...') or page.getBy...('...')
  m = raw.match(/hasNot\s*:\s*(page\.[^,}]+)/);
  if (m) opts.hasNotLocator = m[1].trim();

  return opts;
}

/**
 * Apply a single filter to a list of candidate elements.
 */
function applyFilter(
  elements: Element[],
  opts: FilterOptions,
  testIdAttr: string,
  contextDoc?: Document,
): Element[] {
  let result = elements;

  if (opts.hasText !== undefined) {
    result = result.filter((el) => {
      const text = (el.textContent ?? '').trim();
      return text.includes(opts.hasText!);
    });
  }

  if (opts.hasNotText !== undefined) {
    result = result.filter((el) => {
      const text = (el.textContent ?? '').trim();
      return !text.includes(opts.hasNotText!);
    });
  }

  if (opts.hasLocator !== undefined) {
    const innerMatches = evaluatePlaywrightBase(opts.hasLocator, testIdAttr, contextDoc);
    result = result.filter((el) =>
      innerMatches.some((inner) => el.contains(inner)),
    );
  }

  if (opts.hasNotLocator !== undefined) {
    const innerMatches = evaluatePlaywrightBase(opts.hasNotLocator, testIdAttr, contextDoc);
    result = result.filter((el) =>
      !innerMatches.some((inner) => el.contains(inner)),
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Playwright base locator evaluator (single call, no .filter() chain)
// ---------------------------------------------------------------------------

function evaluatePlaywrightBase(
  input: string,
  testIdAttr: string,
  contextDoc?: Document,
): Element[] {
  const trimmed = input.trim();

  // page.getByTestId('val')
  let m = trimmed.match(/^page\.getByTestId\((['"])(.*?)\1\)$/);
  if (m) return evaluateCSS(`[${testIdAttr}="${m[2]}"]`, contextDoc);

  // page.getByRole('role', { name: '...' }) or page.getByRole('role')
  m = trimmed.match(/^page\.getByRole\((['"])(.*?)\1(?:\s*,\s*\{(.*?)\})?\)$/);
  if (m) {
    const role = m[2];
    const opts = m[3] ?? '';
    const name = extractNameOption(opts);
    return evaluateGetByRole(role, name, contextDoc);
  }

  // page.getByText('text')
  m = trimmed.match(/^page\.getByText\((['"])(.*?)\1\)$/);
  if (m) return evaluateGetByText(m[2], contextDoc);

  // page.getByLabel('label')
  m = trimmed.match(/^page\.getByLabel\((['"])(.*?)\1\)$/);
  if (m) return evaluateGetByLabel(m[2], contextDoc);

  // page.getByPlaceholder('placeholder')
  m = trimmed.match(/^page\.getByPlaceholder\((['"])(.*?)\1\)$/);
  if (m) return evaluateCSS(`[placeholder="${m[2]}"]`, contextDoc);

  // page.locator('xpath=...')
  m = trimmed.match(/^page\.locator\((['"])(.*?)\1\)$/);
  if (m) {
    const locStr = m[2];
    if (locStr.startsWith('xpath=')) {
      return evaluateXPath(locStr.slice(6), contextDoc);
    }
    return evaluateCSS(locStr, contextDoc);
  }

  // page.locator(`xpath=...`) with backticks
  m = trimmed.match(/^page\.locator\(`(.*?)`\)$/);
  if (m) {
    const locStr = m[1];
    if (locStr.startsWith('xpath=')) {
      return evaluateXPath(locStr.slice(6), contextDoc);
    }
    return evaluateCSS(locStr, contextDoc);
  }

  throw new Error(`Unrecognized Playwright locator: ${trimmed}`);
}

// ---------------------------------------------------------------------------
// Full Playwright evaluator with .filter() chain support
// ---------------------------------------------------------------------------

function evaluatePlaywright(
  input: string,
  testIdAttr: string,
  contextDoc?: Document,
): Element[] {
  const { base, filters } = splitPlaywrightChain(input.trim());

  let elements = evaluatePlaywrightBase(base, testIdAttr, contextDoc);

  for (const filterRaw of filters) {
    const opts = parseFilterOptions(filterRaw);
    elements = applyFilter(elements, opts, testIdAttr, contextDoc);
  }

  return elements;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Verify a locator against the live DOM.
 *
 * @param input       Raw locator string (XPath, CSS, or Playwright).
 * @param testIdAttr  The attribute name used for test IDs (default: data-testid).
 * @param contextDoc  Optional document to evaluate against (for testing).
 */
export function verifyLocator(
  input: string,
  testIdAttr = 'data-testid',
  contextDoc?: Document,
): VerifyResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { type: 'css', matches: [], error: undefined };
  }

  const type = detectLocatorType(trimmed);

  try {
    let matches: Element[];
    switch (type) {
      case 'xpath':
        matches = evaluateXPath(trimmed, contextDoc);
        break;
      case 'playwright':
        matches = evaluatePlaywright(trimmed, testIdAttr, contextDoc);
        break;
      case 'css':
      default:
        matches = evaluateCSS(trimmed, contextDoc);
        break;
    }
    return { type, matches };
  } catch (err) {
    return {
      type,
      matches: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
