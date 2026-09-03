# InfluencerLink

Mobil plattform där restauranger och influencers hittar varandra genom att swipa,
kommer överens i appen, signerar avtal med BankID och får betalt via Stripe.

Repot är en monorepo:

| Paket | Vad det är |
| --- | --- |
| `apps/mobile` | Expo-app (iOS/Android) med expo-router |
| `apps/api` | Fastify-API med Prisma mot PostgreSQL |
| `packages/shared` | Domäntyper, zod-scheman och matchningslogik som båda sidor delar |

## Så fungerar produkten

**För restaurangen.** Logga in med BankID, fyll i restaurangens uppgifter och
beskriv med några rader vad du vill ha. Claude Sonnet gör om texten till ett
komplett kampanjutkast – rubrik, brief, ersättning, leverabler och följarkrav –
som du justerar och publicerar. Sedan swipar du bland kreatörer som redan är
filtrerade på dina krav.

**För influencern.** Logga in med BankID, koppla TikTok, Instagram eller YouTube
och swipa bland samarbeten. Räckvidd och engagemang hämtas från kontona, så du
slipper skriva in siffror själv.

**När båda swipat höger** uppstår en matchning med chatt. Restaurangen skickar
ett avtal, båda signerar med BankID, restaurangen betalar in arvodet till ett
spärrat konto, influencern levererar och pengarna släpps vid godkännande.

## Matchningen

Matchningen körs i två steg, och det andra steget är alltid valfritt:

1. **Heuristiken** (`packages/shared/src/matching.ts`) poängsätter varje par
   0–100 på nisch (30), engagemang (25), räckvidd (20), geografi (15) och budget
   (10). Den är deterministisk och testad.
2. **Claude Sonnet** får de 15 högst rankade kandidaterna och justerar poängen
   med högst ±20, plus skriver motiveringen som visas på kortet.

Utan `ANTHROPIC_API_KEY`, eller om anropet fallerar, används enbart heuristiken.
Flödet bryts aldrig av att AI:n är otillgänglig.

Innan poängsättningen filtreras hårda krav bort helt: för få följare, fel
plattform, eller budget under influencerns lägstapris.

## BankID

`apps/api/src/services/bankid/` implementerar BankID:s REST-API v6 över ömsesidig
TLS, inklusive den animerade QR-koden (`bankid.<token>.<sekunder>.<hmac>`) som
roteras vid varje statusanrop.

Vid signering skickas avtalets SHA-256-summa som `userNonVisibleData`, så att
signaturen binds till exakt den text som visades. Signaturen sparas
tillsammans med OCSP-svaret och textens hash i tabellen `Signature`.

Personnummer lagras aldrig i klartext – bara en nyckelhållen HMAC för uppslag
och en maskerad variant (`19900101-****`) för visning.

I utvecklingsläge (`BANKID_MODE=mock`) körs en simulator med samma
tillståndsmaskin. `config.ts` vägrar starta med mock i produktion.

## Betalningar

Pengarna går aldrig direkt mellan parterna:

1. När båda signerat skapas en PaymentIntent på plattformens Stripe-konto.
2. Betalningen bekräftas via webhook och kontraktet får status `ESCROWED`.
3. När leveransen godkänts förs nettobeloppet över till influencerns Stripe
   Connect-konto (Express, manuella utbetalningar).

Plattformsavgiften är 12 % och avrundas alltid till plattformens nackdel så att
avgift plus utbetalning summerar exakt till bruttot. Alla belopp hanteras i ören
som heltal.

Utan `STRIPE_SECRET_KEY` används en simulator lokalt; i produktion krävs nyckeln.

## Kom igång

Kräver Node 22 och Docker.

```bash
npm install
npm run build -w @influencerlink/shared

cp apps/api/.env.example apps/api/.env
# Sätt JWT_SECRET, PERSONAL_NUMBER_HMAC_KEY (minst 32 tecken) och
# TOKEN_ENCRYPTION_KEY: openssl rand -base64 32

npm run db:up            # startar PostgreSQL
npm run db:migrate       # skapar schemat
npm run db:seed          # demodata: 6 influencers, 2 restauranger, 3 kampanjer

npm run dev:api          # http://localhost:3000
npm run dev:mobile       # Expo, öppna i Expo Go eller en simulator
```

Appen hittar API:et automatiskt via Metro-värden, så en fysisk telefon i samma
nät fungerar utan konfiguration. Vill du peka någon annanstans, ändra
`extra.apiUrl` i `apps/mobile/app.json`.

För att testa hela flödet utan BankID-certifikat: sätt `ENABLE_DEV_LOGIN=true`
och `BANKID_MODE=mock`. Simulatorn svarar `complete` på andra statusanropet.

## Verifiering

```bash
npm run typecheck   # alla tre paketen
npm test            # 88 enhetstester i apps/api
```

Testerna täcker avgiftsberäkning, matchningspoäng och behörighetsfilter,
avtalstextens determinism (viktigt: texten hashas och signeras), BankID:s
tillståndsmaskin och QR-rotation, AI-lagrets fallback när modellen är otillgänglig,
samt HTTP-lagrets roll- och valideringskontroller.

Mobilappen verifieras med `tsc --noEmit` och `npx expo export`. Notera att
`expo export` med Hermes-bytecode misslyckas i vissa Linux-miljöer på
React Natives egen källkod (privata klassfält i `DOMRectReadOnly`) – bundlingen
i sig går igenom, kör `--no-bytecode` för att verifiera lokalt.

## Vad som återstår före produktion

- **Riktiga OAuth-kopplingar** mot TikTok, Instagram och YouTube.
  `apps/api/src/services/social.ts` har gränssnittet och en demoleverantör som
  genererar stabil statistik; endpointerna som ska anropas står i koden.
- **Stripes betalningsvy i appen.** API:et returnerar `clientSecret`; appen
  behöver `@stripe/stripe-react-native` för att slutföra betalningen.
- **Automatiskt godkännande** när granskningstiden löpt ut – kräver ett schemalagt
  jobb som anropar utbetalningen.
- **Push-notiser** vid matchning, nytt meddelande och signeringsbegäran.
- **BankID-certifikat** för test- och produktionsmiljö.
