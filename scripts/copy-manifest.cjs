/**
 * Copies root manifest.json into the given target directory (public or dist).
 * Usage: node scripts/copy-manifest.cjs <public|dist>
 */
const fs = require('fs');
const path = require('path');
const target = process.argv[2] || 'public';
const root = path.join(__dirname, '..');
const from = path.join(root, 'manifest.json');
const to = path.join(root, target, 'manifest.json');
if (!fs.existsSync(from)) {
  console.error('manifest.json not found at project root');
  process.exit(1);
}
fs.mkdirSync(path.dirname(to), { recursive: true });
fs.cpSync(from, to);
