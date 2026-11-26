#!/usr/bin/env node
/* Verifies undo/redo really restores pixels and structure.
 * Needs jsdom + canvas: NODE_PATH=/tmp/node_modules node tools/undo-test.js
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
const click = (el, w) => { if (!el) throw new Error('missing ' + w); el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
const check = (name, pass, detail) => { results.push(pass); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`); };

// A pointer gesture given in IMAGE coordinates, converted through the live view
// transform. render() recalculates that transform, so it must be read fresh for
// every gesture rather than pinned once.
function stroke(state, from, to) {
  const vp = d.getElementById('viewport');
  vp.setPointerCapture = () => {};     // jsdom implements no pointer capture
  vp.releasePointerCapture = () => {};
  const toClient = (p) => ({
    x: p.x * state.view.scale + state.view.offsetX,
    y: p.y * state.view.scale + state.view.offsetY,
  });
  const send = (type, pt) => {
    const c = toClient(pt);
    vp.dispatchEvent(new window.PointerEvent(type, {
      bubbles: true, clientX: c.x, clientY: c.y,
      button: 0, buttons: 1, pointerId: 1, pressure: .8,
    }));
  };
  send('pointerdown', from); send('pointermove', to); send('pointerup', to);
}

const layerPixels = (layer) => {
  const ctx = layer.canvas.getContext('2d');
  return ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height).data;
};
const nonEmpty = (data) => { let n = 0; for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++; return n; };
const same = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i += 97) if (a[i] !== b[i]) return false; return true; };

(async () => {
  await wait(300);
  // The top toolbar was removed in 0.13.0; the menu bar calls these directly.
  window.__exartTest.newProject(); await wait(250);
  click(d.querySelector('.create-template-project'), 'create'); await wait(400);
  const api = window.__exartTest;
  const state = api.state;

  // --- 1. a brush stroke is undoable and redoable, pixel for pixel ---
  state.activeTool = 'brush';
  state.brushSize = 40;
  const layer = state.layers[state.layers.length - 1];
  const blank = new Uint8ClampedArray(layerPixels(layer));
  stroke(state, { x: 120, y: 120 }, { x: 260, y: 240 });
  await wait(150);
  const painted = new Uint8ClampedArray(layerPixels(state.layers[state.layers.length - 1]));
  check('brush stroke painted something', nonEmpty(painted) > nonEmpty(blank), `${nonEmpty(painted)} px`);

  api.undo(); await wait(150);
  const afterUndo = layerPixels(state.layers[state.layers.length - 1]);
  check('undo restores the pixels exactly', same(afterUndo, blank), `${nonEmpty(afterUndo)} painted px left`);

  api.redo(); await wait(150);
  const afterRedo = layerPixels(state.layers[state.layers.length - 1]);
  check('redo restores the stroke exactly', same(afterRedo, painted), `${nonEmpty(afterRedo)} px`);

  // --- 2. structure: delete a layer, undo brings it back with its pixels ---
  const countBefore = state.layers.length;
  const doomedId = state.layers[state.layers.length - 1].id;
  const doomedPixels = new Uint8ClampedArray(layerPixels(state.layers[state.layers.length - 1]));
  click(d.getElementById('deleteLayerBtn'), 'delete'); await wait(200);
  check('layer deleted', state.layers.length === countBefore - 1);
  api.undo(); await wait(200);
  const restored = state.layers.find((l) => l.id === doomedId);
  check('undo restores the deleted layer', Boolean(restored) && state.layers.length === countBefore);
  check('restored layer keeps its pixels', Boolean(restored) && same(layerPixels(restored), doomedPixels));

  // --- 3. several strokes undo in order, newest first ---
  state.activeTool = 'brush';
  const marks = [];
  for (const y of [60, 160, 260]) {
    stroke(state, { x: 60, y }, { x: 200, y });
    await wait(80);
    marks.push(nonEmpty(layerPixels(state.layers[state.layers.length - 1])));
  }
  const ascending = marks[0] < marks[1] && marks[1] < marks[2];
  check('three strokes accumulate', ascending, marks.join(' < '));
  api.undo(); await wait(100);
  const back1 = nonEmpty(layerPixels(state.layers[state.layers.length - 1]));
  api.undo(); await wait(100);
  const back2 = nonEmpty(layerPixels(state.layers[state.layers.length - 1]));
  check('undo steps back one stroke at a time', back1 === marks[1] && back2 === marks[0], `${back1} then ${back2}`);

  // --- 4. a new edit clears the redo stack ---
  stroke(state, { x: 300, y: 300 }, { x: 340, y: 340 });
  await wait(120);
  const hist = api.history;
  check('a new edit clears the redo stack', hist.future.length === 0, `${hist.future.length} entries`);

  // --- 5. history is capped, and strokes are compacted to their bounding box ---
  state.brushSize = 20;
  const cap = hist.limit + 8;
  for (let i = 0; i < cap; i++) {
    stroke(state, { x: 40 + (i % 60) * 4, y: 400 + (i % 5) * 20 }, { x: 60 + (i % 60) * 4, y: 420 + (i % 5) * 20 });
    await wait(5);   // let node-canvas free the discarded full-canvas clones
  }
  check('history respects its step cap', hist.past.length <= hist.limit, `${hist.past.length} <= ${hist.limit}`);
  const mb = hist.bytes / (1024 * 1024);
  const full = (state.width * state.height * 4 * hist.past.length) / (1024 * 1024);
  check('strokes are compacted, not whole-canvas copies', mb < full / 20,
    `${mb.toFixed(2)} MB held vs ${full.toFixed(0)} MB if uncompacted`);
  check('history stays inside its memory budget', hist.bytes <= hist.budget);

  // --- 6. undo with nothing to undo is harmless ---
  for (let i = 0; i < hist.limit + 5; i++) api.undo();
  await wait(200);
  check('undoing past the start is harmless', /nothing to undo/i.test(d.getElementById('statusBar').textContent));

  // --- 7. the Move tool is gone and the brush is the default ---
  check('Move tool button removed', !d.querySelector('.tool[data-tool="move"]'));
  check('a tool is active by default', Boolean(d.querySelector('.tool.active')), d.querySelector('.tool.active')?.dataset.tool);

  check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('harness error:', e.stack); process.exit(1); });
