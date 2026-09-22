import Constants from 'expo-constants';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from './ui';
import { colors, radius, spacing, type } from '../theme';

/**
 * Skärmen som visas i stället för ingenting när något går sönder.
 *
 * Utan den river React hela komponentträdet vid ett renderingsfel, och kvar
 * blir en tom yta i bakgrundsfärgen. Det ser ut som att appen är tom, inte
 * som att något gått fel – och står man i en restaurang och räcker över
 * telefonen är det den värsta av alla utgångar.
 *
 * Felmeddelandet står synligt med flit. Den som ser det här är antingen
 * utvecklaren eller någon som ska kunna läsa upp raden i telefon, och båda
 * behöver veta vad som hände. Ett "något gick fel" utan orsak gör felsökning
 * till gissning.
 */
/**
 * Vilket bygge som körs, satt vid exporten.
 *
 * Utan det går det inte att se om en telefon ligger kvar på ett gammalt
 * bygge – och en hemskärmsikon gör just det, ibland länge. Att gissa om ett
 * fel redan är rättat kostar mer tid än den här raden.
 */
const BUILD = process.env.EXPO_PUBLIC_BUILD ?? 'lokalt';

export function AppError({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Något gick fel</Text>
        <Text style={styles.body}>
          Appen kunde inte rita skärmen. Försök igen – funkar det inte, skicka texten nedan till
          oss så vet vi var felet sitter.
        </Text>

        <View style={styles.detail}>
          <Text style={styles.detailText} selectable>
            {error?.message || 'Okänt fel'}
          </Text>
          <Text style={styles.meta} selectable>
            {Platform.OS} · v{Constants.expoConfig?.version ?? 'okänd'} · bygge {BUILD}
          </Text>
        </View>

        <Button label="Försök igen" onPress={retry} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.base },
  title: { ...type.display, color: colors.text },
  body: { ...type.body, color: colors.muted },
  detail: {
    backgroundColor: colors.raised,
    borderRadius: radius.card,
    padding: spacing.base,
    gap: spacing.sm,
  },
  detailText: { fontFamily: type.bodySmall.fontFamily, fontSize: 14, color: colors.text },
  meta: { ...type.secondary, color: colors.muted },
});
