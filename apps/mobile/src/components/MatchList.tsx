import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api';
import { formatSek } from '../format';
import { colors, radius, spacing, type } from '../theme';
import type { Match } from '../types';
import { Avatar, Button, ErrorState, Header, Loading, Logo, Screen } from './ui';

/** Matchningslistan. Samma komponent för båda rollerna, olika motpart. */
export function MatchList({ role }: { role: 'INFLUENCER' | 'BUSINESS' }) {
  const router = useRouter();
  const matches = useQuery({ queryKey: ['matches'], queryFn: () => api.get<Match[]>('/matches') });

  if (matches.isLoading) {
    return (
      <Screen>
        <Header title="Matchningar" large />
        <Loading />
      </Screen>
    );
  }
  if (matches.isError) {
    return (
      <Screen>
        <Header title="Matchningar" large />
        <ErrorState
          message="Kunde inte hämta dina matchningar."
          onRetry={() => void matches.refetch()}
        />
      </Screen>
    );
  }

  const data = matches.data ?? [];

  if (data.length === 0) {
    return (
      <Screen>
        <Header title="Matchningar" large subtitle="Inga matchningar ännu" />
        <View style={styles.emptyBody}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Här landar era samarbeten</Text>
            <Text style={styles.emptyText}>
              {role === 'INFLUENCER'
                ? 'När en restaurang också svepar höger på dig hamnar samarbetet här, med en chatt där ni kommer överens om detaljerna.'
                : 'Svep på kreatörer i en av dina kampanjer. När ni båda svepat höger öppnas en chatt där ni kommer överens.'}
            </Text>
            <Button
              label={role === 'INFLUENCER' ? 'Till kortleken' : 'Till kampanjerna'}
              onPress={() =>
                router.push(role === 'INFLUENCER' ? '/influencer/swipe' : '/business/campaigns')
              }
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Matchningar" large subtitle={`${data.length} pågående`} />
      <FlatList
        data={data}
        keyExtractor={(match) => match.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/match/${item.id}`)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            {role === 'INFLUENCER' ? <Logo size={44} /> : <Avatar size={44} />}
            <View style={styles.rowText}>
              <Text style={styles.title}>
                {role === 'INFLUENCER' ? item.campaign.businessName : item.influencer.displayName}
              </Text>
              <Text style={styles.secondary} numberOfLines={1}>
                {item.campaign.title}
              </Text>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage ?? item.matchReason}
              </Text>
            </View>
            <Text style={styles.amount}>{formatSek(item.campaign.budgetPerCreator)}</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

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
    padding: spacing.md,
  },
  pressed: { opacity: 0.9 },
  rowText: { flex: 1, gap: 2 },
  title: { ...type.listTitle, fontSize: 16, color: colors.text },
  secondary: { ...type.secondary, color: colors.muted },
  lastMessage: { ...type.secondary, color: colors.dim },
  amount: { fontFamily: type.rowTitle.fontFamily, fontSize: 15, color: colors.accent },

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
