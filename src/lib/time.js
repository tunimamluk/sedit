/* Timing model.

   The composition clock runs at real time. Each layer maps its own source
   time onto it via its `speed`, which is what makes speed a per-layer
   property: a 10s clip at 2x occupies 5s of timeline. */

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function layerSpeed(l) {
  return l.speed && l.speed > 0 ? l.speed : 1;
}

/* A clip can be trimmed to a window of its source: [clipStart, clipEnd] in
   source seconds. Speed then scales that window onto the timeline, so the two
   compose rather than fight -- trimming picks *which* audio you hear, speed
   decides how long it takes to play. */

export function clipStart(l) {
  return l.clipStart || 0;
}

export function clipEnd(l) {
  return l.clipEnd != null ? l.clipEnd : l.duration || 0;
}

/** Length of the chosen source window, before speed. */
export function sourceLen(l) {
  return Math.max(0, clipEnd(l) - clipStart(l));
}

/** How much room the layer takes on the timeline, in seconds. */
export function layerLen(l) {
  if (l.type === "image" || l.type === "text") return l.len;
  return sourceLen(l) / layerSpeed(l);
}

/* A layer is active through its final frame *inclusive*. Playback stops
   exactly on trimOut, so an exclusive end blanks the frame the moment you
   pause at the end -- which reads as "the video went black". */
const END_EPS = 0.001;

export function isLayerActive(l, t) {
  const local = t - l.offset;
  return local >= -END_EPS && local <= layerLen(l) + END_EPS;
}

/** Where to park a media element's currentTime for composition time `t`.
    Scaled by the layer's speed, and clamped just inside the media so seeking
    to the very end doesn't land in the browser's "ended" state (also black). */
export function layerLocalTime(l, t) {
  const from = clipStart(l);
  const source = from + (t - l.offset) * layerSpeed(l);
  const end = clipEnd(l) || layerLen(l);
  return clamp(source, from, Math.max(from, end - 0.04));
}

export function projectDuration(layers) {
  let max = 0;
  for (const l of layers) max = Math.max(max, l.offset + layerLen(l));
  return Math.max(max, 1);
}

/** Hundredths always; larger units only when they are actually non-zero.
    12.4s -> "12.40",  65.4s -> "1:05.40",  3665.4s -> "1:01:05.40" */
export function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = s.toFixed(2).padStart(5, "0");
  if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + ss;
  if (m > 0) return m + ":" + ss;
  return s.toFixed(2);
}

/** Covers the entire output frame (i.e. the base layer). */
export function isFullFrame(l) {
  return l.x <= 0.5 && l.y <= 0.5 && l.w >= 99.5 && l.h >= 99.5;
}
