import { BrandMark, Icon } from "./Icon.jsx";

export function TopBar({
  theme,
  onToggleTheme,
  filename,
  onFilenameChange,
  formats,
  format,
  onFormatChange,
  onExport,
  exporting,
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark />
        <span className="brand-name">Sedit</span>
      </div>

      <div className="topbar-actions">
        <button
          className="icon-btn icon-btn-sm"
          onClick={onToggleTheme}
          title={theme === "light" ? "Switch to dark" : "Switch to light"}
        >
          <Icon name={theme === "light" ? "moon" : "sun"} size={15} />
        </button>

        <input
          className="filename-input"
          type="text"
          value={filename}
          spellCheck={false}
          onChange={(e) => onFilenameChange(e.target.value)}
        />

        <select
          className="select"
          title="Export format"
          value={format}
          disabled={formats.length === 0}
          onChange={(e) => onFormatChange(e.target.value)}
        >
          {formats.length === 0 ? (
            <option>No format available</option>
          ) : (
            formats.map((f) => (
              <option key={f.mime} value={f.mime}>
                {f.label}
              </option>
            ))
          )}
        </select>

        <button className="btn btn-primary" onClick={onExport} disabled={exporting}>
          Export
        </button>
      </div>
    </header>
  );
}
