#!/usr/bin/env node
/* Builds ui-preview.html: a single self-contained page showing the real
 * stylesheet and the real icon sprite, so the design can be reviewed without
 * launching the app. The CSS is inlined because the in-app file preview runs
 * in a sandboxed iframe that cannot fetch external stylesheets.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'app', 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'app', 'index.html'), 'utf8');

const sprite = html.slice(html.indexOf('<svg class="icon-sprite"'), html.indexOf('</defs></svg>') + 13);
const symbols = [...sprite.matchAll(/id="ic-([a-z-]+)"/g)].map((m) => m[1]);

const ic = (name, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#ic-${name}"/></svg>`;

const swatch = (name, value, note) => `
  <div class="pv-swatch">
    <div class="pv-chip" style="background:${value}"></div>
    <strong>${name}</strong>
    <code>${value}</code>
    <span>${note}</span>
  </div>`;

const railIcons = ['grid', 'invert', 'transform', 'flip-h', 'merge-down', 'download', 'trash', 'fx', 'more-v'];

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>EX Artbooth - interface style</title>
<style>
${css}

/* preview page chrome only */
body { overflow: auto; height: auto; padding: 32px; background: var(--bg); }
.pv { max-width: 1040px; margin: 0 auto; display: grid; gap: 32px; }
.pv-head h1 { font-size: 22px; }
.pv-head p { color: var(--muted); margin: 4px 0 0; }
.pv-section { display: grid; gap: 12px; }
.pv-section > h2 { text-transform: uppercase; letter-spacing: .08em; font-size: 11px; color: var(--muted); }
.pv-box { border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--surface); padding: 16px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.pv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.pv-swatch { border: 1px solid var(--line); border-radius: var(--r-lg); padding: 12px; display: grid; gap: 4px; background: var(--surface); }
.pv-chip { height: 48px; border-radius: var(--r); border: 1px solid var(--line); }
.pv-swatch code { color: var(--green); font-size: 12px; }
.pv-swatch span { color: var(--muted); font-size: 11px; }
.pv-icons { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; }
.pv-icon { border: 1px solid var(--line); border-radius: var(--r); padding: 10px 6px; display: grid; justify-items: center; gap: 6px; background: var(--surface); }
.pv-icon span { font-size: 10px; color: var(--muted); }
.pv-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.pv-mock { border: 1px solid var(--line); border-radius: var(--r-lg); overflow: hidden; background: var(--bg); }
.pv-mock-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 0 24px; height: 64px; background: var(--surface); border-bottom: 1px solid var(--line); }
.pv-mock-body { padding: 24px; display: flex; gap: 16px; align-items: flex-start; }
.pv-card { width: 180px; border: 1px solid var(--line); border-radius: var(--r-lg); background: var(--surface-2); overflow: hidden; }
.pv-card-thumb { height: 104px; background: repeating-conic-gradient(#242424 0% 25%, #101010 0% 50%) 50% / 10px 10px; }
.pv-card-meta { padding: 12px; display: grid; gap: 2px; }
.pv-card-meta strong { font-size: 13px; }
.pv-card-meta span { font-size: 11px; color: var(--muted); }
.pv-note { color: var(--muted); font-size: 12px; margin: 0; }
.pv-spacing { display: flex; align-items: flex-end; gap: 12px; }
.pv-spacing div { background: var(--green); width: 28px; display: grid; place-items: end center; color: var(--black); font-size: 10px; font-weight: 700; padding-bottom: 2px; }
</style>
</head>
<body>
${sprite}
<div class="pv">
  <header class="pv-head">
    <h1>EX Artbooth - interface style</h1>
    <p>Green, black and white. Flat surfaces, square corners, one 4 px spacing rhythm, custom icons.</p>
  </header>

  <section class="pv-section">
    <h2>Palette</h2>
    <div class="pv-grid">
      ${swatch('Green', '#26c281', 'Brand, active state, focus')}
      ${swatch('Black', '#0a0a0b', 'App background')}
      ${swatch('White', '#ffffff', 'Primary text')}
      ${swatch('Surface', '#121314', 'Black + white 4%')}
      ${swatch('Surface 2', '#17181a', 'Panels and cards')}
      ${swatch('Line', 'rgba(255,255,255,.10)', 'All borders')}
    </div>
    <p class="pv-note">Every neutral is black lifted with white, so no fourth hue enters the interface.</p>
  </section>

  <section class="pv-section">
    <h2>Spacing scale</h2>
    <div class="pv-box">
      <div class="pv-spacing">
        <div style="height:4px">4</div><div style="height:8px">8</div><div style="height:12px">12</div>
        <div style="height:16px">16</div><div style="height:24px">24</div><div style="height:32px">32</div>
      </div>
    </div>
  </section>

  <section class="pv-section">
    <h2>Buttons</h2>
    <div class="pv-box">
      <button class="primary">Primary</button>
      <button>Secondary</button>
      <button class="active">Active</button>
      <button disabled>Disabled</button>
      <button>${ic('download')}With icon</button>
      <button class="dock-button">${ic('plus')}</button>
      <button class="dock-button">${ic('info')}</button>
      <button class="dock-button">${ic('more-h')}</button>
      <button class="lp-icon">${ic('copy')}</button>
      <button class="foot-toggle active">${ic('lock')}</button>
    </div>
    <p class="pv-note">Radius is 4 px on controls and 6 px on panels. Nothing is pill shaped.</p>
  </section>

  <section class="pv-section">
    <h2>Inputs</h2>
    <div class="pv-box">
      <input type="text" value="Layer 1" style="width:160px">
      <select style="width:160px"><option>Normal</option></select>
      <input type="range" value="70" style="width:160px">
      <label style="display:flex;gap:8px;align-items:center;width:auto"><input type="checkbox" checked style="width:auto"> Onion skin</label>
      <span class="switch on"><i></i></span>
      <span class="switch"><i></i></span>
    </div>
  </section>

  <section class="pv-section">
    <h2>Layer rail, scrolling (0.12.0 fix: the scrollbar must not cover the icons)</h2>
    <div style="display:flex; gap:24px; align-items:flex-start;">
      <div style="display:grid; gap:6px;">
        <div style="font-size:11px; color:var(--muted);">Height capped so it has to scroll</div>
        <div style="display:flex; border:1px solid var(--line); border-radius:var(--r); background:var(--surface-2);">
          <div style="width:150px; padding:10px; font-size:12px; color:var(--soft);">layer list</div>
          <div class="layer-panel-rail" style="height:150px;">
            ${railIcons.map((name) => `<button type="button" class="rail-btn">${ic(name)}</button>`).join('\n            ')}
          </div>
        </div>
      </div>
      <div style="display:grid; gap:6px;">
        <div style="font-size:11px; color:var(--muted);">Tall enough that it does not scroll</div>
        <div style="display:flex; border:1px solid var(--line); border-radius:var(--r); background:var(--surface-2);">
          <div style="width:150px; padding:10px; font-size:12px; color:var(--soft);">layer list</div>
          <div class="layer-panel-rail" style="height:400px;">
            ${railIcons.map((name) => `<button type="button" class="rail-btn">${ic(name)}</button>`).join('\n            ')}
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="pv-section">
    <h2>Icons (${symbols.length}, drawn for this app)</h2>
    <div class="pv-icons">
      ${symbols.map((name) => `<div class="pv-icon">${ic(name)}<span>${name}</span></div>`).join('\n      ')}
    </div>
  </section>

  <section class="pv-section">
    <h2>Home screen (the real header markup, with Back hidden as on first load)</h2>
    <div class="pv-mock">
      <header class="home-topbar" style="height:72px">
        <button class="ghost home-back hidden">${ic('back')}<span>Back</span></button>
        <div class="home-title">
          <img class="home-logo" src="app/icon.png" alt="">
          <div>
            <h1>EX Artbooth</h1>
            <p>Recent projects</p>
          </div>
        </div>
        <button class="primary choose-btn">Choose</button>
      </header>
      <div class="pv-mock-body">
        <div class="pv-card"><div class="pv-card-thumb"></div><div class="pv-card-meta"><strong>Poster draft</strong><span>1440 x 3200 - 4 layers</span></div></div>
        <div class="pv-card" style="border-color:var(--green)"><div class="pv-card-thumb"></div><div class="pv-card-meta"><strong>Walk cycle</strong><span>1920 x 1080 - 12 frames</span></div></div>
      </div>
      <footer class="home-dock" style="padding:12px 0;position:static">
        <div class="dock-cluster">
          <button class="dock-button">${ic('plus')}</button>
          <button class="dock-button">${ic('info')}</button>
          <button class="dock-button">${ic('more-h')}</button>
        </div>
      </footer>
    </div>
  </section>

  <section class="pv-section">
    <h2>Export dialog</h2>
    <div class="input-modal-card export-card" style="position:static;transform:none">
      <header class="export-head"><h3>Save image</h3><button class="export-close">${ic('close')}</button></header>
      <div class="export-scroll">
        <div class="export-section-label">Basic</div>
        <div class="export-group">
          <div class="export-row"><span>File type</span>
            <div class="format-switch"><button class="active">PNG</button><button>JPEG</button><button>PSD</button></div>
          </div>
          <div class="export-row"><span>Transparency</span><span class="switch"><i></i></span></div>
          <div class="export-row"><span>Super resolution x2</span><span class="switch on"><i></i></span></div>
          <p class="export-note">Output size: 2880 x 6400 px</p>
        </div>
        <div class="export-section-label">Color</div>
        <div class="export-group">
          <div class="export-row"><span>Color space</span><select><option>RGB</option></select></div>
          <div class="export-row"><span>Color profile</span><select><option>Adobe RGB (1998)</option></select></div>
          <div class="export-row"><span>Rendering intent</span><select><option>Relative colorimetric</option></select></div>
          <div class="export-row"><span>Black point compensation</span><span class="switch on"><i></i></span></div>
          <p class="export-note">No part of this image falls outside Adobe RGB, so all four rendering intents give identical pixels here.</p>
        </div>
      </div>
      <button class="export-ok">OK</button>
    </div>
  </section>
</div>
</body>
</html>
`;

fs.writeFileSync(path.join(root, '..', 'ui-preview.html'), page);
console.log(`ui-preview.html written with ${symbols.length} icons`);
