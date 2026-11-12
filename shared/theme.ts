// Shared design tokens for every Wildchild App.
export const colors = {
  ink: '#1B1B2F',
  inkSoft: '#5B5B76',
  paper: '#FFFFFF',
  cream: '#FFF8EE',
  accent: '#FF5A5F',
  mint: '#3DDC97',
  sky: '#4EA8DE',
  sun: '#FFC93C',
};

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };
export const space = (n: number) => n * 4;

export const type = {
  hero: { fontSize: 40, fontWeight: '900' as const, letterSpacing: -1 },
  title: { fontSize: 22, fontWeight: '800' as const },
  body: { fontSize: 16, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.5 },
};
