import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../../src/api';
import {
  Body,
  Card,
  DetailRow,
  ErrorState,
  Header,
  Label,
  Loading,
  Rating,
  ScrollScreen,
  Tag,
} from '../../../src/components/ui';
import { CONTRACT_STATUS_LABELS, formatFollowers, formatSek } from '../../../src/format';
import { colors, radius, spacing, type } from '../../../src/theme';
import type { AdminInfluencer } from '../../../src/types';

/**
 * En kreatör med allt vi har på henne.
 *
 * Personnumret visas maskerat – hela numret finns bara som hash och går inte
 * att få fram. Åtkomstnycklarna till plattformarna visas aldrig, bara om ett
 * konto är kopplat eller inte.
 */
export default function AdminInfluencerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const influencer = useQuery({
    queryKey: ['admin-influencer', id],
    queryFn: () => api.get<AdminInfluencer>(`/admin/influencers/${id}`),
    enabled: Boolean(id),
  });

  const data = influencer.data;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title={data?.displayName ?? 'Kreatör'} onBack={() => router.back()} />

      {influencer.isLoading ? <Loading /> : null}
      {influencer.isError ? (
        <ErrorState
          message="Kunde inte hämta kreatören."
          onRetry={() => void influencer.refetch()}
        />
      ) : null}

      {data ? (
        <>
          <Card>
            <Rating summary={data.rating} size={12} emptyLabel="Inga omdömen än" />
            <DetailRow label="Stad" value={data.city} />
            <DetailRow label="Kontakt" value={data.contactName} />
            <DetailRow label="Personnummer" value={data.personalNumberMask ?? 'okänt'} />
            <DetailRow label="Lägsta arvode" value={formatSek(data.priceMin)} />
            <DetailRow label="Riktpris" value={formatSek(data.priceTarget)} />
            <DetailRow
              label="Utbetalning"
              value={data.payoutsReady ? 'Konto kopplat' : 'Saknas'}
            />
            {data.bio ? <Body>{data.bio}</Body> : null}
          </Card>

          <View style={styles.section}>
            <Label>KONTON</Label>
            {data.socials.length === 0 ? <Body>Inga konton angivna.</Body> : null}
            {data.socials.map((social) => (
              <View key={`${social.platform}:${social.handle}`} style={styles.row}>
                <View style={styles.rowHead}>
                  <Text style={styles.title}>
                    {social.platform} @{social.handle}
                  </Text>
                  <Tag
                    label={social.statsSource === 'PLATFORM' ? 'Verifierad' : 'Ogranskad'}
                    tone={social.statsSource === 'PLATFORM' ? 'filled' : 'dashed'}
                  />
                </View>
                <Text style={styles.meta}>
                  {formatFollowers(social.followers)} följare ·{' '}
                  {formatFollowers(social.avgViews)} visningar i snitt
                </Text>
                <Text style={styles.meta}>
                  {social.connected ? 'Inloggning kopplad' : 'Ingen inloggning'}
                </Text>
              </View>
            ))}
            <Text style={styles.footnote}>
              Åtkomstnycklarna ligger krypterade och visas inte här – inte ens för oss.
            </Text>
          </View>

          <View style={styles.section}>
            <Label>AVTAL</Label>
            {data.contracts.length === 0 ? <Body>Inga avtal än.</Body> : null}
            {data.contracts.map((contract) => (
              <Pressable
                key={contract.id}
                accessibilityRole="button"
                accessibilityLabel={`Öppna avtalet för ${contract.campaignTitle}`}
                onPress={() => router.push(`/admin/contract/${contract.id}`)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={styles.title} numberOfLines={1}>
                  {contract.campaignTitle}
                </Text>
                <Text style={styles.meta}>
                  {contract.businessName} · {CONTRACT_STATUS_LABELS[contract.status]}
                </Text>
                <Text style={styles.meta}>
                  Arvode {formatSek(contract.fee)} · utbetalt {formatSek(contract.payout)}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: spacing.md },
  section: { gap: spacing.sm },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 2,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  pressed: { opacity: 0.8 },
  title: { ...type.listTitle, color: colors.text, flexShrink: 1 },
  meta: { ...type.secondary, color: colors.muted },
  footnote: { ...type.secondary, color: colors.dim },
});
