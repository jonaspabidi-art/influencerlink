import { useQuery } from '@tanstack/react-query';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { formatDate, formatFollowers, formatPercent, formatSek } from '../format';
import { colors, radius, spacing, type } from '../theme';
import type { ContractResults } from '../types';
import { Body, Card, Label, Loading, StatBox } from './ui';

/**
 * Vad samarbetet gav.
 *
 * Restaurangen såg tidigare bara "godkänt" och hade inget att gå på när den
 * skulle avgöra om den skulle köra igen. Kostnad per tusen visningar står med
 * eftersom det är det enda måttet som går att jämföra med vad annonsplatsen
 * bredvid kostar.
 */
export function CampaignResult({ contractId, fee }: { contractId: string; fee: number }) {
  const results = useQuery({
    queryKey: ['results', contractId],
    queryFn: () => api.get<ContractResults>(`/contracts/${contractId}/results`),
    enabled: Boolean(contractId),
    // Siffran hämtas om vid varje besök – den växer de första dygnen.
    staleTime: 0,
  });

  if (results.isLoading) {
    return (
      <Card>
        <Label>RESULTAT</Label>
        <Loading />
      </Card>
    );
  }

  const data = results.data;
  if (!data) return null;

  if (data.views === 0) {
    return (
      <Card>
        <Label>RESULTAT</Label>
        <Body>
          {data.posts.length === 0
            ? 'Siffrorna kommer när inlägget är publicerat och kreatörens konto är kopplat med TikTok-inloggning.'
            : 'Inga visningar registrerade än. Det tar en stund innan plattformen räknat.'}
        </Body>
      </Card>
    );
  }

  return (
    <Card>
      <Label>RESULTAT</Label>

      <View style={styles.headline}>
        <Text style={styles.views}>{formatFollowers(data.views)}</Text>
        <Text style={styles.viewsLabel}>visningar</Text>
      </View>

      <View style={styles.statRow}>
        <StatBox label="PER 1000 VISN." value={formatSek(data.costPerMille)} />
        <StatBox label="ENGAGEMANG" value={formatPercent(data.engagementRate)} tone="positive" />
        <StatBox label="ARVODE" value={formatSek(fee)} />
      </View>

      {data.posts.length > 1 ? (
        <View style={styles.posts}>
          {data.posts.map((post) => (
            <Pressable
              key={post.url}
              accessibilityRole="link"
              accessibilityLabel="Öppna inlägget"
              onPress={() => void Linking.openURL(post.url)}
              style={({ pressed }) => [styles.post, pressed && styles.pressed]}
            >
              <Text style={styles.postViews}>{formatFollowers(post.views)}</Text>
              <Text style={styles.secondary}>
                {formatFollowers(post.likes)} gillanden · {formatFollowers(post.comments)}{' '}
                kommentarer
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.secondary}>
        {data.final
          ? 'Slutresultat · mätningen är avslutad'
          : data.measuredAt
            ? `Uppdaterat ${formatDate(data.measuredAt)} · siffran växer de första veckorna`
            : ''}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  views: { ...type.amountHero, color: colors.accent },
  viewsLabel: { ...type.body, color: colors.muted },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  posts: { gap: spacing.sm },
  post: {
    backgroundColor: colors.raised,
    borderRadius: radius.control,
    padding: spacing.md,
    gap: 2,
  },
  pressed: { opacity: 0.8 },
  postViews: { ...type.listTitle, color: colors.text },
  secondary: { ...type.secondary, color: colors.muted },
});
