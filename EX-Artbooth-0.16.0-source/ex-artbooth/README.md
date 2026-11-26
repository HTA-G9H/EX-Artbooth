# EX Artbooth

EX Artbooth is a **Windows-ready Photoshop-style image editor MVP**. It is not a complete Photoshop replacement yet, but it gives you a real foundation you can run, test, package as a Windows `.exe`, and extend.

## New in 0.16.0 - Tab to swap tools, and a cursor you can always see

- **Tab switches between the Brush and the Eraser.** Press it while any other
  tool is active - Heal, Clone, Text, Rect, Ellipse, Crop - and it jumps
  straight to the Brush, so Tab always lands somewhere useful.
- Tab still moves focus normally inside text fields and dialogs, so renaming a
  layer or filling in the export dialog is unaffected.
- **The brush cursor is now a ring that inverts the artwork underneath it.**
  The old pure-white pointer vanished against white paper. The ring is drawn on
  its own overlay composited with `mix-blend-mode: difference`, so it shows
  black on white, white on black, and a complementary colour over anything
  else. It cannot blend into its background.
- The ring is drawn at the real brush size and scales with the zoom, so it
  shows exactly what the next stroke will cover, with a centre cross for
  precision at large sizes.
- Non-painting tools keep the normal system cursor.

## New in 0.15.0 - background across animation frames

- The Background dialog in an animation project now has an **Apply to** choice:
  - **This frame** - the old behaviour, still the default.
  - **All frames** - every frame in the project.
  - **Frame range** - type a From and To, inclusive, numbered the way the
    frame strip shows them.
- A live line under the choice says exactly what will change, for example
  "Will change 3 frames (2-4)", so there is no guessing before you press Apply.
- A reversed range such as 5 to 3 is read as 3 to 5, and numbers outside the
  project clamp to the real frames instead of erroring.
- **One undo reverses the whole operation**, including a change across all
  frames. Frames that were not selected are left completely untouched.
- Only the background style is copied between frames. The drawings on your
  layers are shared by reference, not duplicated, so applying to 200 frames
  costs no extra memory.
- Still-image projects do not show the control at all.

## New in 0.14.0 - MP4 export for animations

- Animation projects gain an **MP4** option in the export dialog, next to
  PNG / JPEG / PSD. It appears only when the project actually has frames;
  still-image projects never see it.
- Every frame is composited and encoded at the project's frame rate, so the
  exported clip matches what playback shows. Very slow animations work too:
  0.001 fps gives one frame every 1000 seconds, which the container handles.
- H.264 video in an MP4 container, playable in Windows Media Player, VLC,
  browsers, phones and every common editor.
- **No ffmpeg.** Encoding uses Chromium's built-in WebCodecs encoder and the
  container is written by `app/mp4.js`, so the app does not grow by the ~80 MB
  an ffmpeg bundle would add.
- If a machine has no H.264 encoder, the export explains that in plain language
  and points at PNG / JPEG instead of failing silently.
- Video is always sRGB; the dialog greys out the ICC colour rows for MP4 and
  says why, since those settings apply to still images.

## Changed in 0.13.1

- **One Export command.** File > Export PNG... and File > Export JPEG... are
  merged into a single File > Export... (`Ctrl+E`). The format is chosen with
  the PNG / JPEG / PSD switch inside the export dialog, which also carries
  transparency, super resolution, colour space, ICC profile, rendering intent
  and black point compensation. Your last choice is remembered.

## New in 0.13.0

- **The top file toolbar is gone.** Home, New, Open, Import Layer, Export,
  Save Project and Open Project no longer sit across the top of the editor,
  leaving the canvas area wider and the header quiet. The header now holds only
  the document name and size on the left and the view controls on the right.
- Every one of those commands still works, from the menu bar:
  - File > Home (Recent Projects) - `Ctrl+H`
  - File > New - `Ctrl+N`
  - File > Open Image... - `Ctrl+O`
  - File > Import Image as Layer... - `Ctrl+Shift+O`
  - File > Open / Save EX Artbooth Project... - save is `Ctrl+S`
  - File > Export... - `Ctrl+E`, opens the full export dialog
- `Ctrl+H` for Home and `Ctrl+E` for the export dialog are new in this version.

## Fixed in 0.12.1

- The layer panel's right-hand icon rail no longer has its scrollbar sitting on
  top of the icons. The rail was 44px wide (a 32px button plus 6px padding on
  each side) but scrolled with Chromium's 15px classic scrollbar, so the bar
  covered the buttons and the 29px of space left over was narrower than a
  button, which also forced a stray horizontal scrollbar along the bottom.
  The rail is now 56px with an 8px gutter reserved for a thin scrollbar, so the
  icons keep their full size and nothing overlaps.

## New in 0.12.0

- **Undo and redo.** `Ctrl+Z` undoes, `Ctrl+Y` redoes, and both are in the Edit menu.
  The status bar names the step it reversed, for example `Undid: brush stroke.`
- Covered steps: brush, eraser, heal and clone strokes; add, duplicate, delete,
  reorder, flip, invert, merge, lock and mask layers; clipping and alpha lock;
  rename, opacity and blend changes; adjustments and their reset; text, fill,
  stroke and font edits; background changes; crop, canvas resize and add frame.
- A slider drag or a typed rename is **one** undo step, not one per keystroke.
- History keeps the last 40 steps inside a 192 MB budget. Brush strokes are
  stored as just the rectangle they touched, so 40 strokes on a 1440x3200
  document cost about 0.15 MB rather than the 703 MB a naive full-canvas
  history would need.
- Opening or creating a project clears the history, so undo can never reach
  back into a different document.
- **The Move button is gone.** Panning the view is unchanged and still works
  with the scroll wheel (Shift for horizontal, Ctrl to zoom) and middle-drag.
  The Brush is now the default tool.

## Fixed in 0.11.1 (from screenshot review)

- **Home header wrapped to two lines.** The bar was a `120px / 1fr / 120px` grid; hiding the Back button removed it from the grid, so the title dropped into the 120 px column and "EX Artbooth" and "Recent projects" each broke across two lines, with Choose floating short of the right edge. The bar is now flex, so it lays out correctly whether Back is shown or not.
- **Last off-palette colours removed.** A lavender layer chip, two pink/red danger tints and four blue-grey surfaces survived the 0.11.0 pass. The stylesheet now contains no hex or rgb value that is not green, black, white or a neutral mix of black and white.
- **Green is no longer used for read-only text.** Slider values and counters were green, spreading the accent across static labels; they are white at 72% now, and green marks active and interactive state only.
- **Dock simplified.** The three home buttons sat in a blurred, shadowed capsule on top of the dock bar; that second container is gone and the buttons sit directly on the bar.
- `npm run ui-smoke` runs a headless structural check of the interface (icon references, no glyph icons, icons surviving a language switch, layer panel and export dialog). `npm run ui-preview` regenerates `ui-preview.html`, which now includes the real home header markup so its layout can be reviewed without launching the app.

## New in 0.11.0 (interface clean-up)

- **Three colours only.** Green `#26c281` (taken from the app icon), black and white. The purple and teal accents are gone, and every neutral is black lifted with white so no fourth hue enters the interface.
- **No decorative gradients.** The seven gradient fills and the purple/green radial glows behind the home screen, canvas and panels are now flat surfaces. The only gradients left are functional: the transparency checkerboards.
- **No pill shapes.** One radius scale: 2 px, 4 px on controls, 6 px on panels. The 22 pill and circular radii are gone.
- **No stock icons.** All 30 emoji and symbol glyphs are replaced by 34 custom SVG icons drawn on a 24 px grid with a 1.6 px stroke, served from one inline sprite. Nothing depends on the system emoji font any more.
- **Consistent spacing.** A 4 px scale (4/8/12/16/24/32) exposed as `--s1`...`--s6` and applied across the top bars, docks, panels, layer panel and export dialog.
- **Clear headings.** One type scale, with section headings set in uppercase 11 px with wide tracking so panel titles read as labels rather than competing with content.
- Icon buttons sit on one size grid (40 px dock, 32 px panel, 26 px stepper) and no longer move on click.

`tools/make-ui-preview.js` regenerates `ui-preview.html`, a self-contained page showing the palette, spacing, controls, every icon and mocked screens with the real stylesheet inlined.

## New in 0.10.0 (real colour management)

The three greyed-out rows in the reference dialog now do real work.

- **Colour profile** - sRGB, Display P3, Adobe RGB (1998), ProPhoto RGB, or an ICC profile loaded from disk. Pixels are genuinely converted (linear light, Bradford adaptation) and the profile is embedded in the exported PNG (`iCCP` chunk) and JPEG (`APP2` segment), so other applications read the colours correctly.
- **Rendering intent** - perceptual, relative colorimetric, saturation, absolute colorimetric, each with its own gamut handling, and recorded in the embedded profile header.
- **Black point compensation** - the real scaling, driven by the destination profile's declared `bkpt` tag.
- The dialog shows a live, measured note: it converts a sample of the actual image and reports, for example, that 0% of it falls outside Adobe RGB so all four intents are identical here, or that 62.5% falls outside a narrow profile so the intent matters.
- Loading an ICC file supports matrix/TRC RGB and grayscale profiles, which covers RGB working spaces. Lookup-table profiles (most CMYK and printer profiles) are rejected with an explanation rather than silently approximated.

Verified against littleCMS (via Pillow): conversions match to within one 8-bit level for sRGB, Display P3, Adobe RGB and ProPhoto, our generated profiles are parsed correctly by littleCMS, third-party profiles (ICC v2, v4, lcms-written and Adobe-written) are parsed to within one level, and an Adobe RGB export converted back to sRGB is pixel-identical to a direct sRGB export.

One documented divergence: for absolute colorimetric into a D50 profile such as ProPhoto, this app re-references to the real media white and produces a cast, while littleCMS treats a v2 profile carrying a `chad` tag as already adapted and produces no cast.

## New in 0.9.1 (layer lock)

- Added the lock from the reference panel: a 🔒 button in the layer panel footer, next to clipping mask and alpha lock.
- A locked layer cannot be painted, erased, healed, cloned, moved, flipped, inverted, merged, masked, renamed, adjusted, reordered, or deleted.
- Still allowed while locked: selecting the layer, toggling its visibility, and changing opacity or blend mode.
- Locked rows show a 🔒 badge, a dashed outline, and lose their drag handle.
- The background keeps its own protection, so the lock button is disabled while it is selected.
- Internal fix: background detection no longer keys off the generic `locked` flag, so locking a normal layer can never make the app treat it as the background.

## New in 0.9.0 (one Export button)

- `Export PNG` and `Export JPEG` are replaced by a single **Export** button that opens a Save image dialog.
- Basic section: file type (PNG / JPEG / PSD), Transparency, Super resolution x2, plus a live output-size readout.
- Color section: color space (RGB / Grayscale), with color profile, rendering intent, and black point compensation shown but fixed, since canvas output is always sRGB.
- Transparency applies to PNG only and is greyed out for JPEG; PSD reports that it is not built yet.
- Settings are remembered between exports, and the filename records the options, e.g. `art-transparent-2x-gray.png`.
- No AI options, as requested.
- Icon sources moved from `build/` to `appicons/`, because folders named `build` get treated as disposable output and were being cleaned away, which silently broke the EXE icon step.

## New in 0.8.0 (app icon)

- Your palette artwork is now the app icon: `build/icon.ico` (multi-size 16 to 256 px) is used for `EX Artbooth.exe`, the taskbar, and the installer.
- The same artwork replaces the old "OP" placeholder logo on the home screen and in the editor top bar.
- Source artwork is kept at `build/icon-source.png`, and the in-app copy is `app/icon.png`.
- Added `tools/set-exe-icon.js` + an `afterPack` hook: the EXE icon and version metadata are stamped with `resedit` (pure JS), because rcedit needs Wine on Linux and is skipped when `signAndEditExecutable` is false. Installers built on Windows get the icon too.

## Fixed in 0.7.2

- The frame bar no longer appears for Illustration and Printable projects. It is shown only for Animation projects.
- Illustration/Printable projects get the full canvas height back: the status bar, Layers button, and layer panel drop to the bottom edge.
- New projects now record their template kind, so the check does not depend on the category name or the UI language.
- Existing multi-frame projects still show the bar, so nothing already made with frames is lost.

## New in 0.7.1 (real textures)

- Bundled the 16 supplied 512x512 seamless texture files in `app/textures/`: Brick, Cobblestone, Concrete, Corroded Metal, Diamond Plate, Fabric, Glass, Granite, Grass, Marble, Metal, Pebble, Sand, Slate, Wood, Wood Planks.
- The background texture picker now shows these real images instead of the generated approximations.
- Texture list is read from `app/textures/textures.json` through the main process, so it works under `file://` where `fetch` is blocked. Drop a new file in the folder, add an entry, and it appears in the picker with no code change.
- Generated textures stay as an automatic fallback if a file is missing.

## New in 0.7.0 (ibisPaint-style layer panel, textures, languages)

- The Layers panel left the right sidebar. A floating Layers button now sits in the **bottom-right corner** and opens a panel over the canvas.
- Panel layout follows the reference: canvas preview and action column on the left, layer rows in the middle, icon rail on the right, and a bottom bar with clipping mask, alpha lock, blend mode, and an opacity slider with − / +.
- Layer rows show a real thumbnail, name, blend mode, visibility eye, opacity %, and a drag handle. Drag rows to reorder.
- Working: add layer, add adjustment layer, duplicate, delete, merge down, flip horizontally, invert, export layer as PNG, import image as layer, clipping mask, alpha lock, opacity, blend mode, background swatches.
- Planned placeholders (they explain themselves instead of doing nothing): Selection layer, Transform, FX, and the ⋮ menu.
- Background row with four swatches: solid color, transparent grid, transparent grid (dark), and textures/more.
- **English / Vietnamese switch** in the top bar (`EN` / `VI`), remembered between sessions.
- **Custom textures**: drop image files into `app/textures/` and list them in `app/textures/textures.json`. They replace the built-in generated textures. See `app/textures/README.txt`.

## New in 0.6.0 (background layer)

- The background layer no longer reads "locked background". It shows its own live preview plus a description such as `Color #FF0066`, `Transparent grid`, or `Texture: Wood Planks`.
- Click the preview, the row's `Edit` chip, or `Change background…` in Selected Layer to restyle it.
- Background options: any solid color, Transparent grid, Transparent grid (dark), and 17 Roblox-style material textures (Brick, Cobblestone, Concrete, Corroded Metal, Diamond Plate, Fabric, Foil, Grass, Granite, Ice, Marble, Metal, Pebble, Sand, Slate, Wood, Wood Planks).
- Textures are generated procedurally inside the app, so they need no internet connection and add no file size.
- Picking a transparent grid makes the canvas genuinely transparent: the editor shows the light or dark checkerboard and PNG export writes transparency without asking.
- The background still stays at the bottom, always fills the canvas, and cannot be moved or deleted.

## Fixed in 0.5.1

- **Add frame did nothing**: the Add frame dialog was built with CSS class names that were never defined in `styles.css`, so it was appended to the page as an invisible unstyled block. It now uses the same styled modal as the PNG export picker.
- Added `npm run check`, which fails if the renderer ever injects a UI class that is missing from `styles.css`.

## New in 0.5.0 (animation frames)

- FPS is now a typed number with a minimum of **0.001 fps** and no 6-60 limit (capped at 1000 fps).
- Set FPS in the New Project dialog and change it anytime from the frame bar.
- New frame bar at the bottom middle of the editor showing every frame left to right.
- `＋ Frame` asks whether to create a **New frame** or **Duplicate previous frame** (copies all layers, masks, and settings).
- Onion skin: the previous frame shows behind the current one at 20% opacity, and returns to full opacity when you select and edit that frame.
- Play button cycles frames at the project FPS; onion skin is suppressed during playback.
- Click a frame to edit it, hover a frame to delete it, and frames are saved inside `.exart` project files.

## New in 0.4.1 (size optimization)

- Ships only the `en-US` Electron locale instead of all 55 locales: `locales/` went from 40 MB to 0.5 MB.
- Installed app folder: 266 MB → 227 MB. Distributed ZIP: 108 MB → 98 MB.
- `compression: maximum` so the NSIS installer/portable build uses maximum LZMA compression when built on Windows.
- README/ROADMAP and npm scripts are no longer packed into the app bundle.
- Expect roughly **70–80 MB** for the NSIS installer built on Windows with `build-windows.bat`.

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
