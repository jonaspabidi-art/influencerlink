import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { DraftReview } from '../../src/components/DraftReview';
import { useAuth } from '../../src/auth';
import { BankIdScreen, useBankId } from '../../src/bankid';
import { CheckIcon, LockIcon, StarIcon } from '../../src/components/icons';
import { ReviewCard } from '../../src/components/ReviewList';
import {
  Body,
  Button,
  Card,
  DetailRow,
  Divider,
  Field,
  Header,
  Label,
  Loading,
  ScrollScreen,
  StatusBadge,
  type StatusTone,
} from '../../src/components/ui';
import { DELIVERABLE_LABELS, formatDate, formatSek } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { Contract, ReviewState } from '../../src/types';

const STATUS_LABELS: Record<Contract['status'], string> = {
  DRAFT: 'Utkast',
  SENT: 'Väntar på signaturer',
  PARTIALLY_SIGNED: 'En part har signerat',
  ACTIVE: 'Pågår',
  DELIVERED: 'Levererat – väntar',
  COMPLETED: 'Klart och utbetalt',
  CANCELLED: 'Avbrutet',
};

const STATUS_TONES: Record<Contract['status'], StatusTone> = {
  DRAFT: 'pending',
  SENT: 'pending',
  PARTIALLY_SIGNED: 'pending',
  ACTIVE: 'active',
  DELIVERED: 'pending',
  COMPLETED: 'done',
  CANCELLED: 'cancelled',
};

export default function ContractDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [signing, setSigning] = useState(false);
  const [deliveryUrl, setDeliveryUrl] = useState('');
  const [showDelivery, setShowDelivery] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contract = useQuery({
    queryKey: ['contract', id],
    queryFn: () => api.get<Contract>(`/contracts/${id}`),
    enabled: Boolean(id),
  });

  const reviewState = useQuery({
    queryKey: ['contract-reviews', id],
    queryFn: () => api.get<ReviewState>(`/contracts/${id}/reviews`),
    enabled: Boolean(id) && contract.data?.status === 'COMPLETED',
  });

  const reload = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['contract', id] });
    void queryClient.invalidateQueries({ queryKey: ['contracts'] });
    void queryClient.invalidateQueries({ queryKey: ['payouts'] });
    void queryClient.invalidateQueries({ queryKey: ['contract-reviews', id] });
  }, [id, queryClient]);

  const bankId = useBankId({
    purpose: 'SIGN',
    onComplete: () => {
      setSigning(false);
      reload();
    },
  });

  const fail = (caught: unknown, fallback: string) =>
    setError(caught instanceof ApiError ? caught.message : fallback);

  const pay = useMutation({
    mutationFn: () => api.post<{ amount: number }>(`/contracts/${id}/payment`),
    onSuccess: reload,
    onError: (caught) => fail(caught, 'Betalningen kunde inte startas.'),
  });

  const deliver = useMutation({
    mutationFn: () =>
      api.post<Contract>(`/contracts/${id}/delivery`, { urls: [deliveryUrl.trim()], note: '' }),
    onSuccess: () => {
      setDeliveryUrl('');
      setShowDelivery(false);
      reload();
    },
    onError: (caught) => fail(caught, 'Kunde inte rapportera leveransen.'),
  });

  const approve = useMutation({
    mutationFn: () => api.post<{ payout: number }>(`/contracts/${id}/approve`),
    onSuccess: reload,
    onError: (caught) => fail(caught, 'Kunde inte godkänna leveransen.'),
  });

  if (contract.isLoading || !contract.data) {
    return (
      <ScrollScreen>
        <Loading />
      </ScrollScreen>
    );
  }

  const data = contract.data;
  const isBusiness = user?.role === 'BUSINESS';
  const counterpart = isBusiness ? data.influencerName : data.businessName;

  if (signing) {
    return (
      <BankIdScreen
        title="Signera avtalet"
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
    );
  }

  const escrowed = data.paymentStatus === 'ESCROWED' || data.paymentStatus === 'RELEASED';
  const signedBoth = data.signedByInfluencerAt !== null && data.signedByBusinessAt !== null;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title="Avtal"
        onBack={() => router.back()}
        right={
          <StatusBadge label={STATUS_LABELS[data.status]} tone={STATUS_TONES[data.status]} />
        }
      />

      <View style={styles.titleBlock}>
        <Text style={styles.title}>{data.campaignTitle}</Text>
        <Text style={styles.counterpart}>{counterpart}</Text>
      </View>

      {data.status === 'COMPLETED' ? (
        <Card tone="positive" style={styles.payoutCard}>
          <Text style={styles.secondary}>
            {isBusiness ? 'Utbetalt till kreatören' : 'Utbetalt till dig'}{' '}
            {data.completedAt ? formatDate(data.completedAt) : ''}
          </Text>
          <Text style={styles.payoutAmount}>{formatSek(data.payout)}</Text>
          <Text style={styles.secondary}>Till det kopplade utbetalningskontot</Text>
        </Card>
      ) : null}

      {data.status === 'COMPLETED' && reviewState.data ? (
        <ReviewSection
          state={reviewState.data}
          counterpart={counterpart}
          onWrite={() => router.push(`/contract/${data.id}/review`)}
          onReadProfile={() =>
            router.push({
              pathname: '/reviews/[type]/[id]',
              params: {
                type: isBusiness ? 'influencer' : 'business',
                id: isBusiness ? data.influencerId : data.businessId,
                name: counterpart,
              },
            })
          }
        />
      ) : null}

      <Card>
        <DetailRow label="Arvode" value={formatSek(data.fee)} />
        <DetailRow label="Plattformsavgift 12 %" value={`−${formatSek(data.platformFee)}`} />
        <Divider />
        <DetailRow label="Till kreatören" value={formatSek(data.payout)} emphasis />
        <Divider />
        <DetailRow label="Deadline" value={formatDate(data.dueDate)} />
        <DetailRow
          label="Leverans"
          value={data.deliverables.map((kind) => DELIVERABLE_LABELS[kind]).join(', ')}
        />
        {data.deliveredAt ? (
          <DetailRow label="Levererat" value={formatDate(data.deliveredAt)} />
        ) : null}
      </Card>

      <Card>
        <Label>SIGNERAT</Label>
        <SignatureRow
          name={data.businessName}
          signedAt={data.signedByBusinessAt}
          waitingLabel="Väntar på signatur"
        />
        <SignatureRow
          name={data.influencerName}
          signedAt={data.signedByInfluencerAt}
          waitingLabel="Väntar på signatur"
        />
      </Card>

      {/* Utkastet ligger före leveransen, precis som i avtalstexten. */}
      {data.status === 'ACTIVE' || data.status === 'DELIVERED' || data.status === 'COMPLETED' ? (
        <DraftReview
          contractId={data.id}
          role={isBusiness ? 'BUSINESS' : 'INFLUENCER'}
          contractStatus={data.status}
        />
      ) : null}

      <ActionCard
        contract={data}
        isBusiness={isBusiness}
        showDelivery={showDelivery}
        deliveryUrl={deliveryUrl}
        onDeliveryUrlChange={setDeliveryUrl}
        onSign={() => {
          setSigning(true);
          void bankId.start({ contractId: data.id });
        }}
        onPay={() => pay.mutate()}
        onOpenDelivery={() => setShowDelivery(true)}
        onDeliver={() => deliver.mutate()}
        onApprove={() => approve.mutate()}
        busy={pay.isPending || deliver.isPending || approve.isPending}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {data.status !== 'COMPLETED' ? (
        <Card tone="raised">
          <View style={styles.trustHeader}>
            <LockIcon size={16} color={colors.positive} />
            <Text style={styles.trustTitle}>Så hanteras pengarna</Text>
          </View>
          <View style={styles.trustSteps}>
            <TrustStep label="Avtal signeras" done={signedBoth} />
            <TrustStep label={`${formatSek(data.fee)} spärras`} done={escrowed} />
            <TrustStep label="Utbetalning" done={data.paymentStatus === 'RELEASED'} />
          </View>
        </Card>
      ) : (
        <Card>
          <TimelineStep title="Båda signerade" detail={data.signedByBusinessAt ? formatDate(data.signedByBusinessAt) : ''} />
          <TimelineStep title={`${formatSek(data.fee)} spärrades`} detail="Betalt av restaurangen" />
          <TimelineStep
            title="Leverans godkänd"
            detail={data.completedAt ? formatDate(data.completedAt) : ''}
          />
          <TimelineStep title={`${formatSek(data.payout)} utbetalt`} detail="Klart" last />
        </Card>
      )}

      <View style={styles.terms}>
        <Label>AVTALSTEXT</Label>
        <Text style={styles.termsExcerpt} numberOfLines={6}>
          {data.terms.replace(/[#*|`]/g, '').replace(/\n{2,}/g, ' ').trim()}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/contract/${data.id}/terms`)}
          hitSlop={8}
        >
          <Text style={styles.termsLink}>Läs hela avtalet</Text>
        </Pressable>
      </View>
    </ScrollScreen>
  );
}

/**
 * Omdömesläget efter ett avslutat samarbete: skriv, vänta, eller läs det
 * motparten skrev. Bara ett av lägena i taget – det är alltid ett av dem.
 */
function ReviewSection({
  state,
  counterpart,
  onWrite,
  onReadProfile,
}: {
  state: ReviewState;
  counterpart: string;
  onWrite: () => void;
  onReadProfile: () => void;
}) {
  if (state.canReview) {
    return (
      <Card tone="primary">
        <View style={styles.reviewHead}>
          <StarIcon size={18} />
          <Text style={styles.actionTitle}>Hur gick det?</Text>
        </View>
        <Body>
          Ni ser varandras omdömen först när båda skrivit. Du har {state.daysLeft} dagar på dig.
        </Body>
        <Button label="Lämna omdöme" onPress={onWrite} />
      </Card>
    );
  }

  if (state.mine && state.theirs) {
    return (
      <View style={styles.reviewBlock}>
        <Label>{`OMDÖME FRÅN ${counterpart.toUpperCase()}`}</Label>
        <ReviewCard review={state.theirs} showBreakdown />
        <Pressable accessibilityRole="button" onPress={onReadProfile} hitSlop={8}>
          <Text style={styles.termsLink}>Se alla omdömen</Text>
        </Pressable>
      </View>
    );
  }

  if (state.mine) {
    return (
      <Card>
        <Text style={styles.actionTitle}>Ditt omdöme är inskickat</Text>
        <Body>
          {state.theirsPending
            ? `${counterpart} har också skrivit. Omdömena släpps fram inom kort.`
            : `Det syns när ${counterpart} också skrivit, eller om ${state.daysLeft} dagar.`}
        </Body>
      </Card>
    );
  }

  return null;
}

/** Kortet med den enda åtgärd som är aktuell just nu. */
function ActionCard({
  contract,
  isBusiness,
  showDelivery,
  deliveryUrl,
  onDeliveryUrlChange,
  onSign,
  onPay,
  onOpenDelivery,
  onDeliver,
  onApprove,
  busy,
}: {
  contract: Contract;
  isBusiness: boolean;
  showDelivery: boolean;
  deliveryUrl: string;
  onDeliveryUrlChange: (value: string) => void;
  onSign: () => void;
  onPay: () => void;
  onOpenDelivery: () => void;
  onDeliver: () => void;
  onApprove: () => void;
  busy: boolean;
}) {
  if (contract.awaitingMySignature) {
    return (
      <Card tone="primary">
        <Text style={styles.actionTitle}>Din tur att signera</Text>
        <Body>
          När båda signerat betalar restaurangen in {formatSek(contract.fee)} till det spärrade
          kontot.
        </Body>
        <Button label="Signera med BankID" onPress={onSign} />
      </Card>
    );
  }

  if (contract.status === 'SENT' || contract.status === 'PARTIALLY_SIGNED') {
    return (
      <Card>
        <Text style={styles.actionTitle}>Väntar på motparten</Text>
        <Body>Så snart båda signerat går avtalet vidare till betalning.</Body>
      </Card>
    );
  }

  if (contract.status === 'ACTIVE' && isBusiness && contract.paymentStatus !== 'ESCROWED') {
    return (
      <Card tone="primary">
        <Text style={styles.actionTitle}>Betala in arvodet</Text>
        <Body>
          Beloppet ligger spärrat hos oss och betalas ut till kreatören först när du godkänt
          leveransen.
        </Body>
        <Button label={`Betala ${formatSek(contract.fee)}`} onPress={onPay} loading={busy} />
      </Card>
    );
  }

  if (contract.status === 'ACTIVE' && !isBusiness) {
    return (
      <Card tone="primary">
        <Text style={styles.actionTitle}>Rapportera din leverans</Text>
        <Body>Klistra in länken till det publicerade inlägget när det ligger uppe.</Body>
        {showDelivery ? (
          <>
            <Field
              label="Länk"
              value={deliveryUrl}
              onChangeText={onDeliveryUrlChange}
              placeholder="https://www.tiktok.com/@…"
            />
            <Button
              label="Skicka in"
              onPress={onDeliver}
              loading={busy}
              disabled={deliveryUrl.trim().length === 0}
            />
          </>
        ) : (
          <Button label="Rapportera leverans" onPress={onOpenDelivery} />
        )}
      </Card>
    );
  }

  if (contract.status === 'DELIVERED' && isBusiness) {
    return (
      <Card tone="primary">
        <Text style={styles.actionTitle}>Godkänn leveransen</Text>
        <Body>
          När du godkänner betalas {formatSek(contract.payout)} ut till kreatören. Godkänner du
          inte inom {contract.reviewDays} dagar sker det automatiskt.
        </Body>
        <Button label="Godkänn och betala ut" onPress={onApprove} loading={busy} />
      </Card>
    );
  }

  if (contract.status === 'DELIVERED') {
    return (
      <Card>
        <Text style={styles.actionTitle}>Inskickat</Text>
        <Body>
          Restaurangen har {contract.reviewDays} dagar på sig att godkänna. Sedan betalas
          {' '}
          {formatSek(contract.payout)} ut automatiskt.
        </Body>
      </Card>
    );
  }

  return null;
}

function SignatureRow({
  name,
  signedAt,
  waitingLabel,
}: {
  name: string;
  signedAt: string | null;
  waitingLabel: string;
}) {
  return (
    <View style={styles.signatureRow}>
      {signedAt ? (
        <CheckIcon size={18} color={colors.positive} />
      ) : (
        <View style={styles.emptyRing} />
      )}
      <View style={styles.signatureText}>
        <Text style={styles.signatureName}>{name}</Text>
        <Text style={styles.secondary}>
          {signedAt ? `Signerade ${formatDate(signedAt)}` : waitingLabel}
        </Text>
      </View>
    </View>
  );
}

function TrustStep({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={styles.trustStep}>
      <View style={[styles.trustBar, done && styles.trustBarDone]} />
      <Text style={styles.trustLabel}>{label}</Text>
    </View>
  );
}

function TimelineStep({
  title,
  detail,
  last = false,
}: {
  title: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <CheckIcon size={18} color={colors.positive} />
        {!last ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={[styles.timelineText, !last && styles.timelineTextSpaced]}>
        <Text style={styles.signatureName}>{title}</Text>
        {detail ? <Text style={styles.secondary}>{detail}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  titleBlock: { gap: 6 },
  title: { fontFamily: type.cardTitle.fontFamily, fontSize: 23, lineHeight: 27.6, letterSpacing: -0.23, color: colors.text },
  counterpart: { ...type.bodySmall, color: colors.muted },
  secondary: { ...type.secondary, color: colors.muted },
  error: { ...type.secondary, color: colors.danger },

  payoutCard: { gap: 4 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  reviewBlock: { gap: spacing.sm },
  payoutAmount: { ...type.amountLarge, color: colors.positive },

  signatureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signatureText: { flex: 1 },
  signatureName: { ...type.listTitle, color: colors.text },
  emptyRing: {
    width: 18,
    height: 18,
    borderRadius: radius.round,
    borderWidth: 1.5,
    borderColor: colors.border,
  },

  actionTitle: { ...type.rowTitle, color: colors.text },

  trustHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trustTitle: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.text },
  trustSteps: { flexDirection: 'row', gap: spacing.sm },
  trustStep: { flex: 1, gap: 6 },
  trustBar: { height: 3, borderRadius: 2, backgroundColor: colors.border },
  trustBarDone: { backgroundColor: colors.positive },
  trustLabel: { fontFamily: type.secondary.fontFamily, fontSize: 12, lineHeight: 16.2, color: colors.muted },

  timelineRow: { flexDirection: 'row', gap: spacing.md },
  timelineRail: { alignItems: 'center' },
  timelineLine: { width: 2, flex: 1, backgroundColor: colors.border },
  timelineText: { flex: 1, gap: 2 },
  timelineTextSpaced: { paddingBottom: spacing.base },

  terms: { gap: spacing.sm },
  termsExcerpt: { fontFamily: type.secondary.fontFamily, fontSize: 13, lineHeight: 20.8, color: colors.muted },
  termsLink: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.primary },
});
