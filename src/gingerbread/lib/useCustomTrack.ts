import { useCallback, useEffect, useRef, useState } from 'react';
import { bakeryAudio } from './audio';
import { formatBytes, getTrack, probeDuration, putTrack, validateAudioFile } from './tracks';
import type { TrackMeta } from './tracks';

export type TrackMode = 'synth' | 'custom';
export type CustomStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface UseCustomTrackArgs {
  enabled: boolean;
  volume: number;
  mode: TrackMode;
  trackId: string | null;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  library: TrackMeta[];
  onLibraryChange: (next: TrackMeta[]) => void;
  onTrackSelect: (id: string) => void;
  onError?: (message: string) => void;
}

const objectUrls = new Map<string, string>();

export function releaseTrackUrl(id: string) {
  const url = objectUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(id);
}

/**
 * Owns the single <audio> element used for custom soundtracks. It fetches the
 * blob from IndexedDB, loads it into the element, routes the element through
 * the shared Web Audio graph (so the music slider and dialog ducking apply) and
 * advances through the library on `ended`.
 */
export function useCustomTrack({
  enabled,
  volume,
  mode,
  trackId,
  shuffle,
  repeat,
  library,
  onLibraryChange,
  onTrackSelect,
  onError,
}: UseCustomTrackArgs) {
  const elRef = useRef<HTMLAudioElement | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<CustomStatus>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loadedRef = useRef<string | null>(null);
  const loadingRef = useRef<{ id: string; promise: Promise<void> } | null>(null);
  const requestedRef = useRef<string | null>(null);
  const loadedTrack = loadedId ? library.find((t) => t.id === loadedId) ?? null : null;
  const active = mode === 'custom' && enabled;

  const getEl = useCallback(() => {
    if (typeof document === 'undefined') return null;
    if (!elRef.current) {
      const el = document.createElement('audio');
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      el.setAttribute('data-gingerbread-track', '');
      document.body.appendChild(el);
      elRef.current = el;
    }
    return elRef.current;
  }, []);

  /* ----------------------------------------------------------- loading */
  const load = useCallback(
    async (meta: TrackMeta) => {
      const el = getEl();
      if (!el) return;
      requestedRef.current = meta.id;
      if (loadedRef.current === meta.id) return;
      if (loadingRef.current?.id === meta.id) return loadingRef.current.promise;

      setStatus('loading');
      const pending = (async () => {
        try {
          const blob = await getTrack(meta.id);
          if (requestedRef.current !== meta.id) return;
          if (!blob) {
            onError?.('That track is no longer stored in this browser.');
            setStatus('error');
            return;
          }
          let url = objectUrls.get(meta.id);
          if (!url) {
            url = URL.createObjectURL(blob);
            objectUrls.set(meta.id, url);
          }
          bakeryAudio.attachMediaElement(el);
          if (el.src !== url) {
            el.src = url;
            el.load();
          }
          setDuration(meta.duration || 0);
          loadedRef.current = meta.id;
          setLoadedId(meta.id);
          setStatus('paused');
          setReady(true);
        } catch {
          onError?.('This browser could not open that track.');
          setStatus('error');
        }
      })();
      loadingRef.current = { id: meta.id, promise: pending };
      try {
        await pending;
      } finally {
        if (loadingRef.current?.promise === pending) loadingRef.current = null;
      }
    },
    [getEl, onError],
  );

  const unload = useCallback(() => {
    const el = elRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    loadedRef.current = null;
    requestedRef.current = null;
    setLoadedId(null);
    setStatus('idle');
    setCurrentTime(0);
    setDuration(0);
  }, []);

  /* ------------------------------------------------- loading library */
  useEffect(() => {
    if (!active) {
      const el = elRef.current;
      if (el) {
        el.pause();
        setStatus((s) => (s === 'playing' ? 'paused' : s));
      }
      return;
    }
    if (library.length === 0) {
      unload();
      return;
    }
    const wanted = library.find((t) => t.id === trackId) ?? library[0];
    if (loadedRef.current !== wanted.id) void load(wanted);
  }, [active, library, load, trackId, unload]);

  /* -------------------------------------------------- transport control */
  const play = useCallback(async () => {
    const el = getEl();
    if (!el) return false;
    if (!loadedRef.current) {
      const first = library.find((t) => t.id === trackId) ?? library[0];
      if (!first) return false;
      await load(first);
    }
    bakeryAudio.attachMediaElement(el);
    try {
      await el.play();
      setStatus('playing');
      return true;
    } catch {
      onError?.('Playback was blocked — press play again.');
      setStatus('error');
      return false;
    }
  }, [getEl, library, load, onError, trackId]);

  const pause = useCallback(() => {
    elRef.current?.pause();
    setStatus('paused');
  }, []);

  const toggle = useCallback(() => {
    const el = elRef.current;
    if (el && !el.paused) {
      pause();
      return Promise.resolve(false);
    }
    return play();
  }, [pause, play]);

  const skip = useCallback((direction: -1 | 1) => {
    if (library.length < 2) return;
    const index = library.findIndex((t) => t.id === loadedRef.current);
    const nextIndex = (index + direction + library.length) % library.length;
    const next = library[nextIndex];
    onTrackSelect(next.id);
    void load(next).then(() => {
      if (active) void elRef.current?.play().catch(() => undefined);
    });
  }, [active, library, load, onTrackSelect]);

  const stop = useCallback(() => {
    const el = elRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setCurrentTime(0);
    setStatus((s) => (s === 'idle' ? s : 'paused'));
  }, []);

  const seek = useCallback((secondsRatio: number) => {
    const el = elRef.current;
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return;
    el.currentTime = Math.min(el.duration - 0.05, Math.max(0, secondsRatio * el.duration));
    setCurrentTime(el.currentTime);
  }, []);

  /* --------------------------------------------- drive play/pause state */
  useEffect(() => () => {
    // Keep the singleton element around for StrictMode remounts, but never let
    // a track continue playing after the calendar itself unmounts.
    elRef.current?.pause();
  }, []);

  useEffect(() => {
    if (!active) {
      elRef.current?.pause();
      return;
    }
    const el = getEl();
    if (!el) return;
    if (!loadedRef.current) return;
    if (el.paused) {
      void el.play().then(
        () => setStatus('playing'),
        () => undefined,
      );
    }
  }, [active, getEl, loadedId]);

  /* ------------------------------------------------ media element events */
  useEffect(() => {
    const el = getEl();
    if (!el) return;

    const advance = (auto: boolean) => {
      const idx = library.findIndex((t) => t.id === loadedRef.current);
      if (repeat === 'one' && auto && idx >= 0) {
        el.currentTime = 0;
        void el.play().catch(() => undefined);
        return;
      }
      const next = shuffle && library.length > 1
        ? library.filter((t) => t.id !== loadedRef.current)[Math.floor(Math.random() * (library.length - 1))]
        : library[idx + 1];
      const target = next ?? (repeat === 'all' ? library[0] : undefined);
      if (target) {
        onTrackSelect(target.id);
        void load(target).then(() => elRef.current?.play().catch(() => undefined));
        return;
      }
      setStatus('paused');
    };

    const onTime = () => setCurrentTime(el.currentTime);
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onPlay = () => setStatus('playing');
    const onPause = () => setStatus((s) => (s === 'idle' || s === 'loading' ? s : 'paused'));
    const onEnded = () => advance(true);
    const onErr = () => {
      if (!loadedRef.current) return;
      setStatus('error');
      onError?.('That file could not be decoded here — try a different format.');
    };

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('durationchange', onMeta);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onErr);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('durationchange', onMeta);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onErr);
    };
  }, [getEl, library, load, onError, onTrackSelect, repeat, shuffle]);

  /* ---------------------------------------------------------- MediaSession */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    if (mode !== 'custom' || !loadedTrack) {
      session.metadata = null;
      return;
    }
    try {
      if (typeof MediaMetadata !== 'undefined') {
        session.metadata = new MediaMetadata({
          title: loadedTrack.name,
          artist: 'Gingerbread Calendar',
          album: 'Custom soundtrack',
        });
      }
    } catch { /* Media Session is optional */ }

    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => { void play(); }],
      ['pause', pause],
      ['previoustrack', () => skip(-1)],
      ['nexttrack', () => skip(1)],
      ['seekto', (details) => {
        if (details.seekTime !== undefined && duration > 0) seek(details.seekTime / duration);
      }],
    ];
    for (const [action, handler] of handlers) {
      try { session.setActionHandler(action, handler); } catch { /* unsupported action */ }
    }
    return () => {
      for (const [action] of handlers) {
        try { session.setActionHandler(action, null); } catch { /* unsupported action */ }
      }
    };
  }, [duration, loadedTrack, mode, pause, play, seek, skip]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;
    try {
      session.playbackState = mode !== 'custom' ? 'none' : status === 'playing' ? 'playing' : status === 'idle' ? 'none' : 'paused';
      if (duration > 0 && typeof session.setPositionState === 'function') {
        session.setPositionState({ duration, playbackRate: 1, position: Math.min(currentTime, duration) });
      }
    } catch { /* optional browser integration */ }
  }, [currentTime, duration, mode, status]);

  /* ------------------------------------------------------------ volume */
  useEffect(() => {
    bakeryAudio.setTrackVolume(volume);
    const el = elRef.current;
    if (el) el.muted = volume === 0;
  }, [volume]);

  /* -------------------------------------------------- add files to library */
  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      const accepted: TrackMeta[] = [];
      for (const file of list) {
        const problem = validateAudioFile(file);
        if (problem) {
          onError?.(problem);
          continue;
        }
        const id = `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
        const duration = await probeDuration(file);
        if (!duration) {
          onError?.(`“${file.name}” couldn't be read by this browser — try an MP3.`);
          continue;
        }
        try {
          await putTrack(id, file);
        } catch {
          onError?.(`Could not store “${file.name}” — browser storage may be full.`);
          continue;
        }
        accepted.push({
          id,
          name: file.name.replace(/\.[^.]+$/, ''),
          type: file.type || 'audio/*',
          size: file.size,
          duration,
          addedAt: Date.now(),
        });
      }
      if (accepted.length) onLibraryChange([...library, ...accepted]);
      return accepted;
    },
    [library, onError, onLibraryChange],
  );

  return {
    ready,
    status,
    currentTime,
    duration: duration || loadedTrack?.duration || 0,
    loadedTrack,
    loadedId,
    play,
    pause,
    toggle,
    stop,
    previous: () => skip(-1),
    next: () => skip(1),
    seek,
    load,
    unload,
    addFiles,
    sizeLabel: loadedTrack ? formatBytes(loadedTrack.size) : '',
    currentTrackId: loadedId,
  };
}
