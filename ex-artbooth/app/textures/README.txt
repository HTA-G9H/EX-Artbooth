EX Artbooth - background textures
=================================

Put your texture image files in this folder, then make sure textures.json lists them.

- Supported: .png, .jpg, .jpeg, .webp
- Best results: seamless (tileable) square images, 256x256 or 512x512
- The "id" must stay the same if you want existing projects to keep their texture
- Any texture listed here replaces the built-in generated version with the same id
- You can also add brand new entries with your own id/name/file

Example entry:
  { "id": "myrock", "name": "My Rock", "file": "myrock.png" }

If a file is missing, the app silently falls back to its built-in generated texture,
so the app still works with an empty folder.
