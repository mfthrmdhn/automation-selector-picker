---
status: awaiting_user_input
trigger: Extension not responding to activation attempts - no overlay appears
created: 2026-05-13
updated: 2026-05-13
---

## Symptoms

**Expected Behavior:**
- Overlay should appear when extension is activated
- Should work via: keyboard shortcut (Cmd+Shift+L), toolbar icon click, or "Open picker now" button
- Extension icon is visible in toolbar

**Actual Behavior:**
- Extension icon IS visible in the toolbar (loaded successfully)
- All 3 activation methods tried: keyboard shortcut, icon click, button click
- None trigger any response - no overlay appears
- No visible error messages reported

**Test Environment:**
- Browser: Chrome
- Test page: https://en.wikipedia.org/wiki/Toyota_C-HR
- No console errors visible to user

## Current Focus

**Root Cause Candidate**: Message passing between background and content script is failing.

**Evidence**:
- Extension background script loads (icon visible)
- Content script either not injecting or not receiving message
- Silent error handling masks actual failure point

## Investigation Progress

### Code Review Findings

Reviewed all three message-passing pathways:

1. **Keyboard shortcut handler** (`src/background/background.ts`)
   - Listens for `chrome.commands.onCommand` with command `'toggle-picker'`
   - Queries for active tab
   - Attempts `chrome.tabs.sendMessage(tabId, 'toggle-picker')`
   - Falls back to `chrome.scripting.executeScript()` if message fails

2. **Content script listener** (`src/content/index.ts`)
   - Has `chrome.runtime.onMessage.addListener()` that expects string `'toggle-picker'`
   - Calls `togglePicker()` which creates overlay DOM

3. **Popup handler** (`src/popup/main.ts`)
   - "Open picker now" button uses same message passing

All code is properly built to `/public/` directory.

### Diagnostic Solution Applied

Added console.log statements to trace execution flow:

**Background Script** (`src/background/background.ts`):
```
[background] command received: <command>
[background] tabs query result: <count> tabs
[background] Found active tab: <tabId>
[background] sendToggleToTab called with tabId: <tabId>
[background] sendMessage failed, attempting injection: <error>
[background] Script injection succeeded, waiting 50ms before retry
[background] Script injection failed: <error>
[background] Retry sendMessage failed: <error>
```

**Content Script** (`src/content/index.ts`):
```
[content] Content script loaded, ROOT_ID: selector-picker-root
[content] About to register onMessage listener
[content] onMessage listener registered
[content] onMessage received: toggle-picker
[content] togglePicker called
[content] enterPickerMode called
[content] Overlay created and appended to DOM
```

### Build Status

Extension rebuilt successfully with diagnostic logging.

## Next Step: User Action Required

1. **Reload extension**: Go to `chrome://extensions/` and click the reload icon on your extension
2. **Open DevTools**: Go to https://en.wikipedia.org/wiki/Toyota_C-HR and press `F12` or `Cmd+Option+I`
3. **Go to Console tab**: Click "Console" in the DevTools
4. **Try activation**: Press `Cmd+Shift+L` (Mac) or `Ctrl+Shift+L` (Windows)
5. **Report logs**: Copy and paste ALL console messages you see (should include [background] and/or [content] prefixed logs)

**What to look for:**

- **If you see `[background]` logs**: background script is working, check if you see any `[content]` logs
- **If you see `[content]` logs starting with "loaded"**: content script injected successfully
- **If you see `[content] onMessage received`**: message passing works, overlay should appear
- **If NO logs appear**: keyboard command may not be registering, try "Open picker now" button instead

The console output will pinpoint exactly where the message passing chain breaks.
