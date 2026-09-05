# TikTok-integrationen

Koden är klar och ligger avstängd. Den slås på genom att tre miljövariabler
sätts i Railway, vilket går först när TikTok godkänt appen. Fram till dess
kopplas TikTok med användarnamn som förut, och siffrorna märks som ogranskade
i appen.

## Varför den här omvägen behövs

Det finns ingen öppen väg att slå upp följarantal eller visningar på ett
TikTok-konto utifrån ett användarnamn, och det ska det inte finnas. Siffrorna
tillhör kreatören. Hon loggar in hos TikTok, ger appen tillstånd, och först då
lämnar TikTok ut dem.

Det betyder också att en språkmodell inte kan hämta dem. Claude har ingen
uppkoppling när vi anropar den – frågar man den om ett följarantal svarar den
med ett tal som ser rimligt ut och är påhittat.

## Vad vi hämtar

| Fält | Källa | Behörighet |
| --- | --- | --- |
| Följarantal | `/v2/user/info/` | `user.info.stats` |
| Användarnamn, verifierat konto | `/v2/user/info/` | `user.info.profile` |
| Visningar, likes, kommentarer, delningar per video | `/v2/video/list/` | `video.list` |

Snittvisningarna räknas på de sex senaste videorna. Engagemanget räknas som
andelen interaktioner av visningar, inte av följare – det är det måttet som
säger något om hur innehållet faktiskt tas emot, och det som inte går att lyfta
genom att köpa följare.

Vi ber aldrig om behörighet att publicera. Det står också i texten kreatören
läser innan hon trycker på knappen.

## Ansökan hos TikTok

Registrera appen på <https://developers.tiktok.com/>, under Manage apps.

**Products**: lägg till *Login Kit* och *Display API*.

**Scopes**: `user.info.basic`, `user.info.profile`, `user.info.stats`,
`video.list`. Varje scope godkänns för sig. Saknas ett kommer svaret tillbaka
utan de fälten, utan att något annat går fel – därför tål koden att videolistan
uteblir och sätter då snittet till noll.

**Redirect URI**: exakt den adress som sedan sätts som `TIKTOK_REDIRECT_URI`,
tecken för tecken. Med webbappen på Netlify är det

```
https://<din-netlify-adress>/auth/tiktok/callback
```

Adressen måste vara https. Byter du domän måste den ändras på båda ställena
samtidigt, annars nekar TikTok inloggningen.

**Det som brukar fälla en ansökan**

- En publicerad integritetspolicy och användarvillkor på egna adresser. De
  måste gå att öppna utan inloggning och nämna vilka uppgifter ni hämtar från
  TikTok och varför.
- En demonstration av flödet: TikTok vill se var inloggningen startar, vad
  kreatören ser innan hon godkänner, och vad siffrorna används till. En kort
  skärminspelning av Sociala konton räcker.
- Att appen inte ber om mer än den behöver. Fyra scopes med tydlig
  användning är lättare att få igenom än en bred ansökan.

Räkna med veckor, och med minst en runda kompletteringar.

## Miljövariabler i Railway

```
TIKTOK_CLIENT_KEY=<Client key från utvecklarportalen>
TIKTOK_CLIENT_SECRET=<Client secret>
TIKTOK_REDIRECT_URI=https://<din-netlify-adress>/auth/tiktok/callback
```

Utan `TIKTOK_CLIENT_KEY` och `TIKTOK_CLIENT_SECRET` är inloggningen avstängd
och slutpunkten svarar med en förklaring i stället för att fela. Det är med
flit: appen ska fungera hela vägen fram till godkännandet.

## Så går kopplingen till

1. Appen ber servern om en adress. Klientnyckeln ligger bara på servern.
2. Servern signerar ett `state` som innehåller vem som startade och PKCE-
   verifieraren. Det lever i tio minuter och lagras inte – en påbörjad
   inloggning som ingen slutför lämnar inget efter sig.
3. Kreatören loggar in hos TikTok och skickas till `/auth/tiktok/callback`.
4. Appen skickar koden och statet till servern, som kontrollerar att det är
   samma konto som startade, växlar in koden och hämtar siffrorna.
5. Tokens sparas krypterade och lämnar aldrig servern. Kontot märks
   `statsSource: PLATFORM`, och appen visar då snittvisningarna och att de
   kommer från TikTok.

## Vad som återstår

- **Förnyelse.** `refreshTokens` finns i klienten men anropas inte av något
  schemalagt jobb än. Åtkomsttoken gäller ett dygn, förnyelsetoken ett år, så
  siffrorna behöver uppdateras regelbundet för att inte bli inaktuella.
- **Instagram och YouTube.** Samma mönster, men Meta och Google har egna
  ansökningar. Deras siffror är genererade tills dess.
- **Ingen skarp körning har gjorts.** Utvecklingsmiljön når inte TikTok, så
  koden är byggd mot deras dokumenterade svar och testad mot mockade sådana.
  Första riktiga inloggningen sker när nycklarna är på plats i Railway.
