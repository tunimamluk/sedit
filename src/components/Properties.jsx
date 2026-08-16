import { memo } from "react";
import { clamp, clipEnd, clipStart, formatTime, sourceLen } from "../lib/time.js";
import { BOX_DEFAULTS, FONTS, ofHeight, SIZE_PRESETS, TEXT_SWATCHES } from "../lib/text.js";
import { CropControls } from "./CropControls.jsx";
import { NumberInput } from "./NumberInput.jsx";
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

/* A colour square that opens the picker, with the colours a caption actually
   wants one click away. Shared by the text, the fill and the border. */
function ColourRow({ value, onChange }) {
  return (
    <div className="colour-row">
      <label className="swatch swatch-custom" title="Pick any colour">
        <span className="swatch-fill" style={{ background: value }} />
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
      <div className="swatch-set">
        {TEXT_SWATCHES.map((c) => (
          <button
            key={c}
            className={"swatch" + (String(value).toLowerCase() === c ? " active" : "")}
            style={{ background: c }}
            title={c}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="prop-toggle-row">
      <div className="prop-label">{label}</div>
      <label className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <div className="switch-track" />
      </label>
    </div>
  );
}

/* The whole text editor, kept together so the layer panel below stays
   readable. Sizes are stored as a percentage of the frame height and shown
   in pixels of the current frame -- the number that means something while
   you are looking at the preview. */
function TextControls({ layer, canvasSize, onPatch }) {
  const px = Math.round((layer.fontSize / 100) * canvasSize.h);
  const setPx = (v) => onPatch({ fontSize: (v / canvasSize.h) * 100 });
  // On/off is its own flag, so the colour and thickness you chose survive
  // being switched off and back on.
  const hasFill = !!layer.fillOn;
  const hasBorder = !!layer.borderOn;

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
        <NumberInput
          id="text-size-presets"
          value={px}
          min={4}
          max={Math.max(8, canvasSize.h)}
          step={1}
          presets={SIZE_PRESETS}
          steppers
          decimals={0}
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
        <ColourRow value={layer.color} onChange={(v) => onPatch({ color: v })} />
      </div>

      <ToggleRow
        label="Drop shadow"
        checked={layer.shadow !== false}
        onChange={(v) => onPatch({ shadow: v })}
      />

      {/* ---- the box behind the text ---- */}

      <ToggleRow label="Background" checked={hasFill} onChange={(v) => onPatch({ fillOn: v })} />
      {hasFill && (
        <div className="prop-group prop-indent">
          <ColourRow
            value={layer.boxFill || BOX_DEFAULTS.fill}
            onChange={(v) => onPatch({ boxFill: v })}
          />
        </div>
      )}

      <ToggleRow label="Border" checked={hasBorder} onChange={(v) => onPatch({ borderOn: v })} />
      {hasBorder && (
        <div className="prop-group prop-indent">
          <ColourRow
            value={layer.borderColor || BOX_DEFAULTS.borderColor}
            onChange={(v) => onPatch({ borderColor: v })}
          />
          <div className="prop-value" style={{ marginTop: 10 }}>
            Thickness (pixels)
          </div>
          <NumberInput
            value={ofHeight(layer.borderWidth, canvasSize.h)}
            min={1}
            max={Math.max(2, Math.round(canvasSize.h / 8))}
            decimals={0}
            steppers
            onChange={(v) => onPatch({ borderWidth: (v / canvasSize.h) * 100 })}
          />
        </div>
      )}

      {(hasFill || hasBorder) && (
        <div className="prop-group prop-indent">
          <div className="prop-row">
            <div style={{ flex: 1 }}>
              <div className="prop-value">Padding (px)</div>
              <NumberInput
                value={ofHeight(layer.padding, canvasSize.h)}
                min={0}
                max={Math.round(canvasSize.h / 4)}
                decimals={0}
                onChange={(v) => onPatch({ padding: (v / canvasSize.h) * 100 })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div className="prop-value">Corner (px)</div>
              <NumberInput
                value={ofHeight(layer.radius, canvasSize.h)}
                min={0}
                max={Math.round(canvasSize.h / 4)}
                decimals={0}
                onChange={(v) => onPatch({ radius: (v / canvasSize.h) * 100 })}
              />
            </div>
          </div>
          <div className="prop-hint">
            The box wraps the words themselves, not the whole layer, so padding is measured from
            the text.
          </div>
        </div>
      )}
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
              <NumberInput
                value={track.offset}
                min={0}
                step={0.1}
                onChange={(v) => onPatchTrack({ offset: v })}
              />
            </Group>

            <div className="prop-group">
              <div className="prop-label">Clip (seconds of source)</div>
              <div className="prop-row">
                <div style={{ flex: 1 }}>
                  <div className="prop-value">Trim from</div>
                  <NumberInput
                    value={clipStart(track)}
                    min={0}
                    max={Math.max(0, clipEnd(track) - 0.05)}
                    step={0.1}
                    onChange={(v) => onPatchTrack({ clipStart: v })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="prop-value">Length</div>
                  <NumberInput
                    value={sourceLen(track)}
                    min={0.05}
                    max={Math.max(0.05, (track.duration || 0) - clipStart(track))}
                    step={0.1}
                    onChange={(len) => onPatchTrack({ clipEnd: clipStart(track) + len })}
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
                      <NumberInput
                        value={(layer.w / 100) * canvasSize.w}
                        min={Math.ceil(canvasSize.w * 0.02)}
                        max={canvasSize.w}
                        decimals={0}
                        onChange={(v) => onPatch({ w: (v / canvasSize.w) * 100 })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="prop-value">Height</div>
                      <NumberInput
                        value={(layer.h / 100) * canvasSize.h}
                        min={Math.ceil(canvasSize.h * 0.02)}
                        max={canvasSize.h}
                        decimals={0}
                        onChange={(v) => onPatch({ h: (v / canvasSize.h) * 100 })}
                      />
                    </div>
                  </div>
                  <div className="prop-hint">
                    Pixels in the {canvasSize.w}x{canvasSize.h} output frame. Drag the layer on the
                    preview to move it -- it snaps to the centre and the edges, and Alt places it
                    anywhere.
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
                <NumberInput
                  value={layer.len}
                  min={0.1}
                  step={0.1}
                  onChange={(v) => onPatch({ len: v })}
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
