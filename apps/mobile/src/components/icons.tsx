import { useId } from 'react';
import type { ColorValue } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

/**
 * Streckikoner enligt handoffen: 24 × 24 viewBox, stroke 1.75 (2,25 för bocken),
 * runda ändar. Ingen fyllning, ingen emoji.
 */
export interface IconProps {
  size?: number;
  /** ColorValue, inte string, så att fliknavigationens färger går att skicka in. */
  color?: ColorValue;
}

const STROKE = 1.75;

function Icon({
  size = 21,
  color = colors.text,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

/** Escrow och trygghet. */
export const LockIcon = (props: IconProps) => (
  <Icon {...props}>
    <Rect x="4.5" y="10.5" width="15" height="10" rx="1.5" />
    <Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </Icon>
);

/** Fyrstrålig gnista: markerar att AI:n varit inblandad. */
export const SparkIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M12 3.5v17M3.5 12h17M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const ChevronLeftIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M15 5l-7 7 7 7" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

/** Bock: intresserad, signerat, klart. Tjockare streck enligt handoffen. */
export const CheckIcon = ({ size = 21, color = colors.text }: IconProps) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2.25}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M5 12.5l4.8 4.8L19 7" />
  </Svg>
);

export const SlidersIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
    <Circle cx="16" cy="8" r="2" />
    <Circle cx="10" cy="16" r="2" />
  </Icon>
);

/** Kortstapel: fliken Upptäck och influencerns rollikon. */
export const DeckIcon = (props: IconProps) => (
  <Icon {...props}>
    <Rect x="4" y="3" width="16" height="14" rx="2" />
    <Path d="M7 20h10" />
  </Icon>
);

export const ChatIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M20 12a7.5 7.5 0 0 1-10.9 6.7L4.5 20l1.3-4.4A7.5 7.5 0 1 1 20 12z" />
  </Icon>
);

export const DocIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M6 3h8l4 4v14H6z" />
    <Path d="M9 12h6M9 16h4" />
  </Icon>
);

export const WalletIcon = (props: IconProps) => (
  <Icon {...props}>
    <Rect x="3" y="6" width="18" height="13" rx="2" />
    <Path d="M16 12h2" />
  </Icon>
);

/** Rutnät: fliken Kampanjer och restaurangens rollikon. */
export const GridIcon = (props: IconProps) => (
  <Icon {...props}>
    <Rect x="3.5" y="3.5" width="7" height="7" rx="1" />
    <Rect x="13.5" y="3.5" width="7" height="7" rx="1" />
    <Rect x="3.5" y="13.5" width="7" height="7" rx="1" />
    <Rect x="13.5" y="13.5" width="7" height="7" rx="1" />
  </Icon>
);

export const PencilIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z" />
  </Icon>
);

/**
 * Stjärna för betyg. Den enda ikonen med fyllning – ett omdöme på 4,8 måste gå
 * att läsa av utan att räkna konturer, och tomma stjärnor bredvid fyllda är
 * hela poängen med formen.
 */
export function StarIcon({
  size = 14,
  variant = 'full',
  color = colors.accent,
}: IconProps & { variant?: 'full' | 'half' | 'empty' }) {
  // Egen id per instans, annars klipper alla halva stjärnor mot samma maskering.
  const clipId = `star-${useId().replace(/:/g, '')}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {variant === 'half' ? (
        <Defs>
          <ClipPath id={clipId}>
            <Rect x="0" y="0" width="12" height="24" />
          </ClipPath>
        </Defs>
      ) : null}
      <Path
        d={STAR_PATH}
        fill={variant === 'full' ? color : 'none'}
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {variant === 'half' ? <Path d={STAR_PATH} fill={color} clipPath={`url(#${clipId})`} /> : null}
    </Svg>
  );
}

const STAR_PATH =
  'M12 3.6l2.63 5.33 5.87.85-4.25 4.14 1 5.85L12 17.01l-5.25 2.76 1-5.85-4.25-4.14 5.87-.85z';

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <Path d="M12 5v14M5 12h14" />
  </Icon>
);
