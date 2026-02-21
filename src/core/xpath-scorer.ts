/**
 * Scores XPath candidates using a weighted formula across four factors:
 *   stability (0.45) + depth (0.25) + predicates (0.20) + brevity (0.10)
 *
 * Each factor produces a 0-100 sub-score; the weighted total is also 0-100.
 *
 * Depth and predicates are weighted above brevity: a shorter XPath that
 * is structurally deep or overloaded with conditions is less reliable than
 * a longer but shallow, simple expression.
 */

import type { ScoredXPath, XPathScoreBreakdown } from '../types/locator.types';

// ---------------------------------------------------------------------------
// Weight constants (must sum to 1.0)
// ---------------------------------------------------------------------------
export const WEIGHT_STABILITY   = 0.45;
export const WEIGHT_DEPTH       = 0.25;  // ↑ was 0.15 — shallower XPaths are more reliable
export const WEIGHT_PREDICATES  = 0.20;  // ↑ was 0.15 — fewer brackets = simpler, more stable
export const WEIGHT_BREVITY     = 0.10;  // ↓ was 0.25 — length matters least

// ---------------------------------------------------------------------------
// Stability lookup – maps strategy labels to a 0-100 resilience score
// ---------------------------------------------------------------------------
const STABILITY_SCORES: Record<string, number> = {
  id: 100,
  'id-contains': 95,
  name: 95,
  'data-testid': 90,
  'data-qa': 90,
  'data-cy': 90,
  'data-test-id': 90,
  'data-qaid': 90,
  'role+aria-label': 85,
  'aria-label': 80,
  title: 75,
  'title-contains': 70,
  'img-alt': 70,
  'img-alt-contains': 65,
  'descendant-img-alt': 65,
  'text-direct': 60,
  'text-contains': 55,
  'multi-attribute': 50,
  'text+class': 45,
  'class-contains': 35,
  'class-two-and': 30,
  'class-exact': 25,
  'ancestor-path': 20,
  'relative-path': 10,
};

const DEFAULT_STABILITY = 10;

// ---------------------------------------------------------------------------
// Sub-score calculators
// ---------------------------------------------------------------------------

/** Stability: lookup by strategy label. */
export function calcStability(strategy: string): number {
  return STABILITY_SCORES[strategy] ?? DEFAULT_STABILITY;
}

/**
 * Brevity: shorter XPaths score higher.
 * 10 chars → 100, 210+ chars → 0. Linear interpolation between.
 */
export function calcBrevity(xpath: string): number {
  const len = xpath.length;
  return Math.max(0, Math.min(100, 100 - (len - 10) * 0.5));
}

/**
 * Depth: count top-level `//` axis steps (ignoring `//` inside predicates like `[.//img]`).
 * 1 step → 100, 2 → 70, 3 → 40, 4+ → 10.
 */
export function calcDepth(xpath: string): number {
  let bracketDepth = 0;
  let steps = 0;
  for (let i = 0; i < xpath.length - 1; i++) {
    if (xpath[i] === '[') bracketDepth++;
    else if (xpath[i] === ']') bracketDepth--;
    else if (bracketDepth === 0 && xpath[i] === '/' && xpath[i + 1] === '/') {
      steps++;
      i++;
    }
  }
  if (steps <= 1) return 100;
  if (steps === 2) return 70;
  if (steps === 3) return 40;
  return 10;
}

/**
 * Predicates: count top-level `[` brackets (ignoring nested brackets like `[@alt]` inside `[.//img[@alt]]`).
 * 0 → 100, 1 → 100, 2 → 75, 3 → 50, 4+ → 25.
 */
export function calcPredicates(xpath: string): number {
  let depth = 0;
  let count = 0;
  for (let i = 0; i < xpath.length; i++) {
    if (xpath[i] === '[') {
      if (depth === 0) count++;
      depth++;
    } else if (xpath[i] === ']') {
      depth--;
    }
  }
  if (count <= 1) return 100;
  if (count === 2) return 75;
  if (count === 3) return 50;
  return 25;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score an XPath candidate produced by a given strategy.
 * Returns the full ScoredXPath including breakdown and weighted total.
 */
export function scoreXPath(xpath: string, strategy: string): ScoredXPath {
  const breakdown: XPathScoreBreakdown = {
    stability: calcStability(strategy),
    brevity: calcBrevity(xpath),
    depth: calcDepth(xpath),
    predicates: calcPredicates(xpath),
  };

  const score = round(
    breakdown.stability  * WEIGHT_STABILITY  +
    breakdown.depth      * WEIGHT_DEPTH      +
    breakdown.predicates * WEIGHT_PREDICATES +
    breakdown.brevity    * WEIGHT_BREVITY
  );

  return { xpath, strategy, score, breakdown };
}

/** Round to 2 decimal places. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
