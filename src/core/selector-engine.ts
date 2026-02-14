/**
 * Selector engine: coordinates XPath, CSS, and attribute analysis to produce
 * all locator formats for a given element.
 */

import type { ElementLocators } from '../types/locator.types';
import { generateXPath } from './xpath-generator';
import { generateCSS } from './css-generator';
import { analyzeAttributes } from './attribute-analyzer';
import { getPlaywrightLocator } from '../adapters/playwright-adapter';
import { getCypressLocator } from '../adapters/cypress-adapter';
import { getSeleniumLocator } from '../adapters/selenium-adapter';

export function getLocatorsForElement(element: Element): ElementLocators {
  const xpath = generateXPath(element);
  const css = generateCSS(element);
  const attrs = analyzeAttributes(element);

  const other: Record<string, string> = {};
  if (attrs.testId) other['data-testid'] = attrs.testId;
  if (attrs.accessibleName && attrs.accessibleName !== attrs.textContent) {
    if (element.getAttribute('aria-label')) other['aria-label'] = attrs.accessibleName;
    if (element.getAttribute('title')) other['title'] = attrs.accessibleName;
  }

  return {
    element,
    xpath,
    css,
    playwright: getPlaywrightLocator(element, { xpath, css, attrs }),
    cypress: getCypressLocator(element, { xpath, css, attrs }),
    selenium: getSeleniumLocator(element, { xpath, css, attrs }),
    other,
  };
}
