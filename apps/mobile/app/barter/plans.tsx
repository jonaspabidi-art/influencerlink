import { BARTER_PLAN_SPECS, SELLABLE_BARTER_PLANS } from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { CAN_PURCHASE_IN_APP, openBillingPage } from '../../src/billing';
import { Body, Button, Card, Header, ScrollScreen, Tag } from '../../src/components/ui';
import { CheckIcon } from '../../src/components/icons';
import { formatDate, formatSek } from '../../src/format';
import { barterQuery } from '../../src/queries';
import type { BarterStatus, BarterSubscribeResult } from '../../src/types';
import { colors, spacing, type } from '../../src/theme';

type SellablePlan = (typeof SELLABLE_BARTER_PLANS)[number];

/**
 * Nivåerna för mat mot innehåll, och där de köps.
 *
 * Betalningen sker på Stripes egen sida. Hit kommer företaget tillbaka med
 * ett sessions-id i adressen, och skärmen ber servern bekräfta direkt – utan
 * att vänta på webhooken, som kan dröja eller saknas i en testmiljö.
 */
export default function BarterPlans() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    checkout?: string;
    session_id?: string;
  }>();
  const { user, loading: authLoading } = useAuth();
  /*
   * Efter betalsidan laddas webbappen om från början, och den här skärmen
   * ritas innan inloggningen hunnit läsas in. Ett anrop då går ut utan token,
   * får 401 – och appen loggar ut den som just betalat. Därför väntar allt här
   * tills sessionen är på plats.
   */
  const signedIn = !authLoading && user !== null;
  const status = useQuery({ ...barterQuery(), enabled: signedIn });
  const [message, setMessage] = useState<{
    tone: 'positive' | 'raised';
    text: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = status.data?.plan ?? 'NONE';

  const store = (next: BarterStatus) => queryClient.setQueryData(barterQuery().queryKey, next);

  const confirm = useMutation({
    mutationFn: (sessionId: string) => api.post<BarterStatus>('/me/barter/confirm', { sessionId }),
    onSuccess: (next) => {
      store(next);
      // Utan det här bekräftas samma betalning igen vid en omladdning.
      router.setParams({ checkout: undefined, session_id: undefined });
      setMessage({
        tone: 'positive',
        text: `Klart! Ni har ${BARTER_PLAN_SPECS[next.plan].label} och kan lägga upp ${next.limit} samarbeten i månaden.`,
      });
    },
    onError: () =>
      setError(
        'Betalningen gick igenom men nivån är inte påslagen än. Ladda om sidan om en stund.',
      ),
  });

  // Betalsidan skickar tillbaka hit. Bekräftelsen görs en gång per besök.
  const handled = useRef(false);
  useEffect(() => {
    if (handled.current || !signedIn) return;
    if (params.checkout === 'success' && params.session_id) {
      handled.current = true;
      confirm.mutate(params.session_id);
    } else if (params.checkout === 'cancelled') {
      handled.current = true;
      setMessage({
        tone: 'raised',
        text: 'Ingen betalning gjordes. Ni kan välja en nivå när ni vill.',
      });
    }
  }, [params.checkout, params.session_id, confirm, signedIn]);

  const subscribe = useMutation({
    mutationFn: (plan: SellablePlan) =>
      api.post<BarterSubscribeResult>('/me/barter/subscribe', { plan }),
    onMutate: () => {
      setError(null);
      setMessage(null);
    },
    onSuccess: async (result) => {
      if (result.kind === 'redirect') {
        await openBillingPage(result.url);
        // I appen: webbläsaren är stängd när vi kommer hit. Läs om läget.
        void status.refetch();
        return;
      }
      store(result.status);
      setMessage({
        tone: 'positive',
        text: `Ni har bytt till ${BARTER_PLAN_SPECS[result.status.plan].label}. Mellanskillnaden hamnar på nästa faktura.`,
      });
    },
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Kunde inte öppna betalningen.'),
  });

  const portal = useMutation({
    mutationFn: () => api.post<{ url: string }>('/me/barter/portal'),
    onMutate: () => setError(null),
    onSuccess: async ({ url }) => {
      await openBillingPage(url);
      void status.refetch();
    },
    onError: (caught) =>
      setError(caught instanceof Error ? caught.message : 'Kunde inte öppna kundportalen.'),
  });

  if (!authLoading && !user) return <Redirect href="/login" />;

  const data = status.data;
  const busyPlan = subscribe.isPending ? subscribe.variables : null;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title="Mat mot innehåll" onBack={() => router.back()} />

      <Body>
        Lägg upp uppdrag där ersättningen är en måltid i stället för pengar. Det passar kreatörer
        som bygger upp sin portfölj, och er som vill ha innehåll utan kampanjbudget.
      </Body>

      {message ? (
        <Card tone={message.tone}>
          <Body>{message.text}</Body>
        </Card>
      ) : null}
      {confirm.isPending ? (
        <Card tone="raised">
          <Body>Bekräftar betalningen…</Body>
        </Card>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {data?.subscribed ? <SubscriptionCard status={data} /> : null}

      {data?.subscribed ? (
        <Button
          label="Hantera abonnemang"
          variant="secondary"
          loading={portal.isPending}
          onPress={() => portal.mutate()}
        />
      ) : null}

      {SELLABLE_BARTER_PLANS.map((plan) => {
        const spec = BARTER_PLAN_SPECS[plan];
        const active = current === plan;
        return (
          <Card key={plan} tone={active ? 'primary' : 'surface'}>
            <View style={styles.head}>
              <Text style={styles.name}>{spec.label}</Text>
              {active ? <Tag label="Er nivå" /> : null}
            </View>
            <Text style={styles.price}>
              {formatSek(spec.monthlyPrice)} / månad <Text style={styles.vat}>exkl. moms</Text>
            </Text>
            <Body>{spec.lead}</Body>
            <View style={styles.bullet}>
              <CheckIcon size={16} color={colors.positive} />
              <Text style={styles.bulletText}>{spec.monthlyCollabs} samarbeten i månaden</Text>
            </View>
            <View style={styles.bullet}>
              <CheckIcon size={16} color={colors.positive} />
              <Text style={styles.bulletText}>Ingen bindningstid</Text>
            </View>
            {CAN_PURCHASE_IN_APP && !active ? (
              <Button
                label={planButtonLabel(plan, data)}
                variant={current === 'NONE' ? 'primary' : 'secondary'}
                loading={busyPlan === plan}
                disabled={subscribe.isPending || confirm.isPending || !data}
                onPress={() => subscribe.mutate(plan)}
              />
            ) : null}
          </Card>
        );
      })}

      {!CAN_PURCHASE_IN_APP ? (
        <Card tone="raised">
          <Text style={styles.name}>Så tecknar ni</Text>
          <Body>
            Abonnemanget tecknas och hanteras på webben, pacta.se. Logga in där med samma konto, så
            syns nivån här direkt.
          </Body>
        </Card>
      ) : null}

      {data?.testMode && CAN_PURCHASE_IN_APP ? (
        <Card tone="raised">
          <Text style={styles.name}>Testläge</Text>
          <Body>
            Inga riktiga pengar dras. Betala med kortnummer 4242 4242 4242 4242, valfritt framtida
            datum och valfri CVC.
          </Body>
        </Card>
      ) : null}

      <Text style={styles.footnote}>
        Kreatören får mat eller ett besök i stället för arvode. Inga pengar går via Pacta i de här
        uppdragen, och kreatören svarar själv för sin skatt. Säger ni upp gäller nivån månaden ut,
        och pågående samarbeten fullföljs.
      </Text>
    </ScrollScreen>
  );
}

function planButtonLabel(plan: SellablePlan, status: BarterStatus | undefined): string {
  const label = BARTER_PLAN_SPECS[plan].label;
  if (!status || status.plan === 'NONE') return `Välj ${label}`;
  return `Byt till ${label}`;
}

/** Vad som gäller just nu: nästa dragning, uppsägning eller ett kort som nekats. */
function SubscriptionCard({ status }: { status: BarterStatus }) {
  let text: string;
  if (status.pastDue) {
    text =
      'Senaste dragningen gick inte igenom. Nivån gäller medan vi försöker igen – byt kort under Hantera abonnemang.';
  } else if (status.cancelsAt) {
    text = `Uppsagt. Nivån gäller till och med ${formatDate(status.cancelsAt)} – välj en nivå nedan för att fortsätta.`;
  } else if (status.renewsAt) {
    text = `Förnyas ${formatDate(status.renewsAt)} – ${status.remaining} av ${status.limit} samarbeten kvar den här månaden.`;
  } else {
    text = `${status.remaining} av ${status.limit} samarbeten kvar den här månaden.`;
  }
  return (
    <Card tone={status.pastDue ? 'raised' : 'positive'}>
      <Text style={[styles.name, status.pastDue && styles.errorTitle]}>
        {BARTER_PLAN_SPECS[status.plan].label}
      </Text>
      <Body>{text}</Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: 0 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: { ...type.rowTitle, color: colors.text },
  price: { ...type.amountSmall, color: colors.accent },
  vat: { ...type.secondary, color: colors.muted },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bulletText: { ...type.bodySmall, color: colors.muted, flex: 1 },
  footnote: { ...type.secondary, color: colors.muted },
  error: { ...type.bodySmall, color: colors.primary },
  errorTitle: { color: colors.primary },
});
