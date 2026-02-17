/**
 * Copies the browser-specific manifest into the build output directory.
 *
 * Usage: node scripts/copy-manifest.cjs <browser> [outDir]
 *   browser : "chrome" | "firefox"  (default: "chrome")
 *   outDir  : target directory       (default: "public")
 *
 * Example: node scripts/copy-manifest.cjs firefox dist
 */
const fs = require('fs');
const path = require('path');

const browser = process.argv[2] || 'chrome';
const outDir = process.argv[3] || 'public';
const root = path.join(__dirname, '..');
const from = path.join(root, 'manifests', `${browser}.json`);
const to = path.join(root, outDir, 'manifest.json');

if (!fs.existsSync(from)) {
  console.error(`manifests/${browser}.json not found`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(to), { recursive: true });
fs.cpSync(from, to);
console.log(`Copied manifests/${browser}.json -> ${outDir}/manifest.json`);
