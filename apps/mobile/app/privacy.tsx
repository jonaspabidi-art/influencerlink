import { LegalScreen } from '../src/components/LegalScreen';
import { LEGAL, type LegalSection } from '../src/legal';

/**
 * Integritetspolicy.
 *
 * Ska stämma med vad koden faktiskt gör. Ändras behandlingen – ny mottagare,
 * ny uppgift, ny lagringstid – ska den här texten ändras i samma ändring.
 */
const SECTIONS: LegalSection[] = [
  {
    title: 'Vem som ansvarar',
    paragraphs: [
      `${LEGAL.companyName}, organisationsnummer ${LEGAL.orgNumber}, är personuppgiftsansvarig för behandlingen av dina uppgifter i ${LEGAL.serviceName}.`,
      `Har du frågor om hur vi hanterar dina uppgifter, eller vill använda någon av rättigheterna längre ned, når du oss på ${LEGAL.contactEmail}.`,
    ],
  },
  {
    title: 'Vad vi samlar in',
    paragraphs: ['Vilka uppgifter vi har om dig beror på om du är kreatör eller företag.'],
    bullets: [
      'Konto: namn, e-postadress och ett lösenord som lagras krypterat. Vi kan aldrig läsa ditt lösenord.',
      'Legitimering: när du signerar ett avtal med BankID sparar vi ditt personnummer i krypterad form, tillsammans med de fyra sista siffrorna maskerade så att du känner igen ditt eget konto.',
      'Kreatörsprofil: profilnamn, presentation, ort, nischer, prisnivåer och profilbild.',
      'Företagsprofil: företagsnamn, organisationsnummer, adress, beskrivning och logotyp.',
      'Sociala konton: användarnamn, följarantal och statistik för dina senaste videor, hämtat från plattformen efter att du loggat in där. Länkar till inlägg du själv väljer att visa upp.',
      'Samarbeten: kampanjer, avtal, meddelanden mellan parterna, leveranser och omdömen.',
      'Betalningar: belopp, status och referenser. Kortuppgifter och bankkonton hanteras av Stripe och passerar aldrig våra servrar.',
      'Loggar: en händelselogg över det som har juridisk eller ekonomisk betydelse, till exempel när ett avtal signerades eller en utbetalning gjordes.',
    ],
  },
  {
    title: 'Varför vi behandlar uppgifterna',
    paragraphs: [
      'Vi behandlar bara uppgifter vi behöver, och varje ändamål vilar på en rättslig grund.',
    ],
    bullets: [
      'För att kunna leverera tjänsten – matcha, ingå avtal och betala ut – behandlar vi uppgifter för att fullgöra avtalet med dig.',
      'För att bokföra avtal och betalningar behandlar vi uppgifter för att uppfylla en rättslig förpliktelse.',
      'För att föreslå relevanta samarbeten och skydda tjänsten mot missbruk stödjer vi oss på berättigat intresse.',
      'Kopplingen till TikTok, Instagram eller YouTube sker på ditt samtycke. Du kan när som helst koppla bort kontot, och då slutar vi hämta uppgifter därifrån.',
    ],
  },
  {
    title: 'Sociala konton',
    paragraphs: [
      'När du kopplar ett socialt konto loggar du in hos plattformen och ger oss tillstånd att läsa vissa uppgifter. Vi hämtar ditt användarnamn, ditt följarantal och statistik för dina senaste videor: visningar, gillanden, kommentarer och delningar.',
      'Vi ber aldrig om behörighet att publicera något åt dig, och vi kan inte göra det.',
      'De åtkomstnycklar plattformen ger oss lagras krypterade och lämnar aldrig våra servrar. Kopplar du bort kontot raderas nycklarna.',
      'Följarantal och snittvisningar visas för företag som ser din profil. Det är hela poängen med att koppla kontot – det är så du får betalt för din faktiska räckvidd.',
    ],
  },
  {
    title: 'Vilka som får del av uppgifterna',
    paragraphs: [
      'Vi säljer aldrig dina uppgifter. Vi delar dem med motparten i ett samarbete och med de leverantörer som krävs för att tjänsten ska fungera.',
    ],
    bullets: [
      'Motparten i ett samarbete ser din profil, dina siffror och dina omdömen. I ett avtal ser ni varandras namn och organisations- eller personuppgifter, eftersom ni ingår ett avtal med varandra.',
      'Supabase: databasen, med servrar inom EU.',
      'Railway och Netlify: drift av tjänsten.',
      'Stripe: betalningar och utbetalningar.',
      'BankID: legitimering vid signering.',
      'TikTok, Meta och Google: när du kopplar ett konto hos dem.',
      'Anthropic: texten i en kampanj kan skickas till en språkmodell för att föreslå matchningar. Vi skickar aldrig personnummer, kontaktuppgifter eller meddelanden dit.',
      'Myndigheter, när lagen kräver det.',
    ],
  },
  {
    title: 'Hur länge vi sparar',
    paragraphs: [
      'Din profil finns kvar så länge du har ett konto. Raderar du kontot tar vi bort profilen och dina sociala kopplingar.',
      'Avtal, fakturaunderlag och betalningar sparas i sju år efter räkenskapsårets slut, eftersom bokföringslagen kräver det. Det gäller även om du raderat ditt konto.',
      'Omdömen ligger kvar knutna till samarbetet, men utan koppling till en raderad profil.',
    ],
  },
  {
    title: 'Dina rättigheter',
    paragraphs: [
      'Du har rätt att få veta vilka uppgifter vi har om dig, få felaktiga uppgifter rättade, få uppgifter raderade, invända mot behandling som vilar på berättigat intresse, och få ut dina uppgifter i ett maskinläsbart format.',
      `Hör av dig till ${LEGAL.contactEmail} så hjälper vi dig. Är du inte nöjd med hur vi hanterar dina uppgifter har du rätt att klaga till Integritetsskyddsmyndigheten, imy.se.`,
    ],
  },
  {
    title: 'Säkerhet',
    paragraphs: [
      'Personnummer lagras aldrig i klartext. Åtkomstnycklar till sociala konton och andra hemligheter lagras krypterade. All trafik går över krypterad anslutning.',
      'Vi loggar händelser med juridisk eller ekonomisk betydelse, så att det i efterhand går att visa vad som hänt i ett samarbete.',
    ],
  },
  {
    title: 'Ändringar',
    paragraphs: [
      'Ändrar vi den här policyn uppdaterar vi datumet överst. Vid väsentliga ändringar berättar vi det i appen innan de börjar gälla.',
    ],
  },
];

export default function Privacy() {
  return (
    <LegalScreen
      title="Integritetspolicy"
      lead={`Så behandlar ${LEGAL.serviceName} dina personuppgifter. Vi samlar bara in det vi behöver för att du ska kunna hitta samarbeten, ingå avtal och få betalt.`}
      sections={SECTIONS}
    />
  );
}
