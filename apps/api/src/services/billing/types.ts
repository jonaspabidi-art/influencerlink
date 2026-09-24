import type { BarterPlan } from '@pacta/shared';

/** Nivåerna som går att köpa. NONE är frånvaron av ett abonnemang. */
export type SellablePlan = Exclude<BarterPlan, 'NONE'>;

/**
 * En prenumeration som den ser ut hos betaltjänsten just nu.
 *
 * Hämtas alltid färskt i stället för att läsas ur webhookens kropp. Stripe
 * lovar inte att händelser kommer i ordning, och en gammal "uppdaterad" som
 * landar efter en "avslutad" får inte väcka liv i ett abonnemang som är slut.
 */
export interface SubscriptionSnapshot {
  id: string;
  customerId: string;
  /** Satt av oss när prenumerationen skapades. Null om någon skapat den för hand. */
  businessId: string | null;
  /** Nivån enligt priset prenumerationen står på, null om priset är okänt. */
  plan: SellablePlan | null;
  status: string;
  renewsAt: Date | null;
  /** Satt när prenumerationen är uppsagd men gäller perioden ut. */
  cancelsAt: Date | null;
}

export interface StartCheckoutInput {
  businessId: string;
  customerId: string | null;
  companyName: string;
  orgNumber: string | null;
  plan: SellablePlan;
  /** Sidan i appen som betalsidan skickar tillbaka till. */
  returnUrl: string;
}

/**
 * Abonnemang som företagen betalar själva, på betaltjänstens egen sida.
 *
 * Skilt från PaymentProvider med flit: den håller kampanjpengar i väntan på
 * leverans, det här är en vanlig månadsavgift till Pacta. De kan komma att
 * ligga hos olika leverantörer, och då ska den ena gå att byta utan den andra.
 */
export interface BillingProvider {
  /** Sant när betalningarna går mot en testnyckel. Appen visar då testkortet. */
  readonly testMode: boolean;

  /** Skapar betalsidan. Returnerar också kund-id:t, som sparas för nästa gång. */
  startCheckout(input: StartCheckoutInput): Promise<{ url: string; customerId: string }>;

  /** Vilken prenumeration en genomförd betalsida gav, och för vilket företag. */
  subscriptionForCheckout(
    sessionId: string,
  ): Promise<{ businessId: string; subscriptionId: string } | null>;

  /** Byter nivå på en befintlig prenumeration, utan ny betalsida. */
  changePlan(subscriptionId: string, plan: SellablePlan): Promise<void>;

  /** Betaltjänstens sida där företaget byter kort, laddar ner kvitton och säger upp. */
  portalUrl(customerId: string, returnUrl: string): Promise<string>;

  /** Null om prenumerationen inte finns. */
  fetchSubscription(subscriptionId: string): Promise<SubscriptionSnapshot | null>;
}
