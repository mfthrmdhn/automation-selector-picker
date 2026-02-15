/**
 * Content script: listens for toggle messages and manages picker overlay.
 * Injected on demand (shortcut or "Open picker now"). Escape only closes the panel; shortcut turns picker off.
 */

import { getRootId, createOverlay, injectStyles, attachOverlayListeners } from './event-manager';

const ROOT_ID = getRootId();
const TOGGLE_MESSAGE = 'toggle-picker';

function getRoot(): HTMLDivElement | null {
  return document.getElementById(ROOT_ID) as HTMLDivElement | null;
}

let currentPickerApi: ReturnType<typeof createOverlay> | null = null;

function teardown(): void {
  const root = getRoot();
  if (!root) return;
  root.remove();
  currentPickerApi = null;
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
  if (!document.body) return;
  const root = document.createElement('div');
  root.id = ROOT_ID;

  injectStyles(root);
  const api = createOverlay(root);
  currentPickerApi = api;
  attachOverlayListeners(api.overlay, api.panel, api);

  document.body.appendChild(root);
  document.addEventListener('keydown', handleEscape, true);
}

function togglePicker(): void {
  if (getRoot()) {
    teardown();
  } else {
    enterPickerMode();
  }
}

chrome.runtime.onMessage.addListener(
  (message: string, _sender, sendResponse) => {
    if (message === TOGGLE_MESSAGE) {
      togglePicker();
      sendResponse(undefined);
    }
    return true;
  }
);
