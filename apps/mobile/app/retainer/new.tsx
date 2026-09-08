import { PREPAY_MONTHS } from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { CheckIcon } from '../../src/components/icons';
import {
  Body,
  Button,
  Card,
  Field,
  Header,
  Label,
  Loading,
  ScrollScreen,
} from '../../src/components/ui';
import { formatSek } from '../../src/format';
import { retainersQuery } from '../../src/queries';
import { colors, radius, spacing, type } from '../../src/theme';
import type { InfluencerProfile, Retainer } from '../../src/types';

/**
 * Företaget frågar en kreatör om en plats.
 *
 * Ingen förhandling och inget bud: hon har satt sitt pris, och företaget
 * väljer hur många videor och om de vill betala tre månader i förskott. Att
 * öppna för prisdiskussion här skulle göra varje förfrågan till ett samtal,
 * och det är just det den här produkten ska slippa.
 */
export default function NewRetainer() {
  const { influencerId } = useLocalSearchParams<{ influencerId: string }>();
  const queryClient = useQueryClient();

  const [videos, setVideos] = useState(8);
  const [prepay, setPrepay] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const creator = useQuery({
    queryKey: ['influencer', influencerId],
    queryFn: () => api.get<InfluencerProfile>(`/influencers/${influencerId}`),
    enabled: Boolean(influencerId),
  });

  const send = useMutation({
    mutationFn: () =>
      api.post<Retainer>('/retainers', {
        influencerId,
        videosPerMonth: videos,
        prepaidMonths: discounted ? PREPAY_MONTHS : 1,
        note: note.trim(),
      }),
    onSuccess: (retainer) => {
      void queryClient.invalidateQueries({ queryKey: retainersQuery().queryKey });
      router.replace(`/retainer/${retainer.id}`);
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte skicka förfrågan.'),
  });

  if (creator.isLoading) {
    return (
      <ScrollScreen>
        <Header title="Löpande uppdrag" onBack={() => router.back()} />
        <Loading />
      </ScrollScreen>
    );
  }

  const profile = creator.data;
  const packages = profile?.retainerPackages ?? [];
  const chosen = packages.find((pack) => pack.videosPerMonth === videos);
  // Rabatten är hennes, inte plattformens. Erbjuder hon ingen finns valet inte.
  const discountBps = profile?.retainerPrepayDiscountBps ?? 0;
  const offersPrepay = discountBps > 0;
  const discounted = prepay && offersPrepay;
  const monthly = chosen
    ? discounted
      ? Math.round((chosen.monthlyRate * (10_000 - discountBps)) / 10_000)
      : chosen.monthlyRate
    : 0;
  // Företaget betalar arvodet plus sin del av avgiften. Beloppet nedan är det
  // som faktiskt dras, inte ett "från"-pris.
  const charge = Math.round(monthly * 1.1);

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title={`Anlita ${profile?.displayName ?? 'kreatören'}`}
        subtitle="Innehåll till era egna kanaler, varje månad"
        onBack={() => router.back()}
      />

      <Card tone="raised">
        <Body>
          {profile?.displayName} producerar videorna och lägger upp dem på era kanaler. Ni
          godkänner varje video innan den publiceras. Ingen bindningstid – säg upp innan nästa
          månad börjar.
        </Body>
      </Card>

      <View style={styles.section}>
        <Label>HUR MYCKET INNEHÅLL?</Label>
        {packages.map((pack) => (
          <Pressable
            key={pack.videosPerMonth}
            accessibilityRole="radio"
            accessibilityState={{ selected: pack.videosPerMonth === videos }}
            onPress={() => setVideos(pack.videosPerMonth)}
            style={[styles.option, pack.videosPerMonth === videos && styles.optionSelected]}
          >
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{pack.videosPerMonth} videor i månaden</Text>
              <Text style={styles.secondary}>
                {pack.videosPerMonth === 4
                  ? 'En i veckan'
                  : pack.videosPerMonth === 8
                    ? 'Två i veckan'
                    : 'Tre i veckan'}
              </Text>
            </View>
            <Text style={styles.optionPrice}>{formatSek(pack.monthlyRate)}</Text>
            {pack.videosPerMonth === videos ? (
              <CheckIcon size={18} color={colors.primary} />
            ) : null}
          </Pressable>
        ))}
      </View>

      {offersPrepay ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: prepay }}
          onPress={() => setPrepay((value) => !value)}
          style={[styles.option, prepay && styles.optionSelected]}
        >
          <View style={styles.optionText}>
            <Text style={styles.optionTitle}>Betala {PREPAY_MONTHS} månader i förskott</Text>
            <Text style={styles.secondary}>
              {discountBps / 100} % rabatt. Outnyttjade månader betalas tillbaka.
            </Text>
          </View>
          {prepay ? <CheckIcon size={18} color={colors.primary} /> : null}
        </Pressable>
      ) : null}

      <Card>
        <Field
          label="Vad vill ni få ut av det?"
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Vi vill visa lunchen och få fler att hitta hit på vardagar."
          hint="Hon ser det här innan hon svarar. Två meningar räcker."
        />
      </Card>

      {chosen ? (
        <Card tone="primary">
          <Text style={styles.summaryLabel}>Ni betalar i månaden</Text>
          <Text style={styles.summaryAmount}>{formatSek(charge)}</Text>
          <Text style={styles.secondary}>
            {formatSek(monthly)} till {profile?.displayName} plus 10 % förmedlingsavgift. Första
            månaden betalas när hon tackat ja.
          </Text>
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        label="Skicka förfrågan"
        onPress={() => send.mutate()}
        loading={send.isPending}
        disabled={!chosen}
      />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: 14 },
  section: { gap: spacing.sm },
  secondary: { ...type.secondary, color: colors.muted },
  error: { ...type.secondary, color: colors.danger },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.base,
  },
  optionSelected: { borderColor: colors.primary },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { ...type.listTitle, color: colors.text },
  optionPrice: { fontFamily: type.rowTitle.fontFamily, fontSize: 16, color: colors.accent },

  summaryLabel: { ...type.secondary, color: colors.muted },
  summaryAmount: { ...type.amountHero, color: colors.accent },
});
