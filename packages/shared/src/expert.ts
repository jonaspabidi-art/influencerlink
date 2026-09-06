import type { Ore } from './money.js';

/**
 * "Låt en Pacta-expert skapa kampanjen."
 *
 * Företagaren beskriver vad hon vill uppnå, och vi bygger kampanjen åt henne
 * med plattformens egna data och rådgivaren som underlag. Vi signerar dock
 * aldrig något: kampanjen levereras till hennes konto och hon publicerar den
 * själv. I samma sekund som vi trycker på knappen åt henne är vi part i
 * affären i stället för förmedlare.
 */

/** Fast pris per kampanj. Ingen löpande avgift, inget abonnemang. */
export const EXPERT_ORDER_PRICE: Ore = 490_000;

/**
 * Så många uppdrag vi tar emot samtidigt.
 *
 * Efterfrågan är obegränsad, timmarna är det inte. Utan tak säljer vi mer än
 * vi hinner leverera, och det första en ny tjänst inte har råd med är en kund
 * som väntat förgäves.
 */
export const EXPERT_ORDER_CAPACITY = 5;

export const EXPERT_ORDER_STATUSES = [
  'REQUESTED',
  'IN_PROGRESS',
  'DELIVERED',
  'APPROVED',
  'CANCELLED',
] as const;
export type ExpertOrderStatus = (typeof EXPERT_ORDER_STATUSES)[number];

/** Vad företaget ser att det står och väntar på. */
export const EXPERT_ORDER_LABELS: Record<ExpertOrderStatus, string> = {
  REQUESTED: 'Mottagen',
  IN_PROGRESS: 'Vi jobbar på den',
  DELIVERED: 'Klar att granska',
  APPROVED: 'Publicerad',
  CANCELLED: 'Avbruten',
};

/** Statusar som upptar en plats i kön. */
export function occupiesCapacity(status: ExpertOrderStatus): boolean {
  return status === 'REQUESTED' || status === 'IN_PROGRESS';
}

/** Om vi kan ta emot fler uppdrag just nu. */
export function hasCapacity(openOrders: number): boolean {
  return openOrders < EXPERT_ORDER_CAPACITY;
}

/**
 * Frågorna vi ställer.
 *
 * Fyra, inte fler. Den som beställer det här gör det för att slippa fylla i
 * formulär – ett långt intag hade motverkat hela poängen.
 */
export const EXPERT_ORDER_QUESTIONS = [
  {
    key: 'goal',
    label: 'Vad vill ni få ut av det?',
    placeholder: 'Fler bokningar på tisdagar och torsdagar.',
    required: true,
  },
  {
    key: 'timing',
    label: 'När vill ni att det ska hända?',
    placeholder: 'Gärna innan påsk.',
    required: true,
  },
  {
    key: 'budget',
    label: 'Ungefärlig budget?',
    placeholder: 'Vet inte riktigt – säg vad som är rimligt.',
    required: false,
  },
  {
    key: 'notes',
    label: 'Något vi bör veta?',
    placeholder: 'Vi har inget kök på söndagar.',
    required: false,
  },
] as const;
