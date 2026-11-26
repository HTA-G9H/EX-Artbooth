#!/usr/bin/env node
/* Tab tool switching and the inverting brush cursor.
 *   NODE_PATH=/tmp/node_modules node tools/cursor-tool-test.js
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

const pressTab = (target) => {
  const ev = new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  (target || d.body).dispatchEvent(ev);
  return ev;
};
const hover = (x, y) => {
  const vp = d.getElementById('viewport');
  vp.dispatchEvent(new window.PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
};

(async () => {
  await wait(300);
  window.__exartTest.newProject();
  await wait(250);
  click(d.querySelector('.create-template-project'), 'create');
  await wait(400);

  const state = window.__exartTest.state;
  const vp = d.getElementById('viewport');
  const overlay = d.getElementById('cursorOverlay');

  // --- Tab switching ---
  state.activeTool = 'brush';
  pressTab();
  await wait(60);
  check('Tab turns the brush into the eraser', state.activeTool === 'eraser', state.activeTool);

  pressTab();
  await wait(60);
  check('Tab turns the eraser back into the brush', state.activeTool === 'brush', state.activeTool);

  for (const tool of ['heal', 'clone', 'text', 'rect', 'ellipse', 'crop']) {
    state.activeTool = tool;
    pressTab();
    await wait(30);
    check(`Tab from ${tool} selects the brush`, state.activeTool === 'brush', state.activeTool);
  }

  // The toolbar must agree with the state, or the highlight lies.
  state.activeTool = 'brush';
  pressTab();
  await wait(60);
  const activeBtn = d.querySelector('.tool.active');
  check('the toolbar highlight follows Tab', Boolean(activeBtn) && activeBtn.dataset.tool === 'eraser',
    activeBtn ? activeBtn.dataset.tool : 'none');
  pressTab();
  await wait(60);

  // --- Tab must not hijack typing or dialogs ---
  const nameInput = d.getElementById('layerName');
  state.activeTool = 'brush';
  const typingEvent = pressTab(nameInput);
  await wait(60);
  check('Tab inside a text field still moves focus', state.activeTool === 'brush' && !typingEvent.defaultPrevented, state.activeTool);

  window.__exartTest.openBackgroundDialog();
  await wait(250);
  state.activeTool = 'brush';
  const modalEvent = pressTab();
  await wait(60);
  check('Tab inside a dialog is left alone', state.activeTool === 'brush' && !modalEvent.defaultPrevented, state.activeTool);
  const bgCard = d.querySelector('.background-card');
  if (bgCard) click(bgCard.querySelector('.input-cancel'), 'cancel');
  await wait(150);

  // --- the cursor overlay ---
  // jsdom performs no layout, so the canvas area measures 0x0 and the overlay
  // would collapse to 1x1. Give it a real size the way a window would.
  const rect = { width: 800, height: 600, left: 0, top: 0, right: 800, bottom: 600, x: 0, y: 0 };
  d.getElementById('canvasArea').getBoundingClientRect = () => rect;
  vp.getBoundingClientRect = () => rect;
  // The canvas only re-measures on a redraw, so trigger one.
  window.dispatchEvent(new window.Event('resize'));
  await wait(120);

  check('a cursor overlay exists', Boolean(overlay));
  state.activeTool = 'brush';
  state.brushSize = 40;
  hover(300, 300);
  await wait(80);

  const ctx = overlay.getContext('2d');
  const painted = () => {
    const data = ctx.getImageData(0, 0, overlay.width, overlay.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
    return n;
  };
  check('hovering draws a ring', painted() > 0, `${painted()} px`);
  check('the system cursor is hidden under the ring', vp.classList.contains('brush-cursor'));

  // The ring must be white; the stylesheet inverts it by compositing.
  const data = ctx.getImageData(0, 0, overlay.width, overlay.height).data;
  // Every visible pixel must be neutral (r == g == b) and bright. Neutral is
  // what makes difference blending a true inversion rather than a colour cast;
  // antialiased edges are allowed to be slightly under 255.
  let tinted = 0;
  let dim = 0;
  let sample = '';
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    if (!(r === g && g === b)) { tinted++; if (!sample) sample = `${r},${g},${b}`; }
    else if (r < 250) { dim++; if (!sample) sample = `${r},${g},${b}`; }
  }
  check('the ring is neutral white, so difference blending inverts cleanly',
    tinted === 0 && dim === 0, `${tinted} tinted, ${dim} dim${sample ? ' e.g. ' + sample : ''}`);

  // Ring size has to track the brush, or it lies about what you will paint.
  const ringWidth = () => {
    const px = ctx.getImageData(0, 0, overlay.width, overlay.height).data;
    let minX = overlay.width, maxX = -1;
    for (let y = 0; y < overlay.height; y++) {
      for (let x = 0; x < overlay.width; x++) {
        if (px[(y * overlay.width + x) * 4 + 3] > 0) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
      }
    }
    return maxX - minX;
  };
  const small = ringWidth();
  state.brushSize = 120;
  hover(300, 300);
  await wait(80);
  const big = ringWidth();
  check('the ring grows with the brush size', big > small * 2, `${small}px then ${big}px`);

  // Non-painting tools should not show a size ring.
  state.activeTool = 'text';
  hover(320, 320);
  await wait(80);
  check('no ring for the text tool', painted() === 0, `${painted()} px`);
  check('the system cursor comes back for the text tool', !vp.classList.contains('brush-cursor'));

  // Leaving the canvas clears it.
  state.activeTool = 'brush';
  hover(300, 300);
  await wait(60);
  vp.dispatchEvent(new window.PointerEvent('pointerleave', { bubbles: true, clientX: 0, clientY: 0, pointerId: 1 }));
  await wait(60);
  check('the ring disappears when the pointer leaves', painted() === 0, `${painted()} px`);

  // The stylesheet is what performs the inversion, so assert it is declared.
  const css = fs.readFileSync(path.join(appDir, 'styles.css'), 'utf8');
  check('the overlay is composited with difference blending', /#cursorOverlay[^}]*mix-blend-mode:\s*difference/s.test(css));

  check('no runtime errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('harness error:', e.stack); process.exit(1); });
