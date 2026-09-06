import { LegalScreen } from '../src/components/LegalScreen';
import { LEGAL, type LegalSection } from '../src/legal';

/**
 * Användarvillkor.
 *
 * Beskriver hur tjänsten faktiskt fungerar: vi är mellanhand, avtalet ingås
 * mellan restaurang och kreatör, och pengarna ligger spärrade tills jobbet är
 * godkänt. Ändras det flödet ska texten ändras med det.
 */
const SECTIONS: LegalSection[] = [
  {
    title: 'Vad Pacta är',
    paragraphs: [
      `${LEGAL.serviceName} drivs av ${LEGAL.companyName}, organisationsnummer ${LEGAL.orgNumber}. Tjänsten är en marknadsplats där företag och innehållskreatörer hittar varandra och ingår samarbeten.`,
      'Vi är mellanhand. Avtalet om ett samarbete ingås mellan företaget och kreatören – vi är inte part i det, och vi är inte arbetsgivare åt någon kreatör.',
    ],
  },
  {
    title: 'Konto',
    paragraphs: [
      'Du måste vara 18 år för att skapa konto. Uppgifterna du lämnar ska vara riktiga, och du ansvarar för det som görs från ditt konto.',
      'Företagskonton får bara skapas av någon som har rätt att företräda företaget.',
      'Vi kan stänga av ett konto som bryter mot villkoren, används för bedrägeri eller uppger falska uppgifter om räckvidd eller verksamhet.',
    ],
  },
  {
    title: 'Så går ett samarbete till',
    paragraphs: [
      'Ett företag publicerar en kampanj. Kreatörer och företag visar intresse, och när båda gjort det uppstår en matchning där ni kommer överens om detaljerna.',
      'När ni är överens skapas ett avtal som båda signerar med BankID. Avtalet innehåller vad som ska levereras, när, och vad ersättningen är.',
      'Företaget betalar in ersättningen innan arbetet börjar. Beloppet ligger spärrat hos vår betaltjänst och betalas ut till kreatören när leveransen är godkänd.',
    ],
  },
  {
    title: 'Ersättning och avgift',
    paragraphs: [
      `Förmedlingsavgiften delas mellan parterna. Företaget betalar ${LEGAL.businessFeePercent} % ovanpå arvodet, och ${LEGAL.creatorFeePercent} % dras från kreatörens utbetalning. Båda beloppen står i avtalet innan ni signerar.`,
      'Ingår mat, produkter eller en upplevelse i ersättningen anges värdet i avtalet. Det är kreatörens ansvar att hantera det skattemässigt.',
      'Kreatören ansvarar själv för skatter och avgifter på sin ersättning. Har kreatören inget företag kan utbetalningen gå via en löneförmedlare, och de villkoren visas innan valet görs.',
    ],
  },
  {
    title: 'Ansvar för innehållet',
    paragraphs: [
      'Kreatören ansvarar för det innehåll som publiceras, att det följer plattformarnas regler och att samarbeten märks som reklam enligt marknadsföringslagen.',
      'Företaget ansvarar för att briefen är riktig och att det som utlovas i kampanjen stämmer.',
      'Vi granskar inte innehåll i förväg, men kan ta bort material i tjänsten som är olagligt eller uppenbart vilseledande.',
    ],
  },
  {
    title: 'Omdömen',
    paragraphs: [
      'Efter ett avslutat samarbete kan båda parter lämna omdöme. Omdömena publiceras först när båda skrivit sitt, eller när fjorton dagar gått – ingen ska kunna vänta ut motparten och svara på ett omdöme hon redan läst.',
      'Ett omdöme ska vara sakligt och gälla samarbetet. Vi kan ta bort omdömen som är kränkande eller uppenbart osanna.',
    ],
  },
  {
    title: 'Siffror från sociala konton',
    paragraphs: [
      'Kopplar du ett socialt konto hämtar vi följarantal och statistik från plattformen. Siffror som inte är hämtade därifrån är markerade som ogranskade i tjänsten.',
      'Att medvetet uppge falsk räckvidd är grund för avstängning.',
    ],
  },
  {
    title: 'Avbokning',
    paragraphs: [
      'Innan ett avtal signerats kan vem som helst dra sig ur utan kostnad.',
      'Efter signering gäller det ni kommit överens om i avtalet. Kommer ni inte överens om ett avbrutet samarbete kan vi hjälpa till att medla, men beslutet om spärrade pengar följer avtalet.',
    ],
  },
  {
    title: 'Vårt ansvar',
    paragraphs: [
      'Vi ansvarar för att tjänsten fungerar som beskrivet, men inte för att ett samarbete blir lyckat, att en kampanj ger effekt eller för avtalsbrott mellan parterna.',
      'Vi ansvarar inte för avbrott hos våra leverantörer, till exempel om en plattform ändrar sitt API eller en betaltjänst ligger nere.',
    ],
  },
  {
    title: 'Ändringar och tvist',
    paragraphs: [
      'Vi kan ändra villkoren. Väsentliga ändringar meddelas i appen innan de börjar gälla, och fortsätter du använda tjänsten efter det gäller de nya villkoren.',
      'Svensk lag gäller. Tvist prövas av svensk allmän domstol. Är du konsument kan du också vända dig till Allmänna reklamationsnämnden.',
      `Frågor om villkoren: ${LEGAL.contactEmail}.`,
    ],
  },
];

export default function Terms() {
  return (
    <LegalScreen
      title="Användarvillkor"
      lead={`Villkoren gäller när du använder ${LEGAL.serviceName}. Läs dem – de beskriver vad vi ansvarar för och vad du och din motpart ansvarar för.`}
      sections={SECTIONS}
    />
  );
}
