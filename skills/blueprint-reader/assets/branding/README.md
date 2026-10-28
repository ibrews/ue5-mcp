# Blueprint Reader brand assets

The reader and trailer share this product identity: an ivory/forest-green field guide, connected graph nodes and a reading lens. Branding is **Alex Coulombe Presents**.

- `favicon.svg`: editable, original vector mark. It also appears in the reader header.
- `favicon.ico`: embedded 16, 24, 32, 48, 64, 128 and 256 pixel variants.
- `favicon-32.png`: PNG fallback.
- `apple-touch-icon.png`: 180 × 180 touch icon.
- `social-card.png`: 1730 × 909 PNG for link previews, approximately the 1200:630 social-card aspect ratio. The file is 1.8 MB. Open Graph and Twitter metadata use its actual dimensions and a public absolute image URL.

The social card was generated with the built-in image-generation tool on 2026-10-27. [Exact prompt](social-card-prompt.txt). Its style reference was the existing [README illustration](../../../../docs/assets/blueprint-reader-overview.png). The node art is conceptual, not an app screenshot or a specific executable Blueprint. All wording and layout were visually checked. The original README illustration and trailer poster are retained.

To regenerate the raster icons from the SVG, install Pillow in a local virtual environment and make `rsvg-convert` available, then run:

```sh
python generate-icons.py
```

`web/build.mjs` copies these image files to the Pages root. The local server serves the four icon files, and the trailer refers to those same root icons. The social metadata is present in static HTML so crawlers do not need JavaScript.

These tags control previews of the Pages URLs. GitHub's repository social-preview setting is separate.
