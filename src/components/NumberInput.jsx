import { useEffect, useRef, useState } from "react";
import { clamp } from "../lib/time.js";

/* A number box you can actually type into.

   The obvious way to write a controlled number input is to parse and clamp on
   every change. That makes the field fight you: typing "5" into a box whose
   minimum is 0.1 is fine, but clearing it first gives "", which parses to NaN,
   falls back to the minimum, and rewrites the box to "0.1" -- so the rest of
   what you type lands after it and you get "0.15". Any field with a minimum
   above the first digit you type does the same thing.

   So while the box has focus it holds exactly the text you typed and nothing
   else touches it. Parsing and clamping happen once, on Enter or blur. Escape
   abandons the edit, and an empty or unparseable box reverts rather than
   snapping to a bound. */
export function NumberInput({
  value,
  min = -Infinity,
  max = Infinity,
  step = 1,
  decimals = 2,
  onChange,
  className,
  steppers = false,
  presets,
  id,
  title,
}) {
  const [draft, setDraft] = useState(null);
  // Escape clears the draft and blurs, but blur runs commit(), which would
  // read the pre-clear draft out of its closure and commit the very value
  // Escape just discarded. A ref settles it synchronously.
  const cancelling = useRef(false);
  // Two nudges inside one tick would both read the same `value` prop and land
  // on the same number. Remember what was last asked for until the prop
  // catches up, so a run of them accumulates.
  const pending = useRef(null);
  useEffect(() => {
    pending.current = null;
  }, [value]);

  const shown = () => {
    const p = Math.pow(10, decimals);
    return String(Math.round(value * p) / p);
  };

  const commit = (raw) => {
    const v = parseFloat(raw);
    if (!Number.isNaN(v)) onChange(clamp(v, min, max));
    setDraft(null);
  };

  const nudge = (dir) => {
    const base = pending.current != null ? pending.current : value;
    const next = clamp(base + dir * step, min, max);
    pending.current = next;
    setDraft(null);
    onChange(next);
  };

  const input = (
    <input
      className={className || (steppers ? "numfield-input" : "prop-input")}
      type="text"
      inputMode="decimal"
      list={presets ? id : undefined}
      title={title}
      value={draft != null ? draft : shown()}
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
          nudge(e.key === "ArrowUp" ? 1 : -1);
        }
      }}
    />
  );

  const list = presets ? (
    <datalist id={id}>
      {presets.map((p) => (
        <option key={p} value={p} />
      ))}
    </datalist>
  ) : null;

  if (!steppers) {
    return (
      <>
        {input}
        {list}
      </>
    );
  }

  return (
    <div className="numfield" title={title}>
      <button className="numfield-btn" onClick={() => nudge(-1)} disabled={value <= min}>
        &minus;
      </button>
      {input}
      {list}
      <button className="numfield-btn" onClick={() => nudge(1)} disabled={value >= max}>
        +
      </button>
    </div>
  );
}
