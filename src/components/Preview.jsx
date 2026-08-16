import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { clamp, isFullFrame, isLayerActive } from "../lib/time.js";
import { cropPixelRatio, parseAspect, resizeCrop } from "../lib/geometry.js";

const HANDLES = ["nw", "ne", "sw", "se"];
const FULL_VIEW = { x: 0, y: 0, w: 100, h: 100 };

/* Magnetic snapping, the way slide and 3D tools do it: the rect pulls to the
   frame edges, the centre lines and the thirds when it comes close, and the
   guide it caught is drawn so you can see why it stopped there. */
const SNAP_PX = 7;
const TARGETS = [0, 100 / 3, 50, 200 / 3, 100];

function snapAxis(lead, size, threshold, opts) {
  // try the leading edge, the trailing edge, then the centre
  const candidates = [
    { at: lead, place: (v) => v },
    { at: lead + size, place: (v) => v - size },
    { at: lead + size / 2, place: (v) => v - size / 2 },
  ];
  let best = null;
  for (const c of candidates) {
    if (opts && opts.only && !opts.only.includes(candidates.indexOf(c))) continue;
    for (const target of TARGETS) {
      const d = Math.abs(c.at - target);
      if (d < threshold && (!best || d < best.d)) best = { d, target, value: c.place(target) };
    }
  }
  return best;
}

/** Returns the snapped rect plus the guides it caught, in frame percent. */
function snapRect(rect, frame, mode) {
  const tx = (SNAP_PX / frame.width) * 100;
  const ty = (SNAP_PX / frame.height) * 100;
  const guides = [];
  let { x, y, w, h } = rect;

  // when resizing, only the edge being dragged should snap
  const only =
    mode && mode.startsWith("resize")
      ? mode.includes("w")
        ? [0]
        : [1]
      : null;

  const sx = snapAxis(x, w, tx, only ? { only } : null);
  if (sx) {
    x = sx.value;
    guides.push({ axis: "v", at: sx.target });
  }
  const sy = snapAxis(y, h, ty, null);
  if (sy) {
    y = sy.value;
    guides.push({ axis: "h", at: sy.target });
  }
  return { rect: { x, y, w, h }, guides };
}

export function Preview({
  canvasRef,
  layers,
  selectedId,
  onSelect,
  onLayerRect,
  cropMode,
  draftCrop,
  onDraftCrop,
  aspect,
  frameSize,
  time,
  onDropFiles,
}) {
  const stageRef = useRef(null);
  const [frame, setFrame] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [guides, setGuides] = useState([]);
  const dragRef = useRef(null);

  /* The canvas always shows the whole composition; crops are baked into the
     layers themselves, so overlay coordinates map straight through. */
  const view = FULL_VIEW;

  const toPxX = (pct) => (frame ? ((pct - view.x) / view.w) * frame.width : 0);
  const toPxY = (pct) => (frame ? ((pct - view.y) / view.h) * frame.height : 0);
  const spanPxX = (pct) => (frame ? (pct / view.w) * frame.width : 0);
  const spanPxY = (pct) => (frame ? (pct / view.h) * frame.height : 0);
  const toPctX = (px) => view.x + (px / frame.width) * view.w;
  const toPctY = (px) => view.y + (px / frame.height) * view.h;

  const measure = useCallback(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const s = stage.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    setFrame({
      left: c.left - s.left,
      top: c.top - s.top,
      width: c.width,
      height: c.height,
      pageLeft: c.left,
      pageTop: c.top,
    });
  }, [canvasRef]);

  useLayoutEffect(measure, [measure, frameSize, cropMode, layers.length]);

  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (stageRef.current) ro.observe(stageRef.current);
    if (canvasRef.current) ro.observe(canvasRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, canvasRef]);

  const selected = layers.find((l) => l.id === selectedId);
  const showSelection =
    !cropMode && selected && selected.type !== "audio" && !isFullFrame(selected) && frame;

  /* ---- pointer interaction ---- */

  const onPointerDownStage = (e) => {
    if (cropMode || !frame) return;
    const px = toPctX(e.clientX - frame.pageLeft);
    const py = toPctY(e.clientY - frame.pageTop);

    let hit = null;
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i];
      if (l.type === "audio" || !l.visible) continue;
      // A layer filling the whole frame would otherwise catch every click and
      // make it look like the editor selects everything. Pick it from the
      // Layers panel instead.
      if (isFullFrame(l)) continue;
      if (!isLayerActive(l, time)) continue;
      if (px >= l.x && px <= l.x + l.w && py >= l.y && py <= l.y + l.h) {
        hit = l;
        break;
      }
    }

    if (hit) {
      onSelect(hit.id);
      startDrag({ mode: "move", id: hit.id, e, start: rectOf(hit) });
    } else {
      onSelect(null);
    }
  };

  const rectOf = (l) => ({ x: l.x, y: l.y, w: l.w, h: l.h });

  const startDrag = ({ mode, id, handle, e, start, startRatio }) => {
    dragRef.current = { mode, id, handle, startX: e.clientX, startY: e.clientY, start, startRatio };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e) => {
      const d = dragRef.current;
      if (!d || !frame) return;
      // pointer delta expressed in composition percent
      const dx = ((e.clientX - d.startX) / frame.width) * view.w;
      const dy = ((e.clientY - d.startY) / frame.height) * view.h;

      if (d.mode === "move") {
        const s = d.start;
        onLayerRect(d.id, {
          x: clamp(s.x + dx, 0, 100 - s.w),
          y: clamp(s.y + dy, 0, 100 - s.h),
        });
      } else if (d.mode === "resize") {
        const s = d.start;
        const min = 4;
        let r;
        if (d.handle === "se") {
          r = { x: s.x, y: s.y, w: clamp(s.w + dx, min, 100 - s.x), h: clamp(s.h + dy, min, 100 - s.y) };
        } else if (d.handle === "sw") {
          const w = clamp(s.w - dx, min, s.x + s.w);
          r = { x: s.x + s.w - w, y: s.y, w, h: clamp(s.h + dy, min, 100 - s.y) };
        } else if (d.handle === "ne") {
          const h = clamp(s.h - dy, min, s.y + s.h);
          r = { x: s.x, y: s.y + s.h - h, w: clamp(s.w + dx, min, 100 - s.x), h };
        } else {
          const w = clamp(s.w - dx, min, s.x + s.w);
          const h = clamp(s.h - dy, min, s.y + s.h);
          r = { x: s.x + s.w - w, y: s.y + s.h - h, w, h };
        }
        onLayerRect(d.id, r);
      } else if (d.mode === "crop-move") {
        const s = d.start;
        const raw = {
          x: clamp(s.x + dx, 0, 100 - s.w),
          y: clamp(s.y + dy, 0, 100 - s.h),
          w: s.w,
          h: s.h,
        };
        const snapped = e.altKey ? { rect: raw, guides: [] } : snapRect(raw, frame, "move");
        setGuides(snapped.guides);
        onDraftCrop({ ...draftCrop, ...snapped.rect });
      } else if (d.mode === "crop-resize") {
        // Shift keeps whatever ratio the box had when the drag began; the
        // picker locks it to a fixed one for the whole drag.
        const locked = parseAspect(aspect);
        const ratio = locked || (e.shiftKey ? d.startRatio : null);
        const raw = resizeCrop(d.handle, d.start, dx, dy, ratio, frameSize.w, frameSize.h);
        // a locked ratio must win over snapping, or the box would distort
        const snapped =
          e.altKey || ratio
            ? { rect: raw, guides: [] }
            : snapRect(raw, frame, "resize-" + d.handle);
        setGuides(snapped.guides);
        onDraftCrop(snapped.rect);
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
      setGuides([]);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [dragging, frame, view, draftCrop, aspect, frameSize, onLayerRect, onDraftCrop]);

  const frameStyle = frame
    ? { left: frame.left, top: frame.top, width: frame.width, height: frame.height }
    : { display: "none" };

  const c = draftCrop;
  const showCrop = cropMode && frame && c;

  return (
    <div
      ref={stageRef}
      className={"stage" + (dropActive ? " dragging" : "")}
      onDragEnter={(e) => {
        e.preventDefault();
        setDropActive(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        setDropActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDropActive(false);
        onDropFiles(Array.from(e.dataTransfer.files || []));
      }}
    >
      <canvas ref={canvasRef} id="previewCanvas" />

      {layers.length === 0 && (
        <div className="drop-hint">Drop or paste a video, audio, or image here</div>
      )}

      <div className="stage-overlay" style={frameStyle} onPointerDown={onPointerDownStage} />

      {showSelection && (
        <div
          className="selection-box"
          style={{
            left: frame.left + toPxX(selected.x),
            top: frame.top + toPxY(selected.y),
            width: spanPxX(selected.w),
            height: spanPxY(selected.h),
          }}
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget) return;
            startDrag({ mode: "move", id: selected.id, e, start: rectOf(selected) });
          }}
        >
          {HANDLES.map((h) => (
            <div
              key={h}
              className={"handle handle-" + h}
              data-handle={h}
              onPointerDown={(e) => {
                e.stopPropagation();
                startDrag({ mode: "resize", id: selected.id, handle: h, e, start: rectOf(selected) });
              }}
            />
          ))}
        </div>
      )}

      {showCrop && (
        <div className="crop-overlay" style={frameStyle}>
          <div className="crop-mask" style={{ left: 0, top: 0, width: "100%", height: toPxY(c.y) }} />
          <div
            className="crop-mask"
            style={{
              left: 0,
              top: toPxY(c.y + c.h),
              width: "100%",
              height: frame.height - toPxY(c.y + c.h),
            }}
          />
          <div
            className="crop-mask"
            style={{ left: 0, top: toPxY(c.y), width: toPxX(c.x), height: spanPxY(c.h) }}
          />
          <div
            className="crop-mask"
            style={{
              left: toPxX(c.x + c.w),
              top: toPxY(c.y),
              width: frame.width - toPxX(c.x + c.w),
              height: spanPxY(c.h),
            }}
          />

          {guides.map((g, i) => (
            <div
              key={i}
              className={"snap-guide snap-guide-" + g.axis}
              style={g.axis === "v" ? { left: (g.at / 100) * frame.width } : { top: (g.at / 100) * frame.height }}
            />
          ))}

          <div
            className="crop-rect"
            style={{
              left: toPxX(c.x),
              top: toPxY(c.y),
              width: spanPxX(c.w),
              height: spanPxY(c.h),
            }}
            onPointerDown={(e) => {
              if (e.target !== e.currentTarget) return;
              startDrag({ mode: "crop-move", e, start: { ...c } });
            }}
          >
            <div className="crop-thirds" />
            {HANDLES.map((h) => (
              <div
                key={h}
                className={"handle handle-" + h}
                data-handle={h}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  startDrag({
                    mode: "crop-resize",
                    handle: h,
                    e,
                    start: { ...c },
                    startRatio: cropPixelRatio(c, frameSize.w, frameSize.h),
                  });
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
