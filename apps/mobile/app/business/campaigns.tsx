import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { DemoBanner } from '../../src/components/DemoBanner';
import { PlusIcon } from '../../src/components/icons';
import {
  Button,
  Card,
  ErrorState,
  Header,
  Loading,
  Screen,
  StatusBadge,
  type StatusTone,
} from '../../src/components/ui';
import { describeCompensation, formatSek } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { Campaign } from '../../src/types';

const STATUS_LABELS: Record<Campaign['status'], string> = {
  DRAFT: 'Utkast',
  ACTIVE: 'Publicerad',
  PAUSED: 'Pausad',
  CLOSED: 'Avslutad',
};

const STATUS_TONES: Record<Campaign['status'], StatusTone> = {
  DRAFT: 'pending',
  ACTIVE: 'active',
  PAUSED: 'pending',
  CLOSED: 'cancelled',
};

export default function BusinessCampaigns() {
  const router = useRouter();
  const campaigns = useQuery({
    queryKey: ['campaigns', 'mine'],
    queryFn: () => api.get<Campaign[]>('/campaigns/mine'),
  });

  if (campaigns.isLoading) {
    return (
      <Screen>
        <Header title="Kampanjer" large />
        <Loading />
      </Screen>
    );
  }
  if (campaigns.isError) {
    return (
      <Screen>
        <Header title="Kampanjer" large />
        <ErrorState
          message="Kunde inte hämta kampanjerna."
          onRetry={() => void campaigns.refetch()}
        />
      </Screen>
    );
  }

  const data = campaigns.data ?? [];

  if (data.length === 0) {
    return (
      <Screen>
        <Header title="Kampanjer" large subtitle="Inget samarbete ännu" />
        <View style={styles.emptyBody}>
          <Card>
            <Text style={styles.emptyTitle}>Skriv två meningar, få en färdig kampanj</Text>
            <Text style={styles.emptyText}>
              Beskriv vad du vill ha som du skulle sagt det till en kollega. Vi föreslår rubrik,
              brief och ersättning – sedan ändrar du fritt innan du publicerar.
            </Text>
            <Button
              label="Skapa samarbete"
              icon={<PlusIcon size={18} color={colors.ink} />}
              onPress={() => router.push('/campaign/new')}
            />
            <Button
              label="Se kreatörer först"
              variant="secondary"
              onPress={() => router.push('/business/discover')}
            />
          </Card>
          <DemoBanner />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Kampanjer"
        large
        subtitle={`${data.filter((item) => item.status === 'ACTIVE').length} publicerade`}
      />
      <FlatList
        data={data}
        keyExtractor={(campaign) => campaign.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Button
            label="Nytt samarbete"
            icon={<PlusIcon size={18} color={colors.ink} />}
            onPress={() => router.push('/campaign/new')}
          />
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <DemoBanner />
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.title}>{item.title}</Text>
              <StatusBadge label={STATUS_LABELS[item.status]} tone={STATUS_TONES[item.status]} />
            </View>
            <Text style={styles.amount}>
              {describeCompensation(
                item.compensationType,
                item.budgetPerCreator,
                item.productValue,
                formatSek,
              )}
            </Text>
            <Text style={styles.secondary}>
              {item.slotsFilled} av {item.slots} platser fyllda · {item.city}
            </Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/campaign/${item.id}`)}
                hitSlop={8}
              >
                <Text style={styles.link}>Hantera</Text>
              </Pressable>
              {item.status === 'ACTIVE' ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push(`/discover/${item.id}`)}
                  hitSlop={8}
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
  list: { gap: 10, paddingHorizontal: spacing.base, paddingBottom: spacing.xl },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.base,
    gap: 6,
  },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...type.listTitle, fontSize: 16, color: colors.text, flex: 1 },
  amount: { fontFamily: type.rowTitle.fontFamily, fontSize: 17, color: colors.accent },
  secondary: { ...type.secondary, color: colors.muted },
  actions: { flexDirection: 'row', gap: spacing.base, paddingTop: 6 },
  link: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.primary },
  footer: { gap: spacing.md, paddingTop: spacing.sm },

  emptyBody: { flex: 1, paddingHorizontal: spacing.base, gap: spacing.md },
  emptyTitle: { ...type.sectionTitle, color: colors.text },
  emptyText: { ...type.bodySmall, color: colors.muted },
});
