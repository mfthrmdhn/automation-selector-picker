# Testing Patterns

**Analysis Date:** 2026-05-13

## Test Framework

**Runner:**
- Vitest 1.1.0
- Config: `vitest.config.ts`
- Environment: jsdom (browser-like DOM simulation)
- Globals enabled: `globals: true` (no need to import `describe`, `it`, `expect`)

**Assertion Library:**
- Vitest built-in expect (compatible with Jest)

**Run Commands:**
```bash
npm test              # Run all tests once
npm run test:watch   # Watch mode (re-run on changes)
npm run typecheck    # TypeScript type checking (not tests, but validation)
```

## Test File Organization

**Location:**
- Separate directory: `tests/` at project root
- Co-located with source in `src/` NOT used; all tests centralized

**Naming:**
- Pattern: `[module-name].test.ts`
- Examples:
  - `tests/css.test.ts` → tests `src/core/css-generator.ts`
  - `tests/xpath.test.ts` → tests `src/core/xpath-generator.ts`
  - `tests/selector-engine.test.ts` → tests `src/core/selector-engine.ts`
  - `tests/playwright-adapter.test.ts` → tests `src/adapters/playwright-adapter.ts`

**Structure:**
```
tests/
├── setup.ts                    # Global test setup (polyfills)
├── css.test.ts                 # CSS generator tests
├── xpath.test.ts               # XPath generator tests
├── selector-engine.test.ts     # Main orchestrator tests
├── locator-verifier.test.ts    # Verifier/validator tests
├── playwright-adapter.test.ts  # Playwright locator tests
├── playwright-scorer.test.ts   # Playwright scoring tests
└── xpath-scorer.test.ts        # XPath scoring tests
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';

// Test helper function
function doc(html: string): Document {
  return new JSDOM(html).window.document;
}

// Test suite (top-level group)
describe('module-name', () => {
  // Individual test
  it('does something specific', () => {
    const d = doc('<button id="test">Click</button>');
    const btn = d.querySelector('button')!;
    expect(btn).toBeTruthy();
  });
});

// Multiple suites in same file
describe('functionA', () => {
  it('case 1', () => {});
  it('case 2', () => {});
});

describe('functionB', () => {
  it('case 1', () => {});
});
```

**Patterns:**

1. **Setup:** Create test DOM with JSDOM helper
   ```typescript
   const d = doc('<div id="app"><button>Submit</button></div>');
   ```

2. **DOM Query:** Use standard `querySelector()` with non-null assertion
   ```typescript
   const btn = d.querySelector('button')!;
   ```

3. **Invocation:** Call function with test element
   ```typescript
   const css = generateCSS(btn);
   ```

4. **Assertion:** Use `expect()` chains
   ```typescript
   expect(css).toBeTruthy();
   expect(css).toMatch(/button|submit/);
   ```

## Mocking

**Framework:** None (JSDOM DOM is real, no mocks needed)

**Patterns:**
- Use JSDOM for full DOM simulation instead of mocking
- No dependencies on external services (pure functions)
- DOM helpers like `CSS.escape()` polyfilled in `tests/setup.ts`:
  ```typescript
  beforeAll(() => {
    if (typeof (globalThis as any).CSS === 'undefined') {
      (globalThis as any).CSS = {
        escape: (str: string) => str.replace(/([^\w-])/g, '\\$1'),
      };
    }
  });
  ```

**What to Mock:**
- Nothing; all code works with real JSDOM simulation
- Functions are pure: same input → same output

**What NOT to Mock:**
- DOM operations (use JSDOM instead)
- Selector evaluation (use JSDOM's `querySelector`, `querySelectorAll`, `evaluate`)

## Fixtures and Factories

**Test Data:**
- Inline HTML strings passed to `JSDOM()`
- No external fixture files
- Pattern: `function doc(html: string): Document { return new JSDOM(html).window.document }`

**Examples from tests:**

From `css.test.ts`:
```typescript
it('returns id selector when id is unique', () => {
  const d = doc('<div id="app"><button>Click</button></div>');
  const div = d.querySelector('#app')!;
  const css = generateCSS(div);
  expect(css === '#app' || css.includes('div')).toBe(true);
});
```

From `xpath.test.ts`:
```typescript
it('matches button by text content when text is nested in child divs', () => {
  const d = doc('<button><div><div>Submit</div></div></button>');
  const button = d.querySelector('button')!;
  const xpath = generateXPath(button);
  expect(xpath).toMatch(/button|Submit|normalize-space/);
  const result = d.evaluate(xpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  expect(result.singleNodeValue).toBe(button);
});
```

From `locator-verifier.test.ts`:
```typescript
it('detects XPath for // prefix', () => {
  expect(detectLocatorType('//div[@id="x"]')).toBe('xpath');
});
```

**Location:**
- All fixtures inline in test files
- No separate `fixtures/` or `mocks/` directories

## Coverage

**Requirements:** None enforced (no coverage thresholds in vitest.config.ts)

**Current Status:** 7 test files covering core modules:
- `css-generator.ts` → `css.test.ts` (3 tests)
- `xpath-generator.ts` → `xpath.test.ts` (14 tests for generation + 17 tests for ranking = 31 tests)
- `selector-engine.ts` → `selector-engine.test.ts` (2 tests)
- `locator-verifier.ts` → `locator-verifier.test.ts` (40+ tests)
- `playwright-adapter.ts` → `playwright-adapter.test.ts` (10+ tests)
- `playwright-scorer.ts` → `playwright-scorer.test.ts` (12 tests)
- `xpath-scorer.ts` → `xpath-scorer.test.ts` (16 tests)

**View Coverage:**
```bash
# No built-in coverage command in package.json
# Can add: npm install --save-dev @vitest/coverage-v8
# Then: npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- Scope: Individual functions in isolation (CSS generation, XPath generation, scoring)
- Approach: Direct function calls with JSDOM-created DOM elements
- Examples: `css.test.ts`, `xpath-scorer.test.ts`

**Integration Tests:**
- Scope: Multi-function workflows (selector-engine orchestrates CSS + XPath + Playwright)
- Approach: Call main orchestrator function, verify all locator types returned
- Examples: `selector-engine.test.ts`, `locator-verifier.test.ts` (verifier tests all format types)

**E2E Tests:**
- Status: Not used
- Rationale: Extension is content script; real E2E needs browser, Playwright, or Cypress (future work)

## Common Patterns

**DOM Evaluation (Verify XPath):**
```typescript
const xpath = generateXPath(element);
const result = d.evaluate(xpath, d, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
expect(result.singleNodeValue).toBe(element);
```

**CSS Matching:**
```typescript
const css = generateCSS(element);
const matches = d.querySelectorAll(css);
expect(matches.length).toBe(1);
expect(matches[0]).toBe(element);
```

**Playwright Locator Verification (Type Detection):**
```typescript
const locator = "page.getByRole('button', { name: 'Submit' })";
const type = detectLocatorType(locator);
expect(type).toBe('playwright');
```

**Ranked Output Validation:**
```typescript
const ranked = generateRankedXPaths(element);
expect(ranked.length).toBeGreaterThan(0);
// Verify sorted by score descending
for (let i = 1; i < ranked.length; i++) {
  expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
}
```

**Score Breakdown Validation:**
```typescript
const result = scoreXPath("//*[@id='x']", 'id');
expect(result.score).toBeGreaterThanOrEqual(0);
expect(result.score).toBeLessThanOrEqual(100);
expect(result.breakdown.stability).toBeGreaterThanOrEqual(0);
expect(result.breakdown.stability).toBeLessThanOrEqual(100);
```

**Error Handling:**
```typescript
// Invalid XPath
const result = verifyLocator('//[invalid', 'data-testid', d);
expect(result.type).toBe('xpath');
expect(result.matches).toHaveLength(0);
expect(result.error).toBeDefined();

// Empty/whitespace locator
const result = verifyLocator('', 'data-testid', d);
expect(result.matches).toHaveLength(0);
expect(result.error).toBeUndefined(); // No error for empty, just no matches
```

**TypeScript Type Safety:**
```typescript
// @ts-expect-error no types for jsdom
import { JSDOM } from 'jsdom';

// Proper type assertion where needed
const matches = d.querySelectorAll(selector) as Element[];
```

## Test Coverage Gaps

**Not Tested (Unit Level):**
- `dom-utils.ts`: DOM helper functions (used by generators but not directly tested)
- `string-utils.ts`: String escaping utilities (used by adapters but not directly tested)
- `uniqueness-checker.ts`: XPath uniqueness validation (called internally, not isolated test)
- `attribute-analyzer.ts`: Attribute analysis (used by main engine, not isolated test)
- `content/event-manager.ts`: Panel/overlay DOM management (requires browser/extension context)
- `content/highlighter.ts`: Visual highlighting logic (requires DOM and layout)
- `background/background.ts`: Extension background script (requires browser context)
- `popup/main.ts`: Popup UI logic (requires browser context)

**Risk Areas:**
- DOM utilities could regress if selectors behave differently in real browsers vs JSDOM
- String escaping could fail with unusual characters if not tested thoroughly
- Event handlers and UI logic are untested (extension-specific, hard to test)

**Recommendations:**
1. Add unit tests for `dom-utils.ts` and `string-utils.ts`
2. Mock or stub browser-only features (Chrome extension messaging)
3. Consider E2E tests for extension popup/content script integration if feasible

---

*Testing analysis: 2026-05-13*
