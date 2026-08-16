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

/** How much room the layer takes on the timeline, in seconds. */
export function layerLen(l) {
  if (l.type === "image" || l.type === "text") return l.len;
  return (l.duration || 0) / layerSpeed(l);
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
  const source = (t - l.offset) * layerSpeed(l);
  const dur = l.duration || layerLen(l);
  return clamp(source, 0, Math.max(0, dur - 0.04));
}

export function projectDuration(layers) {
  let max = 0;
  for (const l of layers) max = Math.max(max, l.offset + layerLen(l));
  return Math.max(max, 1);
}

export function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m + ":" + s.toFixed(1).padStart(4, "0");
}

/** Covers the entire output frame (i.e. the base layer). */
export function isFullFrame(l) {
  return l.x <= 0.5 && l.y <= 0.5 && l.w >= 99.5 && l.h >= 99.5;
}
