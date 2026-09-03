import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { formatDate, formatSek } from '../format';
import { colors, radius, spacing, typography } from '../theme';
import type { Contract } from '../types';
import { Caption, EmptyState, ErrorState, Loading, Screen } from './ui';

/** Statusetiketter på svenska, i den ordning avtalet faktiskt rör sig. */
const STATUS_LABELS: Record<Contract['status'], string> = {
  DRAFT: 'Utkast',
  SENT: 'Väntar på signaturer',
  PARTIALLY_SIGNED: 'En part har signerat',
  ACTIVE: 'Pågår',
  DELIVERED: 'Levererat – väntar på godkännande',
  COMPLETED: 'Klart och utbetalt',
  CANCELLED: 'Avbrutet',
};

const STATUS_COLORS: Record<Contract['status'], string> = {
  DRAFT: colors.textMuted,
  SENT: colors.accent,
  PARTIALLY_SIGNED: colors.accent,
  ACTIVE: colors.success,
  DELIVERED: colors.accent,
  COMPLETED: colors.success,
  CANCELLED: colors.danger,
};

export function ContractList({ role }: { role: 'INFLUENCER' | 'BUSINESS' }) {
  const router = useRouter();
  const contracts = useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.get<Contract[]>('/contracts'),
  });

  if (contracts.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (contracts.isError) {
    return (
      <Screen>
        <ErrorState message="Kunde inte hämta avtalen." onRetry={() => void contracts.refetch()} />
      </Screen>
    );
  }

  const data = contracts.data ?? [];
  if (data.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="document-text-outline"
          title="Inga avtal ännu"
          message={
            role === 'BUSINESS'
              ? 'Öppna en matchning och skicka ett avtal när ni kommit överens.'
              : 'När restaurangen skickar ett avtal hamnar det här för signering.'
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(contract) => contract.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/contract/${item.id}`)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowText}>
              <Text style={styles.title}>{item.campaignTitle}</Text>
              <Caption>
                {role === 'BUSINESS' ? item.influencerName : item.businessName} · deadline{' '}
                {formatDate(item.dueDate)}
              </Caption>
              <Text style={[styles.status, { color: STATUS_COLORS[item.status] }]}>
                {STATUS_LABELS[item.status]}
              </Text>
            </View>
            <Text style={styles.amount}>
              {formatSek(role === 'BUSINESS' ? item.fee : item.payout)}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

export { STATUS_LABELS as CONTRACT_STATUS_LABELS };

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingVertical: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowPressed: { opacity: 0.8 },
  rowText: { flex: 1, gap: 2 },
  title: { ...typography.label, color: colors.text, fontSize: 16 },
  status: { ...typography.caption, fontWeight: '600' },
  amount: { ...typography.heading, color: colors.text, fontSize: 16 },
});
