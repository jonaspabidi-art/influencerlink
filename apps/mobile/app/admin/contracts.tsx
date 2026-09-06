import { CONTRACT_STATUSES, type ContractStatus } from '@pacta/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { Chip, ErrorState, Header, Loading, Screen, StatusBadge } from '../../src/components/ui';
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_TONES, formatSek } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { AdminContractRow } from '../../src/types';

/** Alla avtal på plattformen, filtrerbara på läge. */
export default function AdminContracts() {
  const [status, setStatus] = useState<ContractStatus | null>(null);

  const contracts = useQuery({
    queryKey: ['admin-contracts', status],
    queryFn: () =>
      api.get<AdminContractRow[]>(`/admin/contracts${status ? `?status=${status}` : ''}`),
  });

  const data = contracts.data ?? [];

  return (
    <Screen>
      <Header title="Avtal" large subtitle={contracts.isSuccess ? `${data.length} st` : ''} />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {CONTRACT_STATUSES.map((item) => (
                <Chip
                  key={item}
                  label={CONTRACT_STATUS_LABELS[item]}
                  selected={status === item}
                  onPress={() => setStatus((current) => (current === item ? null : item))}
                />
              ))}
            </ScrollView>
            {contracts.isLoading ? <Loading /> : null}
            {contracts.isError ? (
              <ErrorState
                message="Kunde inte hämta avtalen."
                onRetry={() => void contracts.refetch()}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Öppna avtalet för ${item.campaignTitle}`}
            onPress={() => router.push(`/admin/contract/${item.id}`)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowHead}>
              <Text style={styles.title} numberOfLines={1}>
                {item.campaignTitle}
              </Text>
              <StatusBadge
                label={CONTRACT_STATUS_LABELS[item.status]}
                tone={CONTRACT_STATUS_TONES[item.status]}
              />
            </View>
            <Text style={styles.meta}>
              {item.businessName} · {item.influencerName}
            </Text>
            <Text style={styles.meta}>
              {formatSek(item.fee)}
              {item.paymentStatus ? ` · ${item.paymentStatus.toLowerCase()}` : ''}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  header: { gap: spacing.sm, paddingBottom: spacing.sm },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.base },
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
});
