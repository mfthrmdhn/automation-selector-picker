import { describe, it, expect } from 'vitest';
// // @ts-expect-error no types for jsdom
import { JSDOM } from 'jsdom';
import { generateXPath } from '../src/core/xpath-generator';

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
});
