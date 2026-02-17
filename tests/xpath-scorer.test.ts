import { describe, it, expect } from 'vitest';
import {
  scoreXPath,
  calcStability,
  calcBrevity,
  calcDepth,
  calcPredicates,
  WEIGHT_STABILITY,
  WEIGHT_BREVITY,
  WEIGHT_DEPTH,
  WEIGHT_PREDICATES,
} from '../src/core/xpath-scorer';

describe('xpath-scorer', () => {
  describe('weights', () => {
    it('weights sum to 1.0', () => {
      expect(WEIGHT_STABILITY + WEIGHT_BREVITY + WEIGHT_DEPTH + WEIGHT_PREDICATES).toBeCloseTo(1.0);
    });
  });

  describe('calcStability', () => {
    it('returns 100 for id strategy', () => {
      expect(calcStability('id')).toBe(100);
    });

    it('returns 90 for data-testid strategy', () => {
      expect(calcStability('data-testid')).toBe(90);
    });

    it('returns 60 for text-direct strategy', () => {
      expect(calcStability('text-direct')).toBe(60);
    });

    it('returns 35 for class-contains strategy', () => {
      expect(calcStability('class-contains')).toBe(35);
    });

    it('returns 10 for relative-path strategy', () => {
      expect(calcStability('relative-path')).toBe(10);
    });

    it('returns default 10 for unknown strategy', () => {
      expect(calcStability('unknown-strategy')).toBe(10);
    });
  });

  describe('calcBrevity', () => {
    it('returns 100 for a 10-char xpath', () => {
      expect(calcBrevity('//*[@id=x]')).toBe(100);
    });

    it('returns 75 for a 60-char xpath', () => {
      const xpath = 'x'.repeat(60);
      expect(calcBrevity(xpath)).toBe(75);
    });

    it('returns 0 for a 210+ char xpath', () => {
      const xpath = 'x'.repeat(250);
      expect(calcBrevity(xpath)).toBe(0);
    });

    it('never goes below 0', () => {
      const xpath = 'x'.repeat(500);
      expect(calcBrevity(xpath)).toBe(0);
    });
  });

  describe('calcDepth', () => {
    it('returns 100 for single // step', () => {
      expect(calcDepth("//*[@id='foo']")).toBe(100);
    });

    it('returns 70 for two // steps', () => {
      expect(calcDepth("//*[@id='main']//button")).toBe(70);
    });

    it('returns 40 for three // steps', () => {
      expect(calcDepth("//*[@id='main']//div//button")).toBe(40);
    });

    it('returns 10 for four or more // steps', () => {
      expect(calcDepth("//*[@id='a']//div//span//button")).toBe(10);
    });
  });

  describe('calcPredicates', () => {
    it('returns 100 for 0 predicates', () => {
      expect(calcPredicates('//button')).toBe(100);
    });

    it('returns 100 for 1 predicate', () => {
      expect(calcPredicates("//*[@id='foo']")).toBe(100);
    });

    it('returns 75 for 2 predicates', () => {
      expect(calcPredicates("//button[@type='submit'][@name='go']")).toBe(75);
    });

    it('returns 50 for 3 predicates', () => {
      expect(calcPredicates("//div[@a='1'][@b='2'][@c='3']")).toBe(50);
    });

    it('returns 25 for 4+ predicates', () => {
      expect(calcPredicates("//div[@a='1'][@b='2'][@c='3'][@d='4']")).toBe(25);
    });
  });

  describe('scoreXPath', () => {
    it('returns a ScoredXPath with all fields', () => {
      const result = scoreXPath("//*[@id='submit']", 'id');
      expect(result.xpath).toBe("//*[@id='submit']");
      expect(result.strategy).toBe('id');
      expect(result.breakdown.stability).toBe(100);
      expect(result.breakdown.brevity).toBeGreaterThan(0);
      expect(result.breakdown.depth).toBe(100);
      expect(result.breakdown.predicates).toBe(100);
      expect(result.score).toBeGreaterThan(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('scores id strategy higher than class-contains', () => {
      const idResult = scoreXPath("//*[@id='submit']", 'id');
      const classResult = scoreXPath("//button[contains(@class, 'btn')]", 'class-contains');
      expect(idResult.score).toBeGreaterThan(classResult.score);
    });

    it('scores shorter xpaths higher when strategy is the same', () => {
      const short = scoreXPath("//button[normalize-space(text())='OK']", 'text-direct');
      const long = scoreXPath(
        "//button[contains(normalize-space(.), 'Some very long button text that keeps going')]",
        'text-contains'
      );
      // stability favors short (text-direct=60 vs text-contains=55), brevity also favors short
      expect(short.score).toBeGreaterThan(long.score);
    });

    it('weighted total matches manual calculation', () => {
      const result = scoreXPath("//*[@id='x']", 'id');
      const expected =
        result.breakdown.stability * WEIGHT_STABILITY +
        result.breakdown.brevity * WEIGHT_BREVITY +
        result.breakdown.depth * WEIGHT_DEPTH +
        result.breakdown.predicates * WEIGHT_PREDICATES;
      expect(result.score).toBeCloseTo(expected, 1);
    });

    it('all breakdown values are in 0-100 range', () => {
      const candidates = [
        scoreXPath("//*[@id='a']", 'id'),
        scoreXPath('//html//body//div//span//button', 'relative-path'),
        scoreXPath('x'.repeat(300), 'class-exact'),
      ];
      for (const c of candidates) {
        expect(c.breakdown.stability).toBeGreaterThanOrEqual(0);
        expect(c.breakdown.stability).toBeLessThanOrEqual(100);
        expect(c.breakdown.brevity).toBeGreaterThanOrEqual(0);
        expect(c.breakdown.brevity).toBeLessThanOrEqual(100);
        expect(c.breakdown.depth).toBeGreaterThanOrEqual(0);
        expect(c.breakdown.depth).toBeLessThanOrEqual(100);
        expect(c.breakdown.predicates).toBeGreaterThanOrEqual(0);
        expect(c.breakdown.predicates).toBeLessThanOrEqual(100);
      }
    });
  });
});
