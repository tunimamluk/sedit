import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "../lib/time.js";
import { Icon } from "./Icon.jsx";

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 40;

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
  const [drag, setDrag] = useState(null);

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
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button
          className="zoom-btn"
          onClick={() => onZoom(zoom * 1.5)}
          disabled={zoom >= ZOOM_MAX - 0.1}
          title="Zoom in"
        >
          <Icon name="zoomIn" size={14} />
        </button>
        {Math.abs(zoom - 1) > 0.001 && (
          <button className="zoom-btn zoom-fit" onClick={() => onZoom(1)} title="Fit to width">
            Fit
          </button>
        )}
      </div>

      <div className="timeline-scroll">
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
