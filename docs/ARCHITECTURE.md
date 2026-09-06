# Arkitektur

## Överblick

```
Expo-app (iOS/Android)
      │  HTTPS + JWT
      ▼
Fastify-API ──► PostgreSQL (Prisma)
      ├──► BankID v6 (mTLS)        legitimering och signering
      ├──► Stripe                  escrow och Connect-utbetalningar
      └──► Claude Sonnet           rangordning och kampanjutkast
```

`packages/shared` byggs till JavaScript och konsumeras av båda sidorna, så att
enums, zod-scheman och matchningspoängen är definierade på ett enda ställe.

## Datamodell

Kärnan är `Campaign` × `InfluencerProfile`. Runt det paret hänger:

- **`Swipe`** – en rad per part (`actor`), unik på
  `(campaignId, influencerId, actor)`. En omsvept swipe skriver över riktningen.
- **`Match`** – skapas när båda parters swipe är `LIKE`. Unik på
  `(campaignId, influencerId)`, vilket gör att två samtidiga högersvep inte kan
  ge två matchningar.
- **`Application`** – influencerns pitch. Räknas som ett högersvep.
- **`Contract`** → `Signature`, `Delivery`, `Payment`, `Review`.
- **`ShowcaseItem`** – ett inlägg kreatören valt att visa upp, unik på
  `(influencerId, url)`.
- **`Review`** – ett omdöme per part och avtal, unik på
  `(contractId, authorRole)`. Både `influencerId` och `businessId` sparas på
  raden så att betyg kan summeras utan att gå via avtalet och kampanjen.

`AuditEvent` loggar allt med juridisk eller ekonomisk innebörd, och
`ProcessedWebhook` gör Stripes omsändningar idempotenta.

## Kontraktets tillstånd

```
SENT ──signatur──► PARTIALLY_SIGNED ──båda signerat──► ACTIVE
                                                        │
                                    influencern rapporterar leverans
                                                        ▼
                                                    DELIVERED
                                                        │
                                       restaurangen godkänner (eller
                                       granskningstiden löper ut)
                                                        ▼
                                                    COMPLETED
```

`CANCELLED` kan nås från alla lägen utom `COMPLETED`, och återbetalar eventuell
escrow till restaurangen.

Avtalstexten fryses när kontraktet skapas. `renderContractTerms` är avsiktligt
deterministisk – samma indata ger byte för byte samma text – eftersom det är
den strängen som hashas och signeras med BankID.

## Omdömen

Ett omdöme får bara skrivas av en part i ett avtal som nått `COMPLETED`, och
bara en gång. Reglerna ligger i `packages/shared/src/reviews.ts` och används av
både API och demobackend.

Publiceringen är dubbelblind och avgörs av två fält:

- `publishedAt` sätts på båda raderna i samma stund som den andra parten
  skriver sitt.
- `visibleAt` är avtalets `completedAt` plus fjorton dagar, och släpper fram ett
  ensamt omdöme när motparten aldrig svarade.

Ett omdöme räknas som publicerat om något av dem slagit in. Villkoret finns på
ett enda ställe – `publishedWhere` i `apps/api/src/services/reviews.ts` – så att
ingen fråga råkar läcka ett blint omdöme. Samma fjortondagarsfönster är sista
dag att skriva, vilket hindrar att någon väntar ut publiceringen och svarar på
ett omdöme de redan läst.

Medelbetyg hämtas med `ratingsFor`, som summerar en hel kortlek i en fråga i
stället för en per kort.

## Navigering

Båda rollerna har en profilflik längst till höger. Överst står det motparten
ser – namn, ort, betyg, och för kreatörer räckvidden – och därunder ligger allt
som går att ändra: profilen, de sociala kontona, omdömena och utloggningen.

Restaurangen landar på **Upptäck** – kreatörerna i den egna staden – och inte i
kampanjguiden. Tidigare tvingades ett nytt företagskonto skriva ihop en kampanj
och kastades sedan rakt in i en kortlek, alltså binda sig innan det sett om det
ens fanns någon att samarbeta med. `GET /influencers` finns för det: utbudet
utan kampanj. En publicerad kampanj landar på kampanjen, där "Hitta influencers"
är ett val och inte nästa tvingande steg.

Båda parter har en publik profil: `app/creator/[id].tsx` och `app/venue/[id].tsx`.
Kreatören visar räckvidd, betyg och sina klipp; restaurangen visar lokalen,
betyget och vad den söker just nu. Symmetrin är avsiktlig – båda ska kunna
avgöra om motparten är värd en dag av deras tid.

Från kreatörsprofilen kan restaurangen bjuda in till en av sina publicerade
kampanjer. Det är ett högersvep, samma slutpunkt som kortleken använder, fast
från profilen. Utan det var kreatörslistan en katalog man inte kunde handla ur.

Profilfliken listar aldrig något som redan är en flik. Utbetalningar och avtal
nås från sina egna flikar, inte från två håll.

`MenuRow` i `apps/mobile/src/components/ui.tsx` är raden de består av. Hela
raden är tryckyta, och pilen visas bara när raden leder vidare – en handling som
loggar ut får ingen.

Redigeringen ligger i `app/profile/edit.tsx` och `app/profile/business.tsx`.
Onboardingguiden körs en gång; formulären är samma fält utan stegen, så att pris
och bio går att ändra i efterhand. Företaget läser sin egen profil via
`GET /me/business-profile`, som till skillnad från `GET /businesses/:id` även
innehåller organisationsnummer och adress.

## Sociala konton

Följarantal och visningar hämtas från plattformen efter att kreatören loggat in
där. Det finns ingen väg dit från ett användarnamn – siffrorna tillhör
kreatören, och TikTok lämnar bara ut dem till den som fått tillstånd.

`SocialAccount.statsSource` säger varifrån siffrorna kommer: `PLATFORM` när de
är hämtade, `DEMO` när de är genererade ur användarnamnet i väntan på att
integrationen godkänns. Skillnaden syns i appen, eftersom en restaurang som
betalar utifrån räckvidd måste kunna se vilket det är.

TikTok-klienten ligger i `services/social/tiktok.ts` och beskrivs i
[TIKTOK.md](TIKTOK.md). State för omdirigeringen signeras med egen HMAC i
`lib/oauthstate.ts` och inte med sessionstokenen: ett state som gick att
verifiera som en session vore en inloggning på vift.

## Budget och arvode

Kampanjens `budgetPerCreator` är en riktpunkt, inte ett pris. Arvodet avtalas
med varje kreatör för sig, och en kampanj med flera platser kan mycket väl
landa på olika belopp för olika personer.

Två följder i koden. `checkEligibility` stänger inte längre ute den som normalt
tar mer än budgeten – först vid `BUDGET_TOLERANCE` över den, eftersom en
förhandling sällan rymmer mer. Den som ligger strax över får låg poäng i stället
för noll, och hamnar längre ned i listan i stället för att försvinna.

Och sökte kreatören med ett eget pris följer det med matchningen hela vägen till
avtalet, som förifylls med hennes bud. Tidigare syntes budet i ansökningslistan
och tappades så fort matchningen uppstod – avtalet föreslog kampanjens budget
som om hon aldrig sagt något.

## Rådgivaren

Företagaren har sällan gjort det här förut. `POST /assistant/ask` samlar ihop
verksamheten, den valda kampanjen och kreatörerna i rätt stad, och låter Sonnet
resonera om det.

Modellen söker aldrig själv. Kandidaterna följer med i frågan, med de siffror vi
faktiskt har, och prompten förbjuder den att nämna någon som inte står i
underlaget. Ett påhittat användarnamn eller en påhittad räckvidd vore värre än
inget svar, eftersom företaget betalar utifrån det. Underlaget säger också om en
kreatörs siffror är hämtade från plattformen eller uppgivna av henne själv, så
att ett råd som vilar på ogranskade tal kan säga det.

Plattformens egna regler – tolv procent, spärrade pengar, BankID, godkännande
före publicering, fjorton dagars omdömesfönster – står i systemprompten, så att
svaren om hur det går till stämmer med vad koden gör.

Utan `ANTHROPIC_API_KEY` svarar slutpunkten `available: false` och appen säger
det rakt ut i stället för att låtsas.

## Resultat

Efter leverans visar avtalet vad samarbetet gav: visningar, engagemang och
arvodet per tusen visningar. Det sista är måttet restaurangen kan jämföra med
vad annonsplatsen bredvid kostar, och det enda som avgör om den bokar igen.

Siffrorna finns bara hos plattformen, och plattformen lämnar bara ut dem till
kreatören själv – de hämtas därför med hennes token. Restaurangen ser
resultatet utan att någonsin komma åt kontot.

Mätningen sker när någon tittar, inte enligt schema: en kampanj ingen bryr sig
om behöver inte mätas, och det finns inget jobb att glömma bort. Högst en gång
i timmen per avtal, och efter trettio dagar fryses siffran. Reglerna ligger i
`packages/shared/src/results.ts`; hämtningen i `services/results.ts` sväljer
alla fel, eftersom en mätning aldrig får fälla avtalsvyn.

## Videoutkast

Kreatören lämnar filmen för godkännande innan den publiceras. Restaurangen ser
vad som ska ut, och får samtidigt filen – det är den nyttjanderätten i avtalets
§5 vilar på. Utan filen är rätten att återanvända materialet bara en mening.

`Draft` har en version per inlämning. En begärd ändring stänger den versionen
och kreatören laddar upp nästa; ett godkänt utkast byts aldrig ut i tysthet.
Tystnad räknas som ja efter granskningsfönstret, samma antal dagar som gäller
för leveransen, så att ett upptaget kök aldrig blockerar kreatören.
`isDraftCleared` i `packages/shared/src/drafts.ts` är regeln, och
`POST /contracts/:id/delivery` vägrar utan ett klart utkast.

Filmer ligger i Supabase Storage, inte i databasen som bilderna: en halv minut
i 1080p är tiotals megabyte. Filen passerar aldrig vår server – appen får en
signerad adress och laddar upp direkt, och uppspelning sker mot en signerad
adress som slutar gälla efter en timme. Sökvägen börjar med avtalets id och
kontrolleras vid inlämning, så ingen kan peka på någon annans uppladdning.

Utan `SUPABASE_URL` och `SUPABASE_SERVICE_ROLE_KEY` är uppladdningen avstängd,
och då hoppas kravet på utkast över i leveransen – annars hade avtal fastnat i
en miljö där steget inte går att utföra.

## Bilder

Profilbilder, logotyper och kampanjbilder laddas upp med `POST /media` och
hämtas med `GET /media/:id`. Bilderna ligger i databasen som `MediaAsset`, inte
hos en filtjänst: det håller uppsättningen till Railway och Supabase, utan
bucket och utan fler nycklar. Vid några hundra kilobyte per bild är det
oproblematiskt länge, och byts det mot objektlagring är `routes/media.ts` det
enda som ändras – adressen som sparas pekar vart som helst.

Adressen sparas relativt (`/media/<id>`). En absolut adress hade slutat fungera
så fort API-domänen bytte, och appen kör mot olika adresser i utveckling, demo
och drift. `resolveMediaUrl` i appen sätter på rätt värd innan bilden ritas.

Appen skalar ned bilden till 1280 px och komprimerar den innan den skickas, så
varken uppkopplingen eller databasen får ta emot en obehandlad kamerabild.
Servern tar bara emot JPEG, PNG och WebP – aldrig SVG, som kan innehålla
skript. `GET /media/:id` kräver ingen inloggning: bilderna visas på kort som
motparten ser, och adressen innehåller ett cuid som inte går att gissa.

Utan bild ritar `Photo`, `Avatar` och `Logo` en ton som är densamma varje gång
för samma namn, och de två små ytorna dessutom namnets initialer. En grå tom
yta får ett kort att se ofärdigt ut; en färgad ser gjord ut.

## Uppvisat innehåll

Tills OAuth mot TikTok och Meta är godkänd klistrar kreatören in länkar själv.
`recogniseLink` i `packages/shared/src/links.ts` läser adressen – delningslänk,
kortlänk eller vanlig – och ger plattform, ren adress och inläggs-id. Adressen
sparas utan spårningsparametrar, så samma inlägg inte kan läggas till två
gånger under olika adresser.

Miniatyren hämtas av `OembedProvider` i `apps/api/src/services/oembed.ts`.
TikTok och YouTube svarar utan nyckel; Instagram stängde sin öppna slutpunkt
2020 och kräver apptoken, så därifrån sparas bara länken. Uppslaget får aldrig
fälla sparandet: ett borttaget inlägg, en timeout eller ett nätverksfel ger ett
tomt svar och länken sparas ändå utan bild.

Kreatörskortet i kortleken visar det första uppvisade inlägget som bildyta och
faller tillbaka på profilbilden när inget finns.

Med TikTok kopplat behöver kreatören inte klistra in något: `GET
/me/influencer-profile/tiktok/videos` listar hennes senaste videor med miniatyr,
och `PUT /me/influencer-profile/showcase/tiktok` sparar de hon valt. Listan
ersätter den tidigare – det hon ser i rutnätet är det som ligger på profilen
efteråt. Ordningen hon valde i är ordningen de visas i.

Åtkomsttokenen gäller ett dygn och förnyas vid anropet när den gått ut, inte av
ett schemalagt jobb. Det finns då inget att glömma att sätta upp, och kreatören
märker ingenting.

`app/creator/[id].tsx` är profilen en restaurang ser: räckvidd, betyg, pris och
ett rutnät av innehållet. Den nås från en ansökan, från matchningen, och från
kreatörens egen profilflik så att hon kan se vad motparten ser.

## Betalflödet

```
Restaurang                Plattform (Stripe)              Influencer
    │                            │                            │
    │  PaymentIntent (brutto)    │                            │
    ├───────────────────────────►│  status: ESCROWED          │
    │                            │                            │
    │        leverans godkänd    │   Transfer (netto)         │
    │───────────────────────────►├───────────────────────────►│
    │                            │  status: RELEASED          │
```

Idempotensnycklar (`escrow_<contractId>`, `payout_<contractId>`) gör att en
dubbelklick eller en omsänd webhook aldrig kan ge dubbla betalningar.

## Säkerhet

- Personnummer: HMAC-SHA256 med serverhållen nyckel för uppslag, aldrig klartext.
- OAuth-tokens för sociala konton: AES-256-GCM, lämnar aldrig servern.
- Sessioner: JWT med 12 timmars livslängd. Profil-id ligger i nyttolasten och
  förnyas när profilen skapas.
- Loggning: `authorization`, `stripe-signature`, `personalNumber` och
  `authorizationCode` maskas bort innan något skrivs.
- Simulatorerna för BankID och Stripe blockeras av konfigurationen i produktion.
