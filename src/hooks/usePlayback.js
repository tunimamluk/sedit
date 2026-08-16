import { useCallback, useEffect, useRef, useState } from "react";
import { isLayerActive, layerLocalTime, layerSpeed } from "../lib/time.js";
import { resumeAudio } from "../lib/media.js";

/* The playback engine.

   Everything the rAF loop touches is held in refs, so the loop never reads a
   stale closure and never needs to be torn down and rebuilt mid-play.
   `playhead` is React state so the UI can follow it; the loop's live time is
   passed to onFrame directly, because state lags a frame behind. */

export function usePlayback({ layersRef, mediaRef, trimRef, onFrame, onEnd }) {
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);

  const playheadRef = useRef(0);
  const playingRef = useRef(false);
  const rafRef = useRef(null);
  const startWallRef = useRef(0);
  const startCompRef = useRef(0);

  const commit = useCallback((t) => {
    playheadRef.current = t;
    setPlayhead(t);
  }, []);

  const compTime = useCallback(() => {
    if (!playingRef.current) return playheadRef.current;
    return startCompRef.current + (performance.now() - startWallRef.current) / 1000;
  }, []);

  /** Park every media element at composition time `t` without playing. */
  const seek = useCallback(
    (t) => {
      const media = mediaRef.current;
      for (const l of layersRef.current) {
        const el = media[l.id];
        if (!el || !el.pause) continue;
        el.pause();
        if (isLayerActive(l, t)) {
          const target = layerLocalTime(l, t);
          if (Math.abs(el.currentTime - target) > 0.02) {
            try {
              el.currentTime = target;
            } catch {
              /* not seekable yet */
            }
          }
        }
      }
      commit(t);
      onFrame(t);
    },
    [layersRef, mediaRef, commit, onFrame]
  );

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    const media = mediaRef.current;
    for (const l of layersRef.current) {
      const el = media[l.id];
      if (el && el.pause) el.pause();
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, [layersRef, mediaRef]);

  const pause = useCallback(() => {
    const t = compTime();
    stop();
    commit(t);
    onFrame(t);
  }, [compTime, stop, commit, onFrame]);

  const tick = useCallback(() => {
    if (!playingRef.current) return;
    const { trimOut } = trimRef.current;
    const t = compTime();

    if (t >= trimOut) {
      stop();
      commit(trimOut);
      onFrame(trimOut);
      onEnd && onEnd();
      return;
    }

    const media = mediaRef.current;
    for (const l of layersRef.current) {
      const el = media[l.id];
      if (!el || !el.play) continue;
      if (isLayerActive(l, t)) {
        const target = layerLocalTime(l, t);
        if (el.paused) {
          try {
            el.currentTime = target;
          } catch {
            /* not seekable yet */
          }
          el.play().catch(() => {});
        } else if (Math.abs(el.currentTime - target) > 0.25) {
          try {
            el.currentTime = target;
          } catch {
            /* not seekable yet */
          }
        }
        el.playbackRate = layerSpeed(l);
      } else if (!el.paused) {
        el.pause();
      }
    }

    commit(t);
    onFrame(t);
    rafRef.current = requestAnimationFrame(tick);
  }, [compTime, trimRef, layersRef, mediaRef, stop, commit, onFrame, onEnd]);

  const play = useCallback(() => {
    if (layersRef.current.length === 0) return false;
    resumeAudio();

    const { trimIn, trimOut } = trimRef.current;
    let start = playheadRef.current;
    if (start >= trimOut - 0.01) start = trimIn;

    playingRef.current = true;
    setPlaying(true);
    startWallRef.current = performance.now();
    startCompRef.current = start;
    playheadRef.current = start;

    const media = mediaRef.current;
    for (const l of layersRef.current) {
      const el = media[l.id];
      if (!el || !el.play) continue;
      if (isLayerActive(l, start)) {
        // Only seek if it is actually somewhere else. Resuming after a pause
        // lands on the position the element already holds, and a redundant
        // seek flushes the decoder -- which shows as a black flash.
        const target = layerLocalTime(l, start);
        if (Math.abs(el.currentTime - target) > 0.05) {
          try {
            el.currentTime = target;
          } catch {
            /* not seekable yet */
          }
        }
        el.playbackRate = layerSpeed(l);
        el.play().catch(() => {});
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return true;
  }, [layersRef, mediaRef, trimRef, tick]);

  const toggle = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [play, pause]);

  useEffect(() => () => rafRef.current && cancelAnimationFrame(rafRef.current), []);

  return { playing, playhead, playheadRef, playingRef, compTime, play, pause, toggle, seek, stop };
}
