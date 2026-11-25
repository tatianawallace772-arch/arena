/**
 * Custom soundtrack storage.
 *
 * Audio files are far too large for localStorage, so uploaded tracks are kept
 * as Blobs in IndexedDB. Only lightweight metadata (name, size, duration, sort
 * order) is persisted alongside the rest of the calendar settings.
 */

export interface TrackMeta {
  id: string;
  name: string;
  type: string;
  size: number;
  duration: number;
  addedAt: number;
}

export const ACCEPTED_AUDIO =
  'audio/*,.mp3,.m4a,.aac,.ogg,.oga,.opus,.wav,.flac,.weba,.webm';

/** Extensions we accept even when the browser does not report an audio type. */
const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac',
  ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav',
  flac: 'audio/flac', weba: 'audio/webm', webm: 'audio/webm',
};

/** Files up to this size are accepted (browser storage is finite). */
export const MAX_TRACK_BYTES = 25 * 1024 * 1024; // 25 MB

/** Formats we can confidently decode in every modern browser. */
export const SUPPORTED_MIME = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
  'audio/ogg',
  'audio/oga',
  'audio/opus',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/flac',
  'audio/x-flac',
  'audio/webm',
  'audio/weba',
]);

const DB_NAME = 'gingerbread-calendar';
const DB_VERSION = 1;
const STORE = 'tracks';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open storage'));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        let result: T;
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error ?? new Error('Storage error'));
        transaction.oncomplete = () => {
          db.close();
          resolve(result!);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error('Storage error'));
        };
        transaction.onabort = () => {
          db.close();
          reject(transaction.error ?? new Error('Storage transaction aborted'));
        };
      }),
  );
}

export async function putTrack(id: string, file: Blob): Promise<void> {
  await tx('readwrite', (store) => store.put(file, id) as IDBRequest<unknown> as IDBRequest<void>);
}

export async function getTrack(id: string): Promise<Blob | undefined> {
  return tx<Blob | undefined>('readonly', (store) => store.get(id) as IDBRequest<Blob | undefined>);
}

export async function deleteTrack(id: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(id) as IDBRequest<unknown> as IDBRequest<void>);
}

export async function listTrackIds(): Promise<string[]> {
  const keys = await tx<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
  return keys.map(String);
}

export async function clearTracks(): Promise<void> {
  await tx('readwrite', (store) => store.clear() as IDBRequest<unknown> as IDBRequest<void>);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '–:––';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Validate a user-picked file. Returns a human-readable problem, or null when
 * the file looks playable.
 */
export function validateAudioFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const type = (file.type || '').toLowerCase();
  const mime = SUPPORTED_MIME.has(type) ? type : MIME_BY_EXT[ext] || type;
  const knownAudio = SUPPORTED_MIME.has(mime);
  if (!knownAudio) {
    return `“${file.name}” isn’t a supported audio file. Try MP3, M4A, AAC, OGG, Opus, WAV or FLAC.`;
  }
  if (typeof document !== 'undefined' && !canPlayType(mime)) {
    return `This browser can’t play ${ext.toUpperCase()} files. Try an MP3 or another supported format.`;
  }
  if (file.size === 0) return `“${file.name}” is empty.`;
  if (file.size > MAX_TRACK_BYTES) {
    return `“${file.name}” is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_TRACK_BYTES)}.`;
  }
  return null;
}

/** Ask the browser's HTMLAudioElement which formats it can actually decode. */
export function canPlayType(mime: string): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.createElement('audio');
  return el.canPlayType(mime) !== '';
}

/** Read a file's duration (and detect unreadable files) without playing it. */
export function probeDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(0);
      return;
    }
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    let settled = false;
    let timeout = 0;
    const done = (value: number) => {
      if (settled) return;
      settled = true;
      if (timeout) window.clearTimeout(timeout);
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => done(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => done(0);
    timeout = window.setTimeout(() => done(Number.isFinite(audio.duration) ? audio.duration : 0), 8000);
    audio.src = url;
  });
}
