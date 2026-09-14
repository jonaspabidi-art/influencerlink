import type { TourStep } from './Tour';

/**
 * Rundturens innehåll.
 *
 * Turen går igenom appen på riktigt: varje steg byter till den skärm det
 * handlar om, så att det som beskrivs syns bakom hinnan. Beskrivningar utan
 * skärm bakom sig – "här ligger era avtal" med kreatörslistan kvar – lär
 * ingen var något finns.
 *
 * Versionsnumret i nyckeln avgör vem som får se turen igen. Höj det när
 * stegen ändrats så mycket att den som redan gått igenom turen har nytta av
 * en ny – till exempel när en knapp bytt plats.
 */
export const BUSINESS_TOUR_KEY = 'business.v2';
export const INFLUENCER_TOUR_KEY = 'influencer.v2';

const BUSINESS_TABS = 5;
const INFLUENCER_TABS = 5;

export const businessTour: TourStep[] = [
  {
    route: '/business/discover',
    target: { kind: 'tab', index: 0, count: BUSINESS_TABS },
    title: 'Kreatörer',
    body: 'Alla kreatörer i er stad. Tryck på ett kort för att se profilen, tidigare jobb och omdömen. Har någon sökt till er kampanj ligger hen överst.',
  },
  {
    route: '/business/campaigns',
    target: { kind: 'tab', index: 1, count: BUSINESS_TABS },
    title: 'Uppdrag',
    body: 'Här ligger allt ni lagt ut. Engångskampanjer är ett jobb i taget. Löpande uppdrag är en kreatör som filmar åt er varje månad, till era egna kanaler.',
  },
  {
    route: '/business/campaigns',
    target: { kind: 'anchor', id: 'business.newCampaign' },
    title: 'Så skapar ni en kampanj',
    body: 'Plusknappen står kvar här oavsett hur många uppdrag ni har. Beskriv i två meningar vad ni vill ha, så skriver vi förslaget åt er – ni ändrar det ni vill innan det publiceras.',
  },
  {
    title: 'Så går en kampanj till',
    body: '1. Ni beskriver uppdraget och sätter en budget.\n2. Kreatörer ansöker, ni väljer vem ni vill ha.\n3. Båda parter signerar avtalet.\n4. Filmen levereras – ni godkänner, sedan betalas kreatören.',
  },
  {
    route: '/business/matches',
    target: { kind: 'tab', index: 2, count: BUSINESS_TABS },
    title: 'Matchningar',
    body: 'När ni och kreatören båda sagt ja hamnar samarbetet här. Det är också här ni skriver med varandra om tider och detaljer.',
  },
  {
    route: '/business/contracts',
    target: { kind: 'tab', index: 3, count: BUSINESS_TABS },
    title: 'Avtal',
    body: 'Här signerar ni avtalen. Arvodet betalas in när avtalet är påskrivet och ligger kvar hos Pacta tills ni godkänt filmen – kreatören vet att pengarna finns, ni betalar inte för något ni inte fått.',
  },
  {
    route: '/business/profile',
    target: { kind: 'tab', index: 4, count: BUSINESS_TABS },
    title: 'Profil',
    body: 'Bilder på stället, era egna kanaler och organisationsnumret. Bilderna är det första en kreatör tittar på. Rundturen finns kvar här om ni vill se den igen.',
  },
];

export const influencerTour: TourStep[] = [
  {
    route: '/influencer/swipe',
    target: { kind: 'tab', index: 0, count: INFLUENCER_TABS },
    title: 'Upptäck',
    body: 'Betalda uppdrag från företag nära dig. Ett kort i taget, med arvodet synligt innan du söker.',
  },
  {
    route: '/influencer/swipe',
    target: { kind: 'anchor', id: 'influencer.swipe' },
    title: 'Så ansöker du',
    body: 'Svep höger eller tryck på bocken för att söka uppdraget. Vänster eller krysset tackar nej. Säger företaget ja tillbaka blir det en matchning.',
  },
  {
    route: '/influencer/matches',
    target: { kind: 'tab', index: 1, count: INFLUENCER_TABS },
    title: 'Matchningar',
    body: 'Här landar uppdragen ni båda sagt ja till, med chatt. Får du få matchningar kan du be om en genomgång av varför – den säger vad som faktiskt stoppar dig.',
  },
  {
    route: '/influencer/contracts',
    target: { kind: 'tab', index: 2, count: INFLUENCER_TABS },
    title: 'Avtal',
    body: 'Du signerar avtalet här. Först då betalar företaget in arvodet, och det ligger hos Pacta tills din film är godkänd. Du börjar aldrig filma på ett löfte.',
  },
  {
    route: '/influencer/wallet',
    target: { kind: 'tab', index: 3, count: INFLUENCER_TABS },
    title: 'Plånbok',
    body: 'Godkänt jobb betalas ut hit. Du ser vad som är på väg in och vad som redan kommit.',
  },
  {
    route: '/influencer/profile',
    target: { kind: 'tab', index: 4, count: INFLUENCER_TABS },
    title: 'Profil',
    body: 'Ditt pris, dina nischer och dina klipp. Rundturen finns kvar här om du vill se den igen.',
  },
  {
    route: '/influencer/profile',
    target: { kind: 'anchor', id: 'influencer.socials' },
    title: 'Gör det här först',
    body: 'Koppla TikTok och Instagram. Med TikTok inloggat hämtas följare och visningar automatiskt, och siffrorna blir verifierade – det är skillnaden mellan att påstå och att visa. Många uppdrag har dessutom en lägsta följarnivå.',
  },
];
