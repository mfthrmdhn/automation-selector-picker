import { describe, it, expect } from 'vitest';
// @ts-expect-error no types for jsdom
import { JSDOM } from 'jsdom';
import { getLocatorsForElement } from '../src/core/selector-engine';

function doc(html: string): Document {
  return new JSDOM(html).window.document;
}

describe('selector-engine', () => {
  it('returns xpath, css, playwright for an element', () => {
    const d = doc('<button id="submit" data-testid="submit-btn">Submit</button>');
    const btn = d.querySelector('button')!;
    const locators = getLocatorsForElement(btn);
    expect(locators.xpath).toBeTruthy();
    expect(locators.css).toBeTruthy();
    expect(locators.playwright).toContain('getByTestId');
  });

  it('prefers getByRole when role and name exist', () => {
    const d = doc('<button aria-label="Close">×</button>');
    const btn = d.querySelector('button')!;
    const locators = getLocatorsForElement(btn);
    expect(locators.playwright).toMatch(/getByRole.*Close/);
  });
});
