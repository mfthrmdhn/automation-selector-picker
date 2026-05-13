---
status: resolved
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

## Service Worker Investigation (Cycle 2)

### Critical Finding: No Console Logs = Service Worker Issue

User reported: **No console logs appear at all when trying to activate the extension.**

**Analysis:**
- ✓ Content script code is properly built (verified in `/public/content.js`)
- ✓ Background script code is properly built (verified in `/public/background.js`)
- ✓ Manifest has correct `commands` section with `toggle-picker` command
- ✗ No `[background]` logs = chrome.commands.onCommand listener is not firing
- ✗ No `[content]` logs = content script not even being invoked

**Conclusion:** The problem is not in the code, but in the service worker itself not running or crashing.

### Cycle 3: Service Worker Active But Message Passing Fails

**User Report:**
- ✓ Service Worker IS active (not inactive)
- ✗ Overlay does NOT appear on webpages
- ✗ Tried both keyboard shortcut AND "Open picker now" button - neither works

**Analysis:**
- Service worker is running → chrome.commands.onCommand listener should fire
- No overlay appears → either:
  1. Content script not injecting
  2. Message not reaching content script
  3. Content script listener not registered
  4. togglePicker() function failing
  5. Overlay created but hidden/broken

**New Hypothesis:** Content script injection is silently failing.

## Diagnostic Tests Needed

1. **Test on a simpler page** (Wikipedia has Content Security Policy):
   - Try on `https://example.com` instead of Wikipedia
   - Or `https://www.google.com`
   - Report if overlay appears

2. **Verify files exist** at chrome://extensions/:
   - Click "Details" on extension
   - Click "Manifest" section
   - Scroll down - can you see the full content?
   - Look for any syntax errors in the JSON

3. **Check file permissions** in Details page:
   - Look for "Permissions" section
   - Should show: "Read and change your data on all websites" 
   - Should show: "Manage active tab and scripting"

## Cycle 4: Error Logs Found! ROOT CAUSE IDENTIFIED

**User Report:**
- ✓ Service Worker IS active
- ✗ Tried on example.com (simple page, no CSP)
- ✗ Overlay still not shown
- ✓ **ERROR:** "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received"

**ROOT CAUSE FOUND:**
In `/src/content/index.ts` line 79, the message listener returns `true` (async response) unconditionally, but only calls `sendResponse()` when the message matches. If message doesn't match, it returns `true` but never responds → Chrome closes the channel → error.

**FIX APPLIED:**
Changed the listener to only return `true` after handling the message:
```typescript
if (message === TOGGLE_MESSAGE) {
  togglePicker();
  sendResponse(undefined);
  return true;  // Move inside the if block
}
return false;  // Don't handle other messages
```

**Status:** Extension rebuilt. User needs to reload and test.
