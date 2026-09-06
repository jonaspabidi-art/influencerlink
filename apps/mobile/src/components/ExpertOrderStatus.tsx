import { EXPERT_ORDER_LABELS } from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { formatSek } from '../format';
import { colors, spacing, type } from '../theme';
import type { ExpertOrder } from '../types';
import { Body, Button, Card, Label } from './ui';

/**
 * Var vårt uppdrag står.
 *
 * Den som lämnat ifrån sig något och betalar för det vill se att det rör på
 * sig. Kortet visas bara medan uppdraget lever – när kampanjen är publicerad
 * ligger den i listan som vilken annan som helst.
 */
export function ExpertOrderStatus() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const orders = useQuery({
    queryKey: ['expert-orders'],
    queryFn: () => api.get<ExpertOrder[]>('/expert-orders/mine'),
  });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/expert-orders/${id}/approve`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expert-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte godkänna.'),
  });

  const order = orders.data?.find(
    (item) => item.status !== 'APPROVED' && item.status !== 'CANCELLED',
  );
  if (!order) return null;

  return (
    <Card tone="raised">
      <Label>PACTA GÖR DET ÅT ER</Label>

      <View style={styles.row}>
        <Text style={styles.status}>{EXPERT_ORDER_LABELS[order.status]}</Text>
        <Text style={styles.secondary}>{formatSek(order.price)}</Text>
      </View>

      {order.status === 'REQUESTED' ? (
        <Body>Vi har fått er beställning och hör av oss inom ett dygn.</Body>
      ) : null}
      {order.status === 'IN_PROGRESS' ? (
        <Body>Vi bygger kampanjen just nu. Ni hör av oss när den är klar att titta på.</Body>
      ) : null}

      {order.status === 'DELIVERED' ? (
        <>
          <Body>
            Kampanjen ligger som utkast i ert konto. Titta igenom den, ändra det ni vill, och
            godkänn den när ni är nöjda – då publiceras den och {formatSek(order.price)} debiteras.
          </Body>
          {order.campaignId ? (
            <Button
              label="Titta på kampanjen"
              variant="secondary"
              onPress={() => router.push(`/campaign/${order.campaignId}`)}
            />
          ) : null}
          <Button
            label="Godkänn och betala"
            onPress={() => {
              setError(null);
              approve.mutate(order.id);
            }}
            loading={approve.isPending}
          />
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  status: { ...type.listTitle, color: colors.text },
  secondary: { ...type.secondary, color: colors.muted },
  error: { ...type.secondary, color: colors.danger, marginTop: spacing.sm },
});
