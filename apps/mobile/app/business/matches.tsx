import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { Body, Caption, EmptyState, ErrorState, Loading, Screen } from '../../src/components/ui';
import { formatSek } from '../../src/format';
import { colors, radius, spacing, typography } from '../../src/theme';
import type { Match } from '../../src/types';

export default function BusinessMatches() {
  const router = useRouter();
  const matches = useQuery({ queryKey: ['matches'], queryFn: () => api.get<Match[]>('/matches') });

  if (matches.isLoading) return <Screen><Loading /></Screen>;
  if (matches.isError) {
    return (
      <Screen>
        <ErrorState message="Kunde inte hämta dina matchningar." onRetry={() => void matches.refetch()} />
      </Screen>
    );
  }

  const data = matches.data ?? [];
  if (data.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="heart-outline"
          title="Inga matchningar ännu"
          message="Swipa på kreatörer i en av dina kampanjer. När ni båda swipat höger dyker matchningen upp här."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(match) => match.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/match/${item.id}`)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowText}>
              <Text style={styles.title}>{item.influencer.displayName}</Text>
              <Caption>
                {item.campaign.title} · {item.influencer.city} ·{' '}
                {formatSek(item.campaign.budgetPerCreator)}
              </Caption>
              <Body muted>{item.lastMessage ?? item.matchReason}</Body>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{Math.round(item.matchScore)}</Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

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
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...typography.label, color: colors.accent },
});
