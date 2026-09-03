# Sätta upp appen så att du kan testa den

Tre steg som kan göras var för sig. Steg 1 räcker för att titta på appen i
mobilen redan idag.

---

## 1. Demoläge: appen utan backend

Appen har en inbyggd demobackend. Utan `EXPO_PUBLIC_API_URL` kör den mot den
i stället för mot ett riktigt API, och hela flödet fungerar: BankID legitimerar
direkt utan att någon skannar något, avtal signeras och betalningar bokförs
utan att pengar rör sig. En banner i appen påminner om det, med en knapp för
att nollställa demon.

```bash
npm install
npm run build -w @influencerlink/shared
npm run export:web -w @influencerlink/mobile     # bygger till apps/mobile/dist
```

Lägg upp `apps/mobile/dist` var som helst som serverar statiska filer –
Netlify, Vercel eller Cloudflare Pages, alla gratis. Med Netlify CLI:

```bash
npx netlify-cli deploy --dir apps/mobile/dist --prod
```

Öppna adressen i mobilen. Vill du ha den som en app-ikon: Dela → Lägg till på
hemskärmen.

Demoläget sparas i webbläsarens localStorage, så svep och avtal finns kvar när
du laddar om. "Återställ" i bannern tar dig tillbaka till utgångsläget.

Vill du hellre köra i Expo Go under utveckling: `npm run dev:mobile`.

---

## 2. Riktig databas: Supabase

Supabase ger en PostgreSQL-databas gratis. Den ersätter `docker compose up db`
lokalt och är också det databasen körs på i drift.

1. Skapa ett projekt på supabase.com. Välj region i Europa (Frankfurt eller
   Stockholm) – databasen innehåller personuppgifter.
2. Under **Project Settings → Database → Connection string** finns två adresser
   du behöver:
   - **Transaction pooler** (port 6543) → `DATABASE_URL`.
     Lägg till `?pgbouncer=true&connection_limit=1` sist.
   - **Direct connection** (port 5432) → `DIRECT_URL`.
     Migrationer kan inte gå genom poolern, därför behövs båda.
3. Kör migrationerna och lägg in demodata:

```bash
cd apps/api
DATABASE_URL="..." DIRECT_URL="..." npx prisma migrate deploy
DATABASE_URL="..." DIRECT_URL="..." PERSONAL_NUMBER_HMAC_KEY="..." npm run db:seed
```

Har du inga migrationer ännu (första gången) kör `npx prisma migrate dev --name init`
mot en lokal databas först, och checka in filerna under `apps/api/prisma/migrations`.

Att veta om Supabases gratisnivå: projektet pausas efter en veckas inaktivitet
och måste väckas manuellt i deras gränssnitt. För en app som testas då och då
är det oftast lagom; blir det irriterande kostar Pro cirka 25 USD i månaden.

---

## 3. Hostat API

Supabase kör bara databasen. Fastify-servern behöver en egen plats. Repot har
en `Dockerfile` som bygger hela API:et och kör migrationerna vid varje start.

**Render** (`render.yaml` finns i repot) har en gratisnivå. Koppla repot som
Blueprint och fyll i hemligheterna i deras gränssnitt. Gratisinstansen somnar
efter ~15 minuters inaktivitet och tar ungefär en minut att vakna, vilket märks
när man testar. Betalnivån ligger runt 7 USD i månaden.

**Railway** (`railway.json` finns i repot) somnar inte, men har ingen gratisnivå
längre – räkna med cirka 5 USD i månaden. Skillnaden mot Render är i praktiken
bara den: alltid igång eller inte.

Miljövariabler API:et behöver:

| Variabel | Värde |
| --- | --- |
| `DATABASE_URL` | Supabase transaction pooler |
| `DIRECT_URL` | Supabase direct connection |
| `JWT_SECRET` | Slumpad sträng, minst 32 tecken |
| `PERSONAL_NUMBER_HMAC_KEY` | Slumpad sträng, minst 32 tecken |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `CORS_ORIGINS` | Adressen där webbappen ligger |
| `ANTHROPIC_API_KEY` | Valfri. Utan den används bara heuristiken |
| `BANKID_MODE` | `mock` tills certifikaten finns |
| `ALLOW_MOCK_INTEGRATIONS` | `true` så länge BankID eller Stripe är simulerade |

`PERSONAL_NUMBER_HMAC_KEY` får inte ändras efter att användare skapats – den
är nyckeln som personnummer slås upp med, och byts den känner API:et inte igen
någon som redan loggat in.

Peka sedan webbappen på API:et vid bygget:

```bash
EXPO_PUBLIC_API_URL=https://ditt-api.onrender.com npm run export:web -w @influencerlink/mobile
```

`/health` svarar med vilka integrationer som körs simulerat, så det går att se
utifrån att en miljö inte är skarp.

---

## Ordning jag skulle ta det i

1. Lägg upp demoläget och klicka igenom appen i mobilen. Det kostar inget och
   kräver inga konton.
2. Ändra det som känns fel i flödet medan allt fortfarande är fejkat.
3. Först när flödet sitter: Supabase och ett hostat API, fortfarande med
   simulerad BankID och Stripe.
4. Sist BankID-certifikat och Stripe-konto, som båda kräver ansökningar och
   väntetid.
