/**
 * Scores CSS selector candidates using a weighted formula across four factors:
 *   stability (0.45) + specificity (0.25) + depth (0.20) + brevity (0.10)
 *
 * Each factor produces a 0-100 sub-score; the weighted total is also 0-100.
 *
 * FACTOR DEFINITIONS:
 *  - stability:    How resilient the selector is to DOM refactors.
 *                  Semantic/test attributes score highest; structural paths score lowest.
 *  - specificity:  How many qualifying conditions the selector applies.
 *                  More conditions → more precise → harder to accidentally match the wrong element.
 *  - depth:        Fewer combinator levels (>, space, +, ~) means less structural coupling.
 *                  Weighted above brevity: a shorter but deeply nested selector is less reliable.
 *  - brevity:      Shorter selectors are easier to read and maintain (least important factor).
 */

import type { ScoredCSS, CSSScoreBreakdown } from '../types/locator.types';

// ---------------------------------------------------------------------------
// Weight constants (must sum to 1.0)
// ---------------------------------------------------------------------------
export const WEIGHT_STABILITY    = 0.45;
export const WEIGHT_SPECIFICITY  = 0.25;
export const WEIGHT_DEPTH        = 0.20;  // ↑ was 0.10 — shallower selectors are more reliable
export const WEIGHT_BREVITY      = 0.10;  // ↓ was 0.20 — length matters least

// ---------------------------------------------------------------------------
// Stability lookup — how likely the selector survives a DOM/style refactor
// ---------------------------------------------------------------------------
const STABILITY_SCORES: Record<string, number> = {
  // Explicit test hooks — developers control these and rarely remove them
  'id':            100,
  'data-testid':   100,
  'data-qa':       100,
  'data-cy':       100,
  'data-test-id':  100,
  'data-qaid':     100,
  // Semantic ARIA — tied to accessibility meaning, very stable
  'aria-label':    90,
  // Form identity attributes — stable for form automation
  'name':          85,
  // Descriptive attributes — stable but can be edited by copy changes
  'placeholder':   80,
  'alt':           80,
  'title':         75,
  // ARIA role — stable but coarser than aria-label
  'role':          70,
  // Class-based — can change with visual redesigns
  'tag-class':     60,
  'multi-class':   55,
  'class':         50,
  // Input type + name combo — moderately stable
  'type-name':     50,
  // Type alone — very common, rarely unique on its own
  'tag-type':      45,
  // Positional/structural path — breaks on any DOM restructure
  'structural':    10,
};

// ---------------------------------------------------------------------------
// Specificity lookup — how many qualifying conditions the selector uses
// ---------------------------------------------------------------------------
const SPECIFICITY_SCORES: Record<string, number> = {
  'id':           100,   // ID is intrinsically unique
  'data-testid':   95,   // attribute + specific value
  'data-qa':       95,
  'data-cy':       95,
  'data-test-id':  95,
  'data-qaid':     95,
  'aria-label':    85,   // attribute + semantic value
  'name':          80,   // attribute + value
  'placeholder':   75,
  'alt':           75,
  'title':         70,
  'role':          65,
  'multi-class':   65,   // tag + 2+ class conditions
  'type-name':     60,   // 2 attribute conditions
  'tag-class':     55,   // tag + 1 class
  'class':         45,   // 1 class condition only
  'tag-type':      40,   // tag + type
  'structural':    20,   // structural path with :nth-of-type
};

const DEFAULT_STABILITY    = 10;
const DEFAULT_SPECIFICITY  = 10;

// ---------------------------------------------------------------------------
// Sub-score calculators
// ---------------------------------------------------------------------------

/** Stability: lookup by strategy label. */
export function calcStability(strategy: string): number {
  return STABILITY_SCORES[strategy] ?? DEFAULT_STABILITY;
}

/** Specificity: lookup by strategy label. */
export function calcSpecificity(strategy: string): number {
  return SPECIFICITY_SCORES[strategy] ?? DEFAULT_SPECIFICITY;
}

/**
 * Brevity: shorter selectors score higher.
 * 10 chars → 100, 210+ chars → 0. Linear interpolation between.
 */
export function calcBrevity(selector: string): number {
  const len = selector.length;
  return Math.max(0, Math.min(100, 100 - (len - 10) * 0.5));
}

/**
 * Depth: count top-level combinator steps outside of attribute brackets.
 * Each `>`, `+`, `~`, or space-between-tokens adds one level.
 *   0 levels → 100,  1 → 70,  2 → 40,  3+ → 10
 */
export function calcDepth(selector: string): number {
  let combinators = 0;
  let bracketDepth = 0;
  let prevNonSpace = '';

  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (ch === '[') { bracketDepth++; continue; }
    if (ch === ']') { bracketDepth--; continue; }
    if (bracketDepth > 0) continue;

    if (ch === '>' || ch === '+' || ch === '~') {
      combinators++;
      prevNonSpace = ch;
    } else if (ch === ' ') {
      // Descendant combinator — only count a real space gap (not just padding around >+~)
      if (prevNonSpace !== '' && prevNonSpace !== '>' && prevNonSpace !== '+' && prevNonSpace !== '~' && prevNonSpace !== ' ') {
        combinators++;
      }
      prevNonSpace = ' ';
    } else {
      prevNonSpace = ch;
    }
  }

  if (combinators === 0) return 100;
  if (combinators === 1) return 70;
  if (combinators === 2) return 40;
  return 10;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score a CSS selector candidate produced by a given strategy.
 * Returns the full ScoredCSS including breakdown and weighted total.
 */
export function scoreCSS(selector: string, strategy: string): ScoredCSS {
  const breakdown: CSSScoreBreakdown = {
    stability:   calcStability(strategy),
    specificity: calcSpecificity(strategy),
    brevity:     calcBrevity(selector),
    depth:       calcDepth(selector),
  };

  const score = round(
    breakdown.stability   * WEIGHT_STABILITY   +
    breakdown.specificity * WEIGHT_SPECIFICITY +
    breakdown.depth       * WEIGHT_DEPTH       +
    breakdown.brevity     * WEIGHT_BREVITY,
  );

  return { selector, strategy, score, breakdown };
}

/** Round to 2 decimal places. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}
