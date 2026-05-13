# External Integrations

**Analysis Date:** 2026-05-13

## APIs & External Services

**No Remote APIs:**
- Extension does not integrate with any external HTTP/REST services
- All functionality is client-side only
- No analytics, telemetry, or cloud services used

## Browser APIs Used

**Chrome Extension APIs:**
- `chrome.tabs.query()` - Query active tab for popup and background script
- `chrome.tabs.sendMessage()` - Send toggle messages between background and content scripts
- `chrome.scripting.executeScript()` - Dynamically inject content script when needed
- `chrome.runtime.onMessage` - Listen for messages from popup/background in content script
- `chrome.commands.onCommand` - Listen for keyboard shortcuts (Ctrl+Shift+L / Cmd+Shift+L)
- `chrome.storage.sync` - Persist user settings (test ID attribute name)

**DOM & Web APIs:**
- `document.*` - Full DOM manipulation (create elements, classList, appendChild)
- `Element.getBoundingClientRect()` - Calculate element position for highlight overlays
- `document.elementFromPoint()` - Implicit via click handlers for element selection
- `navigator.clipboard.writeText()` - Copy locators to clipboard
- `navigator.platform` - Detect OS (Mac vs. PC) for keyboard shortcut display hints

**Content Script Injection:**
- Content script runs in isolated context (separate from page's JavaScript)
- Can safely inspect page DOM without page script interference
- Message-based communication with background service worker

## Data Storage

**Persistent Storage:**
- Chrome Extension local storage (`chrome.storage.sync`)
- Key: `testIdAttribute`
- Value: User-configured test ID attribute name (e.g., 'data-testid', 'data-qa')
- Scope: Per-extension across all sites

**Session Storage:**
- In-memory state in content script:
  - Current selected element
  - Panel visibility state
  - Highlight position
  - Verify input state
- Lost when content script is torn down or page navigates

**No Cloud/Remote Storage:**
- Locator results are not persisted outside the extension
- No database connections
- No file sync services

## Authentication & Identity

**Not Applicable:**
- Extension requires no authentication
- No user accounts or login system
- No API keys or secrets
- No identity provider integration

## Monitoring & Observability

**Error Tracking:** None
- Silent error handling (try/catch with no logging)
- Failed content script injection caught and ignored (gracefully falls back)
- Failed tab message sends caught but not reported

**Logs:**
- No structured logging
- No console output (intentional to avoid polluting page console)
- Can be added via `console.log()` for debugging (development only)

## CI/CD & Deployment

**Hosting:** Not applicable
- Extension is manually built and packaged
- Installation: Manual .zip upload to Chrome Web Store or developer mode
- Firefox variants: Separate build artifacts

**Build Process:**
1. TypeScript compilation (`tsc`)
2. Vite bundling (`vite build`)
3. Manifest generation (copy and inject browser-specific variant)
4. Output: `.zip` file for upload

**CI Pipeline:** None detected
- No GitHub Actions, GitLab CI, or similar
- Builds are local (developer machine)

## Keyboard Shortcuts (OS-Level)

**Primary Trigger:**
- Default: `Ctrl+Shift+L` (Windows/Linux)
- macOS: `Cmd+Shift+L`
- Configured in `manifest.json` under `commands.toggle-picker`
- Listener: `chrome.commands.onCommand` in `src/background/background.ts`

**Navigation:**
- `Esc` - Close locator panel (but keep picker overlay active)
- `Cmd+Shift+L` / `Ctrl+Shift+L` again - Exit picker mode entirely

## Content Security Policy

**Implicit (Manifest v3 defaults):**
- Inline scripts not permitted (Vite outputs separate .js bundles)
- Content scripts have isolated world (cannot access page's window object)
- Cross-origin fetch blocked (not used anyway)

## Message Protocol

**Background ↔ Content Script:**
- Format: Simple string-based messages
- Toggle message: `'toggle-picker'`
- Response: undefined (fire-and-forget after injection)
- Protocol: `chrome.tabs.sendMessage()` / `chrome.runtime.onMessage`

**Sample Flow:**
```
User presses Ctrl+Shift+L
    ↓
chrome.commands.onCommand triggered in background
    ↓
Query active tab: chrome.tabs.query({ active: true, currentWindow: true })
    ↓
Send toggle message: chrome.tabs.sendMessage(tabId, 'toggle-picker')
    ↓
If content script not loaded:
    - chrome.scripting.executeScript({ files: ['content.js'] })
    - Wait 50ms
    - Retry chrome.tabs.sendMessage()
    ↓
Content script receives message
    ↓
chrome.runtime.onMessage listener toggles picker on/off
```

## User Settings Persistence

**Storage Access:**
- `chrome.storage.sync.get()` - Read settings on popup load and panel creation
- `chrome.storage.sync.set()` - Save when user blurs test ID input field

**Settings Format:**
```javascript
{
  testIdAttribute: 'data-testid' // or user-configured value
}
```

**Scope:** Synced across all user's devices (if user is signed into Chrome account)

## Clipboard Integration

**Copy to Clipboard:**
- API: `navigator.clipboard.writeText(locator)`
- Used for: All locator types (XPath, CSS, Playwright)
- UX: "Copy" button → "Copied!" feedback (1.5s timeout)
- No permissions required (modern Chrome allows without manifest permission)

## Element Verification in Live Page

**Locator Verification Feature:**
- User enters XPath, CSS, or Playwright locator in panel
- Client-side validation: `verifyLocator()` in `src/core/locator-verifier.ts`
- Matching: Uses DOM query methods to find matching elements
- Highlighting: Overlays highlight divs at matched element positions
- Match count displayed to user
- No external verification service

---

*Integration audit: 2026-05-13*
