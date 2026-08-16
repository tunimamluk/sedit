import { memo } from "react";
import { Icon } from "./Icon.jsx";

/* Audio is not a layer -- it never draws to the canvas, so it gets its own
   list rather than sitting among the visual stack. */
export const AudioTrackList = memo(function AudioTrackList({
  tracks,
  selectedId,
  onSelect,
  onToggleMute,
  onRemove,
  onAddFiles,
}) {
  return (
    <div className="audio-section">
      <div className="panel-header">Audio</div>

      <div className="track-list">
        {tracks.length === 0 ? (
          <div className="empty-hint">No audio yet.</div>
        ) : (
          tracks.map((t) => (
            <div
              key={t.id}
              className={"layer-item" + (t.id === selectedId ? " selected" : "")}
              onClick={() => onSelect(t.id)}
            >
              <div className="layer-thumb kind-audio">
                <Icon name="audio" size={16} />
              </div>
              <div className="layer-meta">
                <div className="layer-name">{t.name}</div>
                <div className="layer-type">Audio</div>
              </div>
              <div className="layer-controls">
                <button
                  className={"layer-icon-btn" + (t.muted ? " off" : "")}
                  title={t.muted ? "Unmute" : "Mute"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMute(t.id);
                  }}
                >
                  <Icon name={t.muted ? "volumeOff" : "volume"} size={14} />
                </button>
                <button
                  className="layer-icon-btn"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(t.id);
                  }}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <label className="add-layer-btn">
        <span>+ Add Audio</span>
        <input
          type="file"
          accept="audio/*"
          multiple
          hidden
          onChange={(e) => {
            onAddFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
});
