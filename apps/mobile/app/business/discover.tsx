import { CATEGORIES, type Category } from '@pacta/shared';
import { useQuery } from '@tanstack/react-query';
import { ownBusinessQuery } from '../../src/queries';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { DemoBanner } from '../../src/components/DemoBanner';
import { PlusIcon, SparkIcon } from '../../src/components/icons';
import {
  Avatar,
  Body,
  Button,
  Card,
  Chip,
  ErrorState,
  Header,
  IconButton,
  Loading,
  Photo,
  Rating,
  Screen,
} from '../../src/components/ui';
import { CATEGORY_LABELS, formatFollowers, formatSek } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { InfluencerProfile, RatingSummary } from '../../src/types';

type Browsable = InfluencerProfile & { rating: RatingSummary };

/**
 * Företagets ingång.
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
  const [onlyRetainers, setOnlyRetainers] = useState(false);

  const profile = useQuery(ownBusinessQuery());

  const city = profile.data?.city ?? '';
  const creators = useQuery({
    queryKey: ['browse-influencers', nearby ? city : '', category, onlyRetainers],
    queryFn: () => {
      const params = new URLSearchParams();
      if (nearby && city) params.set('city', city);
      if (category) params.set('category', category);
      if (onlyRetainers) params.set('retainers', '1');
      return api.get<Browsable[]>(`/influencers?${params.toString()}`);
    },
    enabled: profile.isSuccess,
  });

  const data = creators.data ?? [];

  return (
    <Screen>
      <Header
        title="Kreatörer"
        large
        subtitle={
          creators.isSuccess
            ? `${data.length} ${data.length === 1 ? 'kreatör' : 'kreatörer'}${
                nearby && city ? ` i ${city}` : ''
              }`
            : 'Kreatörer att samarbeta med'
        }
        /*
          Rådgivaren som ikon i stället för en egen rad.
          Den tävlade om samma beslut som listan: en full bredd med "fråga oss
          i stället" innan man ens hunnit titta. Som ikon finns den kvar för
          den som fastnar, utan att stå i vägen för den som bara vill bläddra.
        */
        right={
          <IconButton label="Fråga Pacta om vem du ska välja" onPress={() => router.push('/assistant')}>
            <SparkIcon size={20} color={colors.accent} />
          </IconButton>
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
              hade tagit hela skärmen innan man sett en enda kreatör.
            */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {/*
                Först i raden, före stad och nisch: det är ett annat sorts köp
                än en kampanj, och den som kommit hit för att hitta någon som
                jobbar varje vecka ska inte behöva öppna profiler en och en för
                att se vem som är öppen.
              */}
              <Chip
                label="Tar löpande uppdrag"
                selected={onlyRetainers}
                onPress={() => setOnlyRetainers((current) => !current)}
              />
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
                {onlyRetainers
                  ? 'Ingen i listan har en ledig plats för löpande uppdrag just nu. Ta bort filtret för att se alla, eller skapa en enstaka kampanj så länge.'
                  : 'Prova utan filter, eller skapa ett samarbete ändå – kreatörer ser era kampanjer och kan söka själva.'}
              </Body>
            </Card>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {/*
              En uppmaning under listan, inte fyra runt den. Trygghetstexten
              stod här också och upprepade det som redan står i kortleken och i
              kampanjguiden – tre gånger samma mening gör den inte tryggare.
            */}
            <Card tone="raised">
              <Text style={styles.footerTitle}>Redo att samarbeta?</Text>
              <Body>Beskriv vad ni vill ha i två meningar, så skriver vi kampanjen åt er.</Body>
              <Button
                label="Skapa samarbete"
                icon={<PlusIcon size={18} color={colors.ink} />}
                onPress={() => router.push('/campaign/new')}
              />
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

        {/* Bristen är sann: platserna är ett tal hon själv satt. */}
        {creator.acceptsRetainers && creator.retainerSlots > 0 ? (
          <Text style={styles.retainer} numberOfLines={1}>
            Löpande från {formatSek(creator.retainerPackages[0]?.monthlyRate ?? 0)}/mån ·{' '}
            {creator.retainerSlots} {creator.retainerSlots === 1 ? 'plats' : 'platser'}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  header: { gap: spacing.md, paddingBottom: spacing.sm },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.base },
  retainer: { ...type.secondary, color: colors.positive },

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

  footer: { gap: spacing.md, paddingTop: spacing.md },
  footerTitle: { ...type.sectionTitle, color: colors.text },
  emptyTitle: { ...type.listTitle, color: colors.text },
});
