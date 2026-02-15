/**
 * Analyzes element attributes for generating semantic locators (role, name, test id, etc.).
 */

export interface AttributeAnalysis {
  testId: string | null;
  customId: string | null;
  role: string | null;
  accessibleName: string | null;
  textContent: string | null;
  placeholder: string | null;
  alt: string | null;
  title: string | null;
}

/**
 * Infer ARIA role from tag name and type when no explicit role.
 */
function inferRole(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  if (tag === 'button') return 'button';
  if (tag === 'a') return 'link';
  if (tag === 'input') {
    const type = (el as HTMLInputElement).type?.toLowerCase() ?? 'text';
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    return 'textbox';
  }
  if (tag === 'textarea') return 'textbox';
  if (tag === 'select') return 'combobox';
  if (tag === 'img') return 'img';
  return null;
}

/**
 * Get a single-line, trimmed text content (first 80 chars) for locator names.
 */
function getShortText(el: Element): string | null {
  const text = el.textContent?.trim() ?? null;
  if (!text) return null;
  const single = text.replace(/\s+/g, ' ').slice(0, 80);
  return single || null;
}

/**
 * Analyze an element's attributes for selector generation.
 * @param testIdAttribute - Attribute name for test IDs (e.g. 'data-testid', 'data-qa'). Defaults to 'data-testid'.
 */
export function analyzeAttributes(
  element: Element,
  testIdAttribute: string = 'data-testid'
): AttributeAnalysis {
  return {
    testId: element.getAttribute(testIdAttribute),
    customId: null,
    role: element.getAttribute('role') || inferRole(element),
    accessibleName:
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      getShortText(element),
    textContent: getShortText(element),
    placeholder: element.getAttribute('placeholder'),
    alt: element.getAttribute('alt'),
    title: element.getAttribute('title'),
  };
}
