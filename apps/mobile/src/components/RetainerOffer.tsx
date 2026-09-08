import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { formatFollowers, formatSek } from '../format';
import { colors, spacing, type } from '../theme';
import type { ContractResults, InfluencerProfile } from '../types';
import { SparkIcon } from './icons';
import { Body, Button, Card } from './ui';

/**
 * Förslaget att gå från kampanj till löpande uppdrag.
 *
 * Det här är det enda ögonblick då företaget vet vad en viss kreatör är värd
 * för dem: samarbetet är klart och siffrorna finns. Att fråga innan vore att
 * be dem gissa, och att fråga senare vore att fråga när de glömt.
 *
 * Erbjudandet visas bara när det finns något att visa upp – riktiga visningar,
 * och en kreatör som faktiskt har en plats ledig. Ett förslag om något som
 * ändå inte går att boka är sämre än inget förslag.
 */
export function RetainerOffer({
  contractId,
  influencerId,
  influencerName,
}: {
  contractId: string;
  influencerId: string;
  influencerName: string;
}) {
  const router = useRouter();

  const results = useQuery({
    queryKey: ['results', contractId],
    queryFn: () => api.get<ContractResults>(`/contracts/${contractId}/results`),
    enabled: Boolean(contractId),
  });

  const creator = useQuery({
    queryKey: ['influencer', influencerId],
    queryFn: () => api.get<InfluencerProfile>(`/influencers/${influencerId}`),
    enabled: Boolean(influencerId),
  });

  const views = results.data?.views ?? 0;
  const profile = creator.data;
  if (views === 0 || !profile?.acceptsRetainers || profile.retainerSlots <= 0) return null;

  const monthly = profile.retainerPackages[0]?.monthlyRate ?? 0;

  return (
    <Card tone="primary">
      <View style={styles.head}>
        <SparkIcon size={18} color={colors.accent} />
        <Text style={styles.title}>Vill ni ha {influencerName} varje vecka?</Text>
      </View>
      <Body>
        Den här filmen gav er {formatFollowers(views)} visningar. Ett löpande uppdrag är något
        annat: hon producerar fyra videor i månaden till <Text style={styles.strong}>era egna
        kanaler</Text> i stället för sin, och ni godkänner varje film innan den läggs upp.
      </Body>
      <Text style={styles.price}>
        Från {formatSek(Math.round(monthly * 1.1))} i månaden · ingen bindningstid
      </Text>
      <Button
        label="Se vad det skulle kosta"
        variant="secondary"
        onPress={() =>
          router.push({ pathname: '/retainer/new', params: { influencerId } })
        }
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...type.listTitle, fontSize: 16, color: colors.text, flex: 1 },
  strong: { fontFamily: type.listTitle.fontFamily },
  price: { ...type.secondary, color: colors.accent },
});
