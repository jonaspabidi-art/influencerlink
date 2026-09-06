import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { ErrorState, Field, Header, Loading, Screen } from '../../src/components/ui';
import { colors, radius, spacing, type } from '../../src/theme';
import type { AdminBusinessRow } from '../../src/types';

/** Alla företag på plattformen, sökbara på namn, org.nr och stad. */
export default function AdminBusinesses() {
  const [query, setQuery] = useState('');

  const businesses = useQuery({
    queryKey: ['admin-businesses', query],
    queryFn: () =>
      api.get<AdminBusinessRow[]>(
        `/admin/businesses${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`,
      ),
  });

  const data = businesses.data ?? [];

  return (
    <Screen>
      <Header title="Företag" large subtitle={businesses.isSuccess ? `${data.length} st` : ''} />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Field
              label="Sök"
              value={query}
              onChangeText={setQuery}
              placeholder="Namn, org.nr eller stad"
            />
            {businesses.isLoading ? <Loading /> : null}
            {businesses.isError ? (
              <ErrorState
                message="Kunde inte hämta företagen."
                onRetry={() => void businesses.refetch()}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Öppna ${item.companyName}`}
            onPress={() => router.push(`/admin/business/${item.id}`)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.title}>{item.companyName}</Text>
            <Text style={styles.meta}>
              {item.city} · org.nr {item.orgNumber}
            </Text>
            <Text style={styles.meta}>
              {item.campaigns} kampanjer · {item.contracts} avtal
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
  pressed: { opacity: 0.8 },
  title: { ...type.listTitle, color: colors.text },
  meta: { ...type.secondary, color: colors.muted },
});
