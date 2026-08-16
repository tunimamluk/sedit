import { isLayerActive } from "./time.js";

function wrapText(c, text, x, y, maxWidth, lineHeight) {
  const words = String(text).split(/\s+/);
  let line = "";
  let cy = y;
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (c.measureText(test).width > maxWidth && line) {
      c.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) c.fillText(line, x, cy);
}

/** Paint the whole composition at composition time `t`.
    `media` maps layer id -> HTMLVideoElement / HTMLAudioElement / HTMLImageElement. */
export function drawComposition(canvas, layers, media, t) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  for (const l of layers) {
    if (!l.visible) continue;
    if (!isLayerActive(l, t)) continue;

    ctx.save();
    ctx.globalAlpha = l.opacity != null ? l.opacity : 1;
    if (l.brightness != null && l.brightness !== 1) {
      ctx.filter = "brightness(" + l.brightness + ")";
    }

    const px = (l.x / 100) * w;
    const py = (l.y / 100) * h;
    const pw = (l.w / 100) * w;
    const ph = (l.h / 100) * h;
    const el = media[l.id];

    if (l.type === "video") {
      // readyState can dip right after a seek; drawing anyway would clear the
      // frame to black, so hold the last good frame until the decoder catches up.
      if (el && el.readyState >= 2) {
        try {
          ctx.drawImage(el, px, py, pw, ph);
        } catch {
          /* frame not decodable yet */
        }
      }
    } else if (l.type === "image") {
      if (el && el.complete) {
        try {
          ctx.drawImage(el, px, py, pw, ph);
        } catch {
          /* not decoded yet */
        }
      }
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
  }
}
