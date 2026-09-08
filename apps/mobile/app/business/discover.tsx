import { CATEGORIES, type Category } from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ownBusinessQuery } from '../../src/queries';
import { router, useLocalSearchParams } from 'expo-router';
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
import type { InfluencerProfile, RatingSummary, SwipeResult } from '../../src/types';

type Browsable = InfluencerProfile & {
  rating: RatingSummary;
  /** Kreatören har svepat höger på en av era kampanjer och väntar på svar. */
  interest: { campaignId: string; campaignTitle: string } | null;
};

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
  // Kommer man hit från "hitta någon som jobbar löpande" är valet redan gjort.
  const { retainers } = useLocalSearchParams<{ retainers?: string }>();
  const [onlyRetainers, setOnlyRetainers] = useState(retainers === '1');

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
  const waiting = data.filter((creator) => creator.interest !== null).length;

  return (
    <Screen>
      <Header
        title="Kreatörer"
        large
        subtitle={
          creators.isSuccess
            ? `${data.length} ${data.length === 1 ? 'kreatör' : 'kreatörer'}${
                onlyRetainers ? ' som tar löpande uppdrag' : ''
              }${nearby && city ? ` i ${city}` : ''}`
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

            {/*
              Regeln fanns men stod ingenstans: ett företag kan svepa, men bara
              inne i en kampanj, för ett högersvep utan kampanj betyder
              ingenting. Den som väntar på svar är undantaget – där räcker ett
              tryck, och det är värt att säga först.
            */}
            <Text style={styles.explain}>
              {waiting > 0
                ? `${waiting} ${waiting === 1 ? 'kreatör' : 'kreatörer'} har visat intresse för era kampanjer. Tryck Matcha så öppnas en chatt.`
                : 'Här tittar du. En matchning uppstår när ni båda sagt ja – öppna en kampanj och svep, eller bjud in någon direkt.'}
            </Text>

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

/**
 * En rad per kreatör: bild, räckvidd, pris – och en handling.
 *
 * Raden var tidigare en återvändsgränd. Man såg sju personer och ett pris men
 * hade ingenting att trycka på, och enda vägen vidare låg gömd inne i
 * profilen. Nu har varje rad ett verb, och det verbet beror på om kreatören
 * redan sagt ja: då är matchningen ett tryck bort, annars går vägen via en
 * inbjudan till en kampanj.
 */
function CreatorRow({ creator }: { creator: Browsable }) {
  const queryClient = useQueryClient();
  const hero = creator.showcase.find((entry) => entry.thumbnailUrl)?.thumbnailUrl ?? null;

  const match = useMutation({
    mutationFn: () =>
      api.post<SwipeResult>('/swipes', {
        campaignId: creator.interest?.campaignId,
        influencerId: creator.id,
        direction: 'LIKE',
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['browse-influencers'] });
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
      if (result.match) router.push(`/match/${result.match.id}`);
    },
  });

  return (
    /*
      Raden är två saker: en yta som öppnar profilen och en knapp som gör
      något. De får inte ligga i varandra – en knapp inuti en knapp är ogiltig
      på webben, och på mobilen blir det en gissning vilken av dem som svarar.
    */
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Öppna ${creator.displayName}s profil`}
        onPress={() =>
          router.push({
            pathname: '/creator/[id]',
            params: { id: creator.id, name: creator.displayName },
          })
        }
        style={({ pressed }) => [styles.rowTop, pressed && styles.pressed]}
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
          <Text style={styles.price}>Från {formatSek(creator.priceMin)} per samarbete</Text>

          {/* Bristen är sann: platserna är ett tal kreatören själv satt. */}
          {creator.acceptsRetainers && creator.retainerSlots > 0 ? (
            <Text style={styles.retainer} numberOfLines={1}>
              Löpande från {formatSek(creator.retainerPackages[0]?.monthlyRate ?? 0)}/mån ·{' '}
              {creator.retainerSlots} {creator.retainerSlots === 1 ? 'plats' : 'platser'}
            </Text>
          ) : null}

          {creator.interest ? (
            <Text style={styles.interest} numberOfLines={2}>
              Visade intresse för {creator.interest.campaignTitle}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {creator.interest ? (
        <Button label="Matcha" compact onPress={() => match.mutate()} loading={match.isPending} />
      ) : (
        <Button
          label="Bjud in till kampanj"
          variant="secondary"
          compact
          onPress={() =>
            router.push({
              pathname: '/creator/[id]',
              params: { id: creator.id, name: creator.displayName },
            })
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  header: { gap: spacing.md, paddingBottom: spacing.sm },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.base },
  retainer: { ...type.secondary, color: colors.positive },
  interest: { fontFamily: type.listTitle.fontFamily, fontSize: 13, color: colors.primary },
  explain: { ...type.secondary, color: colors.muted },

  row: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  rowTop: { flexDirection: 'row', gap: spacing.md },
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
