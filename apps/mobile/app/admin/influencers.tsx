import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { ErrorState, Field, Header, Loading, Screen, Tag } from '../../src/components/ui';
import { formatFollowers } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { AdminInfluencerRow } from '../../src/types';

/** Alla kreatörer. Märkta med om siffrorna är verifierade eller påhittade. */
export default function AdminInfluencers() {
  const [query, setQuery] = useState('');

  const influencers = useQuery({
    queryKey: ['admin-influencers', query],
    queryFn: () =>
      api.get<AdminInfluencerRow[]>(
        `/admin/influencers${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`,
      ),
  });

  const data = influencers.data ?? [];

  return (
    <Screen>
      <Header title="Kreatörer" large subtitle={influencers.isSuccess ? `${data.length} st` : ''} />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Field label="Sök" value={query} onChangeText={setQuery} placeholder="Namn eller stad" />
            {influencers.isLoading ? <Loading /> : null}
            {influencers.isError ? (
              <ErrorState
                message="Kunde inte hämta kreatörerna."
                onRetry={() => void influencers.refetch()}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Öppna ${item.displayName}`}
            onPress={() => router.push(`/admin/influencer/${item.id}`)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowHead}>
              <Text style={styles.title}>{item.displayName}</Text>
              <Tag
                label={item.statsVerified ? 'Verifierad' : 'Ogranskad'}
                tone={item.statsVerified ? 'filled' : 'dashed'}
              />
            </View>
            <Text style={styles.meta}>
              {item.city} · {formatFollowers(item.followers)} följare
            </Text>
            <Text style={styles.meta}>
              {item.contracts} avtal · {item.payoutsReady ? 'utbetalning klar' : 'saknar utbetalningskonto'}
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
