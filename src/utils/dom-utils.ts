/**
 * DOM helpers used by the selector engine and content script.
 */

/**
 * Check if a node is an element node.
 */
export function isElement(node: Node | null): node is Element {
  return node != null && node.nodeType === Node.ELEMENT_NODE;
}

/**
 * Get the document owner of an element (or null).
 */
export function getDocument(el: Element | null): Document | null {
  return el?.ownerDocument ?? null;
}

/**
 * Get the first element from a CSS selector in the given root (or document).
 */
export function queryOne(root: Document | Element, selector: string): Element | null {
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

/**
 * Get all elements matching a CSS selector.
 */
export function queryAll(root: Document | Element, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

/**
 * Evaluate an XPath and return the first matching node.
 */
export function evaluateXPath(
  doc: Document,
  xpath: string
): Element | null {
  try {
    const result = doc.evaluate(
      xpath,
      doc,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    const node = result.singleNodeValue;
    return isElement(node) ? node : null;
  } catch {
    return null;
  }
}

/**
 * Get the tag name of an element in lower case.
 */
export function getTagName(el: Element): string {
  return el.tagName.toLowerCase();
}

/**
 * Get direct siblings of the same tag name.
 */
export function getSameTagSiblings(el: Element): Element[] {
  const parent = el.parentElement;
  if (!parent) return [];
  return Array.from(parent.children).filter(
    (c) => isElement(c) && c.tagName === el.tagName
  );
}

/**
 * 1-based index of element among same-tag siblings.
 */
export function getSameTagIndex(el: Element): number {
  const siblings = getSameTagSiblings(el);
  const idx = siblings.indexOf(el);
  return idx >= 0 ? idx + 1 : 1;
}
