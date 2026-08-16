import { clamp } from "./time.js";

/* Crop geometry.

   crop.{x,y,w,h} are percentages of the canvas. An aspect ratio is about
   *pixels*, so converting between the two has to fold in the canvas shape. */

export const MIN_CROP = 5;

export function parseAspect(str) {
  if (!str || str === "free") return null;
  const [a, b] = str.split(":").map(Number);
  if (!a || !b) return null;
  return a / b;
}

/** Height % that pairs with a given width % to hit `ratio` in real pixels. */
export function heightPctForRatio(wPct, ratio, cw, ch) {
  return (wPct * cw) / (ch * ratio);
}

export function widthPctForRatio(hPct, ratio, cw, ch) {
  return (hPct * ch * ratio) / cw;
}

export function cropPixelRatio(c, cw, ch) {
  const wPx = (c.w / 100) * cw;
  const hPx = (c.h / 100) * ch;
  return hPx > 0 ? wPx / hPx : 1;
}

/** Resize from a corner handle. `ratio` null means free-form. Returns a new
    crop rect; the corner opposite the dragged handle stays anchored. */
export function resizeCrop(handle, s, dxPct, dyPct, ratio, cw, ch) {
  const signX = handle === "se" || handle === "ne" ? 1 : -1;
  const signY = handle === "se" || handle === "sw" ? 1 : -1;

  const anchorRight = s.x + s.w;
  const anchorBottom = s.y + s.h;
  const maxW = handle === "se" || handle === "ne" ? 100 - s.x : anchorRight;
  const maxH = handle === "se" || handle === "sw" ? 100 - s.y : anchorBottom;

  let w, h;

  if (ratio) {
    // Follow whichever axis the pointer moved further along, so the corner
    // tracks the cursor instead of fighting it.
    const wProp = s.w + signX * dxPct;
    const wFromH = widthPctForRatio(s.h + signY * dyPct, ratio, cw, ch);
    w = Math.abs(wProp - s.w) >= Math.abs(wFromH - s.w) ? wProp : wFromH;
    w = Math.max(w, MIN_CROP);
    h = heightPctForRatio(w, ratio, cw, ch);
    // Shrink both axes together so the locked ratio survives clamping.
    const scale = Math.min(1, maxW / w, maxH / h);
    w *= scale;
    h *= scale;
  } else {
    w = clamp(s.w + signX * dxPct, MIN_CROP, maxW);
    h = clamp(s.h + signY * dyPct, MIN_CROP, maxH);
  }

  return {
    w,
    h,
    x: handle === "se" || handle === "ne" ? s.x : anchorRight - w,
    y: handle === "se" || handle === "sw" ? s.y : anchorBottom - h,
  };
}

/** Re-fit a whole crop box to a ratio, keeping it centred where it is. */
export function applyAspectToCrop(c, ratio, cw, ch) {
  if (!ratio) return c;
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;

  let w = c.w;
  let h = heightPctForRatio(w, ratio, cw, ch);
  if (h > 100) {
    h = 100;
    w = widthPctForRatio(h, ratio, cw, ch);
  }
  if (w > 100) {
    w = 100;
    h = heightPctForRatio(w, ratio, cw, ch);
  }

  return {
    w,
    h,
    x: clamp(cx - w / 2, 0, 100 - w),
    y: clamp(cy - h / 2, 0, 100 - h),
  };
}

/* ---- snapping ----

   Dragging something to dead centre by hand is fiddly: you land a fraction of
   a percent off and the title looks wrong in a way that is hard to see but
   easy to feel. So a drag pulls to the frame's centre line and to its edges
   once it is within a few pixels, and a guide is drawn to say which. */

/** Where a rect of `size` sits when its start / centre / end is aligned to
    the corresponding part of the frame, and the guide line that shows it. */
const SNAP_TARGETS = [
  { align: 0, guide: 0 },
  { align: 0.5, guide: 50 },
  { align: 1, guide: 100 },
];

/** The nearest alignment within `tol`, or null. All values are composition
    percentages; `tol` is a percentage too, so callers convert from pixels and
    the pull feels the same however big the preview is. */
export function snapAxis(pos, size, tol) {
  let best = null;
  for (const t of SNAP_TARGETS) {
    const want = t.align * (100 - size);
    const d = Math.abs(pos - want);
    if (d <= tol && (!best || d < best.d)) best = { d, pos: want, guide: t.guide };
  }
  return best;
}

/** Snap both axes of a rect. Returns the position to use plus the guides to
    draw (percentages, or null where that axis did not snap). */
export function snapRect(x, y, w, h, tolX, tolY) {
  const sx = snapAxis(x, w, tolX);
  const sy = snapAxis(y, h, tolY);
  return {
    x: sx ? sx.pos : x,
    y: sy ? sy.pos : y,
    guideX: sx ? sx.guide : null,
    guideY: sy ? sy.guide : null,
  };
}
