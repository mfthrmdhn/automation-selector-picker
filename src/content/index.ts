/**
 * Content script: listens for toggle messages and manages picker overlay.
 * Injected on demand (shortcut or "Open picker now"). Escape only closes the panel; shortcut turns picker off.
 */

import { getRootId, createOverlay, injectStyles, attachOverlayListeners } from './event-manager';

const ROOT_ID = getRootId();
const TOGGLE_MESSAGE = 'toggle-picker';

console.log('[content] Content script loaded, ROOT_ID:', ROOT_ID);

function getRoot(): HTMLDivElement | null {
  return document.getElementById(ROOT_ID) as HTMLDivElement | null;
}

let currentPickerApi: ReturnType<typeof createOverlay> | null = null;
let cleanupListeners: (() => void) | null = null;

function teardown(): void {
  const root = getRoot();
  if (!root) return;
  root.remove();
  currentPickerApi = null;
  if (cleanupListeners) {
    cleanupListeners();
    cleanupListeners = null;
  }
  document.removeEventListener('keydown', handleEscape, true);
}

function handleEscape(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  e.stopPropagation();
  // Esc only closes the locator panel, not the whole picker
  if (currentPickerApi) currentPickerApi.hidePanel();
}

function enterPickerMode(): void {
  if (!document.body) {
    console.log('[content] No document.body, cannot enter picker mode');
    return;
  }
  console.log('[content] enterPickerMode called');
  const root = document.createElement('div');
  root.id = ROOT_ID;

  injectStyles(root);
  const api = createOverlay(root);
  currentPickerApi = api;
  cleanupListeners = attachOverlayListeners(api.overlay, api.panel, api);

  document.body.appendChild(root);
  document.addEventListener('keydown', handleEscape, true);
  console.log('[content] Overlay created and appended to DOM');
}

function togglePicker(): void {
  console.log('[content] togglePicker called');
  if (getRoot()) {
    console.log('[content] Overlay exists, tearing down');
    teardown();
  } else {
    console.log('[content] Overlay does not exist, entering picker mode');
    enterPickerMode();
  }
}

console.log('[content] About to register onMessage listener');
chrome.runtime.onMessage.addListener(
  (message: string, _sender, sendResponse) => {
    console.log('[content] onMessage received:', message);
    if (message === TOGGLE_MESSAGE) {
      console.log('[content] Message matches TOGGLE_MESSAGE, calling togglePicker');
      togglePicker();
      sendResponse(undefined);
    }
    return true;
  }
);
console.log('[content] onMessage listener registered');