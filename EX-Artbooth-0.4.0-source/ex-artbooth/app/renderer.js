/* EX Artbooth renderer: a compact Photoshop-style MVP built on HTML Canvas. */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const viewport = $('viewport');
  const canvasArea = $('canvasArea');
  const vctx = viewport.getContext('2d', { alpha: false });
  const fileInput = $('fileInput');
  const projectInput = $('projectInput');
  const homeView = $('homeView');
  const editorView = $('editorView');
  const projectGrid = $('projectGrid');
  const compositeCanvas = document.createElement('canvas');
  const scratchCanvas = document.createElement('canvas');

  const defaultAdjustment = () => ({ brightness: 0, contrast: 0, exposure: 0, saturation: 0, hue: 0 });
  const state = {
    width: 1280, height: 720, layers: [], selectedLayerId: null,
    activeTool: 'move', projectName: 'Untitled', dirty: false,
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
    projectGalleryFolderId: null
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
    return Boolean(layer && (layer.locked || layer.isBackground || (state.layers[0] && state.layers[0].id === layer.id && layer.name === 'Background')));
  }

  function createRasterLayer(name = 'Raster Layer', drawFn) {
    const canvas = makeCanvas();
    const ctx = canvas.getContext('2d');
    if (drawFn) drawFn(ctx, canvas);
    return { id: uid(), kind: 'raster', name, visible: true, opacity: 1, blend: 'source-over', canvas, mask: null, editMask: false, adjustment: defaultAdjustment() };
  }

  function createBackgroundLayer(color = '#ffffff') {
    const background = createRasterLayer('Background', (ctx) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, state.width, state.height);
    });
    background.locked = true;
    background.isBackground = true;
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
  function markDirty() { state.dirty = true; }

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
    editorView.classList.add('hidden');
    homeView.classList.remove('hidden');
    closeHomePanels();
    renderHome();
  }

  function showEditor() {
    homeView.classList.add('hidden');
    editorView.classList.remove('hidden');
    closeHomePanels();
    requestAnimationFrame(() => { updateAllUI(); render(); });
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
    check.textContent = isBulkSelected ? '✓' : '';
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
        if (activeCategory === 'animation') extra.push(`${clampInt(size.fps ?? customValues.fps, 6, 60, 24)} fps`);
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
          ? `<button type="button" class="size-toggle" data-toggle-size="${item.id}">${size.width} × ${size.height} <span>${openSizeMenuId === item.id ? '⌃' : '⌄'}</span></button>`
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
              <button type="button" class="modal-close new-project-close">×</button>
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
                  <input id="newProjectFpsInput" type="range" min="6" max="60" value="${clampInt(currentSizeFor(item).fps ?? customValues.fps, 6, 60, 24)}">
                  <span id="newProjectFpsText">${clampInt(currentSizeFor(item).fps ?? customValues.fps, 6, 60, 24)} fps</span>
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
          customValues.fps = clampInt(fpsInput.value, 6, 60, 24);
          const fpsText = overlay.querySelector('#newProjectFpsText');
          if (fpsText) fpsText.textContent = `${customValues.fps} fps`;
          updatePreviewOnly();
        });
        overlay.querySelector('.create-template-project').addEventListener('click', () => {
          const itemNow = selectedItem();
          const size = currentSizeFor(itemNow);
          const width = clampInt(size.width, 1, 12000, 1280);
          const height = clampInt(size.height, 1, 12000, 720);
          const fps = activeCategory === 'animation' ? clampInt(customValues.fps, 6, 60, 24) : undefined;
          const dpi = activeCategory === 'printable' ? clampInt(size.dpi || customValues.dpi, 1, 1200, 300) : undefined;
          const projectName = overlay.querySelector('#newProjectNameInput')?.value?.trim() || `${category.label} - ${itemNow.name}`;
          close({
            mode: 'template',
            width,
            height,
            name: projectName,
            meta: {
              source: 'template',
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
    state.width = Math.max(1, Math.round(w));
    state.height = Math.max(1, Math.round(h));
    const bg = createBackgroundLayer('#ffffff');
    const paintLayer = createRasterLayer('Layer 1');
    state.layers = [bg, paintLayer];
    state.selectedLayerId = paintLayer.id;
    state.projectName = options.name || 'Untitled';
    state.currentProjectId = options.projectId || uid();
    state.projectMeta = options.meta || { source: 'blank', category: 'Custom', template: 'Blank', option: 'Custom' };
    state.projectGalleryFolderId = options.folderId || null;
    state.cropRect = null;
    state.view.zoom = 1;
    resetViewPan();
    state.dirty = false;
    updateAllUI(); render(); setStatus('New document created.');
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
    setStatus('Pan view');
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

  function drawChecker(ctx, x, y, w, h, size = 18) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = '#d8dde8'; ctx.fillRect(x, y, w, h);
    for (let yy = y; yy < y + h; yy += size) {
      for (let xx = x; xx < x + w; xx += size) {
        const on = (Math.floor((xx - x) / size) + Math.floor((yy - y) / size)) % 2 === 0;
        ctx.fillStyle = on ? '#b5bdca' : '#e6e9ef'; ctx.fillRect(xx, yy, size, size);
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
    compositeCanvas.width = state.width;
    compositeCanvas.height = state.height;
    const compCtx = compositeCanvas.getContext('2d');
    compCtx.setTransform(1, 0, 0, 1, 0, 0);
    compCtx.clearRect(0, 0, state.width, state.height);
    scratchCanvas.width = state.width;
    scratchCanvas.height = state.height;
    const scratchCtx = scratchCanvas.getContext('2d');

    for (const layer of state.layers) {
      if (isBackgroundLayer(layer)) {
        if (!includeBackground) continue;
        scratchCtx.clearRect(0, 0, state.width, state.height);
        scratchCtx.fillStyle = layer.backgroundColor || '#ffffff';
        scratchCtx.fillRect(0, 0, state.width, state.height);
        if (layer.kind === 'raster' && layer.canvas) {
          try { scratchCtx.drawImage(layer.canvas, 0, 0); } catch (_err) { /* ignore invalid legacy background */ }
        }
        compCtx.save();
        compCtx.globalAlpha = 1;
        compCtx.globalCompositeOperation = 'source-over';
        compCtx.drawImage(scratchCanvas, 0, 0);
        compCtx.restore();
        scratchCtx.clearRect(0, 0, state.width, state.height);
        continue;
      }

      if (!layer.visible) continue;
      if (layer.kind === 'adjustment') { applyAdjustmentToCanvas(compositeCanvas, layer.adjustment, layer.opacity); continue; }
      drawLayerToContext(layer, scratchCtx);
      if (hasAdjustment(layer.adjustment)) applyAdjustmentToCanvas(scratchCanvas, layer.adjustment, 1);
      if (layer.mask) applyMask(scratchCanvas, layer.mask);
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

  function render() {
    ensureViewportSize(); computeViewTransform();
    vctx.setTransform(1, 0, 0, 1, 0, 0); vctx.fillStyle = '#0a0d13'; vctx.fillRect(0, 0, viewport.width, viewport.height);
    const x = state.view.offsetX, y = state.view.offsetY, w = state.width * state.view.scale, h = state.height * state.view.scale;
    drawChecker(vctx, x, y, w, h, Math.max(8, 18 * state.view.scale));
    const comp = renderComposite(); vctx.imageSmoothingEnabled = state.view.scale < 1; vctx.drawImage(comp, x, y, w, h);
    vctx.save(); vctx.strokeStyle = 'rgba(255,255,255,0.72)'; vctx.lineWidth = 1; vctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h)); vctx.restore();
    if (state.previewShape) drawOverlayRect(state.previewShape, state.activeTool === 'ellipse' ? 'ellipse' : 'rect', '#2fe6a6');
    if (state.cropRect) drawCropOverlay(state.cropRect);
    $('documentInfo').textContent = `${state.width} × ${state.height}`; $('zoomLabel').textContent = `${Math.round(state.view.zoom * 100)}%`;
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
    if (isBackgroundLayer(layer)) return 'Locked background';
    if (layer.kind === 'raster') return layer.mask ? 'Raster + mask' : 'Raster';
    if (layer.kind === 'adjustment') return 'Adjustment';
    if (layer.kind === 'text') return 'Editable text';
    if (layer.kind === 'shape') return layer.shape === 'ellipse' ? 'Vector ellipse' : 'Vector rectangle';
    return layer.kind;
  }

  function updateToolButtons() {
    document.querySelectorAll('.tool').forEach((button) => button.classList.toggle('active', button.dataset.tool === state.activeTool));
    viewport.classList.toggle('pan-tool', state.activeTool === 'move');
  }
  function updateBrushControls() {
    $('colorInput').value = state.brushColor; $('brushSize').value = state.brushSize; $('brushSizeText').textContent = String(state.brushSize);
    $('brushOpacity').value = Math.round(state.brushOpacity * 100); $('brushOpacityText').textContent = `${Math.round(state.brushOpacity * 100)}%`;
    $('fontSize').value = state.fontSize; $('fontFamily').value = state.fontFamily; $('strokeWidth').value = state.strokeWidth; $('fillColor').value = state.fillColor; $('shapeStrokeColor').value = state.strokeColor;
  }

  function updateLayerList() {
    const list = $('layerList'); list.innerHTML = '';
    [...state.layers].reverse().forEach((layer) => {
      const row = document.createElement('div'); row.className = 'layer-row' + (layer.id === state.selectedLayerId ? ' selected' : '') + (isBackgroundLayer(layer) ? ' locked-layer' : ''); row.title = isBackgroundLayer(layer) ? 'Locked background: cannot be moved' : 'Click to select layer';
      row.addEventListener('click', () => { state.selectedLayerId = layer.id; updateLayerList(); updatePropertiesPanel(); render(); });
      const eye = document.createElement('button'); eye.className = 'eye'; eye.textContent = isBackgroundLayer(layer) ? '🔒' : (layer.visible ? '👁' : '—'); eye.title = isBackgroundLayer(layer) ? 'Background always stays solid in the project' : 'Toggle visibility';
      eye.addEventListener('click', (event) => { event.stopPropagation(); if (isBackgroundLayer(layer)) { layer.visible = true; setStatus('Background stays visible in the project. Use PNG export to hide it for transparent output.'); render(); return; } layer.visible = !layer.visible; markDirty(); updateLayerList(); render(); });
      const meta = document.createElement('div'); meta.className = 'layer-meta';
      const name = document.createElement('div'); name.className = 'layer-name'; name.textContent = layer.name;
      const kind = document.createElement('div'); kind.className = 'layer-kind'; kind.textContent = kindLabel(layer); meta.append(name, kind);
      const chip = document.createElement('div'); chip.className = 'layer-chip'; chip.textContent = isBackgroundLayer(layer) ? '🔒' : `${Math.round(layer.opacity * 100)}%`;
      row.append(eye, meta, chip); list.append(row);
    });
  }

  function setAdjInput(key, value) { const input = document.querySelector(`.adj[data-adj="${key}"]`); if (!input) return; input.value = Number(value); const label = $(`${key}Text`); if (label) label.textContent = String(Number(value)); }

  function updatePropertiesPanel() {
    const layer = selectedLayer(); const disabled = !layer; const lockedBg = isBackgroundLayer(layer);
    $('layerName').disabled = disabled || lockedBg; $('layerOpacity').disabled = disabled || lockedBg; $('blendMode').disabled = disabled || lockedBg;
    $('addMaskBtn').disabled = disabled || lockedBg || layer.kind !== 'raster'; $('editMask').disabled = disabled || lockedBg || layer.kind !== 'raster' || !layer.mask; $('maskPaintMode').disabled = disabled || lockedBg || layer.kind !== 'raster' || !layer.mask;
    document.querySelectorAll('.adj').forEach((input) => { input.disabled = disabled || lockedBg || layer.kind === 'shape' || layer.kind === 'text'; }); $('textValue').disabled = disabled || layer.kind !== 'text';
    if (!layer) return;
    $('layerName').value = layer.name || ''; $('layerOpacity').value = Math.round(layer.opacity * 100); $('layerOpacityText').textContent = `${Math.round(layer.opacity * 100)}%`; $('blendMode').value = layer.blend || 'source-over'; $('editMask').checked = Boolean(layer.editMask);
    const adj = layer.adjustment || defaultAdjustment(); setAdjInput('brightness', adj.brightness || 0); setAdjInput('contrast', adj.contrast || 0); setAdjInput('exposure', adj.exposure || 0); setAdjInput('saturation', adj.saturation || 0); setAdjInput('hue', adj.hue || 0);
    if (layer.kind === 'text') { $('textValue').value = layer.text || ''; $('fillColor').value = layer.fill || state.brushColor; $('fontSize').value = layer.fontSize || state.fontSize; $('fontFamily').value = layer.fontFamily || state.fontFamily; $('strokeWidth').value = layer.strokeWidth || 0; $('shapeStrokeColor').value = layer.stroke || state.strokeColor; }
    else if (layer.kind === 'shape') { $('textValue').value = ''; $('fillColor').value = layer.fill || state.fillColor; $('strokeWidth').value = layer.strokeWidth || 0; $('shapeStrokeColor').value = layer.stroke || state.strokeColor; }
    else { $('textValue').value = ''; }
  }
  function updateAllUI() { updateToolButtons(); updateLayerList(); updatePropertiesPanel(); updateBrushControls(); }

  function getEditableRasterLayer() { const layer = selectedLayer(); if (!layer) { setStatus('No layer selected.'); return null; } if (isBackgroundLayer(layer)) { setStatus('Background is locked and always fills the canvas. Add a raster layer to paint or erase.'); return null; } if (layer.kind !== 'raster') { setStatus('Select a raster layer for brush, eraser, heal, clone, or mask painting.'); return null; } return layer; }
  function addMask(layer = selectedLayer()) {
    if (!layer || layer.kind !== 'raster' || isBackgroundLayer(layer)) return;
    if (!layer.mask) { layer.mask = makeCanvas(); const mctx = layer.mask.getContext('2d'); mctx.fillStyle = 'rgba(255,255,255,1)'; mctx.fillRect(0, 0, state.width, state.height); layer.editMask = true; markDirty(); updateAllUI(); render(); setStatus('Layer mask added. Paint black to hide or white to reveal.'); }
  }
  function targetContextForBrush(layer, tool) { if (layer.editMask) { if (!layer.mask) addMask(layer); return { ctx: layer.mask.getContext('2d'), isMask: true }; } return { ctx: layer.canvas.getContext('2d'), isMask: false, erasing: tool === 'eraser' }; }

  function drawBrushLine(from, to, event) {
    const layer = getEditableRasterLayer(); if (!layer) return;
    const pressure = event && event.pressure && event.pressure > 0 ? event.pressure : 1; const size = Math.max(1, state.brushSize * pressure); const { ctx, isMask, erasing } = targetContextForBrush(layer, state.activeTool);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = size; ctx.globalAlpha = state.brushOpacity;
    if (isMask) { if ($('maskPaintMode').value === 'hide') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = 'rgba(0,0,0,1)'; } else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(255,255,255,1)'; } }
    else if (erasing) { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = 'rgba(0,0,0,1)'; }
    else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = state.brushColor; }
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

  function addLayer(layer, select = true) { state.layers.push(layer); if (select) state.selectedLayerId = layer.id; markDirty(); updateAllUI(); render(); }
  function duplicateLayer() {
    const layer = selectedLayer();
    if (!layer) return;
    if (isBackgroundLayer(layer)) { setStatus('Background is locked. Add a new raster layer above it instead.'); return; }
    let copy;
    if (layer.kind === 'raster') copy = { ...layer, id: uid(), name: layer.name + ' copy', canvas: cloneCanvas(layer.canvas), mask: cloneCanvas(layer.mask), adjustment: { ...layer.adjustment } };
    else { copy = JSON.parse(JSON.stringify(layer)); copy.id = uid(); copy.name = layer.name + ' copy'; }
    copy.locked = false;
    copy.isBackground = false;
    const index = state.layers.findIndex((item) => item.id === layer.id);
    state.layers.splice(index + 1, 0, copy);
    state.selectedLayerId = copy.id;
    markDirty(); updateAllUI(); render();
  }
  function deleteLayer() {
    if (state.layers.length <= 1) { setStatus('A document must keep at least one layer.'); return; }
    const index = state.layers.findIndex((layer) => layer.id === state.selectedLayerId);
    if (index < 0) return;
    if (isBackgroundLayer(state.layers[index])) { setStatus('Background is locked and cannot be deleted.'); return; }
    state.layers.splice(index, 1);
    state.selectedLayerId = state.layers[Math.min(index, state.layers.length - 1)].id;
    markDirty(); updateAllUI(); render();
  }
  function moveLayer(direction) {
    const index = state.layers.findIndex((layer) => layer.id === state.selectedLayerId);
    if (index < 0) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.layers.length) return;
    if (isBackgroundLayer(state.layers[index]) || isBackgroundLayer(state.layers[newIndex])) {
      setStatus('Background is locked at the bottom of the document.');
      return;
    }
    const [layer] = state.layers.splice(index, 1);
    state.layers.splice(newIndex, 0, layer);
    markDirty(); updateLayerList(); render();
  }

  async function resizeDocument() {
    const input = await requestTextInput({ title: 'Resize canvas', message: 'Enter new size as WIDTHxHEIGHT, for example 1920x1080.', defaultValue: `${state.width}x${state.height}`, placeholder: '1920x1080', confirmLabel: 'Resize' }); if (!input) return;
    const match = input.toLowerCase().match(/(\d+)\s*[x, ]\s*(\d+)/); if (!match) { showNotice('Invalid size', 'Please use a size like 1920x1080.'); setStatus('Resize canceled: invalid format.'); return; }
    const newW = Math.max(1, Number(match[1])), newH = Math.max(1, Number(match[2]));
    state.layers.forEach((layer) => {
      if (layer.kind === 'raster') { const old = layer.canvas; layer.canvas = makeCanvas(newW, newH); layer.canvas.getContext('2d').drawImage(old, 0, 0, newW, newH); if (layer.mask) { const oldMask = layer.mask; layer.mask = makeCanvas(newW, newH); layer.mask.getContext('2d').drawImage(oldMask, 0, 0, newW, newH); } }
      else if (layer.kind === 'text' || layer.kind === 'shape') { layer.x = (layer.x / state.width) * newW; layer.y = (layer.y / state.height) * newH; if (layer.kind === 'shape') { layer.w = (layer.w / state.width) * newW; layer.h = (layer.h / state.height) * newH; } if (layer.kind === 'text') layer.fontSize = (layer.fontSize / state.height) * newH; }
    });
    state.width = newW; state.height = newH; state.cropRect = null; markDirty(); updateAllUI(); render(); setStatus(`Canvas resized to ${newW} × ${newH}.`);
  }

  function applyCrop() {
    if (!state.cropRect) { setStatus('No crop rectangle is active.'); return; }
    const r = clampRectToCanvas(state.cropRect); if (r.w < 2 || r.h < 2) { setStatus('Crop rectangle is too small.'); return; }
    state.layers.forEach((layer) => { if (layer.kind === 'raster') { const old = layer.canvas; layer.canvas = makeCanvas(r.w, r.h); layer.canvas.getContext('2d').drawImage(old, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); if (layer.mask) { const oldMask = layer.mask; layer.mask = makeCanvas(r.w, r.h); layer.mask.getContext('2d').drawImage(oldMask, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h); } } else if (layer.kind === 'text' || layer.kind === 'shape') { layer.x -= r.x; layer.y -= r.y; } });
    state.width = r.w; state.height = r.h; state.cropRect = null; markDirty(); updateAllUI(); render(); setStatus(`Cropped to ${r.w} × ${r.h}.`);
  }

  function dataUrlToImage(dataUrl) { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = dataUrl; }); }

  async function loadImageDataUrl(dataUrl, name, mode = 'replace') {
    const img = await dataUrlToImage(dataUrl);
    if (mode === 'replace' || state.layers.length === 0) {
      state.width = img.naturalWidth || img.width;
      state.height = img.naturalHeight || img.height;
      const background = createBackgroundLayer('#ffffff');
      const layer = createRasterLayer(name || 'Image', (ctx) => ctx.drawImage(img, 0, 0));
      state.layers = [background, layer];
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
    markDirty(); updateAllUI(); render(); if (mode === 'replace') upsertCurrentProject(); setStatus(`${mode === 'replace' ? 'Opened' : 'Imported'} ${name || 'image'}.`);
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

  function serializeProjectObject() {
    return {
      app: 'EX Artbooth',
      version: 1,
      projectId: state.currentProjectId || (state.currentProjectId = uid()),
      width: state.width,
      height: state.height,
      projectName: state.projectName,
      meta: state.projectMeta || {},
      layers: state.layers.map((layer) => {
        const base = { ...layer };
        if (layer.kind === 'raster') {
          base.canvas = layer.canvas.toDataURL('image/png');
          base.mask = layer.mask ? layer.mask.toDataURL('image/png') : null;
        }
        return base;
      })
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

  async function loadProjectText(text, options = {}) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.layers)) throw new Error('Invalid project file');
    state.width = Number(data.width) || 1280;
    state.height = Number(data.height) || 720;
    state.projectName = data.projectName || 'Project';
    state.currentProjectId = options.projectId || data.projectId || uid();
    state.projectMeta = data.meta || {};
    state.projectGalleryFolderId = options.folderId || null;
    const loadedLayers = [];
    for (const item of data.layers) {
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
    state.layers = loadedLayers;
    if (state.layers[0] && state.layers[0].name === 'Background') {
      state.layers[0].locked = true;
      state.layers[0].isBackground = true;
      state.layers[0].backgroundColor = state.layers[0].backgroundColor || '#ffffff';
      state.layers[0].visible = true;
      state.layers[0].opacity = 1;
      state.layers[0].blend = 'source-over';
    } else if (!state.layers.some((layer) => isBackgroundLayer(layer))) {
      state.layers.unshift(createBackgroundLayer('#ffffff'));
    }
    state.selectedLayerId = state.layers[state.layers.length - 1]?.id || null;
    state.cropRect = null;
    state.view.zoom = 1;
    resetViewPan();
    state.dirty = false;
    updateAllUI();
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
    const session = { layer, start: point };
    if (layer.kind === 'raster') { session.canvas = cloneCanvas(layer.canvas); session.mask = cloneCanvas(layer.mask); }
    else if (layer.kind === 'text' || layer.kind === 'shape') { session.x = layer.x; session.y = layer.y; }
    state.moveSession = session;
  }
  function updateMove(point) { const s = state.moveSession; if (!s) return; const dx = point.x - s.start.x, dy = point.y - s.start.y; const layer = s.layer; if (layer.kind === 'raster') { const ctx = layer.canvas.getContext('2d'); ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height); ctx.drawImage(s.canvas, dx, dy); if (layer.mask && s.mask) { const mctx = layer.mask.getContext('2d'); mctx.clearRect(0, 0, layer.mask.width, layer.mask.height); mctx.drawImage(s.mask, dx, dy); } } else if (layer.kind === 'text' || layer.kind === 'shape') { layer.x = s.x + dx; layer.y = s.y + dy; } markDirty(); }

  async function handlePointerDown(event) {
    if (event.button === 1 || state.activeTool === 'move') {
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

  function wireEvents() {
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
    $('homeBtn').addEventListener('click', () => { if (state.layers.length) upsertCurrentProject(); showHome(); });
    window.addEventListener('resize', render);
    viewport.addEventListener('pointerdown', handlePointerDown); viewport.addEventListener('pointermove', handlePointerMove); viewport.addEventListener('pointerup', handlePointerUp); viewport.addEventListener('pointercancel', handlePointerUp);
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
    document.querySelectorAll('.tool').forEach((button) => button.addEventListener('click', () => { state.activeTool = button.dataset.tool; if (state.activeTool !== 'crop') state.cropRect = null; updateToolButtons(); render(); setStatus(`Tool selected: ${state.activeTool}.`); }));

    $('newBtn').addEventListener('click', () => startNewProjectFlow({ addRecent: true }));
    $('openBtn').addEventListener('click', () => openImage('replace')); $('importBtn').addEventListener('click', () => openImage('import')); $('openProjectBtn').addEventListener('click', openProject); $('saveProjectBtn').addEventListener('click', saveProject); $('savePngBtn').addEventListener('click', () => saveImage('image/png')); $('saveJpgBtn').addEventListener('click', () => saveImage('image/jpeg'));
    $('resizeBtn').addEventListener('click', resizeDocument); $('fitBtn').addEventListener('click', fitView); $('zoomInBtn').addEventListener('click', () => { const r = viewport.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); }); $('zoomOutBtn').addEventListener('click', () => { const r = viewport.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); });
    $('applyCropBtn').addEventListener('click', applyCrop); $('cancelCropBtn').addEventListener('click', () => { state.cropRect = null; render(); setStatus('Crop canceled.'); });
    $('addLayerBtn').addEventListener('click', () => addLayer(createRasterLayer('New Raster Layer'), true)); $('addAdjustBtn').addEventListener('click', () => addLayer(createAdjustmentLayer(), true)); $('duplicateLayerBtn').addEventListener('click', duplicateLayer); $('deleteLayerBtn').addEventListener('click', deleteLayer); $('moveLayerUpBtn').addEventListener('click', () => moveLayer(1)); $('moveLayerDownBtn').addEventListener('click', () => moveLayer(-1)); $('addMaskBtn').addEventListener('click', () => addMask());

    $('colorInput').addEventListener('input', (event) => { state.brushColor = event.target.value; const layer = selectedLayer(); if (layer && layer.kind === 'text') { layer.fill = state.brushColor; $('fillColor').value = state.brushColor; markDirty(); render(); } });
    $('brushSize').addEventListener('input', (event) => { state.brushSize = Number(event.target.value); $('brushSizeText').textContent = String(state.brushSize); });
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
    $('resetAdjustBtn').addEventListener('click', () => { const layer = selectedLayer(); if (!layer || !layer.adjustment || isBackgroundLayer(layer)) return; layer.adjustment = defaultAdjustment(); markDirty(); updatePropertiesPanel(); render(); });
    $('textValue').addEventListener('input', (event) => { const layer = selectedLayer(); if (!layer || layer.kind !== 'text') return; layer.text = event.target.value; layer.name = 'Text: ' + layer.text.slice(0, 18); markDirty(); updateLayerList(); render(); });

    fileInput.addEventListener('change', async () => { const file = fileInput.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = async () => { await loadImageDataUrl(reader.result, file.name, state.fileMode); showEditor(); }; reader.readAsDataURL(file); fileInput.value = ''; });
    projectInput.addEventListener('change', async () => { const file = projectInput.files[0]; if (!file) return; const text = await file.text(); try { await loadProjectText(text, { updateRecent: true, renderView: true }); if (projectInput.dataset.forceShowEditor === '1') showEditor(); else showEditor(); } catch (err) { setStatus('Could not open project: ' + err.message); } projectInput.value = ''; });

    if (window.exArtboothAPI) window.exArtboothAPI.onMenuCommand((command) => {
      const actions = { 'new': () => $('newBtn').click(), 'open-image': () => openImage('replace'), 'import-layer': () => openImage('import'), 'open-project': openProject, 'save-project': saveProject, 'export-png': () => saveImage('image/png'), 'export-jpeg': () => saveImage('image/jpeg'), 'apply-crop': applyCrop, 'cancel-crop': () => { state.cropRect = null; render(); }, 'resize': resizeDocument, 'fit': fitView, 'zoom-in': () => $('zoomInBtn').click(), 'zoom-out': () => $('zoomOutBtn').click() };
      if (actions[command]) actions[command]();
    });
  }

  wireEvents();
  initDocument();
  showHome();
})();
