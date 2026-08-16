import { isLayerActive } from "./time.js";
import { fontString } from "./text.js";

/** True when every video that should be on screen at `t` can actually be
    drawn. If it isn't, repainting would clear the canvas to black and then
    skip the video, which shows up as a flash while a seek completes. Callers
    should hold the previous frame instead. */
export function canComposite(layers, media, t) {
  for (const l of layers) {
    if (!l.visible || l.type !== "video") continue;
    if (!isLayerActive(l, t)) continue;
    const el = media[l.id];
    if (!el || el.readyState < 2) return false;
  }
  return true;
}

/* A layer's `srcCrop` selects a sub-rectangle of its *source* media, as
   percentages. Cropping a layer therefore cuts pixels away rather than
   scaling them, which is what makes it a crop and not a resize. */
function drawSource(ctx, el, l, px, py, pw, ph) {
  const S = l.srcCrop;
  const srcW = el.videoWidth || el.naturalWidth || 0;
  const srcH = el.videoHeight || el.naturalHeight || 0;
  const cropped =
    S && srcW && srcH && (S.w < 99.99 || S.h < 99.99 || S.x > 0.01 || S.y > 0.01);

  try {
    if (cropped) {
      ctx.drawImage(
        el,
        (S.x / 100) * srcW,
        (S.y / 100) * srcH,
        (S.w / 100) * srcW,
        (S.h / 100) * srcH,
        px, py, pw, ph
      );
    } else {
      ctx.drawImage(el, px, py, pw, ph);
    }
  } catch {
    /* frame not decodable yet */
  }
}

/** Break `text` to `maxWidth`, honouring the line breaks the person typed --
    a plain split on whitespace silently throws their paragraphs away. */
function layoutText(c, text, maxWidth) {
  const lines = [];
  for (const para of String(text).split("\n")) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? line + " " + word : word;
      if (c.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/* Canvas has no underline, so it is drawn: a rule under the ink, positioned
   and sized from the metrics rather than guessed. */
function drawTextBlock(c, l, px, py, pw, fs) {
  const align = l.align || "left";
  const anchor = align === "center" ? px + pw / 2 : align === "right" ? px + pw : px;
  const lineHeight = fs * 1.25;

  c.textAlign = align;
  c.textBaseline = "top";

  const lines = layoutText(c, l.text || "", pw);
  lines.forEach((line, i) => {
    const y = py + i * lineHeight;
    c.fillText(line, anchor, y);
    if (!l.underline || !line) return;
    const w = c.measureText(line).width;
    const x0 = align === "center" ? anchor - w / 2 : align === "right" ? anchor - w : anchor;
    // shadows belong to the glyphs, not to the rule
    const shadow = c.shadowBlur;
    c.shadowBlur = 0;
    c.fillRect(x0, y + fs * 1.06, w, Math.max(1, fs * 0.06));
    c.shadowBlur = shadow;
  });
}

/** Paint the whole composition at composition time `t`.

    `media` maps layer id -> HTMLVideoElement / HTMLAudioElement / HTMLImageElement.

    `frame` describes the composition space that layer percentages refer to,
    and how much of it to show: {w, h, offsetX, offsetY}. An applied crop makes
    the canvas smaller than the composition and shifts the origin, so the
    preview shows exactly what will be exported. */
export function drawComposition(canvas, layers, media, t, frame) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  const fw = frame ? frame.w : w;
  const fh = frame ? frame.h : h;
  const ox = frame ? frame.offsetX || 0 : 0;
  const oy = frame ? frame.offsetY || 0 : 0;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  for (const l of layers) {
    if (!l.visible) continue;
    if (!isLayerActive(l, t)) continue;

    ctx.save();
    ctx.globalAlpha = l.opacity != null ? l.opacity : 1;

    // layer rects are percentages of the composition frame, shifted into
    // canvas space by the crop origin
    const px = (l.x / 100) * fw - ox;
    const py = (l.y / 100) * fh - oy;
    const pw = (l.w / 100) * fw;
    const ph = (l.h / 100) * fh;
    const el = media[l.id];

    if (l.type === "video") {
      // readyState can dip right after a seek; drawing anyway would clear the
      // frame to black, so hold the last good frame until the decoder catches up.
      if (el && el.readyState >= 2) {
        drawSource(ctx, el, l, px, py, pw, ph);
      }
    } else if (l.type === "image") {
      if (el && el.complete) {
        drawSource(ctx, el, l, px, py, pw, ph);
      }
    } else if (l.type === "text") {
      const fs = (l.fontSize / 100) * fh;
      ctx.fillStyle = l.color || "#ffffff";
      ctx.font = fontString(l, fs);
      if (l.shadow !== false) {
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = fs * 0.15;
      }
      drawTextBlock(ctx, l, px, py, pw, fs);
    }

    ctx.restore();
  }
}
