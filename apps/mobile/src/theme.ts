/**
 * Ett litet designspråk: varma, matiga toner mot mörk bakgrund så att
 * bilderna på korten får ta plats.
 */
export const colors = {
  background: '#12100E',
  surface: '#1D1A17',
  surfaceRaised: '#272320',
  border: '#3A3430',
  text: '#F6F1EA',
  textMuted: '#A79C90',
  primary: '#E8543F',
  primaryText: '#FFFFFF',
  accent: '#F2B544',
  success: '#4FA97B',
  danger: '#D9534F',
  overlay: 'rgba(0,0,0,0.55)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 24,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
} as const;
