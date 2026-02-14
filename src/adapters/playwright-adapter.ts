/**
 * Playwright locator output: getByTestId, getByRole, getByText, or page.locator(...).
 */

import type { AttributeAnalysis } from '../core/attribute-analyzer';
import { escapeSingleQuoted, escapeBackticks } from '../utils/string-utils';

export interface LocatorContext {
  xpath: string;
  css: string;
  attrs: AttributeAnalysis;
}

export function getPlaywrightLocator(
  _element: Element,
  { xpath, css, attrs }: LocatorContext
): string {
  if (attrs.testId) {
    return `page.getByTestId('${escapeSingleQuoted(attrs.testId)}')`;
  }
  if (attrs.role && attrs.accessibleName) {
    const name = escapeSingleQuoted(attrs.accessibleName.trim());
    return `page.getByRole('${attrs.role}', { name: '${name}' })`;
  }
  if (attrs.role) {
    return `page.getByRole('${attrs.role}')`;
  }
  if (attrs.textContent && attrs.textContent.length < 100 && !attrs.textContent.includes('\n')) {
    return `page.getByText('${escapeSingleQuoted(attrs.textContent)}')`;
  }
  if (css && css.length < 200) {
    return `page.locator('${escapeSingleQuoted(css)}')`;
  }
  return `page.locator(\`xpath=${escapeBackticks(xpath)}\`)`;
}
