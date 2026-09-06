import { EXPERT_ORDER_LABELS } from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import {
  Body,
  Card,
  ErrorState,
  Field,
  Header,
  Label,
  Loading,
  ScrollScreen,
} from '../../src/components/ui';
import { formatDate, formatSek } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { AdminExpertOrder } from '../../src/types';

/** Kön av företag som betalar för att vi bygger kampanjen åt dem. */
export default function AdminExpertOrders() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [campaignIds, setCampaignIds] = useState<Record<string, string>>({});

  const orders = useQuery({
    queryKey: ['admin-expert-orders'],
    queryFn: () => api.get<AdminExpertOrder[]>('/admin/expert-orders'),
  });

  const update = useMutation({
    mutationFn: (input: { id: string; status: string; campaignId?: string }) =>
      api.post(`/admin/expert-orders/${input.id}`, {
        status: input.status,
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-expert-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte uppdatera uppdraget.'),
  });

  const data = (orders.data ?? []).filter(
    (order) => order.status !== 'APPROVED' && order.status !== 'CANCELLED',
  );

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title="Uppdrag åt oss" onBack={() => router.back()} />

      {orders.isLoading ? <Loading /> : null}
      {orders.isError ? (
        <ErrorState message="Kunde inte hämta kön." onRetry={() => void orders.refetch()} />
      ) : null}
      {orders.isSuccess && data.length === 0 ? <Body>Inget i kön just nu.</Body> : null}

      {data.map((order) => (
        <Card key={order.id}>
          <View style={styles.head}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Öppna ${order.companyName}`}
              onPress={() => router.push(`/admin/business/${order.businessId}`)}
            >
              <Text style={styles.link}>{order.companyName}</Text>
            </Pressable>
            <Text style={styles.status}>{EXPERT_ORDER_LABELS[order.status]}</Text>
          </View>
          <Text style={styles.meta}>
            {order.city} · {formatDate(order.requestedAt)} · {formatSek(order.price)}
          </Text>

          <Label>VAD DE VILL FÅ UT</Label>
          <Body>{order.goal}</Body>
          <Label>NÄR</Label>
          <Body>{order.timing}</Body>
          {order.budget ? (
            <>
              <Label>BUDGET</Label>
              <Body>{order.budget}</Body>
            </>
          ) : null}
          {order.notes ? (
            <>
              <Label>ATT VETA</Label>
              <Body>{order.notes}</Body>
            </>
          ) : null}

          <View style={styles.actions}>
            {order.status === 'REQUESTED' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ta uppdraget"
                onPress={() => update.mutate({ id: order.id, status: 'IN_PROGRESS' })}
              >
                <Text style={styles.action}>Ta uppdraget</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skapa kampanjen"
              onPress={() => router.push(`/admin/campaign-new?businessId=${order.businessId}`)}
            >
              <Text style={styles.action}>Skapa kampanjen</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Avbryt uppdraget"
              onPress={() => update.mutate({ id: order.id, status: 'CANCELLED' })}
            >
              <Text style={styles.danger}>Avbryt</Text>
            </Pressable>
          </View>

          {order.status === 'IN_PROGRESS' ? (
            <>
              <Field
                label="Kampanjens id"
                value={campaignIds[order.id] ?? ''}
                onChangeText={(value) =>
                  setCampaignIds((current) => ({ ...current, [order.id]: value }))
                }
                placeholder="Klistra in id:t från kampanjen du byggt"
                hint="Företaget får den att granska. Den ligger kvar som utkast tills de godkänner."
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Leverera uppdraget"
                onPress={() =>
                  update.mutate({
                    id: order.id,
                    status: 'DELIVERED',
                    campaignId: campaignIds[order.id]?.trim(),
                  })
                }
              >
                <Text style={styles.action}>Leverera</Text>
              </Pressable>
            </>
          ) : null}
        </Card>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  link: { ...type.listTitle, color: colors.primary },
  status: { ...type.secondary, color: colors.muted },
  meta: { ...type.secondary, color: colors.muted },
  actions: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  action: { ...type.bodySmall, color: colors.primary },
  danger: { ...type.bodySmall, color: colors.danger },
  error: { ...type.secondary, color: colors.danger },
});
