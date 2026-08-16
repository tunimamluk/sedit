# Sedit

A small browser-based video/audio editor. Trim, crop, change speed, and stack layers — all client-side, no upload, no install.

## Run it

Open `index.html` in Chrome or Edge (best `MediaRecorder` support).

If your browser is picky about local files, serve it instead:

```
cd sedit
python3 -m http.server 8080
```

then visit `http://localhost:8080`.

## Using it

- **Add media** — click **+ Add Media**, drag files onto the preview, or **paste** (⌘V / Ctrl+V) a copied video, image, or audio file. The first video/image becomes the full-frame base layer; later ones come in as smaller overlays.
- **Add Text** — a text overlay you can reposition, recolor, and resize.
- **Move / resize layers** — drag overlays directly on the preview; corner handles resize. The full-frame base layer deliberately ignores canvas clicks (otherwise every click would select it) — pick it from the Layers panel.
- **Layers panel** (left) — select, hide, reorder, delete.
- **Properties panel** (right) — split into **Project** (output frame size and total length, always visible) and **Layer** (size in output pixels, opacity, brightness, speed, volume/mute, duration for stills).
- **Speed** — 0.25×–4×, set **per layer** in the Layer section. Each clip runs at its own rate, and the panel shows how long it ends up on the timeline (a 12s clip at 2× takes 6s). Stills have no speed — set their Duration instead.
- **Timeline** (bottom) — drag the two handles to trim the start and end. Click or drag anywhere on the bar to scrub.
- **Crop** — toggle **Crop**, then drag the rectangle or its corners. Pick a ratio from the dropdown (16:9, 9:16, 1:1, 4:3, 3:4, 4:5, 21:9) to lock it, or hold **Shift** while dragging a corner to preserve whatever ratio the box currently has. The badge shows the exact output size in pixels.
- **Theme** — the sun/moon button in the top bar toggles light/dark. Your choice is remembered; it defaults to your OS setting.
- **Export** — pick a format in the top bar (the menu only lists what your browser can actually record — Chrome offers MP4/H.264 and WebM), then Export renders the trimmed range with crop, speed, and layers applied.

**Opacity vs brightness:** opacity blends the layer with whatever is behind it. For the full-frame base layer that's black, so lowering opacity there just darkens the picture — which is why there's now a separate Brightness control that actually adjusts exposure. Use brightness for the base video, opacity for overlays.

## Units

Layer sizes and the crop badge are in **pixels of the output frame**. The output frame matches the first video or image you add (a 1920×1080 clip gives you a 1920×1080 canvas); before then it's 1280×720.

## Notes

- Rendering goes through `<canvas>` + `MediaRecorder`, so export runs in real time — a 10s range at 2× speed takes ~5s.
- Crop dimensions are rounded to even numbers for codec compatibility, so a locked ratio can drift by well under a percent.
- The area around the video is the app background, not letterboxing — the thin border marks the actual frame edge. The output frame always matches your source exactly, so no bars get baked into the export.
- Nothing is uploaded — everything happens in your browser tab.
