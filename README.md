# Sedit

A small browser-based video/audio editor. Trim, crop, change speed, and stack layers — all client-side, no upload, no server.

Built with React + Vite. Use Chrome or Edge (best `MediaRecorder` support).

## Run it

```
npm install
npm run dev
```

To produce a static build in `dist/`:

```
npm run build
npm run preview
```

## Project layout

```
src/
  main.jsx            entry
  App.jsx             state, wiring, export
  style.css
  components/
    TopBar.jsx        brand, filename, format, export
    LayersPanel.jsx   layer list (memo'd: ignores playhead ticks)
    Preview.jsx       canvas + selection and crop overlays, pointer drags
    Transport.jsx     play/pause, crop toggle, aspect lock
    Timeline.jsx      trim handles, scrubbing, playhead
    Properties.jsx    per-layer controls (memo'd)
    Icon.jsx          inline SVG icon set and logo
  hooks/
    usePlayback.js    rAF clock, media sync, seek/play/pause
    useTheme.js       light/dark, persisted
  lib/
    time.js           speed, layer footprint, active window, source mapping
    geometry.js       crop math and aspect-ratio locking
    render.js         canvas compositor
    formats.js        MediaRecorder format detection
    media.js          media elements and the WebAudio graph
```

The canvas compositor and the playback clock stay imperative on purpose:
they run every frame, so they live in refs and plain functions rather than
React state. React owns the UI; `usePlayback` commits the current time into
state once per frame for the components that display it.

## Using it

- **Add media** — click **+ Add Media**, drag files onto the preview, or **paste** (⌘V / Ctrl+V) a copied video, image, or audio file. The first video/image becomes the full-frame base layer; later ones come in as smaller overlays.
- **Add Text** — a text overlay you can reposition, recolor, and resize.
- **Move / resize layers** — drag overlays directly on the preview; corner handles resize. The full-frame base layer deliberately ignores canvas clicks (otherwise every click would select it) — pick it from the Layers panel.
- **Layers panel** (left) — select, hide, reorder, delete.
- **Properties panel** (right) — split into **Project** (output frame size and total length, always visible) and **Layer** (size in output pixels, opacity, brightness, speed, volume/mute, duration for stills).
- **Speed** — 0.25×–4×, set **per layer** in the Layer section. Each clip runs at its own rate, and the panel shows how long it ends up on the timeline (a 12s clip at 2× takes 6s). Stills have no speed — set their Duration instead.
- **Timeline** (bottom) — drag the two handles to trim the start and end. Click or drag anywhere on the bar to scrub.
- **Crop** — a two-step process, driven from a small toolbar floating over the preview:
  1. Press **Crop**. The frame dims outside a draggable region with rule-of-thirds guides.
  2. Optionally lock a ratio (16:9, 9:16, 1:1, 4:3, 3:4, 4:5, 21:9) — the default is **Free**. Hold **Shift** while dragging a corner to keep whatever ratio the box currently has. The centre button snaps the region to the middle of the frame.
  3. Confirm with the checkmark or **Enter**; cancel with the X or **Escape**.

  Confirming actually resizes the output frame, so the preview becomes what you'll export. An **Undo** button then appears next to Crop to revert to the full frame. When you're not cropping, those are the only crop controls on screen.
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
