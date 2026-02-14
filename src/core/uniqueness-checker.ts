/**
 * Checks whether a CSS selector or XPath matches exactly one element in the document.
 */

import { isElement } from '../utils/dom-utils';

export function isUniqueCSS(doc: Document, selector: string): boolean {
  try {
    const list = doc.querySelectorAll(selector);
    return list.length === 1;
  } catch {
    return false;
  }
}

export function isUniqueXPath(doc: Document, xpath: string): boolean {
  try {
    const result = doc.evaluate(
      xpath,
      doc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    const node = result.singleNodeValue;
    return node != null && isElement(node);
  } catch {
    return false;
  }
}

/**
 * Verifies that the given XPath resolves to exactly the given element.
 */
export function xpathMatchesElement(doc: Document, xpath: string, element: Element): boolean {
  try {
    const result = doc.evaluate(
      xpath,
      doc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue === element;
  } catch {
    return false;
  }
}
