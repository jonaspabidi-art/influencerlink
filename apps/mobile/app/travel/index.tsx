import { MAX_TRAVEL_LENGTH_DAYS } from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError, api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Body, Button, Card, Field, Header, Loading, ScrollScreen } from '../../src/components/ui';
import { formatDate } from '../../src/format';
import { colors, spacing, type } from '../../src/theme';
import type { InfluencerProfile } from '../../src/types';

/**
 * Var kreatören ska vara, och när.
 *
 * Uppdragen kräver ett fysiskt besök, men en kreatör är inte fast på en punkt.
 * Den som ska till Stockholm över helgen kan ta uppdrag där – och är just då
 * mer intressant för en Stockholmsrestaurang än någon som bor i staden,
 * eftersom hen är ny för deras publik.
 */
export default function Travel() {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ['influencer', user?.profileId],
    queryFn: () => api.get<InfluencerProfile>(`/influencers/${user?.profileId}`),
    enabled: Boolean(user?.profileId),
  });

  const [city, setCity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const travel = profile.data?.travel;
    if (!travel) return;
    setCity(travel.city);
    setFrom(travel.from.slice(0, 10));
    setTo(travel.to.slice(0, 10));
  }, [profile.data?.travel]);

  const save = useMutation({
    mutationFn: (body: { city: string | null; from: string | null; to: string | null }) =>
      api.put('/me/travel', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['influencer', user?.profileId] });
      router.back();
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte spara resan.'),
  });

  if (profile.isLoading) {
    return (
      <ScrollScreen>
        <Header title="Var är du?" onBack={() => router.back()} />
        <Loading />
      </ScrollScreen>
    );
  }

  const home = profile.data?.city ?? '';
  const travel = profile.data?.travel ?? null;

  const submit = () => {
    setError(null);
    if (city.trim().length < 2) return setError('Skriv vilken ort du ska till.');
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
      return setError('Skriv datumen som ÅÅÅÅ-MM-DD, till exempel 2026-10-03.');
    }
    if (from > to) return setError('Slutdatumet kan inte ligga före startdatumet.');
    save.mutate({ city: city.trim(), from, to });
  };

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title="Var är du?" onBack={() => router.back()} />

      <Card>
        <Text style={styles.label}>HEMORT</Text>
        <Text style={styles.home}>{home || 'Ingen ort ännu'}</Text>
        <Body>
          Uppdrag i din hemort visas alltid. Ändrar du hemort gör du det under Redigera profil.
        </Body>
      </Card>

      <Card>
        <Text style={styles.label}>PÅ RESA</Text>
        <Body>
          Ska du till en annan stad? Lägg in orten och dagarna, så ser du uppdrag där – och
          restauranger på orten ser att du är på plats just då.
        </Body>
        <Field label="Ort" value={city} onChangeText={setCity} placeholder="Stockholm" />
        <Field label="Från (ÅÅÅÅ-MM-DD)" value={from} onChangeText={setFrom} placeholder="2026-10-03" />
        <Field label="Till (ÅÅÅÅ-MM-DD)" value={to} onChangeText={setTo} placeholder="2026-10-05" />
        <Text style={styles.footnote}>
          Högst {MAX_TRAVEL_LENGTH_DAYS} dagar. Längre än så är det en flytt – ändra hemorten i
          stället.
        </Text>
      </Card>

      {travel ? (
        <Card tone="raised">
          <Text style={styles.label}>INLAGT NU</Text>
          <Text style={styles.home}>
            {travel.city} {formatDate(travel.from)}–{formatDate(travel.to)}
          </Text>
          <Text style={styles.footnote}>
            {travel.active ? 'Du räknas som på plats just nu.' : 'Syns för restauranger redan nu.'}
          </Text>
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Spara resan" onPress={submit} loading={save.isPending} />
      {travel ? (
        <Button
          label="Ta bort resan"
          variant="secondary"
          onPress={() => {
            setError(null);
            save.mutate({ city: null, from: null, to: null });
          }}
        />
      ) : null}
    </ScrollScreen>
  );
}

/** Datum skrivs som ÅÅÅÅ-MM-DD. Ingen datumväljare än – fältet är ärligare än en halv. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: 0 },
  label: { ...type.label, color: colors.muted },
  home: { ...type.rowTitle, color: colors.text },
  footnote: { ...type.secondary, color: colors.muted },
  error: { ...type.bodySmall, color: colors.danger },
});
