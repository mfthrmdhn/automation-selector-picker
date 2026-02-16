/**
 * Generates relative XPath expressions following best practices:
 * - Prefer // (relative), stable attributes (id, name, data-testid, etc.)
 * - Use contains()/starts-with() for dynamic attributes; text() when stable
 * - Use axes when needed; avoid positional indexing (e.g. [3])
 */

import { getDocument, getTagName, isElement } from '../utils/dom-utils';
import { xpathMatchesElement } from './uniqueness-checker';

const TEST_ID_ATTRS = ['data-testid', 'data-qa', 'data-cy', 'data-test-id'];
/** Max length of text used in contains(); we try shortest unique prefix from these lengths. */
const TEXT_PREFIX_LENGTHS = [20, 35, 50, 80];

/** Escape value for use inside an XPath quoted attribute (single or double quotes). */
function escapeXPathAttr(value: string): string {
  if (value.includes("'") && value.includes('"')) {
    return `concat('${value.replace(/'/g, "', \"'\", '")}')`;
  }
  if (value.includes("'")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `'${value}'`;
}

/** Heuristic: id looks auto-generated / dynamic (e.g. "btn-123", "item-abc-123"). */
function isLikelyDynamicId(id: string): boolean {
  if (!id || id.length > 50) return true;
  if (/[0-9a-f]{8,}/i.test(id)) return true;
  if (/\d{5,}/.test(id)) return true;
  const parts = id.split(/[-_]/);
  const last = parts[parts.length - 1];
  if (last && /^\d+$/.test(last) && parts.length > 1) return true;
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

/**
 * When the element (button, div, span, etc.) has no unique attributes but contains an img with unique alt,
 * return //tag[.//img[@alt='...']] – short and stable. Works for any container: button, div, span, a, etc.
 */
function tryDescendantImgAlt(doc: Document, element: Element, tag: string): string | null {
  const imgs = element.querySelectorAll('img[alt]');
  for (const img of imgs) {
    const alt = img.getAttribute('alt');
    if (!alt || alt.includes("'")) continue;
    const allImgsWithAlt = Array.from(doc.querySelectorAll('img')).filter((el) => el.getAttribute('alt') === alt);
    if (allImgsWithAlt.length !== 1) continue;
    const xpath = `//${tag}[.//img[@alt=${escapeXPathAttr(alt)}]]`;
    if (countByXPath(doc, xpath) === 1 && xpathMatchesElement(doc, xpath, element)) return xpath;
  }
  return null;
}

export function generateXPath(element: Element): string {
  const doc = getDocument(element);
  if (!doc || !isElement(element)) return '//*';

  const tag = getTagName(element);

  // 1. Unique id (prefer exact; use contains() if id looks dynamic)
  const id = element.getAttribute('id');
  if (id && /^[a-zA-Z][\w-]*$/.test(id)) {
    try {
      const escaped = CSS.escape(id);
      const matches = doc.querySelectorAll(`#${escaped}`);
      if (matches.length === 1) {
        const xpath = `//*[@id=${escapeXPathAttr(id)}]`;
        if (xpathMatchesElement(doc, xpath, element)) return xpath;
      }
      if (isLikelyDynamicId(id) && matches.length >= 1) {
        const prefix = id.replace(/[-_\d]+$/, '').replace(/[-_\d]+$/, '') || id.slice(0, 4);
        if (prefix.length >= 2) {
          const xpath = `//*[contains(@id, ${escapeXPathAttr(prefix)})]`;
          if (countByXPath(doc, xpath) === 1 && xpathMatchesElement(doc, xpath, element)) return xpath;
        }
      }
    } catch {
      /* ignore */
    }
  }

  // 2. Unique name (form elements)
  const name = element.getAttribute('name');
  if (name && /^(input|button|select|textarea|form)$/i.test(element.tagName)) {
    const xpath = `//${tag}[@name=${escapeXPathAttr(name)}]`;
    if (countByXPath(doc, xpath) === 1 && xpathMatchesElement(doc, xpath, element)) return xpath;
  }

  // 3. data-testid / data-qa / data-cy (unique)
  for (const attr of TEST_ID_ATTRS) {
    const val = element.getAttribute(attr);
    if (val) {
      const xpath = `//*[@${attr}=${escapeXPathAttr(val)}]`;
      if (countByXPath(doc, xpath) === 1 && xpathMatchesElement(doc, xpath, element)) return xpath;
    }
  }

  // 4. Descendant with unique stable attribute (e.g. img[@alt]) – very stable, short locator
  const descendantAltXpath = tryDescendantImgAlt(doc, element, tag);
  if (descendantAltXpath) return descendantAltXpath;

  // 5. Stable text – use contains(normalize-space(.), 'prefix') so locator stays short; nested content included
  const text = element.textContent?.trim().replace(/\s+/g, ' ');
  if (text && text.length > 0 && !text.includes("'") && !text.includes('"')) {
    for (const len of TEXT_PREFIX_LENGTHS) {
      if (len > text.length) break;
      const prefix = text.slice(0, len);
      const xpath = `//${tag}[contains(normalize-space(.), ${escapeXPathAttr(prefix)})]`;
      if (countByXPath(doc, xpath) === 1 && xpathMatchesElement(doc, xpath, element)) return xpath;
    }
    const fullXpath = `//${tag}[contains(normalize-space(.), ${escapeXPathAttr(text)})]`;
    if (countByXPath(doc, fullXpath) === 1 && xpathMatchesElement(doc, fullXpath, element)) return fullXpath;
  }

  // 6. Role + accessible name (e.g. button with aria-label)
  const role = element.getAttribute('role') || (tag === 'button' ? 'button' : tag === 'a' ? 'link' : null);
  const ariaLabel = element.getAttribute('aria-label');
  if (role && ariaLabel) {
    const xpath = `//*[@role=${escapeXPathAttr(role)} and @aria-label=${escapeXPathAttr(ariaLabel)}]`;
    if (countByXPath(doc, xpath) === 1 && xpathMatchesElement(doc, xpath, element)) return xpath;
  }

  // 7. Class: prefer starts-with() for dynamic classes, exact when unique
  const cls = element.getAttribute('class');
  if (cls) {
    const classes = cls.trim().split(/\s+/).filter(Boolean);
    const stableClasses = classes.filter((c) => !/^[a-z]+-[0-9a-f-]{6,}$/i.test(c) && c.length < 40);
    if (stableClasses.length > 0) {
      const firstStable = stableClasses[0];
      const exactXpath = `//${tag}[@class=${escapeXPathAttr(cls.trim())}]`;
      if (countByXPath(doc, exactXpath) === 1 && xpathMatchesElement(doc, exactXpath, element)) return exactXpath;
      const startsXpath = `//${tag}[starts-with(normalize-space(@class), ${escapeXPathAttr(firstStable)})]`;
      if (countByXPath(doc, startsXpath) === 1 && xpathMatchesElement(doc, startsXpath, element)) return startsXpath;
      const containsXpath = `//${tag}[contains(@class, ${escapeXPathAttr(firstStable)})]`;
      if (countByXPath(doc, containsXpath) === 1 && xpathMatchesElement(doc, containsXpath, element)) return containsXpath;
    }
  }

  // 8. Fallback: path from closest ancestor with unique id (or test id), then down using tag + attributes (no position)
  const pathFromAnchor = buildPathFromStableAncestor(doc, element);
  if (pathFromAnchor && xpathMatchesElement(doc, pathFromAnchor, element)) return pathFromAnchor;

  // 9. Short relative path using only tag names and predicates (no [n] position)
  const relativePath = buildShortRelativePath(doc, element);
  if (relativePath && xpathMatchesElement(doc, relativePath, element)) return relativePath;

  return relativePath || '//*';
}

/** Find closest ancestor with unique id or data-testid; build //anchor//tag[@attr]... down to el (no position index). */
function buildPathFromStableAncestor(doc: Document, element: Element): string | null {
  let anchor: Element | null = null;
  let anchorXpath: string | null = null;

  for (let el: Element | null = element.parentElement; el; el = el.parentElement) {
    const id = el.getAttribute('id');
    if (id && /^[a-zA-Z][\w-]*$/.test(id)) {
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

/** One segment from parent down to this child, without position index; uses contains(.) for text to keep short. */
function segmentToChild(child: Element): string | null {
  const tag = getTagName(child);
  const parent = child.parentElement;
  if (!parent) return tag;

  const siblings = Array.from(parent.children).filter((n) => isElement(n) && getTagName(n) === tag);
  if (siblings.length <= 1) return tag;

  const dataTestId = child.getAttribute('data-testid');
  const dataQa = child.getAttribute('data-qa');
  const dataCy = child.getAttribute('data-cy');
  const testIdVal = dataTestId ?? dataQa ?? dataCy;
  const testIdAttr = dataTestId ? 'data-testid' : dataQa ? 'data-qa' : 'data-cy';
  if (testIdVal) return `*[@${testIdAttr}=${escapeXPathAttr(testIdVal)}]`;
  const name = child.getAttribute('name');
  if (name) return `${tag}[@name=${escapeXPathAttr(name)}]`;
  const text = child.textContent?.trim().replace(/\s+/g, ' ');
  if (text && !text.includes("'")) {
    const prefix = text.slice(0, TEXT_PREFIX_LENGTHS[0]);
    return `${tag}[contains(normalize-space(.), ${escapeXPathAttr(prefix)})]`;
  }
  const cls = child.getAttribute('class');
  if (cls) {
    const first = cls.trim().split(/\s+/)[0];
    if (first) return `${tag}[contains(@class, ${escapeXPathAttr(first)})]`;
  }
  return null;
}

/** Build a short relative path //tag1//tag2... using tag names; use predicate only when needed to avoid ambiguity (no [n]). */
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
        const fullText = current.textContent?.trim().replace(/\s+/g, ' ');
        if (fullText && !fullText.includes("'")) {
          const prefix = fullText.slice(0, TEXT_PREFIX_LENGTHS[0]);
          segment = `${tag}[contains(normalize-space(.), ${escapeXPathAttr(prefix)})]`;
        } else {
          segment = tag;
        }
      }
    }
    parts.unshift(segment);
    current = parent;
    if (current?.tagName?.toLowerCase() === 'html') break;
  }

  return '//' + parts.join('//');
}
