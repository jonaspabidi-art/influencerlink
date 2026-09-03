import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { BankIdPanel, useBankId } from '../../src/bankid';
import { CONTRACT_STATUS_LABELS } from '../../src/components/ContractList';
import {
  Body,
  Button,
  Caption,
  Card,
  Field,
  Heading,
  Loading,
  Screen,
  Title,
} from '../../src/components/ui';
import { DELIVERABLE_LABELS, formatDate, formatSek } from '../../src/format';
import { colors, radius, spacing, typography } from '../../src/theme';
import type { Contract } from '../../src/types';

export default function ContractDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [signing, setSigning] = useState(false);
  const [deliveryUrl, setDeliveryUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const contract = useQuery({
    queryKey: ['contract', id],
    queryFn: () => api.get<Contract>(`/contracts/${id}`),
    enabled: Boolean(id),
  });

  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['contract', id] });
    void queryClient.invalidateQueries({ queryKey: ['contracts'] });
  }, [id, queryClient]);

  const bankId = useBankId({
    purpose: 'SIGN',
    onComplete: () => {
      setSigning(false);
      reload();
    },
  });

  const pay = useMutation({
    mutationFn: () => api.post<{ clientSecret: string; amount: number }>(`/contracts/${id}/payment`),
    onSuccess: reload,
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Betalningen kunde inte startas.'),
  });

  const deliver = useMutation({
    mutationFn: () =>
      api.post<Contract>(`/contracts/${id}/delivery`, { urls: [deliveryUrl.trim()], note: '' }),
    onSuccess: () => {
      setDeliveryUrl('');
      reload();
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte rapportera leveransen.'),
  });

  const approve = useMutation({
    mutationFn: () => api.post<{ payout: number }>(`/contracts/${id}/approve`),
    onSuccess: reload,
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte godkänna leveransen.'),
  });

  if (contract.isLoading || !contract.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const data = contract.data;
  const isBusiness = user?.role === 'BUSINESS';

  if (signing) {
    return (
      <Screen scroll>
        <Title>Signera avtalet</Title>
        <BankIdPanel
          phase={bankId.phase}
          qrData={bankId.qrData}
          hintText={bankId.hintText}
          autoStartUrl={bankId.autoStartUrl}
          onCancel={() => {
            void bankId.cancel();
            setSigning(false);
          }}
          onRetry={() => void bankId.start({ contractId: data.id })}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View>
        <Title>{data.campaignTitle}</Title>
        <Caption>
          {isBusiness ? data.influencerName : data.businessName} ·{' '}
          {CONTRACT_STATUS_LABELS[data.status]}
        </Caption>
      </View>

      <Card>
        <Heading>Ekonomi</Heading>
        <Row label="Arvode" value={formatSek(data.fee)} />
        <Row label="Plattformsavgift" value={`−${formatSek(data.platformFee)}`} />
        <Row label="Till kreatören" value={formatSek(data.payout)} highlight />
        <Row label="Deadline" value={formatDate(data.dueDate)} />
        <Row
          label="Leverans"
          value={data.deliverables.map((kind) => DELIVERABLE_LABELS[kind]).join(', ')}
        />
      </Card>

      <Card>
        <Heading>Signaturer</Heading>
        <Row
          label="Kreatören"
          value={data.signedByInfluencerAt ? formatDate(data.signedByInfluencerAt) : 'Väntar'}
        />
        <Row
          label="Restaurangen"
          value={data.signedByBusinessAt ? formatDate(data.signedByBusinessAt) : 'Väntar'}
        />
        {data.awaitingMySignature ? (
          <Button
            label="Signera med BankID"
            icon="shield-checkmark-outline"
            onPress={() => {
              setSigning(true);
              void bankId.start({ contractId: data.id });
            }}
          />
        ) : null}
      </Card>

      {isBusiness && data.status === 'ACTIVE' && data.paymentStatus !== 'ESCROWED' ? (
        <Card>
          <Heading>Betala in arvodet</Heading>
          <Caption>
            Beloppet hålls hos oss och betalas ut till kreatören först när du godkänt leveransen.
          </Caption>
          <Button
            label={`Betala ${formatSek(data.fee)}`}
            onPress={() => pay.mutate()}
            loading={pay.isPending}
          />
        </Card>
      ) : null}

      {!isBusiness && data.status === 'ACTIVE' ? (
        <Card>
          <Heading>Rapportera leverans</Heading>
          <Caption>Klistra in länken till det publicerade inlägget.</Caption>
          <Field
            label="Länk"
            value={deliveryUrl}
            onChangeText={setDeliveryUrl}
            placeholder="https://www.tiktok.com/@…"
          />
          <Button
            label="Skicka in"
            onPress={() => deliver.mutate()}
            loading={deliver.isPending}
            disabled={deliveryUrl.trim().length === 0}
          />
        </Card>
      ) : null}

      {isBusiness && data.status === 'DELIVERED' ? (
        <Card>
          <Heading>Godkänn leveransen</Heading>
          <Caption>
            När du godkänner betalas {formatSek(data.payout)} ut till kreatören. Godkänner du inte
            inom {data.reviewDays} dagar sker det automatiskt.
          </Caption>
          <Button
            label="Godkänn och betala ut"
            onPress={() => approve.mutate()}
            loading={approve.isPending}
          />
        </Card>
      ) : null}

      {error ? <Body>{error}</Body> : null}

      <Card>
        <Heading>Avtalstext</Heading>
        <ScrollView style={styles.terms} nestedScrollEnabled>
          <Text style={styles.termsText}>{data.terms}</Text>
        </ScrollView>
      </Card>
    </Screen>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, highlight && styles.rowHighlight]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { ...typography.body, color: colors.textMuted, flexShrink: 1 },
  rowValue: { ...typography.body, color: colors.text, fontWeight: '600', textAlign: 'right', flex: 1 },
  rowHighlight: { color: colors.success },
  terms: {
    maxHeight: 320,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  termsText: { ...typography.caption, color: colors.textMuted, lineHeight: 18 },
});
