/**
 * Scores Playwright locator candidates using a weighted formula across four factors:
 *   stability (0.40) + readability (0.25) + brevity (0.20) + uniqueness (0.15)
 *
 * Each factor produces a 0-100 sub-score; the weighted total is also 0-100.
 */

import type { ScoredPlaywright, PlaywrightScoreBreakdown } from '../types/locator.types';

// ---------------------------------------------------------------------------
// Weight constants (must sum to 1.0)
// ---------------------------------------------------------------------------
export const WEIGHT_STABILITY = 0.40;
export const WEIGHT_READABILITY = 0.25;
export const WEIGHT_BREVITY = 0.20;
export const WEIGHT_UNIQUENESS = 0.15;

// ---------------------------------------------------------------------------
// Stability lookup – maps strategy labels to a 0-100 resilience score
// ---------------------------------------------------------------------------
const STABILITY_SCORES: Record<string, number> = {
  'getByRole': 100,
  'getByRole-name': 100,
  'getByRole-noname': 55,
  'getByLabel': 95,
  'getByPlaceholder': 90,
  'getByText': 85,
  'getByAltText': 80,
  'getByTitle': 75,
  'getByTestId': 100,
  'chained': 75,
  'filter': 75,
  'first': 45,
  'last': 45,
  'nth': 40,
  'css-locator': 10,
  'xpath-locator': 20,
};

const DEFAULT_STABILITY = 10;

// ---------------------------------------------------------------------------
// Readability lookup – user-facing built-ins score higher
// ---------------------------------------------------------------------------
const READABILITY_SCORES: Record<string, number> = {
  'getByRole': 100,
  'getByRole-name': 100,
  'getByRole-noname': 100,
  'getByLabel': 100,
  'getByPlaceholder': 100,
  'getByText': 100,
  'getByAltText': 100,
  'getByTitle': 100,
  'getByTestId': 100,
  'chained': 75,
  'filter': 75,
  'first': 70,
  'last': 70,
  'nth': 60,
  'css-locator': 10,
  'xpath-locator': 10,
};

const DEFAULT_READABILITY = 10;

// ---------------------------------------------------------------------------
// Sub-score calculators
// ---------------------------------------------------------------------------

/** Stability: lookup by strategy label. */
export function calcStability(strategy: string): number {
  return STABILITY_SCORES[strategy] ?? DEFAULT_STABILITY;
}

/** Readability: lookup by strategy label. */
export function calcReadability(strategy: string): number {
  return READABILITY_SCORES[strategy] ?? DEFAULT_READABILITY;
}

/**
 * Brevity: shorter locators score higher.
 * 15 chars → 100, 215+ chars → 0. Linear interpolation between.
 */
export function calcBrevity(locator: string): number {
  const len = locator.length;
  return Math.max(0, Math.min(100, 100 - (len - 15) * 0.5));
}

/**
 * Uniqueness: exactly 1 match = 100, 2 = 50, 3+ = 0.
 */
export function calcUniqueness(matchCount: number): number {
  if (matchCount === 1) return 100;
  if (matchCount === 2) return 50;
  return 0;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a Playwright locator candidate.
 * @param locator     The Playwright locator string.
 * @param strategy    Strategy label (e.g. "getByRole-name", "getByTestId").
 * @param matchCount  Number of elements matched in the document (1 = unique).
 */
export function scorePlaywright(
  locator: string,
  strategy: string,
  matchCount: number,
): ScoredPlaywright {
  const breakdown: PlaywrightScoreBreakdown = {
    stability: calcStability(strategy),
    readability: calcReadability(strategy),
    brevity: calcBrevity(locator),
    uniqueness: calcUniqueness(matchCount),
  };

  const score = round(
    breakdown.stability * WEIGHT_STABILITY +
    breakdown.readability * WEIGHT_READABILITY +
    breakdown.brevity * WEIGHT_BREVITY +
    breakdown.uniqueness * WEIGHT_UNIQUENESS,
  );

  return { locator, strategy, score, breakdown };
}

/** Round to 2 decimal places. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
