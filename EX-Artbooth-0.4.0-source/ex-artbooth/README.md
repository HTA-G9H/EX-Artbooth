# EX Artbooth

EX Artbooth is a **Windows-ready Photoshop-style image editor MVP**. It is not a complete Photoshop replacement yet, but it gives you a real foundation you can run, test, package as a Windows `.exe`, and extend.

## New in 0.4.0

- The app is renamed from OpenPixel Studio to **EX Artbooth**.
- Window title, menus, About box, and the Windows executable are now `EX Artbooth.exe`.
- Project files now save as `.exart`; older `.openpixel` files still open normally.
- Existing local gallery projects, folders, and saved default folders are kept.

## New in 0.3.6

- Move tool now pans the user view instead of moving layers.
- Mouse wheel pans the view vertically.
- Shift + mouse wheel pans horizontally.
- Ctrl + mouse wheel zooms at the cursor.
- Middle mouse drag freely pans the view.
- Fit resets zoom and pan back to the centered view.

## New in 0.3.5

- The gallery + button now opens a Create menu with New project and New folder.
- New gallery folders can be created in the gallery root or inside an existing folder.
- New projects created from inside a gallery folder now stay assigned to that folder.
- Save Project, Export Image, and future Animation export now have default destination-folder controls.
- Added native folder picking for default save/export locations in the Windows app.

## New in 0.3.4

- The gallery Choose button now enters multi-select mode instead of opening a file picker.
- Selected gallery projects can be grouped into a new folder.
- Selected gallery projects can be bulk deleted and moved to Recently Deleted.
- Folder cards now appear in the gallery and can be opened with Back navigation.

## New in 0.3.3

- The locked Background now always fills the entire canvas in the editor.
- New blank projects now start with a locked Background plus an editable Layer 1 above it.
- Imported-image projects now get a locked solid background behind the image layer.
- PNG export now asks whether to include a solid background or export with a transparent background.
- Transparent PNG export hides only the locked background while keeping the project itself solid.

## New in 0.3.2

- Locked the default Background layer so it cannot be moved, deleted, edited, hidden, or reordered.
- Added locked-background labels/icons in the layer list.
- Made the editor UI more transparent/minimal.
- Reduced sidebar/topbar sizes to make the canvas work area larger.

## New in 0.3.1

- Added a scroll slider to the Project Setup panel in the new-project dialog.
- Fixed Animation setup so the Create button stays visible/reachable on smaller windows.
- Improved the FPS control styling.

## New in 0.3.0

- Replaced the simple new-project size dialog with a full template picker.
- Added Illustration templates: HD quality, 1:1, 3:4, 9:16, X post head, Chat stamp, Vertical, and Custom.
- Added Printable templates: Manga sketch, JP postcard, A4, A5, B4, B5, and Custom with DPI.
- Added Animation templates: 1:1, 3:4, 9:16, and Custom with FPS from 6 to 60.
- Added an Import Image option that creates a canvas using the selected image dimensions.
- Added collapsible size menus for templates with multiple sizes.

## New in 0.2.3

- Fixed Windows build scripts so they can find Node.js even when Node is installed but not available in the current PATH.
- Added `build-windows-folder.bat`, a safer build option that creates `release/win-unpacked/EX Artbooth.exe` without making an installer.
- Pinned Electron and electron-builder versions for more reliable builds.

## New in 0.2.2

- Fixed a Windows/Electron crash caused by unsupported `window.prompt()` dialogs.
- Replaced New Project, Resize, Text, and placeholder export messages with app-native modal dialogs.

## New in 0.2.0

- Added a clean, minimal recent-project home screen.
- The app now opens to your recent projects instead of dropping directly into the editor.
- Added top **Choose** action.
- Added bottom dock buttons:
  - **+** creates a blank project.
  - **i** opens project statistics with total project count and total stored project size.
  - **•••** opens a collapsible panel with **Recently deleted project**.
- Clicking a recent project now focuses it in the center instead of opening immediately.
- Focused project mode now shows:
  - top **Back** button
  - bottom **Play** button for a progress-preview replay
  - bottom **Share** button with PNG/JPEG export plus PSD/MP4 placeholders
- Added a **Home** button in the editor.
- Improved the overall visual style: cleaner spacing, less noisy panels, professional dark minimal UI.

## What is included now

- Image editing basics: new canvas, open image, import image as layer, export PNG/JPEG.
- Crop and resize canvas.
- Layer-based compositing:
  - raster layers
  - editable text layers
  - editable rectangle/ellipse shape layers
  - non-destructive adjustment layers
  - visibility toggles
  - opacity
  - blend modes
  - duplicate/delete/reorder layers
- Layer masks:
  - add a mask to raster layers
  - paint black to hide
  - paint white to reveal
- Color/exposure adjustments:
  - brightness
  - contrast
  - exposure
  - saturation
  - hue
- Digital painting:
  - brush
  - eraser
  - brush size/opacity/color
  - Pointer Events pressure support for drawing tablets/stylus devices
- Retouching MVP:
  - simple Heal brush
  - Clone stamp: Alt-click a source point, then paint
- Graphic design tools:
  - text layers
  - shape layers
  - fill/stroke controls
- Editable project format:
  - save/open `.openpixel` files containing layers, masks, vector text/shapes, and adjustments
- Recent project library:
  - stored locally in the app using browser/Electron local storage
  - includes thumbnail, dimensions, layer count, estimated project size, and project JSON

## Important reality check

A full Photoshop alternative is a large multi-year product, not a weekend app. This project is a starting MVP. Missing advanced features include undo/redo, PSD compatibility, advanced selections, liquify, professional color management, CMYK, RAW editing, GPU-accelerated filters, advanced content-aware fill, perspective warp, and a production brush engine.

Also, **Adobe Fonts cannot simply be integrated freely** unless the user has the proper Adobe subscription/licensing. A free alternative should use local system fonts, bundled open-source fonts, or Google Fonts/open font libraries.

## Run the app in development mode

Install **Node.js LTS** first:

https://nodejs.org/

Then open a terminal in this folder and run:

```bash
npm install
npm start
```

On Windows, you can also double-click:

```text
run-dev.bat
```

## Build a Windows executable

If you only want to use the app, download the Windows unpacked ZIP and run `win-unpacked/EX Artbooth.exe`. You do **not** need Node.js for that.

If you want to build from source on Windows:

1. Install Node.js LTS from https://nodejs.org/
2. If you just installed Node, close and reopen Command Prompt.
3. Open this folder.
4. For the safest build, double-click:

```text
build-windows-folder.bat
```

That creates:

```text
release/win-unpacked/EX Artbooth.exe
```

To build installer/portable files instead, double-click:

```text
build-windows.bat
```

Or run manually:

```bash
npm install
npm run build:win-dir
```

If a script says Node.js is missing even though it is installed, open Command Prompt and run:

```bash
node -v
npm -v
```

If those commands fail, reinstall Node.js LTS and enable **Add to PATH** in the installer. The included `.bat` files also try common Node.js install locations like `C:\Program Files\nodejs`.

Because the app is not code-signed, Windows SmartScreen may warn users. That is normal for unsigned indie apps. For public release, buy a code-signing certificate and configure electron-builder signing.

## Browser preview

You can open `app/index.html` directly in a browser for a quick preview. The Electron version has better native file dialogs, but the browser version can still test the editor UI and most tools.

## Suggested next steps

1. Add undo/redo history.
2. Add real progress-history recording for the Play button.
3. Add selections: rectangle, ellipse, lasso, magic wand.
4. Add transform handles for scale/rotate/skew.
5. Improve the retouching engine with real inpainting/content-aware fill.
6. Add brush presets and texture brushes.
7. Add PSD import/export using a dedicated parser.
8. Add MP4 timeline export.
9. Add GPU/WebGL/WebGPU rendering for large documents.
10. Add plugin support.

See `ROADMAP.md` for a bigger roadmap.
