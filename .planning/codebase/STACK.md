# Technology Stack

**Analysis Date:** 2026-05-13

## Languages

**Primary:**
- TypeScript 5.3.3 - Core application logic, type-safe implementations across all modules
- JavaScript - Build scripts (Node.js based)
- JSX/TSX - UI rendering in popup and content scripts using React

**Secondary:**
- CSS - Styling for popup UI and content script overlays (bundled into TypeScript/JSX files)
- Shell/Bash - Build orchestration scripts

## Runtime

**Environment:**
- Node.js - Development and build tooling
- Chrome/Chromium - Extension target runtime (Manifest v3)
- Firefox - Secondary extension target (build variant available)
- JSDOM 23.0.1 - Test environment simulation

**Package Manager:**
- npm - Package management
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- React 18.2.0 - Component state management in popup UI
- React-DOM 18.2.0 - DOM rendering for popup interface

**Testing:**
- Vitest 1.1.0 - Unit and integration test runner
- JSDOM 23.0.1 - Simulated DOM environment for tests

**Build/Dev:**
- Vite 5.0.10 - ES module bundler and dev server
- Vite React Plugin (@vitejs/plugin-react) 4.2.1 - JSX transformation
- TypeScript 5.3.3 - Static type checking compiler
- cross-env 10.1.0 - Cross-platform environment variable handling

## Key Dependencies

**Critical:**
- @types/chrome 0.0.254 - Chrome Extension API type definitions (required for background, content, popup scripts)
- @types/react 18.2.43, @types/react-dom 18.2.17 - React type definitions
- @types/node 25.2.3 - Node.js type definitions for build scripts

**Infrastructure:**
- None - No external HTTP/API libraries present; communication is entirely through Chrome Extension APIs

## Configuration

**Environment:**
- Browser selection: `BROWSER` env var (chrome|firefox) - selects manifest variant via build scripts
- Output directory: `VITE_OUT_DIR` env var controls build output (`public` for dev, `dist` for release)
- Platform detection: Runtime platform detection via `navigator.platform` in popup for keyboard shortcut hints

**Build:**
- `tsconfig.json` - Targets ES2020, DOM + DOM.Iterable libs, strict mode enabled
- `vite.config.ts` - Multi-entry build (background.js, content.js, popup.html); custom IIFE wrapper for content scripts
- `vitest.config.ts` - JSDOM environment, globals enabled, test setup in `tests/setup.ts`
- `package.json` - Module type: "module" (ES modules)

## Platform Requirements

**Development:**
- Node.js 14+ (inferred from package usage)
- npm 6+
- TypeScript 5.3.3+

**Production:**
- Chrome/Chromium 88+ (Manifest v3 requirement)
- Firefox 109+ (variant available; uses same core code)
- No external service dependencies

## Entry Points

**Background Service Worker:**
- Built from: `src/background/background.ts`
- Output: `public/background.js` or `dist/background.js`
- Role: Keyboard shortcut listener, tab message relay

**Content Script:**
- Built from: `src/content/index.ts`
- Output: `public/content.js` or `dist/content.js`
- Injected: On demand or at page load
- Role: DOM overlay, element picker, panel management

**Popup UI:**
- Built from: `popup.html` → `src/popup/main.ts`
- Output: `public/assets/popup.js` or `dist/assets/popup.js`
- Role: User settings (test ID attribute), picker trigger button

## Build Output Structure

```
public/                    # Dev build output
├── manifest.json         # Generated from manifest template
├── background.js         # Service worker
├── content.js            # Content script (IIFE-wrapped)
├── popup.html            # Extension popup
└── assets/
    ├── popup.js          # Popup UI bundle
    ├── [name].js         # Code-split chunks
    └── [name].css        # Bundled styles

dist/                      # Release build output (when VITE_OUT_DIR=dist)
└── [same structure]
```

## Notable Architectural Decisions

**No External APIs:** The extension is fully self-contained; it does not require:
- No authentication services
- No backend API calls
- No CDN dependencies
- No third-party analytics

**Custom DOM Analysis:** All selector/locator generation is implemented from scratch (`src/core/`), not relying on framework-specific utilities.

**Chrome Extension Architecture (Manifest v3):**
- Service worker (not persistent background page)
- Content script injected on demand (performance optimization)
- chrome.storage.sync for user settings persistence
- Message passing between background and content scripts

---

*Stack analysis: 2026-05-13*
