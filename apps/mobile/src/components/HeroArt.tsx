import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors, radius } from '../theme';

/**
 * Bilden på inloggningen. Ritad i stället för fotograferad: appen har ännu
 * inga riktiga bilder, och en illustration i palettens färger är ärligare än
 * ett stockfoto som lovar innehåll som inte finns.
 *
 * Motivet är ett dukat bord uppifrån med en spelknapp över – de två världar
 * appen för ihop. Samma streckspråk som ikonerna: 1,75 i tjocklek, runda ändar.
 */
export function HeroArt({ height = 150 }: { height?: number }) {
  return (
    <Svg width="100%" height={height} viewBox="0 0 390 150" fill="none">
      <Rect width="390" height="150" rx={radius.card} fill={colors.raised} />

      {/* Tallrik, bruten av kanten så att motivet känns utsnittet ur något större. */}
      <G opacity={0.9}>
        <Circle cx="118" cy="75" r="52" stroke={colors.border} strokeWidth={1.75} />
        <Circle cx="118" cy="75" r="34" stroke={colors.border} strokeWidth={1.75} />
      </G>

      {/* Bestick. */}
      <G stroke={colors.dim} strokeWidth={1.75} strokeLinecap="round">
        <Path d="M46 52v46" />
        <Path d="M40 52v14a6 6 0 0 0 12 0V52" />
        <Path d="M196 52v46" />
        <Path d="M196 52c7 0 11 6 11 13s-4 11-11 11" />
      </G>

      {/* Glas. */}
      <G stroke={colors.border} strokeWidth={1.75} strokeLinejoin="round">
        <Path d="M232 48h26l-3 22a10 10 0 0 1-20 0z" />
        <Path d="M245 70v28M236 98h18" />
      </G>

      {/* Spelknappen: kreatörens sida av bordet. */}
      <Circle cx="312" cy="75" r="34" fill={colors.primary} />
      <Path d="M304 62l20 13-20 13z" fill={colors.ink} />
    </Svg>
  );
}
