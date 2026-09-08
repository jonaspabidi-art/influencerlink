import {
  DISCOUNT_CHOICES,
  DISCOUNT_LABELS,
  MIN_RETAINER_BASE_RATE,
  PREPAY_MONTHS,
  RATE_CONFIDENCE_LABELS,
  retainerPackages,
  type DiscountBps,
} from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { SparkIcon } from '../../src/components/icons';
import {
  Body,
  Button,
  Card,
  Divider,
  Field,
  Header,
  Loading,
  ScrollScreen,
} from '../../src/components/ui';
import { formatSek } from '../../src/format';
import { retainerAvailabilityQuery, retainerRateQuery } from '../../src/queries';
import { colors, radius, spacing, type } from '../../src/theme';
import type { RetainerAvailability } from '../../src/types';

/**
 * Kreatörens läge för löpande uppdrag.
 *
 * Ett tal att fylla i, inte tre: kreatören säger vad hen vill ha för fyra videor i
 * månaden, och de större paketen kostar rakt av så många gånger mer. Vill kreatören
 * belöna volym eller förskott gör kreatören det som ett eget val, under Dina
 * rabatter – båda dras på kreatörens arvode, så ingen av dem får uppstå av sig
 * själv.
 *
 * Platserna är ett riktigt tal. Visar vi en ledig plats ska kreatören kunna ta emot
 * den; en dag i veckan går inte att sälja två gånger.
 */
export default function RetainerAvailabilityScreen() {
  const queryClient = useQueryClient();
  const availability = useQuery(retainerAvailabilityQuery());

  const [enabled, setEnabled] = useState(false);
  const [slots, setSlots] = useState('2');
  const [rate, setRate] = useState('');
  const [prepayDiscount, setPrepayDiscount] = useState<DiscountBps>(0);
  const [volumeDiscount, setVolumeDiscount] = useState<DiscountBps>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const data = availability.data;
    if (!data) return;
    setEnabled(data.acceptsRetainers);
    setSlots(String(data.slots));
    setRate(data.baseRate === null ? '' : String(Math.round(data.baseRate / 100)));
    setPrepayDiscount(data.prepayDiscountBps as DiscountBps);
    setVolumeDiscount(data.volumeDiscountBps as DiscountBps);
  }, [availability.data]);

  const save = useMutation({
    mutationFn: (input: {
      acceptsRetainers: boolean;
      slots: number;
      baseRate: number | null;
      prepayDiscountBps: DiscountBps;
      volumeDiscountBps: DiscountBps;
    }) => api.put<RetainerAvailability>('/me/retainer-availability', input),
    onSuccess: (saved) => {
      queryClient.setQueryData(retainerAvailabilityQuery().queryKey, saved);
      router.back();
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte spara.'),
  });

  if (availability.isLoading) {
    return (
      <ScrollScreen>
        <Header title="Löpande uppdrag" onBack={() => router.back()} />
        <Loading />
      </ScrollScreen>
    );
  }

  const kronor = Number(rate.replace(/\s/g, ''));
  const baseRate = Number.isFinite(kronor) && kronor > 0 ? Math.round(kronor) * 100 : null;
  const packages =
    baseRate !== null && baseRate >= MIN_RETAINER_BASE_RATE
      ? retainerPackages(baseRate, volumeDiscount)
      : [];

  const submit = () => {
    setError(null);
    if (enabled && baseRate === null) {
      return setError('Skriv vad du vill ha i månaden innan du öppnar för uppdrag.');
    }
    if (enabled && baseRate !== null && baseRate < MIN_RETAINER_BASE_RATE) {
      return setError(`Lägsta månadspris är ${formatSek(MIN_RETAINER_BASE_RATE)}.`);
    }
    save.mutate({
      acceptsRetainers: enabled,
      slots: Math.max(0, Math.min(20, Number(slots) || 0)),
      baseRate,
      prepayDiscountBps: prepayDiscount,
      volumeDiscountBps: volumeDiscount,
    });
  };

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title="Löpande uppdrag"
        subtitle="Du producerar åt företagets egna kanaler varje månad"
        onBack={() => router.back()}
      />

      <Card>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled }}
          onPress={() => setEnabled((value) => !value)}
          style={styles.toggleRow}
        >
          <View style={styles.toggleText}>
            <Text style={styles.cardTitle}>Jag tar löpande uppdrag</Text>
            <Text style={styles.secondary}>
              Visas på din profil med lediga platser. Din egen kanal berörs inte.
            </Text>
          </View>
          <View style={[styles.switch, enabled && styles.switchOn]}>
            <View style={[styles.knob, enabled && styles.knobOn]} />
          </View>
        </Pressable>
      </Card>

      {enabled ? (
        <>
          <RateHelp onUse={(suggested) => setRate(String(Math.round(suggested / 100)))} />

          {/* Priset och vad det blir, i ett kort: man skriver ett tal och ser
              vad det betyder utan att leta efter svaret längre ned. */}
          <Card>
            <Text style={styles.cardTitle}>Ditt pris</Text>
            <Field
              label="Per månad för fyra videor"
              value={rate}
              onChangeText={setRate}
              keyboardType="numeric"
              placeholder="6 000"
            />
            <Field
              label="Lediga platser"
              value={slots}
              onChangeText={setSlots}
              keyboardType="numeric"
              hint="Hur många företag du kan ta emot just nu. En dag i veckan var."
            />

            {packages.length > 0 ? (
              <>
                <Divider />
                {packages.map((pack) => (
                  <View key={pack.videosPerMonth} style={styles.packRow}>
                    <View style={styles.packText}>
                      <Text style={styles.packTitle}>{pack.videosPerMonth} videor i månaden</Text>
                      <Text style={styles.secondary}>
                        {formatSek(Math.round(pack.monthlyRate / pack.videosPerMonth))} per video
                      </Text>
                    </View>
                    <Text style={styles.packPrice}>{formatSek(pack.monthlyRate)}</Text>
                  </View>
                ))}
                <Text style={styles.footnote}>
                  Från beloppen dras 10 % i förmedlingsavgift. Du får{' '}
                  {formatSek(Math.round((packages[0]?.monthlyRate ?? 0) * 0.9))} av grundpaketet.
                </Text>
              </>
            ) : null}
          </Card>

          {/*
            Båda rabatterna på ett ställe, båda kreatörens.
            Volymrabatten fanns tidigare som en osynlig skala: kreatören valde ingen
            rabatt och fick ändå ett lägre pris per video i de större paketen,
            av skäl bara vi kände till. Nu kostar tolv videor exakt tre gånger
            fyra tills kreatören säger något annat.
          */}
          <Card>
            <Text style={styles.cardTitle}>Dina rabatter</Text>
            <Body>Båda dras på ditt arvode. Vill du inte ge något lämnar du dem på Ingen.</Body>

            <DiscountRow
              label={`${PREPAY_MONTHS} månader i förskott`}
              hint={
                prepayDiscount > 0 && packages[0]
                  ? `Företaget betalar ${formatSek(Math.round((packages[0].monthlyRate * (10_000 - prepayDiscount)) / 10_000))} i månaden i stället för ${formatSek(packages[0].monthlyRate)}.`
                  : 'Utan rabatt syns inte förskottsbetalning som ett val för företaget.'
              }
              value={prepayDiscount}
              onChange={setPrepayDiscount}
            />

            <Divider />

            <DiscountRow
              label="Åtta eller tolv videor i månaden"
              hint={
                volumeDiscount > 0
                  ? 'De större paketen kostar mindre per video.'
                  : 'Tolv videor kostar exakt tre gånger fyra.'
              }
              value={volumeDiscount}
              onChange={setVolumeDiscount}
            />
          </Card>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Spara" onPress={submit} loading={save.isPending} />
    </ScrollScreen>
  );
}

/** En rabattsats med sin egen förklaring. Samma stege båda gångerna. */
function DiscountRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: DiscountBps;
  onChange: (next: DiscountBps) => void;
}) {
  return (
    <View style={styles.discountBlock}>
      <Text style={styles.discountLabel}>{label}</Text>
      <View style={styles.discountRow}>
        {DISCOUNT_CHOICES.map((choice) => (
          <Pressable
            key={choice}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === choice }}
            onPress={() => onChange(choice)}
            style={[styles.discount, value === choice && styles.discountOn]}
          >
            <Text style={[styles.discountText, value === choice && styles.discountTextOn]}>
              {DISCOUNT_LABELS[choice]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.footnote}>{hint}</Text>
    </View>
  );
}

/**
 * Vad är kreatören värd?
 *
 * Den fråga kreatörer är sämst rustade att svara på: ett enstaka samarbete går
 * att jämföra med tidigare samarbeten, men ett månadspris har kreatören oftast aldrig
 * satt. Spannet räknas fram ur kreatörens eget riktpris, vad andra i staden tar och
 * vad företagen där budgeterar.
 *
 * Underlaget ligger hopfällt. Det är fyra rader som svarar på "hur vet ni det?"
 * – en fråga man ställer en gång, inte varje gång man öppnar skärmen.
 */
function RateHelp({ onUse }: { onUse: (rate: number) => void }) {
  const rate = useQuery(retainerRateQuery());
  const [asked, setAsked] = useState(false);
  const [showBasis, setShowBasis] = useState(false);

  const advice = useQuery({
    queryKey: ['retainer-rate', 'advice'],
    queryFn: () =>
      api.post<{ available: boolean; advice: string | null }>('/me/retainer-rate/advice'),
    enabled: asked,
    staleTime: 30 * 60_000,
    retry: false,
  });

  if (!rate.data) return null;
  const data = rate.data;

  return (
    <Card tone="raised">
      <View style={styles.headRow}>
        <SparkIcon size={18} color={colors.accent} />
        <Text style={styles.cardTitle}>Vad kan du ta?</Text>
        <Text style={styles.secondary}>{RATE_CONFIDENCE_LABELS[data.confidence]}</Text>
      </View>

      <Text style={styles.rateRange}>
        {formatSek(data.low)}–{formatSek(data.high)}
      </Text>
      <Text style={styles.secondary}>i månaden för fyra videor, i {data.city}</Text>

      <View style={styles.rateActions}>
        <Button
          label={`Använd ${formatSek(data.mid)}`}
          variant="secondary"
          compact
          onPress={() => onUse(data.mid)}
        />
        {!asked ? (
          <Button label="Fråga Pacta" compact onPress={() => setAsked(true)} />
        ) : null}
      </View>

      {asked ? (
        advice.isFetching ? (
          <Loading label="Tittar på ditt underlag" />
        ) : advice.data?.advice ? (
          <Text style={styles.advice}>{advice.data.advice}</Text>
        ) : (
          <Body>Vi kunde inte skriva ihop ett råd just nu. Spannet ovan gäller ändå.</Body>
        )
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showBasis }}
        onPress={() => setShowBasis((current) => !current)}
        hitSlop={8}
      >
        <Text style={styles.link}>{showBasis ? 'Dölj underlaget' : 'Så räknar vi'}</Text>
      </Pressable>

      {showBasis ? (
        <View style={styles.basis}>
          {data.basis.map((line) => (
            <View key={line} style={styles.basisRow}>
              <View style={styles.dot} />
              <Text style={styles.basisText}>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: 14 },
  secondary: { ...type.secondary, color: colors.muted },
  footnote: { ...type.secondary, color: colors.muted },
  error: { ...type.secondary, color: colors.danger },
  cardTitle: { ...type.listTitle, color: colors.text, flex: 1 },
  link: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.primary },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleText: { flex: 1, gap: 2 },
  switch: {
    width: 50,
    height: 30,
    borderRadius: radius.round,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  knob: { width: 22, height: 22, borderRadius: radius.round, backgroundColor: colors.surface },
  knobOn: { alignSelf: 'flex-end' },

  packRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  packText: { flex: 1, gap: 2 },
  packTitle: { ...type.listTitle, color: colors.text },
  packPrice: { fontFamily: type.rowTitle.fontFamily, fontSize: 16, color: colors.accent },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rateRange: { ...type.amountHero, fontSize: 28, color: colors.accent },
  rateActions: { flexDirection: 'row', gap: spacing.sm },
  advice: { ...type.bodySmall, color: colors.text },
  basis: { gap: 6 },
  basisRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.muted, marginTop: 7 },
  basisText: { ...type.secondary, color: colors.muted, flex: 1 },

  discountBlock: { gap: spacing.sm },
  discountLabel: { ...type.bodySmall, color: colors.text },
  discountRow: { flexDirection: 'row', gap: 6 },
  discount: {
    flex: 1,
    height: 42,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountOn: { borderColor: colors.primary, backgroundColor: colors.tint },
  discountText: { ...type.secondary, color: colors.muted },
  discountTextOn: { fontFamily: type.listTitle.fontFamily, color: colors.text },
});
