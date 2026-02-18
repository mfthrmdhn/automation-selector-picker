import { describe, it, expect } from 'vitest';
// @ts-expect-error no types for jsdom
import { JSDOM } from 'jsdom';
import {
  verifyLocator,
  detectLocatorType,
} from '../src/core/locator-verifier';

function doc(html: string): Document {
  const dom = new JSDOM(html);
  return dom.window.document;
}

// ---------------------------------------------------------------------------
// detectLocatorType
// ---------------------------------------------------------------------------
describe('detectLocatorType', () => {
  it('detects XPath for // prefix', () => {
    expect(detectLocatorType('//div[@id="x"]')).toBe('xpath');
  });

  it('detects XPath for / prefix', () => {
    expect(detectLocatorType('/html/body/div')).toBe('xpath');
  });

  it('detects Playwright for page. prefix', () => {
    expect(detectLocatorType("page.getByTestId('foo')")).toBe('playwright');
  });

  it('defaults to CSS for everything else', () => {
    expect(detectLocatorType('div.class > span')).toBe('css');
    expect(detectLocatorType('#my-id')).toBe('css');
    expect(detectLocatorType('[data-testid="x"]')).toBe('css');
  });

  it('handles leading whitespace', () => {
    expect(detectLocatorType('  //div')).toBe('xpath');
    expect(detectLocatorType('  page.locator("a")')).toBe('playwright');
    expect(detectLocatorType('  .cls')).toBe('css');
  });
});

// ---------------------------------------------------------------------------
// XPath verification
// ---------------------------------------------------------------------------
describe('verifyLocator – XPath', () => {
  it('matches elements by XPath', () => {
    const d = doc('<div><span id="a">Hello</span><span id="b">World</span></div>');
    const result = verifyLocator('//span', 'data-testid', d);
    expect(result.type).toBe('xpath');
    expect(result.matches).toHaveLength(2);
    expect(result.error).toBeUndefined();
  });

  it('matches a single element by XPath with predicate', () => {
    const d = doc('<div><span id="target">Hi</span><span id="other">Bye</span></div>');
    const result = verifyLocator('//span[@id="target"]', 'data-testid', d);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].id).toBe('target');
  });

  it('returns empty array for non-matching XPath', () => {
    const d = doc('<div><p>Text</p></div>');
    const result = verifyLocator('//span', 'data-testid', d);
    expect(result.matches).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('returns error for invalid XPath', () => {
    const d = doc('<div></div>');
    const result = verifyLocator('//[invalid', 'data-testid', d);
    expect(result.type).toBe('xpath');
    expect(result.matches).toHaveLength(0);
    expect(result.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// CSS verification
// ---------------------------------------------------------------------------
describe('verifyLocator – CSS', () => {
  it('matches elements by CSS selector', () => {
    const d = doc('<div class="box"><p>One</p><p>Two</p></div>');
    const result = verifyLocator('.box p', 'data-testid', d);
    expect(result.type).toBe('css');
    expect(result.matches).toHaveLength(2);
  });

  it('matches by id selector', () => {
    const d = doc('<div id="unique">Content</div>');
    const result = verifyLocator('#unique', 'data-testid', d);
    expect(result.matches).toHaveLength(1);
  });

  it('returns empty array for non-matching CSS', () => {
    const d = doc('<div><p>Text</p></div>');
    const result = verifyLocator('.nonexistent', 'data-testid', d);
    expect(result.matches).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('returns error for invalid CSS selector', () => {
    const d = doc('<div></div>');
    const result = verifyLocator('div[[[', 'data-testid', d);
    expect(result.type).toBe('css');
    expect(result.matches).toHaveLength(0);
    expect(result.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Playwright verification
// ---------------------------------------------------------------------------
describe('verifyLocator – Playwright', () => {
  it('page.getByTestId matches by data-testid', () => {
    const d = doc('<button data-testid="submit-btn">Go</button>');
    const result = verifyLocator("page.getByTestId('submit-btn')", 'data-testid', d);
    expect(result.type).toBe('playwright');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].tagName.toLowerCase()).toBe('button');
  });

  it('page.getByTestId uses custom testIdAttr', () => {
    const d = doc('<button data-qa="save">Save</button>');
    const result = verifyLocator("page.getByTestId('save')", 'data-qa', d);
    expect(result.matches).toHaveLength(1);
  });

  it('page.getByRole matches by explicit role', () => {
    const d = doc('<div role="button">Click</div><div role="link">Link</div>');
    const result = verifyLocator("page.getByRole('button')", 'data-testid', d);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].textContent).toBe('Click');
  });

  it('page.getByRole matches by implicit role (button element)', () => {
    const d = doc('<button>Submit</button><span>Text</span>');
    const result = verifyLocator("page.getByRole('button')", 'data-testid', d);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].tagName.toLowerCase()).toBe('button');
  });

  it('page.getByRole with name option filters by accessible name', () => {
    const d = doc('<button>Submit</button><button>Cancel</button>');
    const result = verifyLocator("page.getByRole('button', { name: 'Cancel' })", 'data-testid', d);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].textContent).toBe('Cancel');
  });

  it('page.getByRole with name matches aria-label', () => {
    const d = doc('<button aria-label="Close dialog">X</button><button>Other</button>');
    const result = verifyLocator("page.getByRole('button', { name: 'Close dialog' })", 'data-testid', d);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].textContent).toBe('X');
  });

  it('page.getByText matches elements with matching text', () => {
    const d = doc('<p>Hello World</p><p>Goodbye</p>');
    const result = verifyLocator("page.getByText('Hello')", 'data-testid', d);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].textContent).toContain('Hello');
  });

  it('page.getByLabel matches input by label for', () => {
    const d = doc('<label for="email">Email</label><input id="email" type="text">');
    const result = verifyLocator("page.getByLabel('Email')", 'data-testid', d);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].tagName.toLowerCase()).toBe('input');
  });

  it('page.getByLabel matches nested input', () => {
    const d = doc('<label>Username <input type="text"></label>');
    const result = verifyLocator("page.getByLabel('Username')", 'data-testid', d);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].tagName.toLowerCase()).toBe('input');
  });

  it('page.getByPlaceholder matches by placeholder', () => {
    const d = doc('<input placeholder="Search..."><input placeholder="Name">');
    const result = verifyLocator("page.getByPlaceholder('Search...')", 'data-testid', d);
    expect(result.matches).toHaveLength(1);
  });

  it('page.locator with CSS selector', () => {
    const d = doc('<div class="card"><span>Info</span></div>');
    const result = verifyLocator("page.locator('.card span')", 'data-testid', d);
    expect(result.type).toBe('playwright');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].tagName.toLowerCase()).toBe('span');
  });

  it('page.locator with xpath= prefix', () => {
    const d = doc('<div id="test"><p>Content</p></div>');
    const result = verifyLocator("page.locator('xpath=//div[@id=\"test\"]/p')", 'data-testid', d);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].tagName.toLowerCase()).toBe('p');
  });

  it('page.locator with backtick xpath', () => {
    const d = doc('<div id="x"><span>Text</span></div>');
    const result = verifyLocator('page.locator(`xpath=//div[@id="x"]/span`)', 'data-testid', d);
    expect(result.matches).toHaveLength(1);
  });

  it('returns error for unrecognized Playwright locator', () => {
    const d = doc('<div></div>');
    const result = verifyLocator('page.unknownMethod()', 'data-testid', d);
    expect(result.type).toBe('playwright');
    expect(result.matches).toHaveLength(0);
    expect(result.error).toContain('Unrecognized Playwright locator');
  });

  it('handles double-quoted string arguments', () => {
    const d = doc('<button data-testid="ok">OK</button>');
    const result = verifyLocator('page.getByTestId("ok")', 'data-testid', d);
    expect(result.matches).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('verifyLocator – edge cases', () => {
  it('returns empty result for empty input', () => {
    const d = doc('<div></div>');
    const result = verifyLocator('', 'data-testid', d);
    expect(result.matches).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('returns empty result for whitespace-only input', () => {
    const d = doc('<div></div>');
    const result = verifyLocator('   ', 'data-testid', d);
    expect(result.matches).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('defaults testIdAttr to data-testid when not provided', () => {
    const d = doc('<div data-testid="hello">Hi</div>');
    const result = verifyLocator("page.getByTestId('hello')", undefined, d);
    expect(result.matches).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Playwright .filter() chains
// ---------------------------------------------------------------------------
describe('verifyLocator – Playwright .filter()', () => {
  it('filters by hasText', () => {
    const d = doc('<ul><li>Apple</li><li>Banana</li><li>Apricot</li></ul>');
    const result = verifyLocator(
      "page.getByRole('listitem').filter({ hasText: 'Apple' })",
      'data-testid',
      d,
    );
    expect(result.type).toBe('playwright');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].textContent).toBe('Apple');
  });

  it('filters by hasNotText', () => {
    const d = doc('<ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>');
    const result = verifyLocator(
      "page.getByRole('listitem').filter({ hasNotText: 'Banana' })",
      'data-testid',
      d,
    );
    expect(result.matches).toHaveLength(2);
    const texts = result.matches.map((el) => el.textContent);
    expect(texts).toContain('Apple');
    expect(texts).toContain('Cherry');
  });

  it('filters by has (nested locator)', () => {
    const d = doc(`
      <div class="card"><img src="a.png"><span>Product A</span></div>
      <div class="card"><span>Product B</span></div>
      <div class="card"><img src="c.png"><span>Product C</span></div>
    `);
    const result = verifyLocator(
      "page.locator('.card').filter({ has: page.locator('img') })",
      'data-testid',
      d,
    );
    expect(result.matches).toHaveLength(2);
  });

  it('filters by hasNot (nested locator)', () => {
    const d = doc(`
      <div class="card"><img src="a.png"><span>A</span></div>
      <div class="card"><span>B</span></div>
    `);
    const result = verifyLocator(
      "page.locator('.card').filter({ hasNot: page.locator('img') })",
      'data-testid',
      d,
    );
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].textContent?.trim()).toBe('B');
  });

  it('supports multiple chained .filter() calls', () => {
    const d = doc(`
      <ul>
        <li><span class="name">Apple</span><span class="price">$1</span></li>
        <li><span class="name">Banana</span><span class="price">$2</span></li>
        <li><span class="name">Apricot</span><span class="price">$3</span></li>
      </ul>
    `);
    const result = verifyLocator(
      "page.getByRole('listitem').filter({ hasText: 'A' }).filter({ hasText: 'Apricot' })",
      'data-testid',
      d,
    );
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].textContent).toContain('Apricot');
  });

  it('hasText with double-quoted string', () => {
    const d = doc('<ul><li>One</li><li>Two</li></ul>');
    const result = verifyLocator(
      'page.getByRole(\'listitem\').filter({ hasText: "Two" })',
      'data-testid',
      d,
    );
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].textContent).toBe('Two');
  });

  it('returns empty when filter matches nothing', () => {
    const d = doc('<ul><li>Apple</li><li>Banana</li></ul>');
    const result = verifyLocator(
      "page.getByRole('listitem').filter({ hasText: 'Cherry' })",
      'data-testid',
      d,
    );
    expect(result.matches).toHaveLength(0);
    expect(result.error).toBeUndefined();
  });

  it('works with page.locator base + hasText filter', () => {
    const d = doc('<div class="row">Active</div><div class="row">Inactive</div>');
    const result = verifyLocator(
      "page.locator('.row').filter({ hasText: 'Active' })",
      'data-testid',
      d,
    );
    // Both contain "Active" as a substring
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
    expect(result.matches[0].textContent).toBe('Active');
  });

  it('has filter with getByTestId nested locator', () => {
    const d = doc(`
      <div class="item" data-testid="a"><span class="badge">New</span></div>
      <div class="item" data-testid="b"></div>
    `);
    const result = verifyLocator(
      "page.locator('.item').filter({ has: page.locator('.badge') })",
      'data-testid',
      d,
    );
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].getAttribute('data-testid')).toBe('a');
  });
});
