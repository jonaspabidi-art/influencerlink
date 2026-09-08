import {
  MIN_RETAINER_BASE_RATE,
  PREPAY_DISCOUNT_CHOICES,
  PREPAY_DISCOUNT_LABELS,
  PREPAY_MONTHS,
  RATE_CONFIDENCE_LABELS,
  retainerPackages,
  type PrepayDiscountBps,
} from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import {
  Body,
  Button,
  Card,
  Divider,
  Field,
  Header,
  Label,
  Loading,
  ScrollScreen,
} from '../../src/components/ui';
import { formatSek } from '../../src/format';
import { api as client } from '../../src/api';
import { SparkIcon } from '../../src/components/icons';
import { retainerAvailabilityQuery, retainerRateQuery } from '../../src/queries';
import { colors, radius, spacing, type } from '../../src/theme';
import type { RetainerAvailability } from '../../src/types';

/**
 * Kreatörens läge för löpande uppdrag.
 *
 * Ett tal att fylla i, inte tre: hon säger vad hon vill ha för fyra videor i
 * månaden, och de större paketen följer av skalan. Priset per video sjunker
 * med volymen, och det är ingen rabatt utan en avspegling av arbetet – den
 * första videon hos en ny kund kräver att hon lär sig stället, resten gör det
 * inte.
 *
 * Platserna är ett riktigt tal. Visar vi en ledig plats ska hon kunna ta emot
 * den; en dag i veckan går inte att sälja två gånger.
 */
export default function RetainerAvailabilityScreen() {
  const queryClient = useQueryClient();
  const availability = useQuery(retainerAvailabilityQuery());

  const [enabled, setEnabled] = useState(false);
  const [slots, setSlots] = useState('2');
  const [rate, setRate] = useState('');
  const [discount, setDiscount] = useState<PrepayDiscountBps>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const data = availability.data;
    if (!data) return;
    setEnabled(data.acceptsRetainers);
    setSlots(String(data.slots));
    setRate(data.baseRate === null ? '' : String(Math.round(data.baseRate / 100)));
    setDiscount(data.prepayDiscountBps as PrepayDiscountBps);
  }, [availability.data]);

  const save = useMutation({
    mutationFn: (input: {
      acceptsRetainers: boolean;
      slots: number;
      baseRate: number | null;
      prepayDiscountBps: PrepayDiscountBps;
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
  const preview =
    baseRate !== null && baseRate >= MIN_RETAINER_BASE_RATE ? retainerPackages(baseRate) : [];

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
      prepayDiscountBps: discount,
    });
  };

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title="Löpande uppdrag"
        subtitle="Fast inkomst varje månad"
        onBack={() => router.back()}
      />

      <Card tone="raised">
        <Body>
          Ett löpande uppdrag betyder att du producerar innehåll åt ett företags egna kanaler
          varje månad – inte att du postar om dem på ditt konto. Din publik märker ingenting,
          och du vet vad som kommer in.
        </Body>
      </Card>

      <Card>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled }}
          onPress={() => setEnabled((value) => !value)}
          style={styles.toggleRow}
        >
          <View style={styles.toggleText}>
            <Text style={styles.toggleTitle}>Jag tar löpande uppdrag</Text>
            <Text style={styles.secondary}>Visas på din profil med lediga platser.</Text>
          </View>
          <View style={[styles.switch, enabled && styles.switchOn]}>
            <View style={[styles.knob, enabled && styles.knobOn]} />
          </View>
        </Pressable>
      </Card>

      {enabled ? (
        <>
          <RateHelp onUse={(suggested) => setRate(String(Math.round(suggested / 100)))} />

          <Card>
            <Field
              label="Vad vill du ha i månaden för fyra videor?"
              value={rate}
              onChangeText={setRate}
              keyboardType="numeric"
              placeholder="6 000"
              hint="I kronor. Priserna för åtta och tolv videor räknas fram automatiskt."
            />
            <Field
              label="Lediga platser"
              value={slots}
              onChangeText={setSlots}
              keyboardType="numeric"
              hint="Hur många företag du kan ta emot just nu. En dag i veckan var."
            />
          </Card>

          {preview.length > 0 ? (
            <View style={styles.section}>
              <Label>SÅ HÄR SER DINA PAKET UT</Label>
              <Card>
                {preview.map((pack, index) => (
                  <View key={pack.videosPerMonth}>
                    {index > 0 ? <Divider /> : null}
                    <View style={styles.packRow}>
                      <View style={styles.packText}>
                        <Text style={styles.packTitle}>
                          {pack.videosPerMonth} videor i månaden
                        </Text>
                        <Text style={styles.secondary}>
                          {formatSek(Math.round(pack.monthlyRate / pack.videosPerMonth))} per video
                        </Text>
                      </View>
                      <Text style={styles.packPrice}>{formatSek(pack.monthlyRate)}</Text>
                    </View>
                  </View>
                ))}
              </Card>
              <Text style={styles.footnote}>Från beloppen dras 10 % i förmedlingsavgift.</Text>
            </View>
          ) : null}

          {/*
            Rabatten är hennes pengar. Den dras på arvodet, inte på vår avgift,
            så en sats vi satt åt henne hade varit att förhandla bort en del av
            hennes betalning i ett samtal hon inte var med i. Noll är förvalt.
          */}
          <View style={styles.section}>
            <Label>RABATT VID {PREPAY_MONTHS} MÅNADER I FÖRSKOTT</Label>
            <Card>
              <Body>
                Betalar företaget flera månader på en gång vet du vad som kommer in – vill du ge
                något för det? Rabatten dras på ditt arvode.
              </Body>
              <View style={styles.discountRow}>
                {PREPAY_DISCOUNT_CHOICES.map((choice) => (
                  <Pressable
                    key={choice}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: discount === choice }}
                    onPress={() => setDiscount(choice)}
                    style={[styles.discount, discount === choice && styles.discountOn]}
                  >
                    <Text
                      style={[
                        styles.discountLabel,
                        discount === choice && styles.discountLabelOn,
                      ]}
                    >
                      {PREPAY_DISCOUNT_LABELS[choice]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {discount > 0 && preview[0] ? (
                <Text style={styles.footnote}>
                  Ett företag som binder sig i {PREPAY_MONTHS} månader betalar då{' '}
                  {formatSek(Math.round((preview[0].monthlyRate * (10_000 - discount)) / 10_000))}{' '}
                  i månaden i stället för {formatSek(preview[0].monthlyRate)}.
                </Text>
              ) : (
                <Text style={styles.footnote}>
                  Utan rabatt syns inte förskottsbetalning som ett val för företaget.
                </Text>
              )}
            </Card>
          </View>
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Spara" onPress={submit} loading={save.isPending} />
    </ScrollScreen>
  );
}

/**
 * Vad är hon värd?
 *
 * Den fråga kreatörer är sämst rustade att svara på: ett enstaka samarbete går
 * att jämföra med tidigare samarbeten, men ett månadspris har hon oftast aldrig
 * satt. Spannet räknas fram ur hennes eget riktpris, vad andra i staden tar och
 * vad företagen där budgeterar – och skärmen säger vilket av dem som saknas.
 *
 * Rådet ligger bakom en knapp. Siffrorna är räknade och står där de står; att
 * starta ett modellanrop bara för att någon öppnat skärmen vore att svara på en
 * fråga ingen ställt.
 */
function RateHelp({ onUse }: { onUse: (rate: number) => void }) {
  const rate = useQuery(retainerRateQuery());
  const [asked, setAsked] = useState(false);

  const advice = useQuery({
    queryKey: ['retainer-rate', 'advice'],
    queryFn: () => client.post<{ available: boolean; advice: string | null }>(
      '/me/retainer-rate/advice',
    ),
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
        <Text style={styles.rateTitle}>Vad kan du ta?</Text>
        <Text style={styles.confidence}>{RATE_CONFIDENCE_LABELS[data.confidence]}</Text>
      </View>

      <Text style={styles.rateRange}>
        {formatSek(data.low)}–{formatSek(data.high)}
      </Text>
      <Text style={styles.secondary}>i månaden för fyra videor, i {data.city}</Text>

      <View style={styles.basis}>
        {data.basis.map((line) => (
          <View key={line} style={styles.basisRow}>
            <View style={styles.dot} />
            <Text style={styles.basisText}>{line}</Text>
          </View>
        ))}
      </View>

      <Button
        label={`Använd ${formatSek(data.mid)}`}
        variant="secondary"
        onPress={() => onUse(data.mid)}
      />

      {!asked ? (
        <Button label="Fråga Pacta var i spannet du bör lägga dig" onPress={() => setAsked(true)} />
      ) : advice.isFetching ? (
        <Loading label="Tittar på ditt underlag" />
      ) : advice.data?.advice ? (
        <Text style={styles.advice}>{advice.data.advice}</Text>
      ) : (
        <Body>Vi kunde inte skriva ihop ett råd just nu. Spannet ovan gäller ändå.</Body>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: 14 },
  section: { gap: spacing.sm },
  secondary: { ...type.secondary, color: colors.muted },
  footnote: { ...type.secondary, color: colors.muted },
  error: { ...type.secondary, color: colors.danger },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleText: { flex: 1, gap: 2 },
  toggleTitle: { ...type.listTitle, color: colors.text },
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

  packRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  packText: { flex: 1, gap: 2 },
  packTitle: { ...type.listTitle, color: colors.text },
  packPrice: { fontFamily: type.rowTitle.fontFamily, fontSize: 16, color: colors.accent },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rateTitle: { ...type.listTitle, color: colors.text, flex: 1 },
  confidence: { ...type.secondary, color: colors.muted },
  rateRange: { ...type.amountHero, fontSize: 30, color: colors.accent },
  basis: { gap: 6 },
  basisRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.muted, marginTop: 7 },
  basisText: { ...type.secondary, color: colors.muted, flex: 1 },
  advice: { ...type.bodySmall, color: colors.text },

  discountRow: { flexDirection: 'row', gap: spacing.sm },
  discount: {
    flex: 1,
    height: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountOn: { borderColor: colors.primary, backgroundColor: colors.tint },
  discountLabel: { ...type.secondary, color: colors.muted },
  discountLabelOn: { fontFamily: type.listTitle.fontFamily, color: colors.text },
});
