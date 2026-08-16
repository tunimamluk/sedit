/* Which export formats exist depends on the browser, so the menu is built
   from whatever MediaRecorder actually reports as supported. */

export const VIDEO_FORMATS = [
  { label: "MP4 (H.264)", mime: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", ext: "mp4" },
  { label: "MP4 (H.264)", mime: "video/mp4", ext: "mp4" },
  { label: "WebM (VP9)", mime: "video/webm;codecs=vp9,opus", ext: "webm" },
  { label: "WebM (VP8)", mime: "video/webm;codecs=vp8,opus", ext: "webm" },
  { label: "WebM", mime: "video/webm", ext: "webm" },
];

export const AUDIO_FORMATS = [
  { label: "MP4 audio (AAC)", mime: "audio/mp4", ext: "m4a" },
  { label: "Opus audio", mime: "audio/webm;codecs=opus", ext: "webm" },
  { label: "WebM audio", mime: "audio/webm", ext: "webm" },
];

export function supportedFormats(onlyAudio) {
  const list = onlyAudio ? AUDIO_FORMATS : VIDEO_FORMATS;
  const seen = new Set();
  const out = [];
  for (const f of list) {
    if (typeof MediaRecorder === "undefined") break;
    if (!MediaRecorder.isTypeSupported(f.mime)) continue;
    if (seen.has(f.label)) continue; // keep the most specific variant only
    seen.add(f.label);
    out.push(f);
  }
  return out;
}

export function findFormat(mime, onlyAudio) {
  const all = [...VIDEO_FORMATS, ...AUDIO_FORMATS];
  return all.find((f) => f.mime === mime) || supportedFormats(onlyAudio)[0] || { mime: "", ext: "webm" };
}
