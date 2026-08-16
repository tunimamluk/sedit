import { memo } from "react";
import { formatTime, layerLen, layerSpeed } from "../lib/time.js";
import { CropControls } from "./CropControls.jsx";

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

function Group({ label, children }) {
  return (
    <div className="prop-group">
      <div className="prop-label">{label}</div>
      {children}
    </div>
  );
}

function Range({ label, value, min, max, step, onChange, display, disabled, note }) {
  return (
    <div className={"prop-group" + (disabled ? " prop-disabled" : "")}>
      <div className="prop-label">{label}</div>
      <input
        className="prop-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div className="prop-value">{disabled && note ? note : display != null ? display : Math.round(value)}</div>
    </div>
  );
}

/* memo'd so the ~60fps playhead updates don't re-render the whole panel. */
export const Properties = memo(function Properties({
  layer,
  track,
  onPatchTrack,
  onRemoveTrack,
  layerCount,
  canvasSize,
  duration,
  crop,
  onPatch,
  onRemove,
}) {
  return (
    <aside className="panel properties-panel">
      <div className="panel-header">Properties</div>
      <div className="properties-body">
        <div className="prop-section-title">Project</div>
        <div className="prop-hint">
          Output frame: {canvasSize.w} x {canvasSize.h} px
          <br />
          Length: {formatTime(duration)}
        </div>

        {track ? (
          <>
            <div className="prop-section-title">Audio track</div>

            <Group label="Name">
              <input
                className="prop-input"
                type="text"
                value={track.name}
                onChange={(e) => onPatchTrack({ name: e.target.value })}
              />
            </Group>

            <Group label="Start (seconds)">
              <input
                className="prop-input"
                type="number"
                step="0.1"
                value={Math.round(track.offset * 100) / 100}
                onChange={(e) => onPatchTrack({ offset: Math.max(0, parseFloat(e.target.value) || 0) })}
              />
            </Group>

            <Group label="Speed">
              <select
                className="prop-input"
                value={layerSpeed(track)}
                onChange={(e) => onPatchTrack({ speed: parseFloat(e.target.value) })}
              >
                {SPEEDS.map((sp) => (
                  <option key={sp} value={sp}>
                    {sp}x
                  </option>
                ))}
              </select>
            </Group>
            <div className="prop-hint">
              Source {formatTime(track.duration || 0)} &nbsp;&middot;&nbsp; takes{" "}
              {formatTime(layerLen(track))} on the timeline
            </div>

            <div className="prop-toggle-row">
              <div className="prop-label">Mute</div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={track.muted}
                  onChange={(e) => onPatchTrack({ muted: e.target.checked })}
                />
                <div className="switch-track" />
              </label>
            </div>

            <Range
              label="Volume"
              value={track.volume * 100}
              min={0}
              max={100}
              step={1}
              disabled={track.muted}
              note="Muted"
              onChange={(v) => onPatchTrack({ volume: v / 100 })}
            />

            <button className="remove-btn" onClick={onRemoveTrack}>
              Remove audio track
            </button>
          </>
        ) : !layer ? (
          <div className="empty-hint" style={{ padding: "4px 0" }}>
            {layerCount === 0
              ? "Add media to begin, then select a layer or audio track to edit it."
              : "Select a layer or audio track on the left to edit it."}
          </div>
        ) : (
          <>
            <div className="prop-section-title">Layer</div>

            <Group label="Name">
              <input
                className="prop-input"
                type="text"
                value={layer.name}
                onChange={(e) => onPatch({ name: e.target.value })}
              />
            </Group>

            {layer.type === "text" && (
              <>
                <Group label="Text">
                  <textarea
                    className="prop-textarea"
                    value={layer.text}
                    onChange={(e) => onPatch({ text: e.target.value })}
                  />
                </Group>
                <Group label="Color">
                  <input
                    className="prop-color"
                    type="color"
                    value={layer.color}
                    onChange={(e) => onPatch({ color: e.target.value })}
                  />
                </Group>
                <Range
                  label="Font size"
                  value={layer.fontSize}
                  min={1}
                  max={25}
                  step={0.5}
                  onChange={(v) => onPatch({ fontSize: v })}
                />
              </>
            )}

            {layer.type !== "audio" && (
              <>
                <div className="prop-group">
                  <div className="prop-label">Size (pixels)</div>
                  <div className="prop-row">
                    <div style={{ flex: 1 }}>
                      <div className="prop-value">Width</div>
                      <input
                        className="prop-input"
                        type="number"
                        value={Math.round((layer.w / 100) * canvasSize.w)}
                        onChange={(e) =>
                          onPatch({ w: ((parseFloat(e.target.value) || 0) / canvasSize.w) * 100 })
                        }
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="prop-value">Height</div>
                      <input
                        className="prop-input"
                        type="number"
                        value={Math.round((layer.h / 100) * canvasSize.h)}
                        onChange={(e) =>
                          onPatch({ h: ((parseFloat(e.target.value) || 0) / canvasSize.h) * 100 })
                        }
                      />
                    </div>
                  </div>
                  <div className="prop-hint">
                    Pixels in the {canvasSize.w}x{canvasSize.h} output frame. Drag the layer on the
                    preview to move it.
                  </div>
                </div>

                {crop.canCrop && <CropControls {...crop} />}

                <Range
                  label="Opacity"
                  value={layer.opacity * 100}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => onPatch({ opacity: v / 100 })}
                />
              </>
            )}

            {(layer.type === "image" || layer.type === "text") && (
              <Group label="Duration (seconds)">
                <input
                  className="prop-input"
                  type="number"
                  step="0.1"
                  value={layer.len}
                  onChange={(e) => onPatch({ len: Math.max(0.1, parseFloat(e.target.value) || 0.1) })}
                />
              </Group>
            )}

            {(layer.type === "video" || layer.type === "audio") && (
              <>
                <Group label="Speed">
                  <select
                    className="prop-input"
                    value={layerSpeed(layer)}
                    onChange={(e) => onPatch({ speed: parseFloat(e.target.value) })}
                  >
                    {SPEEDS.map((s) => (
                      <option key={s} value={s}>
                        {s}x
                      </option>
                    ))}
                  </select>
                </Group>
                <div className="prop-hint">
                  Source {formatTime(layer.duration || 0)} &nbsp;&middot;&nbsp; takes{" "}
                  {formatTime(layerLen(layer))} on the timeline
                </div>

                <div className="prop-toggle-row">
                  <div className="prop-label">Mute</div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={layer.muted}
                      onChange={(e) => onPatch({ muted: e.target.checked })}
                    />
                    <div className="switch-track" />
                  </label>
                </div>

                <Range
                  label="Volume"
                  value={layer.volume * 100}
                  min={0}
                  max={100}
                  step={1}
                  disabled={layer.muted}
                  note="Muted"
                  onChange={(v) => onPatch({ volume: v / 100 })}
                />
              </>
            )}

            <button className="remove-btn" onClick={onRemove}>
              Remove layer
            </button>
          </>
        )}
      </div>
    </aside>
  );
});
