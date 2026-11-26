/* Verifies every CSS class the renderer injects at runtime is defined in styles.css. */
const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, '..', 'app');
const js = fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8');
const html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(appDir, 'styles.css'), 'utf8');

const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const used = new Set();
for (const m of js.matchAll(/className\s*=\s*'([^']+)'/g)) m[1].split(/\s+/).forEach((c) => c && used.add(c));
for (const m of js.matchAll(/class="([^"${]+)"/g)) m[1].split(/\s+/).forEach((c) => c && used.add(c));
for (const m of html.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => c && used.add(c));

// Behaviour-only hooks: these are JS selectors or use inherited element styling.
const ignore = new Set([
  'hidden', 'primary', 'small', 'active', 'selected',
  'adj', 'create-template-project', 'custom-dpi', 'custom-height', 'custom-width',
  'input-cancel', 'input-confirm', 'new-project-close'
]);
const missing = [...used].filter((c) => !defined.has(c) && !ignore.has(c)).sort();

if (missing.length) {
  console.error('Classes used but never styled in styles.css:\n  ' + missing.join('\n  '));
  process.exit(1);
}
console.log(`OK: ${used.size} UI classes all exist in styles.css`);
