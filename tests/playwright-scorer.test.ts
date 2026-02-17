import { describe, it, expect } from 'vitest';
import {
  WEIGHT_STABILITY,
  WEIGHT_READABILITY,
  WEIGHT_BREVITY,
  WEIGHT_UNIQUENESS,
  calcStability,
  calcReadability,
  calcBrevity,
  calcUniqueness,
  scorePlaywright,
} from '../src/core/playwright-scorer';

describe('playwright-scorer', () => {
  // -----------------------------------------------------------------------
  // Weights
  // -----------------------------------------------------------------------
  it('weights sum to 1.0', () => {
    const sum = WEIGHT_STABILITY + WEIGHT_READABILITY + WEIGHT_BREVITY + WEIGHT_UNIQUENESS;
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
  });

  // -----------------------------------------------------------------------
  // Stability
  // -----------------------------------------------------------------------
  it('calcStability returns 100 for getByRole-name', () => {
    expect(calcStability('getByRole-name')).toBe(100);
  });

  it('calcStability returns 95 for getByLabel', () => {
    expect(calcStability('getByLabel')).toBe(95);
  });

  it('calcStability returns 80 for getByTestId', () => {
    expect(calcStability('getByTestId')).toBe(80);
  });

  it('calcStability returns 10 for css-locator', () => {
    expect(calcStability('css-locator')).toBe(10);
  });

  it('calcStability returns 20 for xpath-locator', () => {
    expect(calcStability('xpath-locator')).toBe(20);
  });

  it('calcStability returns 45 for first/last', () => {
    expect(calcStability('first')).toBe(45);
    expect(calcStability('last')).toBe(45);
  });

  it('calcStability returns 40 for nth', () => {
    expect(calcStability('nth')).toBe(40);
  });

  it('calcStability returns default for unknown strategy', () => {
    expect(calcStability('unknown-thing')).toBe(10);
  });

  // -----------------------------------------------------------------------
  // Readability
  // -----------------------------------------------------------------------
  it('calcReadability returns 100 for user-facing built-ins', () => {
    expect(calcReadability('getByRole-name')).toBe(100);
    expect(calcReadability('getByLabel')).toBe(100);
    expect(calcReadability('getByText')).toBe(100);
    expect(calcReadability('getByAltText')).toBe(100);
  });

  it('calcReadability returns 75 for chained/filter', () => {
    expect(calcReadability('chained')).toBe(75);
    expect(calcReadability('filter')).toBe(75);
  });

  it('calcReadability returns 70 for first/last', () => {
    expect(calcReadability('first')).toBe(70);
    expect(calcReadability('last')).toBe(70);
  });

  it('calcReadability returns 60 for nth', () => {
    expect(calcReadability('nth')).toBe(60);
  });

  it('calcReadability returns 10 for css-locator', () => {
    expect(calcReadability('css-locator')).toBe(10);
  });

  it('calcReadability returns 10 for xpath-locator', () => {
    expect(calcReadability('xpath-locator')).toBe(10);
  });

  // -----------------------------------------------------------------------
  // Brevity
  // -----------------------------------------------------------------------
  it('calcBrevity returns 100 for very short locators', () => {
    expect(calcBrevity("page.getByRole('button')")).toBeLessThanOrEqual(100);
    expect(calcBrevity("page.getByRole('button')")).toBeGreaterThan(80);
  });

  it('calcBrevity returns lower score for longer locators', () => {
    const short = calcBrevity("page.getByRole('button')");
    const long = calcBrevity("page.locator('div.container > form > button.submit-btn.primary')");
    expect(short).toBeGreaterThan(long);
  });

  it('calcBrevity returns 0 for very long locators', () => {
    const veryLong = 'a'.repeat(300);
    expect(calcBrevity(veryLong)).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Uniqueness
  // -----------------------------------------------------------------------
  it('calcUniqueness returns 100 for exactly 1 match', () => {
    expect(calcUniqueness(1)).toBe(100);
  });

  it('calcUniqueness returns 50 for 2 matches', () => {
    expect(calcUniqueness(2)).toBe(50);
  });

  it('calcUniqueness returns 0 for 3+ matches', () => {
    expect(calcUniqueness(3)).toBe(0);
    expect(calcUniqueness(10)).toBe(0);
  });

  // -----------------------------------------------------------------------
  // scorePlaywright
  // -----------------------------------------------------------------------
  it('returns correct structure', () => {
    const result = scorePlaywright("page.getByRole('button')", 'getByRole-noname', 1);
    expect(result).toHaveProperty('locator');
    expect(result).toHaveProperty('strategy');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('breakdown');
    expect(result.breakdown).toHaveProperty('stability');
    expect(result.breakdown).toHaveProperty('readability');
    expect(result.breakdown).toHaveProperty('brevity');
    expect(result.breakdown).toHaveProperty('uniqueness');
  });

  it('score is between 0 and 100', () => {
    const result = scorePlaywright("page.getByRole('button', { name: 'Submit' })", 'getByRole-name', 1);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('getByRole-name scores higher than css-locator', () => {
    const role = scorePlaywright("page.getByRole('button', { name: 'Go' })", 'getByRole-name', 1);
    const css = scorePlaywright("page.locator('button.go-btn')", 'css-locator', 1);
    expect(role.score).toBeGreaterThan(css.score);
  });

  it('getByRole-name scores higher than getByTestId', () => {
    const role = scorePlaywright("page.getByRole('button', { name: 'Submit' })", 'getByRole-name', 1);
    const testId = scorePlaywright("page.getByTestId('submit-btn')", 'getByTestId', 1);
    expect(role.score).toBeGreaterThan(testId.score);
  });

  it('unique locator scores higher than ambiguous one (same strategy)', () => {
    const unique = scorePlaywright("page.getByRole('button')", 'getByRole-noname', 1);
    const ambiguous = scorePlaywright("page.getByRole('button')", 'getByRole-noname', 5);
    expect(unique.score).toBeGreaterThan(ambiguous.score);
  });

  it('all breakdown values are between 0 and 100', () => {
    const result = scorePlaywright("page.locator('div > span.info')", 'css-locator', 2);
    for (const val of Object.values(result.breakdown)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(100);
    }
  });
});
