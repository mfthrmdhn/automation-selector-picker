# Element Locator Picker

**automation-selector-picker** — Chrome extension (Manifest V3) that lets you pick any element on a page and get multiple locator formats: **XPath**, **CSS**, and **Playwright**

## Features

- **Keyboard shortcut**: `Ctrl+Shift+L` (Windows/Linux) or `Cmd+Shift+L` (Mac) toggles the picker on the current tab.
- **Hover highlight**: See which element you’re about to select.
- **One click**: Click an element to see all locators in a floating panel.
- **Copy**: Copy any locator string with one click.
- **Frameworks**: Outputs Playwright, xpath and css locators.
- **Custom testId**: Set the testId attributes manually on extension window, (default to data-testid)

## Setup for development

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
- `npm run test` – Run tests
- `npm run test:watch` – Run tests in watch mode

## Usage

1. Open any webpage.
2. Press `Ctrl+Shift+L` (or `Cmd+Shift+L` on Mac), or click the extension icon and choose “Open picker now”.
3. Move the cursor over elements (they’re highlighted).
4. Click an element to see XPath, CSS, and Playwright locators.
5. Use **Copy** next to each locator, **Pick another** to select again, or **Close** / `Esc` to exit.
