/* Timing model.

   The composition clock runs at real time and every clip plays at its natural
   rate, so source seconds and timeline seconds are the same thing. */

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/* A clip can be trimmed to a window of its source: [clipStart, clipEnd] in
   source seconds. That window is what plays, at its natural rate -- source
   seconds and timeline seconds are the same thing. */

export function clipStart(l) {
  return l.clipStart || 0;
}

export function clipEnd(l) {
  return l.clipEnd != null ? l.clipEnd : l.duration || 0;
}

/** Length of the chosen source window. */
export function sourceLen(l) {
  return Math.max(0, clipEnd(l) - clipStart(l));
}

/** How much room the layer takes on the timeline, in seconds. */
export function layerLen(l) {
  if (l.type === "image" || l.type === "text") return l.len;
  return sourceLen(l);
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
    Clamped just inside the trimmed window so seeking to the very end doesn't
    land in the browser's "ended" state (which also renders black). */
export function layerLocalTime(l, t) {
  const from = clipStart(l);
  const source = from + (t - l.offset);
  const end = clipEnd(l) || layerLen(l);
  return clamp(source, from, Math.max(from, end - 0.04));
}

export function projectDuration(layers) {
  let max = 0;
  for (const l of layers) max = Math.max(max, l.offset + layerLen(l));
  return Math.max(max, 1);
}

/* ---- the ruler's scale ----

   The timeline must NOT be scaled by the project duration. Trimming a clip
   shortens the project by exactly the amount you trim, so a clip that is the
   longest thing in the project keeps a width of layerLen/duration = 100% no
   matter how far you drag its edge: the ruler shrinks instead of the clip
   moving, which reads as "the trim does nothing and the video timeline
   jumps". The scale has to come from something trimming cannot change. */

/** How far a clip could reach if it were not trimmed. Trimming the left edge
    moves `offset` and `clipStart` together and trimming the right edge moves
    neither, so this is invariant across both. */
export function layerSpan(l) {
  if (l.type === "image" || l.type === "text") return l.offset + (l.len || 0);
  return l.offset - clipStart(l) + (l.duration || 0);
}

const NICE_STEPS = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

/** Spacing for ruler ticks: the smallest round interval that keeps the number
    of ticks near `target`. */
const TICK_STEPS = [
  0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600,
];

export function tickStep(seconds, target) {
  const raw = seconds / Math.max(1, target);
  for (const s of TICK_STEPS) if (s >= raw) return s;
  return TICK_STEPS[TICK_STEPS.length - 1];
}

/** Width of the ruler in seconds. Rounded up to a round number, always with
    one step left over, so there is somewhere to drag a clip past the end
    without the whole timeline rescaling underneath the cursor. */
export function timelineSpan(items) {
  let max = 0;
  for (const l of items) max = Math.max(max, layerSpan(l));
  if (!(max > 0)) return 1;
  let step = NICE_STEPS[0];
  for (const s of NICE_STEPS) if (s <= max / 8) step = s;
  return (Math.floor(max / step) + 1) * step;
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
