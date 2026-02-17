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
 * Breakdown of individual scoring factors for a Playwright candidate (each 0-100).
 */
export interface PlaywrightScoreBreakdown {
  /** How resilient the strategy is to DOM changes. */
  stability: number;
  /** Shorter locator strings score higher. */
  brevity: number;
  /** User-facing built-ins score higher than structural selectors. */
  readability: number;
  /** Matches exactly 1 element = 100; more matches = lower. */
  uniqueness: number;
}

/**
 * A single Playwright locator candidate with its weighted score and breakdown.
 */
export interface ScoredPlaywright {
  /** The Playwright locator expression. */
  locator: string;
  /** Human-readable strategy label, e.g. "getByRole", "getByTestId". */
  strategy: string;
  /** Weighted total score (0-100). */
  score: number;
  /** Per-factor score breakdown. */
  breakdown: PlaywrightScoreBreakdown;
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
  /** Best-scored Playwright locator (backward compatible). */
  playwright: string;
  /** All Playwright candidates, sorted by score descending (best first). */
  playwrightCandidates: ScoredPlaywright[];
  other: Record<string, string>;
}
