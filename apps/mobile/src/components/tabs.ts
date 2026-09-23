import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, type } from "../theme";

/*
 * Flikradens höjd måste räknas fram, inte skrivas in.
 *
 * Tidigare stod det height: 76 rakt av. I webbläsaren såg det rätt ut, men på
 * en telefon med hemindikator lägger navigationen till telefonens nedre
 * skyddsyta som padding *innanför* den höjden. Kvar blev drygt trettio pixlar
 * till både ikon och text, och texten – det som förklarar vad knappen gör –
 * klipptes bort. Kvar syntes fyra ikoner utan ord.
 *
 * Därför: 76 är höjden på innehållet, och skyddsytan läggs till ovanpå det.
 * Raden blir högre på en telefon med hemindikator, men ikon och etikett får
 * exakt lika mycket plats där som i webbläsaren.
 */
const CONTENT_HEIGHT = 76;
const PADDING_TOP = 8;

export function useTabScreenOptions() {
  const insets = useSafeAreaInsets();

  return {
    headerShown: false,
    sceneStyle: { backgroundColor: colors.bg },
    tabBarStyle: {
      backgroundColor: colors.bg,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      height: CONTENT_HEIGHT + insets.bottom,
      paddingTop: PADDING_TOP,
      paddingBottom: insets.bottom,
    },
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.muted,
    tabBarShowLabel: true,
    // Texten ska alltid stå under ikonen, aldrig vika ut vid sidan på en bred skärm.
    tabBarLabelPosition: "below-icon" as const,
    /*
     * Ingen systemskalning på etiketten. Med stor systemtext växer raden förbi
     * sin höjd och klipps igen – och en förklaring som inte syns är sämre än
     * en som är liten.
     */
    tabBarAllowFontScaling: false,
    tabBarLabelStyle: { ...type.tab, marginTop: 2 },
  };
}
