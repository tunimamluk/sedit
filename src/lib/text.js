/* Text layers.

   Sizes are a percentage of the frame height rather than pixels, so a title
   keeps its proportions if the output frame changes. The panel shows it in
   pixels of the current frame, which is the number that actually means
   something while you are editing. */

export const FONTS = [
  { label: "Outfit", stack: '"Outfit", system-ui, sans-serif' },
  { label: "Unbounded", stack: '"Unbounded", system-ui, sans-serif' },
  { label: "System sans", stack: '-apple-system, "Helvetica Neue", Arial, sans-serif' },
  { label: "Georgia", stack: 'Georgia, "Times New Roman", serif' },
  { label: "Courier", stack: '"Courier New", Courier, monospace' },
  { label: "Impact", stack: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif' },
];

export const DEFAULT_FONT = FONTS[0].stack;

/** Sizes a caption actually wants, in pixels of a 1080-tall frame. */
export const SIZE_PRESETS = [16, 24, 32, 40, 48, 64, 80, 96, 128, 160];

export const TEXT_SWATCHES = [
  "#ffffff", "#000000", "#ff7a1a", "#ffd233",
  "#3ddc84", "#4aa8ff", "#b06bff", "#ff4d6d",
];

/* The box behind the text. Its measurements are percentages of the frame
   height like the font size is, so a caption keeps its proportions whatever
   the output frame turns out to be; the panel shows them in pixels. */
export const BOX_DEFAULTS = {
  fill: "#000000",
  borderColor: "#ffffff",
  borderWidth: 0.4,     // ~3px at 720
};

export const textDefaults = () => ({
  text: "Your text here",
  color: "#ffffff",
  fontSize: 7,          // percent of frame height
  fontFamily: DEFAULT_FONT,
  bold: true,
  italic: false,
  underline: false,
  align: "left",
  shadow: true,
  /* The box is off to begin with. Whether it is on is its own flag rather
     than a null colour or a zero width, so switching it off and on again
     brings back the colour and thickness you had chosen. */
  fillOn: false,
  boxFill: BOX_DEFAULTS.fill,
  borderOn: false,
  borderColor: BOX_DEFAULTS.borderColor,
  borderWidth: BOX_DEFAULTS.borderWidth,
  padding: 1.4,
  radius: 0.8,
});

/** Percentage of frame height -> pixels on the canvas. */
export const ofHeight = (pct, frameH) => ((pct || 0) / 100) * frameH;

/** The css font shorthand for a text layer at pixel size `px`. */
export function fontString(l, px) {
  const style = l.italic ? "italic " : "";
  const weight = l.bold ? "700" : "400";
  return style + weight + " " + px + "px " + (l.fontFamily || DEFAULT_FONT);
}

/** First line of the content, for labelling the clip on the timeline. */
export function textLabel(l) {
  const first = String(l.text || "").split("\n").find((s) => s.trim()) || "";
  const trimmed = first.trim();
  if (!trimmed) return "Empty text";
  return trimmed.length > 40 ? trimmed.slice(0, 40) + "…" : trimmed;
}
