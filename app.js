"use strict";

/* =========================================================
   Sedit — a small canvas-based video/audio editor.
   Trim, frame crop, speed, and layered overlays,
   rendered with <canvas> and exported via MediaRecorder.
   ========================================================= */

/* ---------- DOM ---------- */

const el = {
  fileInput: document.getElementById("fileInput"),
  addTextBtn: document.getElementById("addTextBtn"),
  layerList: document.getElementById("layerList"),
  propertiesBody: document.getElementById("propertiesBody"),
  stage: document.getElementById("stage"),
  canvas: document.getElementById("previewCanvas"),
  dropHint: document.getElementById("dropHint"),
  stageOverlay: document.getElementById("stageOverlay"),
  selectionBox: document.getElementById("selectionBox"),
  cropOverlay: document.getElementById("cropOverlay"),
  cropRectEl: document.getElementById("cropRectEl"),
  playBtn: document.getElementById("playBtn"),
  timeLabel: document.getElementById("timeLabel"),
  cropToggleBtn: document.getElementById("cropToggleBtn"),
  aspectSelect: document.getElementById("aspectSelect"),
  cropSizeBadge: document.getElementById("cropSizeBadge"),
  themeToggle: document.getElementById("themeToggle"),
  timeline: document.getElementById("timeline"),
  trimRange: document.getElementById("trimRange"),
  trimInHandle: document.getElementById("trimInHandle"),
  trimOutHandle: document.getElementById("trimOutHandle"),
  playhead: document.getElementById("playhead"),
  exportBtn: document.getElementById("exportBtn"),
  filenameInput: document.getElementById("filenameInput"),
  formatSelect: document.getElementById("formatSelect"),
  exportOverlay: document.getElementById("exportOverlay"),
  exportTitle: document.getElementById("exportTitle"),
  exportBarFill: document.getElementById("exportBarFill"),
  exportSub: document.getElementById("exportSub"),
  exportCancelBtn: document.getElementById("exportCancelBtn"),
  toast: document.getElementById("toast"),
};

const ctx = el.canvas.getContext("2d");

/* ---------- State ---------- */

let layers = [];
let layerCounter = 0;
let selectedLayerId = null;
let canvasSizeLocked = false;

const state = {
  duration: 5,
  trimIn: 0,
  trimOut: 5,
  trimOutIsMax: true,
  playheadTime: 0,
  playing: false,
  playStartWall: 0,
  playStartComp: 0,
  cropMode: false,
  crop: { x: 0, y: 0, w: 100, h: 100 },
  aspect: "free",
  exporting: false,
  _raf: null,
};

/* ---------- Theme ---------- */

function applyTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  setIcon(el.themeToggle, mode === "light" ? "moon" : "sun");
  el.themeToggle.title = mode === "light" ? "Switch to dark" : "Switch to light";
  try {
    localStorage.setItem("sedit-theme", mode);
  } catch (e) {}
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem("sedit-theme");
  } catch (e) {}
  if (!saved) {
    saved = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  applyTheme(saved);
}

el.themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  applyTheme(current === "light" ? "dark" : "light");
});

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/* ---------- Icons ----------
   Inline stroked SVG rather than emoji: emoji render differently on every
   platform, carry their own colour, and can't inherit the theme. */

const SVG_OPEN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">';

const ICON_PATHS = {
  video:
    '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/>' +
    '<path d="M10.2 9.6v4.8l4.2-2.4z" fill="currentColor" stroke="none"/>',
  audio:
    '<path d="M9 17V4.8l10-1.8V15"/>' +
    '<circle cx="6.6" cy="17.4" r="2.6"/><circle cx="16.6" cy="15.4" r="2.6"/>',
  image:
    '<rect x="3" y="3.5" width="18" height="17" rx="2.5"/>' +
    '<circle cx="8.6" cy="9.2" r="1.6"/><path d="m3.6 17.5 5-4.6 4.5 4.2 3-2.6 4.3 3.9"/>',
  text: '<path d="M5 7.5V5.5h14v2"/><path d="M12 5.5v13"/><path d="M9 18.5h6"/>',
  eye:
    '<path d="M2.2 12S5.9 5.6 12 5.6 21.8 12 21.8 12 18.1 18.4 12 18.4 2.2 12 2.2 12Z"/>' +
    '<circle cx="12" cy="12" r="3"/>',
  eyeOff:
    '<path d="M3.5 3.5 20.5 20.5"/>' +
    '<path d="M10.3 5.9A9.6 9.6 0 0 1 12 5.6c6.1 0 9.8 6.4 9.8 6.4a18.7 18.7 0 0 1-3.3 4.1"/>' +
    '<path d="M6.9 7.2A18.4 18.4 0 0 0 2.2 12S5.9 18.4 12 18.4a9.5 9.5 0 0 0 3.7-.8"/>',
  up: '<path d="m6.5 14.5 5.5-5.5 5.5 5.5"/>',
  down: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  trash: '<path d="M3.8 6.3h16.4M9.3 6.3V4.2h5.4v2.1M6.3 6.3l1 13.5h9.4l1-13.5"/>',
  play: '<path d="M7.5 4.6 19 12 7.5 19.4z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 4.6v14.8M15 4.6v14.8" stroke-width="2.2"/>',
  sun:
    '<circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6 6 18M18 6l1.6-1.6"/>',
  moon: '<path d="M20.8 13.4A8.6 8.6 0 1 1 10.6 3.2a6.8 6.8 0 0 0 10.2 10.2Z"/>',
};

function iconMarkup(name) {
  return SVG_OPEN + (ICON_PATHS[name] || "") + "</svg>";
}

function setIcon(node, name) {
  node.innerHTML = iconMarkup(name);
}

function iconEl(name, cls) {
  const span = document.createElement("span");
  span.className = "icon" + (cls ? " " + cls : "");
  span.innerHTML = iconMarkup(name);
  return span;
}

/* ---------- Utilities ---------- */

function uid() {
  layerCounter += 1;
  return "layer-" + layerCounter;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function layerSpeed(l) {
  return l.speed && l.speed > 0 ? l.speed : 1;
}

/* How much room the layer takes on the timeline. Speeding a clip up shortens
   its footprint (10s at 2x occupies 5s), which is what makes speed per-layer:
   the composition clock always runs at real time and each layer maps its own
   source time onto it. */
function layerLen(l) {
  if (l.type === "image" || l.type === "text") return l.len;
  return (l.duration || 0) / layerSpeed(l);
}

/* A layer is active through its final frame *inclusive*. Playback stops exactly
   on trimOut, so an exclusive end would blank the frame the moment you pause
   at the end — which reads as "the video went black". */
const END_EPS = 0.001;

function isLayerActive(l, t) {
  const local = t - l.offset;
  return local >= -END_EPS && local <= layerLen(l) + END_EPS;
}

// Where to park a media element's currentTime for composition time `t`.
// Scaled by the layer's speed, and clamped just inside the media so seeking to
// the very end doesn't overshoot into the browser's "ended" state (also black).
function layerLocalTime(l, t) {
  const source = (t - l.offset) * layerSpeed(l);
  const dur = l.duration || layerLen(l);
  return clamp(source, 0, Math.max(0, dur - 0.04));
}

function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m + ":" + s.toFixed(1).padStart(4, "0");
}

function toast(msg, ms) {
  el.toast.textContent = msg;
  el.toast.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.add("hidden"), ms || 2400);
}

function isFirstVisualLayer() {
  return !layers.some((l) => l.type === "video" || l.type === "image");
}

// Covers the entire output frame (i.e. the base layer).
function isFullFrame(l) {
  return l.x <= 0.5 && l.y <= 0.5 && l.w >= 99.5 && l.h >= 99.5;
}

/* ---------- Layer creation ---------- */

function addFileLayer(file) {
  const kind = file.type.split("/")[0]; // video | audio | image
  if (!["video", "audio", "image"].includes(kind)) {
    toast("Unsupported file: " + file.name);
    return;
  }
  const url = URL.createObjectURL(file);
  const firstVisual = kind !== "audio" && isFirstVisualLayer();

  const layer = {
    id: uid(),
    type: kind,
    name: file.name,
    src: url,
    el: null,
    duration: 0,
    offset: 0,
    len: 5,
    x: firstVisual ? 0 : 58,
    y: firstVisual ? 0 : 4,
    w: firstVisual ? 100 : 38,
    h: firstVisual ? 100 : 38,
    opacity: 1,
    brightness: 1,
    visible: true,
    muted: false,
    volume: 1,
    speed: 1,
  };

  if (kind === "video") {
    const v = document.createElement("video");
    v.src = url;
    v.preload = "auto";
    v.playsInline = true;
    v.crossOrigin = "anonymous";
    v.loop = false;
    layer.el = v;
    v.addEventListener("loadedmetadata", () => {
      layer.duration = v.duration || 0;
      ensureCanvasSize(v.videoWidth, v.videoHeight);
      attachAudioGraph(layer);
      recomputeDuration();
      renderLayerList();
      if (selectedLayerId === layer.id) renderProperties();
      draw(state.playheadTime);
    });
    // A seek finishes asynchronously — repaint once the frame is actually
    // decoded, otherwise a paused/scrubbed frame stays blank.
    ["seeked", "loadeddata", "canplay"].forEach((evt) =>
      v.addEventListener(evt, () => {
        if (!state.playing) draw(state.playheadTime);
      })
    );
  } else if (kind === "audio") {
    const a = document.createElement("audio");
    a.src = url;
    a.preload = "auto";
    layer.el = a;
    a.addEventListener("loadedmetadata", () => {
      layer.duration = a.duration || 0;
      attachAudioGraph(layer);
      recomputeDuration();
      renderLayerList();
      if (selectedLayerId === layer.id) renderProperties();
    });
  } else if (kind === "image") {
    const img = document.createElement("img");
    img.src = url;
    layer.el = img;
    img.addEventListener("load", () => {
      ensureCanvasSize(img.naturalWidth, img.naturalHeight);
      recomputeDuration();
      renderLayerList();
      draw(state.playheadTime);
    });
  }

  layers.push(layer);
  selectedLayerId = layer.id;
  recomputeDuration();
  renderLayerList();
  renderProperties();
  refreshFormatOptions();
  syncFrame();
  draw(state.playheadTime);
}

function addTextLayer() {
  const layer = {
    id: uid(),
    type: "text",
    name: "Text",
    el: null,
    offset: clamp(state.playheadTime, 0, 999999),
    len: 5,
    x: 15,
    y: 78,
    w: 70,
    h: 16,
    opacity: 1,
    brightness: 1,
    visible: true,
    text: "Your text here",
    color: "#ffffff",
    fontSize: 7,
  };
  layers.push(layer);
  selectedLayerId = layer.id;
  recomputeDuration();
  renderLayerList();
  renderProperties();
  refreshFormatOptions();
  syncFrame();
  draw(state.playheadTime);
}

function attachAudioGraph(layer) {
  if (layer._gain || !layer.el) return;
  try {
    const ac = getAudioCtx();
    const src = ac.createMediaElementSource(layer.el);
    const gain = ac.createGain();
    gain.gain.value = layer.muted ? 0 : layer.volume;
    src.connect(gain);
    gain.connect(ac.destination);
    layer._src = src;
    layer._gain = gain;
  } catch (e) {
    console.warn("audio graph failed", e);
  }
}

function updateLayerGain(layer) {
  if (layer._gain) {
    layer._gain.gain.value = layer.muted ? 0 : layer.volume;
  }
}

function ensureCanvasSize(w, h) {
  if (canvasSizeLocked || !w || !h) return;
  el.canvas.width = w;
  el.canvas.height = h;
  canvasSizeLocked = true;
  renderProperties(); // output-frame size is shown in the Project section
  syncFrame();
}

function removeLayer(id) {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx === -1) return;
  const layer = layers[idx];
  if (layer.el) {
    layer.el.pause && layer.el.pause();
    if (layer._gain) {
      try {
        layer._gain.disconnect();
      } catch (e) {}
    }
    if (layer.src) URL.revokeObjectURL(layer.src);
  }
  layers.splice(idx, 1);
  if (selectedLayerId === id) selectedLayerId = null;
  recomputeDuration();
  renderLayerList();
  renderProperties();
  refreshFormatOptions();
  syncFrame();
  draw(state.playheadTime);
}

function moveLayer(id, dir) {
  const idx = layers.findIndex((l) => l.id === id);
  const newIdx = idx + dir;
  if (idx === -1 || newIdx < 0 || newIdx >= layers.length) return;
  const [item] = layers.splice(idx, 1);
  layers.splice(newIdx, 0, item);
  renderLayerList();
  draw(state.playheadTime);
}

/* ---------- Duration / timeline math ---------- */

function recomputeDuration() {
  let max = 0;
  layers.forEach((l) => {
    max = Math.max(max, l.offset + layerLen(l));
  });
  state.duration = Math.max(max, 1);
  if (state.trimOutIsMax) state.trimOut = state.duration;
  state.trimIn = clamp(state.trimIn, 0, state.duration);
  state.trimOut = clamp(state.trimOut, state.trimIn + 0.05, state.duration);
  state.playheadTime = clamp(state.playheadTime, 0, state.duration);
  layoutTimeline();
  updateTimeLabel(state.playheadTime);
}

function layoutTimeline() {
  const width = el.timeline.clientWidth;
  const inPx = (state.trimIn / state.duration) * width;
  const outPx = (state.trimOut / state.duration) * width;
  el.trimRange.style.left = inPx + "px";
  el.trimRange.style.width = Math.max(0, outPx - inPx) + "px";
  el.trimInHandle.style.left = inPx - 3 + "px";
  el.trimOutHandle.style.left = outPx - 3 + "px";
  layoutPlayhead();
}

/* `state.playheadTime` is only committed on pause/seek — while playing, the
   live time is the composition clock. Callers during playback must pass it in,
   or the marker freezes where playback started. */
function layoutPlayhead(t) {
  const time = t == null ? state.playheadTime : t;
  const width = el.timeline.clientWidth;
  const px = (time / state.duration) * width;
  el.playhead.style.left = px + "px";
}

function updateTimeLabel(t) {
  el.timeLabel.textContent = formatTime(t) + " / " + formatTime(state.duration);
}

/* ---------- Playback clock ---------- */

function getCompTime() {
  if (!state.playing) return state.playheadTime;
  const elapsed = (performance.now() - state.playStartWall) / 1000;
  return state.playStartComp + elapsed;
}

function play() {
  if (layers.length === 0) {
    toast("Add some media first");
    return;
  }
  const ac = getAudioCtx();
  if (ac.state === "suspended") ac.resume();

  if (state.playheadTime >= state.trimOut - 0.01) {
    state.playheadTime = state.trimIn;
  }
  state.playing = true;
  state.playStartWall = performance.now();
  state.playStartComp = state.playheadTime;

  const t = state.playheadTime;
  layers.forEach((l) => {
    if (!l.el) return;
    if (isLayerActive(l, t)) {
      try {
        l.el.currentTime = layerLocalTime(l, t);
      } catch (e) {}
      l.el.playbackRate = layerSpeed(l);
      l.el.play().catch(() => {});
    }
  });

  setIcon(el.playBtn, "pause");
  state._raf = requestAnimationFrame(tick);
}

function pause() {
  state.playheadTime = getCompTime();
  state.playing = false;
  layers.forEach((l) => l.el && l.el.pause());
  if (state._raf) cancelAnimationFrame(state._raf);
  setIcon(el.playBtn, "play");
  draw(state.playheadTime);
  layoutPlayhead();
  updateTimeLabel(state.playheadTime);
}

function tick() {
  if (!state.playing) return;
  const t = getCompTime();

  if (t >= state.trimOut) {
    state.playheadTime = state.trimOut;
    state.playing = false;
    layers.forEach((l) => l.el && l.el.pause());
    setIcon(el.playBtn, "play");
    draw(state.trimOut);
    layoutPlayhead();
    updateTimeLabel(state.trimOut);
    if (state.exporting) finishExport();
    return;
  }

  layers.forEach((l) => {
    if (!l.el) return;
    if (isLayerActive(l, t)) {
      const target = layerLocalTime(l, t);
      if (l.el.paused) {
        try {
          l.el.currentTime = target;
        } catch (e) {}
        l.el.play().catch(() => {});
      } else if (Math.abs(l.el.currentTime - target) > 0.25) {
        try {
          l.el.currentTime = target;
        } catch (e) {}
      }
      l.el.playbackRate = layerSpeed(l);
    } else if (!l.el.paused) {
      l.el.pause();
    }
  });

  draw(t);
  layoutPlayhead(t);
  updateTimeLabel(t);
  if (state.exporting) updateExportProgress(t);

  state._raf = requestAnimationFrame(tick);
}

function seekAll(t) {
  layers.forEach((l) => {
    if (!l.el) return;
    l.el.pause();
    if (isLayerActive(l, t)) {
      try {
        l.el.currentTime = layerLocalTime(l, t);
      } catch (e) {}
    }
  });
  draw(t);
  layoutPlayhead(t);
  updateTimeLabel(t);
}

/* ---------- Drawing ---------- */

function wrapText(c, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  let line = "";
  let cy = y;
  words.forEach((word, i) => {
    const test = line ? line + " " + word : word;
    if (c.measureText(test).width > maxWidth && line) {
      c.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  });
  if (line) c.fillText(line, x, cy);
}

function draw(t) {
  const w = el.canvas.width;
  const h = el.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  layers.forEach((l) => {
    if (!l.visible) return;
    if (!isLayerActive(l, t)) return;

    ctx.save();
    ctx.globalAlpha = l.opacity != null ? l.opacity : 1;
    if (l.brightness != null && l.brightness !== 1) {
      ctx.filter = "brightness(" + l.brightness + ")";
    }
    const px = (l.x / 100) * w;
    const py = (l.y / 100) * h;
    const pw = (l.w / 100) * w;
    const ph = (l.h / 100) * h;

    if (l.type === "video") {
      // readyState can dip right after a seek; drawing anyway would clear the
      // frame to black, so hold the last good frame until the decoder catches up.
      if (l.el && l.el.readyState >= 2) {
        try {
          ctx.drawImage(l.el, px, py, pw, ph);
        } catch (e) {}
      }
    } else if (l.type === "image") {
      try {
        ctx.drawImage(l.el, px, py, pw, ph);
      } catch (e) {}
    } else if (l.type === "text") {
      const fs = (l.fontSize / 100) * h;
      ctx.fillStyle = l.color || "#ffffff";
      ctx.font = "700 " + fs + "px -apple-system, Helvetica, sans-serif";
      ctx.textBaseline = "top";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = fs * 0.15;
      wrapText(ctx, l.text || "", px, py, pw, fs * 1.25);
    }
    ctx.restore();
  });

  if (state.exporting && state._exportCtx) {
    const c = state._exportCrop;
    state._exportCtx.clearRect(0, 0, state._exportCanvas.width, state._exportCanvas.height);
    try {
      state._exportCtx.drawImage(
        el.canvas,
        c.px,
        c.py,
        c.pw,
        c.ph,
        0,
        0,
        state._exportCanvas.width,
        state._exportCanvas.height
      );
    } catch (e) {}
  }

  if (!state.playing) syncSelectionBox();
}

/* ---------- Frame / overlay sync (canvas <-> DOM overlays) ---------- */

function syncFrame() {
  const stageRect = el.stage.getBoundingClientRect();
  const canvasRect = el.canvas.getBoundingClientRect();
  const frame = {
    left: canvasRect.left - stageRect.left,
    top: canvasRect.top - stageRect.top,
    width: canvasRect.width,
    height: canvasRect.height,
  };
  [el.stageOverlay, el.selectionBox, el.cropOverlay].forEach((node) => {
    if (node === el.selectionBox && node.classList.contains("hidden")) return;
    node.style.left = frame.left + "px";
    node.style.top = frame.top + "px";
    node.style.width = frame.width + "px";
    node.style.height = frame.height + "px";
  });
  state._frame = frame;
  syncSelectionBox();
  syncCropRect();
  el.dropHint.style.display = layers.length === 0 ? "flex" : "none";
}

function syncSelectionBox() {
  if (!selectedLayerId || state.cropMode) {
    el.selectionBox.classList.add("hidden");
    return;
  }
  const layer = layers.find((l) => l.id === selectedLayerId);
  // No box for audio (nothing on screen) or the full-frame base layer —
  // outlining the entire frame just looks like everything is selected.
  if (!layer || layer.type === "audio" || isFullFrame(layer)) {
    el.selectionBox.classList.add("hidden");
    return;
  }
  if (!state._frame) syncFrame();
  const f = state._frame;
  if (!f) return;
  el.selectionBox.classList.remove("hidden");
  el.selectionBox.style.left = f.left + (layer.x / 100) * f.width + "px";
  el.selectionBox.style.top = f.top + (layer.y / 100) * f.height + "px";
  el.selectionBox.style.width = (layer.w / 100) * f.width + "px";
  el.selectionBox.style.height = (layer.h / 100) * f.height + "px";
}

function syncCropRect() {
  const f = state._frame;
  if (!f) return;
  const c = state.crop;
  el.cropRectEl.style.left = (c.x / 100) * f.width + "px";
  el.cropRectEl.style.top = (c.y / 100) * f.height + "px";
  el.cropRectEl.style.width = (c.w / 100) * f.width + "px";
  el.cropRectEl.style.height = (c.h / 100) * f.height + "px";

  const maskT = document.querySelector(".crop-mask-t");
  const maskB = document.querySelector(".crop-mask-b");
  const maskL = document.querySelector(".crop-mask-l");
  const maskR = document.querySelector(".crop-mask-r");
  const rx = (c.x / 100) * f.width;
  const ry = (c.y / 100) * f.height;
  const rw = (c.w / 100) * f.width;
  const rh = (c.h / 100) * f.height;
  maskT.style.cssText = `left:0;top:0;width:100%;height:${ry}px;`;
  maskB.style.cssText = `left:0;top:${ry + rh}px;width:100%;height:${f.height - ry - rh}px;`;
  maskL.style.cssText = `left:0;top:${ry}px;width:${rx}px;height:${rh}px;`;
  maskR.style.cssText = `left:${rx + rw}px;top:${ry}px;width:${f.width - rx - rw}px;height:${rh}px;`;

  const outW = Math.round((c.w / 100) * el.canvas.width);
  const outH = Math.round((c.h / 100) * el.canvas.height);
  el.cropSizeBadge.textContent = outW + " × " + outH + " px";
}

window.addEventListener("resize", syncFrame);

/* ---------- Layer list UI ---------- */


function renderLayerList() {
  el.layerList.innerHTML = "";
  if (layers.length === 0) {
    const hint = document.createElement("div");
    hint.className = "empty-hint";
    hint.textContent = "No media yet. Add a video, audio or image file to get started.";
    el.layerList.appendChild(hint);
    return;
  }
  // display topmost (last in array) first
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    const item = document.createElement("div");
    item.className = "layer-item" + (l.id === selectedLayerId ? " selected" : "");
    item.addEventListener("click", () => {
      selectedLayerId = l.id;
      renderLayerList();
      renderProperties();
      draw(state.playing ? getCompTime() : state.playheadTime);
    });

    const thumb = document.createElement("div");
    thumb.className = "layer-thumb";
    thumb.appendChild(iconEl(l.type, "icon-16"));
    item.appendChild(thumb);

    const meta = document.createElement("div");
    meta.className = "layer-meta";
    const name = document.createElement("div");
    name.className = "layer-name";
    name.textContent = l.name;
    const type = document.createElement("div");
    type.className = "layer-type";
    type.textContent = l.type;
    meta.appendChild(name);
    meta.appendChild(type);
    item.appendChild(meta);

    const controls = document.createElement("div");
    controls.className = "layer-controls";

    const visBtn = document.createElement("button");
    visBtn.className = "layer-icon-btn" + (l.visible ? "" : " off");
    visBtn.title = l.visible ? "Hide layer" : "Show layer";
    visBtn.appendChild(iconEl(l.visible ? "eye" : "eyeOff", "icon-14"));
    visBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      l.visible = !l.visible;
      renderLayerList();
      draw(state.playing ? getCompTime() : state.playheadTime);
    });
    controls.appendChild(visBtn);

    const upBtn = document.createElement("button");
    upBtn.className = "layer-icon-btn";
    upBtn.title = "Bring forward";
    upBtn.appendChild(iconEl("up", "icon-14"));
    upBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      moveLayer(l.id, 1);
    });
    controls.appendChild(upBtn);

    const downBtn = document.createElement("button");
    downBtn.className = "layer-icon-btn";
    downBtn.title = "Send backward";
    downBtn.appendChild(iconEl("down", "icon-14"));
    downBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      moveLayer(l.id, -1);
    });
    controls.appendChild(downBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "layer-icon-btn";
    delBtn.title = "Delete";
    delBtn.appendChild(iconEl("trash", "icon-14"));
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeLayer(l.id);
    });
    controls.appendChild(delBtn);

    item.appendChild(controls);
    el.layerList.appendChild(item);
  }
}

/* ---------- Properties panel UI ---------- */

function field(labelText, inputNode) {
  const group = document.createElement("div");
  group.className = "prop-group";
  const label = document.createElement("div");
  label.className = "prop-label";
  label.textContent = labelText;
  group.appendChild(label);
  group.appendChild(inputNode);
  return group;
}

function sectionTitle(text) {
  const div = document.createElement("div");
  div.className = "prop-section-title";
  div.textContent = text;
  return div;
}

function selectField(labelText, options, value, onChange) {
  const group = document.createElement("div");
  group.className = "prop-group";
  const label = document.createElement("div");
  label.className = "prop-label";
  label.textContent = labelText;
  const sel = document.createElement("select");
  sel.className = "prop-input";
  options.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    if (String(o.value) === String(value)) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener("change", () => onChange(sel.value));
  group.appendChild(label);
  group.appendChild(sel);
  return group;
}

function numberInput(value, step, onChange) {
  const input = document.createElement("input");
  input.type = "number";
  input.className = "prop-input prop-input-sm";
  input.value = Math.round(value * 100) / 100;
  input.step = step || 1;
  input.addEventListener("input", () => onChange(parseFloat(input.value) || 0));
  return input;
}

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

function renderProjectSection(body) {
  body.appendChild(sectionTitle("Project"));

  const frame = document.createElement("div");
  frame.className = "prop-hint";
  frame.textContent =
    "Output frame: " +
    el.canvas.width +
    " × " +
    el.canvas.height +
    " px  ·  Length: " +
    formatTime(state.duration);
  body.appendChild(frame);
}

function renderProperties() {
  const body = el.propertiesBody;
  body.innerHTML = "";

  renderProjectSection(body);

  const layer = layers.find((l) => l.id === selectedLayerId);
  if (!layer) {
    const hint = document.createElement("div");
    hint.className = "empty-hint";
    hint.style.padding = "4px 0";
    hint.textContent =
      layers.length === 0
        ? "Add media to begin, then select a layer to edit it."
        : "Select a layer on the left to edit it.";
    body.appendChild(hint);
    return;
  }

  body.appendChild(sectionTitle("Layer"));

  // Name
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "prop-input";
  nameInput.value = layer.name;
  nameInput.addEventListener("input", () => {
    layer.name = nameInput.value;
    renderLayerList();
  });
  body.appendChild(field("Name", nameInput));

  // Text-specific
  if (layer.type === "text") {
    const textarea = document.createElement("textarea");
    textarea.className = "prop-textarea";
    textarea.value = layer.text;
    textarea.addEventListener("input", () => {
      layer.text = textarea.value;
      draw(state.playing ? getCompTime() : state.playheadTime);
    });
    body.appendChild(field("Text", textarea));

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.className = "prop-color";
    colorInput.value = layer.color;
    colorInput.addEventListener("input", () => {
      layer.color = colorInput.value;
      draw(state.playing ? getCompTime() : state.playheadTime);
    });
    body.appendChild(field("Color", colorInput));

    const fsRow = rangeField("Font size", layer.fontSize, 1, 25, 0.5, (v) => {
      layer.fontSize = v;
      draw(state.playing ? getCompTime() : state.playheadTime);
    });
    body.appendChild(fsRow);
  }

  // Size, in output pixels, for anything drawn on canvas
  if (layer.type !== "audio") {
    const cw = el.canvas.width;
    const ch = el.canvas.height;

    const sizeGroup = document.createElement("div");
    sizeGroup.className = "prop-group";
    const label = document.createElement("div");
    label.className = "prop-label";
    label.textContent = "Size (pixels)";
    sizeGroup.appendChild(label);

    const row = document.createElement("div");
    row.className = "prop-row";
    row.appendChild(
      labeledMini("Width", Math.round((layer.w / 100) * cw), (v) =>
        setLayerRect(layer, { w: (v / cw) * 100 })
      )
    );
    row.appendChild(
      labeledMini("Height", Math.round((layer.h / 100) * ch), (v) =>
        setLayerRect(layer, { h: (v / ch) * 100 })
      )
    );
    sizeGroup.appendChild(row);

    const hint = document.createElement("div");
    hint.className = "prop-hint";
    hint.textContent = `Pixels in the ${cw}×${ch} output frame. Drag the layer on the preview to move it.`;
    sizeGroup.appendChild(hint);

    body.appendChild(sizeGroup);

    body.appendChild(
      rangeField("Opacity", layer.opacity * 100, 0, 100, 1, (v) => {
        layer.opacity = v / 100;
        draw(state.playing ? getCompTime() : state.playheadTime);
      })
    );

    body.appendChild(
      rangeField("Brightness", (layer.brightness || 1) * 100, 0, 200, 1, (v) => {
        layer.brightness = v / 100;
        draw(state.playing ? getCompTime() : state.playheadTime);
      })
    );
  }

  // Duration — only for stills, which have no intrinsic length
  if (layer.type === "image" || layer.type === "text") {
    const lenInput = numberInput(layer.len, 0.1, (v) => {
      layer.len = Math.max(0.1, v);
      recomputeDuration();
      draw(state.playing ? getCompTime() : state.playheadTime);
    });
    body.appendChild(field("Duration (seconds)", lenInput));
  }

  // Speed — per layer, so clips can run at different rates in one project
  if (layer.type === "video" || layer.type === "audio") {
    body.appendChild(
      selectField(
        "Speed",
        SPEEDS.map((s) => ({ value: s, label: s + "×" })),
        layerSpeed(layer),
        (v) => setLayerSpeed(layer, v)
      )
    );

    const srcLen = layer.duration || 0;
    const timeHint = document.createElement("div");
    timeHint.className = "prop-hint";
    timeHint.textContent =
      "Source " +
      formatTime(srcLen) +
      "  ·  takes " +
      formatTime(layerLen(layer)) +
      " on the timeline";
    body.appendChild(timeHint);
  }

  // Audio controls
  if (layer.type === "video" || layer.type === "audio") {
    const muteRow = document.createElement("div");
    muteRow.className = "prop-toggle-row";
    const muteLabel = document.createElement("div");
    muteLabel.className = "prop-label";
    muteLabel.textContent = "Mute";
    const sw = document.createElement("label");
    sw.className = "switch";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = layer.muted;
    const track = document.createElement("div");
    track.className = "switch-track";
    cb.addEventListener("change", () => {
      layer.muted = cb.checked;
      updateLayerGain(layer);
    });
    sw.appendChild(cb);
    sw.appendChild(track);
    muteRow.appendChild(muteLabel);
    muteRow.appendChild(sw);
    body.appendChild(muteRow);

    body.appendChild(
      rangeField("Volume", layer.volume * 100, 0, 100, 1, (v) => {
        layer.volume = v / 100;
        updateLayerGain(layer);
      })
    );
  }

  // Remove
  const removeBtn = document.createElement("button");
  removeBtn.className = "remove-btn";
  removeBtn.textContent = "Remove layer";
  removeBtn.addEventListener("click", () => removeLayer(layer.id));
  body.appendChild(removeBtn);
}

function labeledMini(labelText, value, onChange) {
  const wrap = document.createElement("div");
  wrap.style.flex = "1";
  const label = document.createElement("div");
  label.className = "prop-value";
  label.textContent = labelText;
  const input = numberInput(value, 1, onChange);
  input.style.width = "100%";
  wrap.appendChild(label);
  wrap.appendChild(input);
  return wrap;
}

function rangeField(labelText, value, min, max, step, onChange) {
  const group = document.createElement("div");
  group.className = "prop-group";
  const label = document.createElement("div");
  label.className = "prop-label";
  label.textContent = labelText;
  const range = document.createElement("input");
  range.type = "range";
  range.className = "prop-range";
  range.min = min;
  range.max = max;
  range.step = step;
  range.value = value;
  const valueLabel = document.createElement("div");
  valueLabel.className = "prop-value";
  valueLabel.textContent = Math.round(value);
  range.addEventListener("input", () => {
    const v = parseFloat(range.value);
    valueLabel.textContent = Math.round(v);
    onChange(v);
  });
  group.appendChild(label);
  group.appendChild(range);
  group.appendChild(valueLabel);
  return group;
}

function setLayerRect(layer, patch) {
  Object.assign(layer, patch);
  layer.w = clamp(layer.w, 2, 100);
  layer.h = clamp(layer.h, 2, 100);
  layer.x = clamp(layer.x, 0, 100 - layer.w);
  layer.y = clamp(layer.y, 0, 100 - layer.h);
  syncSelectionBox();
  draw(state.playing ? getCompTime() : state.playheadTime);
}

/* ---------- Stage interaction: select / move / resize layers ---------- */

let dragState = null;

el.stageOverlay.addEventListener("pointerdown", (e) => {
  if (state.cropMode) return;
  const f = state._frame;
  if (!f) return;
  const px = ((e.clientX - (el.stage.getBoundingClientRect().left + f.left)) / f.width) * 100;
  const py = ((e.clientY - (el.stage.getBoundingClientRect().top + f.top)) / f.height) * 100;

  let hit = null;
  const t = state.playing ? getCompTime() : state.playheadTime;
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    if (l.type === "audio" || !l.visible) continue;
    // A layer filling the whole frame would otherwise catch every click and
    // make it look like the editor selects everything. Pick it from the
    // Layers panel instead.
    if (isFullFrame(l)) continue;
    if (!isLayerActive(l, t)) continue;
    if (px >= l.x && px <= l.x + l.w && py >= l.y && py <= l.y + l.h) {
      hit = l;
      break;
    }
  }

  if (hit) {
    selectedLayerId = hit.id;
    renderLayerList();
    renderProperties();
    syncSelectionBox();
    dragState = {
      mode: "move",
      layer: hit,
      startX: e.clientX,
      startY: e.clientY,
      startLayer: { x: hit.x, y: hit.y, w: hit.w, h: hit.h },
    };
  } else {
    selectedLayerId = null;
    renderLayerList();
    renderProperties();
    syncSelectionBox();
  }
});

el.selectionBox.querySelectorAll(".handle").forEach((handle) => {
  handle.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    const layer = layers.find((l) => l.id === selectedLayerId);
    if (!layer) return;
    dragState = {
      mode: "resize",
      handle: handle.dataset.handle,
      layer,
      startX: e.clientX,
      startY: e.clientY,
      startLayer: { x: layer.x, y: layer.y, w: layer.w, h: layer.h },
    };
  });
});

el.selectionBox.addEventListener("pointerdown", (e) => {
  if (e.target !== el.selectionBox) return;
  const layer = layers.find((l) => l.id === selectedLayerId);
  if (!layer) return;
  dragState = {
    mode: "move",
    layer,
    startX: e.clientX,
    startY: e.clientY,
    startLayer: { x: layer.x, y: layer.y, w: layer.w, h: layer.h },
  };
});

document.addEventListener("pointermove", (e) => {
  if (!dragState || !state._frame) return;
  const f = state._frame;
  const dxPct = ((e.clientX - dragState.startX) / f.width) * 100;
  const dyPct = ((e.clientY - dragState.startY) / f.height) * 100;

  if (dragState.mode === "move" && dragState.layer) {
    const l = dragState.layer;
    l.x = clamp(dragState.startLayer.x + dxPct, 0, 100 - l.w);
    l.y = clamp(dragState.startLayer.y + dyPct, 0, 100 - l.h);
    syncSelectionBox();
    draw(state.playing ? getCompTime() : state.playheadTime);
  } else if (dragState.mode === "resize" && dragState.layer) {
    const l = dragState.layer;
    const s = dragState.startLayer;
    const minSize = 4;
    if (dragState.handle === "se") {
      l.w = clamp(s.w + dxPct, minSize, 100 - l.x);
      l.h = clamp(s.h + dyPct, minSize, 100 - l.y);
    } else if (dragState.handle === "sw") {
      const newW = clamp(s.w - dxPct, minSize, s.x + s.w);
      l.x = s.x + s.w - newW;
      l.w = newW;
      l.h = clamp(s.h + dyPct, minSize, 100 - l.y);
    } else if (dragState.handle === "ne") {
      l.w = clamp(s.w + dxPct, minSize, 100 - l.x);
      const newH = clamp(s.h - dyPct, minSize, s.y + s.h);
      l.y = s.y + s.h - newH;
      l.h = newH;
    } else if (dragState.handle === "nw") {
      const newW = clamp(s.w - dxPct, minSize, s.x + s.w);
      const newH = clamp(s.h - dyPct, minSize, s.y + s.h);
      l.x = s.x + s.w - newW;
      l.y = s.y + s.h - newH;
      l.w = newW;
      l.h = newH;
    }
    syncSelectionBox();
    draw(state.playing ? getCompTime() : state.playheadTime);
  } else if (dragState.mode === "crop-move") {
    const c = state.crop;
    const s = dragState.startCrop;
    c.x = clamp(s.x + dxPct, 0, 100 - c.w);
    c.y = clamp(s.y + dyPct, 0, 100 - c.h);
    syncCropRect();
  } else if (dragState.mode === "crop-resize") {
    // Shift keeps whatever ratio the box had when the drag began; the
    // dropdown locks it to a fixed one for the whole drag.
    const locked = parseAspect(state.aspect);
    const ratio = locked || (e.shiftKey ? dragState.startRatio : null);
    resizeCrop(dragState.handle, dragState.startCrop, dxPct, dyPct, ratio);
    syncCropRect();
  } else if (dragState.mode === "trimIn" || dragState.mode === "trimOut") {
    handleTrimDrag(e);
  } else if (dragState.mode === "scrub") {
    handleScrubDrag(e);
  }
});

document.addEventListener("pointerup", () => {
  if (dragState && (dragState.mode === "move" || dragState.mode === "resize")) {
    renderProperties();
  }
  dragState = null;
});

/* ---------- Crop geometry ----------
   crop.{x,y,w,h} are percentages of the canvas. An aspect ratio is about
   *pixels*, so converting between the two has to fold in the canvas shape. */

const MIN_CROP = 5;

function parseAspect(str) {
  if (!str || str === "free") return null;
  const [a, b] = str.split(":").map(Number);
  if (!a || !b) return null;
  return a / b;
}

// height % that pairs with a given width % to hit `ratio` in real pixels
function heightPctForRatio(wPct, ratio) {
  return (wPct * el.canvas.width) / (el.canvas.height * ratio);
}

function widthPctForRatio(hPct, ratio) {
  return (hPct * el.canvas.height * ratio) / el.canvas.width;
}

function cropPixelRatio(c) {
  const wPx = (c.w / 100) * el.canvas.width;
  const hPx = (c.h / 100) * el.canvas.height;
  return hPx > 0 ? wPx / hPx : 1;
}

function resizeCrop(handle, s, dxPct, dyPct, ratio) {
  const c = state.crop;
  const signX = handle === "se" || handle === "ne" ? 1 : -1;
  const signY = handle === "se" || handle === "sw" ? 1 : -1;

  // The corner that stays put, and how much room it leaves us.
  const anchorRight = s.x + s.w;
  const anchorBottom = s.y + s.h;
  const maxW = handle === "se" || handle === "ne" ? 100 - s.x : anchorRight;
  const maxH = handle === "se" || handle === "sw" ? 100 - s.y : anchorBottom;

  let w, h;

  if (ratio) {
    // Follow whichever axis the pointer moved further along, so the corner
    // tracks the cursor instead of fighting it.
    const wProp = s.w + signX * dxPct;
    const wFromH = widthPctForRatio(s.h + signY * dyPct, ratio);
    w = Math.abs(wProp - s.w) >= Math.abs(wFromH - s.w) ? wProp : wFromH;
    w = Math.max(w, MIN_CROP);
    h = heightPctForRatio(w, ratio);
    // Shrink both axes together so the locked ratio survives clamping.
    const scale = Math.min(1, maxW / w, maxH / h);
    w *= scale;
    h *= scale;
  } else {
    w = clamp(s.w + signX * dxPct, MIN_CROP, maxW);
    h = clamp(s.h + signY * dyPct, MIN_CROP, maxH);
  }

  c.w = w;
  c.h = h;
  c.x = handle === "se" || handle === "ne" ? s.x : anchorRight - w;
  c.y = handle === "se" || handle === "sw" ? s.y : anchorBottom - h;
}

// Re-fit the whole crop box to a ratio, keeping it centred on where it is.
function applyAspectToCrop(ratio) {
  const c = state.crop;
  if (!ratio) return;
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;

  let w = c.w;
  let h = heightPctForRatio(w, ratio);
  if (h > 100) {
    h = 100;
    w = widthPctForRatio(h, ratio);
  }
  if (w > 100) {
    w = 100;
    h = heightPctForRatio(w, ratio);
  }

  c.w = w;
  c.h = h;
  c.x = clamp(cx - w / 2, 0, 100 - w);
  c.y = clamp(cy - h / 2, 0, 100 - h);
}

/* ---------- Crop overlay interaction ---------- */

el.aspectSelect.addEventListener("change", () => {
  state.aspect = el.aspectSelect.value;
  const ratio = parseAspect(state.aspect);
  if (ratio) {
    applyAspectToCrop(ratio);
    // Jump into crop mode so the change is visible right away.
    if (!state.cropMode) setCropMode(true);
  }
  syncCropRect();
});

function setCropMode(on) {
  state.cropMode = on;
  el.cropToggleBtn.classList.toggle("active", on);
  el.cropOverlay.classList.toggle("hidden", !on);
  el.selectionBox.classList.add("hidden");
  syncFrame();
}

el.cropToggleBtn.addEventListener("click", () => setCropMode(!state.cropMode));

el.cropRectEl.addEventListener("pointerdown", (e) => {
  if (e.target !== el.cropRectEl) return;
  dragState = {
    mode: "crop-move",
    startX: e.clientX,
    startY: e.clientY,
    startCrop: { ...state.crop },
  };
});

el.cropRectEl.querySelectorAll(".handle").forEach((handle) => {
  handle.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    dragState = {
      mode: "crop-resize",
      handle: handle.dataset.handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...state.crop },
      startRatio: cropPixelRatio(state.crop),
    };
  });
});

/* ---------- Timeline interaction ---------- */

function pxToTime(clientX) {
  const rect = el.timeline.getBoundingClientRect();
  const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
  return pct * state.duration;
}

function handleTrimDrag(e) {
  const t = pxToTime(e.clientX);
  if (dragState.mode === "trimIn") {
    state.trimIn = clamp(t, 0, state.trimOut - 0.1);
    if (state.playheadTime < state.trimIn) {
      state.playheadTime = state.trimIn;
      seekAll(state.playheadTime);
    }
  } else {
    state.trimOut = clamp(t, state.trimIn + 0.1, state.duration);
    state.trimOutIsMax = state.trimOut >= state.duration - 0.05;
    if (state.playheadTime > state.trimOut) {
      state.playheadTime = state.trimOut;
      seekAll(state.playheadTime);
    }
  }
  layoutTimeline();
}

function handleScrubDrag(e) {
  const t = clamp(pxToTime(e.clientX), state.trimIn, state.trimOut);
  state.playheadTime = t;
  seekAll(t);
}

el.trimInHandle.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  if (state.playing) pause();
  dragState = { mode: "trimIn" };
});

el.trimOutHandle.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  if (state.playing) pause();
  dragState = { mode: "trimOut" };
});

el.timeline.addEventListener("pointerdown", (e) => {
  if (e.target === el.trimInHandle || e.target === el.trimOutHandle) return;
  if (state.playing) pause();
  dragState = { mode: "scrub" };
  handleScrubDrag(e);
});

/* ---------- Transport controls ---------- */

el.playBtn.addEventListener("click", () => {
  if (state.playing) pause();
  else play();
});

function setLayerSpeed(layer, v) {
  layer.speed = parseFloat(v) || 1;
  if (layer.el) layer.el.playbackRate = layer.speed;
  // Footprint on the timeline changed, so the project duration follows.
  recomputeDuration();
  renderProperties();
  draw(state.playing ? getCompTime() : state.playheadTime);
}

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.code === "Space") {
    e.preventDefault();
    if (state.playing) pause();
    else play();
  }
});

/* ---------- File import (picker + drag & drop) ---------- */

el.fileInput.addEventListener("change", () => {
  Array.from(el.fileInput.files).forEach(addFileLayer);
  el.fileInput.value = "";
});

el.addTextBtn.addEventListener("click", addTextLayer);

["dragenter", "dragover"].forEach((evt) =>
  el.stage.addEventListener(evt, (e) => {
    e.preventDefault();
    el.stage.classList.add("dragging");
  })
);
["dragleave", "drop"].forEach((evt) =>
  el.stage.addEventListener(evt, (e) => {
    e.preventDefault();
    el.stage.classList.remove("dragging");
  })
);
el.stage.addEventListener("drop", (e) => {
  const files = Array.from(e.dataTransfer.files || []);
  files.forEach(addFileLayer);
});

// Paste media straight from the clipboard (screenshots, copied video files…)
document.addEventListener("paste", (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;

  const data = e.clipboardData;
  if (!data) return;

  const files = [];
  if (data.files && data.files.length) {
    files.push(...Array.from(data.files));
  } else if (data.items) {
    Array.from(data.items).forEach((item) => {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    });
  }

  const media = files.filter((f) => /^(video|audio|image)\//.test(f.type));
  if (!media.length) return;

  e.preventDefault();
  media.forEach(addFileLayer);
  toast("Pasted " + media.length + (media.length === 1 ? " file" : " files"));
});

/* ---------- Export ---------- */

/* ---------- Export formats ----------
   Which of these exist depends on the browser, so the menu is built from
   whatever MediaRecorder actually reports as supported. */

const VIDEO_FORMATS = [
  { label: "MP4 (H.264)", mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
  { label: "MP4 (H.264)", mime: "video/mp4", ext: "mp4" },
  { label: "WebM (VP9)", mime: "video/webm;codecs=vp9,opus", ext: "webm" },
  { label: "WebM (VP8)", mime: "video/webm;codecs=vp8,opus", ext: "webm" },
  { label: "WebM", mime: "video/webm", ext: "webm" },
];

const AUDIO_FORMATS = [
  { label: "MP4 audio (AAC)", mime: "audio/mp4", ext: "m4a" },
  { label: "Opus audio", mime: "audio/webm;codecs=opus", ext: "webm" },
  { label: "WebM audio", mime: "audio/webm", ext: "webm" },
];

function supportedFormats(onlyAudio) {
  const list = onlyAudio ? AUDIO_FORMATS : VIDEO_FORMATS;
  const seen = new Set();
  const out = [];
  list.forEach((f) => {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported(f.mime)) return;
    if (seen.has(f.label)) return; // keep the most specific variant only
    seen.add(f.label);
    out.push(f);
  });
  return out;
}

// Rebuild the menu whenever the project switches between A/V and audio-only.
function refreshFormatOptions() {
  const onlyAudio = layers.length > 0 && layers.every((l) => l.type === "audio");
  const formats = supportedFormats(onlyAudio);
  const previous = el.formatSelect.value;

  el.formatSelect.innerHTML = "";
  if (formats.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No format available";
    el.formatSelect.appendChild(opt);
    el.formatSelect.disabled = true;
    return;
  }
  el.formatSelect.disabled = false;
  formats.forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.mime;
    opt.textContent = f.label;
    el.formatSelect.appendChild(opt);
  });
  if (formats.some((f) => f.mime === previous)) el.formatSelect.value = previous;
}

function chosenFormat(onlyAudio) {
  const all = [...VIDEO_FORMATS, ...AUDIO_FORMATS];
  const picked = all.find((f) => f.mime === el.formatSelect.value);
  if (picked) return picked;
  return supportedFormats(onlyAudio)[0] || { mime: "", ext: "webm" };
}

function updateExportProgress(t) {
  const span = state.trimOut - state.trimIn;
  const done = clamp(t - state.trimIn, 0, span);
  const pct = span > 0 ? (done / span) * 100 : 100;
  el.exportBarFill.style.width = pct + "%";
  const wallDone = done;
  const wallTotal = span;
  el.exportSub.textContent = formatTime(wallDone) + " / " + formatTime(wallTotal) + " recorded";
}

function startExport() {
  if (layers.length === 0) {
    toast("Add some media first");
    return;
  }
  if (!window.MediaRecorder) {
    toast("This browser doesn't support recording. Try Chrome or Edge.");
    return;
  }
  if (state.playing) pause();

  const onlyAudio = layers.every((l) => l.type === "audio");
  const format = chosenFormat(onlyAudio);
  const mimeType = format.mime;

  const ac = getAudioCtx();
  if (ac.state === "suspended") ac.resume();
  const exportDest = ac.createMediaStreamDestination();
  const tappedGains = [];
  layers.forEach((l) => {
    if (l._gain && !l.muted) {
      l._gain.connect(exportDest);
      tappedGains.push(l._gain);
    }
  });

  let stream;
  let exportCanvas = null;
  let exportCtx = null;
  let cropPx = null;

  if (!onlyAudio) {
    const cw = el.canvas.width;
    const ch = el.canvas.height;
    let pw = Math.round(((state.crop.w / 100) * cw) / 2) * 2;
    let ph = Math.round(((state.crop.h / 100) * ch) / 2) * 2;
    pw = Math.max(pw, 2);
    ph = Math.max(ph, 2);
    cropPx = {
      px: (state.crop.x / 100) * cw,
      py: (state.crop.y / 100) * ch,
      pw,
      ph,
    };
    exportCanvas = document.createElement("canvas");
    exportCanvas.width = pw;
    exportCanvas.height = ph;
    exportCtx = exportCanvas.getContext("2d");

    const canvasStream = exportCanvas.captureStream(30);
    const videoTrack = canvasStream.getVideoTracks()[0];
    stream = new MediaStream([videoTrack, ...exportDest.stream.getAudioTracks()]);
  } else {
    stream = exportDest.stream;
  }

  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : {}
  );
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) chunks.push(e.data);
  };

  let cancelled = false;

  recorder.onstop = () => {
    tappedGains.forEach((g) => {
      try {
        g.disconnect(exportDest);
      } catch (e) {}
    });
    state.exporting = false;
    state._exportCanvas = null;
    state._exportCtx = null;
    el.exportOverlay.classList.add("hidden");

    if (cancelled || chunks.length === 0) return;

    const blob = new Blob(chunks, { type: mimeType || (onlyAudio ? "audio/webm" : "video/webm") });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ext = format.ext;
    const base = (el.filenameInput.value || "my-edit").trim() || "my-edit";
    a.href = url;
    a.download = base + "." + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast("Exported " + a.download);
  };

  state.exporting = true;
  state._exportCanvas = exportCanvas;
  state._exportCtx = exportCtx;
  state._exportCrop = cropPx;
  state._recorder = recorder;

  el.exportTitle.textContent = "Rendering…";
  el.exportBarFill.style.width = "0%";
  el.exportOverlay.classList.remove("hidden");

  el.exportCancelBtn.onclick = () => {
    cancelled = true;
    try {
      recorder.stop();
    } catch (e) {}
    state.playing = false;
    layers.forEach((l) => l.el && l.el.pause());
    if (state._raf) cancelAnimationFrame(state._raf);
  };

  state.playheadTime = state.trimIn;
  seekAll(state.trimIn);
  recorder.start(200);
  play();
}

function finishExport() {
  if (state._recorder && state._recorder.state !== "inactive") {
    state._recorder.stop();
  }
}

el.exportBtn.addEventListener("click", startExport);

/* ---------- Init ---------- */

function init() {
  initTheme();
  setIcon(el.playBtn, "play");
  el.canvas.width = 1280;
  el.canvas.height = 720;
  renderLayerList();
  renderProperties();
  refreshFormatOptions();
  recomputeDuration();
  requestAnimationFrame(() => {
    syncFrame();
    draw(0);
  });
}

init();
