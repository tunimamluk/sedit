/* Media plumbing: the HTMLMediaElements themselves, plus the WebAudio graph
   used *only* for export.

   Playback deliberately does not go through WebAudio. Routing an element
   through createMediaElementSource permanently redirects its output into the
   graph, so any failure there (a suspended context, no output device, a
   throwing constructor) silences playback entirely. Volume and mute are set
   directly on the element instead, and the graph is built lazily at export
   time -- still connected to the speakers, so you keep hearing it. */

let audioCtx = null;

export function getAudioCtx() {
  if (!audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    try {
      audioCtx = new Ctor();
    } catch {
      return null; // no output device, or blocked
    }
  }
  return audioCtx;
}

export function resumeAudio() {
  const ac = getAudioCtx();
  if (ac && ac.state === "suspended") ac.resume().catch(() => {});
  return ac;
}

export function createMediaStore() {
  return { elements: {}, gains: {}, sources: {}, urls: {} };
}

/** Volume/mute straight on the element -- no graph involved. */
export function applyLevel(store, id, { volume, muted }) {
  const el = store.elements[id];
  if (!el || el.volume === undefined) return;
  el.muted = !!muted;
  el.volume = Math.max(0, Math.min(1, volume == null ? 1 : volume));
}

/** Build (once) the export tap for an element: source -> gain -> destination,
    plus whatever extra node the recorder wants. Returns the gain, or null if
    WebAudio is unavailable -- callers must tolerate that. */
export function exportGain(store, id) {
  if (store.gains[id]) return store.gains[id];
  const el = store.elements[id];
  const ac = getAudioCtx();
  if (!el || !ac) return null;
  try {
    const src = ac.createMediaElementSource(el);
    const gain = ac.createGain();
    src.connect(gain);
    gain.connect(ac.destination); // keep it audible while recording
    store.sources[id] = src;
    store.gains[id] = gain;
    return gain;
  } catch {
    return null; // already routed, or unsupported
  }
}

export function disposeMedia(store, id) {
  const el = store.elements[id];
  if (el && el.pause) el.pause();
  const g = store.gains[id];
  if (g) {
    try {
      g.disconnect();
    } catch {
      /* already disconnected */
    }
  }
  if (store.urls[id]) URL.revokeObjectURL(store.urls[id]);
  delete store.elements[id];
  delete store.gains[id];
  delete store.sources[id];
  delete store.urls[id];
}
