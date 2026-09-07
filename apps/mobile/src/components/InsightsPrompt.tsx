import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { insightsQuery } from '../queries';
import { colors, spacing, type } from '../theme';
import { SparkIcon } from './icons';
import { Body, Button, Card } from './ui';

/**
 * Ingången till "varför får jag få matchningar".
 *
 * Frågan ställs bara när den är befogad. Den som har fullt upp med samarbeten
 * ska inte mötas av en ruta som antyder att det går dåligt, och den som har
 * fyra kampanjer kvar att svepa på har inte något problem att lösa – hon har
 * kort kvar. Därför hänger rutan på uträkningen, inte på en känsla.
 */
export function InsightsPrompt() {
  const router = useRouter();
  const insights = useQuery(insightsQuery());
  const data = insights.data;

  if (!data) return null;

  // Har hon både matchningar och kort kvar är läget inte något att förklara.
  if (data.matches >= 3 && data.waiting > 0) return null;

  const blocked = data.blockers.followers + data.blockers.platforms + data.blockers.budget;

  return (
    <Card tone="raised">
      <View style={styles.head}>
        <SparkIcon size={18} color={colors.accent} />
        <Text style={styles.title}>Har du inte matchat med så många du tänkt dig?</Text>
      </View>
      <Body>
        {blocked > 0
          ? `${blocked} av kampanjerna som ligger ute sorteras bort innan du ser dem. Vi visar vilka krav det gäller och vad som skulle öppna fler.`
          : `Du kan söka ${data.eligible} av ${data.openCampaigns} kampanjer just nu. Vi går igenom vad som avgör det och vad du kan ändra.`}
      </Body>
      <Button label="Se ditt läge" variant="secondary" onPress={() => router.push('/insights')} />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...type.listTitle, fontSize: 15, color: colors.text, flex: 1 },
});
