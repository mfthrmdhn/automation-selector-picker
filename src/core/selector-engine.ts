/**
 * Selector engine: coordinates XPath, CSS, and attribute analysis to produce
 * all locator formats for a given element.
 */

import type { ElementLocators } from '../types/locator.types';
import { generateRankedXPaths } from './xpath-generator';
import { generateCSS } from './css-generator';
import { analyzeAttributes } from './attribute-analyzer';
import { generateRankedPlaywright } from '../adapters/playwright-adapter';

export interface GetLocatorsOptions {
  /** Attribute name for test IDs (e.g. 'data-testid', 'data-qaid'). Defaults to 'data-testid'. */
  testIdAttribute?: string;
}

export function getLocatorsForElement(
  element: Element,
  options: GetLocatorsOptions = {}
): ElementLocators {
  const testIdAttribute = options.testIdAttribute ?? 'data-testid';
  const xpathCandidates = generateRankedXPaths(element);
  const xpath = xpathCandidates[0]?.xpath ?? '//*';
  const css = generateCSS(element);
  const attrs = analyzeAttributes(element, testIdAttribute);

  const other: Record<string, string> = {};
  if (attrs.testId) other[testIdAttribute] = attrs.testId;
  if (attrs.accessibleName && attrs.accessibleName !== attrs.textContent) {
    if (element.getAttribute('aria-label')) other['aria-label'] = attrs.accessibleName;
    if (element.getAttribute('title')) other['title'] = attrs.accessibleName;
  }

  const context = { xpath, css, attrs, testIdAttribute };
  const playwrightCandidates = generateRankedPlaywright(element, context);
  const playwright = playwrightCandidates[0]?.locator ?? `page.locator('${css}')`;

  return {
    element,
    xpath,
    xpathCandidates,
    css,
    playwright,
    playwrightCandidates,
    other,
  };
}
