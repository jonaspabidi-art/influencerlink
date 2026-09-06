import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import {
  Body,
  Card,
  ErrorState,
  Header,
  Label,
  Loading,
  ScrollScreen,
  StatBox,
} from '../../src/components/ui';
import { useAuth } from '../../src/auth';
import { formatSek } from '../../src/format';
import { colors, spacing, type } from '../../src/theme';
import type { AdminOverview } from '../../src/types';
import { Button } from '../../src/components/ui';

/** Läget på plattformen, i siffror. */
export default function AdminOverviewScreen() {
  const { signOut } = useAuth();
  const overview = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get<AdminOverview>('/admin/overview'),
  });

  const data = overview.data;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title="Pacta" large subtitle="Plattformsvy" />

      {overview.isLoading ? <Loading /> : null}
      {overview.isError ? (
        <ErrorState message="Kunde inte hämta översikten." onRetry={() => void overview.refetch()} />
      ) : null}

      {data ? (
        <>
          <Card tone="raised">
            <Label>PENGAR</Label>
            <View style={styles.statRow}>
              <StatBox label="SIGNERAT" value={formatSek(data.signedVolume)} />
              <StatBox
                label="VÅR INTÄKT"
                value={formatSek(data.platformRevenue)}
                tone="positive"
              />
            </View>
            <View style={styles.statRow}>
              <StatBox label="SPÄRRAT NU" value={formatSek(data.escrowHeld)} />
              <StatBox label="ÖPPNA AVTAL" value={String(data.openContracts)} />
            </View>
            <Body>
              Signerat är summan av arvodena i avtal som gått till signering. Vår intäkt är båda
              parters förmedlingsavgift på dem.
            </Body>
          </Card>

          <Card>
            <Label>PLATTFORMEN</Label>
            <View style={styles.statRow}>
              <StatBox label="FÖRETAG" value={String(data.businesses)} />
              <StatBox label="KREATÖRER" value={String(data.influencers)} />
            </View>
            <View style={styles.statRow}>
              <StatBox label="AKTIVA KAMPANJER" value={String(data.activeCampaigns)} />
              <StatBox label="UPPDRAG ÅT OSS" value={String(data.openExpertOrders)} />
            </View>
          </Card>

          {data.openExpertOrders > 0 ? (
            <Card tone="raised">
              <Text style={styles.title}>
                {data.openExpertOrders} {data.openExpertOrders === 1 ? 'uppdrag' : 'uppdrag'} väntar
                på oss
              </Text>
              <Body>Företag som betalar för att vi bygger kampanjen åt dem.</Body>
              <Button label="Se kön" onPress={() => router.push('/admin/expert-orders')} />
            </Card>
          ) : null}

          <Button label="Logga ut" variant="secondary" onPress={() => void signOut()} />
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: spacing.md },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  title: { ...type.listTitle, color: colors.text },
});
