/**
 * Designtokens från handoffen "Pacta — mobilapp".
 *
 * Ljust tema är standard. Mörkt finns kvar som färdig variant och väljs med
 * `resolveTheme`, så att appen kan följa systeminställningen när vi vill.
 */

export type ThemeName = 'light' | 'dark';

export interface Palette {
  bg: string;
  surface: string;
  raised: string;
  border: string;
  text: string;
  muted: string;
  /** Platshållartext, svagare än muted. */
  dim: string;
  /** Bildplatshållarens bottenfärg. */
  photo: string;
  /** Bildplatshållarens randfärg. */
  stripe: string;
  primary: string;
  /** Text ovanpå primary. */
  ink: string;
  /** Belopp och AI-markering. */
  accent: string;
  /** Utbetalning, matchning, signerat. */
  positive: string;
  danger: string;
  /** Svag primärton, till ikonrutor och AI-notiser. */
  tint: string;
}

const light: Palette = {
  bg: '#F7F2EA',
  surface: '#FFFFFF',
  raised: '#F1EAE0',
  border: '#E1D7C9',
  text: '#1A1512',
  muted: '#75695C',
  dim: '#A99C8C',
  photo: '#EFE8DD',
  stripe: '#E7DFD3',
  primary: '#E8543F',
  ink: '#FFFFFF',
  accent: '#9A6A00',
  positive: '#2E7D57',
  danger: '#C0392B',
  tint: '#FBEFEA',
};

const dark: Palette = {
  bg: '#12100E',
  surface: '#1D1A17',
  raised: '#272320',
  border: '#3A3430',
  text: '#F6F1EA',
  muted: '#A79C90',
  dim: '#6E645A',
  photo: '#241F1C',
  stripe: '#2C2622',
  primary: '#E8543F',
  ink: '#12100E',
  accent: '#F2B544',
  positive: '#4FA97B',
  danger: '#D9534F',
  tint: '#241C19',
};

export const palettes: Record<ThemeName, Palette> = { light, dark };

/** Appens aktiva palett. Ljust tema är valt. */
export const colors: Palette = light;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
} as const;

export const radius = {
  /** Taggar och statusmärken. */
  tag: 5,
  /** Segmenterade val och nischchips. */
  chip: 6,
  /** Knappar, nyckeltalsrutor, ikonrutor. */
  control: 8,
  /** Kort och paneler. */
  card: 12,
  /** Endast avatarer, prickar och svepknappar. */
  round: 999,
} as const;

/** Minsta träffyta enligt handoffen. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

export const font = {
  regular: 'InstrumentSans_400Regular',
  medium: 'InstrumentSans_500Medium',
  semibold: 'InstrumentSans_600SemiBold',
  bold: 'InstrumentSans_700Bold',
  /** Endast små versala etiketter och platshållartext. */
  mono: 'monospace',
} as const;

/**
 * Typografiskalan. Vikt uttrycks genom typsnittsfamiljen eftersom Instrument
 * Sans laddas som separata filer – `fontWeight` ensamt ger fel snitt på Android.
 */
export const type = {
  /** Skärmrubrik, 24/700. */
  screenTitle: { fontFamily: font.bold, fontSize: 24, letterSpacing: -0.24 },
  /** Stor rubrik på inloggning, matchning och onboarding. */
  display: { fontFamily: font.bold, fontSize: 30, lineHeight: 34.5, letterSpacing: -0.6 },
  displayLarge: { fontFamily: font.bold, fontSize: 32, lineHeight: 35.2, letterSpacing: -0.64 },
  /** Korttitel i kortleken. */
  cardTitle: { fontFamily: font.bold, fontSize: 22, lineHeight: 25.3, letterSpacing: -0.22 },
  sectionTitle: { fontFamily: font.bold, fontSize: 20, lineHeight: 24 },
  /** Stort belopp, plånboken och utbetalningskortet. */
  amountHero: { fontFamily: font.bold, fontSize: 38, letterSpacing: -0.76 },
  amountLarge: { fontFamily: font.bold, fontSize: 34, letterSpacing: -0.68 },
  /** Belopp i kort. */
  amount: { fontFamily: font.bold, fontSize: 22 },
  amountSmall: { fontFamily: font.bold, fontSize: 20 },
  /** Radrubrik och listtitel. */
  rowTitle: { fontFamily: font.bold, fontSize: 17 },
  rowTitleMedium: { fontFamily: font.semibold, fontSize: 17 },
  listTitle: { fontFamily: font.semibold, fontSize: 15 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22.5 },
  bodySmall: { fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  secondary: { fontFamily: font.regular, fontSize: 13 },
  /** Versal etikett, mono. */
  label: {
    fontFamily: font.mono,
    fontSize: 11,
    letterSpacing: 0.66,
  },
  buttonPrimary: { fontFamily: font.bold, fontSize: 16 },
  buttonSecondary: { fontFamily: font.semibold, fontSize: 16 },
  tab: { fontFamily: font.regular, fontSize: 11 },
  tabActive: { fontFamily: font.semibold, fontSize: 11 },
} as const;

export const HEIGHTS = {
  buttonPrimary: 52,
  buttonSecondary: 52,
  buttonCompact: 48,
  swipeSkip: 64,
  swipeLike: 76,
} as const;
