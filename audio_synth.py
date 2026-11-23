"""Deterministic chiptune-ish preview synthesis.

Every demo track gets a short instrumental "preview" generated from a hash of
its track id, so playback works fully offline (like Spotify's 30s previews,
but synthesized). Results are cached as WAV files under .cache/audio/.
"""

from __future__ import annotations

import hashlib
import io
import math
import random
import wave
from array import array
from pathlib import Path

SR = 16000  # sample rate (mono)
SECONDS = 12.0
TABLE_SIZE = 4096
_TABLE = [math.sin(2 * math.pi * i / TABLE_SIZE) for i in range(TABLE_SIZE)]
_MASK = TABLE_SIZE - 1

CACHE_DIR = Path(__file__).resolve().parent / ".cache" / "audio"

PENTA_MINOR = [0, 3, 5, 7, 10]
PENTA_MAJOR = [0, 2, 4, 7, 9]
PROGRESSIONS = [(0, 3, 4, 3), (0, 4, 3, 4), (0, 2, 4, 3), (0, 3, 1, 4), (0, 5, 3, 4)]


def _seed(track_id: str) -> int:
    return int(hashlib.sha256(track_id.encode()).hexdigest()[:16], 16)


def _sine(phase: float) -> float:
    return _TABLE[int(phase) & _MASK]


def _render(track_id: str) -> bytes:
    rng = random.Random(_seed(track_id))
    bpm = rng.choice([82, 90, 96, 104, 112, 120])
    beat = 60.0 / bpm
    bar = 4 * beat
    root = rng.choice([110.0, 123.47, 130.81, 146.83, 164.81])
    scale = PENTA_MINOR if rng.random() < 0.6 else PENTA_MAJOR
    prog = rng.choice(PROGRESSIONS)
    noise = [rng.uniform(-1.0, 1.0) for _ in range(4096)]

    def freq(deg: int, octave: int = 0) -> float:
        semis = scale[deg % 5] + 12 * (deg // 5) + 12 * octave
        return root * (2.0 ** (semis / 12.0))

    n = int(SECONDS * SR)
    mix = [0.0] * n
    bar_count = int(SECONDS / bar) + 1

    # --- pad: detuned chord swells, one per bar -------------------------
    for b in range(bar_count):
        start = int(b * bar * SR)
        end = min(n, int((b + 1) * bar * SR))
        if start >= n:
            break
        deg = prog[b % 4]
        chord = [freq(deg), freq(deg + 2) * 1.003, freq(deg + 4) * 0.997]
        span = max(1, end - start)
        attack = int(span * 0.25)
        release = int(span * 0.30)
        phases = [0.0, 0.0, 0.0]
        incs = [c * TABLE_SIZE / SR for c in chord]
        for i in range(start, end):
            j = i - start
            env = min(1.0, j / max(1, attack)) * min(1.0, (span - j) / max(1, release))
            s = 0.0
            for k in range(3):
                phases[k] += incs[k]
                s += _sine(phases[k])
            mix[i] += s * env * 0.055

    # --- bass: plucked eighth notes on the chord root -------------------
    eighth = beat / 2.0
    bass_pat = rng.choice([[0, None, 0, None, 12, None, 0, None],
                           [0, 0, None, 0, None, 12, None, 0],
                           [0, None, None, 7, 0, None, 12, None]])
    for b in range(bar_count):
        deg = prog[b % 4]
        for slot in range(8):
            off = bass_pat[slot]
            if off is None:
                continue
            start = int((b * bar + slot * eighth) * SR)
            if start >= n:
                continue
            f = freq(deg, -1) * (2.0 if off >= 12 else 1.0)
            inc = f * TABLE_SIZE / SR
            ln = min(n - start, int(0.42 * SR))
            ph = 0.0
            for j in range(ln):
                ph += inc
                t = j / SR
                mix[start + j] += _sine(ph) * math.exp(-t * 7.0) * 0.42

    # --- melody: seeded random walk on the pentatonic scale -------------
    deg_walk = rng.randint(3, 6)
    for b in range(bar_count):
        for slot in range(8):
            if rng.random() < 0.45:
                continue
            deg_walk = max(0, min(9, deg_walk + rng.choice([-2, -1, -1, 1, 1, 2, 3])))
            start = int((b * bar + slot * eighth) * SR)
            if start >= n:
                continue
            f = freq(deg_walk, 1)
            inc = f * TABLE_SIZE / SR
            ln = min(n - start, int(0.5 * SR))
            ph = 0.0
            for j in range(ln):
                ph += inc
                t = j / SR
                mix[start + j] += _sine(ph) * math.exp(-t * 5.0) * 0.22

    # --- kick: pitched sine drop on every beat --------------------------
    total_beats = int(SECONDS / beat) + 1
    for b in range(total_beats):
        start = int(b * beat * SR)
        ln = min(n - start, int(0.16 * SR))
        if ln <= 0:
            break
        ph = 0.0
        for j in range(ln):
            t = j / SR
            ph += (45.0 + 75.0 * math.exp(-t * 22.0)) * TABLE_SIZE / SR
            mix[start + j] += _sine(ph) * math.exp(-t * 9.0) * 0.65

    # --- hats: filtered noise on off-beats ------------------------------
    hat_every = 1 if bpm >= 100 else 2
    total_slots = int(SECONDS / eighth) + 1
    for s in range(total_slots):
        if s % 2 != 1 and (s % 2 != 0 or s % (2 * hat_every) != 0):
            continue
        start = int(s * eighth * SR)
        ln = min(n - start, int(0.05 * SR))
        if ln <= 0:
            break
        gain = 0.055 if s % 2 == 1 else 0.03
        idx = 0
        for j in range(ln):
            t = j / SR
            idx = (idx + 7) & 4095
            mix[start + j] += noise[idx] * math.exp(-t * 130.0) * gain

    # --- master: soft clip, fades, normalize ----------------------------
    fade = int(0.08 * SR)
    peak = 0.001
    for i in range(n):
        v = math.tanh(mix[i])
        if i < fade:
            v *= i / fade
        elif i > n - fade:
            v *= (n - i) / fade
        mix[i] = v
        av = abs(v)
        if av > peak:
            peak = av
    scale_out = 0.89 / peak
    pcm = array("h", (int(max(-1.0, min(1.0, v * scale_out)) * 32767) for v in mix))

    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


def preview_wav(track_id: str) -> bytes:
    """Return WAV bytes for a track's synthesized preview (disk-cached)."""
    safe = "".join(c for c in track_id if c.isalnum() or c in "_-")
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{safe}.wav"
    if not path.exists():
        path.write_bytes(_render(track_id))
    return path.read_bytes()


def prewarm(track_ids, done_flag=None):
    """Generate previews in the background so first plays are instant."""
    for tid in track_ids:
        try:
            preview_wav(tid)
        except Exception:
            pass
