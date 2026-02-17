import { describe, it, expect } from 'vitest';
// // @ts-expect-error no types for jsdom
import { JSDOM } from 'jsdom';
import { generateXPath, generateRankedXPaths } from '../src/core/xpath-generator';

function doc(html: string): { document: Document } {
  const dom = new JSDOM(html);
  return { document: dom.window.document };
}

describe('xpath-generator', () => {
  it('generates path to element (id or structural)', () => {
    const { document: d } = doc('<div id="main"><span>Hi</span></div>');
    const span = d.querySelector('span')!;
    const xpath = generateXPath(span);
    expect(xpath).toMatch(/\/span/);
    expect(xpath.startsWith('//')).toBe(true);
  });

  it('prefers relative XPath with stable id when element has unique id', () => {
    const { document: d } = doc('<div id="unique-id"><p>Text</p></div>');
    const div = d.querySelector('#unique-id')!;
    const xpath = generateXPath(div);
    expect(xpath).toMatch(/^\/\//);
    expect(xpath).toMatch(/unique-id/);
    expect(xpath).not.toMatch(/^\/html/);
  });

  it('uses text() or stable attributes instead of positional index for same-tag siblings', () => {
    const { document: d } = doc('<ul><li>1</li><li>2</li><li>3</li></ul>');
    const second = d.querySelectorAll('li')[1];
    const xpath = generateXPath(second);
    expect(xpath).toMatch(/^\/\//);
    expect(xpath).toMatch(/li/);
    expect(xpath).not.toMatch(/\[\d+\]/);
  });

  it('matches button by text content when text is nested in child divs (normalize-space(.) not text())', () => {
    const { document: d } = doc('<button><div><div>Submit</div></div></button>');
    const button = d.querySelector('button')!;
    const xpath = generateXPath(button);
    expect(xpath).toMatch(/^\/\//);
    expect(xpath).toMatch(/button/);
    expect(xpath).toMatch(/Submit|normalize-space|contains/);
    const result = d.evaluate(xpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    expect(result.singleNodeValue).toBe(button);
  });

  it('prefers descendant img[@alt] when button has no id/testid but contains img with unique alt', () => {
    const { document: d } = doc(`
      <div>
        <button class="flex items-center gap-3">
          <img alt="C2C" width="48" height="48" />
          <div><h2>Personal Account</h2><p>Transfer money to an individual</p></div>
        </button>
        <button class="flex items-center gap-3"><img alt="Biz" width="48" /><div><h2>Business</h2></div></button>
      </div>
    `);
    const firstButton = d.querySelectorAll('button')[0];
    const xpath = generateXPath(firstButton);
    expect(xpath).toMatch(/^\/\//);
    expect(xpath).toMatch(/button/);
    expect(xpath).toMatch(/\.\/\/img/);
    expect(xpath).toMatch(/C2C/);
    const result = d.evaluate(xpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    expect(result.singleNodeValue).toBe(firstButton);
  });

  it('uses descendant img[@alt] for span/div containers too (not only button)', () => {
    const { document: d } = doc(`
      <body>
        <span class="card"><img alt="IconA" /><span>Label A</span></span>
        <div class="card"><img alt="IconB" /><span>Label B</span></div>
      </body>
    `);
    const spanCard = d.querySelector('span.card')!;
    const divCard = d.querySelector('div.card')!;
    const spanXpath = generateXPath(spanCard);
    const divXpath = generateXPath(divCard);
    expect(spanXpath).toMatch(/^\/\//);
    expect(spanXpath).toMatch(/span/);
    expect(spanXpath).toMatch(/\.\/\/img/);
    expect(spanXpath).toMatch(/IconA/);
    expect(divXpath).toMatch(/div/);
    expect(divXpath).toMatch(/IconB/);
    expect(d.evaluate(spanXpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue).toBe(spanCard);
    expect(d.evaluate(divXpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue).toBe(divCard);
  });

  it('does not use dynamic id for exact match, prefers contains() with stable prefix', () => {
    const { document: d } = doc('<div id="item-12345"><span>Content</span></div>');
    const div = d.querySelector('#item-12345')!;
    const xpath = generateXPath(div);
    expect(xpath).toMatch(/^\/\//);
    expect(xpath).not.toMatch(/@id='item-12345'/);
    expect(xpath).toMatch(/contains.*@id.*item/);
    const result = d.evaluate(xpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    expect(result.singleNodeValue).toBe(div);
  });

  it('prefers title when element has unique title attribute', () => {
    const { document: d } = doc('<div><span title="Help tooltip">?</span><span>Other</span></div>');
    const span = d.querySelector('span[title]')!;
    const xpath = generateXPath(span);
    expect(xpath).toMatch(/^\/\//);
    expect(xpath).toMatch(/@title/);
    expect(xpath).toMatch(/Help tooltip/);
    const result = d.evaluate(xpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    expect(result.singleNodeValue).toBe(span);
  });

  it('uses aria-label alone when unique and role is not present', () => {
    const { document: d } = doc('<div><span aria-label="Close dialog">X</span><span>Other</span></div>');
    const span = d.querySelector('span[aria-label]')!;
    const xpath = generateXPath(span);
    expect(xpath).toMatch(/^\/\//);
    expect(xpath).toMatch(/@aria-label/);
    expect(xpath).toMatch(/Close dialog/);
    const result = d.evaluate(xpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    expect(result.singleNodeValue).toBe(span);
  });

  it('combines attributes with logical and when single attributes are not unique', () => {
    const { document: d } = doc(`
      <div>
        <input type="text" placeholder="Search" />
        <input type="text" placeholder="Filter" />
        <input type="password" placeholder="Search" />
      </div>
    `);
    const firstInput = d.querySelector('input[type="text"][placeholder="Search"]')!;
    const xpath = generateXPath(firstInput);
    expect(xpath).toMatch(/^\/\//);
    expect(xpath).toMatch(/and/);
    const result = d.evaluate(xpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    expect(result.singleNodeValue).toBe(firstInput);
  });

  it('uses normalize-space(text()) for short direct text without nested elements', () => {
    const { document: d } = doc('<div><span>Hello</span><span>World</span></div>');
    const span = d.querySelector('span')!;
    const xpath = generateXPath(span);
    expect(xpath).toMatch(/^\/\//);
    expect(xpath).toMatch(/text\(\)/);
    expect(xpath).toMatch(/Hello/);
    const result = d.evaluate(xpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    expect(result.singleNodeValue).toBe(span);
  });

  it('uses text+class with and instead of exact class dump for Tailwind-heavy buttons', () => {
    const { document: d } = doc(`
      <div>
        <button class="h-12 items-center gap-2 bg-primary shadow flex w-full justify-center rounded-full px-4 py-3 text-white">
          <svg></svg>Transfer Sekarang
        </button>
        <button class="h-12 items-center gap-2 bg-secondary shadow flex w-full justify-center rounded-full px-4 py-3 text-white">
          <svg></svg>Transfer Nanti
        </button>
      </div>
    `);
    const btn = d.querySelectorAll('button')[0];
    const xpath = generateXPath(btn);
    expect(xpath).toMatch(/^\/\//);
    // Should NOT produce a full @class='...' dump
    expect(xpath).not.toMatch(/@class='/);
    // Should use text or text+class combination
    expect(xpath).toMatch(/Transfer Sekarang|bg-primary/);
    const result = d.evaluate(xpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    expect(result.singleNodeValue).toBe(btn);
  });

  it('prefers contains(@class) with single stable class over exact class dump', () => {
    const { document: d } = doc(`
      <div>
        <button class="btn-primary px-4 py-2 rounded">Submit</button>
        <a class="link-primary px-4 py-2 rounded">Cancel</a>
      </div>
    `);
    const btn = d.querySelector('button')!;
    const xpath = generateXPath(btn);
    expect(xpath).toMatch(/^\/\//);
    // Text "Submit" should be used directly since it's unique and short
    expect(xpath).toMatch(/Submit/);
    const result = d.evaluate(xpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    expect(result.singleNodeValue).toBe(btn);
  });
});

describe('generateRankedXPaths', () => {
  it('returns an array sorted by score descending', () => {
    const { document: d } = doc('<button id="submit" data-testid="submit-btn" aria-label="Submit form">Submit</button>');
    const btn = d.querySelector('button')!;
    const ranked = generateRankedXPaths(btn);
    expect(ranked.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it('returns multiple candidates for elements with several unique attributes', () => {
    const { document: d } = doc('<button id="go" data-testid="go-btn" aria-label="Go" title="Go now">Go</button>');
    const btn = d.querySelector('button')!;
    const ranked = generateRankedXPaths(btn);
    // Should have at least: id, data-testid, role+aria-label, aria-label, title, text
    expect(ranked.length).toBeGreaterThanOrEqual(5);
    const strategies = ranked.map((r) => r.strategy);
    expect(strategies).toContain('id');
    expect(strategies).toContain('data-testid');
  });

  it('all scores and breakdown values are in 0-100 range', () => {
    const { document: d } = doc('<input type="text" name="email" placeholder="Enter email" data-testid="email-input" />');
    const input = d.querySelector('input')!;
    const ranked = generateRankedXPaths(input);
    for (const r of ranked) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.breakdown.stability).toBeGreaterThanOrEqual(0);
      expect(r.breakdown.stability).toBeLessThanOrEqual(100);
      expect(r.breakdown.brevity).toBeGreaterThanOrEqual(0);
      expect(r.breakdown.brevity).toBeLessThanOrEqual(100);
      expect(r.breakdown.depth).toBeGreaterThanOrEqual(0);
      expect(r.breakdown.depth).toBeLessThanOrEqual(100);
      expect(r.breakdown.predicates).toBeGreaterThanOrEqual(0);
      expect(r.breakdown.predicates).toBeLessThanOrEqual(100);
    }
  });

  it('best candidate matches what generateXPath returns', () => {
    const { document: d } = doc('<button id="save" data-testid="save-btn">Save</button>');
    const btn = d.querySelector('button')!;
    const ranked = generateRankedXPaths(btn);
    const best = generateXPath(btn);
    expect(ranked[0].xpath).toBe(best);
  });

  it('includes strategy labels for each candidate', () => {
    const { document: d } = doc('<span title="Info">Details</span>');
    const span = d.querySelector('span')!;
    const ranked = generateRankedXPaths(span);
    for (const r of ranked) {
      expect(r.strategy).toBeTruthy();
      expect(typeof r.strategy).toBe('string');
    }
  });

  it('returns at least one candidate even for plain elements', () => {
    const { document: d } = doc('<div><p>Hello world</p></div>');
    const p = d.querySelector('p')!;
    const ranked = generateRankedXPaths(p);
    expect(ranked.length).toBeGreaterThanOrEqual(1);
    const result = d.evaluate(ranked[0].xpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    expect(result.singleNodeValue).toBe(p);
  });

  it('id strategy scores higher than class strategy for the same element', () => {
    const { document: d } = doc('<button id="action" class="btn-primary">Click</button>');
    const btn = d.querySelector('button')!;
    const ranked = generateRankedXPaths(btn);
    const idCandidate = ranked.find((r) => r.strategy === 'id');
    const classCandidate = ranked.find((r) => r.strategy === 'class-contains');
    if (idCandidate && classCandidate) {
      expect(idCandidate.score).toBeGreaterThan(classCandidate.score);
    }
  });
});
