import { CATEGORIES, type Category } from '@pacta/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { DemoBanner } from '../../src/components/DemoBanner';
import { LockIcon, PlusIcon } from '../../src/components/icons';
import {
  Avatar,
  Body,
  Button,
  Card,
  Chip,
  ErrorState,
  Header,
  Loading,
  Photo,
  Rating,
  Screen,
} from '../../src/components/ui';
import { CATEGORY_LABELS, formatFollowers, formatSek } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { InfluencerProfile, OwnBusinessProfile, RatingSummary } from '../../src/types';

type Browsable = InfluencerProfile & { rating: RatingSummary };

/**
 * Restaurangens ingång.
 *
 * Tidigare landade ett nytt företagskonto direkt i kampanjguiden och kastades
 * sedan in i en kortlek. Man fick alltså binda sig innan man sett om det ens
 * fanns någon att samarbeta med. Här är utbudet först, i den egna staden, och
 * kampanjen skriver man när man vet vad man köper.
 */
export default function BusinessDiscover() {
  const { user } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [nearby, setNearby] = useState(true);

  const profile = useQuery({
    queryKey: ['own-business'],
    queryFn: () => api.get<OwnBusinessProfile>('/me/business-profile'),
  });

  const city = profile.data?.city ?? '';
  const creators = useQuery({
    queryKey: ['browse-influencers', nearby ? city : '', category],
    queryFn: () => {
      const params = new URLSearchParams();
      if (nearby && city) params.set('city', city);
      if (category) params.set('category', category);
      return api.get<Browsable[]>(`/influencers?${params.toString()}`);
    },
    enabled: profile.isSuccess,
  });

  const data = creators.data ?? [];

  return (
    <Screen>
      <Header
        title="Upptäck"
        large
        subtitle={
          creators.isSuccess
            ? `${data.length} ${data.length === 1 ? 'kreatör' : 'kreatörer'}${
                nearby && city ? ` i ${city}` : ''
              }`
            : 'Kreatörer att samarbeta med'
        }
      />

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            {/*
              En rad som scrollar i sidled. Tretton nischer staplade på varandra
              sköt ned första kreatören under skärmkanten, och utbudet är det
              man kom hit för att se.
            */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {city ? (
                <Chip
                  label={city}
                  selected={nearby}
                  onPress={() => setNearby((current) => !current)}
                />
              ) : null}
              {CATEGORIES.map((item) => (
                <Chip
                  key={item}
                  label={CATEGORY_LABELS[item]}
                  selected={category === item}
                  onPress={() => setCategory((current) => (current === item ? null : item))}
                />
              ))}
            </ScrollView>

            {creators.isLoading ? <Loading /> : null}
            {creators.isError ? (
              <ErrorState
                message="Kunde inte hämta kreatörerna."
                onRetry={() => void creators.refetch()}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          creators.isSuccess ? (
            <Card>
              <Text style={styles.emptyTitle}>Ingen som matchar just det</Text>
              <Body>
                Prova utan filter, eller skapa ett samarbete ändå – kreatörer ser era kampanjer och
                kan söka själva.
              </Body>
            </Card>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Card tone="raised">
              <Text style={styles.footerTitle}>Redo att samarbeta?</Text>
              <Body>
                Beskriv vad ni vill ha i två meningar, så föreslår vi rubrik, brief och ersättning.
                Ni ändrar fritt innan ni publicerar.
              </Body>
              <Button
                label="Skapa samarbete"
                icon={<PlusIcon size={18} color={colors.ink} />}
                onPress={() => router.push('/campaign/new')}
              />
              <View style={styles.trust}>
                <LockIcon size={14} color={colors.positive} />
                <Text style={styles.secondary}>
                  Inget kostar något förrän ett avtal signerats. Arvodet ligger spärrat tills ni
                  godkänt leveransen.
                </Text>
              </View>
            </Card>
            <DemoBanner />
          </View>
        }
        renderItem={({ item }) => <CreatorRow creator={item} />}
      />
    </Screen>
  );
}

/** En rad per kreatör: bild, räckvidd, pris. Tryck öppnar hela profilen. */
function CreatorRow({ creator }: { creator: Browsable }) {
  const hero = creator.showcase.find((entry) => entry.thumbnailUrl)?.thumbnailUrl ?? null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Öppna ${creator.displayName}s profil`}
      onPress={() =>
        router.push({
          pathname: '/creator/[id]',
          params: { id: creator.id, name: creator.displayName },
        })
      }
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Photo uri={hero ?? creator.avatarUrl} name={creator.displayName} style={styles.thumb} />

      <View style={styles.rowText}>
        <View style={styles.nameRow}>
          <Avatar uri={creator.avatarUrl} name={creator.displayName} size={22} />
          <Text style={styles.name} numberOfLines={1}>
            {creator.displayName}
          </Text>
        </View>
        <Rating summary={creator.rating} size={11} emptyLabel="Inga omdömen än" />
        <Text style={styles.meta} numberOfLines={1}>
          {formatFollowers(creator.followers)} följare · {formatFollowers(creator.avgViews)}{' '}
          visningar i snitt
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {creator.categories
            .slice(0, 2)
            .map((item) => CATEGORY_LABELS[item] ?? item)
            .join(', ')}
        </Text>
        <Text style={styles.price}>Från {formatSek(creator.priceMin)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  header: { gap: spacing.md, paddingBottom: spacing.sm },
  headerScroll: { marginHorizontal: -spacing.base },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.base },

  row: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  pressed: { opacity: 0.8 },
  thumb: { width: 76, height: 100, borderRadius: radius.control },
  rowText: { flex: 1, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...type.listTitle, color: colors.text, flexShrink: 1 },
  meta: { ...type.secondary, color: colors.muted },
  price: { fontFamily: type.rowTitle.fontFamily, fontSize: 14, color: colors.accent },
  secondary: { ...type.secondary, color: colors.muted, flex: 1 },

  footer: { gap: spacing.md, paddingTop: spacing.md },
  footerTitle: { ...type.sectionTitle, color: colors.text },
  emptyTitle: { ...type.listTitle, color: colors.text },
  trust: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
