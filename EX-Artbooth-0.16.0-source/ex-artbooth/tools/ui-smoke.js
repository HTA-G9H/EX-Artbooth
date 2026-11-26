#!/usr/bin/env node
/* Headless smoke test for the interface.
 *
 * There is no display in the build environment, so this loads the real
 * index.html + renderer.js in jsdom and checks structure: that every icon
 * reference resolves, that no glyph icons remain, that icons survive a
 * language switch, and that the main flows still run without errors.
 *
 * jsdom does no CSS layout, so this cannot catch visual or positioning bugs.
 * Run it with jsdom and canvas available, for example:
 *   npm install --no-save jsdom canvas && node tools/ui-smoke.js
 * or point NODE_PATH at an existing install:
 *   NODE_PATH=/tmp/node_modules node tools/ui-smoke.js
 */
const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (err) {
  console.error('jsdom is not installed. Try: npm install --no-save jsdom canvas');
  process.exit(2);
}

const appDir = path.join(__dirname, '..', 'app');
const indexFile = path.join(appDir, 'index.html');
const dom = new JSDOM(fs.readFileSync(indexFile, 'utf8'), {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'file://' + indexFile,
});
const { window } = dom;
const document = window.document;
window.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);

const errors = [];
window.addEventListener('error', (e) => errors.push(String((e.error && e.error.stack) || e.message)));

window.eval(fs.readFileSync(path.join(appDir, 'color.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(appDir, 'mp4.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8'));

const click = (el, what) => {
  if (!el) throw new Error('missing element: ' + what);
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const GLYPH = /[\u{1F300}-\u{1FAFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}\u{FF0B}\u{25A0}-\u{25FF}]/u;

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
};

(async () => {
  await wait(300);
  const defined = new Set([...document.querySelectorAll('symbol')].map((s) => s.id));
  const refs = () => [...document.querySelectorAll('use')].map((u) => u.getAttribute('href').slice(1));
  const dangling = (list) => [...new Set(list)].filter((id) => !defined.has(id));

  check('icon sprite defines symbols', defined.size > 0, `${defined.size} symbols`);
  check('static icon references all resolve', dangling(refs()).length === 0, dangling(refs()).join(',') || `${refs().length} refs`);

  window.__exartTest.newProject();   // toolbar removed in 0.13.0; menu drives this
  await wait(250);
  click(document.querySelector('.create-template-project'), 'create');
  await wait(400);
  click(document.getElementById('layerPanelBtn'), 'layer panel');
  await wait(250);
  check('icon references still resolve after the editor opens', dangling(refs()).length === 0, dangling(refs()).join(',') || `${refs().length} refs`);

  const glyphs = [...document.querySelectorAll('button, span, h1, h2, h3, div')]
    .filter((el) => el.children.length === 0 && GLYPH.test(el.textContent));
  check('no emoji or symbol glyph icons remain', glyphs.length === 0, glyphs.map((e) => e.textContent.trim()).join(' '));

  const before = document.querySelectorAll('use').length;
  click(document.getElementById('langToggleBtn'), 'language');
  await wait(300);
  const after = document.querySelectorAll('use').length;
  check('icons survive a language switch', before === after, `${before} -> ${after}`);
  click(document.getElementById('langToggleBtn'), 'language back');
  await wait(300);

  const row = document.querySelector('.lp-row');
  check('layer rows draw icon controls', Boolean(row && row.querySelector('.lp-eye use') && row.querySelector('use[href="#ic-grip"]')));

  click(document.getElementById('lpLockLayer'), 'lock');
  await wait(250);
  const locked = document.querySelector('.lp-row.locked-row');
  check('layer lock marks the row and shows a badge', Boolean(locked && locked.querySelector('.badge-lock use')));
  click(document.getElementById('lpLockLayer'), 'unlock');
  await wait(200);

  window.__exartTest.openExportDialog();
  await wait(400);
  const card = document.querySelector('.export-card');
  check('export dialog opens', Boolean(card));
  check('export colour rows are enabled', Boolean(card
    && !card.querySelector('[data-select="profile"]').disabled
    && !card.querySelector('[data-select="intent"]').disabled
    && !card.querySelector('[data-toggle="blackPoint"]').disabled));
  check('export dialog reports measured colour behaviour',
    Boolean(card && /sRGB|outside|black point/i.test(card.querySelector('#exportColorNote').textContent)));
  // 0.13.1 merged the per-format menu items into this one dialog, so its
  // format switch is now the only way to choose PNG / JPEG / PSD.
  if (card) {
  const formatButtons = [...card.querySelectorAll('[data-format]')].map((b) => b.dataset.format);
  check('export dialog offers every format', ['png', 'jpeg', 'psd'].every((f) => formatButtons.includes(f)), formatButtons.join(', '));
  // 0.14.0: MP4 is animation-only. This smoke run creates an illustration
  // project, so the button must be absent here.
  check('MP4 is hidden for a non-animation project', !formatButtons.includes('mp4'), formatButtons.join(', '));
  const jpegBtn = card.querySelector('[data-format="jpeg"]');
  jpegBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('choosing JPEG in the dialog takes effect', jpegBtn.classList.contains('active'));
  const pngBtn = card.querySelector('[data-format="png"]');
  pngBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  check('switching back to PNG takes effect', pngBtn.classList.contains('active') && !jpegBtn.classList.contains('active'));
  }

  if (card) click(card.querySelector('.export-close'), 'close export');

  // 0.14.0: and it must appear once the project really is an animation.
  const t = window.__exartTest;
  t.state.projectMeta = Object.assign({}, t.state.projectMeta, { kind: 'animation', category: 'Animation', fps: 12 });
  t.state.frames = [
    { frame: {}, layers: t.state.layers },
    { frame: {}, layers: t.state.layers },
  ];
  t.openExportDialog();
  await wait(400);
  const animCard = document.querySelector('.export-card');
  const animFormats = animCard ? [...animCard.querySelectorAll('[data-format]')].map((b) => b.dataset.format) : [];
  check('MP4 appears for an animation project', animFormats.includes('mp4'), animFormats.join(', '));
  if (animCard) {
    const mp4Btn = animCard.querySelector('[data-format="mp4"]');
    mp4Btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    check('choosing MP4 takes effect', mp4Btn.classList.contains('active'));
    const sizeNote = animCard.querySelector('#exportSizeNote').textContent;
    check('MP4 note reports frames, fps and duration',
      /2 /.test(sizeNote) && /12 fps/.test(sizeNote) && /0\.17s/.test(sizeNote), sizeNote);
    const colorNote = animCard.querySelector('#exportColorNote').textContent;
    check('MP4 explains that colour settings do not apply', /sRGB/i.test(colorNote), colorNote.slice(0, 60));
    click(animCard.querySelector('.export-close'), 'close export');
  }

  // 0.14.0: the MP4 muxer must be loaded alongside the app.
  check('MP4 muxer is available to the app', typeof window.ExArtboothMP4 === 'object'
    && typeof window.ExArtboothMP4.createMuxer === 'function');

  // 0.13.0 removed the top file toolbar; the menu bar owns these commands now.
  const removedButtons = ['homeBtn', 'newBtn', 'openBtn', 'importBtn', 'exportBtn', 'saveProjectBtn', 'openProjectBtn'];
  const stillThere = removedButtons.filter((id) => document.getElementById(id));
  check('top file toolbar removed', stillThere.length === 0, stillThere.join(', '));
  check('no stale references to the removed buttons', !/\$\('(homeBtn|newBtn|openBtn|importBtn|exportBtn|saveProjectBtn|openProjectBtn)'\)/.test(
    fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8')));

  check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((err) => {
  console.error('harness error:', err.stack);
  process.exit(1);
});
