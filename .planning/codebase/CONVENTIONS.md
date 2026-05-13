# Coding Conventions

**Analysis Date:** 2026-05-13

## Naming Patterns

**Files:**
- PascalCase for core modules: `XPathGenerator`, `CSSScorer`, `PlaywrightAdapter`
- Actual file names: kebab-case with descriptive suffixes (`css-generator.ts`, `xpath-scorer.ts`, `playwright-adapter.ts`)
- Test files: same module name with `.test.ts` suffix (`xpath.test.ts`, `css.test.ts`, `selector-engine.test.ts`)
- Utility modules grouped: `dom-utils.ts`, `string-utils.ts`

**Functions:**
- camelCase for all functions: `generateCSS()`, `scoreXPath()`, `analyzeAttributes()`
- Exported functions describe primary action: `generateRankedCSS()`, `getLocatorsForElement()`, `verifyLocator()`
- Private/internal helper functions use descriptive names: `isStableClass()`, `cssMatchesElement()`, `countCSS()`
- Boolean predicates use `is` prefix: `isElement()`, `isLikelyDynamicId()`, `isLikelyDynamicClass()`

**Variables:**
- camelCase for all variables and constants: `testIdAttribute`, `candidates`, `xpath`
- UPPER_SNAKE_CASE for immutable module-level constants: `TEST_ID_ATTRS`, `TEXT_PREFIX_LENGTHS`, `DIRECT_TEXT_MAX_LENGTH`, `WEIGHT_STABILITY`
- Loop variables stay descriptive: `element`, `className`, `siblings` (not `el`, `c`, `s`)

**Types and Interfaces:**
- PascalCase for all types: `ElementLocators`, `ScoredXPath`, `ScoredCSS`, `ScoredPlaywright`
- Descriptive interface names: `XPathCandidate`, `CSSCandidate`, `PlaywrightCandidate`, `LocatorContext`
- Type suffixes for clarity: `*Analysis`, `*Result`, `*Breakdown` (e.g., `AttributeAnalysis`, `XPathScoreBreakdown`)
- Import types explicitly: `import type { ElementLocators } from '../types/locator.types'`

## Code Style

**Formatting:**
- TypeScript strict mode enabled: `"strict": true` in `tsconfig.json`
- No unused locals or parameters: `"noUnusedLocals": true`, `"noUnusedParameters": true`
- Auto-formatting likely via Prettier defaults (no config found, suggesting standard settings)
- 2-space indentation (inferred from source files)

**Linting:**
- No ESLint config present; relies on TypeScript compiler strictness
- Type safety is the primary lint mechanism
- Imports use absolute paths with `@/` alias pointing to `src/`

## Import Organization

**Order:**
1. External packages (React, libraries): `import { describe, it, expect } from 'vitest'`
2. Internal type imports: `import type { ElementLocators } from '../types/locator.types'`
3. Internal functions/modules: `import { generateRankedXPaths } from './xpath-generator'`
4. Path alias imports: `import { queryOne } from '@/utils/dom-utils'`

**Path Aliases:**
- `@/*` → `src/*` (configured in `tsconfig.json` and `vite.config.ts`)
- Use `@/` prefix for cross-module imports to avoid relative paths
- Example: `import type { ScoredXPath } from '@/types/locator.types'`

**Pattern:**
- Destructure specific exports: `import { scoreCSS } from './css-scorer'`
- Use `import type {}` for type-only imports to aid tree-shaking
- Avoid wildcard imports; be explicit about dependencies

## Error Handling

**Patterns:**
- Try-catch wraps DOM queries and XPath evaluations (error-prone operations)
- Return null/empty array on error rather than throwing
  - Example: `try { return doc.querySelector(...) } catch { return null }`
  - Example: `try { return doc.querySelectorAll(...) } catch { return [] }`
- Silent failures for optional features (e.g., CSS.escape polyfill in `tests/setup.ts`)
- Validation before operations: `if (!maybeDoc || !isElement(element)) return []`

## Logging

**Framework:** console (no external logging library)

**Patterns:**
- No logging in production code (clean output for extension)
- Console available for debugging if needed, but not instrumented
- Tests use `expect()` assertions instead of console logs

## Comments

**When to Comment:**
- JSDoc/TSDoc blocks document module purpose and exported functions
- Inline comments explain strategy order and non-obvious logic
- Section markers with dashes separate algorithm stages: `// -----------`
- Comment blocks describe heuristics and edge cases before implementation

**JSDoc/TSDoc:**
Example from `src/core/css-generator.ts`:
```typescript
/**
 * Returns true if the selector matches exactly the given element (and only that element).
 */
function cssMatchesElement(doc: Document, selector: string, element: Element): boolean {
```

Example from `src/types/locator.types.ts`:
```typescript
/**
 * Breakdown of individual scoring factors for an XPath candidate (each 0-100).
 */
export interface XPathScoreBreakdown {
  /** How resilient the strategy is to DOM changes (id=100 ... relative-path=10). */
  stability: number;
```

Pattern: Document public APIs with purpose, parameters, and return value. Use single-line JSDoc for simple returns.

## Function Design

**Size:**
- Small, focused functions under 100 lines (typical: 30–80 lines)
- Complex algorithms (e.g., `xpath-generator.ts`) broken into helper stages: collect → score → sort
- Example: `generateRankedCSS()` delegates to `collectCSSCandidates()`, then `scoreCSS()`, then sort

**Parameters:**
- Options objects for optional parameters: `GetLocatorsOptions = {}` with defaults
- Avoid excessive positional params; group related options: `{ strategy: string, stability: number, ... }`
- Default values explicit: `testIdAttribute = 'data-testid'`

**Return Values:**
- Ranked arrays sorted descending by score: `ScoredXPath[]`, `ScoredCSS[]`, `ScoredPlaywright[]`
- Single best option extracted: `ScoredXPath[]` → `ranked[0]?.xpath ?? fallback`
- Null/undefined for missing values (not empty arrays for single-value returns)

## Module Design

**Exports:**
- Named exports for all public functions: `export function generateCSS() {}`
- Interfaces as named exports: `export interface ElementLocators {}`
- Types exported with `export type` keyword
- Barrel files not used; import directly from module source

**Organization:**
- Constants at module top: `const TEST_ID_ATTRS = [...]`, weight constants
- Helper functions after main logic
- Public API at end or clearly marked
- Clear comments separating sections (e.g., "Public API", "Scoring Helpers")

**Example structure from `css-generator.ts`:**
```typescript
// Module doc
// Constants
const TEST_ID_ATTRS = [...]
const UNSTABLE_CLASS_PATTERN = /^[a-z0-9_-]{8,}$/i

// Helpers
function isStableClass(className: string): boolean {}
function escapeAttrValue(value: string): string {}

// Main collector
function collectCSSCandidates(element: Element): CSSCandidate[] {}

// Public API
export function generateRankedCSS(element: Element): ScoredCSS[] {}
export function generateCSS(element: Element): string {}
```

## Special Patterns

**Scoring Framework:**
- All scorers implement same pattern: `calc*()` functions for factors, `score*()` for weighted total
- Weights as named constants that sum to 1.0 (verified in tests)
- Factor scores always 0–100 range
- Example from `xpath-scorer.ts`:
  ```typescript
  export const WEIGHT_STABILITY = 0.45;
  export const WEIGHT_DEPTH = 0.25;
  export const WEIGHT_PREDICATES = 0.20;
  export const WEIGHT_BREVITY = 0.10;
  ```

**Heuristics for Dynamic Detection:**
- `isLikelyDynamicId()`: detects UUIDs, hex patterns, numeric suffixes
- `isLikelyDynamicClass()`: detects CSS module hashes, emotion prefixes, styled-components
- Used to avoid unstable strategies that won't survive refactors

**Escaping:**
- CSS: `CSS.escape()` (native API, polyfilled in tests)
- XPath: custom `escapeXPathAttr()` with smart quote handling
- String utilities: `escapeSingleQuoted()`, `escapeBackticks()` for code generation

---

*Convention analysis: 2026-05-13*
