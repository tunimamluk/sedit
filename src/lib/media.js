/* Owns the non-React side of media: the HTMLMediaElements themselves and the
   WebAudio graph used for per-layer volume and for tapping audio into the
   export recorder. Kept out of React state because these are live objects,
   not data. */

let audioCtx = null;

export function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

export function resumeAudio() {
  const ac = getAudioCtx();
  if (ac.state === "suspended") ac.resume();
  return ac;
}

/** Route a media element through a gain node we can control and tap. */
export function attachAudioGraph(store, id, element, layer) {
  if (store.gains[id] || !element) return;
  try {
    const ac = getAudioCtx();
    const src = ac.createMediaElementSource(element);
    const gain = ac.createGain();
    gain.gain.value = layer.muted ? 0 : layer.volume;
    src.connect(gain);
    gain.connect(ac.destination);
    store.sources[id] = src;
    store.gains[id] = gain;
  } catch {
    /* already connected, or unsupported */
  }
}

export function setGain(store, id, value) {
  const g = store.gains[id];
  if (g) g.gain.value = value;
}

export function createMediaStore() {
  return { elements: {}, gains: {}, sources: {}, urls: {} };
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
