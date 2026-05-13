<!-- refreshed: 2026-05-13 -->
# Architecture

**Analysis Date:** 2026-05-13

## System Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome Extension (Browser UI)                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Popup (Extension Menu)      │  Content Script (DOM Picker) │  │
│  │  `src/popup/main.ts`         │  `src/content/index.ts`      │  │
│  │  - Settings UI               │  - Overlay & Picker Mode     │  │
│  │  - Test ID Attribute Config  │  - Mouse Event Handling      │  │
│  │  - "Open Picker Now" button  │  - Panel Visibility          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              Content Script Event Manager (DOM Bridge)           │
│                    `src/content/event-manager.ts`                │
│  - Overlay/highlight DOM creation and updates                   │
│  - Mouse tracking (highlight element under cursor)              │
│  - Click handling (capture clicked element)                      │
│  - Panel content rendering                                      │
│  - Locator verification interactive engine                      │
└────────────────┬────────────────────────────────┬────────────────┘
                 │                                │
                 ▼                                ▼
        ┌──────────────────────┐      ┌──────────────────────┐
        │  Highlighter Module  │      │  Selector Engine     │
        │`src/content/       │      │ `src/core/selector- │
        │  highlighter.ts`     │      │  engine.ts`          │
        │                      │      │                      │
        │ - Visual styling     │      │ - Orchestrates       │
        │ - DOM positioning    │      │   candidate gen      │
        │ - Box outline render │      │ - Aggregates results │
        │ - Verify highlights  │      │ - Coordinates scoring│
        └──────────────────────┘      └──────────┬───────────┘
                                                 │
                    ┌────────────────────────────┼────────────────────────────┐
                    ▼                            ▼                            ▼
        ┌─────────────────────┐      ┌─────────────────────┐     ┌──────────────────────┐
        │  XPath Generator    │      │   CSS Generator     │     │ Playwright Adapter   │
        │ `src/core/xpath-    │      │ `src/core/css-      │     │ `src/adapters/       │
        │  generator.ts`      │      │  generator.ts`      │     │  playwright-adapter` │
        │                     │      │                     │     │                      │
        │ • 13 strategies     │      │ • 15 strategies     │     │ • 12 locator formats │
        │   (id → path)       │      │   (id → structural) │     │   (role → css/xpath) │
        │ • Uniqueness check  │      │ • Stability filter  │     │ • Chaining logic     │
        │ • Dynamic id detect │      │ • Class pattern     │     │ • Filter() support   │
        │                     │      │   avoidance         │     │                      │
        └──────┬──────────────┘      └──────┬──────────────┘     └────────┬─────────────┘
               │                            │                            │
               ▼                            ▼                            ▼
        ┌─────────────────────┐      ┌─────────────────────┐     ┌──────────────────────┐
        │  XPath Scorer       │      │   CSS Scorer        │     │ Playwright Scorer    │
        │ `src/core/xpath-    │      │ `src/core/css-      │     │ `src/core/          │
        │  scorer.ts`         │      │  scorer.ts`         │     │  playwright-scorer`  │
        │                     │      │                     │     │                      │
        │ Weights (0-100):    │      │ Weights (0-100):    │     │ Weights (0-100):     │
        │ • stability: 0.45   │      │ • stability: 0.45   │     │ • stability: 0.35    │
        │ • depth: 0.25       │      │ • specificity: 0.25 │     │ • brevity: 0.30      │
        │ • predicates: 0.20  │      │ • depth: 0.20       │     │ • readability: 0.20  │
        │ • brevity: 0.10     │      │ • brevity: 0.10     │     │ • uniqueness: 0.15   │
        └──────────┬──────────┘      └──────────┬──────────┘     └────────┬─────────────┘
                   │                            │                        │
                   └────────────────┬───────────┴────────────────┬───────┘
                                    │                            │
                                    ▼                            ▼
                        ┌─────────────────────────┐   ┌──────────────────────────┐
                        │ Utility & Verification  │   │  Attribute Analyzer      │
                        │ `src/core/locator-      │   │ `src/core/attribute-     │
                        │  verifier.ts`           │   │  analyzer.ts`            │
                        │ `src/core/uniqueness-   │   │                          │
                        │  checker.ts`            │   │ - Test ID extraction     │
                        │ `src/utils/`            │   │ - ARIA role inference    │
                        │                         │   │ - Accessible name parse  │
                        │ - Type detection        │   │ - Alt text extract       │
                        │ - Live evaluation       │   │ - Placeholder/Title      │
                        │ - Multi-format verify   │   │                          │
                        └─────────────────────────┘   └──────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| **Background Service** | Keyboard shortcut binding (Ctrl+Shift+L / Cmd+Shift+L); initializes content script injection | `src/background/background.ts` |
| **Popup UI** | Extension menu: test ID attribute config (Chrome storage), open picker button, keyboard help | `src/popup/main.ts` |
| **Content Script** | Entry point: loads overlay, manages DOM picker mode, message listener for toggle | `src/content/index.ts` |
| **Event Manager** | Core DOM bridge: overlay lifecycle, highlight tracking, element capture, click handler, panel updates | `src/content/event-manager.ts` |
| **Highlighter** | Visual styling: CSS injection, highlight box positioning, verify result highlights | `src/content/highlighter.ts` |
| **Selector Engine** | Orchestration layer: calls XPath/CSS/Playwright generators, aggregates ranked candidates, formats output | `src/core/selector-engine.ts` |
| **XPath Generator** | Strategy-based XPath candidate collection (13 strategies), deduplication, uniqueness filtering | `src/core/xpath-generator.ts` |
| **CSS Generator** | Strategy-based CSS selector collection (15 strategies), stability filtering, class pattern avoidance | `src/core/css-generator.ts` |
| **Playwright Adapter** | Playwright locator generation (12 formats), built-in prioritization, chaining & filter logic | `src/adapters/playwright-adapter.ts` |
| **XPath Scorer** | Ranked scoring: stability (0.45) + depth (0.25) + predicates (0.20) + brevity (0.10) | `src/core/xpath-scorer.ts` |
| **CSS Scorer** | Ranked scoring: stability (0.45) + specificity (0.25) + depth (0.20) + brevity (0.10) | `src/core/css-scorer.ts` |
| **Playwright Scorer** | Ranked scoring: stability (0.35) + brevity (0.30) + readability (0.20) + uniqueness (0.15) | `src/core/playwright-scorer.ts` |
| **Locator Verifier** | Runtime verification: detects locator type (XPath/CSS/Playwright), evaluates against live DOM, error handling | `src/core/locator-verifier.ts` |
| **Attribute Analyzer** | Semantic extraction: test IDs, ARIA role, accessible names, alt text, placeholder, title | `src/core/attribute-analyzer.ts` |
| **Uniqueness Checker** | Validation: XPath evaluation, CSS matching, counts duplicate matches in DOM | `src/core/uniqueness-checker.ts` |
| **DOM Utils** | Low-level helpers: querySelector/XPath eval, tag introspection, sibling queries | `src/utils/dom-utils.ts` |
| **String Utils** | String escaping & normalization for locator values | `src/utils/string-utils.ts` |

## Pattern Overview

**Overall:** Three-layer architecture with **browser extension messaging** → **DOM-context content script** → **pure JS selector generation engine**.

**Key Characteristics:**
- **Content script isolation:** All locator generation runs in the injected content script, sandboxed from page context
- **Candidate generation → ranking:** Multi-strategy generators produce diverse candidates; scorers weight them by stability and precision
- **No external dependencies:** Core uses only DOM APIs; adapters convert to test framework formats (Playwright, Cypress, Selenium)
- **Live verification:** Panel supports real-time locator testing against current DOM state
- **Extensible strategy system:** New generators plug into selector-engine without breaking existing code

## Layers

**Extension Messaging Layer:**
- Purpose: Async communication between background service and active tab's content script
- Location: `src/background/background.ts`, `src/content/index.ts`
- Contains: Keyboard command handlers, chrome.runtime.onMessage listeners, chrome.tabs.sendMessage calls
- Depends on: Chrome extension APIs
- Used by: Background service (command trigger) initiates toggle; content script listens and teardown/setup overlay

**Content Script Layer (DOM Context):**
- Purpose: Injected into page context; manages overlay DOM, captures user interaction, coordinates selector generation
- Location: `src/content/`
- Contains: Overlay lifecycle, event listeners (click, mousemove), highlight updates, panel rendering
- Depends on: Browser DOM APIs, Selector Engine
- Used by: Background → content script toggle message; accesses live DOM

**Selector Generation Layer (Pure JS):**
- Purpose: Multi-strategy candidate collection and ranking; no DOM side effects
- Location: `src/core/`, `src/adapters/`
- Contains: Generators (XPath, CSS, Playwright), scorers, verification
- Depends on: DOM APIs (for introspection), type definitions
- Used by: Content script calls selector-engine after element click; returns ranked candidates

**Type/Utility Layer:**
- Purpose: Shared types, helper functions
- Location: `src/types/`, `src/utils/`
- Contains: LocatorResult, ElementLocators, dom-utils, string-utils
- Depends on: Nothing
- Used by: All layers

## Data Flow

### Primary Request Path (User clicks element in picker mode)

1. **User presses Ctrl+Shift+L / Cmd+Shift+L** — `src/background/background.ts:17-25`
   - Background service listens on `chrome.commands.onCommand`
   - Queries active tab, calls `sendToggleToTab()` with tab ID

2. **Background → Content Script message** — `src/background/background.ts:3-15`
   - Sends `'toggle-picker'` message to tab; if content script not loaded, injects `content.js` first

3. **Content script receives toggle** — `src/content/index.ts:60-68`
   - Message listener calls `togglePicker()` — enters picker mode if not already active

4. **Overlay DOM created** — `src/content/event-manager.ts:14-62`
   - `createOverlay()` builds overlay div, highlight element, locator panel
   - `injectStyles()` adds CSS into `<head>` (from `src/content/highlighter.ts:35-89`)
   - Overlay covers entire viewport; hint text displays at bottom

5. **Mouse tracking active** — `src/content/event-manager.ts:200+` (attachOverlayListeners)
   - `mousemove` listener → `onMove(clientX, clientY)` → `updateHighlight()` tracks cursor
   - `updateHighlight()` finds element under cursor via `document.elementsFromPoint()`; updates outline box

6. **User clicks element** — `src/content/event-manager.ts:180-190` (click handler)
   - Click listener calls `onOverlayClick()` → returns element under cursor
   - Calls `showPanelForElement(element)` with clicked element

7. **Selector engine processes element** — `src/core/selector-engine.ts:17-49`
   - `getLocatorsForElement(element, { testIdAttribute })` called
   - Calls three generators in sequence:
     - `generateRankedXPaths(element)` → array of `ScoredXPath[]` sorted by score (best first)
     - `generateRankedCSS(element)` → array of `ScoredCSS[]` sorted by score
     - `generateRankedPlaywright(element, context)` → array of `ScoredPlaywright[]` sorted by score
   - Calls `analyzeAttributes(element, testIdAttribute)` → `AttributeAnalysis` (test ID, role, aria-label, etc.)
   - Returns `ElementLocators` with both best candidates (`.xpath`, `.css`, `.playwright`) and full ranked lists

8. **Panel displays results** — `src/content/event-manager.ts:220-280`
   - Event manager builds HTML rows for best candidates in each format
   - Shows score badge, strategy label, unique indicator
   - Render collapsible "alternatives" section with full ranked list
   - Append "Verify Locator" button, close button

### Secondary Flow: Locator Verification (User types in verify input)

1. **User types in verify input field** — `src/content/event-manager.ts:145-150`
   - Input listener detects type, calls `detectLocatorType(input)` → guesses 'xpath' | 'css' | 'playwright'
   - Updates type badge display

2. **Run verification on blur or Enter key** — `src/content/event-manager.ts:150-155`
   - Calls `runVerification()`
   - Extracts `verifyInput.value.trim()`
   - Calls `verifyLocator(input, testIdAttr)` from `src/core/locator-verifier.ts`

3. **Locator verifier evaluates** — `src/core/locator-verifier.ts:20-160`
   - Auto-detect type: starts with '//' or '/' → xpath; starts with 'page.' → playwright; else css
   - Switch on type:
     - **XPath:** `doc.evaluate(xpath, doc, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE)` → array of matching elements
     - **CSS:** `doc.querySelectorAll(selector)` → array of matching elements
     - **Playwright:** Parse locator string (regex), resolve to CSS or role selector, then evaluate
   - Return `VerifyResult { type, matches[], error? }`

4. **Panel displays verify results** — `src/content/event-manager.ts:120-143`
   - If error, show red error message
   - If matches found, show green badge: "N elements matched"
   - Call `highlightVerifyMatches(result.matches)` → create overlay boxes for each match

**State Management:**
- **Global overlay state:** `currentPickerApi` (current element, panel visibility)
- **Panel state:** `verifyInput.value` (user's verify locator), `verifyTypeBadge.textContent` (detected type)
- **Chrome storage:** `testIdAttribute` value persisted across sessions
- **No mutable stores:** Each element evaluation is independent; no caching

## Key Abstractions

**Candidate Generation Strategy:**
- Purpose: Modularize locator discovery; each strategy method produces one or more candidate locators
- Examples: `collectIdCandidates()`, `collectDataTestIdCandidates()`, `collectTextCandidates()` in XPath/CSS generators
- Pattern: Each strategy checks for a specific attribute/property; if found and valid, creates candidate(s); deduplicates against prior strategies

**Scored Result Type:**
- Purpose: Rank candidates by quality
- Examples: `ScoredXPath`, `ScoredCSS`, `ScoredPlaywright` in `src/types/locator.types.ts`
- Pattern: Each result includes `candidate string`, `strategy label`, `score (0-100)`, and `breakdown { factor1, factor2, ... }`

**Scoring Weights:**
- Purpose: Balance precision (stability, specificity) vs. brevity across multiple dimensions
- Pattern: Separate scorer files (`xpath-scorer.ts`, `css-scorer.ts`, `playwright-scorer.ts`) define weights and sub-score functions
- Example: XPath weights stability at 0.45, depth at 0.25, predicates at 0.20, brevity at 0.10

**Uniqueness Verification:**
- Purpose: Ensure a candidate matches exactly one element in the DOM (when possible)
- Examples: `xpathMatchesElement()`, `cssMatchesElement()` in `uniqueness-checker.ts`
- Pattern: Re-run selector against full document; count matches; return boolean or count

## Entry Points

**Keyboard Shortcut (Ctrl+Shift+L / Cmd+Shift+L):**
- Location: `src/background/background.ts:17-25`
- Triggers: chrome.commands.onCommand listener bound to 'toggle-picker' command in manifest
- Responsibilities: Query active tab, send toggle message, inject content script if needed

**Popup "Open Picker Now" Button:**
- Location: `src/popup/main.ts:62-76`
- Triggers: Click listener on `#open-picker` button
- Responsibilities: Get active tab, send toggle message, close popup

**Content Script Initial Load:**
- Location: `src/content/index.ts:60-68`
- Triggers: chrome.runtime.onMessage listener
- Responsibilities: Call `togglePicker()` to switch picker mode on/off

**Manual Element Selection (for testing):**
- Location: Used by test files via direct imports
- Examples: `src/tests/selector-engine.test.ts` calls `getLocatorsForElement()` with synthetic DOM elements

## Architectural Constraints

- **Threading:** Single-threaded event loop (JavaScript). Content script runs in page's JS context; no workers used. Background service is separate context.
- **Global state:** 
  - `currentPickerApi` in `src/content/index.ts:15` (overlay API reference during picker mode)
  - `chrome.storage.sync` persists test ID attribute across sessions
  - No module-level mutable store beyond these
- **Circular imports:** None detected. Dependency graph is acyclic: messaging → event-manager → generators → scorers → types
- **DOM access:** Only in content script (`src/content/`) and pure-JS generators that introspect Element objects. No side effects in generators.
- **Browser APIs:** 
  - Content script: `document`, `chrome.runtime.onMessage`, `chrome.tabs.sendMessage`, `chrome.storage.sync`
  - Background: `chrome.commands.onCommand`, `chrome.tabs.query`, `chrome.tabs.sendMessage`, `chrome.scripting.executeScript`
  - Popup: `chrome.storage.sync`, `chrome.tabs.query`, `chrome.tabs.sendMessage`, `chrome.scripting.executeScript`

## Anti-Patterns

### Positional XPath Indices

**What happens:** Some frameworks still generate XPath with `//*[3]` or `/parent[1]/child[2]` (brittle positional predicates)

**Why it's wrong:** Any DOM insertion/removal breaks the index; tests become flaky as app evolves

**Do this instead:** Use `src/core/xpath-generator.ts:7` principle: "Never use positional indices." Always prefer attribute-based predicates (id, class, role, text content via contains())

### Auto-Generated Class Names in Selectors

**What happens:** CSS generator detects hashed class names (e.g., `_abc123def456`) and includes them in selectors

**Why it's wrong:** CSS-in-JS tools (Emotion, styled-components, CSS Modules) regenerate hashes on every build; selectors become invalid

**Do this instead:** Check `src/core/css-generator.ts:43-44` `isStableClass()` filter. Generator automatically rejects classes matching `UNSTABLE_CLASS_PATTERN` or longer than `MAX_CLASS_LENGTH`. If a class is unstable, strategy is not collected; fallback to next strategy

### Trusting Dynamic IDs for Stability

**What happens:** XPath/CSS generators might use an element's id even if it looks auto-generated (e.g., `btn-123-xyz`)

**Why it's wrong:** Server-side ID generation can change; test becomes brittle

**Do this instead:** `src/core/xpath-generator.ts:68-76` `isLikelyDynamicId()` heuristic rejects IDs with:
- Long hex/UUID patterns (`[0-9a-f]{8,}`)
- 5+ consecutive digits
- Suffix digit after dash/underscore on multi-part ID
If ID looks dynamic, strategy is skipped; fallback uses more stable attribute (e.g., data-testid, role+aria-label)

## Error Handling

**Strategy:** Try-catch on DOM operations; gracefully degrade to next strategy; never throw from generators.

**Patterns:**
- XPath evaluation wraps `doc.evaluate()` in try-catch; returns empty array on invalid syntax (`src/core/locator-verifier.ts:30-51`)
- CSS evaluation wraps `querySelectorAll()` in try-catch; returns `[]` on parse error
- Attribute parsing handles missing/null attributes with `??` nullish coalesce
- Verification panel shows red error badge if locator is invalid

## Cross-Cutting Concerns

**Logging:** 
- No persistent logging; uses console for debug only (comments in generators suggest future logging points)
- No third-party analytics

**Validation:** 
- Selector syntax validated at verification time (not generation time) — generators trust input element is valid
- Strategy deduplication prevents duplicate candidates in output (use Set-based uniqueness)

**Authentication:** 
- None required; extension is local, no backend calls

---

*Architecture analysis: 2026-05-13*
