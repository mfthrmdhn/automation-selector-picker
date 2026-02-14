# Element Locator Picker

**automation-selector-picker** — Chrome extension (Manifest V3) that lets you pick any element on a page and get multiple locator formats: **XPath**, **CSS**, **Playwright**, **Cypress**, and **Selenium**.

## Features

- **Keyboard shortcut**: `Ctrl+Shift+L` (Windows/Linux) or `Cmd+Shift+L` (Mac) toggles the picker on the current tab.
- **Hover highlight**: See which element you’re about to select.
- **One click**: Click an element to see all locators in a floating panel.
- **Copy**: Copy any locator string with one click.
- **Frameworks**: Outputs Playwright, Cypress, and Selenium-style locators.

## Project structure

```
├── manifest.json        # Single source for extension manifest (copied to public/ and dist/)
├── popup.html           # Popup HTML entry (Vite builds to public/popup.html)
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── .gitignore
├── public/              # Dev build output (load this folder in Chrome as “Load unpacked”)
│   ├── manifest.json    # Copied from root
│   ├── background.js   # Built from src/background/background.ts
│   ├── content.js      # Built from src/content/index.ts
│   ├── popup.html      # Built from root popup.html
│   └── assets/         # Popup bundle (popup.js, popup.css)
├── dist/                # Distribution build (no source maps); created by npm run build:dist
├── scripts/
│   └── copy-manifest.cjs  # Copies root manifest.json to public/ or dist/
├── src/
│   ├── background/     # Service worker (background.ts)
│   ├── content/        # Picker UI, highlighter, event handling (index.ts, event-manager.ts, highlighter.ts)
│   ├── popup/          # Toolbar popup (React: Popup.tsx, main.tsx, popup.css)
│   ├── core/           # Selector logic: selector-engine.ts, xpath-generator, css-generator, uniqueness-checker, attribute-analyzer
│   ├── adapters/       # Framework output (playwright-adapter, cypress-adapter, selenium-adapter)
│   ├── utils/          # dom-utils, string-utils
│   └── types/          # locator.types
└── tests/              # Unit tests (Vitest): xpath.test.ts, css.test.ts, selector-engine.test.ts, setup.ts
```

## Setup

```bash
npm install
npm run build
```

Load the extension in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the **`public`** folder

Set or confirm the shortcut at `chrome://extensions/shortcuts`.

## Scripts

- `npm run typecheck` – Type-check only (`tsc --noEmit`)
- `npm run build` – Type-check, build into `public/`, copy manifest
- `npm run dev` – Build in watch mode (run `build` once first so `public/` has manifest)
- `npm run build:dist` – Build for distribution: output to `dist/` with **no source maps**
- `npm run package` – Run `build:dist` then zip `dist/` → `element-locator-picker.zip`
- `npm run test` – Run tests
- `npm run test:watch` – Run tests in watch mode

## Development

- **Changing the manifest** (name, version, permissions): edit **`manifest.json`** at the project root. It is copied to `public/` and `dist/` on build.
- **Adding a new locator adapter**: add a module in `src/adapters/`, then register it in `src/core/selector-engine.ts` and in the content script UI (e.g. `src/content/event-manager.ts` or highlighter).
- **Tests**: `src/core` and adapters are unit-tested in `tests/`. Run `npm run test` or `npm run test:watch`.

## Distribution (share without source)

To share the extension **without** your source code:

1. Run **`npm run package`**. This will:
   - Build the extension into **`dist/`** with minified JS and **no `.map` files** (so original source isn’t included).
   - Create **`element-locator-picker.zip`** at the project root.

2. Share either:
   - The **`element-locator-picker.zip`** file, or  
   - The **`dist/`** folder (e.g. zipped yourself).

3. Recipients can:
   - **Load unpacked**: In Chrome go to `chrome://extensions` → Developer mode → **Load unpacked** → select the unzipped folder (or `dist/`).
   - **Chrome Web Store**: Upload the zip when publishing the extension.

## Usage

1. Open any webpage.
2. Press `Ctrl+Shift+L` (or `Cmd+Shift+L` on Mac), or click the extension icon and choose “Open picker now”.
3. Move the cursor over elements (they’re highlighted).
4. Click an element to see XPath, CSS, Playwright, Cypress, and Selenium locators.
5. Use **Copy** next to each locator, **Pick another** to select again, or **Close** / `Esc` to exit.

## License

MIT
