/**
 * Manages the visual highlight overlay for the element under the cursor.
 */

const HIGHLIGHT_CLASS = 'selector-picker-highlight';

export function createHighlightElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = HIGHLIGHT_CLASS;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

export function updateHighlight(
  highlight: HTMLDivElement,
  rootId: string,
  clientX: number,
  clientY: number
): Element | null {
  const elements = document.elementsFromPoint(clientX, clientY);
  const under = elements.find((el) => !el.closest(`#${rootId}`));
  if (!under) {
    highlight.style.display = 'none';
    return null;
  }
  const rect = under.getBoundingClientRect();
  highlight.style.display = 'block';
  highlight.style.top = `${rect.top}px`;
  highlight.style.left = `${rect.left}px`;
  highlight.style.width = `${rect.width}px`;
  highlight.style.height = `${rect.height}px`;
  return under;
}

export function getHighlightStyles(rootId: string): string {
  return `
    #${rootId} { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; }
    #${rootId} * { box-sizing: border-box; }
    .selector-picker-overlay { position: fixed; inset: 0; pointer-events: auto; cursor: crosshair; }
    .selector-picker-hint { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: #1a1a2e; color: #eee; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-family: system-ui, sans-serif; pointer-events: none; box-shadow: 0 2px 12px rgba(0,0,0,0.3); }
    .${HIGHLIGHT_CLASS} { position: fixed; pointer-events: none; outline: 2px solid #6366f1; outline-offset: 2px; border-radius: 2px; transition: top 0.05s, left 0.05s, width 0.05s, height 0.05s; }
    .selector-picker-panel { position: fixed; bottom: 24px; right: 24px; width: 420px; max-width: calc(100vw - 48px); max-height: 70vh; background: #1a1a2e; color: #e2e8f0; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); font-family: system-ui, sans-serif; pointer-events: auto; overflow: hidden; opacity: 0; visibility: hidden; transition: opacity 0.2s, visibility 0.2s; }
    .selector-picker-panel-visible { opacity: 1; visibility: visible; }
    .selector-picker-panel-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #334155; }
    .selector-picker-panel-header h3 { margin: 0; font-size: 14px; font-weight: 600; }
    .selector-picker-panel-actions { display: flex; gap: 8px; }
    .selector-picker-btn { padding: 6px 12px; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; background: #334155; color: #e2e8f0; }
    .selector-picker-btn:hover { background: #475569; }
    .selector-picker-pick-another { background: #6366f1; color: #fff; }
    .selector-picker-pick-another:hover { background: #4f46e5; }
    .selector-picker-locators { padding: 12px 16px; overflow: auto; max-height: 50vh; }
    .selector-picker-row { margin-bottom: 12px; }
    .selector-picker-row label { display: block; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8; margin-bottom: 4px; }
    .selector-picker-row pre { margin: 0; padding: 8px; background: #0f172a; border-radius: 6px; font-size: 11px; white-space: pre-wrap; word-break: break-all; overflow-x: auto; }
    .selector-picker-copy { margin-top: 4px; padding: 4px 10px; font-size: 11px; border: none; border-radius: 4px; background: #334155; color: #e2e8f0; cursor: pointer; }
    .selector-picker-copy:hover { background: #475569; }
    .selector-picker-xpath-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .selector-picker-xpath-header label { margin-bottom: 0; }
    .selector-picker-xpath-meta { display: flex; align-items: center; gap: 6px; }
    .selector-picker-score-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; padding: 1px 6px; font-size: 11px; font-weight: 700; font-family: ui-monospace, monospace; border: 1.5px solid; border-radius: 4px; line-height: 1.4; }
    .selector-picker-strategy-tag { display: inline-block; padding: 1px 6px; font-size: 10px; font-weight: 500; color: #94a3b8; background: #1e293b; border-radius: 3px; white-space: nowrap; }
    .selector-picker-xpath-row + .selector-picker-xpath-row { margin-top: 0; padding-top: 10px; border-top: 1px dashed #334155; }
    .selector-picker-divider { border: none; border-top: 1px solid #334155; margin: 12px 0; }
    .selector-picker-xpath-alts { margin-bottom: 12px; }
    .selector-picker-alts-toggle { display: flex; align-items: center; gap: 6px; width: 100%; padding: 6px 0; border: none; background: none; color: #94a3b8; font-size: 11px; font-weight: 600; font-family: system-ui, sans-serif; cursor: pointer; text-transform: uppercase; letter-spacing: 0.03em; }
    .selector-picker-alts-toggle:hover { color: #e2e8f0; }
    .selector-picker-alts-chevron { font-size: 8px; transition: transform 0.15s; display: inline-block; }
    .selector-picker-alts-count { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; height: 16px; padding: 0 4px; font-size: 10px; font-weight: 700; color: #94a3b8; background: #1e293b; border-radius: 8px; }
    .selector-picker-alts-content { overflow: hidden; max-height: 0; opacity: 0; transition: max-height 0.2s ease, opacity 0.15s ease, margin 0.2s ease; margin-top: 0; }
    .selector-picker-alts-content.selector-picker-alts-expanded { max-height: 500px; opacity: 1; margin-top: 4px; }
  `;
}
