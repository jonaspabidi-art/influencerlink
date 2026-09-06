import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../../src/api';
import {
  Body,
  Button,
  Card,
  DetailRow,
  ErrorState,
  Header,
  Label,
  Loading,
  ScrollScreen,
  StatusBadge,
} from '../../../src/components/ui';
import { formatSek } from '../../../src/format';
import { colors, radius, spacing, type } from '../../../src/theme';
import type { AdminBusiness } from '../../../src/types';

const STATUS_LABELS = {
  DRAFT: 'Utkast',
  ACTIVE: 'Publicerad',
  PAUSED: 'Pausad',
  CLOSED: 'Avslutad',
} as const;

const STATUS_TONES = {
  DRAFT: 'pending',
  ACTIVE: 'active',
  PAUSED: 'pending',
  CLOSED: 'cancelled',
} as const;

/** Ett företag med allt de gjort, och kampanjerna vi kan ändra åt dem. */
export default function AdminBusinessDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const business = useQuery({
    queryKey: ['admin-business', id],
    queryFn: () => api.get<AdminBusiness>(`/admin/businesses/${id}`),
    enabled: Boolean(id),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-business', id] });
    void queryClient.invalidateQueries({ queryKey: ['admin-businesses'] });
  };

  const setStatus = useMutation({
    mutationFn: (input: { campaignId: string; status: 'ACTIVE' | 'PAUSED' | 'CLOSED' }) =>
      api.patch(`/admin/campaigns/${input.campaignId}`, { status: input.status }),
    onSuccess: refresh,
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte ändra kampanjen.'),
  });

  const remove = useMutation({
    mutationFn: (campaignId: string) => api.del(`/admin/campaigns/${campaignId}`),
    onSuccess: refresh,
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte radera kampanjen.'),
  });

  /**
   * Radering är oåterkallelig, så den ska bekräftas. Alert finns inte på webben,
   * så där används confirm.
   */
  const confirmRemove = (campaignId: string, title: string) => {
    setError(null);
    const message = `Radera "${title}"? Det går inte att ångra.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(message)) remove.mutate(campaignId);
      return;
    }
    Alert.alert('Radera kampanjen', message, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Radera', style: 'destructive', onPress: () => remove.mutate(campaignId) },
    ]);
  };

  const data = business.data;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title={data?.companyName ?? 'Företag'} onBack={() => router.back()} />

      {business.isLoading ? <Loading /> : null}
      {business.isError ? (
        <ErrorState message="Kunde inte hämta företaget." onRetry={() => void business.refetch()} />
      ) : null}

      {data ? (
        <>
          <Card>
            <DetailRow label="Org.nr" value={data.orgNumber} />
            <DetailRow label="Stad" value={data.city} />
            <DetailRow label="Kontakt" value={data.contactName} />
            {data.websiteUrl ? <DetailRow label="Hemsida" value={data.websiteUrl} /> : null}
            {data.description ? <Body>{data.description}</Body> : null}
          </Card>

          <View style={styles.section}>
            <Label>KAMPANJER</Label>
            <Button
              label="Skapa kampanj åt dem"
              onPress={() => router.push(`/admin/campaign-new?businessId=${data.id}`)}
            />

            {data.campaigns.length === 0 ? <Body>Inga kampanjer än.</Body> : null}

            {data.campaigns.map((campaign) => (
              <View key={campaign.id} style={styles.campaign}>
                <View style={styles.campaignHead}>
                  <Text style={styles.title} numberOfLines={1}>
                    {campaign.title}
                  </Text>
                  <StatusBadge
                    label={STATUS_LABELS[campaign.status]}
                    tone={STATUS_TONES[campaign.status]}
                  />
                </View>
                <Text style={styles.meta}>
                  {formatSek(campaign.budgetPerCreator)} · {campaign.slotsFilled} av{' '}
                  {campaign.slots} platser · {campaign.contracts} avtal
                </Text>

                <View style={styles.actions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Ändra kampanjen"
                    onPress={() => router.push(`/admin/campaign-new?campaignId=${campaign.id}`)}
                  >
                    <Text style={styles.action}>Ändra</Text>
                  </Pressable>
                  {campaign.status === 'ACTIVE' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Pausa kampanjen"
                      onPress={() =>
                        setStatus.mutate({ campaignId: campaign.id, status: 'PAUSED' })
                      }
                    >
                      <Text style={styles.action}>Pausa</Text>
                    </Pressable>
                  ) : campaign.status !== 'CLOSED' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Publicera kampanjen"
                      onPress={() =>
                        setStatus.mutate({ campaignId: campaign.id, status: 'ACTIVE' })
                      }
                    >
                      <Text style={styles.action}>Publicera</Text>
                    </Pressable>
                  ) : null}
                  {/*
                    Radering bara när inget avtal hänger på kampanjen – annars
                    skulle ett signerat åtagande försvinna med den. API:et
                    vägrar oavsett vad appen visar.
                  */}
                  {campaign.contracts === 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Radera kampanjen"
                      onPress={() => confirmRemove(campaign.id, campaign.title)}
                    >
                      <Text style={styles.danger}>Radera</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Avsluta kampanjen"
                      onPress={() =>
                        setStatus.mutate({ campaignId: campaign.id, status: 'CLOSED' })
                      }
                    >
                      <Text style={styles.action}>Avsluta</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: spacing.md },
  section: { gap: spacing.sm },
  campaign: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  campaignHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...type.listTitle, color: colors.text, flexShrink: 1 },
  meta: { ...type.secondary, color: colors.muted },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: { ...type.bodySmall, color: colors.primary },
  danger: { ...type.bodySmall, color: colors.danger },
  error: { ...type.secondary, color: colors.danger },
});
