import { MIN_RETAINER_BASE_RATE, retainerPackages } from '@pacta/shared';
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
import { retainerAvailabilityQuery } from '../../src/queries';
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const data = availability.data;
    if (!data) return;
    setEnabled(data.acceptsRetainers);
    setSlots(String(data.slots));
    setRate(data.baseRate === null ? '' : String(Math.round(data.baseRate / 100)));
  }, [availability.data]);

  const save = useMutation({
    mutationFn: (input: { acceptsRetainers: boolean; slots: number; baseRate: number | null }) =>
      api.put<RetainerAvailability>('/me/retainer-availability', input),
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
              <Text style={styles.footnote}>
                Från beloppen dras 10 % i förmedlingsavgift. Betalar företaget tre månader i
                förskott får de 10 % rabatt, och den dras på arvodet.
              </Text>
            </View>
          ) : null}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Spara" onPress={submit} loading={save.isPending} />
    </ScrollScreen>
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
});
