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
    time.js           clip trimming, layer footprint, active window, source mapping
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

- **Add media** — **+ Add Media** takes video and images; **+ Add Audio** takes audio. You can also drop files on the preview **or on the left panel**, or **paste** (⌘V / Ctrl+V). The first video/image becomes the full-frame base layer; later ones come in as smaller overlays.
- **Audio is not a layer.** It never draws to the canvas, so it lives in its own list and its own timeline lane below the main bar. Drag a clip sideways to change when it starts; select it for volume, mute, trim and start time. A video's own soundtrack still belongs to that video layer.
- **Add Text** — a text overlay you can reposition, recolor, and resize.
- **Move / resize layers** — drag overlays directly on the preview; corner handles resize. The full-frame base layer deliberately ignores canvas clicks (otherwise every click would select it) — pick it from the Layers panel.
- **Layers panel** (left) — select, hide, reorder, delete.
- **Properties panel** (right) — split into **Project** (output frame size and total length, always visible) and **Layer** (size in output pixels, crop, opacity, volume/mute, duration for stills). Volume is disabled while a layer is muted.
- **Timeline** (bottom) — drag the two handles to trim the project start and end; click or drag the bar to scrub. **Zoom** with the +/- buttons (up to 40x, **Fit** returns to full width) when you need finer positioning. Audio clips sit in their own lane below: drag the middle to move a clip in time, drag either **end** to trim it.
- **Clip length** — an audio track can be cut to a window of its source, set by dragging either end of the clip or via the *Trim from* / *Length* fields. Clips play at their natural rate, so a 15s window occupies 15s of timeline.
- **Crop** — cropping is **per layer** and works as a process, from the Layer section of the right panel:
  1. Select a video or image layer and press **Crop layer**.
  2. Drag the region over the layer. Optionally lock a ratio (default **Free**), hold **Shift** on a corner to keep the current ratio, or **Snap to middle**.
  3. **Apply** (or **Enter**) cuts the layer down to that region; **Cancel** (or **Escape**) discards it. An **Undo** button then appears to restore the layer.

  Cropping cuts pixels out of the layer's source rather than scaling it, and only affects that layer — the output frame stays the size of the composition.
- **Theme** — the sun/moon button in the top bar toggles light/dark. Your choice is remembered; it defaults to your OS setting.
- **Export** — the output name defaults to `edited <your clip's name>` (change it and it stops auto-deriving). Pick a format in the top bar (the menu only lists what your browser can actually record — Chrome offers MP4/H.264 and WebM), then Export renders the trimmed range with crop, speed, and layers applied.

## Type

Two families, bundled locally via `@fontsource` (no network fetch):

- **Unbounded** — the wordmark and every section heading. Geometric and wide.
- **Outfit** — all UI text. The same circular geometric skeleton, but drawn
  for reading at small sizes.

They are exposed as `--font-display` and `--font-ui`, so the whole app shifts
by editing two tokens.

## Audio

Playback deliberately does **not** route through WebAudio. Calling
`createMediaElementSource` permanently redirects an element's output into the
graph, so any failure there — a suspended context, no output device, a
throwing constructor — silences playback completely. Volume and mute are set
on the elements directly, and the WebAudio graph is built lazily at export
time (still wired to the speakers, so you keep hearing it).

## Time display

Times read as `12.34` under a minute, `1:05.40` past one, `1:01:05.40` past an hour — hundredths always, larger units only when they are non-zero.

## Units

Layer sizes and the crop badge are in **pixels of the output frame**. The output frame matches the first video or image you add (a 1920×1080 clip gives you a 1920×1080 canvas); before then it's 1280×720.

## Notes

- Rendering goes through `<canvas>` + `MediaRecorder`, so export runs in real time — a 10s range at 2× speed takes ~5s.
- Crop dimensions are rounded to even numbers for codec compatibility, so a locked ratio can drift by well under a percent.
- The area around the video is the app background, not letterboxing — the thin border marks the actual frame edge. The output frame always matches your source exactly, so no bars get baked into the export.
- Nothing is uploaded — everything happens in your browser tab.
