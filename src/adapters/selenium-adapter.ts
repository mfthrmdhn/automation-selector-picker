/**
 * Selenium locator output: By.id, By.cssSelector, By.xpath, etc.
 */

import type { AttributeAnalysis } from '../core/attribute-analyzer';
import { escapeSingleQuoted } from '../utils/string-utils';

export interface LocatorContext {
  xpath: string;
  css: string;
  attrs: AttributeAnalysis;
}

export function getSeleniumLocator(
  element: Element,
  { xpath, css }: LocatorContext
): string {
  const id = element.getAttribute('id');
  if (id) {
    try {
      const escaped = CSS.escape(id);
      return `By.id("${escaped}")`;
    } catch {
      /* fall through */
    }
  }
  if (css && css.length < 200) {
    return `By.cssSelector("${escapeSingleQuoted(css).replace(/"/g, '\\"')}")`;
  }
  return `By.xpath("${xpath.replace(/"/g, '\\"')}")`;
}
