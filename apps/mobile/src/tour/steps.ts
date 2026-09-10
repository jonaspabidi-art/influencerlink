import type { TourStep } from './Tour';

/**
 * Rundturens innehåll.
 *
 * Versionsnumret i nyckeln avgör vem som får se turen igen. Höj det när
 * stegen ändrats så mycket att den som redan gått igenom turen har nytta av
 * en ny – annars poppar den upp i onödan för folk som redan förstått appen.
 */
export const BUSINESS_TOUR_KEY = 'business.v1';
export const INFLUENCER_TOUR_KEY = 'influencer.v1';

const BUSINESS_TABS = 5;
const INFLUENCER_TABS = 5;

export const businessTour: TourStep[] = [
  {
    target: { kind: 'tab', index: 0, count: BUSINESS_TABS },
    title: 'Kreatörer',
    body: 'Alla kreatörer i er stad. Tryck på ett kort för att se profilen, tidigare jobb och omdömen. Har någon sökt till er kampanj ligger hen överst.',
  },
  {
    target: { kind: 'anchor', id: 'business.create' },
    title: 'Så startar ni ett samarbete',
    body: 'Beskriv i två meningar vad ni vill ha. Vi skriver förslaget åt er – ni ändrar det ni vill innan det publiceras.',
  },
  {
    target: { kind: 'tab', index: 1, count: BUSINESS_TABS },
    title: 'Uppdrag',
    body: 'Här ligger allt ni lagt ut. Engångskampanjer är ett jobb i taget. Löpande uppdrag är en kreatör som filmar åt er varje månad, till era egna kanaler.',
  },
  {
    title: 'Så går en kampanj till',
    body: '1. Ni beskriver uppdraget och sätter en budget.\n2. Kreatörer ansöker, ni väljer vem ni vill ha.\n3. Ni signerar avtalet med BankID.\n4. Filmen levereras – ni godkänner, sedan betalas kreatören.',
  },
  {
    target: { kind: 'tab', index: 2, count: BUSINESS_TABS },
    title: 'Matchningar',
    body: 'När ni och kreatören båda sagt ja hamnar samarbetet här. Det är också här ni skriver med varandra om tider och detaljer.',
  },
  {
    target: { kind: 'tab', index: 3, count: BUSINESS_TABS },
    title: 'Avtal',
    body: 'Avtalen signeras med BankID. Arvodet betalas in när avtalet är påskrivet och ligger kvar hos Pacta tills ni godkänt filmen – kreatören vet att pengarna finns, ni betalar inte för något ni inte fått.',
  },
  {
    target: { kind: 'tab', index: 4, count: BUSINESS_TABS },
    title: 'Profil',
    body: 'Bilder på stället, era egna kanaler och organisationsnumret. Bilderna är det första en kreatör tittar på. Rundturen finns kvar här om ni vill se den igen.',
  },
];

export const influencerTour: TourStep[] = [
  {
    target: { kind: 'anchor', id: 'influencer.swipe' },
    title: 'Så ansöker du',
    body: 'Svep höger eller tryck på bocken för att söka uppdraget. Vänster eller krysset tackar nej. Säger företaget ja tillbaka blir det en matchning.',
  },
  {
    target: { kind: 'tab', index: 0, count: INFLUENCER_TABS },
    title: 'Upptäck',
    body: 'Betalda uppdrag från företag nära dig. Ett kort i taget, med arvodet synligt innan du söker.',
  },
  {
    target: { kind: 'tab', index: 1, count: INFLUENCER_TABS },
    title: 'Matchningar',
    body: 'Här landar uppdragen ni båda sagt ja till, med chatt. Får du få matchningar kan du be om en genomgång av varför – den säger vad som faktiskt stoppar dig.',
  },
  {
    target: { kind: 'tab', index: 2, count: INFLUENCER_TABS },
    title: 'Avtal',
    body: 'Du signerar med BankID. Först då betalar företaget in arvodet, och det ligger hos Pacta tills din film är godkänd. Du börjar aldrig filma på ett löfte.',
  },
  {
    target: { kind: 'tab', index: 3, count: INFLUENCER_TABS },
    title: 'Plånbok',
    body: 'Godkänt jobb betalas ut hit. Du ser vad som är på väg in och vad som redan kommit.',
  },
  {
    target: { kind: 'tab', index: 4, count: INFLUENCER_TABS },
    title: 'Profil',
    body: 'Ditt pris, dina nischer och dina klipp. Rundturen finns kvar här om du vill se den igen.',
  },
  {
    title: 'Koppla TikTok och Instagram',
    body: 'Gå till Profil → Sociala konton. Med TikTok inloggat hämtas följare och visningar automatiskt, och siffrorna blir verifierade – det är skillnaden mellan att påstå och att visa. Många uppdrag har en lägsta följarnivå, så gör det här först.',
  },
];
