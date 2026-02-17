/**
 * Supported locator / framework output formats.
 */
export type LocatorFormat = 'xpath' | 'css' | 'playwright';

/**
 * Result for a single locator type.
 */
export interface LocatorResult {
  format: LocatorFormat;
  value: string;
  label: string;
}

/**
 * Breakdown of individual scoring factors for an XPath candidate (each 0-100).
 */
export interface XPathScoreBreakdown {
  /** How resilient the strategy is to DOM changes (id=100 ... relative-path=10). */
  stability: number;
  /** Shorter XPaths score higher. */
  brevity: number;
  /** Fewer axis steps (//) score higher. */
  depth: number;
  /** Fewer predicate brackets ([]) score higher. */
  predicates: number;
}

/**
 * A single XPath candidate with its weighted score and breakdown.
 */
export interface ScoredXPath {
  /** The XPath expression. */
  xpath: string;
  /** Human-readable strategy label, e.g. "id", "data-testid", "text+class". */
  strategy: string;
  /** Weighted total score (0-100). */
  score: number;
  /** Per-factor score breakdown. */
  breakdown: XPathScoreBreakdown;
}

/**
 * All locators for a given element.
 */
export interface ElementLocators {
  element: Element;
  /** Best-scored XPath (backward compatible). */
  xpath: string;
  /** All XPath candidates, sorted by score descending (best first). */
  xpathCandidates: ScoredXPath[];
  css: string;
  playwright: string;
  other: Record<string, string>;
}
