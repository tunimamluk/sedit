import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "../lib/time.js";

export function Timeline({ duration, trimIn, trimOut, onTrim, time, onScrub }) {
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
  }, [drag, timeAt, onTrim, onScrub, trimIn, trimOut, duration]);

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
    </div>
  );
}
