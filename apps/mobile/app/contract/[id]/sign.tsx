import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError, api } from '../../../src/api';
import {
  Body,
  Button,
  Card,
  Header,
  Loading,
  ScrollScreen,
} from '../../../src/components/ui';
import { CheckIcon, LockIcon } from '../../../src/components/icons';
import { formatSek } from '../../../src/format';
import { colors, radius, spacing, type } from '../../../src/theme';
import type { Contract } from '../../../src/types';

/**
 * Enkel signering: avtalet i sin helhet och en bekräftelse.
 *
 * Den här skärmen är avsiktligt tråkig. Hela texten står här, inte bakom en
 * länk, eftersom den som bekräftar ska ha haft den framför sig. Hashen av
 * texten skickas med tillbaka, så att servern kan säga ifrån om avtalet hunnit
 * ändras sedan skärmen laddades.
 */
export default function SignContract() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contract = useQuery({
    queryKey: ['contract', id],
    queryFn: () => api.get<Contract>(`/contracts/${id}`),
    enabled: Boolean(id),
  });

  const sign = useMutation({
    mutationFn: (termsHash: string) =>
      api.post<{ bothSigned: boolean }>(`/contracts/${id}/sign`, { termsHash }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contract', id] });
      void queryClient.invalidateQueries({ queryKey: ['contracts'] });
      router.back();
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Signeringen gick inte igenom.'),
  });

  if (contract.isLoading || !contract.data) {
    return (
      <ScrollScreen>
        <Header title="Signera avtalet" onBack={() => router.back()} />
        <Loading />
      </ScrollScreen>
    );
  }

  const data = contract.data;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title="Signera avtalet" onBack={() => router.back()} />

      <Card tone="raised">
        <View style={styles.trustHeader}>
          <LockIcon size={16} color={colors.positive} />
          <Text style={styles.trustTitle}>Det här binder dig</Text>
        </View>
        <Body>
          När båda har signerat betalar företaget in {formatSek(data.fee)} till Pacta. Pengarna
          ligger kvar där tills leveransen är godkänd.
        </Body>
      </Card>

      <Text style={styles.terms}>{data.terms}</Text>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        onPress={() => {
          setError(null);
          setAccepted((value) => !value);
        }}
        style={styles.acceptRow}
      >
        <View style={[styles.box, accepted && styles.boxChecked]}>
          {accepted ? <CheckIcon size={16} color={colors.ink} /> : null}
        </View>
        <Text style={styles.acceptLabel}>
          Jag har läst avtalet i sin helhet och godkänner det.
        </Text>
      </Pressable>

      <Button
        label="Signera avtalet"
        onPress={() => {
          setError(null);
          if (!accepted) return setError('Kryssa i rutan för att signera.');
          sign.mutate(data.termsHash);
        }}
        loading={sign.isPending}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.footnote}>
        Vi sparar tidpunkten, din IP-adress och avtalstexten ordagrant som bevis på vad du
        godkände.
      </Text>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.base, paddingTop: 0 },
  trustHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trustTitle: { ...type.listTitle, color: colors.text },
  terms: {
    fontFamily: type.bodySmall.fontFamily,
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
  },
  acceptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.chip,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  acceptLabel: { ...type.body, color: colors.text, flex: 1 },
  error: { ...type.bodySmall, color: colors.danger },
  footnote: { ...type.secondary, color: colors.muted },
});
