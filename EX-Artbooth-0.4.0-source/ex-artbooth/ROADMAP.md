# EX Artbooth Roadmap

This roadmap turns the MVP into a serious Photoshop-style free image editor.

## Phase 1: MVP foundation - mostly done

- Electron Windows app shell.
- HTML Canvas rendering.
- Raster layers.
- Text layers.
- Shape layers.
- Adjustment layers.
- Masks.
- Crop/resize.
- Export PNG/JPEG.
- Editable project files.

## Phase 2: Product shell and project management - in progress

- Recent-project home screen. Done in 0.2.0.
- Focused project preview before opening. Done in 0.2.0.
- Project information panel. Done in 0.2.0.
- Share/export panel. Partially done in 0.2.0.
- Recently deleted projects with restore/permanent delete.
- Real project thumbnails for files opened from disk.
- Safer local project library using IndexedDB instead of localStorage.
- Autosave and crash recovery.
- Project search, sort, and filters.

## Phase 3: Essential editor features

- Undo/redo history stack.
- Real progress-history recording for the Play button.
- Selection tools:
  - rectangle selection
  - ellipse selection
  - lasso
  - polygon lasso
  - magic wand/color range
- Clipboard support:
  - copy selection
  - paste as layer
  - paste from system clipboard
- Transform tools:
  - move
  - scale
  - rotate
  - skew
  - flip
  - free transform bounding box
- More adjustments:
  - levels
  - curves
  - white balance
  - shadows/highlights
  - vibrance
  - black and white
- More filters:
  - blur
  - sharpen
  - noise
  - vignette
  - gradient map

## Phase 4: Better layer system

- Layer groups/folders.
- Clipping masks.
- Lock transparency.
- Smart objects.
- Layer effects:
  - drop shadow
  - inner shadow
  - outer glow
  - stroke
  - gradient overlay
- Better mask preview/editing.
- Non-destructive filter layers.

## Phase 5: Digital painting engine

- Brush preset manager.
- Custom brush tips.
- Brush spacing/scattering.
- Texture brushes.
- Stabilizer/smoothing.
- Tablet tilt support.
- Windows Ink / WinTab integration if needed.
- Color palettes and swatches.

## Phase 6: Retouching and restoration

- Healing brush based on patch/inpainting instead of simple averaging.
- Patch tool.
- Content-aware fill.
- Frequency separation helper.
- Dust/scratch removal.
- Perspective correction.
- Lens correction.
- Clone source panel.

## Phase 7: Typography and design tools

- Text alignment, tracking, line-height, letter spacing.
- Text boxes with wrapping.
- Path text.
- Boolean vector shape operations.
- Gradients.
- Pattern fills.
- Rulers, grids, guides, snapping.
- Template system for posters, ads, thumbnails, and social media graphics.

## Phase 8: File format support

- Open/save `.exart` project files.
- Import/export PSD via a parser library or custom implementation.
- SVG import/export for vector layers.
- PDF export.
- MP4 timeline export.
- RAW import via a native helper or WASM library.
- ICC profiles and color management.

## Phase 9: Performance and professional release

- WebGL/WebGPU compositing.
- Tile-based rendering for huge images.
- Worker threads for filters.
- Memory budget management.
- Plugin API.
- App updater.
- Windows code signing.
- Installer branding and app icon.
