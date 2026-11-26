/* EX Artbooth renderer: a compact Photoshop-style MVP built on HTML Canvas. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const viewport = $('viewport');
  const canvasArea = $('canvasArea');
  const vctx = viewport.getContext('2d', { alpha: false });
  const cursorOverlay = $('cursorOverlay');
  const cctx = cursorOverlay ? cursorOverlay.getContext('2d') : null;
  const fileInput = $('fileInput');
  const projectInput = $('projectInput');
  const homeView = $('homeView');
  const editorView = $('editorView');
  const projectGrid = $('projectGrid');
  const defaultCompositeCanvas = document.createElement('canvas');
  const onionCanvas = document.createElement('canvas');
  const frameThumbCanvas = document.createElement('canvas');
  const scratchCanvas = document.createElement('canvas');

  const defaultAdjustment = () => ({ brightness: 0, contrast: 0, exposure: 0, saturation: 0, hue: 0 });
  const state = {
    width: 1280, height: 720, layers: [], selectedLayerId: null,
    activeTool: 'brush', projectName: 'Untitled', dirty: false,
    view: { zoom: 1, scale: 1, offsetX: 0, offsetY: 0, panX: 0, panY: 0 },
    brushColor: '#2fe6a6', brushSize: 24, brushOpacity: 1,
    fontSize: 56, fontFamily: 'Arial', strokeWidth: 0,
    strokeColor: '#ffffff', fillColor: '#2fe6a6',
    isPointerDown: false, lastPoint: null, dragStart: null,
    previewShape: null, cropRect: null, moveSession: null,
    cloneSource: null, cloneStart: null, fileMode: 'replace',
    isViewPanning: false, viewPanSession: null,
    currentProjectId: null,
    projectMeta: {},
    projectGalleryFolderId: null,
    frames: [], frameIndex: 0, onionSkin: true, isPlaying: false, playTimer: null,
    lang: 'en'
  };

  const STORAGE_KEYS = {
    projects: 'openpixel.projects.v1',
    deleted: 'openpixel.deletedProjects.v1',
    folders: 'openpixel.projectFolders.v1',
    settings: 'openpixel.settings.v1'
  };
  const homeState = {
    selectedProjectId: null,
    focused: false,
    replayAnimation: null,
    selectionMode: false,
    selectedProjectIds: new Set(),
    currentFolderId: null
  };

  const TEMPLATE_LIBRARY = {
    illustration: {
      label: 'Illustration',
      description: 'Artwork, social assets, stickers, and tall canvases.',
      items: [
        { id: 'ill-hd', name: 'HD quality', type: 'options', defaultIndex: 1, options: [
          { label: 'SD', width: 720, height: 1600 },
          { label: 'HD', width: 1440, height: 3200 },
          { label: 'FHD', width: 1630, height: 3621 },
          { label: 'UHD', width: 1844, height: 4096 }
        ] },
        { id: 'ill-square', name: '1:1', type: 'options', defaultIndex: 1, options: [
          { label: 'LD', width: 768, height: 768 },
          { label: 'SD', width: 1280, height: 1280 },
          { label: '2K', width: 2048, height: 2048 },
          { label: '3K', width: 3072, height: 3072 },
          { label: '4K', width: 4096, height: 4096 }
        ] },
        { id: 'ill-3-4', name: '3:4', type: 'options', defaultIndex: 0, options: [
          { label: 'SD', width: 768, height: 1024 },
          { label: '2K', width: 1536, height: 2048 },
          { label: '3K', width: 2304, height: 3072 },
          { label: '4K', width: 3072, height: 4096 }
        ] },
        { id: 'ill-9-16', name: '9:16', type: 'options', defaultIndex: 0, options: [
          { label: 'SD', width: 720, height: 1280 },
          { label: '2K', width: 1080, height: 1920 },
          { label: '3K', width: 1440, height: 2567 },
          { label: '4K', width: 2160, height: 3840 }
        ] },
        { id: 'ill-x-post-head', name: 'X post head', type: 'fixed', width: 1500, height: 500, detail: 'Fixed social header size' },
        { id: 'ill-chat-stamp', name: 'Chat stamp', type: 'fixed', width: 370, height: 320, detail: 'Fixed sticker/stamp size' },
        { id: 'ill-vertical', name: 'Vertical', type: 'fixed', width: 690, height: 4096, detail: 'Fixed long vertical canvas' },
        { id: 'ill-custom', name: 'Custom', type: 'custom', width: 1280, height: 720, detail: 'Any canvas size' }
      ]
    },
    printable: {
      label: 'Printable',
      description: 'Print-ready page formats and DPI choices.',
      items: [
        { id: 'print-manga', name: 'Manga sketch', type: 'fixed', width: 2400, height: 3500, dpi: 300, detail: 'Fixed manga sketch draft size' },
        { id: 'print-jp-postcard', name: 'JP postcard', type: 'options', defaultIndex: 1, options: [
          { label: '150 dpi', width: 591, height: 874, dpi: 150 },
          { label: '300 dpi', width: 1181, height: 1748, dpi: 300 },
          { label: '350 dpi', width: 1378, height: 2039, dpi: 350 },
          { label: '400 dpi', width: 1575, height: 2331, dpi: 400 },
          { label: '600 dpi', width: 2362, height: 3496, dpi: 600 }
        ] },
        { id: 'print-a4', name: 'A4', type: 'options', defaultIndex: 1, options: [
          { label: '150 dpi', width: 1240, height: 1754, dpi: 150 },
          { label: '300 dpi', width: 2480, height: 3508, dpi: 300 },
          { label: '350 dpi', width: 2894, height: 4093, dpi: 350 },
          { label: '400 dpi', width: 3307, height: 4677, dpi: 400 },
          { label: '600 dpi', width: 4961, height: 7016, dpi: 600 }
        ] },
        { id: 'print-a5', name: 'A5', type: 'options', defaultIndex: 1, options: [
          { label: '150 dpi', width: 874, height: 1240, dpi: 150 },
          { label: '300 dpi', width: 1748, height: 2480, dpi: 300 },
          { label: '350 dpi', width: 2039, height: 2894, dpi: 350 },
          { label: '400 dpi', width: 2331, height: 3307, dpi: 400 },
          { label: '600 dpi', width: 3496, height: 4961, dpi: 600 }
        ] },
        { id: 'print-b4', name: 'B4', type: 'options', defaultIndex: 1, options: [
          { label: '150 dpi', width: 1476, height: 2085, dpi: 150 },
          { label: '300 dpi', width: 2953, height: 4169, dpi: 300 },
          { label: '350 dpi', width: 3445, height: 4864, dpi: 350 },
          { label: '400 dpi', width: 3937, height: 5559, dpi: 400 },
          { label: '600 dpi', width: 5906, height: 8339, dpi: 600 }
        ] },
        { id: 'print-b5', name: 'B5', type: 'options', defaultIndex: 1, options: [
          { label: '150 dpi', width: 1039, height: 1476, dpi: 150 },
          { label: '300 dpi', width: 2079, height: 2953, dpi: 300 },
          { label: '350 dpi', width: 2425, height: 3445, dpi: 350 },
          { label: '400 dpi', width: 2772, height: 3937, dpi: 400 },
          { label: '600 dpi', width: 4157, height: 5906, dpi: 600 }
        ] },
        { id: 'print-custom', name: 'Custom', type: 'custom', width: 2480, height: 3508, dpi: 300, detail: 'Custom print size and DPI' }
      ]
    },
    animation: {
      label: 'Animation',
      description: 'Frame canvas presets with FPS settings.',
      items: [
        { id: 'anim-square', name: '1:1', type: 'options', defaultIndex: 3, options: [
          { label: 'LLLD', width: 192, height: 192 },
          { label: 'LLD', width: 640, height: 640 },
          { label: 'LD', width: 768, height: 768 },
          { label: 'SD', width: 1280, height: 1280 }
        ] },
        { id: 'anim-3-4', name: '3:4', type: 'options', defaultIndex: 3, options: [
          { label: 'LLD', width: 256, height: 192 },
          { label: 'LD', width: 640, height: 480 },
          { label: 'SD', width: 1024, height: 768 },
          { label: 'HD', width: 1280, height: 960 }
        ] },
        { id: 'anim-9-16', name: '9:16', type: 'options', defaultIndex: 0, options: [
          { label: 'SD', width: 1280, height: 720 },
          { label: '2K', width: 1920, height: 1080 }
        ] },
        { id: 'anim-custom', name: 'Custom', type: 'custom', width: 1280, height: 720, fps: 24, detail: 'Custom animation canvas size' }
      ]
    }
  };

  function showFatalError(message) {
    try {
      let box = document.getElementById('fatalErrorOverlay');
      if (!box) {
        box = document.createElement('div');
        box.id = 'fatalErrorOverlay';
        box.style.cssText = 'position:fixed;inset:18px;z-index:99999;background:#151821;color:#f4f7fb;border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:22px;font-family:Segoe UI,Arial,sans-serif;box-shadow:0 24px 90px rgba(0,0,0,.45);overflow:auto;';
        document.body.appendChild(box);
      }
      box.innerHTML = `<h2 style="margin:0 0 10px">EX Artbooth could not finish loading</h2><p style="color:#aab4c5">Please send this message back so I can fix the build:</p><pre style="white-space:pre-wrap;background:#0b0d12;border-radius:12px;padding:14px;border:1px solid rgba(255,255,255,.08)">${escapeHtml(String(message))}</pre>`;
    } catch (_err) {
      console.error('EX Artbooth error:', message);
    }
  }

  window.addEventListener('error', (event) => showFatalError(event.error?.stack || event.message));
  window.addEventListener('unhandledrejection', (event) => showFatalError(event.reason?.stack || event.reason || 'Unknown promise rejection'));

  const uid = () => 'layer_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function makeCanvas(w = state.width, h = state.height) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function cloneCanvas(source) {
    if (!source) return null;
    const c = makeCanvas(source.width, source.height);
    c.getContext('2d').drawImage(source, 0, 0);
    return c;
  }

  function selectedLayer() {
    return state.layers.find((layer) => layer.id === state.selectedLayerId) || null;
  }

  function isBackgroundLayer(layer) {
    return Boolean(layer && (layer.isBackground || layer.name === 'Background'));
  }

  function isLayerLocked(layer) {
    return Boolean(layer && layer.userLocked && !isBackgroundLayer(layer));
  }

  function blockedByLock(layer, action) {
    if (!isLayerLocked(layer)) return false;
    setStatus(`${layer.name} is locked. Unlock it in the layer panel to ${action}.`);
    return true;
  }

  function toggleLayerLock(layer = selectedLayer()) {
    if (!layer) return;
    if (isBackgroundLayer(layer)) { setStatus('The background is always protected. Use Edit to change its style.'); return; }
    pushHistory(layer.userLocked ? 'unlock layer' : 'lock layer', []);
    layer.userLocked = !layer.userLocked;
    markDirty(); updateAllUI(); render();
    setStatus(layer.userLocked
      ? `${layer.name} locked: no painting, moving, or deleting until you unlock it.`
      : `${layer.name} unlocked.`);
  }

  function createRasterLayer(name = 'Raster Layer', drawFn) {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    if (drawFn) drawFn(ctx, canvas);
    return { id: uid(), kind: 'raster', name, visible: true, opacity: 1, blend: 'source-over', canvas, mask: null, editMask: false, adjustment: defaultAdjustment() };
  }

  function createBackgroundLayer(color = '#ffffff', options = {}) {
    const background = createRasterLayer('Background');
    background.locked = true;
    background.isBackground = true;
    background.backgroundMode = options.mode || 'color';
    background.backgroundTexture = options.texture || 'wood';
    background.backgroundColor = color;
    background.opacity = 1;
    background.blend = 'source-over';
    background.visible = true;
    return background;
  }

  function createAdjustmentLayer(name = 'Adjustment Layer') {
    return { id: uid(), kind: 'adjustment', name, visible: true, opacity: 1, blend: 'source-over', adjustment: { brightness: 8, contrast: 5, exposure: 0, saturation: 0, hue: 0 } };
  }

  function createTextLayer(text, x, y) {
    return { id: uid(), kind: 'text', name: 'Text: ' + text.slice(0, 18), visible: true, opacity: 1, blend: 'source-over', text, x, y, fontSize: state.fontSize, fontFamily: state.fontFamily || 'Arial', fontWeight: '700', fill: state.brushColor, stroke: state.strokeColor, strokeWidth: state.strokeWidth, adjustment: defaultAdjustment() };
  }

  function createShapeLayer(shape, rect) {
    return { id: uid(), kind: 'shape', name: shape === 'ellipse' ? 'Ellipse' : 'Rectangle', visible: true, opacity: 1, blend: 'source-over', shape, x: rect.x, y: rect.y, w: rect.w, h: rect.h, fill: state.fillColor || state.brushColor, stroke: state.strokeColor, strokeWidth: state.strokeWidth, adjustment: defaultAdjustment() };
  }

  function setStatus(message) { $('statusBar').textContent = message; }
  function markDirty() { state.dirty = true; if (typeof scheduleFrameStripRefresh === 'function') scheduleFrameStripRefresh(); }

  function parseStore(key, fallback = []) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_err) { return fallback; }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { console.warn('Could not update local project library:', err); }
  }

  function getRecentProjects() {
    return parseStore(STORAGE_KEYS.projects, []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function getDeletedProjects() {
    return parseStore(STORAGE_KEYS.deleted, []).sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  }

  function getProjectFolders() {
    return parseStore(STORAGE_KEYS.folders, []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function writeProjectFolders(folders) {
    writeStore(STORAGE_KEYS.folders, folders);
  }

  function getSettings() {
    return parseStore(STORAGE_KEYS.settings, {
      defaultProjectFolder: '',
      defaultImageFolder: '',
      defaultAnimationFolder: ''
    });
  }

  function writeSettings(settings) {
    writeStore(STORAGE_KEYS.settings, { ...getSettings(), ...settings });
  }

  function defaultFolderForKind(kind) {
    const settings = getSettings();
    if (kind === 'project') return settings.defaultProjectFolder || '';
    if (kind === 'animation') return settings.defaultAnimationFolder || '';
    return settings.defaultImageFolder || '';
  }

  function pathJoin(folder, filename) {
    if (!folder) return filename;
    const sep = folder.includes('\\') ? '\\' : '/';
    return folder.endsWith('\\') || folder.endsWith('/') ? folder + filename : folder + sep + filename;
  }

  function safeFileName(name) {
    return String(name || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Untitled';
  }

  function currentFolder() {
    if (!homeState.currentFolderId) return null;
    return getProjectFolders().find((folder) => folder.id === homeState.currentFolderId) || null;
  }

  function folderPath(folderId, folders = getProjectFolders()) {
    if (!folderId) return 'Gallery root';
    const parts = [];
    const seen = new Set();
    let folder = folders.find((item) => item.id === folderId);
    while (folder && !seen.has(folder.id)) {
      seen.add(folder.id);
      parts.unshift(folder.name || 'Untitled folder');
      folder = folders.find((item) => item.id === folder.parentId);
    }
    return parts.length ? parts.join(' / ') : 'Gallery root';
  }

  function folderOptions(includeRoot = true) {
    const folders = getProjectFolders();
    const options = [];
    if (includeRoot) options.push({ id: '', label: 'Gallery root' });
    folders.forEach((folder) => options.push({ id: folder.id, label: folderPath(folder.id, folders) }));
    return options;
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  function formatDate(ms) {
    if (!ms) return 'Unknown date';
    return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function makeProjectThumbnail() {
    const source = renderComposite();
    const maxW = 760;
    const maxH = 480;
    const scale = Math.min(maxW / state.width, maxH / state.height, 1);
    const thumb = document.createElement('canvas');
    thumb.width = Math.max(1, Math.round(state.width * scale));
    thumb.height = Math.max(1, Math.round(state.height * scale));
    const ctx = thumb.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, thumb.width, thumb.height);
    ctx.drawImage(source, 0, 0, thumb.width, thumb.height);
    return thumb.toDataURL('image/jpeg', 0.82);
  }

  function upsertCurrentProject() {
    if (!state.layers.length) return null;
    if (!state.currentProjectId) state.currentProjectId = uid();
    const json = serializeProject();
    const existingProject = getRecentProjects().find((item) => item.id === state.currentProjectId);
    const project = {
      id: state.currentProjectId,
      folderId: existingProject?.folderId || state.projectGalleryFolderId || null,
      name: state.projectName || 'Untitled',
      width: state.width,
      height: state.height,
      layerCount: state.layers.length,
      frameCount: state.frames.length || 1,
      meta: state.projectMeta || {},
      updatedAt: Date.now(),
      size: new Blob([json]).size,
      thumbnail: makeProjectThumbnail(),
      json
    };
    const projects = getRecentProjects().filter((item) => item.id !== project.id);
    projects.unshift(project);
    writeStore(STORAGE_KEYS.projects, projects.slice(0, 30));
    renderHome();
    return project;
  }

  function showHome() {
    stopPlayback();
    editorView.classList.add('hidden');
    homeView.classList.remove('hidden');
    closeHomePanels();
    renderHome();
  }

  function showEditor() {
    homeView.classList.add('hidden');
    editorView.classList.remove('hidden');
    closeHomePanels();
    requestAnimationFrame(() => { updateAllUI(); renderFrameStrip(); render(); });
  }

  function closeHomePanels(exceptId = null) {
    ['projectInfoPanel', 'morePanel', 'sharePanel'].forEach((id) => {
      if (id !== exceptId) $(id).classList.add('hidden');
    });
  }

  function selectedHomeProject() {
    return getRecentProjects().find((project) => project.id === homeState.selectedProjectId) || null;
  }

  function selectionCount() {
    return homeState.selectedProjectIds.size;
  }

  function enterSelectionMode() {
    homeState.selectionMode = true;
    homeState.focused = false;
    homeState.selectedProjectId = null;
    homeState.selectedProjectIds = new Set();
    closeHomePanels();
    renderHome();
  }

  function exitSelectionMode() {
    homeState.selectionMode = false;
    homeState.selectedProjectIds = new Set();
    closeHomePanels();
    renderHome();
  }

  function toggleProjectSelection(projectId) {
    if (homeState.selectedProjectIds.has(projectId)) homeState.selectedProjectIds.delete(projectId);
    else homeState.selectedProjectIds.add(projectId);
    renderHome();
  }

  function openFolder(folderId) {
    homeState.currentFolderId = folderId;
    homeState.focused = false;
    homeState.selectedProjectId = null;
    homeState.selectionMode = false;
    homeState.selectedProjectIds = new Set();
    closeHomePanels();
    renderHome();
  }

  function backHomeGallery() {
    if (homeState.selectionMode) { exitSelectionMode(); return; }
    if (homeState.focused) { setHomeFocus(null); return; }
    if (homeState.currentFolderId) {
      homeState.currentFolderId = null;
      homeState.selectedProjectId = null;
      closeHomePanels();
      renderHome();
    }
  }

  function setHomeFocus(projectId) {
    homeState.selectionMode = false;
    homeState.selectedProjectIds = new Set();
    homeState.selectedProjectId = projectId;
    homeState.focused = Boolean(projectId);
    closeHomePanels();
    renderHome();
  }

  function folderProjectList(folderId, projects = getRecentProjects()) {
    return projects.filter((project) => project.folderId === folderId);
  }

  function renderFolderCard(folder, projects) {
    const folderProjects = folderProjectList(folder.id, projects);
    const totalSize = folderProjects.reduce((sum, project) => sum + (Number(project.size) || 0), 0);
    const card = document.createElement('article');
    card.className = 'project-card folder-card';
    card.addEventListener('click', () => openFolder(folder.id));

    const thumb = document.createElement('div');
    thumb.className = 'project-thumb folder-thumb';
    const previews = folderProjects.slice(0, 4);
    if (previews.length) {
      previews.forEach((project) => {
        const slot = document.createElement('div');
        slot.className = 'folder-preview-slot';
        if (project.thumbnail) {
          const img = document.createElement('img');
          img.src = project.thumbnail;
          img.alt = project.name;
          slot.append(img);
        } else {
          slot.textContent = 'OP';
        }
        thumb.append(slot);
      });
      for (let i = previews.length; i < 4; i += 1) {
        const slot = document.createElement('div');
        slot.className = 'folder-preview-slot empty';
        thumb.append(slot);
      }
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'project-fallback';
      fallback.textContent = 'Folder';
      thumb.append(fallback);
    }

    const info = document.createElement('div');
    info.className = 'project-info';
    info.innerHTML = `<h2>${escapeHtml(folder.name || 'Untitled folder')}</h2><p>${folderProjects.length} project${folderProjects.length === 1 ? '' : 's'} grouped here</p><div class="project-meta"><span>${formatDate(folder.updatedAt || folder.createdAt)}</span><span>${formatBytes(totalSize)}</span></div>`;
    card.append(thumb, info);
    return card;
  }

  function renderProjectCard(project) {
    const isFocused = homeState.focused && project.id === homeState.selectedProjectId;
    const isBulkSelected = homeState.selectedProjectIds.has(project.id);
    const card = document.createElement('article');
    card.className = 'project-card' + (isFocused ? ' selected' : '') + (homeState.selectionMode ? ' choose-mode' : '') + (isBulkSelected ? ' bulk-selected' : '');
    card.addEventListener('click', () => {
      if (homeState.selectionMode) toggleProjectSelection(project.id);
      else setHomeFocus(project.id);
    });

    const thumb = document.createElement('div');
    thumb.className = 'project-thumb';
    if (project.thumbnail) {
      const img = document.createElement('img');
      img.src = project.thumbnail;
      img.alt = project.name;
      thumb.append(img);
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'project-fallback';
      fallback.textContent = 'OP';
      thumb.append(fallback);
    }

    const check = document.createElement('div');
    check.className = 'selection-check';
    check.innerHTML = isBulkSelected ? iconMarkup('check') : '';
    thumb.append(check);

    const info = document.createElement('div');
    info.className = 'project-info';
    info.innerHTML = `<h2>${escapeHtml(project.name || 'Untitled')}</h2><p>${project.width || '?'} × ${project.height || '?'} • ${project.layerCount || 0} layers${project.meta?.category ? ` • ${escapeHtml(project.meta.category)}` : ''}${project.meta?.fps ? ` • ${project.meta.fps} fps` : ''}${project.meta?.dpi ? ` • ${project.meta.dpi} dpi` : ''}</p><div class="project-meta"><span>${formatDate(project.updatedAt)}</span><span>${formatBytes(project.size)}</span></div>`;
    card.append(thumb, info);
    return card;
  }

  function renderHome() {
    if (!homeView || !projectGrid) return;
    const projects = getRecentProjects();
    const folders = getProjectFolders();
    const folder = currentFolder();
    const parentId = folder ? folder.id : null;
    const visibleProjects = projects.filter((project) => (project.folderId || null) === parentId);
    const visibleFolders = homeState.selectionMode ? [] : folders.filter((folderItem) => (folderItem.parentId || null) === parentId);
    const hasItems = visibleProjects.length > 0 || visibleFolders.length > 0;

    projectGrid.innerHTML = '';
    projectGrid.classList.toggle('focused', homeState.focused && Boolean(homeState.selectedProjectId) && !homeState.selectionMode);
    projectGrid.classList.toggle('selection-mode', homeState.selectionMode);
    projectGrid.classList.toggle('folder-view', Boolean(folder));
    $('homeBackBtn').classList.toggle('hidden', !(homeState.focused || homeState.selectionMode || folder));
    $('homeDockDefault').classList.toggle('hidden', homeState.focused || homeState.selectionMode);
    $('selectionActions').classList.toggle('hidden', !homeState.focused || homeState.selectionMode);
    $('bulkActions').classList.toggle('hidden', !homeState.selectionMode);
    $('selectedCountText').textContent = `${selectionCount()} selected`;

    if (homeState.selectionMode) $('homeSubtitle').textContent = folder ? `Choose projects in ${folder.name}` : 'Choose projects';
    else if (homeState.focused) $('homeSubtitle').textContent = 'Project selected';
    else if (folder) $('homeSubtitle').textContent = `Folder: ${folder.name}`;
    else $('homeSubtitle').textContent = 'Recent projects';

    $('chooseProjectBtn').textContent = homeState.focused ? 'Open' : (homeState.selectionMode ? 'Done' : 'Choose');
    $('chooseProjectBtn').disabled = false;

    const empty = $('emptyState');
    empty.classList.toggle('hidden', hasItems);
    if (!hasItems) {
      empty.querySelector('h2').textContent = folder ? 'Folder is empty' : 'No recent projects yet';
      empty.querySelector('p').textContent = folder ? 'Go back and choose another folder, or create a new project.' : 'Create a blank canvas or import an image to begin.';
      updateInfoPanel();
      updateDeletedPanel();
      return;
    }

    visibleFolders.forEach((folderItem) => projectGrid.append(renderFolderCard(folderItem, projects)));
    visibleProjects.forEach((project) => projectGrid.append(renderProjectCard(project)));
    updateInfoPanel();
    updateDeletedPanel();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function requestTextInput(options = {}) {
    const {
      title = 'Input',
      message = '',
      defaultValue = '',
      placeholder = '',
      confirmLabel = 'OK',
      multiline = false
    } = options;

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'input-modal-overlay';
      overlay.innerHTML = `
        <div class="input-modal-card" role="dialog" aria-modal="true">
          <h3>${escapeHtml(title)}</h3>
          ${message ? `<p>${escapeHtml(message)}</p>` : ''}
          <div class="input-modal-field"></div>
          <div class="input-modal-actions">
            <button type="button" class="input-cancel">Cancel</button>
            <button type="button" class="input-confirm primary">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>`;
      const field = overlay.querySelector('.input-modal-field');
      const control = document.createElement(multiline ? 'textarea' : 'input');
      if (!multiline) control.type = 'text';
      control.value = defaultValue;
      control.placeholder = placeholder;
      if (multiline) control.rows = 5;
      field.append(control);
      document.body.append(overlay);

      let closed = false;
      const close = (value) => {
        if (closed) return;
        closed = true;
        overlay.remove();
        resolve(value);
      };
      overlay.querySelector('.input-cancel').addEventListener('click', () => close(null));
      overlay.querySelector('.input-confirm').addEventListener('click', () => close(control.value));
      overlay.addEventListener('pointerdown', (event) => {
        if (event.target === overlay) close(null);
      });
      control.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close(null);
        if (event.key === 'Enter' && !multiline) close(control.value);
        if (event.key === 'Enter' && multiline && (event.ctrlKey || event.metaKey)) close(control.value);
      });
      requestAnimationFrame(() => { control.focus(); control.select(); });
    });
  }

  function showNotice(title, message) {
    const overlay = document.createElement('div');
    overlay.className = 'input-modal-overlay';
    overlay.innerHTML = `
      <div class="input-modal-card" role="dialog" aria-modal="true">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="input-modal-actions">
          <button type="button" class="input-confirm primary">OK</button>
        </div>
      </div>`;
    document.body.append(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.input-confirm').addEventListener('click', close);
    overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) close(); });
  }

  function requestConfirm(title, message, confirmLabel = 'Confirm') {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'input-modal-overlay';
      overlay.innerHTML = `
        <div class="input-modal-card" role="dialog" aria-modal="true">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(message)}</p>
          <div class="input-modal-actions">
            <button type="button" class="input-cancel">Cancel</button>
            <button type="button" class="input-confirm primary">${escapeHtml(confirmLabel)}</button>
          </div>
        </div>`;
      document.body.append(overlay);
      let closed = false;
      const close = (value) => {
        if (closed) return;
        closed = true;
        overlay.remove();
        resolve(value);
      };
      overlay.querySelector('.input-cancel').addEventListener('click', () => close(false));
      overlay.querySelector('.input-confirm').addEventListener('click', () => close(true));
      overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) close(false); });
    });
  }

  function requestNewItemType() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'input-modal-overlay';
      overlay.innerHTML = `
        <div class="input-modal-card create-menu-card" role="dialog" aria-modal="true">
          <h3>Create</h3>
          <p>Choose what you want to add to the gallery.</p>
          <div class="export-choice-grid">
            <button type="button" class="export-choice" data-type="project">
              <strong>New project</strong>
              <span>Create a canvas from templates, custom size, or image dimensions.</span>
            </button>
            <button type="button" class="export-choice" data-type="folder">
              <strong>New folder</strong>
              <span>Create an empty gallery folder and choose where it belongs.</span>
            </button>
          </div>
          <div class="input-modal-actions"><button type="button" class="input-cancel">Cancel</button></div>
        </div>`;
      document.body.append(overlay);
      let closed = false;
      const close = (value) => {
        if (closed) return;
        closed = true;
        overlay.remove();
        resolve(value);
      };
      overlay.querySelector('.input-cancel').addEventListener('click', () => close(null));
      overlay.querySelectorAll('[data-type]').forEach((button) => button.addEventListener('click', () => close(button.dataset.type)));
      overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) close(null); });
    });
  }

  function requestCreateFolderDialog() {
    return new Promise((resolve) => {
      const folders = folderOptions(true);
      const defaultParentId = homeState.currentFolderId || '';
      const overlay = document.createElement('div');
      overlay.className = 'input-modal-overlay';
      overlay.innerHTML = `
        <div class="input-modal-card folder-create-card" role="dialog" aria-modal="true">
          <h3>Create folder</h3>
          <p>Name the folder and choose where it should appear in your gallery.</p>
          <label class="project-name-field">Folder name
            <input id="folderNameInput" type="text" value="New folder" placeholder="Folder name">
          </label>
          <label class="project-name-field">Location
            <select id="folderParentSelect">
              ${folders.map((folder) => `<option value="${escapeHtml(folder.id)}" ${folder.id === defaultParentId ? 'selected' : ''}>${escapeHtml(folder.label)}</option>`).join('')}
            </select>
          </label>
          <div class="input-modal-actions">
            <button type="button" class="input-cancel">Cancel</button>
            <button type="button" class="input-confirm primary">Create folder</button>
          </div>
        </div>`;
      document.body.append(overlay);
      let closed = false;
      const close = (value) => {
        if (closed) return;
        closed = true;
        overlay.remove();
        resolve(value);
      };
      const nameInput = overlay.querySelector('#folderNameInput');
      const select = overlay.querySelector('#folderParentSelect');
      overlay.querySelector('.input-cancel').addEventListener('click', () => close(null));
      overlay.querySelector('.input-confirm').addEventListener('click', () => {
        const name = nameInput.value.trim();
        if (!name) { nameInput.focus(); return; }
        close({ name, parentId: select.value || null });
      });
      nameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') overlay.querySelector('.input-confirm').click();
        if (event.key === 'Escape') close(null);
      });
      overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) close(null); });
      requestAnimationFrame(() => { nameInput.focus(); nameInput.select(); });
    });
  }

  async function createGalleryFolder() {
    const result = await requestCreateFolderDialog();
    if (!result) return;
    const now = Date.now();
    const folder = { id: uid(), name: result.name, parentId: result.parentId || null, createdAt: now, updatedAt: now };
    const folders = getProjectFolders();
    folders.unshift(folder);
    writeProjectFolders(folders);
    homeState.currentFolderId = folder.parentId || null;
    homeState.focused = false;
    homeState.selectionMode = false;
    homeState.selectedProjectId = null;
    homeState.selectedProjectIds = new Set();
    renderHome();
    setStatus(`Created folder ${folder.name} in ${folderPath(folder.parentId)}.`);
  }

  async function openCreateMenu() {
    const type = await requestNewItemType();
    if (type === 'project') await startNewProjectFlow({ addRecent: true, folderId: homeState.currentFolderId || null });
    if (type === 'folder') await createGalleryFolder();
  }

  function labelForSaveKind(kind) {
    if (kind === 'project') return 'Project files';
    if (kind === 'animation') return 'Animation exports';
    return 'Image exports';
  }

  async function chooseDefaultFolderForKind(kind) {
    if (!window.exArtboothAPI || !window.exArtboothAPI.chooseFolder) {
      showNotice('Default folders unavailable', 'Default save folders are available in the Windows app build, not the browser preview.');
      return null;
    }
    const result = await window.exArtboothAPI.chooseFolder();
    if (!result || !result.path) return null;
    if (kind === 'project') writeSettings({ defaultProjectFolder: result.path });
    else if (kind === 'animation') writeSettings({ defaultAnimationFolder: result.path });
    else writeSettings({ defaultImageFolder: result.path });
    return result.path;
  }

  function requestSaveDestination(kind) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'input-modal-overlay';
      const title = `${labelForSaveKind(kind)} default folder`;
      const renderPath = (folder) => folder ? escapeHtml(folder) : 'No default folder set. The save dialog will choose the location.';
      overlay.innerHTML = `
        <div class="input-modal-card save-destination-card" role="dialog" aria-modal="true">
          <h3>${escapeHtml(title)}</h3>
          <p>Choose where this type should end up by default. You can still change the filename in the save dialog.</p>
          <div class="destination-path" id="destinationPathText">${renderPath(defaultFolderForKind(kind))}</div>
          <div class="input-modal-actions split-actions">
            <button type="button" class="change-folder-btn">Change default folder</button>
            <span class="action-spacer"></span>
            <button type="button" class="input-cancel">Cancel</button>
            <button type="button" class="input-confirm primary">Continue</button>
          </div>
        </div>`;
      document.body.append(overlay);
      let closed = false;
      const close = (value) => {
        if (closed) return;
        closed = true;
        overlay.remove();
        resolve(value);
      };
      overlay.querySelector('.change-folder-btn').addEventListener('click', async () => {
        const folder = await chooseDefaultFolderForKind(kind);
        if (folder) overlay.querySelector('#destinationPathText').textContent = folder;
      });
      overlay.querySelector('.input-cancel').addEventListener('click', () => close(null));
      overlay.querySelector('.input-confirm').addEventListener('click', () => close(defaultFolderForKind(kind)));
      overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) close(null); });
    });
  }

  function requestPngExportMode() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'input-modal-overlay';
      overlay.innerHTML = `
        <div class="input-modal-card png-export-card" role="dialog" aria-modal="true">
          <h3>Export PNG</h3>
          <p>Choose whether the locked project background should be included in the exported PNG.</p>
          <div class="export-choice-grid">
            <button type="button" class="export-choice" data-mode="solid">
              <strong>Solid background</strong>
              <span>Export normally with the project background filled.</span>
            </button>
            <button type="button" class="export-choice" data-mode="transparent">
              <strong>Transparent background</strong>
              <span>Hide the background only in the exported PNG.</span>
            </button>
          </div>
          <div class="input-modal-actions">
            <button type="button" class="input-cancel">Cancel</button>
          </div>
        </div>`;
      document.body.append(overlay);
      let closed = false;
      const close = (value) => {
        if (closed) return;
        closed = true;
        overlay.remove();
        resolve(value);
      };
      overlay.querySelector('.input-cancel').addEventListener('click', () => close(null));
      overlay.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => close(button.dataset.mode)));
      overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) close(null); });
    });
  }

  function openNewProjectDialog() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'new-project-overlay';

      const categories = Object.keys(TEMPLATE_LIBRARY);
      let activeCategory = 'illustration';
      let selectedItemId = TEMPLATE_LIBRARY.illustration.items[0].id;
      let openSizeMenuId = null;
      const chosenOptionIndex = {};
      const customValues = {
        width: 1280,
        height: 720,
        dpi: 300,
        fps: 24
      };

      const categoryLabel = (key) => TEMPLATE_LIBRARY[key]?.label || key;
      const itemsForCategory = () => TEMPLATE_LIBRARY[activeCategory].items;
      const selectedItem = () => itemsForCategory().find((item) => item.id === selectedItemId) || itemsForCategory()[0];
      const selectedOptionFor = (item) => {
        if (!item || item.type !== 'options') return null;
        const index = chosenOptionIndex[item.id] ?? item.defaultIndex ?? 0;
        return item.options[Math.max(0, Math.min(item.options.length - 1, index))];
      };
      const currentSizeFor = (item) => {
        if (!item) return { width: 1280, height: 720 };
        if (item.type === 'options') return selectedOptionFor(item);
        if (item.type === 'custom') return {
          width: Number(customValues.width) || item.width || 1280,
          height: Number(customValues.height) || item.height || 720,
          dpi: activeCategory === 'printable' ? (Number(customValues.dpi) || 300) : item.dpi,
          fps: activeCategory === 'animation' ? (Number(customValues.fps) || 24) : item.fps
        };
        return item;
      };
      const clampFps = (value) => {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0.001) return 24;
        return Number(Math.min(1000, n).toFixed(3));
      };
      const clampInt = (value, min, max, fallback) => {
        const n = Math.round(Number(value));
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
      };
      const close = (value) => {
        overlay.remove();
        resolve(value);
      };
      const updatePreviewOnly = () => {
        const item = selectedItem();
        const size = currentSizeFor(item);
        const category = TEMPLATE_LIBRARY[activeCategory];
        const summary = overlay.querySelector('.new-project-summary');
        if (!summary) return;
        const option = selectedOptionFor(item);
        const extra = [];
        if (activeCategory === 'printable' && size.dpi) extra.push(`${size.dpi} dpi`);
        if (activeCategory === 'animation') extra.push(`${clampFps(size.fps ?? customValues.fps)} fps`);
        summary.innerHTML = `
          <div class="summary-preview-box" style="--ratio:${Math.max(0.08, Math.min(4, size.width / Math.max(1, size.height)))}"></div>
          <dl>
            <div><dt>Type</dt><dd>${escapeHtml(category.label)}</dd></div>
            <div><dt>Template</dt><dd>${escapeHtml(item.name)}</dd></div>
            <div><dt>Size</dt><dd>${size.width} × ${size.height} px</dd></div>
            ${option ? `<div><dt>Quality</dt><dd>${escapeHtml(option.label)}</dd></div>` : ''}
            ${extra.map((value) => `<div><dt>${value.includes('fps') ? 'FPS' : 'DPI'}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
          </dl>`;
      };
      const buildCard = (item) => {
        const size = currentSizeFor(item);
        const option = selectedOptionFor(item);
        const selected = item.id === selectedItemId;
        const fixedText = item.type === 'fixed' ? 'Fixed' : (item.type === 'custom' ? 'Editable' : option.label);
        const sizeButton = item.type === 'options'
          ? `<button type="button" class="size-toggle" data-toggle-size="${item.id}">${size.width} × ${size.height} ${iconMarkup(openSizeMenuId === item.id ? 'chevron-u' : 'chevron-d')}</button>`
          : `<span class="size-fixed">${size.width} × ${size.height}</span>`;
        const optionMenu = item.type === 'options' && openSizeMenuId === item.id
          ? `<div class="size-menu">${item.options.map((opt, index) => `<button type="button" class="size-choice ${index === (chosenOptionIndex[item.id] ?? item.defaultIndex ?? 0) ? 'chosen' : ''}" data-size-item="${item.id}" data-size-index="${index}"><span>${escapeHtml(opt.label)}</span><strong>${opt.width} × ${opt.height}</strong>${opt.dpi ? `<em>${opt.dpi} dpi</em>` : ''}</button>`).join('')}</div>`
          : '';
        const customFields = item.type === 'custom' && selected
          ? `<div class="custom-size-grid">
              <label>Width <input class="custom-width" type="number" min="1" max="12000" value="${size.width}"></label>
              <label>Height <input class="custom-height" type="number" min="1" max="12000" value="${size.height}"></label>
              ${activeCategory === 'printable' ? `<label>DPI <input class="custom-dpi" type="number" min="1" max="1200" value="${size.dpi || 300}"></label>` : ''}
            </div>`
          : '';
        return `<article class="template-card ${selected ? 'selected' : ''}" data-template-id="${item.id}">
          <div class="template-card-main">
            <div>
              <h4>${escapeHtml(item.name)}</h4>
              <p>${escapeHtml(item.detail || `${fixedText} canvas preset`)}</p>
            </div>
            <div class="template-size-area">${sizeButton}</div>
          </div>
          ${optionMenu}
          ${customFields}
        </article>`;
      };
      const renderDialog = () => {
        const category = TEMPLATE_LIBRARY[activeCategory];
        const item = selectedItem();
        overlay.innerHTML = `
          <div class="new-project-card" role="dialog" aria-modal="true">
            <header class="new-project-header">
              <div>
                <h2>Create new project</h2>
                <p>Choose a template, custom canvas, or import an image using the image dimensions.</p>
              </div>
              <button type="button" class="modal-close new-project-close" title="Close">${iconMarkup('close')}</button>
            </header>
            <div class="new-project-body">
              <nav class="template-tabs">
                ${categories.map((key) => `<button type="button" class="template-tab ${key === activeCategory ? 'active' : ''}" data-category="${key}">${escapeHtml(categoryLabel(key))}</button>`).join('')}
                <button type="button" class="template-tab import-tab" data-import-image="1">Import image</button>
              </nav>
              <section class="template-picker">
                <div class="template-picker-title">
                  <div>
                    <h3>${escapeHtml(category.label)}</h3>
                    <p>${escapeHtml(category.description)}</p>
                  </div>
                </div>
                <div class="template-list-modal">
                  ${category.items.map(buildCard).join('')}
                </div>
              </section>
              <aside class="new-project-sidebar">
                <h3>Project setup</h3>
                <label class="project-name-field">Project name
                  <input id="newProjectNameInput" type="text" value="${escapeHtml(`${category.label} - ${item.name}`)}">
                </label>
                ${activeCategory === 'animation' ? `<label class="project-name-field">FPS
                  <input id="newProjectFpsInput" type="number" min="0.001" max="1000" step="0.001" value="${clampFps(currentSizeFor(item).fps ?? customValues.fps)}">
                  <span id="newProjectFpsText" class="hint small">Type any frame rate from 0.001 fps upward. ${clampFps(currentSizeFor(item).fps ?? customValues.fps)} fps = ${Number((1 / clampFps(currentSizeFor(item).fps ?? customValues.fps)).toFixed(3))} s per frame.</span>
                </label>` : ''}
                <div class="new-project-summary"></div>
                <div class="new-project-actions">
                  <button type="button" class="input-cancel">Cancel</button>
                  <button type="button" class="primary create-template-project">Create</button>
                </div>
              </aside>
            </div>
          </div>`;

        overlay.querySelector('.new-project-close').addEventListener('click', () => close(null));
        overlay.querySelector('.input-cancel').addEventListener('click', () => close(null));
        overlay.querySelector('[data-import-image]').addEventListener('click', () => close({ mode: 'import-image' }));
        overlay.querySelectorAll('[data-category]').forEach((button) => {
          button.addEventListener('click', () => {
            activeCategory = button.dataset.category;
            selectedItemId = TEMPLATE_LIBRARY[activeCategory].items[0].id;
            openSizeMenuId = null;
            renderDialog();
          });
        });
        overlay.querySelectorAll('[data-template-id]').forEach((card) => {
          card.addEventListener('click', () => {
            selectedItemId = card.dataset.templateId;
            renderDialog();
          });
        });
        overlay.querySelectorAll('[data-toggle-size]').forEach((button) => {
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            selectedItemId = button.dataset.toggleSize;
            openSizeMenuId = openSizeMenuId === button.dataset.toggleSize ? null : button.dataset.toggleSize;
            renderDialog();
          });
        });
        overlay.querySelectorAll('[data-size-item]').forEach((button) => {
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            chosenOptionIndex[button.dataset.sizeItem] = Number(button.dataset.sizeIndex);
            selectedItemId = button.dataset.sizeItem;
            openSizeMenuId = null;
            renderDialog();
          });
        });
        overlay.querySelectorAll('.custom-size-grid input').forEach((input) => {
          input.addEventListener('pointerdown', (event) => event.stopPropagation());
          input.addEventListener('click', (event) => event.stopPropagation());
        });
        const widthInput = overlay.querySelector('.custom-width');
        const heightInput = overlay.querySelector('.custom-height');
        const dpiInput = overlay.querySelector('.custom-dpi');
        if (widthInput) widthInput.addEventListener('input', () => { customValues.width = clampInt(widthInput.value, 1, 12000, 1280); updatePreviewOnly(); });
        if (heightInput) heightInput.addEventListener('input', () => { customValues.height = clampInt(heightInput.value, 1, 12000, 720); updatePreviewOnly(); });
        if (dpiInput) dpiInput.addEventListener('input', () => { customValues.dpi = clampInt(dpiInput.value, 1, 1200, 300); updatePreviewOnly(); });
        const fpsInput = overlay.querySelector('#newProjectFpsInput');
        if (fpsInput) fpsInput.addEventListener('input', () => {
          customValues.fps = clampFps(fpsInput.value);
          const fpsText = overlay.querySelector('#newProjectFpsText');
          if (fpsText) fpsText.textContent = `Type any frame rate from 0.001 fps upward. ${customValues.fps} fps = ${Number((1 / customValues.fps).toFixed(3))} s per frame.`;
          updatePreviewOnly();
        });
        overlay.querySelector('.create-template-project').addEventListener('click', () => {
          const itemNow = selectedItem();
          const size = currentSizeFor(itemNow);
          const width = clampInt(size.width, 1, 12000, 1280);
          const height = clampInt(size.height, 1, 12000, 720);
          const fps = activeCategory === 'animation' ? clampFps(customValues.fps) : undefined;
          const dpi = activeCategory === 'printable' ? clampInt(size.dpi || customValues.dpi, 1, 1200, 300) : undefined;
          const projectName = overlay.querySelector('#newProjectNameInput')?.value?.trim() || `${category.label} - ${itemNow.name}`;
          close({
            mode: 'template',
            width,
            height,
            name: projectName,
            meta: {
              source: 'template',
              kind: activeCategory,
              category: category.label,
              template: itemNow.name,
              option: selectedOptionFor(itemNow)?.label || (itemNow.type === 'fixed' ? 'Fixed' : 'Custom'),
              dpi,
              fps
            }
          });
        });
        updatePreviewOnly();
      };

      overlay.addEventListener('pointerdown', (event) => {
        if (event.target === overlay) close(null);
      });
      document.body.append(overlay);
      renderDialog();
    });
  }

  async function startNewProjectFlow(options = {}) {
    const result = await openNewProjectDialog();
    if (!result) return;
    if (result.mode === 'import-image') {
      state.projectGalleryFolderId = options.folderId || homeState.currentFolderId || null;
      await openImage('replace');
      return;
    }
    initDocument(result.width, result.height, {
      addRecent: options.addRecent !== false,
      showEditor: true,
      name: result.name || 'Untitled',
      meta: result.meta || {},
      folderId: options.folderId || homeState.currentFolderId || null
    });
  }

  function updateInfoPanel() {
    const projects = getRecentProjects();
    const totalSize = projects.reduce((sum, project) => sum + (Number(project.size) || 0), 0);
    $('totalProjectsText').textContent = String(projects.length);
    $('totalProjectSizeText').textContent = formatBytes(totalSize);
  }

  function updateDeletedPanel() {
    const deleted = getDeletedProjects();
    const list = $('deletedList');
    if (!list) return;
    list.innerHTML = deleted.length ? deleted.map((project) => `<div>${escapeHtml(project.name || 'Untitled')} <span>${formatDate(project.deletedAt)}</span></div>`).join('') : 'No recently deleted projects.';
  }

  async function handleChooseButton() {
    if (homeState.focused) {
      await chooseSelectedProject();
      return;
    }
    if (homeState.selectionMode) exitSelectionMode();
    else enterSelectionMode();
  }

  async function chooseSelectedProject() {
    const project = selectedHomeProject();
    if (!project) {
      showNotice('No project selected', 'Click a project first, or use Choose mode to select multiple projects.');
      return;
    }
    await loadProjectText(project.json, { updateRecent: false, renderView: true, projectId: project.id, folderId: project.folderId || null });
    showEditor();
  }

  async function groupSelectedProjects() {
    const ids = [...homeState.selectedProjectIds];
    if (!ids.length) {
      showNotice('No projects selected', 'Choose one or more projects before creating a folder.');
      return;
    }
    const folderName = await requestTextInput({
      title: 'Group into folder',
      message: `Create a folder for ${ids.length} selected project${ids.length === 1 ? '' : 's'}.`,
      defaultValue: 'New folder',
      placeholder: 'Folder name',
      confirmLabel: 'Create folder'
    });
    if (!folderName || !folderName.trim()) return;
    const now = Date.now();
    const folder = { id: uid(), name: folderName.trim(), parentId: homeState.currentFolderId || null, createdAt: now, updatedAt: now };
    const idSet = new Set(ids);
    const projects = getRecentProjects().map((project) => idSet.has(project.id) ? { ...project, folderId: folder.id, updatedAt: now } : project);
    const folders = getProjectFolders().filter((item) => item.id !== folder.id);
    folders.unshift(folder);
    writeStore(STORAGE_KEYS.projects, projects);
    writeProjectFolders(folders);
    homeState.selectedProjectIds = new Set();
    homeState.selectionMode = false;
    homeState.focused = false;
    homeState.selectedProjectId = null;
    homeState.currentFolderId = folder.id;
    renderHome();
    setStatus(`Grouped ${ids.length} project${ids.length === 1 ? '' : 's'} into ${folder.name}.`);
  }

  async function bulkDeleteSelectedProjects() {
    const ids = [...homeState.selectedProjectIds];
    if (!ids.length) {
      showNotice('No projects selected', 'Choose one or more projects before deleting.');
      return;
    }
    const ok = await requestConfirm('Delete selected projects?', `Move ${ids.length} selected project${ids.length === 1 ? '' : 's'} to Recently Deleted.`, 'Delete');
    if (!ok) return;
    const idSet = new Set(ids);
    const now = Date.now();
    const projects = getRecentProjects();
    const deleted = projects.filter((project) => idSet.has(project.id)).map((project) => ({ ...project, deletedAt: now }));
    const remaining = projects.filter((project) => !idSet.has(project.id));
    const deletedStore = [...deleted, ...getDeletedProjects()].slice(0, 80);
    const remainingFolderIds = new Set(remaining.map((project) => project.folderId).filter(Boolean));
    const folders = getProjectFolders().filter((folder) => remainingFolderIds.has(folder.id));
    writeStore(STORAGE_KEYS.projects, remaining);
    writeStore(STORAGE_KEYS.deleted, deletedStore);
    writeProjectFolders(folders);
    if (homeState.currentFolderId && !remainingFolderIds.has(homeState.currentFolderId)) homeState.currentFolderId = null;
    homeState.selectedProjectIds = new Set();
    homeState.selectionMode = false;
    homeState.focused = false;
    homeState.selectedProjectId = null;
    renderHome();
    setStatus(`Moved ${deleted.length} project${deleted.length === 1 ? '' : 's'} to Recently Deleted.`);
  }

  async function createBlankFromHome() {
    await startNewProjectFlow({ addRecent: true });
  }

  async function exportSelectedHomeProject(type) {
    const project = selectedHomeProject();
    if (!project) return;
    await loadProjectText(project.json, { updateRecent: false, renderView: false, projectId: project.id, folderId: project.folderId || null });
    await saveImage(type);
    showHome();
    setHomeFocus(project.id);
  }

  function showUnsupportedExport(label) {
    showNotice(`${label} export`, `${label} export is planned for the next milestone. PNG and JPEG export work now.`);
  }

  async function prepareAnimationExport() {
    const folder = await requestSaveDestination('animation');
    if (folder === null) return;
    showUnsupportedExport('MP4 timeline');
  }

  async function playSelectedReplay() {
    const project = selectedHomeProject();
    if (!project) return;
    const modal = $('replayModal');
    const canvas = $('replayCanvas');
    const ctx = canvas.getContext('2d');
    const progress = $('timelineProgress');
    const caption = $('replayCaption');
    modal.classList.remove('hidden');
    progress.style.width = '0%';
    caption.textContent = `Replaying ${project.name || 'Untitled'}...`;
    const img = project.thumbnail ? await dataUrlToImage(project.thumbnail) : null;
    const started = performance.now();
    const duration = 3200;
    cancelAnimationFrame(homeState.replayAnimation);
    const draw = (now) => {
      const t = Math.min(1, (now - started) / duration);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#090b10';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255,255,255,.035)';
      for (let x = 0; x < canvas.width; x += 36) ctx.fillRect(x, 0, 1, canvas.height);
      for (let y = 0; y < canvas.height; y += 36) ctx.fillRect(0, y, canvas.width, 1);
      if (img) {
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.92;
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w * easeOutCubic(t), h);
        ctx.clip();
        ctx.drawImage(img, x, y, w, h);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,.2)';
        ctx.strokeRect(x, y, w, h);
      }
      ctx.fillStyle = '#f4f7fb';
      ctx.font = '700 24px Inter, Segoe UI, sans-serif';
      ctx.fillText(project.name || 'Untitled', 34, 48);
      ctx.fillStyle = 'rgba(244,247,251,.62)';
      ctx.font = '14px Inter, Segoe UI, sans-serif';
      ctx.fillText(`${project.layerCount || 0} layers • ${project.width} × ${project.height}`, 34, 74);
      progress.style.width = `${Math.round(t * 100)}%`;
      if (t < 1 && !modal.classList.contains('hidden')) homeState.replayAnimation = requestAnimationFrame(draw);
      else caption.textContent = 'Replay complete. Full edit-history recording will be added in a future build.';
    };
    homeState.replayAnimation = requestAnimationFrame(draw);
  }

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function initDocument(w = 1280, h = 720, options = {}) {
    resetHistory();
    state.width = Math.max(1, Math.round(w));
    state.height = Math.max(1, Math.round(h));
    const bg = createBackgroundLayer('#ffffff');
    const paintLayer = createRasterLayer('Layer 1');
    state.layers = [bg, paintLayer];
    resetFrames(state.layers);
    state.selectedLayerId = paintLayer.id;
    state.projectName = options.name || 'Untitled';
    state.currentProjectId = options.projectId || uid();
    state.projectMeta = options.meta || { source: 'blank', category: 'Custom', template: 'Blank', option: 'Custom' };
    state.projectGalleryFolderId = options.folderId || null;
    state.cropRect = null;
    state.view.zoom = 1;
    resetViewPan();
    state.dirty = false;
    updateAllUI(); renderFrameStrip(); render(); setStatus('New document created.');
    if (options.addRecent) upsertCurrentProject();
    if (options.showEditor) showEditor();
  }

  function ensureViewportSize() {
    const rect = canvasArea.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (viewport.width !== w || viewport.height !== h) { viewport.width = w; viewport.height = h; }
  }

  function computeViewTransform() {
    const margin = 42;
    const scaleX = (viewport.width - margin * 2) / state.width;
    const scaleY = (viewport.height - margin * 2) / state.height;
    const fitScale = Math.max(0.02, Math.min(scaleX, scaleY));
    state.view.scale = fitScale * state.view.zoom;
    state.view.panX = Number(state.view.panX) || 0;
    state.view.panY = Number(state.view.panY) || 0;
    state.view.offsetX = (viewport.width - state.width * state.view.scale) / 2 + state.view.panX;
    state.view.offsetY = (viewport.height - state.height * state.view.scale) / 2 + state.view.panY;
  }

  function resetViewPan() {
    state.view.panX = 0;
    state.view.panY = 0;
  }

  function fitView() {
    state.view.zoom = 1;
    resetViewPan();
    render();
  }

  function viewportPointFromClient(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function zoomAt(clientX, clientY, factor) {
    ensureViewportSize();
    computeViewTransform();
    const before = screenToImage(clientX, clientY);
    const screen = viewportPointFromClient(clientX, clientY);
    state.view.zoom = Math.max(0.05, Math.min(16, state.view.zoom * factor));
    computeViewTransform();
    const baseX = (viewport.width - state.width * state.view.scale) / 2;
    const baseY = (viewport.height - state.height * state.view.scale) / 2;
    state.view.panX = screen.x - baseX - before.x * state.view.scale;
    state.view.panY = screen.y - baseY - before.y * state.view.scale;
    render();
  }

  function panView(dx, dy) {
    state.view.panX = (Number(state.view.panX) || 0) + dx;
    state.view.panY = (Number(state.view.panY) || 0) + dy;
    render();
  }

  function startViewPan(event) {
    viewport.setPointerCapture(event.pointerId);
    state.isViewPanning = true;
    state.isPointerDown = false;
    state.viewPanSession = {
      x: event.clientX,
      y: event.clientY,
      panX: Number(state.view.panX) || 0,
      panY: Number(state.view.panY) || 0
    };
    viewport.classList.add('panning');
    viewport.classList.add('pan-tool');
    setStatus('Panning the view. Scroll to pan, Ctrl+scroll to zoom.');
  }

  function updateViewPan(event) {
    if (!state.isViewPanning || !state.viewPanSession) return;
    const session = state.viewPanSession;
    state.view.panX = session.panX + (event.clientX - session.x);
    state.view.panY = session.panY + (event.clientY - session.y);
    render();
  }

  function stopViewPan() {
    if (!state.isViewPanning) return;
    state.isViewPanning = false;
    state.viewPanSession = null;
    viewport.classList.remove('panning');
    viewport.classList.remove('pan-tool');
    setStatus('View moved. Scroll to pan, Ctrl+scroll to zoom.');
  }

  function imageToScreen(point) { return { x: state.view.offsetX + point.x * state.view.scale, y: state.view.offsetY + point.y * state.view.scale }; }
  function screenToImage(clientX, clientY) {
    const rect = viewport.getBoundingClientRect();
    return { x: (clientX - rect.left - state.view.offsetX) / state.view.scale, y: (clientY - rect.top - state.view.offsetY) / state.view.scale };
  }
  function isInsideImage(point) { return point && point.x >= 0 && point.y >= 0 && point.x <= state.width && point.y <= state.height; }
  function normalizeRect(start, end) { return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y) }; }
  function clampRectToCanvas(rect) {
    const x1 = Math.max(0, Math.min(state.width, rect.x));
    const y1 = Math.max(0, Math.min(state.height, rect.y));
    const x2 = Math.max(0, Math.min(state.width, rect.x + rect.w));
    const y2 = Math.max(0, Math.min(state.height, rect.y + rect.h));
    return { x: Math.round(Math.min(x1, x2)), y: Math.round(Math.min(y1, y2)), w: Math.round(Math.abs(x2 - x1)), h: Math.round(Math.abs(y2 - y1)) };
  }

  function drawChecker(ctx, x, y, w, h, size = 18, colors = { a: '#b5bdca', b: '#e6e9ef' }) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = colors.b; ctx.fillRect(x, y, w, h);
    for (let yy = y; yy < y + h; yy += size) {
      for (let xx = x; xx < x + w; xx += size) {
        const on = (Math.floor((xx - x) / size) + Math.floor((yy - y) / size)) % 2 === 0;
        ctx.fillStyle = on ? colors.a : colors.b; ctx.fillRect(xx, yy, size, size);
      }
    }
    ctx.restore();
  }

  function drawLayerToContext(layer, ctx) {
    ctx.clearRect(0, 0, state.width, state.height);
    if (layer.kind === 'raster') {
      ctx.drawImage(layer.canvas, 0, 0);
    } else if (layer.kind === 'text') {
      ctx.save(); ctx.textBaseline = 'top'; ctx.fillStyle = layer.fill; ctx.strokeStyle = layer.stroke || '#fff'; ctx.lineWidth = Number(layer.strokeWidth) || 0; ctx.lineJoin = 'round';
      ctx.font = `${layer.fontWeight || '700'} ${layer.fontSize || 56}px ${layer.fontFamily || 'Arial'}`;
      const lines = String(layer.text || '').split('\n');
      const lineHeight = (Number(layer.fontSize) || 56) * 1.15;
      lines.forEach((line, index) => { const yy = layer.y + index * lineHeight; if (layer.strokeWidth > 0) ctx.strokeText(line, layer.x, yy); ctx.fillText(line, layer.x, yy); });
      ctx.restore();
    } else if (layer.kind === 'shape') {
      ctx.save(); ctx.fillStyle = layer.fill || '#2fe6a6'; ctx.strokeStyle = layer.stroke || '#fff'; ctx.lineWidth = Number(layer.strokeWidth) || 0;
      ctx.beginPath();
      if (layer.shape === 'ellipse') ctx.ellipse(layer.x + layer.w / 2, layer.y + layer.h / 2, Math.abs(layer.w / 2), Math.abs(layer.h / 2), 0, 0, Math.PI * 2);
      else ctx.rect(layer.x, layer.y, layer.w, layer.h);
      ctx.fill(); if (layer.strokeWidth > 0) ctx.stroke(); ctx.restore();
    }
  }

  function hasAdjustment(adj) { return adj && (adj.brightness || adj.contrast || adj.exposure || adj.saturation || adj.hue); }
  function applyMask(tmp, mask) { if (!mask) return; const ctx = tmp.getContext('2d'); ctx.save(); ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(mask, 0, 0); ctx.restore(); }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    if (s === 0) return [l * 255, l * 255, l * 255];
    const hue2rgb = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
  }

  function applyAdjustmentToCanvas(canvas, adj, strength = 1) {
    if (!hasAdjustment(adj) || strength <= 0) return;
    const ctx = canvas.getContext('2d');
    let imageData;
    try { imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch (_err) { return; }
    const data = imageData.data;
    const brightness = Number(adj.brightness || 0) * 2.55;
    const contrastValue = Number(adj.contrast || 0) * 2.55;
    const contrastFactor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));
    const exposureFactor = Math.pow(2, Number(adj.exposure || 0) / 100);
    const saturation = 1 + Number(adj.saturation || 0) / 100;
    const hue = Number(adj.hue || 0) / 360;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const oldR = data[i], oldG = data[i + 1], oldB = data[i + 2];
      let r = oldR * exposureFactor + brightness;
      let g = oldG * exposureFactor + brightness;
      let b = oldB * exposureFactor + brightness;
      r = contrastFactor * (r - 128) + 128; g = contrastFactor * (g - 128) + 128; b = contrastFactor * (b - 128) + 128;
      if (saturation !== 1 || hue !== 0) {
        let [hh, ss, ll] = rgbToHsl(clamp255(r), clamp255(g), clamp255(b));
        hh = (hh + hue + 1) % 1; ss = clamp01(ss * saturation); [r, g, b] = hslToRgb(hh, ss, ll);
      }
      data[i] = clamp255(oldR + (r - oldR) * strength);
      data[i + 1] = clamp255(oldG + (g - oldG) * strength);
      data[i + 2] = clamp255(oldB + (b - oldB) * strength);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  function renderComposite(options = {}) {
    const includeBackground = options.includeBackground !== false;
    const layers = Array.isArray(options.layers) ? options.layers : state.layers;
    const compositeCanvas = options.target || defaultCompositeCanvas;
    compositeCanvas.width = state.width;
    compositeCanvas.height = state.height;
    const compCtx = compositeCanvas.getContext('2d');
    compCtx.setTransform(1, 0, 0, 1, 0, 0);
    compCtx.clearRect(0, 0, state.width, state.height);
    scratchCanvas.width = state.width;
    scratchCanvas.height = state.height;
    const scratchCtx = scratchCanvas.getContext('2d');

    let clipBase = null;
    for (const layer of layers) {
      if (isBackgroundLayer(layer)) {
        if (!includeBackground) continue;
        const painted = paintBackground(scratchCtx, layer);
        if (!painted) { scratchCtx.clearRect(0, 0, state.width, state.height); continue; }
        compCtx.save();
        compCtx.globalAlpha = 1;
        compCtx.globalCompositeOperation = 'source-over';
        compCtx.drawImage(scratchCanvas, 0, 0);
        compCtx.restore();
        scratchCtx.clearRect(0, 0, state.width, state.height);
        continue;
      }

      if (!layer.visible) continue;
      if (layer.kind === 'adjustment') { applyAdjustmentToCanvas(compositeCanvas, layer.adjustment, layer.opacity); clipBase = null; continue; }
      drawLayerToContext(layer, scratchCtx);
      if (hasAdjustment(layer.adjustment)) applyAdjustmentToCanvas(scratchCanvas, layer.adjustment, 1);
      if (layer.mask) applyMask(scratchCanvas, layer.mask);
      if (layer.clipped && clipBase) applyMask(scratchCanvas, clipBase);
      if (!layer.clipped) { clipBase = cloneCanvas(scratchCanvas); }
      compCtx.save(); compCtx.globalAlpha = layer.opacity; compCtx.globalCompositeOperation = layer.blend || 'source-over';
      try { compCtx.drawImage(scratchCanvas, 0, 0); } catch (_err) { compCtx.globalCompositeOperation = 'source-over'; compCtx.drawImage(scratchCanvas, 0, 0); }
      compCtx.restore(); scratchCtx.clearRect(0, 0, state.width, state.height);
    }
    return compositeCanvas;
  }

  function hexToRgba(hex, alpha) {
    const clean = String(hex || '#2fe6a6').replace('#', '');
    const n = parseInt(clean.length === 3 ? clean.split('').map((x) => x + x).join('') : clean, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }






  /* ---------------- Undo / redo ---------------- */

  // Snapshots are copy-on-write: a step clones only the layers the next command
  // is about to change. Untouched layers are held by reference, which is safe
  // because any later edit to them pushes its own step first, and steps are
  // always undone newest first.
  const history = {
    past: [],
    future: [],
    limit: 40,
    budget: 192 * 1024 * 1024,
    bytes: 0,
    suspended: false,
  };

  function canvasBytes(canvas) {
    return canvas ? canvas.width * canvas.height * 4 : 0;
  }

  function layerSnapshot(layer, clonePixels) {
    const meta = {};
    Object.keys(layer).forEach((key) => {
      if (key === 'canvas' || key === 'mask' || key === 'clipBase') return;
      const value = layer[key];
      meta[key] = value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
    });
    return {
      id: layer.id,
      meta,
      canvas: clonePixels && layer.canvas ? cloneCanvas(layer.canvas) : null,
      mask: clonePixels && layer.mask ? cloneCanvas(layer.mask) : null,
      liveCanvas: layer.canvas || null,
      liveMask: layer.mask || null,
    };
  }

  // `touched` is 'all', or a list of layer ids whose pixels will change.
  function captureState(label, touched) {
    const all = touched === 'all';
    const set = all ? null : new Set(touched || []);
    const layers = state.layers.map((layer) => layerSnapshot(layer, all || (set && set.has(layer.id))));
    let bytes = 0;
    layers.forEach((entry) => { bytes += canvasBytes(entry.canvas) + canvasBytes(entry.mask); });
    return {
      label,
      bytes,
      width: state.width,
      height: state.height,
      frameIndex: state.frameIndex,
      selectedLayerId: state.selectedLayerId,
      frames: state.frames.map((frame) => ({ frame, layers: frame.layers })),
      layers,
    };
  }

  function restoreState(snapshot) {
    state.width = snapshot.width;
    state.height = snapshot.height;
    if (snapshot.frames.length) {
      state.frames = snapshot.frames.map((entry) => {
        entry.frame.layers = entry.layers;
        return entry.frame;
      });
      state.frameIndex = Math.max(0, Math.min(state.frames.length - 1, snapshot.frameIndex));
    }
    const layers = snapshot.layers.map((entry) => {
      const layer = { ...entry.meta };
      let canvas = entry.liveCanvas;
      let mask = entry.liveMask;
      if (entry.region) {
        // A stroke only changed a rectangle, so paint that rectangle back into
        // the canvas as it stands NOW. Restoring replaces canvas objects, so the
        // surface captured alongside the snapshot may already be detached; a
        // region patch is a delta and must apply to the live surface.
        const current = state.layers.find((layer) => layer.id === entry.id);
        const baseCanvas = (current && current.canvas) || canvas;
        const baseMask = (current && current.mask) || mask;
        if (baseCanvas && entry.canvas) canvas = patchRegion(baseCanvas, entry.canvas, entry.region);
        if (baseMask && entry.mask) mask = patchRegion(baseMask, entry.mask, entry.region);
      } else {
        if (entry.canvas) canvas = cloneCanvas(entry.canvas);
        if (entry.mask) mask = cloneCanvas(entry.mask);
      }
      if (canvas) layer.canvas = canvas;
      if (mask) layer.mask = mask;
      return layer;
    });
    state.layers = layers;
    if (state.frames[state.frameIndex]) state.frames[state.frameIndex].layers = layers;
    state.selectedLayerId = snapshot.selectedLayerId;
    if (!state.layers.some((layer) => layer.id === state.selectedLayerId)) {
      state.selectedLayerId = state.layers.length ? state.layers[state.layers.length - 1].id : null;
    }
  }

  // Replace a rectangle of `target` with the stored patch, on a fresh canvas so
  // snapshots never share a mutable surface.
  function patchRegion(target, patch, region) {
    const out = cloneCanvas(target);
    const ctx = out.getContext('2d');
    ctx.save();
    // Clear only the rectangle, then draw the patch into it. 'copy' would
    // discard everything outside the region as well.
    ctx.clearRect(region.x, region.y, region.w, region.h);
    ctx.drawImage(patch, region.x, region.y);
    ctx.restore();
    return out;
  }

  // Bounding box of the pixels that differ between two same-sized canvases,
  // or null when they are identical.
  function differenceBounds(before, after) {
    if (!before || !after || before.width !== after.width || before.height !== after.height) return null;
    const w = before.width;
    const h = before.height;
    const a = new Uint32Array(before.getContext('2d').getImageData(0, 0, w, h).data.buffer);
    const b = new Uint32Array(after.getContext('2d').getImageData(0, 0, w, h).data.buffer);
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (a[row + x] !== b[row + x]) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  function cropCanvas(source, region) {
    const out = makeCanvas(region.w, region.h);
    out.getContext('2d').drawImage(source, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
    return out;
  }

  /**
   * After a painting gesture, shrink its snapshot from a whole-canvas copy to
   * just the rectangle the stroke touched. A full 1440x3200 layer is about
   * 18 MB; a typical stroke is a few hundred kilobytes.
   */
  function compactStrokeHistory() {
    const snapshot = history.past[history.past.length - 1];
    if (!snapshot || snapshot.compacted) return;
    let bytes = 0;
    snapshot.layers.forEach((entry) => {
      if (!entry.canvas && !entry.mask) return;
      const live = state.layers.find((layer) => layer.id === entry.id);
      if (!live) { bytes += canvasBytes(entry.canvas) + canvasBytes(entry.mask); return; }
      const region = entry.canvas ? differenceBounds(entry.canvas, live.canvas) : null;
      const maskRegion = entry.mask && live.mask ? differenceBounds(entry.mask, live.mask) : null;
      const union = region && maskRegion ? {
        x: Math.min(region.x, maskRegion.x),
        y: Math.min(region.y, maskRegion.y),
        w: Math.max(region.x + region.w, maskRegion.x + maskRegion.w) - Math.min(region.x, maskRegion.x),
        h: Math.max(region.y + region.h, maskRegion.y + maskRegion.h) - Math.min(region.y, maskRegion.y),
      } : (region || maskRegion);
      if (!union) {
        // Nothing actually changed, so this step holds no pixels at all.
        entry.canvas = null;
        entry.mask = null;
        entry.region = null;
        return;
      }
      if (entry.canvas) entry.canvas = cropCanvas(entry.canvas, union);
      if (entry.mask) entry.mask = cropCanvas(entry.mask, union);
      entry.region = union;
      bytes += canvasBytes(entry.canvas) + canvasBytes(entry.mask);
    });
    snapshot.bytes = bytes;
    snapshot.compacted = true;
    trimHistory();
  }

  function trimHistory() {
    history.bytes = history.past.reduce((sum, snap) => sum + snap.bytes, 0)
      + history.future.reduce((sum, snap) => sum + snap.bytes, 0);
    while (history.past.length > history.limit
      || (history.bytes > history.budget && history.past.length > 1)) {
      const dropped = history.past.shift();
      history.bytes -= dropped.bytes;
    }
  }

  /** Record the state as it is now, before a command changes it. */
  function pushHistory(label, touched) {
    if (history.suspended || !state.layers.length) return;
    history.past.push(captureState(label, touched));
    history.future.length = 0;
    trimHistory();
  }

  function resetHistory() {
    history.past.length = 0;
    history.future.length = 0;
    history.bytes = 0;
  }

  function applyHistoryStep(fromStack, toStack, verb) {
    if (!fromStack.length) {
      setStatus(verb === 'Undid' ? 'Nothing to undo.' : 'Nothing to redo.');
      return;
    }
    const snapshot = fromStack.pop();
    // Only the layers this step restores can differ, so the opposite step needs
    // to clone just those.
    const touched = snapshot.layers.filter((entry) => entry.canvas || entry.mask).map((entry) => entry.id);
    toStack.push(captureState(snapshot.label, touched.length ? touched : []));
    restoreState(snapshot);
    trimHistory();
    markDirty();
    updateAllUI();
    renderFrameStrip();
    render();
    setStatus(`${verb}: ${snapshot.label}.`);
  }

  function undo() { applyHistoryStep(history.past, history.future, 'Undid'); }
  function redo() { applyHistoryStep(history.future, history.past, 'Redid'); }

  /* ---------------- Icons ---------------- */

  // One SVG sprite drives every icon, so nothing depends on emoji fonts.
  function iconMarkup(name, className) {
    return `<svg class="ic${className ? ' ' + className : ''}" aria-hidden="true"><use href="#ic-${name}"/></svg>`;
  }

  function iconElement(name, className) {
    const span = document.createElement('span');
    span.className = 'ic-wrap';
    span.innerHTML = iconMarkup(name, className);
    return span.firstChild;
  }

  /* ---------------- Export dialog ---------------- */

  const exportDefaults = {
    format: 'png', transparent: false, superRes: false, colorSpace: 'rgb',
    profile: 'srgb', intent: 'relative', blackPoint: true, customProfilePath: '',
  };

  // Holds the bytes of a user-loaded ICC profile for the current session.
  let loadedProfile = null;

  function activeCustomProfile(options) {
    if (options.profile !== 'custom' || !loadedProfile) return null;
    return loadedProfile;
  }

  function colorOptionsFor(options) {
    return {
      profile: options.profile === 'custom' ? 'srgb' : options.profile,
      customProfile: activeCustomProfile(options),
      intent: options.intent,
      blackPoint: options.blackPoint,
      grayscale: options.colorSpace === 'gray',
    };
  }

  function profileLabel(options) {
    const custom = activeCustomProfile(options);
    if (custom) return custom.parsed.name;
    const profile = window.ExColor.PROFILES[options.profile];
    return profile ? profile.short : 'sRGB';
  }

  async function loadIccProfileFromDisk() {
    if (!window.exArtboothAPI || !window.exArtboothAPI.openIccProfile) {
      showNotice(t('exportColorProfile'), 'Loading a profile from disk needs the desktop app.');
      return null;
    }
    const file = await window.exArtboothAPI.openIccProfile();
    if (!file) return null;
    if (file.error) { showNotice(t('exportColorProfile'), `Could not read that file: ${file.error}`); return null; }
    const binary = atob(file.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const parsed = window.ExColor.parseICC(bytes);
    if (parsed.error) {
      const reasons = {
        lutProfile: 'That is a lookup-table profile, which most CMYK and printer profiles use. Reading one needs a full colour engine, which this app does not have, so it has not been loaded.',
        notIcc: 'That file is not an ICC profile.',
        tooShort: 'That file is too small to be an ICC profile.',
        unsupported: 'That profile is missing the colorant or tone curve tags this app needs.',
      };
      showNotice(t('exportColorProfile'), reasons[parsed.error] || 'That profile could not be read.');
      return null;
    }
    loadedProfile = { parsed, bytes, name: parsed.name, file: file.path };
    return loadedProfile;
  }

  function getExportSettings() {
    const saved = getSettings().exportOptions || {};
    return { ...exportDefaults, ...saved };
  }

  function saveExportSettings(options) {
    const settings = getSettings();
    settings.exportOptions = options;
    writeSettings(settings);
  }

  function buildExportCanvas(options) {
    const includeBackground = !(options.format === 'png' && options.transparent);
    const source = renderComposite({ includeBackground });
    const scale = options.superRes ? 2 : 1;
    const out = makeCanvas(state.width * scale, state.height * scale);
    const ctx = out.getContext('2d');
    if (options.format === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, out.width, out.height);
    const colorOptions = colorOptionsFor(options);
    let stats = null;
    if (colorOptions.grayscale || options.profile !== 'srgb' || options.blackPoint) {
      const imageData = ctx.getImageData(0, 0, out.width, out.height);
      stats = window.ExColor.convertImageData(imageData, colorOptions);
      ctx.putImageData(imageData, 0, 0);
    }
    return { canvas: out, stats };
  }


  /* ---------------- MP4 video export (animation projects) ----------------
     Chromium's WebCodecs VideoEncoder produces the H.264 bitstream; app/mp4.js
     wraps it in an MP4 container. No ffmpeg, so the app stays small.
     Encoder availability varies by machine, hence the isConfigSupported probe
     and the candidate list below. */

  const H264_CANDIDATES = [
    'avc1.42002A',   // Baseline 4.2 - the most widely supported
    'avc1.4D0028',   // Main 4.0
    'avc1.640028'    // High 4.0
  ];

  function videoExportSupported() {
    return typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';
  }

  // Even dimensions are required by H.264 chroma subsampling.
  function evenSize(value) { return Math.max(2, Math.round(value / 2) * 2); }

  async function pickVideoConfig(width, height, fps) {
    if (!videoExportSupported()) return null;
    for (const codec of H264_CANDIDATES) {
      const config = {
        codec,
        width,
        height,
        // A still-image animation at 0.001 fps would make nonsense of a
        // framerate hint, so clamp it to something an encoder accepts.
        framerate: Math.min(120, Math.max(1, Math.round(fps) || 1)),
        bitrate: Math.max(1_000_000, Math.round(width * height * 4)),
        avc: { format: 'avc' }   // gives us an avcC record instead of Annex-B
      };
      try {
        const probe = await window.VideoEncoder.isConfigSupported(config);
        if (probe && probe.supported) return probe.config || config;
      } catch (err) { /* try the next profile */ }
    }
    return null;
  }

  async function exportAnimationMp4() {
    if (!isAnimationProject()) {
      showNotice(t('exportTitle'), t('mp4OnlyAnimation'));
      return;
    }
    if (!videoExportSupported()) {
      showNotice(t('exportTitle'), t('mp4NoCodec'));
      return;
    }

    syncActiveFrame();
    const frames = state.frames;
    if (!frames.length) { showNotice(t('exportTitle'), t('mp4NoFrames')); return; }

    const width = evenSize(state.width);
    const height = evenSize(state.height);
    const fps = currentFps();
    const config = await pickVideoConfig(width, height, fps);
    if (!config) { showNotice(t('exportTitle'), t('mp4NoCodec')); return; }

    const TIMESCALE = 90000;
    const ticks = Math.max(1, Math.round(TIMESCALE / fps));
    const muxer = window.ExArtboothMP4.createMuxer({ width, height, timescale: TIMESCALE });

    const scratch = makeCanvas(width, height);
    const sctx = scratch.getContext('2d');
    let encodeError = null;

    const encoder = new window.VideoEncoder({
      output: (chunk, metadata) => {
        if (metadata && metadata.decoderConfig && metadata.decoderConfig.description) {
          muxer.setDescription(metadata.decoderConfig.description);
        }
        const bytes = new Uint8Array(chunk.byteLength);
        chunk.copyTo(bytes);
        muxer.addSample(bytes, ticks, chunk.type === 'key');
      },
      error: (err) => { encodeError = err; }
    });
    encoder.configure(config);

    setStatus(`Encoding ${frames.length} frames to MP4...`);
    try {
      for (let i = 0; i < frames.length; i++) {
        if (encodeError) break;
        const composed = renderComposite({ includeBackground: true, layers: frames[i].layers });
        sctx.clearRect(0, 0, width, height);
        sctx.fillStyle = '#ffffff';
        sctx.fillRect(0, 0, width, height);
        sctx.drawImage(composed, 0, 0, width, height);

        const frame = new window.VideoFrame(scratch, {
          timestamp: Math.round((i / fps) * 1_000_000),   // microseconds
          duration: Math.round((1 / fps) * 1_000_000)
        });
        // A keyframe every second keeps seeking usable without bloating size.
        encoder.encode(frame, { keyFrame: i % Math.max(1, Math.round(fps)) === 0 });
        frame.close();

        // Let the encoder drain so long animations do not exhaust memory.
        if (encoder.encodeQueueSize > 8) {
          await new Promise((resolve) => {
            const wait = () => (encoder.encodeQueueSize <= 2 ? resolve() : setTimeout(wait, 10));
            wait();
          });
        }
        if (i % 5 === 0) setStatus(`Encoding frame ${i + 1} of ${frames.length}...`);
      }
      await encoder.flush();
      encoder.close();
    } catch (err) {
      try { encoder.close(); } catch (e) { /* already closed */ }
      showNotice(t('exportTitle'), `${t('mp4Failed')} ${err && err.message ? err.message : err}`);
      setStatus('MP4 export failed.');
      return;
    }

    if (encodeError) {
      showNotice(t('exportTitle'), `${t('mp4Failed')} ${encodeError.message || encodeError}`);
      setStatus('MP4 export failed.');
      return;
    }

    let file;
    try {
      file = muxer.finalize();
    } catch (err) {
      showNotice(t('exportTitle'), `${t('mp4Failed')} ${err.message}`);
      return;
    }

    const dataUrl = `data:video/mp4;base64,${bytesToBase64(file)}`;
    const fileName = `${safeFileName(state.projectName || 'animation')}-${Math.round(fps * 1000) / 1000}fps.mp4`;
    const filters = [{ name: 'MP4 Video', extensions: ['mp4'] }];
    if (window.exArtboothAPI) {
      const folder = await requestSaveDestination('animation');
      if (folder === null) return;
      const result = await window.exArtboothAPI.saveDataUrl({ defaultPath: pathJoin(folder, fileName), dataUrl, filters });
      if (result) {
        const seconds = frames.length / fps;
        setStatus(`Exported ${frames.length} frames (${seconds.toFixed(2)}s, ${(file.length / 1048576).toFixed(1)} MB) to ${result.path}.`);
      }
      return;
    }
    downloadDataUrlFallback(dataUrl, fileName);
  }

  // Chunked so a large video does not blow the argument limit of apply().
  function bytesToBase64(bytes) {
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  function downloadDataUrlFallback(dataUrl, fileName) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    link.click();
  }

  async function runExport(options) {
    if (options.format === 'mp4') { await exportAnimationMp4(); return; }
    if (options.format === 'psd') {
      showNotice(t('exportTitle'), 'PSD export is not built yet. Use PNG or JPEG for now, or save the editable .exart project to keep every layer.');
      return;
    }
    const built = buildExportCanvas(options);
    const canvas = built.canvas;
    const isJpg = options.format === 'jpeg';
    const mime = isJpg ? 'image/jpeg' : 'image/png';
    let dataUrl = canvas.toDataURL(mime, 0.92);
    // Embed the destination profile so other applications read the file correctly.
    const custom = activeCustomProfile(options);
    dataUrl = custom
      ? window.ExColor.tagDataUrl(dataUrl, mime, null, options.intent, custom.bytes)
      : window.ExColor.tagDataUrl(dataUrl, mime, options.profile, options.intent);
    const parts = [safeFileName(state.projectName || 'image')];
    if (options.format === 'png' && options.transparent) parts.push('transparent');
    if (options.superRes) parts.push('2x');
    if (options.colorSpace === 'gray') parts.push('gray');
    if (options.profile !== 'srgb') parts.push(safeFileName(profileLabel(options)).toLowerCase().replace(/\s+/g, ''));
    const fileName = `${parts.join('-')}.${isJpg ? 'jpg' : 'png'}`;
    const filters = isJpg
      ? [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }]
      : [{ name: 'PNG Image', extensions: ['png'] }];
    if (window.exArtboothAPI) {
      const folder = await requestSaveDestination('image');
      if (folder === null) return;
      const result = await window.exArtboothAPI.saveDataUrl({ defaultPath: pathJoin(folder, fileName), dataUrl, filters });
      if (result) setStatus(`Exported ${canvas.width} × ${canvas.height} in ${profileLabel(options)} to ${result.path}.`);
      return;
    }
    downloadHref(dataUrl, fileName);
    setStatus(`Exported ${canvas.width} × ${canvas.height} in ${profileLabel(options)}.`);
  }

  // Re-read a previously chosen ICC file so the setting survives a restart.
  async function restoreCustomProfile(options) {
    if (options.profile !== 'custom' || loadedProfile) return;
    const file = options.customProfilePath;
    if (!file || !window.exArtboothAPI || !window.exArtboothAPI.readIccProfile) { options.profile = 'srgb'; return; }
    const data = await window.exArtboothAPI.readIccProfile(file);
    if (!data || !data.base64) { options.profile = 'srgb'; return; }
    const binary = atob(data.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const parsed = window.ExColor.parseICC(bytes);
    if (parsed.error) { options.profile = 'srgb'; return; }
    loadedProfile = { parsed, bytes, name: parsed.name, file };
  }

  // One export entry point. The format (PNG / JPEG / PSD) is chosen inside the
  // dialog and remembered in settings, so there are no per-format menu items.
  async function openExportDialog() {
    const options = getExportSettings();
    await restoreCustomProfile(options);
    // A remembered MP4 choice must not leak into a still-image project.
    if (options.format === 'mp4' && !isAnimationProject()) options.format = 'png';

    const overlay = document.createElement('div');
    overlay.className = 'input-modal-overlay';
    overlay.innerHTML = `
      <div class="input-modal-card export-card" role="dialog" aria-modal="true">
        <header class="export-head">
          <h3>${escapeHtml(t('exportTitle'))}</h3>
          <button type="button" class="export-close input-cancel" title="Close">${iconMarkup('close')}</button>
        </header>

        <div class="export-scroll">
          <div class="export-section-label">${escapeHtml(t('exportBasic'))}</div>
          <div class="export-group">
            <div class="export-row">
              <span>${escapeHtml(t('exportFormat'))}</span>
              <div class="format-switch">
                <button type="button" data-format="png">PNG</button>
                <button type="button" data-format="jpeg">JPEG</button>
                <button type="button" data-format="psd">PSD</button>
                ${isAnimationProject() ? '<button type="button" data-format="mp4">MP4</button>' : ''}
              </div>
            </div>
            <div class="export-row" data-row="transparent">
              <span>${escapeHtml(t('exportTransparency'))}</span>
              <button type="button" class="switch" data-toggle="transparent"><i></i></button>
            </div>
            <div class="export-row">
              <span>${escapeHtml(t('exportSuperRes'))}</span>
              <button type="button" class="switch" data-toggle="superRes"><i></i></button>
            </div>
            <p class="export-note" id="exportSizeNote"></p>
          </div>

          <div class="export-section-label">${escapeHtml(t('exportColor'))}</div>
          <div class="export-group">
            <div class="export-row">
              <span>${escapeHtml(t('exportColorSpace'))}</span>
              <select data-select="colorSpace">
                <option value="rgb">RGB</option>
                <option value="gray">${escapeHtml(t('exportGrayscale'))}</option>
              </select>
            </div>
            <div class="export-row">
              <span>${escapeHtml(t('exportColorProfile'))}</span>
              <select data-select="profile">
                <option value="srgb">sRGB</option>
                <option value="display-p3">Display P3</option>
                <option value="adobe-rgb">Adobe RGB (1998)</option>
                <option value="prophoto">ProPhoto RGB</option>
                <option value="custom">${escapeHtml(t('exportLoadProfile'))}</option>
              </select>
            </div>
            <div class="export-row">
              <span>${escapeHtml(t('exportIntent'))}</span>
              <select data-select="intent">
                <option value="perceptual">${escapeHtml(t('exportIntentPerceptual'))}</option>
                <option value="relative">${escapeHtml(t('exportIntentRelative'))}</option>
                <option value="saturation">${escapeHtml(t('exportIntentSaturation'))}</option>
                <option value="absolute">${escapeHtml(t('exportIntentAbsolute'))}</option>
              </select>
            </div>
            <div class="export-row">
              <span>${escapeHtml(t('exportBlackPoint'))}</span>
              <button type="button" class="switch" data-toggle="blackPoint"><i></i></button>
            </div>
            <p class="export-note" id="exportColorNote"></p>
            <p class="export-note">${escapeHtml(t('exportColorNote'))}</p>
          </div>
        </div>

        <button type="button" class="export-ok">OK</button>
      </div>`;
    document.body.append(overlay);

    // A small sample of the real composite, so the colour note can report what
    // the chosen settings actually do to this image rather than a generic claim.
    let sample = null;
    const sampleImage = () => {
      if (sample) return sample;
      try {
        const source = renderComposite({ includeBackground: true });
        const long = Math.max(state.width, state.height);
        const scale = Math.min(1, 160 / Math.max(1, long));
        const w = Math.max(1, Math.round(state.width * scale));
        const h = Math.max(1, Math.round(state.height * scale));
        const small = makeCanvas(w, h);
        const sctx = small.getContext('2d');
        sctx.drawImage(source, 0, 0, w, h);
        sample = sctx.getImageData(0, 0, w, h);
      } catch (err) {
        sample = null;
      }
      return sample;
    };

    const sync = () => {
      overlay.querySelectorAll('[data-format]').forEach((button) => button.classList.toggle('active', button.dataset.format === options.format));
      overlay.querySelectorAll('[data-toggle]').forEach((button) => button.classList.toggle('on', Boolean(options[button.dataset.toggle])));
      overlay.querySelector('[data-select="colorSpace"]').value = options.colorSpace;
      overlay.querySelector('[data-select="profile"]').value = options.profile;
      overlay.querySelector('[data-select="intent"]').value = options.intent;
      const customOption = overlay.querySelector('[data-select="profile"] option[value="custom"]');
      customOption.textContent = loadedProfile ? loadedProfile.parsed.name : t('exportLoadProfile');
      const transparentRow = overlay.querySelector('[data-row="transparent"]');
      transparentRow.classList.toggle('disabled-row', options.format !== 'png');
      // Colour management applies to still images; video always goes out as sRGB.
      const isVideo = options.format === 'mp4';
      overlay.querySelectorAll('.export-row [data-select], .export-row [data-toggle]').forEach((control) => {
        if (control.dataset.toggle === 'transparent') return;
        const row = control.closest('.export-row');
        if (row) row.classList.toggle('disabled-row', isVideo);
      });
      const scale = options.superRes ? 2 : 1;
      const note = overlay.querySelector('#exportSizeNote');
      if (options.format === 'psd') {
        note.textContent = t('exportPsdNote');
      } else if (options.format === 'mp4') {
        const fps = currentFps();
        const count = state.frames.length;
        const seconds = count / fps;
        note.textContent = `${t('exportOutput')}: ${evenSize(state.width)} × ${evenSize(state.height)} px • ${count} ${t('mp4Frames')} • ${formatFps(fps)} fps • ${seconds.toFixed(2)}s`;
      } else {
        note.textContent = `${t('exportOutput')}: ${state.width * scale} × ${state.height * scale} px`;
      }

      if (isVideo) {
        overlay.querySelector('#exportColorNote').textContent = t('mp4ColorNote');
      } else {
        const colorOptions = colorOptionsFor(options);
        const image = sampleImage();
        const stats = image ? window.ExColor.previewStats(image, colorOptions) : null;
        overlay.querySelector('#exportColorNote').textContent = window.ExColor.describe(colorOptions, stats);
      }
    };

    overlay.querySelectorAll('[data-format]').forEach((button) => button.addEventListener('click', () => { options.format = button.dataset.format; sync(); }));
    overlay.querySelectorAll('[data-toggle]').forEach((button) => button.addEventListener('click', () => {
      if (button.disabled) return;
      if (button.dataset.toggle === 'transparent' && options.format !== 'png') return;
      options[button.dataset.toggle] = !options[button.dataset.toggle];
      sync();
    }));
    overlay.querySelector('[data-select="colorSpace"]').addEventListener('change', (event) => { options.colorSpace = event.target.value; sync(); });
    overlay.querySelector('[data-select="intent"]').addEventListener('change', (event) => { options.intent = event.target.value; sync(); });
    overlay.querySelector('[data-select="profile"]').addEventListener('change', async (event) => {
      const value = event.target.value;
      if (value === 'custom') {
        const previous = options.profile;
        const loaded = await loadIccProfileFromDisk();
        if (!loaded) { options.profile = previous; sync(); return; }
        options.profile = 'custom';
        options.customProfilePath = loaded.file || '';
        setStatus(`Loaded colour profile: ${loaded.parsed.name}.`);
      } else {
        options.profile = value;
      }
      sync();
    });

    const close = () => overlay.remove();
    overlay.querySelector('.export-close').addEventListener('click', close);
    overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) close(); });
    overlay.querySelector('.export-ok').addEventListener('click', () => {
      saveExportSettings(options);
      close();
      runExport(options);
    });
    sync();
  }

  /* ---------------- Layer panel (ibisPaint-style) ---------------- */

  function toggleLayerPanel(force) {
    const panel = $('layerPanel');
    const open = force === undefined ? panel.classList.contains('hidden') : force;
    panel.classList.toggle('hidden', !open);
    $('layerPanelBtn').classList.toggle('active', open);
    if (open) updateLayerPanel();
  }

  function layerThumbnailDataUrl(layer, w = 56, h = 44) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (isBackgroundLayer(layer)) {
      const img = new Image();
      return backgroundPreviewDataUrl(layer, w, h);
    }
    const colors = { a: '#c9ced8', b: '#eef1f6' };
    const cell = 7;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        ctx.fillStyle = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0 ? colors.a : colors.b;
        ctx.fillRect(x, y, cell, cell);
      }
    }
    try {
      scratchCanvas.width = state.width;
      scratchCanvas.height = state.height;
      const sctx = scratchCanvas.getContext('2d');
      sctx.clearRect(0, 0, state.width, state.height);
      if (layer.kind === 'adjustment') {
        ctx.fillStyle = 'rgba(47,230,166,.35)';
        ctx.fillRect(0, 0, w, h);
      } else {
        drawLayerToContext(layer, sctx);
        if (layer.mask) applyMask(scratchCanvas, layer.mask);
        ctx.drawImage(scratchCanvas, 0, 0, w, h);
        sctx.clearRect(0, 0, state.width, state.height);
      }
    } catch (_err) { /* ignore thumbnail failure */ }
    return canvas.toDataURL('image/png');
  }

  function updateLayerPanel() {
    const panel = $('layerPanel');
    if (!panel || panel.classList.contains('hidden')) {
      const count = $('layerFabCount');
      if (count) count.textContent = String(state.layers.length);
      return;
    }
    const preview = $('layerPanelPreview');
    if (preview) {
      try { preview.src = makeProjectThumbnail(); } catch (_err) { /* ignore */ }
    }
    const layer = selectedLayer();
    const lockedBg = isBackgroundLayer(layer);
    const opacity = layer ? Math.round(layer.opacity * 100) : 100;
    $('lpOpacity').value = opacity;
    $('lpOpacityText').textContent = `${opacity}%`;
    $('lpOpacity').disabled = !layer || lockedBg;
    $('lpBlend').value = layer?.blend || 'source-over';
    $('lpBlend').disabled = !layer || lockedBg;
    $('lpClipping').classList.toggle('active', Boolean(layer?.clipped));
    $('lpAlphaLock').classList.toggle('active', Boolean(layer?.alphaLock));
    $('lpLockLayer').classList.toggle('active', isLayerLocked(layer));
    $('lpLockLayer').disabled = !layer || lockedBg;
    $('layerFabCount').textContent = String(state.layers.length);

    const bgLayer = backgroundLayer();
    const style = backgroundStyleOf(bgLayer);
    panel.querySelectorAll('.bg-swatch').forEach((button) => {
      const mode = button.dataset.bgSwatch;
      button.classList.toggle('active', mode === style.mode || (mode === 'more' && style.mode === 'texture'));
      if (mode === 'color') button.style.background = style.color || '#ffffff';
      if (mode === 'more' && style.mode === 'texture') {
        button.style.backgroundImage = `url(${textureTile(style.texture).toDataURL('image/png')})`;
        button.style.backgroundSize = 'cover';
      } else if (mode === 'more') {
        button.style.backgroundImage = '';
      }
    });
  }

  function moveLayerToIndex(fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const layer = state.layers[fromIndex];
    if (!layer || isBackgroundLayer(layer)) return;
    if (blockedByLock(layer, 'reorder it')) return;
    pushHistory('reorder layers', []);
    const target = Math.max(1, Math.min(state.layers.length - 1, toIndex));
    state.layers.splice(fromIndex, 1);
    state.layers.splice(target, 0, layer);
    markDirty();
    updateAllUI();
    render();
  }

  function flipLayerHorizontally(layer = selectedLayer()) {
    if (!layer) return;
    if (blockedByLock(layer, 'flip it')) return;
    pushHistory('flip layer', [layer.id]);
    if (isBackgroundLayer(layer)) { setStatus('The background cannot be flipped. Change its style instead.'); return; }
    if (layer.kind === 'raster') {
      const flip = (source) => {
        if (!source) return null;
        const out = makeCanvas(state.width, state.height);
        const ctx = out.getContext('2d');
        ctx.translate(state.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(source, 0, 0);
        return out;
      };
      layer.canvas = flip(layer.canvas) || layer.canvas;
      if (layer.mask) layer.mask = flip(layer.mask);
    } else if (layer.kind === 'text' || layer.kind === 'shape') {
      layer.x = state.width - (layer.x + (layer.w || 0));
    }
    markDirty(); updateAllUI(); render();
    setStatus(`${layer.name} flipped horizontally.`);
  }

  function invertLayer(layer = selectedLayer()) {
    if (blockedByLock(layer, 'invert it')) return;
    if (layer) pushHistory('invert layer', [layer.id]);
    if (!layer || layer.kind !== 'raster' || isBackgroundLayer(layer)) {
      setStatus('Select a raster layer to invert its colors.');
      return;
    }
    const ctx = layer.canvas.getContext('2d');
    const data = ctx.getImageData(0, 0, state.width, state.height);
    for (let i = 0; i < data.data.length; i += 4) {
      data.data[i] = 255 - data.data[i];
      data.data[i + 1] = 255 - data.data[i + 1];
      data.data[i + 2] = 255 - data.data[i + 2];
    }
    ctx.putImageData(data, 0, 0);
    markDirty(); updateAllUI(); render();
    setStatus(`${layer.name} inverted.`);
  }

  function mergeLayerDown(layer = selectedLayer()) {
    if (!layer) return;
    if (blockedByLock(layer, 'merge it')) return;
    const index = state.layers.indexOf(layer);
    if (index <= 0) { setStatus('There is no layer underneath to merge into.'); return; }
    const below = state.layers[index - 1];
    if (blockedByLock(below, 'merge into it')) return;
    pushHistory('merge down', 'all');
    if (isBackgroundLayer(below)) { setStatus('Cannot merge into the background. Merge into a normal layer instead.'); return; }
    if (below.kind !== 'raster') { setStatus('The layer underneath must be a raster layer.'); return; }
    const ctx = below.canvas.getContext('2d');
    scratchCanvas.width = state.width;
    scratchCanvas.height = state.height;
    const sctx = scratchCanvas.getContext('2d');
    sctx.clearRect(0, 0, state.width, state.height);
    drawLayerToContext(layer, sctx);
    if (hasAdjustment(layer.adjustment)) applyAdjustmentToCanvas(scratchCanvas, layer.adjustment, 1);
    if (layer.mask) applyMask(scratchCanvas, layer.mask);
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blend || 'source-over';
    ctx.drawImage(scratchCanvas, 0, 0);
    ctx.restore();
    sctx.clearRect(0, 0, state.width, state.height);
    state.layers.splice(index, 1);
    state.selectedLayerId = below.id;
    markDirty(); updateAllUI(); render();
    setStatus('Layer merged down.');
  }

  async function exportLayerPng(layer = selectedLayer()) {
    if (!layer) return;
    scratchCanvas.width = state.width;
    scratchCanvas.height = state.height;
    const sctx = scratchCanvas.getContext('2d');
    sctx.clearRect(0, 0, state.width, state.height);
    if (isBackgroundLayer(layer)) paintBackground(sctx, layer);
    else { drawLayerToContext(layer, sctx); if (layer.mask) applyMask(scratchCanvas, layer.mask); }
    const dataUrl = scratchCanvas.toDataURL('image/png');
    const fileName = `${safeFileName(state.projectName || 'project')}-${safeFileName(layer.name || 'layer')}.png`;
    if (window.exArtboothAPI) {
      const folder = await requestSaveDestination('image');
      if (folder === null) return;
      const result = await window.exArtboothAPI.saveDataUrl({
        defaultPath: pathJoin(folder, fileName),
        dataUrl,
        filters: [{ name: 'PNG Image', extensions: ['png'] }]
      });
      if (result) setStatus(`Layer exported to ${result.path}.`);
      return;
    }
    downloadHref(dataUrl, fileName);
  }

  function toggleClipping(layer = selectedLayer()) {
    if (blockedByLock(layer, 'change its clipping mask')) return;
    if (layer) pushHistory('clipping mask', []);
    if (!layer || isBackgroundLayer(layer)) { setStatus('Select a normal layer to use a clipping mask.'); return; }
    if (state.layers.indexOf(layer) <= 0) { setStatus('A clipping mask needs a layer underneath.'); return; }
    layer.clipped = !layer.clipped;
    markDirty(); updateAllUI(); render();
    setStatus(layer.clipped ? `${layer.name} is clipped to the layer below.` : `${layer.name} is no longer clipped.`);
  }

  function toggleAlphaLock(layer = selectedLayer()) {
    if (blockedByLock(layer, 'change its alpha lock')) return;
    if (layer) pushHistory('alpha lock', []);
    if (!layer || layer.kind !== 'raster' || isBackgroundLayer(layer)) { setStatus('Alpha lock works on raster layers.'); return; }
    layer.alphaLock = !layer.alphaLock;
    markDirty(); updateAllUI(); render();
    setStatus(layer.alphaLock ? `${layer.name}: alpha locked, painting stays inside existing pixels.` : `${layer.name}: alpha lock off.`);
  }

  function handleRailAction(action) {
    if (action === 'background') { openBackgroundDialog(); return; }
    if (action === 'invert') { invertLayer(); return; }
    if (action === 'flip') { flipLayerHorizontally(); return; }
    if (action === 'merge') { mergeLayerDown(); return; }
    if (action === 'export') { exportLayerPng(); return; }
    if (action === 'delete') { deleteLayer(); return; }
    showPlannedNotice(t(action === 'fx' ? 'effects' : action === 'transform' ? 'transform' : 'more'));
  }

  function wireLayerPanel() {
    $('layerPanelBtn').addEventListener('click', () => toggleLayerPanel());
    $('layerPanelClose').addEventListener('click', () => toggleLayerPanel(false));
    $('lpFlipLayer').addEventListener('click', () => flipLayerHorizontally());
    $('lpMergeDown').addEventListener('click', () => mergeLayerDown());
    $('lpImportLayer').addEventListener('click', () => openImage('import'));
    $('lpSelectionRow').addEventListener('click', () => showPlannedNotice(t('selectionLayer')));
    $('lpClipping').addEventListener('click', () => toggleClipping());
    $('lpAlphaLock').addEventListener('click', () => toggleAlphaLock());
    $('lpLockLayer').addEventListener('click', () => toggleLayerLock());
    $('lpBlend').addEventListener('change', (event) => {
      const layer = selectedLayer();
      if (!layer || isBackgroundLayer(layer)) return;
      layer.blend = event.target.value;
      markDirty(); updateAllUI(); render();
    });
    const applyOpacity = (value) => {
      const layer = selectedLayer();
      if (!layer || isBackgroundLayer(layer)) return;
      layer.opacity = Math.max(0, Math.min(1, value / 100));
      markDirty(); updateAllUI(); render();
    };
    $('lpOpacity').addEventListener('input', (event) => applyOpacity(Number(event.target.value)));
    $('lpOpacityMinus').addEventListener('click', () => { pushHistory('layer opacity', []); applyOpacity(Math.max(0, Number($('lpOpacity').value) - 5)); });
    $('lpOpacityPlus').addEventListener('click', () => { pushHistory('layer opacity', []); applyOpacity(Math.min(100, Number($('lpOpacity').value) + 5)); });
    document.querySelectorAll('[data-rail]').forEach((button) => button.addEventListener('click', () => handleRailAction(button.dataset.rail)));
    document.querySelectorAll('[data-bg-swatch]').forEach((button) => button.addEventListener('click', () => {
      const mode = button.dataset.bgSwatch;
      if (mode === 'more') { openBackgroundDialog(); return; }
      applyBackgroundStyle({ ...backgroundStyleOf(backgroundLayer()), mode });
    }));
    $('langToggleBtn').addEventListener('click', () => setLanguage(state.lang === 'vi' ? 'en' : 'vi'));
  }

  /* ---------------- Language ---------------- */

  const I18N = {
    en: {
      export: 'Export', exportTitle: 'Save image', exportBasic: 'Basic', exportColor: 'Color',
      exportFormat: 'File type', exportTransparency: 'Transparency', exportSuperRes: 'Super resolution x2',
      exportColorSpace: 'Color space', exportGrayscale: 'Grayscale', exportColorProfile: 'Color profile',
      exportIntent: 'Rendering intent', exportIntentRelative: 'Relative colorimetric',
      exportIntentPerceptual: 'Perceptual', exportIntentSaturation: 'Saturation',
      exportIntentAbsolute: 'Absolute colorimetric', exportLoadProfile: 'Load ICC profile...',
      exportBlackPoint: 'Black point compensation', exportOutput: 'Output size',
      
      exportPsdNote: 'PSD export is not built yet.',
      mp4Frames: 'frames',
      bgApplyTo: 'Apply to',
      bgThisFrame: 'This frame',
      bgAllFrames: 'All frames',
      bgRange: 'Frame range',
      bgFrom: 'From',
      bgTo: 'To',
      bgRangeHint: 'Frames are numbered',
      bgWillChange: 'Will change',
      bgFrameWord: 'frame',
      bgFramesWord: 'frames',
      bgAllWord: 'all',
      mp4ColorNote: 'Video is written as H.264 in an MP4 container, always in sRGB. The colour settings above apply to still images only.',
      mp4OnlyAnimation: 'MP4 export is only available for animation projects, which have more than one frame.',
      mp4NoFrames: 'This animation has no frames to export.',
      mp4NoCodec: 'This computer has no H.264 video encoder available, so MP4 export cannot run. You can still export the frames as PNG or JPEG images.',
      mp4Failed: 'MP4 export failed:',
      layers: 'Layers', back: 'Back', choose: 'Choose', home: 'Home', new: 'New', open: 'Open',
      importLayer2: 'Import Layer', exportPng: 'Export PNG', exportJpeg: 'Export JPEG',
      saveProject: 'Save Project', openProject: 'Open Project', resize: 'Resize', fit: 'Fit',
      addLayer: 'Add layer', addAdjust: '+ Adjust', duplicateLayer: 'Duplicate layer',
      deleteLayer: 'Delete layer', mergeDown: 'Merge down', flipLayer: 'Flip layer horizontally',
      importLayer: 'Import image as layer', exportLayer: 'Export this layer as PNG',
      invert: 'Invert layer colors', transform: 'Transform', effects: 'Effects', more: 'More',
      clipping: 'Clipping mask', alphaLock: 'Alpha lock', lockLayer: 'Lock layer', locked: 'Locked', selectionLayer: 'Selection layer',
      noSelection: 'No selection', backgroundColor: 'Background', bgColor: 'Solid color',
      bgGrid: 'Transparent grid', bgGridDark: 'Transparent grid (dark)', bgMore: 'Textures and more',
      addMask: 'Add Mask', applyCrop: 'Apply Crop', cancelCrop: 'Cancel Crop',
      resetAdjustments: 'Reset Adjustments', changeBackground: 'Change background…',
      selectedLayer: 'Selected Layer', adjustments: 'Adjustments', textShape: 'Text / Shape',
      cropPanel: 'Crop', projectInformation: 'Project information',
      recentlyDeleted: 'Recently deleted project', share: 'Share', progressReplay: 'Progress replay',
      noProjects: 'No recent projects yet', recentProjects: 'Recent projects',
      addFrameBtn: 'Frame', play: 'Play', folder: 'Folder', delete: 'Delete', cancel: 'Cancel',
      toolBrush: 'Brush', toolEraser: 'Eraser', toolHeal: 'Heal', toolClone: 'Clone',
      toolText: 'Text', toolRect: 'Rect', toolEllipse: 'Ellipse', toolCrop: 'Crop',
      blendNormal: 'Normal', planned: 'Planned feature', plannedBody: 'This control is part of the layout but is not built yet. It is planned for a later version.'
    },
    vi: {
      export: 'Xuất', exportTitle: 'Lưu Ảnh', exportBasic: 'Cơ bản', exportColor: 'Màu',
      exportFormat: 'Kiểu tập tin', exportTransparency: 'Độ trong suốt', exportSuperRes: 'Siêu độ phân giải x2',
      exportColorSpace: 'Không gian màu', exportGrayscale: 'Thang xám', exportColorProfile: 'Hồ sơ màu',
      exportIntent: 'Phương thức kết xuất màu', exportIntentRelative: 'Theo màu sắc tương đối',
      exportIntentPerceptual: 'Theo cảm nhận', exportIntentSaturation: 'Theo độ bão hoà',
      exportIntentAbsolute: 'Theo màu sắc tuyệt đối', exportLoadProfile: 'Tải hồ sơ ICC...',
      exportBlackPoint: 'Bù điểm đen', exportOutput: 'Kích thước xuất',
      
      exportPsdNote: 'Xuất PSD chưa được xây dựng.',
      mp4Frames: 'khung hình',
      bgApplyTo: 'Áp dụng cho',
      bgThisFrame: 'Khung hình này',
      bgAllFrames: 'Tất cả khung hình',
      bgRange: 'Khoảng khung hình',
      bgFrom: 'Từ',
      bgTo: 'Đến',
      bgRangeHint: 'Khung hình được đánh số',
      bgWillChange: 'Sẽ thay đổi',
      bgFrameWord: 'khung hình',
      bgFramesWord: 'khung hình',
      bgAllWord: 'tất cả',
      mp4ColorNote: 'Video được ghi ở định dạng H.264 trong tệp MP4, luôn dùng sRGB. Các tùy chọn màu ở trên chỉ áp dụng cho ảnh tĩnh.',
      mp4OnlyAnimation: 'Chỉ dự án hoạt hình (có nhiều hơn một khung hình) mới xuất được MP4.',
      mp4NoFrames: 'Hoạt hình này chưa có khung hình nào để xuất.',
      mp4NoCodec: 'Máy này không có bộ mã hóa video H.264 nên không thể xuất MP4. Bạn vẫn có thể xuất các khung hình thành ảnh PNG hoặc JPEG.',
      mp4Failed: 'Xuất MP4 thất bại:',
      layers: 'Lớp', back: 'Quay lại', choose: 'Chọn', home: 'Trang chính', new: 'Tạo mới', open: 'Mở',
      importLayer2: 'Nhập lớp', exportPng: 'Xuất PNG', exportJpeg: 'Xuất JPEG',
      saveProject: 'Lưu dự án', openProject: 'Mở dự án', resize: 'Đổi kích thước', fit: 'Vừa khung',
      addLayer: 'Thêm lớp', addAdjust: '+ Hiệu chỉnh', duplicateLayer: 'Nhân đôi lớp',
      deleteLayer: 'Xoá lớp', mergeDown: 'Gộp xuống dưới', flipLayer: 'Lật ngang lớp',
      importLayer: 'Nhập ảnh thành lớp', exportLayer: 'Xuất lớp này thành PNG',
      invert: 'Đảo màu lớp', transform: 'Biến đổi', effects: 'Hiệu ứng', more: 'Thêm',
      clipping: 'Mặt nạ cắt', alphaLock: 'Khoá alpha', lockLayer: 'Khoá lớp', locked: 'Đã khoá', selectionLayer: 'Chọn Lớp',
      noSelection: 'Không Có Lựa Chọn', backgroundColor: 'Màu Nền', bgColor: 'Màu đơn sắc',
      bgGrid: 'Lưới trong suốt', bgGridDark: 'Lưới trong suốt (tối)', bgMore: 'Hoạ tiết và tuỳ chọn khác',
      addMask: 'Thêm mặt nạ', applyCrop: 'Áp dụng cắt', cancelCrop: 'Huỷ cắt',
      resetAdjustments: 'Đặt lại hiệu chỉnh', changeBackground: 'Đổi nền…',
      selectedLayer: 'Lớp đang chọn', adjustments: 'Hiệu chỉnh', textShape: 'Chữ / Hình',
      cropPanel: 'Cắt', projectInformation: 'Thông tin dự án',
      recentlyDeleted: 'Dự án vừa xoá', share: 'Chia sẻ', progressReplay: 'Xem lại tiến trình',
      noProjects: 'Chưa có dự án nào', recentProjects: 'Dự án gần đây',
      addFrameBtn: 'Khung', play: 'Phát', folder: 'Thư mục', delete: 'Xoá', cancel: 'Huỷ',
      toolBrush: 'Cọ vẽ', toolEraser: 'Tẩy', toolHeal: 'Chữa', toolClone: 'Nhân bản',
      toolText: 'Chữ', toolRect: 'Chữ nhật', toolEllipse: 'Elip', toolCrop: 'Cắt',
      blendNormal: 'Bình Thường', planned: 'Tính năng sắp có', plannedBody: 'Nút này đã có trong giao diện nhưng chưa được xây dựng. Nó sẽ có ở phiên bản sau.'
    }
  };

  const BLEND_MODES = [
    ['source-over', 'Normal', 'Bình Thường'], ['multiply', 'Multiply', 'Nhân'], ['screen', 'Screen', 'Màn hình'],
    ['overlay', 'Overlay', 'Phủ'], ['darken', 'Darken', 'Tối hơn'], ['lighten', 'Lighten', 'Sáng hơn'],
    ['color-dodge', 'Color Dodge', 'Dodge màu'], ['color-burn', 'Color Burn', 'Burn màu'],
    ['hard-light', 'Hard Light', 'Ánh sáng mạnh'], ['soft-light', 'Soft Light', 'Ánh sáng dịu'],
    ['difference', 'Difference', 'Khác biệt'], ['exclusion', 'Exclusion', 'Loại trừ'],
    ['hue', 'Hue', 'Tông màu'], ['saturation', 'Saturation', 'Độ bão hoà'],
    ['color', 'Color', 'Màu'], ['luminosity', 'Luminosity', 'Độ sáng']
  ];

  function t(key) {
    const lang = state.lang || 'en';
    return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  }

  function blendLabel(value) {
    const row = BLEND_MODES.find((item) => item[0] === value) || BLEND_MODES[0];
    return state.lang === 'vi' ? row[2] : row[1];
  }

  function applyLanguage() {
    document.documentElement.lang = state.lang === 'vi' ? 'vi' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    const toggle = $('langToggleBtn');
    if (toggle) {
      toggle.textContent = state.lang === 'vi' ? 'VI' : 'EN';
      toggle.title = state.lang === 'vi' ? 'Chuyển sang tiếng Anh' : 'Switch to Vietnamese';
    }
    fillBlendSelects();
    updateAllUI();
    renderHome();
  }

  function fillBlendSelects() {
    ['blendMode', 'lpBlend'].forEach((id) => {
      const select = $(id);
      if (!select) return;
      const current = select.value || 'source-over';
      select.innerHTML = BLEND_MODES.map(([value]) => `<option value="${value}">${escapeHtml(blendLabel(value))}</option>`).join('');
      select.value = current;
    });
  }

  function setLanguage(lang) {
    state.lang = lang === 'vi' ? 'vi' : 'en';
    const settings = getSettings();
    settings.lang = state.lang;
    writeSettings(settings);
    applyLanguage();
  }

  function showPlannedNotice(label) {
    showNotice(label || t('planned'), t('plannedBody'));
  }

  /* ---------------- Background styles ---------------- */

  const ROBLOX_TEXTURES = [
    { id: 'brick', name: 'Brick' },
    { id: 'cobblestone', name: 'Cobblestone' },
    { id: 'concrete', name: 'Concrete' },
    { id: 'corrodedmetal', name: 'Corroded Metal' },
    { id: 'diamondplate', name: 'Diamond Plate' },
    { id: 'fabric', name: 'Fabric' },
    { id: 'glass', name: 'Glass' },
    { id: 'granite', name: 'Granite' },
    { id: 'grass', name: 'Grass' },
    { id: 'marble', name: 'Marble' },
    { id: 'metal', name: 'Metal' },
    { id: 'pebble', name: 'Pebble' },
    { id: 'sand', name: 'Sand' },
    { id: 'slate', name: 'Slate' },
    { id: 'wood', name: 'Wood' },
    { id: 'woodplanks', name: 'Wood Planks' }
  ];

  const texturePatternCache = new Map();
  const loadedTextureImages = new Map();

  async function textureManifestEntries() {
    if (window.exArtboothAPI && typeof window.exArtboothAPI.listTextures === 'function') {
      try {
        const entries = await window.exArtboothAPI.listTextures();
        if (Array.isArray(entries) && entries.length) return entries;
      } catch (_err) { /* fall through */ }
    }
    try {
      const response = await fetch('textures/textures.json', { cache: 'no-store' });
      if (response.ok) {
        const manifest = await response.json();
        if (Array.isArray(manifest.textures)) return manifest.textures;
      }
    } catch (_err) { /* file:// blocks fetch: use the built-in list below */ }
    return ROBLOX_TEXTURES.map((item) => ({ id: item.id, name: item.name, file: `${item.id}.jpg` }));
  }

  function loadTextureFile(entry) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const tile = document.createElement('canvas');
        tile.width = img.naturalWidth || img.width || 512;
        tile.height = img.naturalHeight || img.height || 512;
        tile.getContext('2d').drawImage(img, 0, 0);
        loadedTextureImages.set(entry.id, tile);
        texturePatternCache.set(entry.id, tile);
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = `textures/${entry.file}`;
    });
  }

  async function loadTextureManifest() {
    const entries = await textureManifestEntries();
    for (const entry of entries) {
      if (!entry || !entry.id || !entry.file) continue;
      const known = ROBLOX_TEXTURES.find((item) => item.id === entry.id);
      if (known) { if (entry.name) known.name = entry.name; }
      else ROBLOX_TEXTURES.push({ id: entry.id, name: entry.name || entry.id });
      await loadTextureFile(entry);
    }
    if (loadedTextureImages.size) {
      updateAllUI();
      render();
    }
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function textureTile(id) {
    if (texturePatternCache.has(id)) return texturePatternCache.get(id);
    const size = 128;
    const tile = document.createElement('canvas');
    tile.width = size;
    tile.height = size;
    const ctx = tile.getContext('2d');
    const rand = seededRandom(id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0) * 31, 7));
    const noise = (amount, alpha = 0.16) => {
      for (let i = 0; i < amount; i += 1) {
        const x = rand() * size;
        const y = rand() * size;
        const r = rand() * 2.4 + 0.3;
        ctx.fillStyle = `rgba(0,0,0,${alpha * rand()})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${alpha * rand() * 0.8})`;
        ctx.beginPath(); ctx.arc(rand() * size, rand() * size, r, 0, Math.PI * 2); ctx.fill();
      }
    };
    const base = (color) => { ctx.fillStyle = color; ctx.fillRect(0, 0, size, size); };

    if (id === 'brick') {
      base('#9c4a33');
      ctx.fillStyle = '#d7cfc4';
      const bh = size / 4;
      for (let row = 0; row < 4; row += 1) {
        const offset = row % 2 ? size / 4 : 0;
        ctx.fillRect(0, row * bh - 3, size, 4);
        for (let col = 0; col < 2; col += 1) ctx.fillRect(((col * size) / 2 + offset) % size, row * bh, 4, bh);
      }
      noise(220, 0.2);
    } else if (id === 'cobblestone') {
      base('#7b7b74');
      for (let i = 0; i < 26; i += 1) {
        ctx.beginPath();
        ctx.ellipse(rand() * size, rand() * size, 9 + rand() * 9, 7 + rand() * 7, rand() * Math.PI, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${150 + rand() * 50 | 0},${148 + rand() * 46 | 0},${140 + rand() * 44 | 0},.85)`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,40,40,.5)'; ctx.lineWidth = 2; ctx.stroke();
      }
      noise(200, 0.18);
    } else if (id === 'concrete') { base('#b3b2ad'); noise(900, 0.2); }
    else if (id === 'corrodedmetal') {
      base('#6f5a45');
      for (let i = 0; i < 40; i += 1) {
        ctx.fillStyle = `rgba(${90 + rand() * 90 | 0},${60 + rand() * 50 | 0},${40 + rand() * 40 | 0},.6)`;
        ctx.beginPath(); ctx.arc(rand() * size, rand() * size, rand() * 14, 0, Math.PI * 2); ctx.fill();
      }
      noise(500, 0.26);
    } else if (id === 'diamondplate') {
      base('#8e939b');
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 5;
      for (let i = -size; i < size * 2; i += 26) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i + size, 0); ctx.lineTo(i, size); ctx.stroke();
      }
      noise(160, 0.14);
    } else if (id === 'fabric') {
      base('#8d7fb5');
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2;
      for (let i = 0; i < size; i += 6) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
      }
      noise(420, 0.14);
    } else if (id === 'foil') {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#d8dee8'); grad.addColorStop(0.5, '#f3f6fb'); grad.addColorStop(1, '#c3ccd9');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
      noise(240, 0.1);
    } else if (id === 'grass') {
      base('#4e8b3c');
      for (let i = 0; i < 700; i += 1) {
        const x = rand() * size; const y = rand() * size;
        ctx.strokeStyle = `rgba(${40 + rand() * 60 | 0},${110 + rand() * 70 | 0},${40 + rand() * 40 | 0},.75)`;
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rand() - 0.5) * 5, y - 4 - rand() * 5); ctx.stroke();
      }
    } else if (id === 'granite') { base('#8f8f94'); noise(1400, 0.3); }
    else if (id === 'ice') {
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#cfe9f7'); grad.addColorStop(1, '#9fd0ec');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 16; i += 1) {
        ctx.beginPath(); ctx.moveTo(rand() * size, rand() * size);
        ctx.lineTo(rand() * size, rand() * size); ctx.stroke();
      }
    } else if (id === 'marble') {
      base('#efeee9');
      ctx.strokeStyle = 'rgba(120,124,133,.5)';
      for (let i = 0; i < 14; i += 1) {
        ctx.lineWidth = rand() * 2.6 + 0.4;
        ctx.beginPath();
        let x = rand() * size; let y = 0;
        ctx.moveTo(x, y);
        while (y < size) { y += 8; x += (rand() - 0.5) * 22; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    } else if (id === 'metal') {
      base('#a9afb7');
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1;
      for (let i = 0; i < size; i += 3) { ctx.beginPath(); ctx.moveTo(0, i + rand()); ctx.lineTo(size, i + rand()); ctx.stroke(); }
      noise(160, 0.1);
    } else if (id === 'pebble') {
      base('#938c80');
      for (let i = 0; i < 70; i += 1) {
        ctx.beginPath(); ctx.arc(rand() * size, rand() * size, 3 + rand() * 7, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${150 + rand() * 60 | 0},${145 + rand() * 55 | 0},${132 + rand() * 50 | 0},.9)`; ctx.fill();
        ctx.strokeStyle = 'rgba(60,56,50,.45)'; ctx.lineWidth = 1.2; ctx.stroke();
      }
    } else if (id === 'sand') { base('#e0cb9a'); noise(1500, 0.16); }
    else if (id === 'slate') {
      base('#5f6670');
      for (let i = 0; i < 10; i += 1) {
        ctx.fillStyle = `rgba(${80 + rand() * 40 | 0},${88 + rand() * 40 | 0},${98 + rand() * 40 | 0},.75)`;
        ctx.fillRect(0, (i * size) / 10, size, size / 10 - 1);
      }
      noise(600, 0.2);
    } else if (id === 'wood') {
      base('#a9743f');
      ctx.strokeStyle = 'rgba(90,56,26,.45)';
      for (let i = 0; i < 26; i += 1) {
        ctx.lineWidth = rand() * 3 + 0.6;
        ctx.beginPath();
        let y = rand() * size;
        ctx.moveTo(0, y);
        for (let x = 0; x <= size; x += 10) { y += (rand() - 0.5) * 5; ctx.lineTo(x, y); }
        ctx.stroke();
      }
    } else if (id === 'woodplanks') {
      base('#b87f49');
      ctx.strokeStyle = 'rgba(70,44,20,.6)'; ctx.lineWidth = 3;
      for (let i = 0; i <= 4; i += 1) {
        const y = (i * size) / 4;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(90,56,26,.35)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 40; i += 1) {
        const y = rand() * size;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y + (rand() - 0.5) * 3); ctx.stroke();
      }
    } else { base('#ffffff'); }

    texturePatternCache.set(id, tile);
    return tile;
  }

  function textureName(id) {
    return ROBLOX_TEXTURES.find((item) => item.id === id)?.name || 'Texture';
  }

  function backgroundStyleOf(layer) {
    if (!layer) return { mode: 'color', color: '#ffffff', texture: 'wood' };
    return {
      mode: layer.backgroundMode || 'color',
      color: layer.backgroundColor || '#ffffff',
      texture: layer.backgroundTexture || 'wood'
    };
  }

  function isTransparentBackground(layer) {
    const style = backgroundStyleOf(layer);
    return style.mode === 'grid' || style.mode === 'grid-dark';
  }

  function backgroundLayer() {
    return state.layers.find((layer) => isBackgroundLayer(layer)) || null;
  }

  function checkerColors(layer) {
    const style = backgroundStyleOf(layer || backgroundLayer());
    if (style.mode === 'grid-dark') return { a: '#2a2f38', b: '#1b1f26' };
    return { a: '#b5bdca', b: '#e6e9ef' };
  }

  function paintBackground(ctx, layer) {
    const style = backgroundStyleOf(layer);
    ctx.clearRect(0, 0, state.width, state.height);
    if (style.mode === 'grid' || style.mode === 'grid-dark') return false;
    if (style.mode === 'texture') {
      const tile = textureTile(style.texture);
      const pattern = ctx.createPattern(tile, 'repeat');
      ctx.fillStyle = pattern || style.color;
      ctx.fillRect(0, 0, state.width, state.height);
      return true;
    }
    ctx.fillStyle = style.color || '#ffffff';
    ctx.fillRect(0, 0, state.width, state.height);
    return true;
  }

  function backgroundDescription(layer) {
    const style = backgroundStyleOf(layer);
    if (style.mode === 'grid') return 'Transparent grid';
    if (style.mode === 'grid-dark') return 'Transparent grid (dark)';
    if (style.mode === 'texture') return `Texture: ${textureName(style.texture)}`;
    return `Color ${String(style.color || '#ffffff').toUpperCase()}`;
  }

  function backgroundPreviewDataUrl(layer, w = 44, h = 34) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const style = backgroundStyleOf(layer);
    if (style.mode === 'grid' || style.mode === 'grid-dark') {
      const colors = checkerColors(layer);
      const size = 7;
      for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
          ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? colors.a : colors.b;
          ctx.fillRect(x, y, size, size);
        }
      }
    } else if (style.mode === 'texture') {
      const tile = textureTile(style.texture);
      ctx.drawImage(tile, 0, 0, tile.width, tile.height, 0, 0, w, h);
    } else {
      ctx.fillStyle = style.color || '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    return canvas.toDataURL('image/png');
  }

  // Write a background style onto one background layer.
  function writeBackgroundStyle(layer, style) {
    layer.backgroundMode = style.mode;
    if (style.color) layer.backgroundColor = style.color;
    if (style.texture) layer.backgroundTexture = style.texture;
    layer.name = 'Background';
    layer.visible = true;
    layer.opacity = 1;
  }

  /**
   * Which frames a background change should touch.
   * @param {object} scope { mode: 'frame' | 'all' | 'range', from, to } - from/to
   *   are 1-based and inclusive, matching what the frame strip shows the user.
   * @returns {number[]} zero-based frame indexes
   */
  function backgroundTargetFrames(scope) {
    const count = state.frames.length;
    if (!scope || scope.mode === 'frame' || count <= 1) return [state.frameIndex];
    if (scope.mode === 'all') return state.frames.map((_frame, index) => index);
    let from = Math.round(Number(scope.from) || 1);
    let to = Math.round(Number(scope.to) || count);
    if (from > to) { const swap = from; from = to; to = swap; }   // tolerate 8 to 3
    from = Math.max(1, Math.min(count, from));
    to = Math.max(1, Math.min(count, to));
    const out = [];
    for (let i = from - 1; i <= to - 1; i++) out.push(i);
    return out;
  }

  function applyBackgroundStyle(style, scope) {
    const layer = backgroundLayer();
    if (!layer || !style) return;

    // Make sure the live layer list is parked on the current frame before any
    // frame other than this one is touched.
    if (state.frames.length > 1) syncActiveFrame();

    const targets = backgroundTargetFrames(scope);
    pushHistory(targets.length > 1 ? `change background on ${targets.length} frames` : 'change background', []);

    let changed = 0;
    targets.forEach((index) => {
      const frame = state.frames[index];
      if (!frame) return;
      if (index === state.frameIndex || frame.layers === state.layers) {
        // Current frame: history snapshotted this layer's properties, so an
        // in-place write is undoable.
        const current = backgroundLayer();
        if (current) { writeBackgroundStyle(current, style); changed += 1; }
        return;
      }
      const bgIndex = frame.layers.findIndex((item) => isBackgroundLayer(item));
      if (bgIndex < 0) return;
      // Other frames: history holds this frame's layers ARRAY by reference, so
      // replace the array instead of mutating it, or undo would restore the
      // already-changed objects. Pixels are shared; only the style differs.
      const nextLayers = frame.layers.slice();
      const copy = { ...nextLayers[bgIndex] };
      writeBackgroundStyle(copy, style);
      nextLayers[bgIndex] = copy;
      frame.layers = nextLayers;
      changed += 1;
    });

    if (!changed) { setStatus('No background layer was found to change.'); return; }

    markDirty();
    updateAllUI();
    renderFrameStrip();
    render();
    const description = backgroundDescription(backgroundLayer()).toLowerCase();
    setStatus(changed > 1
      ? `Background set to ${description} on ${changed} frames.`
      : `Background set to ${description}.`);
  }

  function openBackgroundDialog() {
    const layer = backgroundLayer();
    if (!layer) { setStatus('This project has no background layer.'); return; }
    const current = backgroundStyleOf(layer);
    const draft = { ...current };
    const frameCount = state.frames.length;
    const multiFrame = isAnimationProject() && frameCount > 1;
    const scope = { mode: 'frame', from: state.frameIndex + 1, to: frameCount };
    const overlay = document.createElement('div');
    overlay.className = 'input-modal-overlay';
    overlay.innerHTML = `
      <div class="input-modal-card background-card" role="dialog" aria-modal="true">
        <h3>Background</h3>
        <p>Pick what the background layer shows. It still stays at the bottom and always fills the canvas.</p>
        <div class="background-modes">
          <button type="button" class="background-mode" data-bg-mode="color"><strong>Color</strong><span>Any solid color</span></button>
          <button type="button" class="background-mode" data-bg-mode="grid"><strong>Transparent grid</strong><span>Light checkerboard</span></button>
          <button type="button" class="background-mode" data-bg-mode="grid-dark"><strong>Transparent grid (dark)</strong><span>Dark checkerboard</span></button>
          <button type="button" class="background-mode" data-bg-mode="texture"><strong>Texture</strong><span>Roblox-style materials</span></button>
        </div>
        <label class="control-label background-color-row">Background color
          <input id="backgroundColorInput" type="color" value="${escapeHtml(draft.color || '#ffffff')}">
        </label>
        <div class="texture-grid" id="textureGrid">
          ${ROBLOX_TEXTURES.map((texture) => `
            <button type="button" class="texture-swatch" data-texture="${texture.id}" title="${escapeHtml(texture.name)}">
              <img alt="${escapeHtml(texture.name)}">
              <span>${escapeHtml(texture.name)}</span>
            </button>`).join('')}
        </div>
        ${multiFrame ? `
        <div class="background-scope">
          <div class="scope-title">${escapeHtml(t('bgApplyTo'))}</div>
          <div class="scope-switch">
            <button type="button" data-scope="frame">${escapeHtml(t('bgThisFrame'))}</button>
            <button type="button" data-scope="all">${escapeHtml(t('bgAllFrames'))}</button>
            <button type="button" data-scope="range">${escapeHtml(t('bgRange'))}</button>
          </div>
          <div class="scope-range">
            <label>${escapeHtml(t('bgFrom'))}
              <input id="bgRangeFrom" type="number" min="1" max="${frameCount}" step="1" value="${state.frameIndex + 1}">
            </label>
            <label>${escapeHtml(t('bgTo'))}
              <input id="bgRangeTo" type="number" min="1" max="${frameCount}" step="1" value="${frameCount}">
            </label>
            <span class="hint small">${escapeHtml(t('bgRangeHint'))} 1-${frameCount}.</span>
          </div>
          <div class="scope-summary" id="bgScopeSummary"></div>
        </div>` : ''}
        <div class="input-modal-actions">
          <button type="button" class="input-cancel">Cancel</button>
          <button type="button" class="input-confirm primary">Apply</button>
        </div>
      </div>`;
    document.body.append(overlay);

    overlay.querySelectorAll('.texture-swatch img').forEach((img) => {
      const id = img.closest('.texture-swatch').dataset.texture;
      const tile = textureTile(id);
      img.src = tile.toDataURL('image/png');
    });

    const syncScope = () => {
      if (!multiFrame) return;
      overlay.querySelectorAll('[data-scope]').forEach((button) => button.classList.toggle('active', button.dataset.scope === scope.mode));
      overlay.querySelector('.scope-range').classList.toggle('hidden', scope.mode !== 'range');
      const targets = backgroundTargetFrames(scope);
      const summary = overlay.querySelector('#bgScopeSummary');
      if (targets.length === 1) summary.textContent = `${t('bgWillChange')} ${t('bgFrameWord')} ${targets[0] + 1}.`;
      else if (targets.length === frameCount) summary.textContent = `${t('bgWillChange')} ${t('bgAllWord')} ${frameCount} ${t('bgFramesWord')}.`;
      else summary.textContent = `${t('bgWillChange')} ${targets.length} ${t('bgFramesWord')} (${targets[0] + 1}-${targets[targets.length - 1] + 1}).`;
    };

    const syncDraft = () => {
      overlay.querySelectorAll('[data-bg-mode]').forEach((button) => button.classList.toggle('active', button.dataset.bgMode === draft.mode));
      overlay.querySelectorAll('.texture-swatch').forEach((button) => button.classList.toggle('active', button.dataset.texture === draft.texture));
      overlay.querySelector('.background-color-row').classList.toggle('hidden', draft.mode !== 'color');
      overlay.querySelector('#textureGrid').classList.toggle('hidden', draft.mode !== 'texture');
    };
    overlay.querySelectorAll('[data-bg-mode]').forEach((button) => button.addEventListener('click', () => { draft.mode = button.dataset.bgMode; syncDraft(); }));
    overlay.querySelectorAll('.texture-swatch').forEach((button) => button.addEventListener('click', () => { draft.texture = button.dataset.texture; draft.mode = 'texture'; syncDraft(); }));
    overlay.querySelector('#backgroundColorInput').addEventListener('input', (event) => { draft.color = event.target.value; draft.mode = 'color'; syncDraft(); });
    if (multiFrame) {
      overlay.querySelectorAll('[data-scope]').forEach((button) => button.addEventListener('click', () => { scope.mode = button.dataset.scope; syncScope(); }));
      const fromInput = overlay.querySelector('#bgRangeFrom');
      const toInput = overlay.querySelector('#bgRangeTo');
      const readRange = () => {
        scope.from = Number(fromInput.value);
        scope.to = Number(toInput.value);
        scope.mode = 'range';
        syncScope();
      };
      fromInput.addEventListener('input', readRange);
      toInput.addEventListener('input', readRange);
    }
    const close = () => overlay.remove();
    overlay.querySelector('.input-cancel').addEventListener('click', close);
    overlay.querySelector('.input-confirm').addEventListener('click', () => { close(); applyBackgroundStyle(draft, multiFrame ? scope : null); });
    overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) close(); });
    syncDraft();
    syncScope();
  }

  /* ---------------- Animation frames ---------------- */

  function isAnimationProject() {
    const meta = state.projectMeta || {};
    if (meta.kind) return meta.kind === 'animation';
    if (String(meta.category || '').toLowerCase() === 'animation') return true;
    return (state.frames?.length || 0) > 1;
  }

  function updateFrameBarVisibility() {
    const bar = $('frameBar');
    if (!bar) return;
    const show = isAnimationProject();
    bar.classList.toggle('hidden', !show);
    canvasArea.classList.toggle('no-frame-bar', !show);
    if (!show && state.isPlaying) stopPlayback();
  }

  function currentFps() {
    const value = Number(state.projectMeta?.fps);
    return Number.isFinite(value) && value >= 0.001 ? value : 24;
  }

  function setFps(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0.001) return currentFps();
    const fps = Math.min(1000, n);
    state.projectMeta = state.projectMeta || {};
    state.projectMeta.fps = fps;
    markDirty();
    return fps;
  }

  function formatFps(value) {
    const n = Number(value) || 0;
    return String(Number(n.toFixed(3)));
  }

  function createFrame(layers, name) {
    return { id: uid(), name: name || '', layers: layers || [] };
  }

  function syncActiveFrame() {
    if (!state.frames.length) {
      state.frames = [createFrame(state.layers)];
      state.frameIndex = 0;
      return;
    }
    state.frameIndex = Math.max(0, Math.min(state.frames.length - 1, state.frameIndex));
    state.frames[state.frameIndex].layers = state.layers;
  }

  function resetFrames(layers) {
    state.frames = [createFrame(layers || state.layers)];
    state.frameIndex = 0;
    stopPlayback();
  }

  function cloneLayerDeep(layer) {
    const copy = { ...layer, id: uid() };
    if (layer.kind === 'raster') {
      copy.canvas = cloneCanvas(layer.canvas);
      copy.mask = layer.mask ? cloneCanvas(layer.mask) : null;
    }
    if (layer.adjustment) copy.adjustment = { ...layer.adjustment };
    return copy;
  }

  function blankFrameLayers() {
    const source = state.layers.find((layer) => isBackgroundLayer(layer));
    const background = createBackgroundLayer(source?.backgroundColor || '#ffffff');
    const paint = createRasterLayer('Layer 1');
    return [background, paint];
  }

  function duplicateFrameLayers() {
    return state.layers.map(cloneLayerDeep);
  }

  function goToFrame(index, options = {}) {
    syncActiveFrame();
    const next = Math.max(0, Math.min(state.frames.length - 1, index));
    state.frameIndex = next;
    resetHistory();
    state.layers = state.frames[next].layers;
    const topLayer = state.layers[state.layers.length - 1];
    if (!state.layers.some((layer) => layer.id === state.selectedLayerId)) {
      state.selectedLayerId = topLayer ? topLayer.id : null;
    }
    state.cropRect = null;
    state.moveSession = null;
    updateAllUI();
    renderFrameStrip();
    render();
    if (options.silent !== true) setStatus(`Frame ${next + 1} of ${state.frames.length}`);
  }

  async function addFrame() {
    if (!isAnimationProject()) {
      showNotice('Frames are for animation projects', 'This project is not an animation, so it uses a single canvas. Create a new project from the Animation templates to work with frames.');
      return;
    }
    syncActiveFrame();
    const mode = await requestFrameMode();
    if (mode) pushHistory('add frame', []);
    if (!mode) return;
    const layers = mode === 'duplicate' ? duplicateFrameLayers() : blankFrameLayers();
    const frame = createFrame(layers);
    state.frames.splice(state.frameIndex + 1, 0, frame);
    markDirty();
    goToFrame(state.frameIndex + 1, { silent: true });
    setStatus(mode === 'duplicate'
      ? `Frame ${state.frameIndex + 1} added as a copy of the previous frame, layers included.`
      : `Frame ${state.frameIndex + 1} added as a new empty frame.`);
  }

  function deleteFrame(index) {
    if (state.frames.length <= 1) {
      setStatus('A project needs at least one frame.');
      return;
    }
    syncActiveFrame();
    state.frames.splice(index, 1);
    markDirty();
    goToFrame(Math.min(index, state.frames.length - 1), { silent: true });
    setStatus(`Frame deleted. ${state.frames.length} frames left.`);
  }

  function requestFrameMode() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'input-modal-overlay';
      overlay.innerHTML = `
        <div class="input-modal-card png-export-card" role="dialog" aria-modal="true">
          <h3>Add frame</h3>
          <p>Choose how frame ${state.frames.length + 1} should start.</p>
          <div class="export-choice-grid">
            <button type="button" class="export-choice" data-mode="new">
              <strong>New frame</strong>
              <span>Start empty with a background and one blank layer.</span>
            </button>
            <button type="button" class="export-choice" data-mode="duplicate">
              <strong>Duplicate previous frame</strong>
              <span>Copy frame ${state.frameIndex + 1} with all of its layers, masks, and settings.</span>
            </button>
          </div>
          <div class="input-modal-actions">
            <button type="button" class="input-cancel">Cancel</button>
          </div>
        </div>`;
      document.body.append(overlay);
      let closed = false;
      const close = (value) => {
        if (closed) return;
        closed = true;
        overlay.remove();
        resolve(value);
      };
      overlay.querySelector('.input-cancel').addEventListener('click', () => close(null));
      overlay.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => close(button.dataset.mode)));
      overlay.addEventListener('pointerdown', (event) => { if (event.target === overlay) close(null); });
    });
  }

  function frameThumbnail(frame) {
    const maxSide = 108;
    const scale = Math.min(maxSide / Math.max(1, state.width), maxSide / Math.max(1, state.height));
    const w = Math.max(16, Math.round(state.width * scale));
    const h = Math.max(16, Math.round(state.height * scale));
    const comp = renderComposite({ layers: frame.layers, target: onionCanvas });
    frameThumbCanvas.width = w;
    frameThumbCanvas.height = h;
    const ctx = frameThumbCanvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(comp, 0, 0, w, h);
    return frameThumbCanvas.toDataURL('image/png');
  }

  function renderFrameStrip() {
    const strip = $('frameStrip');
    if (!strip) return;
    syncActiveFrame();
    updateFrameBarVisibility();
    if (!isAnimationProject()) { strip.innerHTML = ''; return; }
    strip.innerHTML = '';
    state.frames.forEach((frame, index) => {
      const cell = document.createElement('div');
      cell.className = 'frame-cell' + (index === state.frameIndex ? ' active' : '');
      cell.title = `Frame ${index + 1}`;
      const img = document.createElement('img');
      try { img.src = frameThumbnail(frame); } catch (_err) { /* ignore thumbnail failure */ }
      const label = document.createElement('span');
      label.className = 'frame-index';
      label.textContent = String(index + 1);
      cell.append(img, label);
      if (state.frames.length > 1) {
        const remove = document.createElement('button');
        remove.className = 'frame-remove';
        remove.textContent = '×';
        remove.title = 'Delete this frame';
        remove.addEventListener('click', (event) => { event.stopPropagation(); deleteFrame(index); });
        cell.append(remove);
      }
      cell.addEventListener('click', () => goToFrame(index));
      strip.append(cell);
    });
    const fpsInput = $('frameFpsInput');
    if (fpsInput && document.activeElement !== fpsInput) fpsInput.value = formatFps(currentFps());
    const onion = $('onionToggle');
    if (onion) onion.checked = Boolean(state.onionSkin);
    const play = $('framePlayBtn');
    if (play) {
      play.innerHTML = iconMarkup(state.isPlaying ? 'stop' : 'play');
      play.title = state.isPlaying ? 'Stop playback' : 'Play the frame sequence';
    }
    const active = strip.querySelector('.frame-cell.active');
    if (active && typeof active.scrollIntoView === 'function') active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function stopPlayback() {
    if (state.playTimer) clearTimeout(state.playTimer);
    state.playTimer = null;
    state.isPlaying = false;
    const play = $('framePlayBtn');
    if (play) { play.innerHTML = iconMarkup('play'); play.title = 'Play the frame sequence'; }
  }

  function togglePlayback() {
    if (state.isPlaying) {
      stopPlayback();
      renderFrameStrip();
      setStatus('Playback stopped.');
      return;
    }
    if (state.frames.length < 2) {
      setStatus('Add a second frame to play the animation.');
      return;
    }
    syncActiveFrame();
    state.isPlaying = true;
    renderFrameStrip();
    const step = () => {
      if (!state.isPlaying) return;
      goToFrame((state.frameIndex + 1) % state.frames.length, { silent: true });
      setStatus(`Playing ${formatFps(currentFps())} fps • frame ${state.frameIndex + 1}/${state.frames.length}`);
      state.playTimer = setTimeout(step, Math.max(1, 1000 / currentFps()));
    };
    state.playTimer = setTimeout(step, Math.max(1, 1000 / currentFps()));
  }

  function previousFrameLayers() {
    if (!state.onionSkin || state.isPlaying) return null;
    if (state.frameIndex <= 0 || !state.frames.length) return null;
    const previous = state.frames[state.frameIndex - 1];
    return previous ? previous.layers : null;
  }

  function render() {
    ensureViewportSize(); computeViewTransform();
    vctx.setTransform(1, 0, 0, 1, 0, 0); vctx.fillStyle = '#0a0d13'; vctx.fillRect(0, 0, viewport.width, viewport.height);
    const x = state.view.offsetX, y = state.view.offsetY, w = state.width * state.view.scale, h = state.height * state.view.scale;
    drawChecker(vctx, x, y, w, h, Math.max(8, 18 * state.view.scale), checkerColors());
    vctx.imageSmoothingEnabled = state.view.scale < 1;
    const ghostLayers = previousFrameLayers();
    if (ghostLayers) {
      const base = renderComposite({ layers: state.layers });
      vctx.drawImage(base, x, y, w, h);
      const ghost = renderComposite({ layers: ghostLayers, includeBackground: false, target: onionCanvas });
      vctx.save(); vctx.globalAlpha = 0.2; vctx.drawImage(ghost, x, y, w, h); vctx.restore();
      const front = renderComposite({ layers: state.layers, includeBackground: false });
      vctx.drawImage(front, x, y, w, h);
    } else {
      const comp = renderComposite();
      vctx.drawImage(comp, x, y, w, h);
    }
    vctx.save(); vctx.strokeStyle = 'rgba(255,255,255,0.72)'; vctx.lineWidth = 1; vctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h)); vctx.restore();
    if (state.previewShape) drawOverlayRect(state.previewShape, state.activeTool === 'ellipse' ? 'ellipse' : 'rect', '#2fe6a6');
    if (state.cropRect) drawCropOverlay(state.cropRect);
    $('documentInfo').textContent = `${state.width} × ${state.height}`; $('zoomLabel').textContent = `${Math.round(state.view.zoom * 100)}%`;
    // The ring scales with the zoom, so keep it in step with every redraw.
    drawBrushCursor();
  }

  function drawOverlayRect(rect, mode, color) {
    const a = imageToScreen({ x: rect.x, y: rect.y }); const b = imageToScreen({ x: rect.x + rect.w, y: rect.y + rect.h });
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    vctx.save(); vctx.strokeStyle = color; vctx.fillStyle = hexToRgba(color, 0.14); vctx.lineWidth = 2; vctx.setLineDash([8, 6]); vctx.beginPath();
    if (mode === 'ellipse') vctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); else vctx.rect(x, y, w, h);
    vctx.fill(); vctx.stroke(); vctx.restore();
  }

  function drawCropOverlay(rect) {
    const r = clampRectToCanvas(rect); const tl = imageToScreen({ x: 0, y: 0 }); const br = imageToScreen({ x: state.width, y: state.height }); const a = imageToScreen({ x: r.x, y: r.y }); const b = imageToScreen({ x: r.x + r.w, y: r.y + r.h });
    vctx.save(); vctx.fillStyle = 'rgba(0,0,0,0.45)';
    vctx.fillRect(tl.x, tl.y, br.x - tl.x, a.y - tl.y); vctx.fillRect(tl.x, b.y, br.x - tl.x, br.y - b.y); vctx.fillRect(tl.x, a.y, a.x - tl.x, b.y - a.y); vctx.fillRect(b.x, a.y, br.x - b.x, b.y - a.y);
    vctx.strokeStyle = '#ffdc64'; vctx.lineWidth = 2; vctx.setLineDash([10, 5]); vctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); vctx.restore();
  }

  function kindLabel(layer) {
    if (!layer) return '';
    if (isBackgroundLayer(layer)) return backgroundDescription(layer);
    if (layer.kind === 'raster') return layer.mask ? 'Raster + mask' : 'Raster';
    if (layer.kind === 'adjustment') return 'Adjustment';
    if (layer.kind === 'text') return 'Editable text';
    if (layer.kind === 'shape') return layer.shape === 'ellipse' ? 'Vector ellipse' : 'Vector rectangle';
    return layer.kind;
  }


  /* ---------------- Brush cursor ----------------
     Drawn on its own overlay canvas that the stylesheet composites with
     mix-blend-mode: difference, so every colour in the ring is the inverse of
     the artwork beneath it. A white ring on white paper was invisible. */

  // Tools that paint, and so deserve a size-accurate ring.
  const RING_TOOLS = { brush: 1, eraser: 1, heal: 1, clone: 1 };

  // Every painting tool uses the one brush size control.
  function cursorRadiusFor() {
    return Math.max(0.5, (Number(state.brushSize) || 1) / 2);
  }

  function sizeCursorOverlay() {
    if (!cursorOverlay) return;
    if (cursorOverlay.width !== viewport.width || cursorOverlay.height !== viewport.height) {
      cursorOverlay.width = viewport.width;
      cursorOverlay.height = viewport.height;
    }
  }

  function clearCursorOverlay() {
    if (!cctx) return;
    sizeCursorOverlay();
    cctx.clearRect(0, 0, cursorOverlay.width, cursorOverlay.height);
  }

  function drawBrushCursor() {
    if (!cctx) return;
    sizeCursorOverlay();
    cctx.clearRect(0, 0, cursorOverlay.width, cursorOverlay.height);

    const point = state.cursorPoint;
    const showRing = point && !state.isViewPanning && RING_TOOLS[state.activeTool] && !$('editorView').classList.contains('hidden');
    viewport.classList.toggle('brush-cursor', Boolean(showRing));
    if (!showRing) return;

    const radius = cursorRadiusFor() * state.view.scale;
    const x = point.clientX;
    const y = point.clientY;

    // White on a difference-blended layer inverts the pixels underneath.
    cctx.save();
    cctx.strokeStyle = '#ffffff';
    cctx.lineWidth = 1;

    if (radius >= 2) {
      cctx.beginPath();
      cctx.arc(x, y, radius, 0, Math.PI * 2);
      cctx.stroke();
      // A second ring one pixel out keeps the outline readable on busy art.
      if (radius > 6) {
        cctx.globalAlpha = 0.45;
        cctx.beginPath();
        cctx.arc(x, y, radius + 1, 0, Math.PI * 2);
        cctx.stroke();
        cctx.globalAlpha = 1;
      }
    }

    // Centre cross, so the exact point is clear even with a huge brush.
    const arm = radius < 6 ? 6 : 4;
    cctx.beginPath();
    cctx.moveTo(x - arm, y); cctx.lineTo(x + arm, y);
    cctx.moveTo(x, y - arm); cctx.lineTo(x, y + arm);
    cctx.stroke();
    cctx.restore();
  }

  function setCursorPoint(event) {
    const rect = viewport.getBoundingClientRect();
    state.cursorPoint = { clientX: event.clientX - rect.left, clientY: event.clientY - rect.top };
    drawBrushCursor();
  }

  function hideBrushCursor() {
    state.cursorPoint = null;
    clearCursorOverlay();
    viewport.classList.remove('brush-cursor');
  }

  /* ---------------- Tab: brush <-> eraser ---------------- */

  function toggleBrushEraser() {
    // From any other tool, Tab lands on the brush first.
    const next = state.activeTool === 'brush' ? 'eraser' : 'brush';
    state.activeTool = next;
    if (next !== 'crop') state.cropRect = null;
    updateToolButtons();
    drawBrushCursor();
    render();
    setStatus(next === 'eraser' ? 'Eraser (Tab to switch back).' : 'Brush (Tab to switch to the eraser).');
  }

  function updateToolButtons() {
    // A project saved before the Move tool was removed can still name it.
    if (!document.querySelector(`.tool[data-tool="${state.activeTool}"]`)) state.activeTool = 'brush';
    document.querySelectorAll('.tool').forEach((button) => button.classList.toggle('active', button.dataset.tool === state.activeTool));
  }
  function updateBrushControls() {
    $('colorInput').value = state.brushColor; $('brushSize').value = state.brushSize; $('brushSizeText').textContent = String(state.brushSize);
    $('brushOpacity').value = Math.round(state.brushOpacity * 100); $('brushOpacityText').textContent = `${Math.round(state.brushOpacity * 100)}%`;
    $('fontSize').value = state.fontSize; $('fontFamily').value = state.fontFamily; $('strokeWidth').value = state.strokeWidth; $('fillColor').value = state.fillColor; $('shapeStrokeColor').value = state.strokeColor;
  }

  function updateLayerList() {
    const list = $('layerList');
    if (!list) return;
    list.innerHTML = '';
    [...state.layers].reverse().forEach((layer, reverseIndex) => {
      const index = state.layers.length - 1 - reverseIndex;
      const isBg = isBackgroundLayer(layer);
      const row = document.createElement('div');
      const lockedLayer = isLayerLocked(layer);
      row.className = 'lp-row'
        + (layer.id === state.selectedLayerId ? ' selected' : '')
        + (isBg ? ' background-layer-row' : '')
        + (layer.clipped ? ' clipped' : '')
        + (lockedLayer ? ' locked-row' : '');
      row.dataset.layerIndex = String(index);
      if (!isBg && !lockedLayer) row.draggable = true;
      row.addEventListener('click', () => {
        state.selectedLayerId = layer.id;
        updateAllUI();
        render();
      });

      const thumb = document.createElement('div');
      thumb.className = 'lp-thumb';
      const img = document.createElement('img');
      try { img.src = layerThumbnailDataUrl(layer); } catch (_err) { /* ignore */ }
      thumb.append(img);
      if (isBg) {
        thumb.title = t('backgroundColor');
        thumb.addEventListener('click', (event) => { event.stopPropagation(); openBackgroundDialog(); });
      }

      const info = document.createElement('div');
      info.className = 'lp-info';
      const title = document.createElement('div');
      title.className = 'lp-title';
      title.textContent = isBg ? t('backgroundColor') : (layer.name || 'Layer');
      const sub = document.createElement('div');
      sub.className = 'lp-sub';
      sub.textContent = isBg ? backgroundDescription(layer) : blendLabel(layer.blend || 'source-over');
      const badges = document.createElement('div');
      badges.className = 'lp-badges';
      if (lockedLayer) { const b = document.createElement('span'); b.className = 'badge-lock'; b.innerHTML = iconMarkup('lock'); b.title = t('locked'); badges.append(b); }
      if (layer.clipped) { const b = document.createElement('span'); b.innerHTML = iconMarkup('clip'); b.title = t('clipping'); badges.append(b); }
      if (layer.alphaLock) { const b = document.createElement('span'); b.innerHTML = iconMarkup('alpha'); b.title = t('alphaLock'); badges.append(b); }
      if (layer.mask) { const b = document.createElement('span'); b.innerHTML = iconMarkup('mask'); b.title = 'Mask'; badges.append(b); }
      info.append(title, sub, badges);

      const eye = document.createElement('button');
      eye.className = 'lp-eye' + (layer.visible ? ' on' : '');
      eye.innerHTML = iconMarkup(layer.visible ? 'eye' : 'eye-off');
      eye.title = isBg ? t('backgroundColor') : 'Toggle visibility';
      eye.addEventListener('click', (event) => {
        event.stopPropagation();
        if (isBg) { openBackgroundDialog(); return; }
        layer.visible = !layer.visible;
        markDirty(); updateAllUI(); render();
      });

      const percent = document.createElement('div');
      percent.className = 'lp-percent';
      percent.textContent = isBg ? '100%' : `${Math.round(layer.opacity * 100)}%`;

      const handle = document.createElement('button');
      handle.className = 'lp-handle';
      handle.innerHTML = iconMarkup('grip');
      handle.title = isBg ? t('backgroundColor') : 'Drag to reorder';
      if (isBg) {
        handle.addEventListener('click', (event) => { event.stopPropagation(); openBackgroundDialog(); });
      }

      row.append(thumb, info, eye, percent, handle);

      if (!isBg && !lockedLayer) {
        row.addEventListener('dragstart', (event) => {
          row.classList.add('dragging');
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));
          }
        });
        row.addEventListener('dragend', () => row.classList.remove('dragging'));
        row.addEventListener('dragover', (event) => { event.preventDefault(); row.classList.add('drop-target'); });
        row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
        row.addEventListener('drop', (event) => {
          event.preventDefault();
          row.classList.remove('drop-target');
          const from = Number(event.dataTransfer?.getData('text/plain'));
          if (Number.isFinite(from)) moveLayerToIndex(from, index);
        });
      }

      list.append(row);
    });
    updateLayerPanel();
  }

  function setAdjInput(key, value) { const input = document.querySelector(`.adj[data-adj="${key}"]`); if (!input) return; input.value = Number(value); const label = $(`${key}Text`); if (label) label.textContent = String(Number(value)); }

  function updatePropertiesPanel() {
    const layer = selectedLayer(); const disabled = !layer; const lockedBg = isBackgroundLayer(layer);
    $('layerName').disabled = disabled || lockedBg; $('layerOpacity').disabled = disabled || lockedBg; $('blendMode').disabled = disabled || lockedBg;
    $('addMaskBtn').disabled = disabled || lockedBg || layer.kind !== 'raster'; $('editMask').disabled = disabled || lockedBg || layer.kind !== 'raster' || !layer.mask; $('maskPaintMode').disabled = disabled || lockedBg || layer.kind !== 'raster' || !layer.mask;
    document.querySelectorAll('.adj').forEach((input) => { input.disabled = disabled || lockedBg || layer.kind === 'shape' || layer.kind === 'text'; }); $('textValue').disabled = disabled || layer.kind !== 'text';
    const userLocked = isLayerLocked(layer);
    if (userLocked) {
      $('layerName').disabled = true;
      $('addMaskBtn').disabled = true;
      $('editMask').disabled = true;
      $('maskPaintMode').disabled = true;
      document.querySelectorAll('.adj').forEach((input) => { input.disabled = true; });
      $('textValue').disabled = true;
    }
    $('backgroundStyleBtn').classList.toggle('hidden', !lockedBg);
    if (!layer) return;
    $('layerName').value = layer.name || ''; $('layerOpacity').value = Math.round(layer.opacity * 100); $('layerOpacityText').textContent = `${Math.round(layer.opacity * 100)}%`; $('blendMode').value = layer.blend || 'source-over'; $('editMask').checked = Boolean(layer.editMask);
    const adj = layer.adjustment || defaultAdjustment(); setAdjInput('brightness', adj.brightness || 0); setAdjInput('contrast', adj.contrast || 0); setAdjInput('exposure', adj.exposure || 0); setAdjInput('saturation', adj.saturation || 0); setAdjInput('hue', adj.hue || 0);
    if (layer.kind === 'text') { $('textValue').value = layer.text || ''; $('fillColor').value = layer.fill || state.brushColor; $('fontSize').value = layer.fontSize || state.fontSize; $('fontFamily').value = layer.fontFamily || state.fontFamily; $('strokeWidth').value = layer.strokeWidth || 0; $('shapeStrokeColor').value = layer.stroke || state.strokeColor; }
    else if (layer.kind === 'shape') { $('textValue').value = ''; $('fillColor').value = layer.fill || state.fillColor; $('strokeWidth').value = layer.strokeWidth || 0; $('shapeStrokeColor').value = layer.stroke || state.strokeColor; }
    else { $('textValue').value = ''; }
  }
  function updateAllUI() { updateToolButtons(); updateLayerList(); updatePropertiesPanel(); updateBrushControls(); }

  let frameStripTimer = null;
  function scheduleFrameStripRefresh() {
    if (frameStripTimer) clearTimeout(frameStripTimer);
    frameStripTimer = setTimeout(() => { frameStripTimer = null; if (!state.isPlaying) renderFrameStrip(); }, 320);
  }

  function getEditableRasterLayer() { const layer = selectedLayer(); if (!layer) { setStatus('No layer selected.'); return null; } if (blockedByLock(layer, 'paint on it')) return null; if (isBackgroundLayer(layer)) { setStatus('Background is locked and always fills the canvas. Add a raster layer to paint or erase.'); return null; } if (layer.kind !== 'raster') { setStatus('Select a raster layer for brush, eraser, heal, clone, or mask painting.'); return null; } return layer; }
  function addMask(layer = selectedLayer()) {
    if (!layer || layer.kind !== 'raster' || isBackgroundLayer(layer)) return;
    if (blockedByLock(layer, 'add a mask')) return;
    pushHistory('add mask', [layer.id]);
    if (!layer.mask) { layer.mask = makeCanvas(); const mctx = layer.mask.getContext('2d'); mctx.fillStyle = 'rgba(255,255,255,1)'; mctx.fillRect(0, 0, state.width, state.height); layer.editMask = true; markDirty(); updateAllUI(); render(); setStatus('Layer mask added. Paint black to hide or white to reveal.'); }
  }
  function targetContextForBrush(layer, tool) { if (layer.editMask) { if (!layer.mask) addMask(layer); return { ctx: layer.mask.getContext('2d'), isMask: true }; } return { ctx: layer.canvas.getContext('2d'), isMask: false, erasing: tool === 'eraser', alphaLock: Boolean(layer.alphaLock) }; }

  function drawBrushLine(from, to, event) {
    const layer = getEditableRasterLayer(); if (!layer) return;
    const pressure = event && event.pressure && event.pressure > 0 ? event.pressure : 1; const size = Math.max(1, state.brushSize * pressure); const { ctx, isMask, erasing, alphaLock } = targetContextForBrush(layer, state.activeTool);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = size; ctx.globalAlpha = state.brushOpacity;
    if (isMask) { if ($('maskPaintMode').value === 'hide') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = 'rgba(0,0,0,1)'; } else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(255,255,255,1)'; } }
    else if (erasing) { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = 'rgba(0,0,0,1)'; }
    else { ctx.globalCompositeOperation = alphaLock ? 'source-atop' : 'source-over'; ctx.strokeStyle = state.brushColor; }
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke(); ctx.restore(); markDirty();
  }

  function spotHealAt(point) {
    const layer = getEditableRasterLayer(); if (!layer || layer.editMask) return;
    const radius = Math.max(4, Math.round(state.brushSize / 2)); const ctx = layer.canvas.getContext('2d'); const x = Math.round(point.x), y = Math.round(point.y);
    const sx = Math.max(0, x - radius * 2), sy = Math.max(0, y - radius * 2), sw = Math.min(layer.canvas.width - sx, radius * 4), sh = Math.min(layer.canvas.height - sy, radius * 4); if (sw < 2 || sh < 2) return;
    let imageData; try { imageData = ctx.getImageData(sx, sy, sw, sh); } catch (_err) { return; }
    const data = imageData.data; let r = 0, g = 0, b = 0, a = 0, count = 0; const cx = x - sx, cy = y - sy;
    for (let yy = 0; yy < sh; yy += 1) for (let xx = 0; xx < sw; xx += 1) { const dx = xx - cx, dy = yy - cy, dist = Math.sqrt(dx * dx + dy * dy); if (dist > radius * 1.15 && dist < radius * 2) { const i = (yy * sw + xx) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3]; count += 1; } }
    if (!count) return; r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count); a = Math.round(a / count);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius); gradient.addColorStop(0, `rgba(${r},${g},${b},${(a / 255) * state.brushOpacity})`); gradient.addColorStop(0.74, `rgba(${r},${g},${b},${(a / 255) * state.brushOpacity * 0.8})`); gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.save(); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.restore(); markDirty();
  }

  function cloneStampAt(point) {
    const layer = getEditableRasterLayer(); if (!layer || layer.editMask || !state.cloneSource || !state.cloneStart) return;
    const radius = Math.max(2, Math.round(state.brushSize / 2)); const dx = point.x - state.cloneStart.x, dy = point.y - state.cloneStart.y;
    const sx = Math.round(state.cloneSource.x + dx - radius), sy = Math.round(state.cloneSource.y + dy - radius), tx = Math.round(point.x - radius), ty = Math.round(point.y - radius);
    const ctx = layer.canvas.getContext('2d'); ctx.save(); ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.clip(); ctx.globalAlpha = state.brushOpacity;
    try { ctx.drawImage(layer.canvas, sx, sy, radius * 2, radius * 2, tx, ty, radius * 2, radius * 2); } catch (_err) { /* out-of-bounds clone attempts are ignored */ }
    ctx.restore(); markDirty();
  }

  function addLayer(layer, select = true) { pushHistory(`add ${layer.kind === 'adjustment' ? 'adjustment' : layer.kind} layer`, []); state.layers.push(layer); if (select) state.selectedLayerId = layer.id; markDirty(); updateAllUI(); render(); }
  function duplicateLayer() {
    const layer = selectedLayer();
    if (!layer) return;
    if (isBackgroundLayer(layer)) { setStatus('Background is locked. Add a new raster layer above it instead.'); return; }
    let copy;
    if (layer.kind === 'raster') copy = { ...layer, id: uid(), name: layer.name + ' copy', canvas: cloneCanvas(layer.canvas), mask: cloneCanvas(layer.mask), adjustment: { ...layer.adjustment } };
    else { copy = JSON.parse(JSON.stringify(layer)); copy.id = uid(); copy.name = layer.name + ' copy'; }
    copy.locked = false;
    copy.isBackground = false;
    copy.userLocked = false;
    pushHistory('duplicate layer', []);
    const index = state.layers.findIndex((item) => item.id === layer.id);
    state.layers.splice(index + 1, 0, copy);
    state.selectedLayerId = copy.id;
    markDirty(); updateAllUI(); render();
  }
  function deleteLayer() {
    if (state.layers.length <= 1) { setStatus('A document must keep at least one layer.'); return; }
    const index = state.layers.findIndex((layer) => layer.id === state.selectedLayerId);
    if (index < 0) return;
    if (blockedByLock(state.layers[index], 'delete it')) return;
    if (isBackgroundLayer(state.layers[index])) { setStatus('Background is locked and cannot be deleted.'); return; }
    pushHistory('delete layer', []);
    state.layers.splice(index, 1);
    state.selectedLayerId = state.layers[Math.min(index, state.layers.length - 1)].id;
    markDirty(); updateAllUI(); render();
  }
  function moveLayer(direction) {
    const index = state.layers.findIndex((layer) => layer.id === state.selectedLayerId);
    if (index < 0) return;
    if (blockedByLock(state.layers[index], 'reorder it')) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.layers.length) return;
    if (isBackgroundLayer(state.layers[index]) || isBackgroundLayer(state.layers[newIndex])) {
      setStatus('Background is locked at the bottom of the document.');
      return;
    }
    pushHistory('reorder layers', []);
    const [layer] = state.layers.splice(index, 1);
    state.layers.splice(newIndex, 0, layer);
    markDirty(); updateLayerList(); render();
  }

  async function resizeDocument() {
    const input = await requestTextInput({ title: 'Resize canvas', message: 'Enter new size as WIDTHxHEIGHT, for example 1920x1080.', defaultValue: `${state.width}x${state.height}`, placeholder: '1920x1080', confirmLabel: 'Resize' }); if (!input) return;
    const match = input.toLowerCase().match(/(\d+)\s*[x, ]\s*(\d+)/); if (!match) { showNotice('Invalid size', 'Please use a size like 1920x1080.'); setStatus('Resize canceled: invalid format.'); return; }
    const newW = Math.max(1, Number(match[1])), newH = Math.max(1, Number(match[2]));
    pushHistory('resize canvas', 'all');
    state.layers.forEach((layer) => {
      if (layer.kind === 'raster') { const old = layer.canvas; layer.canvas = makeCanvas(newW, newH); layer.canvas.getContext('2d').drawImage(old, 0, 0, newW, newH); if (layer.mask) { const oldMask = layer.mask; layer.mask = makeCanvas(newW, newH); layer.mask.getContext('2d').drawImage(oldMask, 0, 0, newW, newH); } }
      else if (layer.kind === 'text' || layer.kind === 'shape') { layer.x = (layer.x / state.width) * newW; layer.y = (layer.y / state.height) * newH; if (layer.kind === 'shape') { layer.w = (layer.w / state.width) * newW; layer.h = (layer.h / state.height) * newH; } if (layer.kind === 'text') layer.fontSize = (layer.fontSize / state.height) * newH; }
    });
    state.width = newW; state.height = newH; state.cropRect = null; markDirty(); updateAllUI(); render(); setStatus(`Canvas resized to ${newW} × ${newH}.`);
  }

  function applyCrop() {
    if (!state.cropRect) { setStatus('No crop rectangle is active.'); return; }
    const r = clampRectToCanvas(state.cropRect); if (r.w < 2 || r.h < 2) { setStatus('Crop rectangle is too small.'); return; }
    pushHistory('crop canvas', 'all');
    state.layers.forEach((layer) => { if (layer.kind === 'raster') { const old = layer.canvas; layer.canvas = makeCanvas(r.w, r.h); layer.canvas.getContext('2d').drawImage(old, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); if (layer.mask) { const oldMask = layer.mask; layer.mask = makeCanvas(r.w, r.h); layer.mask.getContext('2d').drawImage(oldMask, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); } } else if (layer.kind === 'text' || layer.kind === 'shape') { layer.x -= r.x; layer.y -= r.y; } });
    state.width = r.w; state.height = r.h; state.cropRect = null; markDirty(); updateAllUI(); render(); setStatus(`Cropped to ${r.w} × ${r.h}.`);
  }

  function dataUrlToImage(dataUrl) { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = dataUrl; }); }

  async function loadImageDataUrl(dataUrl, name, mode = 'replace') {
    if (mode === 'replace') resetHistory();
    else pushHistory('import layer', []);
    const img = await dataUrlToImage(dataUrl);
    if (mode === 'replace' || state.layers.length === 0) {
      state.width = img.naturalWidth || img.width;
      state.height = img.naturalHeight || img.height;
      const background = createBackgroundLayer('#ffffff');
      const layer = createRasterLayer(name || 'Image', (ctx) => ctx.drawImage(img, 0, 0));
      state.layers = [background, layer];
      resetFrames(state.layers);
      state.selectedLayerId = layer.id;
      state.projectName = (name || 'Image').replace(/\.[^.]+$/, '');
      state.currentProjectId = uid();
      state.projectGalleryFolderId = state.projectGalleryFolderId || homeState.currentFolderId || null;
      state.projectMeta = { source: 'import image', category: 'Imported image', template: 'Image dimensions', option: `${state.width} × ${state.height}` };
      state.cropRect = null;
      state.view.zoom = 1;
      resetViewPan();
    } else {
      const layer = createRasterLayer(name || 'Imported Layer', (ctx) => {
        const scale = Math.min(1, state.width / img.width, state.height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (state.width - w) / 2, (state.height - h) / 2, w, h);
      });
      state.layers.push(layer);
      state.selectedLayerId = layer.id;
    }
    markDirty(); updateAllUI(); renderFrameStrip(); render(); if (mode === 'replace') upsertCurrentProject(); setStatus(`${mode === 'replace' ? 'Opened' : 'Imported'} ${name || 'image'}.`);
  }

  function exportCompositeDataUrl(type = 'image/png', quality = 0.92, options = {}) {
    const includeBackground = options.includeBackground !== false;
    const comp = renderComposite({ includeBackground });
    if (type === 'image/jpeg') {
      const jpg = makeCanvas(state.width, state.height);
      const ctx = jpg.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, jpg.width, jpg.height);
      ctx.drawImage(comp, 0, 0);
      return jpg.toDataURL(type, quality);
    }
    return comp.toDataURL(type, quality);
  }

  function downloadHref(href, filename) { const a = document.createElement('a'); a.href = href; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); }

  async function saveImage(type = 'image/png', options = {}) {
    const isJpg = type === 'image/jpeg';
    let includeBackground = options.includeBackground;
    let suffix = '';
    if (!isJpg && includeBackground === undefined && isTransparentBackground(backgroundLayer())) {
      includeBackground = false;
      suffix = '-transparent';
    }
    if (!isJpg && includeBackground === undefined) {
      const mode = await requestPngExportMode();
      if (!mode) return false;
      includeBackground = mode !== 'transparent';
      suffix = includeBackground ? '-solid' : '-transparent';
    }
    if (isJpg) includeBackground = true;
    const dataUrl = exportCompositeDataUrl(type, 0.92, { includeBackground });
    const ext = isJpg ? 'jpg' : 'png';
    const filters = isJpg ? [{ name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }] : [{ name: 'PNG Image', extensions: ['png'] }];
    const fileName = `${safeFileName(state.projectName || 'image')}${isJpg ? '' : suffix}.${ext}`;
    let defaultPath = fileName;
    if (window.exArtboothAPI) {
      const folder = await requestSaveDestination('image');
      if (folder === null) return false;
      defaultPath = pathJoin(folder, fileName);
      const result = await window.exArtboothAPI.saveDataUrl({ defaultPath, dataUrl, filters });
      if (result) setStatus(`Exported ${result.path}.`);
      return Boolean(result);
    }
    downloadHref(dataUrl, defaultPath);
    return true;
  }

  function serializeLayer(layer) {
    const base = { ...layer };
    if (layer.kind === 'raster') {
      base.canvas = layer.canvas ? layer.canvas.toDataURL('image/png') : null;
      base.mask = layer.mask ? layer.mask.toDataURL('image/png') : null;
    }
    return base;
  }

  function serializeProjectObject() {
    return {
      app: 'EX Artbooth',
      version: 1,
      projectId: state.currentProjectId || (state.currentProjectId = uid()),
      width: state.width,
      height: state.height,
      projectName: state.projectName,
      meta: state.projectMeta || {},
      frameIndex: state.frameIndex || 0,
      frames: (syncActiveFrame(), state.frames).map((frame) => ({
        id: frame.id,
        name: frame.name || '',
        layers: frame.layers.map(serializeLayer)
      })),
      layers: state.layers.map(serializeLayer)
    };
  }

  function serializeProject() {
    return JSON.stringify(serializeProjectObject(), null, 2);
  }

  async function saveProject() {
    const text = serializeProject();
    const safeName = safeFileName(state.projectName || 'untitled');
    if (window.exArtboothAPI) {
      const folder = await requestSaveDestination('project');
      if (folder === null) return;
      const result = await window.exArtboothAPI.saveText({
        defaultPath: pathJoin(folder, `${safeName}.exart`),
        text,
        filters: [{ name: 'EX Artbooth Project', extensions: ['exart', 'openpixel', 'json'] }]
      });
      if (result) {
        state.dirty = false;
        upsertCurrentProject();
        setStatus(`Project saved to ${result.path}.`);
      }
      return;
    }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    downloadHref(url, `${safeName}.exart`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    state.dirty = false;
    upsertCurrentProject();
  }

  async function hydrateLayers(rawLayers) {
    const loadedLayers = [];
    for (const item of rawLayers) {
      const layer = { ...item };
      if (layer.kind === 'raster') {
        layer.canvas = makeCanvas(state.width, state.height);
        if (item.canvas) {
          const img = await dataUrlToImage(item.canvas);
          layer.canvas.getContext('2d').drawImage(img, 0, 0);
        }
        layer.mask = null;
        if (item.mask) {
          layer.mask = makeCanvas(state.width, state.height);
          const maskImg = await dataUrlToImage(item.mask);
          layer.mask.getContext('2d').drawImage(maskImg, 0, 0);
        }
      }
      layer.id = layer.id || uid();
      layer.visible = layer.visible !== false;
      layer.opacity = Number(layer.opacity ?? 1);
      layer.blend = layer.blend || 'source-over';
      layer.adjustment = layer.adjustment || defaultAdjustment();
      loadedLayers.push(layer);
    }
    if (loadedLayers[0] && loadedLayers[0].name === 'Background') {
      loadedLayers[0].locked = true;
      loadedLayers[0].isBackground = true;
      loadedLayers[0].backgroundColor = loadedLayers[0].backgroundColor || '#ffffff';
      loadedLayers[0].visible = true;
      loadedLayers[0].opacity = 1;
      loadedLayers[0].blend = 'source-over';
    } else if (!loadedLayers.some((layer) => isBackgroundLayer(layer))) {
      loadedLayers.unshift(createBackgroundLayer('#ffffff'));
    }
    return loadedLayers;
  }

  async function loadProjectText(text, options = {}) {
    resetHistory();
    const data = JSON.parse(text);
    if (!data || (!Array.isArray(data.layers) && !Array.isArray(data.frames))) throw new Error('Invalid project file');
    state.width = Number(data.width) || 1280;
    state.height = Number(data.height) || 720;
    state.projectName = data.projectName || 'Project';
    state.currentProjectId = options.projectId || data.projectId || uid();
    state.projectMeta = data.meta || {};
    state.projectGalleryFolderId = options.folderId || null;
    stopPlayback();
    const rawFrames = Array.isArray(data.frames) && data.frames.length
      ? data.frames
      : [{ id: uid(), name: '', layers: data.layers || [] }];
    const frames = [];
    for (const rawFrame of rawFrames) {
      frames.push({
        id: rawFrame.id || uid(),
        name: rawFrame.name || '',
        layers: await hydrateLayers(Array.isArray(rawFrame.layers) ? rawFrame.layers : [])
      });
    }
    state.frames = frames;
    state.frameIndex = Math.max(0, Math.min(frames.length - 1, Number(data.frameIndex) || 0));
    state.layers = state.frames[state.frameIndex].layers;
    state.selectedLayerId = state.layers[state.layers.length - 1]?.id || null;
    state.cropRect = null;
    state.view.zoom = 1;
    resetViewPan();
    state.dirty = false;
    updateAllUI();
    renderFrameStrip();
    if (options.renderView !== false) render();
    if (options.updateRecent !== false) upsertCurrentProject();
    setStatus(`Opened project ${state.projectName}.`);
  }

  function startMove(point) {
    const layer = selectedLayer();
    if (!layer) return;
    if (isBackgroundLayer(layer)) {
      setStatus('Background is locked and cannot be moved. Add or select another layer to move artwork.');
      state.moveSession = null;
      return;
    }
    if (blockedByLock(layer, 'move it')) { state.moveSession = null; return; }
    const session = { layer, start: point };
    if (layer.kind === 'raster') { session.canvas = cloneCanvas(layer.canvas); session.mask = cloneCanvas(layer.mask); }
    else if (layer.kind === 'text' || layer.kind === 'shape') { session.x = layer.x; session.y = layer.y; }
    state.moveSession = session;
  }
  function updateMove(point) { const s = state.moveSession; if (!s) return; const dx = point.x - s.start.x, dy = point.y - s.start.y; const layer = s.layer; if (layer.kind === 'raster') { const ctx = layer.canvas.getContext('2d'); ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height); ctx.drawImage(s.canvas, dx, dy); if (layer.mask && s.mask) { const mctx = layer.mask.getContext('2d'); mctx.clearRect(0, 0, layer.mask.width, layer.mask.height); mctx.drawImage(s.mask, dx, dy); } } else if (layer.kind === 'text' || layer.kind === 'shape') { layer.x = s.x + dx; layer.y = s.y + dy; } markDirty(); }

  async function handlePointerDown(event) {
    // Middle-drag pans the view; the wheel pans and Ctrl+wheel zooms.
    if (event.button === 1) {
      event.preventDefault();
      startViewPan(event);
      return;
    }

    const point = screenToImage(event.clientX, event.clientY);
    if (!isInsideImage(point)) return;
    viewport.setPointerCapture(event.pointerId);
    state.isPointerDown = true;
    state.lastPoint = point;
    state.dragStart = point;

    const strokeTools = { brush: 'brush stroke', eraser: 'erase', heal: 'heal', clone: 'clone stamp' };
    if (strokeTools[state.activeTool]) {
      const target = selectedLayer();
      if (target && !isBackgroundLayer(target) && !isLayerLocked(target) && target.kind === 'raster') {
        pushHistory(strokeTools[state.activeTool], [target.id]);
      }
    }

    if (state.activeTool === 'brush' || state.activeTool === 'eraser') { drawBrushLine(point, point, event); render(); }
    else if (state.activeTool === 'heal') { spotHealAt(point); render(); }
    else if (state.activeTool === 'clone') { if (event.altKey || !state.cloneSource) { state.cloneSource = point; state.cloneStart = null; state.isPointerDown = false; setStatus(`Clone source set at ${Math.round(point.x)}, ${Math.round(point.y)}. Now paint without Alt.`); } else { state.cloneStart = point; cloneStampAt(point); render(); } }
    else if (state.activeTool === 'text') { state.isPointerDown = false; const text = await requestTextInput({ title: 'Add text layer', message: 'Type the text you want to place on the canvas. Press Ctrl+Enter to confirm multiline text.', defaultValue: 'Your text', confirmLabel: 'Add text', multiline: true }); if (text) addLayer(createTextLayer(text, point.x, point.y), true); }
    else if (state.activeTool === 'rect' || state.activeTool === 'ellipse') { state.previewShape = { x: point.x, y: point.y, w: 0, h: 0 }; render(); }
    else if (state.activeTool === 'crop') { state.cropRect = { x: point.x, y: point.y, w: 0, h: 0 }; render(); }
  }

  function handlePointerMove(event) {
    if (state.isViewPanning) {
      updateViewPan(event);
      return;
    }
    const point = screenToImage(event.clientX, event.clientY);
    setStatus(`${state.activeTool} • ${Math.round(point.x)}, ${Math.round(point.y)}`);
    if (!state.isPointerDown) return;
    if (state.activeTool === 'brush' || state.activeTool === 'eraser') { drawBrushLine(state.lastPoint, point, event); state.lastPoint = point; render(); }
    else if (state.activeTool === 'heal') { spotHealAt(point); render(); }
    else if (state.activeTool === 'clone') { cloneStampAt(point); render(); }
    else if (state.activeTool === 'rect' || state.activeTool === 'ellipse') { state.previewShape = normalizeRect(state.dragStart, point); render(); }
    else if (state.activeTool === 'crop') { state.cropRect = normalizeRect(state.dragStart, point); render(); }
  }

  function handlePointerUp(event) {
    if (state.isViewPanning) {
      stopViewPan();
      return;
    }
    if (!state.isPointerDown) return;
    const point = screenToImage(event.clientX, event.clientY);
    state.isPointerDown = false;
    if ({ brush: 1, eraser: 1, heal: 1, clone: 1 }[state.activeTool]) compactStrokeHistory();
    if (state.activeTool === 'rect' || state.activeTool === 'ellipse') { const rect = normalizeRect(state.dragStart, point); if (rect.w > 2 && rect.h > 2) addLayer(createShapeLayer(state.activeTool, rect), true); state.previewShape = null; }
    else if (state.activeTool === 'crop') { state.cropRect = clampRectToCanvas(normalizeRect(state.dragStart, point)); setStatus(`Crop rectangle: ${state.cropRect.w} × ${state.cropRect.h}. Click Apply Crop.`); }
    state.cloneStart = null;
    state.dragStart = null;
    state.lastPoint = null;
    updateAllUI();
    render();
  }

  async function openImage(mode) {
    state.fileMode = mode;
    if (window.exArtboothAPI) {
      const result = await window.exArtboothAPI.openImage();
      if (result) {
        await loadImageDataUrl(result.dataUrl, result.name, mode);
        showEditor();
      }
    } else fileInput.click();
  }

  async function openProject(forceShowEditor = false) {
    if (window.exArtboothAPI) {
      const result = await window.exArtboothAPI.openProject();
      if (result) {
        await loadProjectText(result.text, { updateRecent: true, renderView: true });
        showEditor();
      }
    } else {
      projectInput.dataset.forceShowEditor = forceShowEditor ? '1' : '0';
      projectInput.click();
    }
  }

  // Property controls fire input events continuously. Arm one history step when
  // the interaction starts, so a whole slider drag is a single undo.
  function historyOnEdit(element, label, touchedFn) {
    if (!element) return;
    let armed = false;
    const arm = () => {
      if (armed) return;
      armed = true;
      pushHistory(label, touchedFn ? touchedFn() : []);
    };
    const disarm = () => { armed = false; };
    element.addEventListener('pointerdown', arm);
    element.addEventListener('focus', arm);
    element.addEventListener('keydown', arm);
    element.addEventListener('change', disarm);
    element.addEventListener('blur', disarm);
  }

  /* The editor's file commands. These used to live only as click handlers on
     the top toolbar; the toolbar was removed in 0.13.0 and the menu bar now
     calls them directly. */
  function goHome() {
    if (state.layers.length) upsertCurrentProject();
    showHome();
  }
  function newProject() { return startNewProjectFlow({ addRecent: true }); }

  function wireEvents() {
    wireLayerPanel();
    $('chooseProjectBtn').addEventListener('click', handleChooseButton);
    $('homeBackBtn').addEventListener('click', backHomeGallery);
    $('newProjectFab').addEventListener('click', openCreateMenu);
    $('projectInfoBtn').addEventListener('click', () => { const panel = $('projectInfoPanel'); const open = panel.classList.contains('hidden'); closeHomePanels(open ? 'projectInfoPanel' : null); panel.classList.toggle('hidden', !open); updateInfoPanel(); });
    $('moreProjectsBtn').addEventListener('click', () => { const panel = $('morePanel'); const open = panel.classList.contains('hidden'); closeHomePanels(open ? 'morePanel' : null); panel.classList.toggle('hidden', !open); updateDeletedPanel(); });
    $('shareBtn').addEventListener('click', () => { const panel = $('sharePanel'); const open = panel.classList.contains('hidden'); closeHomePanels(open ? 'sharePanel' : null); panel.classList.toggle('hidden', !open); });
    $('replayBtn').addEventListener('click', playSelectedReplay);
    $('closeReplayBtn').addEventListener('click', () => { $('replayModal').classList.add('hidden'); cancelAnimationFrame(homeState.replayAnimation); });
    $('downloadPngBtn').addEventListener('click', () => exportSelectedHomeProject('image/png'));
    $('downloadJpegBtn').addEventListener('click', () => exportSelectedHomeProject('image/jpeg'));
    $('downloadPsdBtn').addEventListener('click', () => showUnsupportedExport('PSD'));
    $('shareTimelineBtn').addEventListener('click', prepareAnimationExport);
    $('bulkFolderBtn').addEventListener('click', groupSelectedProjects);
    $('bulkDeleteBtn').addEventListener('click', bulkDeleteSelectedProjects);
    $('bulkCancelBtn').addEventListener('click', exitSelectionMode);

    window.addEventListener('resize', () => { render(); drawBrushCursor(); });

    window.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      // Tab still moves focus inside forms and dialogs.
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if (document.querySelector('.input-modal-overlay')) return;
      if ($('editorView').classList.contains('hidden')) return;
      event.preventDefault();
      toggleBrushEraser();
    });

    window.addEventListener('keydown', (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const target = event.target;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
        || target.tagName === 'SELECT' || target.isContentEditable);
      if (typing) return;
      if ($('editorView').classList.contains('hidden')) return;
      const key = event.key.toLowerCase();
      if (key === 'z') { event.preventDefault(); undo(); }
      else if (key === 'y') { event.preventDefault(); redo(); }
    });

    const selectedId = () => (state.selectedLayerId ? [state.selectedLayerId] : []);
    historyOnEdit($('layerName'), 'rename layer');
    historyOnEdit($('layerOpacity'), 'layer opacity');
    historyOnEdit($('blendMode'), 'blend mode');
    historyOnEdit($('lpOpacity'), 'layer opacity');
    historyOnEdit($('lpBlend'), 'blend mode');
    historyOnEdit($('textValue'), 'edit text', selectedId);
    historyOnEdit($('fillColor'), 'fill colour');
    historyOnEdit($('shapeStrokeColor'), 'stroke colour');
    historyOnEdit($('strokeWidth'), 'stroke width');
    historyOnEdit($('fontSize'), 'font size');
    historyOnEdit($('fontFamily'), 'font');
    historyOnEdit($('editMask'), 'mask painting');
    document.querySelectorAll('.adj').forEach((input) => historyOnEdit(input, 'adjustment'));
    viewport.addEventListener('pointerdown', handlePointerDown); viewport.addEventListener('pointermove', handlePointerMove); viewport.addEventListener('pointerup', handlePointerUp); viewport.addEventListener('pointercancel', handlePointerUp);
    // The ring follows the pointer whether or not a stroke is in progress.
    viewport.addEventListener('pointermove', setCursorPoint);
    viewport.addEventListener('pointerenter', setCursorPoint);
    viewport.addEventListener('pointerleave', hideBrushCursor);
    viewport.addEventListener('auxclick', (event) => { if (event.button === 1) event.preventDefault(); });
    viewport.addEventListener('wheel', (event) => {
      event.preventDefault();
      if (event.ctrlKey) {
        zoomAt(event.clientX, event.clientY, event.deltaY < 0 ? 1.1 : 0.9);
        return;
      }
      if (event.shiftKey) {
        panView(-event.deltaY, 0);
        setStatus('Pan view horizontally • Shift + scroll');
        return;
      }
      panView(0, -event.deltaY);
      setStatus('Pan view vertically • Ctrl + scroll to zoom');
    }, { passive: false });
    document.querySelectorAll('.tool').forEach((button) => button.addEventListener('click', () => { state.activeTool = button.dataset.tool; if (state.activeTool !== 'crop') state.cropRect = null; updateToolButtons(); drawBrushCursor(); render(); setStatus(`Tool selected: ${state.activeTool}.`); }));

    $('backgroundStyleBtn').addEventListener('click', openBackgroundDialog);
    $('addFrameBtn').addEventListener('click', addFrame);
    $('framePlayBtn').addEventListener('click', togglePlayback);
    $('onionToggle').addEventListener('change', (event) => { state.onionSkin = event.target.checked; render(); setStatus(state.onionSkin ? 'Onion skin on: previous frame shows at 20% opacity.' : 'Onion skin off.'); });
    $('frameFpsInput').addEventListener('change', (event) => {
      const fps = setFps(event.target.value);
      event.target.value = formatFps(fps);
      setStatus(`Playback set to ${formatFps(fps)} fps (${formatFps(1 / fps)} s per frame).`);
    });
    $('resizeBtn').addEventListener('click', resizeDocument); $('fitBtn').addEventListener('click', fitView); $('zoomInBtn').addEventListener('click', () => { const r = viewport.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); }); $('zoomOutBtn').addEventListener('click', () => { const r = viewport.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); });
    $('applyCropBtn').addEventListener('click', applyCrop); $('cancelCropBtn').addEventListener('click', () => { state.cropRect = null; render(); setStatus('Crop canceled.'); });
    $('addLayerBtn').addEventListener('click', () => addLayer(createRasterLayer('New Raster Layer'), true)); $('addAdjustBtn').addEventListener('click', () => addLayer(createAdjustmentLayer(), true)); $('duplicateLayerBtn').addEventListener('click', duplicateLayer); $('deleteLayerBtn').addEventListener('click', deleteLayer); $('addMaskBtn').addEventListener('click', () => addMask());

    $('colorInput').addEventListener('input', (event) => { state.brushColor = event.target.value; const layer = selectedLayer(); if (layer && layer.kind === 'text') { layer.fill = state.brushColor; $('fillColor').value = state.brushColor; markDirty(); render(); } });
    $('brushSize').addEventListener('input', (event) => { state.brushSize = Number(event.target.value); $('brushSizeText').textContent = String(state.brushSize); drawBrushCursor(); });
    $('brushOpacity').addEventListener('input', (event) => { state.brushOpacity = Number(event.target.value) / 100; $('brushOpacityText').textContent = `${event.target.value}%`; });
    $('fontSize').addEventListener('input', (event) => { state.fontSize = Number(event.target.value) || 56; const layer = selectedLayer(); if (layer && layer.kind === 'text') { layer.fontSize = state.fontSize; markDirty(); render(); } });
    $('fontFamily').addEventListener('input', (event) => { state.fontFamily = event.target.value || 'Arial'; const layer = selectedLayer(); if (layer && layer.kind === 'text') { layer.fontFamily = state.fontFamily; markDirty(); render(); } });
    $('strokeWidth').addEventListener('input', (event) => { state.strokeWidth = Math.max(0, Number(event.target.value) || 0); const layer = selectedLayer(); if (layer && (layer.kind === 'text' || layer.kind === 'shape')) { layer.strokeWidth = state.strokeWidth; markDirty(); render(); } });
    $('fillColor').addEventListener('input', (event) => { state.fillColor = event.target.value; const layer = selectedLayer(); if (layer && (layer.kind === 'text' || layer.kind === 'shape')) { layer.fill = state.fillColor; markDirty(); render(); } });
    $('shapeStrokeColor').addEventListener('input', (event) => { state.strokeColor = event.target.value; const layer = selectedLayer(); if (layer && (layer.kind === 'text' || layer.kind === 'shape')) { layer.stroke = state.strokeColor; markDirty(); render(); } });

    $('layerName').addEventListener('input', (event) => { const layer = selectedLayer(); if (!layer || isBackgroundLayer(layer)) return; layer.name = event.target.value; markDirty(); updateLayerList(); });
    $('layerOpacity').addEventListener('input', (event) => { const layer = selectedLayer(); if (!layer || isBackgroundLayer(layer)) return; layer.opacity = Number(event.target.value) / 100; $('layerOpacityText').textContent = `${event.target.value}%`; markDirty(); updateLayerList(); render(); });
    $('blendMode').addEventListener('change', (event) => { const layer = selectedLayer(); if (!layer || isBackgroundLayer(layer)) return; layer.blend = event.target.value; markDirty(); render(); });
    $('editMask').addEventListener('change', (event) => { const layer = selectedLayer(); if (!layer || layer.kind !== 'raster' || isBackgroundLayer(layer)) return; layer.editMask = event.target.checked; markDirty(); updateLayerList(); render(); });
    document.querySelectorAll('.adj').forEach((input) => input.addEventListener('input', (event) => { const layer = selectedLayer(); if (!layer || !layer.adjustment || isBackgroundLayer(layer)) return; const key = event.target.dataset.adj; layer.adjustment[key] = Number(event.target.value); const label = $(`${key}Text`); if (label) label.textContent = event.target.value; markDirty(); render(); }));
    $('resetAdjustBtn').addEventListener('click', () => { const layer = selectedLayer(); if (!layer || !layer.adjustment || isBackgroundLayer(layer)) return; pushHistory('reset adjustments', []); layer.adjustment = defaultAdjustment(); markDirty(); updatePropertiesPanel(); render(); });
    $('textValue').addEventListener('input', (event) => { const layer = selectedLayer(); if (!layer || layer.kind !== 'text') return; layer.text = event.target.value; layer.name = 'Text: ' + layer.text.slice(0, 18); markDirty(); updateLayerList(); render(); });

    fileInput.addEventListener('change', async () => { const file = fileInput.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async () => { await loadImageDataUrl(reader.result, file.name, state.fileMode); showEditor(); }; reader.readAsDataURL(file); fileInput.value = ''; });
    projectInput.addEventListener('change', async () => { const file = projectInput.files[0]; if (!file) return; const text = await file.text(); try { await loadProjectText(text, { updateRecent: true, renderView: true }); if (projectInput.dataset.forceShowEditor === '1') showEditor(); else showEditor(); } catch (err) { setStatus('Could not open project: ' + err.message); } projectInput.value = ''; });

    if (window.exArtboothAPI) window.exArtboothAPI.onMenuCommand((command) => {
      const actions = { home: goHome, 'new': newProject, 'open-image': () => openImage('replace'), 'import-layer': () => openImage('import'), 'open-project': openProject, 'save-project': saveProject, 'export': () => openExportDialog(), 'apply-crop': applyCrop, 'cancel-crop': () => { state.cropRect = null; render(); }, 'resize': resizeDocument, 'fit': fitView, 'zoom-in': () => $('zoomInBtn').click(), 'zoom-out': () => $('zoomOutBtn').click(), undo, redo };
      if (actions[command]) actions[command]();
    });
  }

  // Test hook: the headless harnesses in tools/ drive these directly. It is a
  // read-only handle on existing functions, not app behaviour.
  window.__exartTest = { state, history, undo, redo, pushHistory, resetHistory, goHome, newProject, openExportDialog, openBackgroundDialog };

  wireEvents();
  loadTextureManifest();
  state.lang = getSettings().lang === 'vi' ? 'vi' : 'en';
  fillBlendSelects();
  initDocument();
  applyLanguage();
  showHome();
})();
