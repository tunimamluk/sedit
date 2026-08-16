import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "../lib/time.js";

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
      if (drag && drag.kind === "clip") {
        const r = barRef.current.getBoundingClientRect();
        const delta = ((e.clientX - drag.startX) / r.width) * duration;
        onMoveTrack(drag.id, Math.max(0, drag.startOffset + delta));
        return;
      }
      const t = timeAt(e.clientX);
      if (drag === "in") {
        onTrim({ trimIn: clamp(t, 0, trimOut - 0.1) });
      } else if (drag === "out") {
        onTrim({ trimOut: clamp(t, trimIn + 0.1, duration) });
      } else {
        onScrub(clamp(t, trimIn, trimOut));
      }
    };
    const onUp = () => setDrag(null);

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [drag, timeAt, onTrim, onScrub, onMoveTrack, trimIn, trimOut, duration]);

  const pct = (t) => (t / duration) * 100;

  return (
    <div className="timeline-wrap">
      <div
        ref={barRef}
        className="timeline"
        onPointerDown={(e) => {
          if (e.target.dataset.handle) return;
          setDrag("scrub");
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
            e.stopPropagation();
            setDrag("in");
          }}
        />
        <div
          className="trim-handle trim-handle-out"
          data-handle="out"
          style={{ left: `calc(${pct(trimOut)}% - 3px)` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDrag("out");
          }}
        />
        {/* driven by the live composition time, not committed state, or the
            marker would freeze where playback started */}
        <div className="playhead" style={{ left: pct(time) + "%" }} />
      </div>

      {/* Audio gets its own lane: it has a position in time but nothing on
          the canvas, so it does not belong in the visual stack. */}
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
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelectTrack(t.id);
                  setDrag({ kind: "clip", id: t.id, startX: e.clientX, startOffset: t.offset });
                }}
                title={t.name}
              >
                <span className="audio-clip-name">{t.name}</span>
              </div>
            </div>
          ))}
          <div className="playhead audio-playhead" style={{ left: pct(time) + "%" }} />
        </div>
      )}
    </div>
  );
}
