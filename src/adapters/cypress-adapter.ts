/**
 * Cypress locator output: cy.get(selector) with data-cy, or CSS/XPath.
 */

import type { AttributeAnalysis } from '../core/attribute-analyzer';
import { escapeSingleQuoted } from '../utils/string-utils';

export interface LocatorContext {
  xpath: string;
  css: string;
  attrs: AttributeAnalysis;
}

export function getCypressLocator(
  element: Element,
  { xpath, css, attrs }: LocatorContext
): string {
  const dataCy = element.getAttribute('data-cy');
  if (dataCy) {
    return `cy.get('${escapeSingleQuoted(dataCy)}')`;
  }
  if (attrs.testId) {
    return `cy.get('[data-testid="${escapeSingleQuoted(attrs.testId)}"]')`;
  }
  if (css && css.length < 200) {
    return `cy.get('${escapeSingleQuoted(css)}')`;
  }
  return `cy.xpath('${escapeSingleQuoted(xpath)}')`;
}
