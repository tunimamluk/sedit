/* Inline stroked SVG rather than emoji: emoji render differently on every
   platform, carry their own colour, and can't inherit the theme. */

const PATHS = {
  video: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M10.2 9.6v4.8l4.2-2.4z" fill="currentColor" stroke="none" />
    </>
  ),
  audio: (
    <>
      <path d="M9 17V4.8l10-1.8V15" />
      <circle cx="6.6" cy="17.4" r="2.6" />
      <circle cx="16.6" cy="15.4" r="2.6" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3.5" width="18" height="17" rx="2.5" />
      <circle cx="8.6" cy="9.2" r="1.6" />
      <path d="m3.6 17.5 5-4.6 4.5 4.2 3-2.6 4.3 3.9" />
    </>
  ),
  text: (
    <>
      <path d="M5 7.5V5.5h14v2" />
      <path d="M12 5.5v13" />
      <path d="M9 18.5h6" />
    </>
  ),
  eye: (
    <>
      <path d="M2.2 12S5.9 5.6 12 5.6 21.8 12 21.8 12 18.1 18.4 12 18.4 2.2 12 2.2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M3.5 3.5 20.5 20.5" />
      <path d="M10.3 5.9A9.6 9.6 0 0 1 12 5.6c6.1 0 9.8 6.4 9.8 6.4a18.7 18.7 0 0 1-3.3 4.1" />
      <path d="M6.9 7.2A18.4 18.4 0 0 0 2.2 12S5.9 18.4 12 18.4a9.5 9.5 0 0 0 3.7-.8" />
    </>
  ),
  up: <path d="m6.5 14.5 5.5-5.5 5.5 5.5" />,
  down: <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />,
  trash: <path d="M3.8 6.3h16.4M9.3 6.3V4.2h5.4v2.1M6.3 6.3l1 13.5h9.4l1-13.5" />,
  play: <path d="M7.5 4.6 19 12 7.5 19.4z" fill="currentColor" stroke="none" />,
  pause: <path d="M9 4.6v14.8M15 4.6v14.8" strokeWidth="2.2" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6 6 18M18 6l1.6-1.6" />
    </>
  ),
  moon: <path d="M20.8 13.4A8.6 8.6 0 1 1 10.6 3.2a6.8 6.8 0 0 0 10.2 10.2Z" />,
  crop: (
    <>
      <path d="M6.2 2.8v14.4a1 1 0 0 0 1 1h14.4" />
      <path d="M2.6 6.2h14a1 1 0 0 1 1 1v14" />
    </>
  ),
  check: <path d="m4.8 12.4 5 5 9.4-10.2" strokeWidth="2.1" />,
  close: <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" strokeWidth="2" />,
  center: (
    <>
      <rect x="8.2" y="8.2" width="7.6" height="7.6" rx="1.4" />
      <path d="M12 2.8v3.2M12 18v3.2M2.8 12H6M18 12h3.2" />
    </>
  ),
  undo: (
    <>
      <path d="M3.6 8.4h10.2a5.8 5.8 0 0 1 0 11.6H7.4" />
      <path d="m7.4 4 -3.8 4.4L7.4 12.6" />
    </>
  ),
};

export function Icon({ name, size = 16, className = "" }) {
  return (
    <span className={"icon " + className} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {PATHS[name]}
      </svg>
    </span>
  );
}

/* Drawn to match Unbounded rather than the UI icon set: wide proportions, a
   heavy stroke against the wordmark's weight, and a large rounded aperture
   echoing the typeface's generous counters. */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
      <rect
        x="1.4"
        y="4"
        width="21.2"
        height="16"
        rx="5.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
      />
      <path
        d="M9.9 8.6 15.8 12 9.9 15.4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
