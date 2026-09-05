import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { DemoBanner } from '../../src/components/DemoBanner';
import { CheckIcon, LockIcon } from '../../src/components/icons';
import {
  Body,
  Button,
  Card,
  Divider,
  Header,
  Label,
  Loading,
  ScrollScreen,
} from '../../src/components/ui';
import { formatDate, formatSek } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { Contract, PayoutStatus } from '../../src/types';

/** Stegen i förklaringen av hur pengarna når kreatören. */
const PAYOUT_STEPS = [
  'Ni signerar avtalet med BankID.',
  'Företaget betalar in arvodet. Beloppet ligger spärrat hos oss.',
  'Du levererar, företaget godkänner och pengarna är hos dig inom 1–2 bankdagar.',
];

export default function Wallet() {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['payouts'],
    queryFn: () => api.get<PayoutStatus>('/me/payouts/status'),
  });

  const contracts = useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.get<Contract[]>('/contracts'),
  });

  const onboarding = useMutation({
    mutationFn: () => api.post<{ onboardingUrl: string }>('/me/payouts/onboarding'),
    onSuccess: (result) => {
      if (result.onboardingUrl) void Linking.openURL(result.onboardingUrl);
      void status.refetch();
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte öppna Stripe.'),
  });

  if (status.isLoading) {
    return (
      <ScrollScreen>
        <Loading />
      </ScrollScreen>
    );
  }

  const data = status.data;
  const pendingContracts = (contracts.data ?? []).filter(
    (contract) => contract.paymentStatus === 'ESCROWED',
  );
  const completed = (contracts.data ?? []).filter((contract) => contract.status === 'COMPLETED');

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title="Plånbok" large />

      <Card>
        <View style={styles.heroBlock}>
          <Text style={styles.secondary}>På väg till dig</Text>
          <Text style={styles.heroAmount}>{formatSek(data?.pendingPayout ?? 0)}</Text>
          <Text style={styles.secondary}>
            {pendingContracts.length === 0
              ? 'Inget spärrat just nu'
              : `${pendingContracts.length} ${pendingContracts.length === 1 ? 'avtal' : 'avtal'}, spärrat tills leveransen godkänts`}
          </Text>
        </View>
        <Divider />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Utbetalt totalt</Text>
          <Text style={styles.totalValue}>{formatSek(data?.paidOut ?? 0)}</Text>
        </View>
      </Card>

      {data?.payoutsEnabled ? (
        <Card>
          <View style={styles.accountRow}>
            <CheckIcon size={20} color={colors.positive} />
            <View style={styles.accountText}>
              <Text style={styles.accountTitle}>Utbetalningskontot är klart</Text>
              <Text style={styles.secondary}>Pengarna går direkt till ditt konto.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => onboarding.mutate()}
              hitSlop={8}
            >
              <Text style={styles.linkAction}>Ändra</Text>
            </Pressable>
          </View>
        </Card>
      ) : (
        <Card tone="primary">
          <Text style={styles.accountTitle}>Koppla ditt utbetalningskonto</Text>
          <Body>
            Vi behöver ditt bankkonto för att kunna betala ut. Det tar någon minut och sköts av
            Stripe.
          </Body>
          <Button
            label={data?.connected ? 'Slutför hos Stripe' : 'Koppla konto'}
            onPress={() => onboarding.mutate()}
            loading={onboarding.isPending}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Card>
      )}

      <Card tone="raised">
        <View style={styles.explainHeader}>
          <LockIcon size={16} color={colors.positive} />
          <Text style={styles.explainTitle}>Så får du dina pengar</Text>
        </View>
        {PAYOUT_STEPS.map((step, index) => (
          <View key={step} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</Text>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </Card>

      {completed.length > 0 ? (
        <View style={styles.recent}>
          <Label>SENASTE</Label>
          {completed.slice(0, 5).map((contract) => (
            <View key={contract.id} style={styles.recentRow}>
              <View style={styles.recentText}>
                <Text style={styles.recentName}>{contract.businessName}</Text>
                <Text style={styles.secondary}>
                  Utbetalt {contract.completedAt ? formatDate(contract.completedAt) : ''}
                </Text>
              </View>
              <Text style={styles.recentAmount}>{formatSek(contract.payout)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <DemoBanner />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  secondary: { ...type.secondary, color: colors.muted },
  heroBlock: { gap: 2 },
  heroAmount: { ...type.amountHero, color: colors.accent },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { ...type.body, color: colors.muted },
  totalValue: { fontFamily: type.amountSmall.fontFamily, fontSize: 20, color: colors.text },

  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  accountText: { flex: 1, gap: 2 },
  accountTitle: { ...type.listTitle, color: colors.text },
  linkAction: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.primary },
  error: { ...type.secondary, color: colors.danger },

  explainHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  explainTitle: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.text },
  stepRow: { flexDirection: 'row', gap: spacing.md },
  stepNumber: { fontFamily: type.label.fontFamily, fontSize: 11, color: colors.muted, paddingTop: 3 },
  stepText: { ...type.bodySmall, color: colors.muted, flex: 1 },

  recent: { gap: spacing.sm },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  recentText: { flex: 1 },
  recentName: { ...type.listTitle, color: colors.text },
  recentAmount: { fontFamily: type.rowTitle.fontFamily, fontSize: 15, color: colors.text },
});
