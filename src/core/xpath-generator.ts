/**
 * Generates XPath expressions for a given DOM element.
 */

import { isElement, getDocument, getTagName, getSameTagSiblings } from '../utils/dom-utils';
import { xpathMatchesElement } from './uniqueness-checker';

export function generateXPath(element: Element): string {
  const doc = getDocument(element);
  if (!doc) return '';

  function getPath(el: Element): string[] {
    if (!isElement(el)) return [];
    const tag = getTagName(el);
    const id = el.getAttribute('id');
    if (id) {
      try {
        const escaped = CSS.escape(id);
        const matches = doc!.querySelectorAll(`#${escaped}`);
        if (matches.length === 1) return [`id("${id}")`];
      } catch {
        /* ignore */
      }
    }
    const parent = el.parentElement;
    if (!parent) return [tag];
    const siblings = getSameTagSiblings(el);
    const index = siblings.indexOf(el) + 1;
    const segment = siblings.length === 1 ? tag : `${tag}[${index}]`;
    return getPath(parent).concat(segment);
  }

  const path = getPath(element);
  const xpath = '//' + path.join('/');
  if (xpathMatchesElement(doc, xpath, element)) return xpath;
  return xpath;
}
