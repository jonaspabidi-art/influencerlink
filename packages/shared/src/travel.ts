/**
 * Reseläge: kreatören är på en annan ort under en period.
 *
 * Uppdragen kräver ett fysiskt besök, så orten avgör vem som kan ta vad. Men
 * en kreatör är inte fast på en punkt: den som bor i Göteborg och ska till
 * Stockholm över helgen kan ta uppdrag där – och är just då mer värdefull för
 * en Stockholmsrestaurang än någon som bor där, eftersom hen är ny för deras
 * publik.
 *
 * Det här är alltså inte ett filter utan en andra hemort med utgångsdatum.
 */

export interface TravelPlan {
  city: string;
  /** Första dagen på plats. */
  from: Date;
  /** Sista dagen på plats, inklusive. */
  to: Date;
}

/** Samma ort oavsett versaler och blanksteg. */
export function sameCity(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Sant när resan pågår vid tidpunkten. Sista dagen räknas hela dagen ut. */
export function isTravelling(travel: TravelPlan | null | undefined, now = new Date()): boolean {
  if (!travel) return false;
  const endOfLastDay = new Date(travel.to);
  endOfLastDay.setHours(23, 59, 59, 999);
  return now.getTime() >= travel.from.getTime() && now.getTime() <= endOfLastDay.getTime();
}

/** Sant när resan ligger framåt i tiden. */
export function isTravelPlanned(travel: TravelPlan | null | undefined, now = new Date()): boolean {
  if (!travel) return false;
  return travel.from.getTime() > now.getTime();
}

/**
 * Resan har varit och är inte längre intressant.
 *
 * Används för att sluta visa den i stället för att radera den: en passerad
 * resa säger fortfarande något sant om var kreatören varit, men den ska inte
 * påverka vem som matchar i dag.
 */
export function isTravelOver(travel: TravelPlan | null | undefined, now = new Date()): boolean {
  if (!travel) return false;
  return !isTravelling(travel, now) && !isTravelPlanned(travel, now);
}

/** Orterna kreatören kan ta uppdrag på just nu: hemorten, plus resan om den pågår. */
export function activeCities(
  home: string,
  travel: TravelPlan | null | undefined,
  now = new Date(),
): string[] {
  if (!isTravelling(travel, now) || !travel) return [home];
  return sameCity(home, travel.city) ? [home] : [home, travel.city];
}

/**
 * Sant när kreatören är tillgänglig på orten – nu eller under en planerad resa.
 *
 * Planerade resor räknas med, eftersom ett företag som söker kreatörer i dag
 * gärna bokar någon som kommer på fredag. Att gömma hen tills hen landat vore
 * att gömma henne när hon är som mest användbar.
 */
export function availableIn(
  home: string,
  travel: TravelPlan | null | undefined,
  city: string,
  now = new Date(),
): boolean {
  if (sameCity(home, city)) return true;
  if (!travel || isTravelOver(travel, now)) return false;
  return sameCity(travel.city, city);
}

const dayFormatter = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' });

/**
 * Raden som står på kreatörens kort när hen är eller ska bli tillgänglig
 * någon annanstans. Null när resan inte säger något användbart.
 */
export function describeTravel(
  travel: TravelPlan | null | undefined,
  now = new Date(),
): string | null {
  if (!travel || isTravelOver(travel, now)) return null;
  const period = `${dayFormatter.format(travel.from)}–${dayFormatter.format(travel.to)}`;
  return isTravelling(travel, now)
    ? `På plats i ${travel.city} till ${dayFormatter.format(travel.to)}`
    : `I ${travel.city} ${period}`;
}

/** Så långt fram en resa får planeras. Längre bort är det en gissning. */
export const MAX_TRAVEL_DAYS_AHEAD = 180;
/** Så länge en enskild resa får vara. Längre är en flytt, inte en resa. */
export const MAX_TRAVEL_LENGTH_DAYS = 60;
