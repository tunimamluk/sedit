import { Icon } from "./Icon.jsx";

const ASPECTS = ["free", "16:9", "9:16", "1:1", "4:3", "3:4", "4:5", "21:9"];

/* Crop is a mode, not a permanent panel.

   Idle shows only the Crop button (plus Undo once a crop is applied) so the
   preview stays uncluttered. The ratio picker, centring and confirm controls
   only exist while a crop is actually being drawn. */
export function CropToolbar({
  cropMode,
  hasCrop,
  aspect,
  onAspectChange,
  onStart,
  onCenter,
  onConfirm,
  onCancel,
  onUndo,
  sizeLabel,
}) {
  if (!cropMode) {
    return (
      <div className="crop-toolbar">
        <button className="crop-btn" onClick={onStart} title="Crop the frame">
          <Icon name="crop" size={15} />
          <span>Crop</span>
        </button>
        {hasCrop && (
          <button className="crop-btn" onClick={onUndo} title="Undo the crop">
            <Icon name="undo" size={15} />
            <span>Undo</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="crop-toolbar crop-toolbar-active">
      <select
        className="crop-select"
        value={aspect}
        onChange={(e) => onAspectChange(e.target.value)}
        title="Lock to an aspect ratio (optional)"
      >
        {ASPECTS.map((a) => (
          <option key={a} value={a}>
            {a === "free" ? "Free ratio" : a}
          </option>
        ))}
      </select>

      <span className="crop-readout">{sizeLabel}</span>

      <button className="crop-icon-btn" onClick={onCenter} title="Snap to the middle">
        <Icon name="center" size={15} />
      </button>

      <span className="crop-divider" />

      <button className="crop-icon-btn crop-cancel" onClick={onCancel} title="Cancel (Esc)">
        <Icon name="close" size={15} />
      </button>
      <button className="crop-icon-btn crop-confirm" onClick={onConfirm} title="Apply crop (Enter)">
        <Icon name="check" size={15} />
      </button>
    </div>
  );
}
