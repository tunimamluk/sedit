import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TopBar } from "./components/TopBar.jsx";
import { LayersPanel } from "./components/LayersPanel.jsx";
import { Preview } from "./components/Preview.jsx";
import { Transport } from "./components/Transport.jsx";
import { Timeline } from "./components/Timeline.jsx";
import { Properties } from "./components/Properties.jsx";
import { useTheme } from "./hooks/useTheme.js";
import { usePlayback } from "./hooks/usePlayback.js";
import { canComposite, drawComposition } from "./lib/render.js";
import { applyAspectToCrop, parseAspect } from "./lib/geometry.js";
import { clamp, formatTime, projectDuration } from "./lib/time.js";
import { findFormat, supportedFormats } from "./lib/formats.js";
import {
  attachAudioGraph,
  createMediaStore,
  disposeMedia,
  resumeAudio,
  setGain,
} from "./lib/media.js";

const DEFAULT_SIZE = { w: 1280, h: 720 };

let idCounter = 0;
const nextId = () => "layer-" + ++idCounter;

export default function App() {
  const [theme, toggleTheme] = useTheme();

  const [layers, setLayers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [canvasSize, setCanvasSize] = useState(DEFAULT_SIZE);
  const [sizeLocked, setSizeLocked] = useState(false);

  // Crop is per layer. `draftCrop` is the region being drawn, in composition
  // percentages; confirming turns it into the layer's rect plus a `srcCrop`
  // sub-rectangle of its source media.
  const [draftCrop, setDraftCrop] = useState(null);
  const [cropTargetId, setCropTargetId] = useState(null);
  const [aspect, setAspect] = useState("free");
  const cropMode = draftCrop != null;

  const [trim, setTrim] = useState({ trimIn: 0, trimOut: 1, trimOutIsMax: true });
  const [filename, setFilename] = useState("edited");
  const [format, setFormat] = useState("");
  const [toast, setToast] = useState(null);
  const [exportState, setExportState] = useState(null);

  const canvasRef = useRef(null);
  const frameRef = useRef(DEFAULT_SIZE); // composition size, for the compositor
  const mediaRef = useRef(createMediaStore());
  const layersRef = useRef(layers);
  const trimRef = useRef(trim);
  const exportRef = useRef(null);
  // once you rename the output yourself we stop deriving it from the media
  const filenameTouched = useRef(false);

  // stable across renders: the map object is mutated in place, never replaced
  const mediaElementsRef = useRef(mediaRef.current.elements);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  useEffect(() => {
    trimRef.current = trim;
  }, [trim]);

  const duration = useMemo(() => projectDuration(layers), [layers]);
  frameRef.current = canvasSize;

  /* ---- drawing ---- */

  /* ---- drawing ---- */

  const paint = useCallback((t, opts) => {
    // Mid-seek a video can't be drawn yet. Repainting anyway would clear to
    // black and skip it, flashing for as long as the seek takes -- so hold
    // the frame already on screen and repaint when 'seeked' fires.
    if (!(opts && opts.force) &&
        !canComposite(layersRef.current, mediaRef.current.elements, t)) {
      return false;
    }
    drawComposition(canvasRef.current, layersRef.current, mediaRef.current.elements, t, {
      w: frameRef.current.w,
      h: frameRef.current.h,
    });
    return true;
  }, []);

  const onFrame = useCallback(
    (t) => {
      paint(t);
      const ex = exportRef.current;
      if (ex) {
        const span = ex.trimOut - ex.trimIn;
        const done = clamp(t - ex.trimIn, 0, span);
        setExportState({ pct: span > 0 ? (done / span) * 100 : 100, done, total: span });
      }
    },
    [paint]
  );

  const finishExport = useCallback(() => {
    const ex = exportRef.current;
    if (ex && ex.recorder && ex.recorder.state !== "inactive") ex.recorder.stop();
  }, []);

  const playback = usePlayback({
    layersRef,
    mediaRef: mediaElementsRef,
    trimRef,
    onFrame,
    onEnd: finishExport,
  });
  const { playing, playhead, playheadRef, playingRef, play, pause, toggle, seek, stop } = playback;

  /* ---- canvas sizing ----
     Declared after `paint`/`playback` because it depends on both. */

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = canvasSize.w;
    c.height = canvasSize.h;
    // Resizing a canvas wipes it, so there is no previous frame worth holding.
    paint(playheadRef.current, { force: true });
  }, [canvasSize, paint, playheadRef]);

  // repaint whenever anything visual changes while paused
  useEffect(() => {
    if (!playing) paint(playhead);
  }, [layers, canvasSize, cropMode, draftCrop, playing, playhead, paint]);

  /* ---- trim follows duration ---- */

  useEffect(() => {
    setTrim((t) => {
      const trimOut = t.trimOutIsMax ? duration : clamp(t.trimOut, 0.05, duration);
      return { ...t, trimIn: clamp(t.trimIn, 0, trimOut - 0.05), trimOut };
    });
  }, [duration]);

  /* ---- toasts ---- */

  const flash = useCallback((msg) => {
    setToast(msg);
    clearTimeout(flash._t);
    flash._t = setTimeout(() => setToast(null), 2400);
  }, []);

  /* ---- layer creation ---- */

  const addFiles = useCallback(
    (files) => {
      for (const file of files) {
        const kind = (file.type || "").split("/")[0];
        if (!["video", "audio", "image"].includes(kind)) {
          flash("Unsupported file: " + file.name);
          continue;
        }

        const id = nextId();
        const url = URL.createObjectURL(file);
        mediaRef.current.urls[id] = url;

        const firstVisual =
          kind !== "audio" && !layersRef.current.some((l) => l.type === "video" || l.type === "image");

        const layer = {
          id,
          type: kind,
          name: file.name,
          duration: 0,
          offset: 0,
          len: 5,
          x: firstVisual ? 0 : 58,
          y: firstVisual ? 0 : 4,
          w: firstVisual ? 100 : 38,
          h: firstVisual ? 100 : 38,
          opacity: 1,
          visible: true,
          srcCrop: { x: 0, y: 0, w: 100, h: 100 },
          preCrop: null,
          muted: false,
          volume: 1,
          speed: 1,
        };

        if (kind === "video" || kind === "audio") {
          if (!filenameTouched.current) {
            const base = file.name.replace(/\.[^.]+$/, "").trim();
            if (base) setFilename("edited " + base);
            filenameTouched.current = true; // first clip wins, later ones don't rename
          }
          const el = document.createElement(kind);
          el.src = url;
          el.preload = "auto";
          if (kind === "video") el.playsInline = true;
          mediaRef.current.elements[id] = el;

          el.addEventListener("loadedmetadata", () => {
            setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, duration: el.duration || 0 } : l)));
            if (kind === "video") {
              setCanvasSize((s) => {
                if (sizeLocked) return s;
                return { w: el.videoWidth || s.w, h: el.videoHeight || s.h };
              });
              setSizeLocked(true);
            }
            attachAudioGraph(mediaRef.current, id, el, layer);
          });

          if (kind === "video") {
            // A seek finishes asynchronously - repaint once the frame is
            // actually decoded, otherwise a paused/scrubbed frame stays blank.
            ["seeked", "loadeddata", "canplay"].forEach((evt) =>
              el.addEventListener(evt, () => {
                if (!playingRef.current) paint(playheadRef.current);
              })
            );
          }
        } else {
          const img = new Image();
          img.src = url;
          mediaRef.current.elements[id] = img;
          img.addEventListener("load", () => {
            setCanvasSize((s) => {
              if (sizeLocked) return s;
              return { w: img.naturalWidth || s.w, h: img.naturalHeight || s.h };
            });
            setSizeLocked(true);
            paint(playheadRef.current);
          });
        }

        setLayers((ls) => [...ls, layer]);
        setSelectedId(id);
      }
    },
    [flash, sizeLocked, paint, playingRef, playheadRef]
  );

  const addText = useCallback(() => {
    const id = nextId();
    setLayers((ls) => [
      ...ls,
      {
        id,
        type: "text",
        name: "Text",
        offset: 0,
        len: 5,
        x: 15,
        y: 78,
        w: 70,
        h: 16,
        opacity: 1,
        visible: true,
        text: "Your text here",
        color: "#ffffff",
        fontSize: 7,
      },
    ]);
    setSelectedId(id);
  }, []);

  const patchLayer = useCallback((id, patch) => {
    setLayers((ls) =>
      ls.map((l) => {
        if (l.id !== id) return l;
        const next = { ...l, ...patch };
        if (patch.w != null) next.w = clamp(next.w, 2, 100);
        if (patch.h != null) next.h = clamp(next.h, 2, 100);
        next.x = clamp(next.x, 0, 100 - next.w);
        next.y = clamp(next.y, 0, 100 - next.h);
        return next;
      })
    );
  }, []);

  // keep the audio graph in step with volume/mute
  useEffect(() => {
    for (const l of layers) {
      if (l.type === "video" || l.type === "audio") {
        setGain(mediaRef.current, l.id, l.muted ? 0 : l.volume);
      }
      const el = mediaRef.current.elements[l.id];
      if (el && el.playbackRate != null) el.playbackRate = l.speed || 1;
    }
  }, [layers]);

  const removeLayer = useCallback(
    (id) => {
      disposeMedia(mediaRef.current, id);
      setLayers((ls) => ls.filter((l) => l.id !== id));
      setSelectedId((s) => (s === id ? null : s));
    },
    []
  );

  const moveLayer = useCallback((index, dir) => {
    setLayers((ls) => {
      const to = index + dir;
      if (to < 0 || to >= ls.length) return ls;
      const copy = ls.slice();
      const [item] = copy.splice(index, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }, []);

  /* ---- crop ---- */

  /* Crop is a per-layer process: start -> adjust -> confirm (or cancel).
     Confirming shrinks the layer's rect to the drawn region and records the
     matching sub-rectangle of its source, so pixels are cut rather than
     squashed. `preCrop` remembers the pre-crop state for Undo. */

  const CROPPABLE = ["video", "image"];
  const cropLayer = layers.find((l) => l.id === selectedId) || null;
  const canCrop = !!cropLayer && CROPPABLE.includes(cropLayer.type);

  const startCrop = useCallback(() => {
    if (!cropLayer) return;
    setCropTargetId(cropLayer.id);
    setDraftCrop({ x: cropLayer.x, y: cropLayer.y, w: cropLayer.w, h: cropLayer.h });
  }, [cropLayer]);

  const cancelCrop = useCallback(() => {
    setDraftCrop(null);
    setCropTargetId(null);
  }, []);

  const confirmCrop = useCallback(() => {
    const layer = layers.find((l) => l.id === cropTargetId);
    if (!layer || !draftCrop) return cancelCrop();

    // keep the region inside the layer -- cropping only ever cuts inward
    const x = clamp(draftCrop.x, layer.x, layer.x + layer.w);
    const y = clamp(draftCrop.y, layer.y, layer.y + layer.h);
    const w = Math.max(1, Math.min(draftCrop.w, layer.x + layer.w - x));
    const h = Math.max(1, Math.min(draftCrop.h, layer.y + layer.h - y));

    const S = layer.srcCrop || { x: 0, y: 0, w: 100, h: 100 };
    // where the region sits within the currently visible part of the source
    const fx = (x - layer.x) / layer.w;
    const fy = (y - layer.y) / layer.h;
    const fw = w / layer.w;
    const fh = h / layer.h;

    patchLayer(layer.id, {
      x, y, w, h,
      srcCrop: {
        x: S.x + fx * S.w,
        y: S.y + fy * S.h,
        w: fw * S.w,
        h: fh * S.h,
      },
      // snapshot only the first time, so Undo returns all the way back
      preCrop: layer.preCrop || { rect: { x: layer.x, y: layer.y, w: layer.w, h: layer.h }, srcCrop: S },
    });
    cancelCrop();
  }, [layers, cropTargetId, draftCrop, patchLayer, cancelCrop]);

  const undoCrop = useCallback(() => {
    if (!cropLayer || !cropLayer.preCrop) return;
    const { rect, srcCrop } = cropLayer.preCrop;
    patchLayer(cropLayer.id, { ...rect, srcCrop, preCrop: null });
    setAspect("free");
  }, [cropLayer, patchLayer]);

  const centerCrop = useCallback(() => {
    const layer = layers.find((l) => l.id === cropTargetId);
    if (!layer) return;
    setDraftCrop((c) =>
      c ? { ...c, x: layer.x + (layer.w - c.w) / 2, y: layer.y + (layer.h - c.h) / 2 } : c
    );
  }, [layers, cropTargetId]);

  const changeAspect = useCallback(
    (value) => {
      setAspect(value);
      const ratio = parseAspect(value);
      if (ratio) setDraftCrop((c) => (c ? applyAspectToCrop(c, ratio, canvasSize.w, canvasSize.h) : c));
    },
    [canvasSize]
  );

  /* ---- paste ---- */

  useEffect(() => {
    const onPaste = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const data = e.clipboardData;
      if (!data) return;

      const files = [];
      if (data.files && data.files.length) files.push(...Array.from(data.files));
      else if (data.items) {
        for (const item of data.items) {
          if (item.kind === "file") {
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        }
      }
      const media = files.filter((f) => /^(video|audio|image)\//.test(f.type));
      if (!media.length) return;

      e.preventDefault();
      addFiles(media);
      flash("Pasted " + media.length + (media.length === 1 ? " file" : " files"));
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addFiles, flash]);

  /* ---- spacebar ---- */

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (cropMode && (e.key === "Enter" || e.key === "Escape")) {
        e.preventDefault();
        if (e.key === "Enter") confirmCrop();
        else cancelCrop();
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggle, cropMode, confirmCrop, cancelCrop]);

  /* ---- export ---- */

  const onlyAudio = layers.length > 0 && layers.every((l) => l.type === "audio");
  const formats = useMemo(() => supportedFormats(onlyAudio), [onlyAudio]);

  useEffect(() => {
    if (formats.length && !formats.some((f) => f.mime === format)) setFormat(formats[0].mime);
  }, [formats, format]);

  const startExport = useCallback(() => {
    if (layers.length === 0) return flash("Add some media first");
    if (typeof MediaRecorder === "undefined") return flash("This browser can't record");
    if (cropMode) return flash("Apply or cancel the crop first");
    if (playing) pause();

    const fmt = findFormat(format, onlyAudio);
    const ac = resumeAudio();
    const dest = ac.createMediaStreamDestination();
    const tapped = [];
    for (const l of layers) {
      const g = mediaRef.current.gains[l.id];
      if (g && !l.muted) {
        g.connect(dest);
        tapped.push(g);
      }
    }

    // The preview canvas already renders the cropped output, so it can be
    // recorded directly -- no second crop pass.
    const stream = onlyAudio
      ? dest.stream
      : new MediaStream([
          canvasRef.current.captureStream(30).getVideoTracks()[0],
          ...dest.stream.getAudioTracks(),
        ]);

    const recorder = new MediaRecorder(
      stream,
      fmt.mime ? { mimeType: fmt.mime, videoBitsPerSecond: 8_000_000 } : {}
    );
    const chunks = [];
    let cancelled = false;

    recorder.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      for (const g of tapped) {
        try {
          g.disconnect(dest);
        } catch {
          /* already gone */
        }
      }
      exportRef.current = null;
      setExportState(null);
      if (cancelled || !chunks.length) return;

      const blob = new Blob(chunks, { type: fmt.mime || "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (filename.trim() || "edited") + "." + fmt.ext;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      flash("Exported " + a.download);
    };

    exportRef.current = {
      recorder,
      trimIn: trim.trimIn,
      trimOut: trim.trimOut,
      cancel: () => {
        cancelled = true;
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
        stop();
      },
    };

    setExportState({ pct: 0, done: 0, total: trim.trimOut - trim.trimIn });
    seek(trim.trimIn);
    recorder.start(200);
    play();
  }, [
    layers, flash, cropMode, playing, pause, format, onlyAudio, trim,
    filename, seek, play, stop,
  ]);

  const selected = layers.find((l) => l.id === selectedId) || null;
  const time = playhead;

  return (
    <>
      <TopBar
        theme={theme}
        onToggleTheme={toggleTheme}
        filename={filename}
        onFilenameChange={(v) => {
          filenameTouched.current = true;
          setFilename(v);
        }}
        formats={formats}
        format={format}
        onFormatChange={setFormat}
        onExport={startExport}
        exporting={!!exportState}
      />

      <main className="workspace">
        <LayersPanel
          layers={layers}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onToggleVisible={(id) =>
            setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)))
          }
          onMove={moveLayer}
          onRemove={removeLayer}
          onAddFiles={addFiles}
          onAddText={addText}
        />

        <section className="preview-area">
          <Preview
            canvasRef={canvasRef}
            layers={layers}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onLayerRect={patchLayer}
            cropMode={cropMode}
            draftCrop={draftCrop}
            onDraftCrop={setDraftCrop}
            aspect={aspect}
            frameSize={canvasSize}
            time={time}
            onDropFiles={addFiles}
          />

          <Transport playing={playing} onTogglePlay={toggle} time={time} duration={duration} />

          <Timeline
            duration={duration}
            trimIn={trim.trimIn}
            trimOut={trim.trimOut}
            onTrim={(patch) =>
              setTrim((t) => ({
                ...t,
                ...patch,
                trimOutIsMax:
                  patch.trimOut != null ? patch.trimOut >= duration - 0.05 : t.trimOutIsMax,
              }))
            }
            time={time}
            onScrub={seek}
          />
        </section>

        <Properties
          layer={selected}
          layerCount={layers.length}
          canvasSize={canvasSize}
          duration={duration}
          crop={{
            cropMode,
            canCrop,
            hasCrop: !!(cropLayer && cropLayer.preCrop),
            aspect,
            onAspectChange: changeAspect,
            onStart: startCrop,
            onCenter: centerCrop,
            onConfirm: confirmCrop,
            onCancel: cancelCrop,
            onUndo: undoCrop,
            sizeLabel: draftCrop
              ? Math.round((draftCrop.w / 100) * canvasSize.w) +
                " x " +
                Math.round((draftCrop.h / 100) * canvasSize.h)
              : "",
          }}
          onPatch={(patch) => selected && patchLayer(selected.id, patch)}
          onRemove={() => selected && removeLayer(selected.id)}
        />
      </main>

      {exportState && (
        <div className="export-overlay">
          <div className="export-card">
            <div className="export-title">Rendering...</div>
            <div className="export-bar">
              <div className="export-bar-fill" style={{ width: exportState.pct + "%" }} />
            </div>
            <div className="export-sub">
              {formatTime(exportState.done)} / {formatTime(exportState.total)} recorded
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => exportRef.current && exportRef.current.cancel()}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
