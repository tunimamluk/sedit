import { Icon } from "./Icon.jsx";
import { formatTime } from "../lib/time.js";

/* Crop lives on the preview itself now, so this is purely playback. */
export function Transport({ playing, onTogglePlay, time, duration }) {
  return (
    <div className="transport">
      <button className="icon-btn" onClick={onTogglePlay} title="Play / Pause (Space)">
        <Icon name={playing ? "pause" : "play"} size={17} />
      </button>

      <span className="time-label">
        {formatTime(time)} / {formatTime(duration)}
      </span>
    </div>
  );
}
