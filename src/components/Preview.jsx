import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { clamp, isFullFrame, isLayerActive } from "../lib/time.js";
import { cropPixelRatio, parseAspect, resizeCrop } from "../lib/geometry.js";

const HANDLES = ["nw", "ne", "sw", "se"];

export function Preview({
  canvasRef,
  layers,
  selectedId,
  onSelect,
  onLayerRect,
  cropMode,
  crop,
  onCrop,
  aspect,
  canvasSize,
  time,
  onDropFiles,
}) {
  const stageRef = useRef(null);
  const [frame, setFrame] = useState(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  /* The overlays are absolutely positioned DOM on top of a canvas whose
     displayed size is driven by CSS object-fit rules, so we measure it
     rather than assume. */
  const measure = useCallback(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const s = stage.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    setFrame({ left: c.left - s.left, top: c.top - s.top, width: c.width, height: c.height, pageLeft: c.left, pageTop: c.top });
  }, [canvasRef]);

  useLayoutEffect(measure, [measure, canvasSize, layers.length]);

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

  /* ---- dragging ---- */

  const onPointerDownStage = (e) => {
    if (cropMode || !frame) return;
    const px = ((e.clientX - frame.pageLeft) / frame.width) * 100;
    const py = ((e.clientY - frame.pageTop) / frame.height) * 100;

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
      dragRef.current = {
        mode: "move",
        id: hit.id,
        startX: e.clientX,
        startY: e.clientY,
        start: { x: hit.x, y: hit.y, w: hit.w, h: hit.h },
      };
      setDragging(true);
    } else {
      onSelect(null);
    }
  };

  const beginLayerResize = (e, handle) => {
    e.stopPropagation();
    if (!selected) return;
    dragRef.current = {
      mode: "resize",
      id: selected.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      start: { x: selected.x, y: selected.y, w: selected.w, h: selected.h },
    };
    setDragging(true);
  };

  const beginCropMove = (e) => {
    if (e.target !== e.currentTarget) return;
    dragRef.current = { mode: "crop-move", startX: e.clientX, startY: e.clientY, start: { ...crop } };
    setDragging(true);
  };

  const beginCropResize = (e, handle) => {
    e.stopPropagation();
    dragRef.current = {
      mode: "crop-resize",
      handle,
      startX: e.clientX,
      startY: e.clientY,
      start: { ...crop },
      startRatio: cropPixelRatio(crop, canvasSize.w, canvasSize.h),
    };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e) => {
      const d = dragRef.current;
      if (!d || !frame) return;
      const dx = ((e.clientX - d.startX) / frame.width) * 100;
      const dy = ((e.clientY - d.startY) / frame.height) * 100;

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
        onCrop({
          ...crop,
          x: clamp(s.x + dx, 0, 100 - s.w),
          y: clamp(s.y + dy, 0, 100 - s.h),
        });
      } else if (d.mode === "crop-resize") {
        // Shift keeps whatever ratio the box had when the drag began; the
        // dropdown locks it to a fixed one for the whole drag.
        const locked = parseAspect(aspect);
        const ratio = locked || (e.shiftKey ? d.startRatio : null);
        onCrop(resizeCrop(d.handle, d.start, dx, dy, ratio, canvasSize.w, canvasSize.h));
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [dragging, frame, crop, aspect, canvasSize, onLayerRect, onCrop]);

  /* ---- drag & drop ---- */

  const [dropActive, setDropActive] = useState(false);

  const frameStyle = frame
    ? { left: frame.left, top: frame.top, width: frame.width, height: frame.height }
    : { display: "none" };

  const pct = (v, axis) => (frame ? (v / 100) * (axis === "x" ? frame.width : frame.height) : 0);

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
            left: frame.left + pct(selected.x, "x"),
            top: frame.top + pct(selected.y, "y"),
            width: pct(selected.w, "x"),
            height: pct(selected.h, "y"),
          }}
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget) return;
            dragRef.current = {
              mode: "move",
              id: selected.id,
              startX: e.clientX,
              startY: e.clientY,
              start: { x: selected.x, y: selected.y, w: selected.w, h: selected.h },
            };
            setDragging(true);
          }}
        >
          {HANDLES.map((h) => (
            <div
              key={h}
              className={"handle handle-" + h}
              data-handle={h}
              onPointerDown={(e) => beginLayerResize(e, h)}
            />
          ))}
        </div>
      )}

      {cropMode && frame && (
        <div className="crop-overlay" style={frameStyle}>
          <div
            className="crop-mask"
            style={{ left: 0, top: 0, width: "100%", height: pct(crop.y, "y") }}
          />
          <div
            className="crop-mask"
            style={{
              left: 0,
              top: pct(crop.y + crop.h, "y"),
              width: "100%",
              height: frame.height - pct(crop.y + crop.h, "y"),
            }}
          />
          <div
            className="crop-mask"
            style={{
              left: 0,
              top: pct(crop.y, "y"),
              width: pct(crop.x, "x"),
              height: pct(crop.h, "y"),
            }}
          />
          <div
            className="crop-mask"
            style={{
              left: pct(crop.x + crop.w, "x"),
              top: pct(crop.y, "y"),
              width: frame.width - pct(crop.x + crop.w, "x"),
              height: pct(crop.h, "y"),
            }}
          />

          <div
            className="crop-rect"
            style={{
              left: pct(crop.x, "x"),
              top: pct(crop.y, "y"),
              width: pct(crop.w, "x"),
              height: pct(crop.h, "y"),
            }}
            onPointerDown={beginCropMove}
          >
            <div className="crop-size-badge">
              {Math.round((crop.w / 100) * canvasSize.w)} x{" "}
              {Math.round((crop.h / 100) * canvasSize.h)} px
            </div>
            {HANDLES.map((h) => (
              <div
                key={h}
                className={"handle handle-" + h}
                data-handle={h}
                onPointerDown={(e) => beginCropResize(e, h)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
