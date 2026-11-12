import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * useState that survives app restarts. `ready` is false until the stored value loads.
 * Every app namespaces its keys, e.g. useStoredState('bubble:stats', {...}).
 */
export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const latest = useRef(value);

  useEffect(() => {
    AsyncStorage.getItem(key)
      .then((raw) => {
        if (raw != null) {
          const parsed = { ...(initial as object), ...JSON.parse(raw) } as T;
          latest.current = parsed;
          setValue(parsed);
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(latest.current) : next;
      latest.current = v;
      setValue(v);
      AsyncStorage.setItem(key, JSON.stringify(v)).catch(() => {});
    },
    [key],
  );

  return [value, update, ready] as const;
}

/** Local calendar day as YYYY-MM-DD, for "today" counters. */
export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
