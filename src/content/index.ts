/**
 * Content script entry: toggles picker mode and mounts overlay + panel.
 */

import { getRootId, createOverlay, injectStyles, attachOverlayListeners } from './event-manager';

const ROOT_ID = getRootId();

function getRoot(): HTMLDivElement | null {
  return document.getElementById(ROOT_ID) as HTMLDivElement | null;
}

function teardown(): void {
  const root = getRoot();
  if (!root) return;
  root.remove();
  document.removeEventListener('keydown', handleEscape);
}

function handleEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape') teardown();
}

function enterPickerMode(): void {
  const root = document.createElement('div');
  root.id = ROOT_ID;

  injectStyles(root);
  const api = createOverlay(root);
  attachOverlayListeners(api.overlay, api.panel, api, teardown);

  document.body.appendChild(root);
  document.addEventListener('keydown', handleEscape);
}

if (getRoot()) {
  teardown();
} else {
  enterPickerMode();
}
