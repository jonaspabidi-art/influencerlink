import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import {
  Body,
  Button,
  Caption,
  EmptyState,
  ErrorState,
  Loading,
  Screen,
} from '../../src/components/ui';
import { describeCompensation, formatSek } from '../../src/format';
import { colors, radius, spacing, typography } from '../../src/theme';
import type { Campaign } from '../../src/types';

const STATUS_LABELS: Record<Campaign['status'], string> = {
  DRAFT: 'Utkast',
  ACTIVE: 'Publicerad',
  PAUSED: 'Pausad',
  CLOSED: 'Avslutad',
};

export default function BusinessCampaigns() {
  const router = useRouter();
  const { signOut } = useAuth();
  const campaigns = useQuery({
    queryKey: ['campaigns', 'mine'],
    queryFn: () => api.get<Campaign[]>('/campaigns/mine'),
  });

  if (campaigns.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (campaigns.isError) {
    return (
      <Screen>
        <ErrorState message="Kunde inte hämta kampanjerna." onRetry={() => void campaigns.refetch()} />
      </Screen>
    );
  }

  const data = campaigns.data ?? [];

  if (data.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="megaphone-outline"
          title="Inget samarbete ännu"
          message="Skriv några rader om vad du vill ha så gör vi ett färdigt kampanjförslag åt dig."
        />
        <Button label="Skapa samarbete" onPress={() => router.push('/campaign/new')} />
        <Button label="Logga ut" variant="ghost" onPress={() => void signOut()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={data}
        keyExtractor={(campaign) => campaign.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Button
            label="Nytt samarbete"
            icon="add"
            onPress={() => router.push('/campaign/new')}
          />
        }
        ListFooterComponent={
          <Button label="Logga ut" variant="ghost" onPress={() => void signOut()} />
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.status}>{STATUS_LABELS[item.status]}</Text>
            </View>
            <Caption>
              {describeCompensation(
                item.compensationType,
                item.budgetPerCreator,
                item.productValue,
                formatSek,
              )}{' '}
              · {item.slotsFilled}/{item.slots} platser
            </Caption>
            <Body muted>{item.brief.slice(0, 110)}…</Body>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/campaign/${item.id}`)}
                style={styles.linkButton}
              >
                <Text style={styles.link}>Hantera</Text>
              </Pressable>
              {item.status === 'ACTIVE' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/discover/${item.id}`)}
                  style={styles.linkButton}
                >
                  <Text style={styles.link}>Hitta influencers</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingVertical: spacing.md },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.label, color: colors.text, fontSize: 16, flex: 1 },
  status: { ...typography.caption, color: colors.accent, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.xs },
  linkButton: { paddingVertical: spacing.xs },
  link: { ...typography.label, color: colors.primary },
});
