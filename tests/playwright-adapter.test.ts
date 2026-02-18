import { describe, it, expect } from 'vitest';
// @ts-expect-error no types for jsdom
import { JSDOM } from 'jsdom';
import { generateRankedPlaywright, getPlaywrightLocator } from '../src/adapters/playwright-adapter';
import { analyzeAttributes } from '../src/core/attribute-analyzer';
import { generateCSS } from '../src/core/css-generator';

function setup(html: string) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  return doc;
}

function contextFor(el: Element, testIdAttribute = 'data-testid') {
  const attrs = analyzeAttributes(el, testIdAttribute);
  const css = generateCSS(el);
  return { xpath: '//*', css, attrs, testIdAttribute };
}

describe('generateRankedPlaywright', () => {
  it('returns a non-empty array sorted by score descending', () => {
    const d = setup('<button data-testid="go">Go</button>');
    const btn = d.querySelector('button')!;
    const ranked = generateRankedPlaywright(btn, contextFor(btn));
    expect(ranked.length).toBeGreaterThan(0);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it('generates multiple candidates for rich elements', () => {
    const d = setup('<button data-testid="submit" title="Submit form">Submit</button>');
    const btn = d.querySelector('button')!;
    const ranked = generateRankedPlaywright(btn, contextFor(btn));
    expect(ranked.length).toBeGreaterThanOrEqual(3);
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).toContain('getByRole-name');
    expect(strategies).toContain('getByTestId');
  });

  it('getByRole-name scores higher than getByTestId', () => {
    const d = setup('<button data-testid="btn" aria-label="Save">Save</button>');
    const btn = d.querySelector('button')!;
    const ranked = generateRankedPlaywright(btn, contextFor(btn));
    const roleScore = ranked.find((r) => r.strategy === 'getByRole-name')?.score ?? 0;
    const testIdScore = ranked.find((r) => r.strategy === 'getByTestId')?.score ?? 0;
    expect(roleScore).toBeGreaterThan(testIdScore);
  });

  it('generates getByAltText for images', () => {
    const d = setup('<img alt="Company Logo" src="logo.png">');
    const img = d.querySelector('img')!;
    const ranked = generateRankedPlaywright(img, contextFor(img));
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).toContain('getByAltText');
    const altCandidate = ranked.find((r) => r.strategy === 'getByAltText');
    expect(altCandidate?.locator).toContain('Company Logo');
  });

  it('generates getByTitle for elements with title attribute', () => {
    const d = setup('<span title="Settings">Gear icon</span>');
    const span = d.querySelector('span')!;
    const ranked = generateRankedPlaywright(span, contextFor(span));
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).toContain('getByTitle');
    const titleCandidate = ranked.find((r) => r.strategy === 'getByTitle');
    expect(titleCandidate?.locator).toContain('Settings');
  });

  it('generates getByPlaceholder for inputs', () => {
    const d = setup('<input type="text" placeholder="Search...">');
    const input = d.querySelector('input')!;
    const ranked = generateRankedPlaywright(input, contextFor(input));
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).toContain('getByPlaceholder');
  });

  it('generates getByLabel for labeled form controls', () => {
    const d = setup('<label for="email">Email</label><input id="email" type="text">');
    const input = d.querySelector('input')!;
    const ranked = generateRankedPlaywright(input, contextFor(input));
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).toContain('getByLabel');
    const labelCandidate = ranked.find((r) => r.strategy === 'getByLabel');
    expect(labelCandidate?.locator).toContain('Email');
  });

  it('generates chained locator for elements inside semantic ancestors', () => {
    const d = setup('<form name="login"><button>Submit</button></form>');
    const btn = d.querySelector('button')!;
    const ranked = generateRankedPlaywright(btn, contextFor(btn));
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).toContain('chained');
    const chained = ranked.find((r) => r.strategy === 'chained');
    expect(chained?.locator).toContain('form');
  });

  it('generates filter locator when role + text available', () => {
    const d = setup('<button>Download Report</button>');
    const btn = d.querySelector('button')!;
    const ranked = generateRankedPlaywright(btn, contextFor(btn));
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).toContain('filter');
    const filter = ranked.find((r) => r.strategy === 'filter');
    expect(filter?.locator).toContain('.filter(');
    expect(filter?.locator).toContain('hasText');
  });

  it('generates getByText for elements with short text', () => {
    const d = setup('<span>Welcome back</span>');
    const span = d.querySelector('span')!;
    const ranked = generateRankedPlaywright(span, contextFor(span));
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).toContain('getByText');
  });

  it('generates css-locator and xpath-locator as fallbacks', () => {
    const d = setup('<div class="card"><span>Info</span></div>');
    const span = d.querySelector('span')!;
    const ranked = generateRankedPlaywright(span, contextFor(span));
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).toContain('css-locator');
    expect(strategies).toContain('xpath-locator');
  });

  it('css-locator scores lower than user-facing locators', () => {
    const d = setup('<button data-testid="save">Save</button>');
    const btn = d.querySelector('button')!;
    const ranked = generateRankedPlaywright(btn, contextFor(btn));
    const cssScore = ranked.find((r) => r.strategy === 'css-locator')?.score ?? 100;
    const roleScore = ranked.find((r) => r.strategy === 'getByRole-name')?.score ?? 0;
    expect(roleScore).toBeGreaterThan(cssScore);
  });

  it('all scores and breakdown values are between 0 and 100', () => {
    const d = setup('<button aria-label="Close" title="Close dialog">X</button>');
    const btn = d.querySelector('button')!;
    const ranked = generateRankedPlaywright(btn, contextFor(btn));
    for (const candidate of ranked) {
      expect(candidate.score).toBeGreaterThanOrEqual(0);
      expect(candidate.score).toBeLessThanOrEqual(100);
      for (const val of Object.values(candidate.breakdown)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe('positional locators (.first / .last / .nth)', () => {
  it('generates .first() when target is the first of multiple matches', () => {
    const d = setup('<div><button>OK</button><button>OK</button></div>');
    const btns = d.querySelectorAll('button');
    const ranked = generateRankedPlaywright(btns[0], contextFor(btns[0]));
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).toContain('first');
    const first = ranked.find((r) => r.strategy === 'first');
    expect(first?.locator).toContain('.first()');
  });

  it('generates .last() when target is the last of multiple matches', () => {
    const d = setup('<div><button>OK</button><button>OK</button></div>');
    const btns = d.querySelectorAll('button');
    const ranked = generateRankedPlaywright(btns[1], contextFor(btns[1]));
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).toContain('last');
    const last = ranked.find((r) => r.strategy === 'last');
    expect(last?.locator).toContain('.last()');
  });

  it('generates .nth(n) for non-unique locators', () => {
    const d = setup('<div><button>OK</button><button>OK</button><button>OK</button></div>');
    const btns = d.querySelectorAll('button');
    const ranked = generateRankedPlaywright(btns[1], contextFor(btns[1]));
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).toContain('nth');
    const nth = ranked.find((r) => r.strategy === 'nth');
    expect(nth?.locator).toContain('.nth(1)');
  });

  it('does not generate positional locators for unique elements', () => {
    const d = setup('<button data-testid="unique">Save</button>');
    const btn = d.querySelector('button')!;
    const ranked = generateRankedPlaywright(btn, contextFor(btn));
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).not.toContain('first');
    expect(strategies).not.toContain('last');
    expect(strategies).not.toContain('nth');
  });

  it('.nth() locators count as unique (matchCount = 1)', () => {
    const d = setup('<div><button>OK</button><button>OK</button></div>');
    const btns = d.querySelectorAll('button');
    const ranked = generateRankedPlaywright(btns[0], contextFor(btns[0]));
    const first = ranked.find((r) => r.strategy === 'first');
    const nth = ranked.find((r) => r.strategy === 'nth');
    if (first) expect(first.breakdown.uniqueness).toBe(100);
    if (nth) expect(nth.breakdown.uniqueness).toBe(100);
  });
});

describe('getPlaywrightLocator (backward compat)', () => {
  it('returns a string matching the best candidate', () => {
    const d = setup('<button>Click me</button>');
    const btn = d.querySelector('button')!;
    const ctx = contextFor(btn);
    const locator = getPlaywrightLocator(btn, ctx);
    const ranked = generateRankedPlaywright(btn, ctx);
    expect(locator).toBe(ranked[0].locator);
  });

  it('returns a valid locator string even for plain elements', () => {
    const d = setup('<div><span>Hello</span></div>');
    const span = d.querySelector('span')!;
    const locator = getPlaywrightLocator(span, contextFor(span));
    expect(locator).toBeTruthy();
    expect(locator).toContain('page.');
  });
});
