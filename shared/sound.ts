import { useEffect, useMemo, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';

/**
 * A pool of players so the same short sound can overlap itself
 * (rapid taps would otherwise cut each other off).
 * `play(i)` plays variant i; omit it for a random variant.
 */
export function useSoundPool(sources: AudioSource[], voices = 6) {
  const players = useRef<AudioPlayer[][]>([]);
  const cursor = useRef<number[]>([]);
  const muted = useRef(false);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
    players.current = sources.map((src) => Array.from({ length: voices }, () => createAudioPlayer(src)));
    cursor.current = sources.map(() => 0);
    return () => {
      players.current.flat().forEach((p) => p.remove());
      players.current = [];
    };
    // sources are static requires
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(
    () => ({
      play(i?: number) {
        if (muted.current || players.current.length === 0) return;
        const v = i ?? Math.floor(Math.random() * players.current.length);
        const voicesFor = players.current[v];
        const p = voicesFor[cursor.current[v]];
        cursor.current[v] = (cursor.current[v] + 1) % voicesFor.length;
        try {
          p.seekTo(0);
          p.play();
        } catch {}
      },
      setMuted(m: boolean) {
        muted.current = m;
      },
    }),
    [],
  );
}
