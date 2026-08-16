import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "../lib/time.js";
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

export function Timeline({
  duration,
  trimIn,
  trimOut,
  onTrim,
  time,
  onScrub,
  tracks,
  selectedTrackId,
  onSelectTrack,
  onMoveTrack,
  onTrimTrack,
  zoom,
  onZoom,
  disabled,
}) {
  const barRef = useRef(null);
  const scrollRef = useRef(null);
  const [drag, setDrag] = useState(null);

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
      const r = barRef.current.getBoundingClientRect();
      return clamp((clientX - r.left) / r.width, 0, 1) * duration;
    },
    [duration]
  );

  useEffect(() => {
    if (!drag) return;

    const onMove = (e) => {
      const r = barRef.current.getBoundingClientRect();

      /* Every clip drag resolves to an ABSOLUTE value computed from the
         snapshot taken at pointerdown. Feeding deltas back into the current
         value compounds them once per pointermove, and the scale is frozen
         too: trimming changes the project duration, which would otherwise
         move the pixels-per-second mapping underneath the drag. */
      if (drag.kind === "clip") {
        const moved = (e.clientX - drag.startX) * drag.secPerPx;
        onMoveTrack(drag.id, Math.max(0, drag.offset + moved));
        return;
      }
      if (drag.kind === "trim-l" || drag.kind === "trim-r") {
        const MIN = 0.05;
        const moved = (e.clientX - drag.startX) * drag.secPerPx;

        if (drag.kind === "trim-l") {
          const next = clamp(drag.clipStart + moved, 0, drag.clipEnd - MIN);
          onTrimTrack(drag.id, {
            clipStart: next,
            // keep the audio you kept sitting where it already was
            offset: Math.max(0, drag.offset + (next - drag.clipStart)),
          });
        } else {
          onTrimTrack(drag.id, {
            clipEnd: clamp(drag.clipEnd + moved, drag.clipStart + MIN, drag.srcDuration),
          });
        }
        return;
      }

      const t = timeAt(e.clientX);
      if (drag.kind === "in") onTrim({ trimIn: clamp(t, 0, trimOut - 0.1) });
      else if (drag.kind === "out") onTrim({ trimOut: clamp(t, trimIn + 0.1, duration) });
      else onScrub(clamp(t, trimIn, trimOut));
    };

    const onUp = () => setDrag(null);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [drag, timeAt, onTrim, onScrub, onMoveTrack, onTrimTrack, trimIn, trimOut, duration]);

  const pct = (t) => (t / duration) * 100;

  /* Snapshot of everything a clip drag needs, frozen at pointerdown. */
  const clipDrag = (kind, t, e) => {
    const r = barRef.current.getBoundingClientRect();
    return {
      kind,
      id: t.id,
      startX: e.clientX,
      secPerPx: duration / r.width,
      offset: t.offset,
      clipStart: t.clipStart || 0,
      clipEnd: t.clipEnd != null ? t.clipEnd : t.duration || 0,
      srcDuration: t.duration || 0,
    };
  };
  /* No minWidth: that would pin the stack at full width and make zooming
     below "fit" impossible. Under 100% the project simply occupies part of
     the lane, leaving room to place clips past the current end. */
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
        {/* One stack holding every lane, so the playhead is a single
            continuous line instead of one segment per lane. */}
        <div className="timeline-stack" style={inner}>
          <div
            ref={barRef}
            className="timeline"
            onPointerDown={(e) => {
              if (disabled || e.target.dataset.handle) return;
              setDrag({ kind: "scrub" });
              onScrub(clamp(timeAt(e.clientX), trimIn, trimOut));
            }}
          >
            <div
              className="trim-range"
              style={{ left: pct(trimIn) + "%", width: pct(trimOut - trimIn) + "%" }}
            />
            <div
              className="trim-handle trim-handle-in"
              data-handle="in"
              style={{ left: `calc(${pct(trimIn)}% - 3px)` }}
              onPointerDown={(e) => {
                if (disabled) return;
                e.stopPropagation();
                setDrag({ kind: "in" });
              }}
            />
            <div
              className="trim-handle trim-handle-out"
              data-handle="out"
              style={{ left: `calc(${pct(trimOut)}% - 3px)` }}
              onPointerDown={(e) => {
                if (disabled) return;
                e.stopPropagation();
                setDrag({ kind: "out" });
              }}
            />
          </div>

          {tracks.length > 0 && (
            <div className="audio-lane">
              {tracks.map((t) => (
                <div key={t.id} className="audio-lane-row">
                  <div
                    className={
                      "audio-clip" +
                      (t.id === selectedTrackId ? " selected" : "") +
                      (t.muted ? " muted" : "")
                    }
                    style={{ left: pct(t.offset) + "%", width: pct(t.length) + "%" }}
                    title={t.name}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onSelectTrack(t.id);
                      setDrag(clipDrag("clip", t, e));
                    }}
                  >
                    <span className="audio-clip-name">{t.name}</span>
                    <div
                      className="clip-edge clip-edge-l"
                      title="Trim start"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onSelectTrack(t.id);
                        setDrag(clipDrag("trim-l", t, e));
                      }}
                    />
                    <div
                      className="clip-edge clip-edge-r"
                      title="Trim end"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onSelectTrack(t.id);
                        setDrag(clipDrag("trim-r", t, e));
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* the one and only playhead, spanning every lane */}
          <div className="playhead" style={{ left: pct(time) + "%" }} />
        </div>
      </div>
    </div>
  );
}
