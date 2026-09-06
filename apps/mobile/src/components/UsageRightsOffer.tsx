import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { formatFollowers, formatSek } from '../format';
import { colors, radius, spacing, type } from '../theme';
import type { ContractResults } from '../types';
import { Body, Button, Card, Label } from './ui';

/**
 * Tillägget om annonsering.
 *
 * Erbjudandet dyker upp först när filmen har visningar. Frågan "får vi köra
 * den som annons?" är omöjlig att svara på innan man vet om materialet blev
 * bra – och en företagare som gör sitt första samarbete ska inte behöva ta
 * ställning till nyttjanderätt i avtalsflödet, där den bara blir ett hinder.
 *
 * Ingen branschjargong: ordet är "annons", inte "nyttjanderätt".
 */
export function UsageRightsOffer({
  contractId,
  role,
  counterpart,
}: {
  contractId: string;
  role: 'BUSINESS' | 'INFLUENCER';
  counterpart: string;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);

  // Samma nyckel som resultatvyn: siffrorna och erbjudandet hör ihop.
  const results = useQuery({
    queryKey: ['results', contractId],
    queryFn: () => api.get<ContractResults>(`/contracts/${contractId}/results`),
    enabled: Boolean(contractId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['results', contractId] });
  const fail = (caught: unknown) =>
    setError(caught instanceof ApiError ? caught.message : 'Något gick fel. Försök igen.');

  const ask = useMutation({
    mutationFn: () => api.post(`/contracts/${contractId}/usage-rights`, {}),
    onSuccess: refresh,
    onError: fail,
  });
  const respond = useMutation({
    mutationFn: (accept: boolean) =>
      api.post(`/contracts/${contractId}/usage-rights/respond`, { accept }),
    onSuccess: refresh,
    onError: fail,
  });
  const pay = useMutation({
    mutationFn: () => api.post(`/contracts/${contractId}/usage-rights/pay`, {}),
    onSuccess: refresh,
    onError: fail,
  });

  const data = results.data;
  if (!data) return null;

  const rights = data.usageRights;
  const offer = data.usageRightsOffer;
  const isBusiness = role === 'BUSINESS';

  // Inget att visa: ingen förfrågan, och ännu inget resultat att grunda den på.
  if (!rights && !offer) return null;

  const terms = rights ? (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={showTerms ? 'Dölj villkoren' : 'Läs villkoren'}
        onPress={() => setShowTerms((current) => !current)}
      >
        <Text style={styles.link}>{showTerms ? 'Dölj villkoren' : 'Läs villkoren'}</Text>
      </Pressable>
      {showTerms ? <Text style={styles.terms}>{rights.terms}</Text> : null}
    </>
  ) : null;

  return (
    <Card tone="raised">
      <Label>ANNONSERING</Label>

      {/* Företaget, innan de frågat. */}
      {!rights && offer && isBusiness ? (
        <>
          <Text style={styles.headline}>
            Vill ni köra filmen som annons?
          </Text>
          <Body>
            Den har {formatFollowers(data.views)} visningar bland {counterpart}s följare. Som annons
            från ert eget konto når ni fler än så, i {offer.months} månader.
          </Body>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatSek(offer.amount)}</Text>
            <Text style={styles.secondary}>
              varav {formatSek(offer.creatorShare)} till {counterpart}
            </Text>
          </View>
          <Button
            label={`Fråga ${counterpart}`}
            onPress={() => {
              setError(null);
              ask.mutate();
            }}
            loading={ask.isPending}
          />
          <Text style={styles.secondary}>
            {counterpart} avgör själv. Blir det nej ändras ingenting i ert avtal.
          </Text>
        </>
      ) : null}

      {/* Kreatören, med en obesvarad förfrågan. */}
      {rights?.status === 'REQUESTED' && !isBusiness ? (
        <>
          <Text style={styles.headline}>{counterpart} vill annonsera med din film</Text>
          <Body>
            De kör den som annons från sitt eget konto i {rights.months} månader. Du behåller
            upphovsrätten och får använda filmen precis som förut.
          </Body>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatSek(rights.creatorShare)}</Text>
            <Text style={styles.secondary}>till dig</Text>
          </View>
          {terms}
          <Button
            label="Ja, det går bra"
            onPress={() => {
              setError(null);
              respond.mutate(true);
            }}
            loading={respond.isPending}
          />
          <Button
            label="Nej tack"
            variant="secondary"
            onPress={() => {
              setError(null);
              respond.mutate(false);
            }}
          />
        </>
      ) : null}

      {/* Företaget väntar på svar. */}
      {rights?.status === 'REQUESTED' && isBusiness ? (
        <Body>Vi har frågat {counterpart}. Ni hör av oss så fort svaret kommer.</Body>
      ) : null}

      {/* Svaret blev ja – företaget betalar. */}
      {rights?.status === 'ACCEPTED' && isBusiness && rights.paymentStatus === 'PENDING' ? (
        <>
          <Text style={styles.headline}>{counterpart} sa ja</Text>
          <Body>
            Betala tillägget så får ni annonsera med filmen i {rights.months} månader.
          </Body>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatSek(rights.amount)}</Text>
          </View>
          {terms}
          <Button label="Betala" onPress={() => { setError(null); pay.mutate(); }} loading={pay.isPending} />
        </>
      ) : null}

      {/* Betalt. */}
      {rights?.status === 'ACCEPTED' && rights.paymentStatus !== 'PENDING' ? (
        <>
          <Text style={styles.headline}>
            {isBusiness ? `Ni får annonsera i ${rights.months} månader` : 'Klart'}
          </Text>
          <Body>
            {isBusiness
              ? `${counterpart} har fått ${formatSek(rights.creatorShare)} för tillägget.`
              : `${formatSek(rights.creatorShare)} ${
                  rights.paymentStatus === 'RELEASED' ? 'är utbetalt' : 'betalas ut inom kort'
                }.`}
          </Body>
          {terms}
        </>
      ) : null}

      {/* Ja givet, men företaget har inte betalat än – sett från kreatörens håll. */}
      {rights?.status === 'ACCEPTED' && !isBusiness && rights.paymentStatus === 'PENDING' ? (
        <Body>
          Du har sagt ja. {formatSek(rights.creatorShare)} betalas ut när {counterpart} betalat
          tillägget.
        </Body>
      ) : null}

      {/* Ett nej stänger frågan, utan att röra grundavtalet. */}
      {rights?.status === 'DECLINED' ? (
        <Body>
          {isBusiness
            ? `${counterpart} tackade nej. Ert avtal gäller oförändrat – ni får fortfarande återpublicera filmen i era egna kanaler.`
            : 'Du tackade nej. Avtalet i övrigt gäller som vanligt.'}
        </Body>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headline: { ...type.listTitle, color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  price: { ...type.sectionTitle, color: colors.accent },
  secondary: { ...type.secondary, color: colors.muted, flexShrink: 1 },
  link: { ...type.bodySmall, color: colors.primary },
  terms: {
    ...type.secondary,
    color: colors.muted,
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  error: { ...type.secondary, color: colors.danger },
});
