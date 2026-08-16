import { memo, useRef, useState } from "react";
import { clamp, clipEnd, clipStart, formatTime, sourceLen } from "../lib/time.js";
import { FONTS, SIZE_PRESETS, TEXT_SWATCHES } from "../lib/text.js";
import { CropControls } from "./CropControls.jsx";
import { Icon } from "./Icon.jsx";

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

/* A number you can actually type into. Clamping on every keystroke makes a
   field unusable -- typing "48" into a min-of-10 box turns the "4" into "10"
   and you end up with "108". The raw text is kept while the field has focus
   and the clamp happens on Enter or blur. `presets` turns it into a combo box
   the way a word processor's size field works: pick one, or type your own. */
function NumField({ value, min, max, step = 1, onChange, presets, id, title }) {
  const [draft, setDraft] = useState(null);
  const cancelling = useRef(false);

  const commit = (raw) => {
    const v = parseFloat(raw);
    if (!Number.isNaN(v)) onChange(clamp(v, min, max));
    setDraft(null);
  };
  const nudge = (dir) => onChange(clamp(value + dir * step, min, max));

  return (
    <div className="numfield" title={title}>
      <button className="numfield-btn" onClick={() => nudge(-1)} disabled={value <= min}>
        &minus;
      </button>
      <input
        className="numfield-input"
        type="text"
        inputMode="decimal"
        list={presets ? id : undefined}
        value={draft != null ? draft : String(Math.round(value))}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => {
          if (cancelling.current) {
            cancelling.current = false;
            setDraft(null);
            return;
          }
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(e.currentTarget.value);
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            cancelling.current = true;
            setDraft(null);
            e.currentTarget.blur();
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            setDraft(null);
            nudge(e.key === "ArrowUp" ? 1 : -1);
          }
        }}
      />
      {presets && (
        <datalist id={id}>
          {presets.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      )}
      <button className="numfield-btn" onClick={() => nudge(1)} disabled={value >= max}>
        +
      </button>
    </div>
  );
}

function Seg({ active, onClick, title, children }) {
  return (
    <button
      className={"seg-btn" + (active ? " active" : "")}
      onClick={onClick}
      title={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

/* The whole text editor, kept together so the layer panel below stays
   readable. Sizes are stored as a percentage of the frame height and shown
   in pixels of the current frame -- the number that means something while
   you are looking at the preview. */
function TextControls({ layer, canvasSize, onPatch }) {
  const px = Math.round((layer.fontSize / 100) * canvasSize.h);
  const setPx = (v) => onPatch({ fontSize: (v / canvasSize.h) * 100 });

  return (
    <>
      <Group label="Text">
        <textarea
          className="prop-textarea"
          value={layer.text}
          rows={3}
          onChange={(e) => onPatch({ text: e.target.value })}
        />
      </Group>

      <Group label="Font">
        <select
          className="prop-input select"
          value={layer.fontFamily || FONTS[0].stack}
          onChange={(e) => onPatch({ fontFamily: e.target.value })}
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.stack} style={{ fontFamily: f.stack }}>
              {f.label}
            </option>
          ))}
        </select>
      </Group>

      <div className="prop-group">
        <div className="prop-label">Font size (pixels)</div>
        <NumField
          id="text-size-presets"
          value={px}
          min={4}
          max={Math.max(8, canvasSize.h)}
          step={1}
          presets={SIZE_PRESETS}
          onChange={setPx}
          title="Type any size, or pick one from the list"
        />
      </div>

      <div className="prop-group">
        <div className="prop-label">Style</div>
        <div className="seg-row">
          <div className="seg">
            <Seg active={!!layer.bold} onClick={() => onPatch({ bold: !layer.bold })} title="Bold">
              <span className="seg-b">B</span>
            </Seg>
            <Seg
              active={!!layer.italic}
              onClick={() => onPatch({ italic: !layer.italic })}
              title="Italic"
            >
              <span className="seg-i">I</span>
            </Seg>
            <Seg
              active={!!layer.underline}
              onClick={() => onPatch({ underline: !layer.underline })}
              title="Underline"
            >
              <span className="seg-u">U</span>
            </Seg>
          </div>

          <div className="seg">
            {[
              ["left", "alignLeft", "Align left"],
              ["center", "alignCenter", "Align centre"],
              ["right", "alignRight", "Align right"],
            ].map(([value, icon, title]) => (
              <Seg
                key={value}
                active={(layer.align || "left") === value}
                onClick={() => onPatch({ align: value })}
                title={title}
              >
                <Icon name={icon} size={14} />
              </Seg>
            ))}
          </div>
        </div>
      </div>

      <div className="prop-group">
        <div className="prop-label">Colour</div>
        <div className="colour-row">
          <label className="swatch swatch-custom" title="Pick any colour">
            <span className="swatch-fill" style={{ background: layer.color }} />
            <input
              type="color"
              value={layer.color}
              onChange={(e) => onPatch({ color: e.target.value })}
            />
          </label>
          <div className="swatch-set">
            {TEXT_SWATCHES.map((c) => (
              <button
                key={c}
                className={"swatch" + (layer.color.toLowerCase() === c ? " active" : "")}
                style={{ background: c }}
                title={c}
                onClick={() => onPatch({ color: c })}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="prop-toggle-row">
        <div className="prop-label">Drop shadow</div>
        <label className="switch">
          <input
            type="checkbox"
            checked={layer.shadow !== false}
            onChange={(e) => onPatch({ shadow: e.target.checked })}
          />
          <div className="switch-track" />
        </label>
      </div>
    </>
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

            <div className="prop-group">
              <div className="prop-label">Clip (seconds of source)</div>
              <div className="prop-row">
                <div style={{ flex: 1 }}>
                  <div className="prop-value">Trim from</div>
                  <input
                    className="prop-input"
                    type="number"
                    step="0.1"
                    min="0"
                    value={Math.round(clipStart(track) * 100) / 100}
                    onChange={(e) => {
                      const v = Math.max(0, parseFloat(e.target.value) || 0);
                      onPatchTrack({ clipStart: Math.min(v, clipEnd(track) - 0.05) });
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="prop-value">Length</div>
                  <input
                    className="prop-input"
                    type="number"
                    step="0.1"
                    min="0.05"
                    value={Math.round(sourceLen(track) * 100) / 100}
                    onChange={(e) => {
                      const len = Math.max(0.05, parseFloat(e.target.value) || 0.05);
                      onPatchTrack({
                        clipEnd: Math.min(clipStart(track) + len, track.duration || 0),
                      });
                    }}
                  />
                </div>
              </div>
              <div className="prop-hint">
                Full file is {formatTime(track.duration || 0)}. Drag either end of the clip in the
                timeline to trim it there instead.
              </div>
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
              <TextControls layer={layer} canvasSize={canvasSize} onPatch={onPatch} />
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
