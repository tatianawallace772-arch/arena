import { useCallback, useEffect, useRef } from 'react';
import { bakeryAudio, type SfxName } from './audio';
import type { AudioMood, Settings } from './types';

interface AudioSettings {
  soundOn: boolean;
  sfxVolume: number;
  musicOn: boolean;
  musicVolume: number;
  mood: AudioMood;
  trackMode: Settings['trackMode'];
}

/**
 * Keeps the Web Audio engine in sync with the user's saved settings and
 * exposes a `sfx()` helper that respects the mute switch.
 */
export function useCalendarAudio(settings: Settings) {
  const settingsRef = useRef<AudioSettings>(settings);

  useEffect(() => {
    settingsRef.current = settings;
    bakeryAudio.setSfxVolume(settings.sfxVolume);
    bakeryAudio.setMusicVolume(settings.musicVolume);
    bakeryAudio.setMood(settings.mood);

    if (settings.musicOn && settings.trackMode === 'synth') {
      bakeryAudio.startMusic(settings.mood);
    } else {
      bakeryAudio.stopMusic();
    }
  }, [settings]);

  // Never leave a loop running after unmount.
  useEffect(() => () => bakeryAudio.stopMusic(), []);

  const sfx = useCallback((name: SfxName) => {
    const s = settingsRef.current;
    if (!s.soundOn) return;
    bakeryAudio.play(name);
  }, []);

  /** Browsers need a gesture before audio may start — used on first interaction. */
  const unlock = useCallback(() => {
    const s = settingsRef.current;
    if (s.musicOn && s.trackMode === 'synth') bakeryAudio.startMusic(s.mood);
  }, []);

  return { sfx, unlock, toggleMusic: () => bakeryAudio.toggleMusic(settings.mood) };
}
