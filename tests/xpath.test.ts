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
    expect(xpath).toMatch(/Submit/);
    expect(xpath).toMatch(/normalize-space/);
    const result = d.evaluate(xpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    expect(result.singleNodeValue).toBe(button);
  });
});
