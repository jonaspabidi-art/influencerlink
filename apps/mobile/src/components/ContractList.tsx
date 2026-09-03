import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { formatDate, formatSek } from '../format';
import { colors, radius, spacing, type } from '../theme';
import type { Contract } from '../types';
import { Button, ErrorState, Header, Loading, Screen } from './ui';

/** Statusetiketter i den ordning avtalet faktiskt rör sig. */
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
  DRAFT: colors.muted,
  SENT: colors.accent,
  PARTIALLY_SIGNED: colors.accent,
  ACTIVE: colors.positive,
  DELIVERED: colors.accent,
  COMPLETED: colors.positive,
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
        <Header title="Avtal" large />
        <Loading />
      </Screen>
    );
  }
  if (contracts.isError) {
    return (
      <Screen>
        <Header title="Avtal" large />
        <ErrorState message="Kunde inte hämta avtalen." onRetry={() => void contracts.refetch()} />
      </Screen>
    );
  }

  const data = contracts.data ?? [];

  if (data.length === 0) {
    return (
      <Screen>
        <Header title="Avtal" large subtitle="Inga avtal ännu" />
        <View style={styles.emptyBody}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {role === 'BUSINESS' ? 'Skicka ditt första avtal' : 'Inget att signera ännu'}
            </Text>
            <Text style={styles.emptyText}>
              {role === 'BUSINESS'
                ? 'Öppna en matchning och skicka ett avtal när ni kommit överens om upplägget. Avtalet signeras med BankID av båda parter.'
                : 'När restaurangen skickat ett avtal hamnar det här. Du signerar med BankID och pengarna spärras innan du börjar jobba.'}
            </Text>
            <Button
              label={role === 'BUSINESS' ? 'Till matchningar' : 'Till matchningar'}
              onPress={() => router.push(role === 'BUSINESS' ? '/business/matches' : '/influencer/matches')}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Avtal" large subtitle={`${data.length} totalt`} />
      <FlatList
        data={data}
        keyExtractor={(contract) => contract.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/contract/${item.id}`)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowText}>
              <Text style={styles.title}>{item.campaignTitle}</Text>
              <Text style={styles.secondary}>
                {role === 'BUSINESS' ? item.influencerName : item.businessName} · deadline{' '}
                {formatDate(item.dueDate)}
              </Text>
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
  list: { gap: 10, paddingHorizontal: spacing.base, paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
  },
  pressed: { opacity: 0.9 },
  rowText: { flex: 1, gap: 2 },
  title: { ...type.listTitle, fontSize: 16, color: colors.text },
  secondary: { ...type.secondary, color: colors.muted },
  status: { fontFamily: type.listTitle.fontFamily, fontSize: 13 },
  amount: { fontFamily: type.rowTitle.fontFamily, fontSize: 16, color: colors.text },

  emptyBody: { flex: 1, paddingHorizontal: spacing.base },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 22,
    gap: 14,
  },
  emptyTitle: { ...type.sectionTitle, color: colors.text },
  emptyText: { ...type.bodySmall, color: colors.muted },
});
