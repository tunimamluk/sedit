import { memo, useState } from "react";
import { Icon } from "./Icon.jsx";

/* memo'd: the playhead updates ~60x/second during playback and this panel
   has nothing to say about time, so it should not re-render with it. */
export const LayersPanel = memo(function LayersPanel({
  layers,
  selectedId,
  onSelect,
  onToggleVisible,
  onMove,
  onRemove,
  onAddFiles,
  onAddText,
  onDropFiles,
  audio,
}) {
  const [dropping, setDropping] = useState(false);

  return (
    <aside
      className={"panel layers-panel" + (dropping ? " dropping" : "")}
      onDragEnter={(e) => {
        e.preventDefault();
        setDropping(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setDropping(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        onDropFiles(Array.from(e.dataTransfer.files || []));
      }}
    >
      <div className="panel-header">Layers</div>

      <div className="layer-list">
        {layers.length === 0 ? (
          <div className="empty-hint">
            No media yet. Add a video, audio or image file to get started.
          </div>
        ) : (
          // topmost layer first
          layers
            .map((l, i) => ({ l, i }))
            .reverse()
            .map(({ l, i }) => (
              <div
                key={l.id}
                className={"layer-item" + (l.id === selectedId ? " selected" : "")}
                onClick={() => onSelect(l.id)}
              >
                <div className={"layer-thumb kind-" + l.type}>
                  <Icon name={l.type} size={16} />
                </div>

                <div className="layer-meta">
                  <div className="layer-name">{l.name}</div>
                  <div className="layer-type">{l.type}</div>
                </div>

                <div className="layer-controls">
                  <button
                    className={"layer-icon-btn" + (l.visible ? "" : " off")}
                    title={l.visible ? "Hide layer" : "Show layer"}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisible(l.id);
                    }}
                  >
                    <Icon name={l.visible ? "eye" : "eyeOff"} size={14} />
                  </button>
                  <button
                    className="layer-icon-btn"
                    title="Bring forward"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(i, 1);
                    }}
                  >
                    <Icon name="up" size={14} />
                  </button>
                  <button
                    className="layer-icon-btn"
                    title="Send backward"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(i, -1);
                    }}
                  >
                    <Icon name="down" size={14} />
                  </button>
                  <button
                    className="layer-icon-btn"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(l.id);
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
        <span>+ Add Media</span>
        <input
          type="file"
          accept="video/*,image/*"
          multiple
          hidden
          onChange={(e) => {
            onAddFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </label>
      <button type="button" className="add-layer-btn add-layer-secondary" onClick={onAddText}>
        + Add Text
      </button>

      {audio}
    </aside>
  );
});
