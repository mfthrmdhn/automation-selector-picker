/**
 * String escaping and sanitization for selectors and generated code.
 */

/**
 * Escape a string for use inside a single-quoted JavaScript string.
 */
export function escapeSingleQuoted(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Escape backticks for use inside a template literal.
 */
export function escapeBackticks(str: string): string {
  return str.replace(/`/g, '\\`');
}

/**
 * Truncate and optionally sanitize text (e.g. for locator names).
 */
export function truncate(str: string, maxLength: number): string {
  const trimmed = str.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength);
}
