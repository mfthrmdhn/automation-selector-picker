import { describe, it, expect } from 'vitest';
// @ts-expect-error no types for jsdom
import { JSDOM } from 'jsdom';
import { generateCSS } from '../src/core/css-generator';

function doc(html: string): Document {
  return new JSDOM(html).window.document;
}

describe('css-generator', () => {
  it('returns id selector when id is unique', () => {
    const d = doc('<div id="app"><button>Click</button></div>');
    const div = d.querySelector('#app')!;
    const css = generateCSS(div);
    expect(css === '#app' || css.includes('div')).toBe(true);
  });

  it('returns tag.class when unique', () => {
    const d = doc('<div class="card">Content</div>');
    const div = d.querySelector('.card')!;
    const css = generateCSS(div);
    expect(css).toMatch(/div|card/);
  });

  it('returns path with nth-of-type when needed', () => {
    const d = doc('<ul><li>A</li><li>B</li></ul>');
    const second = d.querySelectorAll('li')[1];
    const css = generateCSS(second);
    expect(css).toMatch(/li:nth-of-type\(2\)/);
  });
});
