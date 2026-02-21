/**
 * Generates relative XPath expressions following best practices:
 *
 * CORE PRINCIPLES:
 * 1. Always prefer relative XPath (//), never absolute (/html/body/...)
 * 2. Use unique, stable attributes in priority order:
 *    id > name > data-testid/qa/cy > role+aria-label > aria-label > title > img alt > text > class
 * 3. Avoid dynamic/auto-generated IDs and class names
 * 4. Handle dynamic content with contains(), normalize-space(), text(), starts-with()
 * 5. Leverage XPath axes (descendant, child, following-sibling) for navigation
 * 6. Use logical operators (and/or) to create precise, short locators
 * 7. Never use positional indices (e.g. [3])
 *
 * STRATEGY ORDER (collectXPathCandidates):
 *  1. Stable id (exact when not dynamic; contains() for dynamic prefix)
 *  2. name (form elements)
 *  3. data-testid / data-qa / data-cy / data-test-id
 *  4. role + aria-label (combined with `and`)
 *  5. aria-label alone
 *  6. title attribute
 *  7. img @alt (for img elements)
 *  8. Descendant img[@alt] (container with unique descendant image)
 *  9. Stable text (direct text() for short text; contains(normalize-space(.)) for nested/long)
 * 10. Multi-attribute combination with logical `and`
 * 10b. Text + stable class combination with `and` (e.g. contains(text) and contains(@class))
 * 11. Class (contains() per stable class, then two-class `and`; exact only for short class strings)
 * 12. Path from closest stable ancestor via descendant axis
 * 13. Short relative path using tag names and predicates (no positional index)
 *
 * All unique candidates are collected, scored, and returned ranked by quality.
 */

import { getDocument, getTagName, isElement } from '../utils/dom-utils';
import { xpathMatchesElement } from './uniqueness-checker';
import { scoreXPath } from './xpath-scorer';
import type { ScoredXPath } from '../types/locator.types';

const TEST_ID_ATTRS = ['data-testid', 'data-qa', 'data-cy', 'data-test-id', 'data-qaid'] as const;
/** Max length of text used in contains(); try shortest unique prefix from these lengths. */
const TEXT_PREFIX_LENGTHS = [20, 35, 50, 80];
/** Max text length to attempt direct text() matching (short, stable visible text). */
const DIRECT_TEXT_MAX_LENGTH = 40;

// ---------------------------------------------------------------------------
// Internal XPath candidate (before scoring)
// ---------------------------------------------------------------------------
interface XPathCandidate {
  xpath: string;
  strategy: string;
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Escape value for use inside an XPath quoted attribute (double quotes preferred). */
function escapeXPathAttr(value: string): string {
  if (value.includes("'") && value.includes('"')) {
    return `concat('${value.replace(/'/g, "', \"'\", '")}')`;
  }
  if (value.includes('"')) {
    return `'${value}'`;
  }
  return `"${value}"`;
}

/** Heuristic: id looks auto-generated / dynamic (e.g. "btn-123", "item-abc-123", UUIDs). */
function isLikelyDynamicId(id: string): boolean {
  if (!id || id.length > 50) return true;
  if (/[0-9a-f]{8,}/i.test(id)) return true;
  if (/\d{5,}/.test(id)) return true;
  const parts = id.split(/[-_]/);
  const last = parts[parts.length - 1];
  if (last && /^\d+$/.test(last) && parts.length > 1) return true;
  return false;
}

/** Heuristic: class name looks auto-generated / dynamic (CSS modules hash, Emotion, styled-components, etc.). */
function isLikelyDynamicClass(className: string): boolean {
  if (!className || className.length > 40) return true;
  if (/^[a-z]+-[0-9a-f-]{6,}$/i.test(className)) return true;
  if (/^[a-zA-Z][\w]*_[0-9a-f]{5,}$/i.test(className)) return true;
  if (/[0-9a-f]{6,}$/i.test(className) && /[a-f]/i.test(className.slice(-6))) return true;
  if (/[-_]\d{4,}$/.test(className)) return true;
  return false;
}

function countByXPath(doc: Document, xpath: string): number {
  try {
    const result = doc.evaluate(
      xpath,
      doc,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    return result.snapshotLength;
  } catch {
    return 0;
  }
}

/** Check if xpath resolves to exactly one element and it is the target. */
function isUniqueMatch(doc: Document, xpath: string, element: Element): boolean {
  return countByXPath(doc, xpath) === 1 && xpathMatchesElement(doc, xpath, element);
}

/**
 * When the element has no unique attributes but contains a descendant img with unique alt,
 * return //tag[.//img[@alt='...']] using the descendant axis (.//). Stable and short.
 */
function tryDescendantImgAlt(doc: Document, element: Element, tag: string): string | null {
  const imgs = element.querySelectorAll('img[alt]');
  for (const img of imgs) {
    const alt = img.getAttribute('alt');
    if (!alt || alt.includes("'")) continue;
    const allImgsWithAlt = Array.from(doc.querySelectorAll('img')).filter(
      (el) => el.getAttribute('alt') === alt
    );
    if (allImgsWithAlt.length !== 1) continue;
    const xpath = `//${tag}[.//img[@alt=${escapeXPathAttr(alt)}]]`;
    if (isUniqueMatch(doc, xpath, element)) return xpath;
  }
  return null;
}

/** Check whether the element has only direct text content (no child elements). */
function hasDirectTextOnly(element: Element): boolean {
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) return false;
  }
  return true;
}

/** Try to build a multi-attribute predicate using logical `and` (max 2 predicates). */
function tryMultiAttributeLocator(doc: Document, element: Element, tag: string): string | null {
  const predicates: string[] = [];

  const type = element.getAttribute('type');
  if (type) predicates.push(`@type=${escapeXPathAttr(type)}`);

  const name = element.getAttribute('name');
  if (name) predicates.push(`@name=${escapeXPathAttr(name)}`);

  const placeholder = element.getAttribute('placeholder');
  if (placeholder) predicates.push(`@placeholder=${escapeXPathAttr(placeholder)}`);

  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) predicates.push(`@aria-label=${escapeXPathAttr(ariaLabel)}`);

  const titleVal = element.getAttribute('title');
  if (titleVal) predicates.push(`@title=${escapeXPathAttr(titleVal)}`);

  if (predicates.length >= 2) {
    for (let i = 0; i < predicates.length - 1; i++) {
      for (let j = i + 1; j < predicates.length; j++) {
        const xpath = `//${tag}[${predicates[i]} and ${predicates[j]}]`;
        if (isUniqueMatch(doc, xpath, element)) return xpath;
      }
    }
  }

  return null;
}

/** Combine text with a stable class using `and` when text alone isn't unique. */
function tryTextWithClassLocator(doc: Document, element: Element, tag: string): string | null {
  const text = element.textContent?.trim().replace(/\s+/g, ' ');
  if (!text || text.length === 0 || text.includes("'") || text.includes('"')) return null;

  const cls = element.getAttribute('class');
  if (!cls) return null;

  const classes = cls.trim().split(/\s+/).filter(Boolean);
  const stableClasses = classes.filter((c) => !isLikelyDynamicClass(c));
  if (stableClasses.length === 0) return null;

  const textPredicate = text.length <= DIRECT_TEXT_MAX_LENGTH
    ? `normalize-space(.)=${escapeXPathAttr(text)}`
    : `contains(normalize-space(.), ${escapeXPathAttr(text.slice(0, TEXT_PREFIX_LENGTHS[0]))})`;

  for (const stableClass of stableClasses) {
    const xpath = `//${tag}[${textPredicate} and contains(@class, ${escapeXPathAttr(stableClass)})]`;
    if (isUniqueMatch(doc, xpath, element)) return xpath;
  }

  return null;
}

/** Extract stable (non-dynamic) classes from an element's class attribute. */
function getStableClasses(element: Element): string[] {
  const cls = element.getAttribute('class');
  if (!cls) return [];
  return cls.trim().split(/\s+/).filter((c) => c && !isLikelyDynamicClass(c));
}

// ---------------------------------------------------------------------------
// Candidate collection (core logic – replaces the old early-return waterfall)
// ---------------------------------------------------------------------------

/**
 * Collect ALL unique XPath candidates from every strategy.
 * Each strategy pushes at most one candidate (the first unique variant it finds).
 */
function collectXPathCandidates(element: Element): XPathCandidate[] {
  const maybeDoc = getDocument(element);
  if (!maybeDoc || !isElement(element)) return [];

  const doc: Document = maybeDoc;
  const tag = getTagName(element);
  const candidates: XPathCandidate[] = [];

  /** Push a candidate if the xpath uniquely matches the target element. Returns true if pushed. */
  function pushIfUnique(xpath: string, strategy: string): boolean {
    if (isUniqueMatch(doc, xpath, element)) {
      candidates.push({ xpath, strategy });
      return true;
    }
    return false;
  }

  // --- Strategy 1: Unique stable id ---
  const id = element.getAttribute('id');
  if (id && /^[a-zA-Z][\w-]*$/.test(id)) {
    try {
      const escaped = CSS.escape(id);
      const matches = doc.querySelectorAll(`#${escaped}`);
      if (matches.length === 1 && !isLikelyDynamicId(id)) {
        const xpath = `//*[@id=${escapeXPathAttr(id)}]`;
        if (xpathMatchesElement(doc, xpath, element)) {
          candidates.push({ xpath, strategy: 'id' });
        }
      }
      if (isLikelyDynamicId(id)) {
        const prefix = id.replace(/[-_\d]+$/, '').replace(/[-_\d]+$/, '') || id.slice(0, 4);
        if (prefix.length >= 2) {
          pushIfUnique(`//*[contains(@id, ${escapeXPathAttr(prefix)})]`, 'id-contains');
        }
      }
    } catch {
      /* ignore */
    }
  }

  // --- Strategy 2: Unique name (form elements) ---
  const name = element.getAttribute('name');
  if (name && /^(input|button|select|textarea|form)$/i.test(element.tagName)) {
    pushIfUnique(`//${tag}[@name=${escapeXPathAttr(name)}]`, 'name');
  }

  // --- Strategy 3: data-testid / data-qa / data-cy / data-test-id ---
  for (const attr of TEST_ID_ATTRS) {
    const val = element.getAttribute(attr);
    if (val) {
      pushIfUnique(`//*[@${attr}=${escapeXPathAttr(val)}]`, attr);
    }
  }

  // --- Strategy 4: role + aria-label (combined with `and`) ---
  const role = element.getAttribute('role') || (tag === 'button' ? 'button' : tag === 'a' ? 'link' : null);
  const ariaLabel = element.getAttribute('aria-label');
  if (role && ariaLabel) {
    pushIfUnique(
      `//*[@role=${escapeXPathAttr(role)} and @aria-label=${escapeXPathAttr(ariaLabel)}]`,
      'role+aria-label'
    );
  }

  // --- Strategy 5: aria-label alone ---
  if (ariaLabel) {
    pushIfUnique(`//${tag}[@aria-label=${escapeXPathAttr(ariaLabel)}]`, 'aria-label');
  }

  // --- Strategy 6: title attribute ---
  const title = element.getAttribute('title');
  if (title) {
    if (!pushIfUnique(`//${tag}[@title=${escapeXPathAttr(title)}]`, 'title')) {
      if (title.length > 30) {
        const prefix = title.slice(0, 30);
        pushIfUnique(`//${tag}[contains(@title, ${escapeXPathAttr(prefix)})]`, 'title-contains');
      }
    }
  }

  // --- Strategy 7: img @alt ---
  if (tag === 'img') {
    const alt = element.getAttribute('alt');
    if (alt && !alt.includes("'")) {
      if (!pushIfUnique(`//img[@alt=${escapeXPathAttr(alt)}]`, 'img-alt')) {
        const prefix = alt.slice(0, Math.min(alt.length, 30));
        pushIfUnique(`//img[contains(@alt, ${escapeXPathAttr(prefix)})]`, 'img-alt-contains');
      }
    }
  }

  // --- Strategy 8: Descendant img[@alt] ---
  const descendantAltXpath = tryDescendantImgAlt(doc, element, tag);
  if (descendantAltXpath) {
    candidates.push({ xpath: descendantAltXpath, strategy: 'descendant-img-alt' });
  }

  // --- Strategy 9: Stable text ---
  const text = element.textContent?.trim().replace(/\s+/g, ' ');
  if (text && text.length > 0 && !text.includes("'") && !text.includes('"')) {
    // 9a. Direct text() for short, direct text
    if (hasDirectTextOnly(element) && text.length <= DIRECT_TEXT_MAX_LENGTH) {
      pushIfUnique(`//${tag}[normalize-space(text())=${escapeXPathAttr(text)}]`, 'text-direct');
    }
    // 9b. contains(normalize-space(.), prefix) for nested or longer text
    let textContainsPushed = false;
    for (const len of TEXT_PREFIX_LENGTHS) {
      if (len > text.length) break;
      const prefix = text.slice(0, len);
      if (pushIfUnique(`//${tag}[contains(normalize-space(.), ${escapeXPathAttr(prefix)})]`, 'text-contains')) {
        textContainsPushed = true;
        break;
      }
    }
    if (!textContainsPushed) {
      pushIfUnique(`//${tag}[contains(normalize-space(.), ${escapeXPathAttr(text)})]`, 'text-contains');
    }
  }

  // --- Strategy 10: Multi-attribute combination with logical `and` ---
  const multiAttrXpath = tryMultiAttributeLocator(doc, element, tag);
  if (multiAttrXpath) {
    candidates.push({ xpath: multiAttrXpath, strategy: 'multi-attribute' });
  }

  // --- Strategy 10b: Text + stable class combination with logical `and` ---
  const textClassXpath = tryTextWithClassLocator(doc, element, tag);
  if (textClassXpath) {
    candidates.push({ xpath: textClassXpath, strategy: 'text+class' });
  }

  // --- Strategy 11: Class ---
  const cls = element.getAttribute('class');
  if (cls) {
    const stableClasses = getStableClasses(element);
    if (stableClasses.length > 0) {
      // 11a. contains(@class, ...) for each stable class
      let classPushed = false;
      for (const stableClass of stableClasses) {
        if (pushIfUnique(`//${tag}[contains(@class, ${escapeXPathAttr(stableClass)})]`, 'class-contains')) {
          classPushed = true;
          break;
        }
      }
      // 11b. Combining two stable classes with `and`
      if (!classPushed && stableClasses.length >= 2) {
        for (let i = 0; i < Math.min(stableClasses.length, 5) && !classPushed; i++) {
          for (let j = i + 1; j < Math.min(stableClasses.length, 5) && !classPushed; j++) {
            const xpath = `//${tag}[contains(@class, ${escapeXPathAttr(stableClasses[i])}) and contains(@class, ${escapeXPathAttr(stableClasses[j])})]`;
            if (pushIfUnique(xpath, 'class-two-and')) {
              classPushed = true;
            }
          }
        }
      }
      // 11c. Exact class match for short class strings only
      if (!classPushed && cls.trim().length <= 80) {
        pushIfUnique(`//${tag}[@class=${escapeXPathAttr(cls.trim())}]`, 'class-exact');
      }
    }
  }

  // --- Strategy 12: Path from closest stable ancestor ---
  const pathFromAnchor = buildPathFromStableAncestor(doc, element);
  if (pathFromAnchor && xpathMatchesElement(doc, pathFromAnchor, element)) {
    candidates.push({ xpath: pathFromAnchor, strategy: 'ancestor-path' });
  }

  // --- Strategy 13: Short relative path ---
  const relativePath = buildShortRelativePath(doc, element);
  if (relativePath && xpathMatchesElement(doc, relativePath, element)) {
    candidates.push({ xpath: relativePath, strategy: 'relative-path' });
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate all unique XPath candidates for an element, scored and sorted best-first.
 */
export function generateRankedXPaths(element: Element): ScoredXPath[] {
  const candidates = collectXPathCandidates(element);
  const scored = candidates.map((c) => scoreXPath(c.xpath, c.strategy));
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * Generate the single best XPath for an element (backward-compatible wrapper).
 */
export function generateXPath(element: Element): string {
  const ranked = generateRankedXPaths(element);
  return ranked[0]?.xpath ?? '//*';
}

// ---------------------------------------------------------------------------
// Fallback path builders (unchanged from previous implementation)
// ---------------------------------------------------------------------------

/** Find closest ancestor with unique stable attribute; build descendant path down to the target. */
function buildPathFromStableAncestor(doc: Document, element: Element): string | null {
  let anchor: Element | null = null;
  let anchorXpath: string | null = null;

  for (let el: Element | null = element.parentElement; el; el = el.parentElement) {
    const id = el.getAttribute('id');
    if (id && /^[a-zA-Z][\w-]*$/.test(id) && !isLikelyDynamicId(id)) {
      try {
        const matches = doc.querySelectorAll(`#${CSS.escape(id)}`);
        if (matches.length === 1) {
          anchor = el;
          anchorXpath = `//*[@id=${escapeXPathAttr(id)}]`;
          break;
        }
      } catch {
        /* skip */
      }
    }
    for (const attr of TEST_ID_ATTRS) {
      const val = el.getAttribute(attr);
      if (val) {
        const xpath = `//*[@${attr}=${escapeXPathAttr(val)}]`;
        if (countByXPath(doc, xpath) === 1) {
          anchor = el;
          anchorXpath = xpath;
          break;
        }
      }
    }
    if (anchor) break;
    const ancestorAriaLabel = el.getAttribute('aria-label');
    if (ancestorAriaLabel) {
      const aTag = getTagName(el);
      const xpath = `//${aTag}[@aria-label=${escapeXPathAttr(ancestorAriaLabel)}]`;
      if (countByXPath(doc, xpath) === 1) {
        anchor = el;
        anchorXpath = xpath;
        break;
      }
    }
    const ancestorTitle = el.getAttribute('title');
    if (ancestorTitle) {
      const aTag = getTagName(el);
      const xpath = `//${aTag}[@title=${escapeXPathAttr(ancestorTitle)}]`;
      if (countByXPath(doc, xpath) === 1) {
        anchor = el;
        anchorXpath = xpath;
        break;
      }
    }
  }

  if (!anchor || !anchorXpath) return null;

  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current !== anchor) {
    const seg = segmentToChild(current);
    if (!seg) return null;
    segments.unshift(seg);
    current = current.parentElement;
  }
  if (segments.length === 0) return anchorXpath;
  return `${anchorXpath}//${segments.join('//')}`;
}

/** Build one path segment for a child, without positional index. */
function segmentToChild(child: Element): string | null {
  const tag = getTagName(child);
  const parent = child.parentElement;
  if (!parent) return tag;

  const siblings = Array.from(parent.children).filter((n) => isElement(n) && getTagName(n) === tag);
  if (siblings.length <= 1) return tag;

  for (const attr of TEST_ID_ATTRS) {
    const val = child.getAttribute(attr);
    if (val) return `*[@${attr}=${escapeXPathAttr(val)}]`;
  }
  const childName = child.getAttribute('name');
  if (childName) return `${tag}[@name=${escapeXPathAttr(childName)}]`;
  const childAriaLabel = child.getAttribute('aria-label');
  if (childAriaLabel) return `${tag}[@aria-label=${escapeXPathAttr(childAriaLabel)}]`;
  const childTitle = child.getAttribute('title');
  if (childTitle) return `${tag}[@title=${escapeXPathAttr(childTitle)}]`;
  const text = child.textContent?.trim().replace(/\s+/g, ' ');
  if (text && !text.includes("'")) {
    const prefix = text.slice(0, TEXT_PREFIX_LENGTHS[0]);
    return `${tag}[contains(normalize-space(.), ${escapeXPathAttr(prefix)})]`;
  }
  const cls = child.getAttribute('class');
  if (cls) {
    const classes = cls.trim().split(/\s+/).filter(Boolean);
    const stableClasses = classes.filter((c) => !isLikelyDynamicClass(c));
    if (stableClasses.length > 0) {
      return `${tag}[contains(@class, ${escapeXPathAttr(stableClasses[0])})]`;
    }
  }
  return null;
}

/** Build a short relative path //tag1//tag2... using tag names and predicates (no positional index). */
function buildShortRelativePath(_doc: Document, element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current) {
    const tag = getTagName(current);
    const parent: Element | null = current.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }

    const sameTagSiblings = Array.from(parent.children).filter(
      (n) => isElement(n) && getTagName(n) === tag
    );

    let segment: string;
    if (sameTagSiblings.length === 1) {
      segment = tag;
    } else {
      const testId = current.getAttribute('data-testid') ?? current.getAttribute('data-qa');
      if (testId) {
        const attr = current.getAttribute('data-testid') ? 'data-testid' : 'data-qa';
        segment = `*[@${attr}=${escapeXPathAttr(testId)}]`;
      } else {
        const segAriaLabel = current.getAttribute('aria-label');
        if (segAriaLabel) {
          segment = `${tag}[@aria-label=${escapeXPathAttr(segAriaLabel)}]`;
        } else {
          const fullText = current.textContent?.trim().replace(/\s+/g, ' ');
          if (fullText && !fullText.includes("'")) {
            const prefix = fullText.slice(0, TEXT_PREFIX_LENGTHS[0]);
            segment = `${tag}[contains(normalize-space(.), ${escapeXPathAttr(prefix)})]`;
          } else {
            segment = tag;
          }
        }
      }
    }
    parts.unshift(segment);
    current = parent;
    if (current?.tagName?.toLowerCase() === 'html') break;
  }

  return '//' + parts.join('//');
}
