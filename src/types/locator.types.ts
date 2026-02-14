/**
 * Supported locator / framework output formats.
 */
export type LocatorFormat = 'xpath' | 'css' | 'playwright' | 'cypress' | 'selenium';

/**
 * Result for a single locator type.
 */
export interface LocatorResult {
  format: LocatorFormat;
  value: string;
  label: string;
}

/**
 * All locators for a given element.
 */
export interface ElementLocators {
  element: Element;
  xpath: string;
  css: string;
  playwright: string;
  cypress: string;
  selenium: string;
  other: Record<string, string>;
}
