import { useEffect, useMemo, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';

type Voice = {
  p: AudioPlayer;
  /** rewound to 0 and free to play right now */
  ready: boolean;
  startedAt: number;
  sub?: { remove(): void };
};

const MIN_GAP_MS = 22; // faster than this and pops blur together anyway
const STALE_MS = 1000; // our clips are ~0.1s; a voice "busy" this long missed its finish event

/**
 * A pool of players so short sounds can overlap themselves.
 * Each voice rewinds itself in the background the moment it finishes, so a pop never waits
 * on a rewind. `play(i)` prefers variant i (random if omitted) but takes any free voice.
 */
export function useSoundPool(sources: AudioSource[], voices = 8) {
  const pool = useRef<Voice[][]>([]);
  const muted = useRef(false);
  const last = useRef(0);

  useEffect(() => {
    // The app's own "Sound on/off" decides, so play even when the iPhone is on silent,
    // and mix with whatever music is already playing instead of stopping it.
    setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
    pool.current = sources.map((src) =>
      Array.from({ length: voices }, () => {
        const v: Voice = { p: createAudioPlayer(src), ready: true, startedAt: 0 };
        v.sub = v.p.addListener('playbackStatusUpdate', (st) => {
          if (st.didJustFinish) rewind(v);
        });
        return v;
      }),
    );
    return () => {
      pool.current.flat().forEach((v) => {
        v.sub?.remove();
        v.p.remove();
      });
      pool.current = [];
    };
    // sources are static requires
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useMemo(
    () => ({
      play(i?: number) {
        const groups = pool.current;
        if (muted.current || groups.length === 0) return;
        const now = Date.now();
        if (now - last.current < MIN_GAP_MS) return;

        const first = i ?? Math.floor(Math.random() * groups.length);
        const order = [first, ...groups.map((_, k) => k).filter((k) => k !== first)];

        // 1) a voice that's rewound and idle: play instantly
        for (const k of order) {
          const v = groups[k].find((x) => x.ready && !x.p.playing && x.p.isLoaded !== false);
          if (v) return start(v, now);
        }
        // 2) a voice that finished but never got its finish event: rewind, then play
        for (const k of order) {
          const v = groups[k].find((x) => !x.p.playing && now - x.startedAt > STALE_MS);
          if (v) {
            v.ready = false;
            v.startedAt = now;
            last.current = now;
            v.p
              .seekTo(0)
              .then(() => v.p.play())
              .catch(() => {});
            return;
          }
        }
        // 3) everything is busy (very fast multi-finger popping): skip this one
      },
      setMuted(m: boolean) {
        muted.current = m;
      },
    }),
    [],
  );

  function start(v: Voice, now: number) {
    v.ready = false;
    v.startedAt = now;
    last.current = now;
    try {
      v.p.play();
    } catch {
      v.ready = true;
    }
  }
}

function rewind(v: Voice) {
  v.p
    .seekTo(0)
    .then(() => (v.ready = true))
    .catch(() => (v.ready = true));
}
