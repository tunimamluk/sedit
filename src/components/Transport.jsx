import { Icon } from "./Icon.jsx";
import { formatTime } from "../lib/time.js";

/* Crop lives on the preview itself now, so this is purely playback. */
export function Transport({ playing, onTogglePlay, time, duration, disabled }) {
  return (
    <div className="transport">
      <button
        className="icon-btn"
        onClick={onTogglePlay}
        disabled={disabled}
        title={disabled ? "Add media first" : "Play / Pause (Space)"}
      >
        <Icon name={playing ? "pause" : "play"} size={17} />
      </button>

      <span className={"time-label" + (disabled ? " is-empty" : "")}>
        {formatTime(time)} / {formatTime(duration)}
      </span>
    </div>
  );
}
