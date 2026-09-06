import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../../src/api';
import {
  Body,
  Card,
  DetailRow,
  Divider,
  ErrorState,
  Header,
  Label,
  Loading,
  ScrollScreen,
  StatusBadge,
} from '../../../src/components/ui';
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONES,
  formatDate,
  formatFollowers,
  formatSek,
} from '../../../src/format';
import { colors, radius, spacing, type } from '../../../src/theme';
import type { AdminContract } from '../../../src/types';

/** Hela avtalet: parter, pengar, signaturer, leverans och tillägg. */
export default function AdminContractDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [showTerms, setShowTerms] = useState(false);

  const contract = useQuery({
    queryKey: ['admin-contract', id],
    queryFn: () => api.get<AdminContract>(`/admin/contracts/${id}`),
    enabled: Boolean(id),
  });

  const data = contract.data;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title={data?.campaignTitle ?? 'Avtal'} onBack={() => router.back()} />

      {contract.isLoading ? <Loading /> : null}
      {contract.isError ? (
        <ErrorState message="Kunde inte hämta avtalet." onRetry={() => void contract.refetch()} />
      ) : null}

      {data ? (
        <>
          <Card>
            <View style={styles.head}>
              <Text style={styles.title}>{data.campaignTitle}</Text>
              <StatusBadge
                label={CONTRACT_STATUS_LABELS[data.status]}
                tone={CONTRACT_STATUS_TONES[data.status]}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Öppna ${data.businessName}`}
              onPress={() => router.push(`/admin/business/${data.businessId}`)}
            >
              <Text style={styles.link}>{data.businessName}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Öppna ${data.influencerName}`}
              onPress={() => router.push(`/admin/influencer/${data.influencerId}`)}
            >
              <Text style={styles.link}>{data.influencerName}</Text>
            </Pressable>
          </Card>

          <Card>
            <Label>PENGAR</Label>
            <DetailRow label="Arvode" value={formatSek(data.fee)} />
            <DetailRow label="Företaget betalar" value={formatSek(data.charge)} />
            <DetailRow label="Vår avgift" value={formatSek(data.platformFee)} emphasis />
            <DetailRow label="Till kreatören" value={formatSek(data.payout)} />
            {data.payment ? (
              <>
                <Divider />
                <DetailRow label="Betalning" value={data.payment.status} />
                {data.payment.escrowedAt ? (
                  <DetailRow label="Spärrat" value={formatDate(data.payment.escrowedAt)} />
                ) : null}
                {data.payment.releasedAt ? (
                  <DetailRow label="Utbetalt" value={formatDate(data.payment.releasedAt)} />
                ) : null}
              </>
            ) : (
              <Body>Ingen betalning registrerad.</Body>
            )}
          </Card>

          <Card>
            <Label>FÖRLOPP</Label>
            <DetailRow
              label="Företaget signerade"
              value={data.signedByBusinessAt ? formatDate(data.signedByBusinessAt) : '–'}
            />
            <DetailRow
              label="Kreatören signerade"
              value={data.signedByInfluencerAt ? formatDate(data.signedByInfluencerAt) : '–'}
            />
            <DetailRow label="Deadline" value={formatDate(data.dueDate)} />
            <DetailRow
              label="Levererat"
              value={data.deliveredAt ? formatDate(data.deliveredAt) : '–'}
            />
            <DetailRow
              label="Avslutat"
              value={data.completedAt ? formatDate(data.completedAt) : '–'}
            />
            {data.views > 0 ? (
              <DetailRow label="Visningar" value={formatFollowers(data.views)} />
            ) : null}
          </Card>

          {data.deliveryUrls.length > 0 ? (
            <View style={styles.section}>
              <Label>PUBLICERAT</Label>
              {data.deliveryUrls.map((url) => (
                <Pressable
                  key={url}
                  accessibilityRole="link"
                  accessibilityLabel="Öppna inlägget"
                  onPress={() => void Linking.openURL(url)}
                >
                  <Text style={styles.link} numberOfLines={1}>
                    {url}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {data.usageRights ? (
            <Card>
              <Label>ANNONSRÄTT</Label>
              <DetailRow label="Läge" value={data.usageRights.status} />
              <DetailRow label="Tillägg" value={formatSek(data.usageRights.amount)} />
              <DetailRow
                label="Till kreatören"
                value={formatSek(data.usageRights.creatorShare)}
              />
              <DetailRow label="Betalning" value={data.usageRights.paymentStatus} />
            </Card>
          ) : null}

          <View style={styles.section}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showTerms ? 'Dölj avtalstexten' : 'Visa avtalstexten'}
              onPress={() => setShowTerms((current) => !current)}
            >
              <Text style={styles.link}>
                {showTerms ? 'Dölj avtalstexten' : 'Visa avtalstexten'}
              </Text>
            </Pressable>
            {showTerms ? <Text style={styles.terms}>{data.terms}</Text> : null}
          </View>
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...type.listTitle, color: colors.text, flexShrink: 1 },
  link: { ...type.bodySmall, color: colors.primary },
  section: { gap: spacing.sm },
  terms: {
    ...type.secondary,
    color: colors.muted,
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    padding: spacing.md,
  },
});
