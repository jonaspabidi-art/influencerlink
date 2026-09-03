import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Body, Button, Caption, Card, Heading, Loading, Screen, Title } from '../../src/components/ui';
import { formatSek } from '../../src/format';
import { colors, radius, spacing, typography } from '../../src/theme';
import type { PayoutStatus } from '../../src/types';
import { Text } from 'react-native';

export default function Wallet() {
  const { user, signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['payouts'],
    queryFn: () => api.get<PayoutStatus>('/me/payouts/status'),
  });

  const onboarding = useMutation({
    mutationFn: () => api.post<{ onboardingUrl: string }>('/me/payouts/onboarding'),
    onSuccess: (result) => {
      void Linking.openURL(result.onboardingUrl);
    },
    onError: (caught) => {
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte öppna Stripe.');
    },
  });

  if (status.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const data = status.data;

  return (
    <Screen scroll>
      <Title>Plånbok</Title>

      <View style={styles.amounts}>
        <Amount label="På väg till dig" value={formatSek(data?.pendingPayout ?? 0)} />
        <Amount label="Utbetalt totalt" value={formatSek(data?.paidOut ?? 0)} highlight />
      </View>

      <Card>
        <Heading>Utbetalningskonto</Heading>
        {data?.payoutsEnabled ? (
          <Body muted>
            Klart. Pengarna betalas ut automatiskt när restaurangen godkänt din leverans.
          </Body>
        ) : (
          <>
            <Body muted>
              Koppla ditt bankkonto via Stripe för att kunna ta emot betalningar. Det tar någon
              minut och du behöver ditt bankkontonummer.
            </Body>
            <Button
              label={data?.connected ? 'Slutför hos Stripe' : 'Koppla utbetalningskonto'}
              onPress={() => onboarding.mutate()}
              loading={onboarding.isPending}
            />
          </>
        )}
        {error ? <Body>{error}</Body> : null}
      </Card>

      <Card>
        <Heading>Så fungerar betalningen</Heading>
        <Caption>
          Restaurangen betalar in hela arvodet när avtalet signerats av båda parter. Pengarna hålls
          kvar hos oss tills du levererat och restaurangen godkänt – därefter går de till ditt
          konto. Plattformsavgiften är 12 % och dras vid utbetalningen.
        </Caption>
      </Card>

      <Card>
        <Heading>Konto</Heading>
        <Body muted>
          {user?.name}
          {user?.personalNumberMask ? ` · ${user.personalNumberMask}` : ''}
        </Body>
        <Button label="Logga ut" variant="ghost" onPress={() => void signOut()} />
      </Card>
    </Screen>
  );
}

function Amount({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.amountBox}>
      <Text style={[styles.amountValue, highlight && styles.amountHighlight]}>{value}</Text>
      <Text style={styles.amountLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  amounts: { flexDirection: 'row', gap: spacing.sm },
  amountBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  amountValue: { ...typography.title, color: colors.text, fontSize: 22 },
  amountHighlight: { color: colors.success },
  amountLabel: { ...typography.caption, color: colors.textMuted },
});
