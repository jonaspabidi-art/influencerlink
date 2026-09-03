# Designbrief för Claude Design

Klistra in allt nedanför linjen som prompt. Den beskriver appen som den faktiskt
är byggd idag, så att designen går att implementera utan att koden måste vändas
upp och ner.

Uppdatera den när skärmar tillkommer.

---

Designa mobilappen **InfluencerLink** — en svensk marknadsplats där restauranger
och innehållskreatörer hittar varandra och ingår betalda samarbeten. iOS och
Android, React Native. All text på svenska.

## Vad appen gör

Två sorters användare möts i samma app:

**Restaurangen** skapar en kampanj ("kom och ät på vår bekostnad, gör en TikTok
om vår nya lunchmeny, du får 4 000 kr"), swipar bland kreatörer, skickar avtal,
betalar in arvodet till ett spärrat konto och godkänner leveransen.

**Influencern** kopplar TikTok, Instagram eller YouTube, swipar bland kampanjer
nära sig, signerar avtal och får pengarna utbetalda när restaurangen godkänt.

Båda parter swipar. När båda swipat höger uppstår en **matchning** med chatt.
Legitimering och avtalssignering sker med **BankID**. Pengarna hålls hos
plattformen tills jobbet är gjort — restaurangen betalar in när avtalet
signerats, influencern får sitt när leveransen godkänns. Plattformen tar 12 %.

Målgruppen är inte teknikvana: en restaurangägare mellan lunch och middag, och
en kreatör som gör det här vid sidan av jobbet. Tonen är rak och konkret,
aldrig "growth-hacky". Belopp i hela kronor, datum på svenska.

## Skärmar som finns idag

**Inloggning.** Rubrik, kort produktbeskrivning, två kort — "Jag är influencer"
och "Jag driver en restaurang" — vardera med en BankID-knapp. Därefter en
BankID-vy med QR-kod, statustext som byts under tiden ("Skriv in din
säkerhetskod i BankID-appen"), en knapp för att öppna BankID på samma enhet,
och avbryt.

**Onboarding, influencer.** Visningsnamn, stad, kort presentation, val av
nischer (13 st, t.ex. Restaurang, Kafé, Fine dining, Street food, Vegetariskt),
lägsta arvode och riktpris i kronor. Sedan koppling av sociala konton: välj
plattform, skriv användarnamn, se följarantal komma in.

**Onboarding, restaurang.** Namn, organisationsnummer, stad, adress,
beskrivning, kategori.

**Influencerns flikar: Upptäck, Matchningar, Avtal, Plånbok.**

*Upptäck* är en Tinder-liknande kortlek. Varje kort visar: restaurangens logotyp
och namn, stad och antal lediga platser, en matchningspoäng ("87 % match", med
en gnistikon när AI:n bedömt kortet), kampanjens rubrik, ersättningen ("4 000 kr
+ besök (300 kr)"), en motiveringsrad ("Finns på plats i Göteborg"), briefen,
vad som ska levereras som taggar, plattformsikoner och sista ansökningsdag.
Under kortleken två runda knappar: hoppa över och intresserad. Vid ömsesidigt
intresse visas en matchningsskärm.

*Matchningar* är en lista med motpartens namn, kampanjtitel, stad, belopp,
senaste meddelandet och matchningspoängen. Öppnar en detaljvy med chatt, och
för restaurangen en knapp för att skicka avtal.

*Avtal* är en lista med kampanjtitel, motpart, deadline, belopp och status:
Väntar på signaturer, En part har signerat, Pågår, Levererat – väntar på
godkännande, Klart och utbetalt, Avbrutet.

*Plånbok* visar två belopp — "På väg till dig" och "Utbetalt totalt" —
utbetalningskontots status, en förklaring av hur betalningen fungerar, och
kontouppgifter.

**Restaurangens flikar: Kampanjer, Matchningar, Avtal.**

*Kampanjer* listar egna kampanjer med rubrik, status, ersättning, antal fyllda
platser och genvägar till "Hantera" och "Hitta influencers".

*Nytt samarbete* är appens viktigaste skärm för restaurangen. Steg ett: ett
fritextfält — "beskriv vad du vill ha, som du skulle sagt det till en kollega".
AI:n gör om det till ett komplett kampanjutkast. Steg två: utkastet som ett
redigerbart formulär — rubrik, brief, kategorier, plattformar, leverabler,
ersättningstyp (bara arvode / bara besök / arvode + besök), belopp, antal
kreatörer, lägsta följarantal.

*Hitta influencers* är samma kortlek fast åt andra hållet. Kortet visar avatar,
namn, stad, matchningspoäng, tre nyckeltal i rutor (Följare, Snittvisningar,
Engagemang), motivering, presentation, nischtaggar, plattformar och riktpris.

**Avtalsvyn** (samma för båda parter) visar en ekonomitabell (Arvode,
Plattformsavgift, Till kreatören, Deadline, Leverans), vem som signerat och när,
den åtgärd som är aktuell just nu — signera med BankID, betala in arvodet,
rapportera leverans, eller godkänn och betala ut — och längst ned hela
avtalstexten.

## Nuvarande visuella språk

Mörkt och varmt, tänkt att mat och bilder ska få ta plats:

| Roll | Färg |
| --- | --- |
| Bakgrund | `#12100E` |
| Yta | `#1D1A17` |
| Upphöjd yta | `#272320` |
| Kantlinje | `#3A3430` |
| Text | `#F6F1EA` |
| Dämpad text | `#A79C90` |
| Primär (knappar, aktiv flik) | `#E8543F` |
| Accent (belopp, AI-markering) | `#F2B544` |
| Positiv (utbetalning, matchning) | `#4FA97B` |
| Fara | `#D9534F` |

Avstånd 4/8/16/24/32, hörnradier 8/14/24 och helrund för knappar. Systemtypsnitt.

Behåll gärna riktningen, men du får absolut ifrågasätta den. Om du tycker att en
ljus variant eller en annan primärfärg gör appen mer inbjudande — visa det.

## Det här är svagt idag och är uppdraget

1. **Korten är tomma i mitten.** När briefen är kort blir det ett stort hål
   mellan texten och sidfoten. Kortleken är appens ansikte och behöver en
   komposition som håller oavsett textlängd.
2. **Det finns inga bilder någonstans.** Inga bilder på maten, inga avatarer,
   inga logotyper — bara ikoner som platshållare. En matapp utan mat är fel.
   Föreslå var bilder hör hemma och hur korten ser ut både med och utan.
3. **Matchningsskärmen är en rubrik och två knappar.** Det är appens roligaste
   ögonblick och borde kännas som något.
4. **Onboarding är ett långt formulär att scrolla.** Kan det bli steg som känns
   snabba, eller något som inte ser ut som ett formulär alls?
5. **Tomma lägen är en ikon och en mening.** "Inga fler samarbeten just nu" är
   ett vanligt läge i en ny app med få kampanjer och borde inte kännas som ett fel.
6. **Kampanjguiden ser inte ut som det den är.** Att skriva två meningar och få
   tillbaka en färdig kampanj är produktens bästa idé, men skärmen är ett
   textfält och en knapp.
7. **Ingenting visar att pengarna är trygga.** Att arvodet ligger spärrat tills
   jobbet är godkänt är det som får båda parter att våga. Det syns knappt.

## Ramar

- Rita för 390 × 844 (iPhone 14/15). Räkna med säkra ytor upptill och nedtill.
- Byggs i React Native, så inga effekter som bara finns i webbläsare — ingen
  backdrop-filter, inga CSS-gradienter i text, inga hover-lägen.
- Bottenflikar: fyra för influencern, tre för restaurangen.
- Text på svenska, belopp som "4 000 kr", datum som "17 sep.".
- Tillgänglighet: minst 44 × 44 punkter träffyta, tydlig kontrast mot den mörka
  bakgrunden.

## Vad jag vill ha tillbaka

Börja med de skärmar som avgör om appen känns rätt:

1. Kortleken för influencern (Upptäck), inklusive hur kortet ser ut mitt i ett svep
2. Kortleken för restaurangen (Hitta influencers)
3. Matchningsskärmen
4. Nytt samarbete, båda stegen
5. Avtalsvyn i två lägen: väntar på signatur, och klart och utbetalt
6. Plånboken
7. Inloggning och BankID-vyn

Visa gärna ett kort komponentbibliotek också — knappar, taggar, statusmärken,
nyckeltalsrutor, tomma lägen — så att resten av appen kan byggas i samma språk.
