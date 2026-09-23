import { CATEGORIES, describeReliability, type Category } from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ownBusinessQuery } from '../../src/queries';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { getItem, setItem } from '../../src/storage';
import { PlacePicker } from '../../src/components/PlacePicker';
import { useTourAnchor } from '../../src/tour/Tour';
import { DemoBanner } from '../../src/components/DemoBanner';
import { PlusIcon, SlidersIcon, SparkIcon } from '../../src/components/icons';
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
import { CATEGORY_LABELS, formatDate, formatFollowers, formatSek } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { InfluencerProfile, RatingSummary, SwipeResult } from '../../src/types';

/** Var listan senast stod, och orterna man rört sig mellan. */
const PLACE_KEY = 'pacta.discover.place';
/** Fler än så är ingen genväg längre, det är en lista att leta i. */
const MAX_RECENT_PLACES = 4;

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
  // Rundturen pekar hit när den förklarar hur ett samarbete startas.
  const createAnchor = useTourAnchor('business.create');
  const [category, setCategory] = useState<Category | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const profile = useQuery(ownBusinessQuery());

  /*
   * Orten är ett eget val, inte ett filter bland andra.
   *
   * Den börjar på företagets egen stad men går att byta – en restaurang som
   * öppnar i Stockholm letar där innan de flyttat. Valet sparas i telefonen
   * så att listan öppnas där man var sist.
   */
  const [city, setCity] = useState<string | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  useEffect(() => {
    void (async () => {
      const saved = await getItem(PLACE_KEY);
      if (saved !== null) {
        const parsed = JSON.parse(saved) as { city: string; recents: string[] };
        setCity(parsed.city);
        setRecents(parsed.recents ?? []);
      }
    })().catch(() => undefined);
  }, []);

  const home = profile.data?.city ?? '';
  const activeCity = city ?? home;
  const chooseCity = (next: string) => {
    setCity(next);
    const nextRecents = [next, ...recents.filter((item) => item !== next && item !== '')]
      .filter(Boolean)
      .slice(0, MAX_RECENT_PLACES);
    setRecents(nextRecents);
    void setItem(PLACE_KEY, JSON.stringify({ city: next, recents: nextRecents }));
  };

  const creators = useQuery({
    queryKey: ['browse-influencers', activeCity, category],
    queryFn: () => {
      const params = new URLSearchParams();
      if (activeCity) params.set('city', activeCity);
      if (category) params.set('category', category);
      return api.get<Browsable[]>(`/influencers?${params.toString()}`);
    },
    enabled: profile.isSuccess,
  });

  const data = creators.data ?? [];
  const waiting = data.filter((creator) => creator.interest !== null).length;
  // Bara ett pekfinger, inte produkten själv: den som vill ha någon varje
  // månad ska hamna på sidan som förklarar det, inte i en lista med
  // kampanjknappar.
  const retainerCount = data.filter(
    (creator) => creator.acceptsRetainers && creator.retainerSlots > 0,
  ).length;

  return (
    <Screen>
      <Header
        title="Kreatörer"
        large
        subtitle={
          creators.isSuccess
            ? `${data.length} ${data.length === 1 ? 'kreatör' : 'kreatörer'}`
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
              Var och vad, åtskilda. Förut låg orten som ett chip bredvid tretton
              nischer, alla lika stora och lika utseende – man fick läsa varje
              knapp för att se vilken sorts val den var.
            */}
            <View style={styles.controls}>
              <PlacePicker city={activeCity} recents={recents} onChange={chooseCity} />
              <Pressable
                accessibilityRole="button"
                onPress={() => setFilterOpen(true)}
                style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
              >
                <SlidersIcon size={16} color={category ? colors.ink : colors.text} />
                <Text style={[styles.filterLabel, category ? styles.filterLabelOn : null]}>
                  {category ? CATEGORY_LABELS[category] : 'Filter'}
                </Text>
              </Pressable>
            </View>

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
                Prova utan filter, eller skapa ett samarbete ändå – kreatörer ser era kampanjer
                och kan söka själva.
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
            {retainerCount > 0 ? (
              <Card tone="raised">
                <Text style={styles.footerTitle}>Vill ni ha någon varje månad?</Text>
                <Body>
                  {retainerCount} av dem tar även löpande uppdrag och producerar innehåll till
                  era egna kanaler i stället för sina. Det är ett annat upplägg, med en egen
                  sida.
                </Body>
                <Button
                  label="Läs om löpande uppdrag"
                  variant="secondary"
                  onPress={() => router.push('/retainer/start')}
                />
              </Card>
            ) : null}

            <View ref={createAnchor.ref}>
              <Card tone="raised">
                <Text style={styles.footerTitle}>Redo att samarbeta?</Text>
                <Body>Beskriv vad ni vill ha i två meningar, så skriver vi kampanjen åt er.</Body>
                <Button
                  label="Skapa samarbete"
                  icon={<PlusIcon size={18} color={colors.ink} />}
                  onPress={() => router.push('/campaign/new')}
                />
              </Card>
            </View>
            <DemoBanner />
          </View>
        }
        renderItem={({ item }) => <CreatorRow creator={item} />}
      />

      {/*
        Nischerna i ett blad i stället för en rad man måste scrolla förbi.
        De flesta rör dem aldrig, och de som gör det gör det en gång.
      */}
      <Modal
        visible={filterOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setFilterOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Vilken sorts kreatör?</Text>
          <View style={styles.filterRowWrap}>
            {CATEGORIES.map((item) => (
              <Chip
                key={item}
                label={CATEGORY_LABELS[item]}
                selected={category === item}
                onPress={() => {
                  setCategory((current) => (current === item ? null : item));
                  setFilterOpen(false);
                }}
              />
            ))}
          </View>
          <Button
            label={category ? 'Visa alla sorter' : 'Stäng'}
            variant="secondary"
            onPress={() => {
              setCategory(null);
              setFilterOpen(false);
            }}
          />
        </View>
      </Modal>
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

          {/*
            Hur kreatören skött uppdrag mot mat. Står bara där det finns något
            att säga – en tom rad "0 genomförda" hade sett ut som ett omdöme.
          */}
          {describeReliability(creator.reliability) ? (
            <Text style={styles.meta} numberOfLines={1}>
              {describeReliability(creator.reliability)}
            </Text>
          ) : null}

          {/*
            Var kreatören är på väg. Står bara när det finns en resa som inte
            passerat – och det är då den är värd mest, eftersom restaurangen
            kan planera efter den.
          */}
          {creator.travel ? (
            <Text style={styles.travel} numberOfLines={1}>
              {creator.travel.active
                ? `På plats i ${creator.travel.city} till ${formatDate(creator.travel.to)}`
                : `I ${creator.travel.city} ${formatDate(creator.travel.from)}–${formatDate(creator.travel.to)}`}
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
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  filterLabel: { ...type.listTitle, fontSize: 14, color: colors.text },
  filterLabelOn: { color: colors.ink },
  travel: { fontFamily: type.listTitle.fontFamily, fontSize: 13, color: colors.positive },
  backdrop: { flex: 1, backgroundColor: 'rgba(12, 9, 7, 0.45)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.base,
    gap: spacing.md,
  },
  sheetTitle: { ...type.sectionTitle, color: colors.text },
  filterRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
