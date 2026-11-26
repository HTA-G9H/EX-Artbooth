#!/usr/bin/env node
/* Background scope across animation frames: apply to one frame, all frames,
 * or a range -- and make sure undo restores every frame it touched.
 *   NODE_PATH=/tmp/node_modules node tools/bg-scope-test.js
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const appDir = path.join(__dirname, '..', 'app');
const indexFile = path.join(appDir, 'index.html');
const dom = new JSDOM(fs.readFileSync(indexFile, 'utf8'), { runScripts: 'outside-only', pretendToBeVisual: true, url: 'file://' + indexFile });
const { window } = dom;
window.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0);
const errors = [];
window.addEventListener('error', (e) => errors.push(String((e.error && e.error.stack) || e.message)));
window.eval(fs.readFileSync(path.join(appDir, 'color.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(appDir, 'mp4.js'), 'utf8'));
window.eval(fs.readFileSync(path.join(appDir, 'renderer.js'), 'utf8'));
const d = window.document;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const click = (el, what) => { if (!el) throw new Error('missing ' + what); el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); };

const results = [];
const check = (name, pass, detail) => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };

// Background mode of every frame, in order -- the thing the user actually sees.
function modes(state) {
  return state.frames.map((f) => {
    const bg = f.layers.find((l) => l.isBackground || l.name === 'Background');
    return bg ? bg.backgroundMode : '?';
  });
}

// Drive the real dialog rather than calling internals, so the UI is covered too.
async function setBackground({ mode, scope, from, to }) {
  click(d.getElementById('backgroundBtn') || d.querySelector('[data-rail="background"]'), 'background button');
  await wait(250);
  const card = d.querySelector('.background-card');
  if (!card) throw new Error('background dialog did not open');
  click(card.querySelector(`[data-bg-mode="${mode}"]`), 'mode ' + mode);
  if (scope) {
    const scopeBtn = card.querySelector(`[data-scope="${scope}"]`);
    if (!scopeBtn) throw new Error('scope control missing: ' + scope);
    click(scopeBtn, 'scope ' + scope);
    if (scope === 'range') {
      const f = card.querySelector('#bgRangeFrom');
      const t = card.querySelector('#bgRangeTo');
      f.value = String(from);
      f.dispatchEvent(new window.Event('input', { bubbles: true }));
      t.value = String(to);
      t.dispatchEvent(new window.Event('input', { bubbles: true }));
    }
  }
  const summary = card.querySelector('#bgScopeSummary');
  const summaryText = summary ? summary.textContent : '';
  click(card.querySelector('.input-confirm'), 'apply');
  await wait(250);
  return summaryText;
}

(async () => {
  await wait(300);
  window.__exartTest.newProject();
  await wait(250);
  click(d.querySelector('.create-template-project'), 'create');
  await wait(400);

  const api = window.__exartTest;
  const state = api.state;

  // Turn this into a six-frame animation with independent layer arrays.
  state.projectMeta = Object.assign({}, state.projectMeta, { kind: 'animation', category: 'Animation', fps: 12 });
  const baseLayers = state.layers;
  state.frames = [{ frame: { id: 'f1' }, layers: baseLayers }];
  for (let i = 2; i <= 6; i++) {
    state.frames.push({ frame: { id: 'f' + i }, layers: baseLayers.map((l) => ({ ...l })) });
  }
  state.frameIndex = 0;
  api.resetHistory ? api.resetHistory() : null;
  await wait(100);

  check('six frames are set up', state.frames.length === 6, modes(state).join(','));
  const original = modes(state);

  // --- 1. default scope touches only the current frame ---
  await setBackground({ mode: 'grid-dark', scope: 'frame' });
  let now = modes(state);
  check('this frame only changes one frame', now[0] === 'grid-dark' && now.slice(1).every((m) => m === original[1]), now.join(','));

  api.undo(); await wait(150);
  check('undo restores the single frame', modes(state).join(',') === original.join(','), modes(state).join(','));

  // --- 2. apply to all ---
  const allSummary = await setBackground({ mode: 'grid-dark', scope: 'all' });
  now = modes(state);
  check('apply to all changes every frame', now.every((m) => m === 'grid-dark'), now.join(','));
  check('summary names every frame', /6/.test(allSummary), allSummary);

  api.undo(); await wait(200);
  check('undo restores all six frames', modes(state).join(',') === original.join(','), modes(state).join(','));

  // --- 3. apply to a range, 2 to 4 (1-based, inclusive) ---
  const rangeSummary = await setBackground({ mode: 'grid-dark', scope: 'range', from: 2, to: 4 });
  now = modes(state);
  const rangeOk = now[0] === original[0] && now[1] === 'grid-dark' && now[2] === 'grid-dark'
    && now[3] === 'grid-dark' && now[4] === original[4] && now[5] === original[5];
  check('range 2-4 changes exactly frames 2, 3 and 4', rangeOk, now.join(','));
  check('summary reports the range', /2-4/.test(rangeSummary), rangeSummary);

  api.undo(); await wait(200);
  check('undo restores the range', modes(state).join(',') === original.join(','), modes(state).join(','));

  api.redo(); await wait(200);
  check('redo reapplies the range', modes(state).slice(1, 4).every((m) => m === 'grid-dark')
    && modes(state)[0] === original[0] && modes(state)[4] === original[4], modes(state).join(','));
  api.undo(); await wait(200);

  // --- 4. a reversed range is tolerated, not silently wrong ---
  await setBackground({ mode: 'grid-dark', scope: 'range', from: 5, to: 3 });
  now = modes(state);
  const reversedOk = now[2] === 'grid-dark' && now[3] === 'grid-dark' && now[4] === 'grid-dark'
    && now[0] === original[0] && now[1] === original[1] && now[5] === original[5];
  check('a reversed range 5 to 3 is read as 3 to 5', reversedOk, now.join(','));
  api.undo(); await wait(200);

  // --- 5. out-of-range numbers are clamped, not crashed ---
  await setBackground({ mode: 'grid-dark', scope: 'range', from: 0, to: 999 });
  check('out-of-range numbers clamp to the real frames', modes(state).every((m) => m === 'grid-dark'), modes(state).join(','));
  api.undo(); await wait(200);

  // --- 6. frames must not end up sharing one layer array ---
  await setBackground({ mode: 'grid-dark', scope: 'all' });
  const arrays = new Set(state.frames.map((f) => f.layers));
  check('each frame keeps its own layer array', arrays.size === state.frames.length, `${arrays.size} distinct of ${state.frames.length}`);
  const canvases = state.frames.map((f) => f.layers[f.layers.length - 1].canvas);
  check('painted pixels are shared, not duplicated', canvases.every((c) => c === canvases[0]));

  // --- 7. a still-image project must not show the control at all ---
  state.projectMeta = { kind: 'illustration', category: 'Illustration' };
  state.frames = [state.frames[0]];
  state.frameIndex = 0;
  click(d.getElementById('backgroundBtn') || d.querySelector('[data-rail="background"]'), 'background button');
  await wait(250);
  const stillCard = d.querySelector('.background-card');
  check('no scope control for a still-image project', Boolean(stillCard) && !stillCard.querySelector('.background-scope'));
  if (stillCard) click(stillCard.querySelector('.input-cancel'), 'cancel');

  check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('harness error:', e.stack); process.exit(1); });
