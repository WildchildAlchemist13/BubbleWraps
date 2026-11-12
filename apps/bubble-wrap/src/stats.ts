import { todayKey } from '@pocket/kit';

export type Stats = {
  /** pops per local day, YYYY-MM-DD → count (last ~60 days kept) */
  days: Record<string, number>;
  total: number;
  sheets: number;
  muted: boolean;
  haptics: boolean;
  tilt: boolean;
  /** one-time moments already shown: 'hint', 'tough', milestone keys */
  seen: Record<string, boolean>;
  lastOpen: string;
  // v1 fields, migrated into `days` on load
  day?: string;
  today?: number;
};

export const INITIAL: Stats = {
  days: {},
  total: 0,
  sheets: 0,
  muted: false,
  haptics: true,
  tilt: true,
  seen: {},
  lastOpen: '',
};

export function migrate(s: Stats): Stats {
  if (s.day && s.today && !s.days[s.day]) {
    const { day, today, ...rest } = s;
    return { ...rest, days: { ...s.days, [day]: today } };
  }
  return s;
}

export const popsToday = (s: Stats) => s.days[todayKey()] ?? 0;
export const bestDay = (s: Stats) => Object.values(s.days).reduce((m, v) => Math.max(m, v), 0);

export function recordPop(s: Stats, clearedSheet: boolean): Stats {
  const d = todayKey();
  const days = { ...s.days, [d]: (s.days[d] ?? 0) + 1 };
  const keys = Object.keys(days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete days[k];
  return { ...s, days, total: s.total + 1, sheets: s.sheets + (clearedSheet ? 1 : 0) };
}

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** The last 7 days ending today, oldest first. */
export function lastWeek(s: Stats) {
  const out: { label: string; value: number; isToday: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      value: s.days[dayKey(d)] ?? 0,
      isToday: i === 0,
    });
  }
  return out;
}

/** Milestone message to show after a pop, if one was just crossed and not yet shown. */
export function milestoneAfterPop(s: Stats): { key: string; text: string } | null {
  const d = todayKey();
  const today = s.days[d] ?? 0;
  if (today === 100 && !s.seen[`today100:${d}`])
    return { key: `today100:${d}`, text: '100 today. Your stress is shaking.' };
  if (s.total === 1000 && !s.seen.total1000) return { key: 'total1000', text: "1,000 pops. That's a lot of air." };
  if (s.sheets === 10 && !s.seen.sheets10) return { key: 'sheets10', text: "10 sheets. You're a professional now." };
  return null;
}
