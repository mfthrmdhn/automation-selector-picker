/**
 * Generates CSS selectors for a given DOM element.
 */

import { isElement, getDocument, getTagName, getSameTagSiblings } from '../utils/dom-utils';
import { isUniqueCSS } from './uniqueness-checker';

/** Heuristic: avoid long random-looking class names (e.g. CSS modules). */
const UNSTABLE_CLASS_PATTERN = /^[a-z0-9_-]{8,}$/i;
const MAX_CLASS_LENGTH = 20;

function isStableClass(className: string): boolean {
  return className.length < MAX_CLASS_LENGTH && !UNSTABLE_CLASS_PATTERN.test(className);
}

export function generateCSS(element: Element): string {
  const doc = getDocument(element);
  if (!doc) return '';

  const id = element.getAttribute('id');
  if (id) {
    try {
      const escaped = CSS.escape(id);
      const selector = `#${escaped}`;
      if (isUniqueCSS(doc, selector)) return selector;
    } catch {
      /* ignore */
    }
  }

  const tag = getTagName(element);
  const classAttr = element.getAttribute('class');
  if (classAttr) {
    const classList = classAttr.trim().split(/\s+/).filter(Boolean);
    const stableClasses = classList.filter(isStableClass);
    if (stableClasses.length > 0) {
      const selector = tag + '.' + stableClasses.map((c) => CSS.escape(c)).join('.');
      try {
        if (isUniqueCSS(doc, selector)) return selector;
      } catch {
        /* ignore */
      }
    }
  }

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
        /* ignore */
      }
    }
    const siblings = el.parentElement
      ? getSameTagSiblings(el)
      : [];
    const idx = siblings.indexOf(el) + 1;
    path.unshift(siblings.length === 1 ? t : `${t}:nth-of-type(${idx})`);
    el = el.parentElement;
  }
  const selector = path.join(' > ');
  try {
    if (isUniqueCSS(doc, selector)) return selector;
  } catch {
    /* ignore */
  }
  return selector;
}
