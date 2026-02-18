# Automation Selector Picker

**automation-selector-picker** is a browser extension (Chrome Manifest V3 and Firefox) that lets you pick any element on a page and get multiple locator formats: **XPath**, **CSS**, and **Playwright**, with ranked candidates and optional **locator verification**.

## Features

- **Keyboard shortcut**: `Ctrl+Shift+L` (Windows/Linux) or `Cmd+Shift+L` (Mac) toggles the picker on the current tab.
- **Hover highlight**: See which element you’re about to select.
- **One click**: Click an element to see locators in a floating panel.
- **Ranked locators**:
  - **XPath** – Multiple candidates scored by stability, brevity, depth, and predicates (e.g. id, data-testid, aria-label, structural).
  - **Playwright** – Multiple candidates following Playwright best practices (getByRole, getByLabel, getByTestId, etc.), scored by stability, readability, brevity, and uniqueness. Primary locator is chosen for exact match when possible.
  - **CSS** – Single best CSS selector.
- **Verify Locator**: Paste any XPath, CSS, or Playwright locator string; the extension evaluates it against the live DOM and highlights matched elements (or shows an error).
- **Copy**: Copy any locator with one click.
- **Custom test ID attribute**: Set the test ID attribute in the extension popup (default `data-testid`); used for Playwright `getByTestId` and test-id-based XPath.

## Supported browsers

- **Chrome** (Manifest V3)
- **Firefox** (build with Firefox-specific manifest)

## Setup for development

```bash
npm install
npm run build
```

Load the extension:

- **Chrome**: Open `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the **`public`** folder.
- **Firefox**: Build with `npm run build:firefox`, then load the **`public`** folder in `about:debugging` → **This Firefox** → **Load Temporary Add-on** → select `public/manifest.json`.

Set or confirm the shortcut at `chrome://extensions/shortcuts` (Chrome) or in the extension’s shortcut settings (Firefox).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run typecheck` | Type-check only (`tsc --noEmit`) |
| `npm run build` | Build for Chrome (type-check, Vite build, copy Chrome manifest into `public/`) |
| `npm run build:chrome` | Same as `build` |
| `npm run build:firefox` | Build for Firefox (output in `public/`) |
| `npm run build:dist:chrome` | Production Chrome build into `dist/` |
| `npm run build:dist:firefox` | Production Firefox build into `dist/` |
| `npm run dev` | Watch mode for Chrome (run `build` once first so `public/` exists) |
| `npm run dev:firefox` | Watch mode for Firefox |
| `npm run test` | Run tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

## Usage

1. Open any webpage.
2. Press `Ctrl+Shift+L` (or `Cmd+Shift+L` on Mac), or click the extension icon and choose **Open picker now**.
3. Move the cursor over elements (they’re highlighted).
4. Click an element to see XPath, CSS, and Playwright locators (with alternatives and scores).
5. Optionally use **Verify Locator**: paste an XPath, CSS, or Playwright locator to see how many elements it matches and where they are on the page.
6. Use **Copy** next to each locator, **Close** or `Esc` to close the panel, or press the shortcut again to turn the picker off.

## Project structure

- **`src/`**
  - **`content/`** – Content script: overlay, highlighter, event manager, locator panel and verification UI.
  - **`popup/`** – Extension popup (React): shortcut hint, test ID attribute setting, “Open picker now”.
  - **`background/`** – Service worker (Chrome) / background script.
  - **`core/`** – Selector engine, XPath/CSS generation, attribute analysis, Playwright candidate generation, scoring (XPath + Playwright), locator verifier.
  - **`adapters/`** – Framework-specific output: Playwright (ranked), Cypress, Selenium (used internally or for future UI).
  - **`types/`** – Locator types and scored candidate interfaces.
  - **`utils/`** – String helpers (e.g. escaping).
- **`manifests/`** – `chrome.json`, `firefox.json` (copied into `public/` or `dist/` by build scripts).
- **`tests/`** – Vitest tests for selector engine, XPath, CSS, Playwright adapter/scorer, locator verifier.

## Tech stack

- TypeScript, React (popup), Vite (build), Vitest (tests).
- Chrome Extension APIs + Firefox-compatible manifest and build.

## Author

Miftah Ramadhan
