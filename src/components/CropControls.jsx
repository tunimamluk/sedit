import { Icon } from "./Icon.jsx";

const ASPECTS = ["free", "16:9", "9:16", "1:1", "4:3", "3:4", "4:5", "21:9"];

/* Crop is a process, not a permanent panel.

   Idle shows only the Crop button (plus Undo once a crop is applied). The
   ratio picker, centring and confirm controls exist only while a region is
   actually being drawn. */
export function CropControls({
  cropMode,
  hasCrop,
  aspect,
  onAspectChange,
  onStart,
  onConfirm,
  onCancel,
  onUndo,
  sizeLabel,
}) {
  if (!cropMode) {
    return (
      <div className="crop-idle">
        <button className="crop-start" onClick={onStart} title="Crop this layer">
          <Icon name="crop" size={14} />
          <span>Crop layer</span>
        </button>
        {hasCrop && (
          <button className="crop-start crop-undo" onClick={onUndo} title="Undo this layer's crop">
            <Icon name="undo" size={14} />
            <span>Undo</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="crop-panel">
      <div className="crop-panel-head">
        <span>Cropping layer</span>
        <span className="crop-readout">{sizeLabel}</span>
      </div>

      <div className="prop-group">
        <div className="prop-label">Aspect ratio</div>
        <select
          className="prop-input"
          value={aspect}
          onChange={(e) => onAspectChange(e.target.value)}
        >
          {ASPECTS.map((a) => (
            <option key={a} value={a}>
              {a === "free" ? "Free" : a}
            </option>
          ))}
        </select>
      </div>

      <div className="crop-actions">
        <button className="crop-action crop-cancel" onClick={onCancel} title="Escape">
          <Icon name="close" size={14} />
          <span>Cancel</span>
        </button>
        <button className="crop-action crop-apply" onClick={onConfirm} title="Enter">
          <Icon name="check" size={14} />
          <span>Apply</span>
        </button>
      </div>

      <div className="prop-hint">
        Drag the region over the layer. It snaps to the edges, centre and thirds
        &mdash; hold Alt to place it freely, or Shift on a corner to keep its ratio.
      </div>
    </div>
  );
}
