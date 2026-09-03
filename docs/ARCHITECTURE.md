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
- **`Contract`** → `Signature`, `Delivery`, `Payment`.

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
