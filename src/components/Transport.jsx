import { Icon } from "./Icon.jsx";
import { formatTime } from "../lib/time.js";

const ASPECTS = ["free", "16:9", "9:16", "1:1", "4:3", "3:4", "4:5", "21:9"];

export function Transport({
  playing,
  onTogglePlay,
  time,
  duration,
  cropMode,
  onToggleCrop,
  aspect,
  onAspectChange,
}) {
  return (
    <div className="transport">
      <button className="icon-btn" onClick={onTogglePlay} title="Play / Pause (Space)">
        <Icon name={playing ? "pause" : "play"} size={17} />
      </button>

      <span className="time-label">
        {formatTime(time)} / {formatTime(duration)}
      </span>

      <div className="transport-group">
        <button
          className={"btn btn-ghost" + (cropMode ? " active" : "")}
          onClick={onToggleCrop}
          title="Crop the output frame"
        >
          Crop
        </button>
        <select
          className="select"
          title="Lock the crop to an aspect ratio"
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

      <span className="transport-hint">
        Hold <kbd>Shift</kbd> while dragging a crop corner to keep its ratio
      </span>
    </div>
  );
}
