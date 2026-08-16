import { memo, useCallback, useEffect, useRef, useState } from "react";
import { clamp, formatTime, tickStep } from "../lib/time.js";
import { Icon } from "./Icon.jsx";

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 40;

/* Zoom is continuous. The slider is logarithmic so a given amount of travel
   changes the scale by the same *ratio* everywhere -- a linear slider would
   waste most of its length between 20x and 40x and give almost no control
   down at 30%. */
const zoomToSlider = (z) =>
  (Math.log(z / ZOOM_MIN) / Math.log(ZOOM_MAX / ZOOM_MIN)) * 100;
const sliderToZoom = (v) =>
  ZOOM_MIN * Math.pow(ZOOM_MAX / ZOOM_MIN, v / 100);

/* Clamping on every keystroke makes the field unusable: typing "150" starts
   as "1", which clamps to 20 and rewrites the box, so the rest of the digits
   land after it. While the field is focused we keep the raw text and only
   push through values that are already in range; the clamp happens on blur
   or Enter, when the person has finished. */
function ZoomField({ zoom, onZoom }) {
  const [draft, setDraft] = useState(null);
  // Escape clears the draft and blurs, but blur fires commit(), which would
  // read the pre-clear draft from its closure and commit the very value we
  // just discarded. A ref settles it synchronously.
  const cancelling = useRef(false);
  const lo = Math.round(ZOOM_MIN * 100);
  const hi = Math.round(ZOOM_MAX * 100);

  /* Typing is a discrete edit: the zoom moves on Enter or blur, not on every
     keystroke. Applying live meant "150" briefly became 1% -> clamped to 20%,
     which rewrote the box mid-entry, and it also left Escape with nothing to
     revert to. The slider and Ctrl+wheel are the live controls. */
  const commit = () => {
    const v = parseFloat(draft);
    if (!Number.isNaN(v)) onZoom(Math.min(hi, Math.max(lo, v)) / 100);
    setDraft(null);
  };

  return (
    <input
      className="zoom-input"
      type="text"
      inputMode="numeric"
      value={draft != null ? draft : String(Math.round(zoom * 100))}
      title="Type a zoom percentage, then press Enter"
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => {
        if (cancelling.current) {
          cancelling.current = false;
          setDraft(null);
          return;
        }
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          cancelling.current = true; // abandon the edit; the zoom never moved
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function formatTick(t) {
  if (t < 60) {
    const s = Math.round(t * 100) / 100;
    return Number.isInteger(s) ? String(s) : String(s).replace(/^0\./, ".");
  }
  return Math.floor(t / 60) + ":" + String(Math.round(t % 60)).padStart(2, "0");
}

/* Its own component, memo'd on scale and zoom alone: the playhead moves ~60
   times a second and the ruler can be several hundred ticks at high zoom. */
const Ruler = memo(function Ruler({ scale, zoom }) {
  const step = tickStep(scale, Math.round(10 * zoom));
  const count = Math.floor(scale / step) + 1;
  const ticks = [];
  for (let i = 0; i < count; i++) {
    const t = i * step;
    ticks.push(
      <div key={i} className="tick" style={{ left: (t / scale) * 100 + "%" }}>
        <span className="tick-label">{formatTick(t)}</span>
      </div>
    );
  }
  return <div className="ruler">{ticks}</div>;
});

/* One row per clip, on a bed that shows through. The lane deliberately has no
   fill of its own: a filled lane the full width of the ruler reads as "the
   media is this long", so trimming a clip left the original length sitting
   there behind it. */
function Lane({ kind, clips, selectedId, pct, onSelect, onDown }) {
  return (
    <div className={"lane lane-" + kind}>
      {clips.map((c) => (
        <div key={c.id} className="lane-row">
          <div
            className={
              "clip clip-" + c.kind +
              (c.id === selectedId ? " selected" : "") +
              (c.muted ? " muted" : "")
            }
            style={{ left: pct(c.offset) + "%", width: pct(c.length) + "%" }}
            title={c.name}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect(c.id);
              onDown("clip", c, e);
            }}
          >
            <span className="clip-lead">
              <Icon name={c.kind} size={12} />
              <span className="clip-name">{c.name}</span>
            </span>
            <span className="clip-len">{formatTime(c.length)}</span>
            <div
              className="clip-edge clip-edge-l"
              title="Trim the start"
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelect(c.id);
                onDown("trim-l", c, e);
              }}
            />
            <div
              className="clip-edge clip-edge-r"
              title="Trim the end"
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelect(c.id);
                onDown("trim-r", c, e);
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Timeline({
  span,
  time,
  onScrub,
  videoClips,
  audioClips,
  selectedId,
  onSelect,
  onMoveClip,
  onTrimClip,
  zoom,
  onZoom,
  disabled,
}) {
  const stackRef = useRef(null);
  const scrollRef = useRef(null);
  const [drag, setDrag] = useState(null);

  /* Everything is positioned against `scale`, never the project duration --
     the duration is derived from the clips, so scaling by it means trimming a
     clip shortens the ruler by exactly the amount trimmed and the clip never
     appears to move. A drag holds the scale it started with, so moving a clip
     past the end cannot shift the ground under the cursor mid-gesture. */
  const scale = drag && drag.span ? drag.span : span;

  /* Ctrl/Cmd + wheel zooms continuously. Registered by hand because React
     attaches wheel listeners passively, and a passive listener cannot
     preventDefault the browser's own page zoom. */
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      onZoom(zoom * Math.exp(-e.deltaY * 0.002));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, [zoom, onZoom]);

  const timeAt = useCallback(
    (clientX) => {
      const r = stackRef.current.getBoundingClientRect();
      return clamp((clientX - r.left) / r.width, 0, 1) * scale;
    },
    [scale]
  );

  useEffect(() => {
    if (!drag) return;

    const onMove = (e) => {
      /* Every clip drag resolves to an ABSOLUTE value computed from the
         snapshot taken at pointerdown. Feeding deltas back into the current
         value compounds them once per pointermove. */
      const moved = (e.clientX - drag.startX) * drag.secPerPx;

      if (drag.kind === "clip") {
        onMoveClip(drag.id, Math.max(0, drag.offset + moved));
        return;
      }
      if (drag.kind === "trim-l") {
        const MIN = 0.05;
        const next = clamp(drag.clipStart + moved, 0, drag.clipEnd - MIN);
        onTrimClip(drag.id, {
          clipStart: next,
          clipEnd: drag.clipEnd,
          // keep the part you kept sitting where it already was
          offset: Math.max(0, drag.offset + (next - drag.clipStart)),
        });
        return;
      }
      if (drag.kind === "trim-r") {
        const MIN = 0.05;
        onTrimClip(drag.id, {
          clipStart: drag.clipStart,
          clipEnd: clamp(drag.clipEnd + moved, drag.clipStart + MIN, drag.srcDuration),
          offset: drag.offset,
        });
        return;
      }

      onScrub(timeAt(e.clientX));
    };

    const onUp = () => setDrag(null);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [drag, timeAt, onScrub, onMoveClip, onTrimClip]);

  const pct = (t) => (t / scale) * 100;

  /* Snapshot of everything a clip drag needs, frozen at pointerdown. */
  const onClipDown = (kind, c, e) => {
    const r = stackRef.current.getBoundingClientRect();
    setDrag({
      kind,
      id: c.id,
      startX: e.clientX,
      span: scale,
      secPerPx: scale / r.width,
      offset: c.offset,
      clipStart: c.clipStart,
      clipEnd: c.clipEnd,
      srcDuration: c.srcDuration,
    });
  };

  /* No minWidth: that would pin the stack at full width and make zooming
     below "fit" impossible. */
  const inner = { width: zoom * 100 + "%" };

  return (
    <div className={"timeline-wrap" + (disabled ? " is-disabled" : "")}>
      <div className="timeline-toolbar" style={disabled ? { visibility: "hidden" } : undefined}>
        <button
          className="zoom-btn"
          onClick={() => onZoom(zoom / 1.5)}
          disabled={zoom <= ZOOM_MIN + 0.001}
          title="Zoom out"
        >
          <Icon name="zoomOut" size={14} />
        </button>
        <input
          className="zoom-slider"
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={zoomToSlider(zoom)}
          onChange={(e) => onZoom(sliderToZoom(parseFloat(e.target.value)))}
          title="Drag to zoom"
        />
        <ZoomField zoom={zoom} onZoom={onZoom} />
        <span className="zoom-pct">%</span>
        <button
          className="zoom-btn"
          onClick={() => onZoom(zoom * 1.5)}
          disabled={zoom >= ZOOM_MAX - 0.1}
          title="Zoom in"
        >
          <Icon name="zoomIn" size={14} />
        </button>
      </div>

      <div className="timeline-scroll" ref={scrollRef}>
        {/* One stack holding the ruler and both lanes, so the playhead is a
            single continuous line rather than one segment per lane. */}
        <div
          className="timeline-stack"
          ref={stackRef}
          style={inner}
          onPointerDown={(e) => {
            // clicking a clip selects and drags it; anywhere else scrubs
            if (disabled || e.target.closest(".clip")) return;
            setDrag({ kind: "scrub" });
            onScrub(timeAt(e.clientX));
          }}
        >
          <Ruler scale={scale} zoom={zoom} />

          {videoClips.length > 0 && (
            <Lane
              kind="video"
              clips={videoClips}
              selectedId={selectedId}
              pct={pct}
              onSelect={onSelect}
              onDown={onClipDown}
            />
          )}

          {audioClips.length > 0 && (
            <Lane
              kind="audio"
              clips={audioClips}
              selectedId={selectedId}
              pct={pct}
              onSelect={onSelect}
              onDown={onClipDown}
            />
          )}

          {/* the one and only playhead, spanning every lane */}
          <div className="playhead" style={{ left: pct(time) + "%" }} />
        </div>
      </div>
    </div>
  );
}
