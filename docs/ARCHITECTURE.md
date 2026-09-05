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
