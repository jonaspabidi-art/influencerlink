# Handoff: Pacta — mobilapp (iOS/Android, React Native)

## Overview
Pacta är en svensk marknadsplats där restauranger och innehållskreatörer hittar
varandra och ingår betalda samarbeten. Båda parter swipar; vid ömsesidigt intresse uppstår
en matchning med chatt. Legitimering och avtalssignering sker med BankID. Arvodet betalas in
till ett spärrat konto (escrow) hos plattformen och betalas ut när restaurangen godkänt
leveransen. Plattformen tar 12 %.

Detta bunt täcker de skärmar som avgör produktkänslan: influencerns kortlek (Upptäck) inkl.
svepläge och tomt läge, restaurangens kortlek (Hitta influencers), matchningsskärmen,
kampanjguiden (Nytt samarbete, båda stegen), avtalsvyn i två lägen, plånboken, inloggning +
BankID, onboarding samt ett komponentbibliotek.

## About the Design Files
Filen i detta bunt är en **designreferens skriven i HTML** — en prototyp som visar avsett
utseende och beteende. Den är **inte produktionskod att kopiera**. Uppgiften är att
återskapa designen i appens riktiga miljö (React Native) med kodbasens etablerade mönster,
navigations- och komponentbibliotek. Finns ingen miljö än: välj lämplig stack och implementera
designen där.

Prototypen använder några rent webbaserade genvägar som **inte** ska följas i RN:
- CSS-variabler (\`var(--bg)\` osv.) för temaväxling → ersätt med ett theme-objekt/context.
- \`repeating-linear-gradient\` används **enbart** som randig bildplatshållare → ersätt med
  \`<Image>\` eller en tom yta i \`surface\`-färg.
- \`cursor:pointer\`, \`overflow:auto\` → \`Pressable\`, \`ScrollView\`.
- Statusfältet och telefonramen i prototypen är attrapper — använd riktig SafeArea.
Designen innehåller medvetet **inga** backdrop-filter, texgradienter eller hover-lägen.

## Fidelity
**High-fidelity.** Färger, typografi, avstånd, hörnradier och copy är slutgiltiga och ska
återskapas exakt. All copy är på svenska och ska användas verbatim. Belopp skrivs med
tusenmellanslag och "kr" ("4 000 kr"), datum kort svenskt format ("17 sep.").

## Design Tokens

### Färger — mörkt tema (standard)
| Token | Hex |
| --- | --- |
| bg (bakgrund) | #12100E |
| surface (yta) | #1D1A17 |
| raised (upphöjd yta) | #272320 |
| border (kantlinje) | #3A3430 |
| text | #F6F1EA |
| muted (dämpad text) | #A79C90 |
| dim (platshållartext) | #6E645A |
| photo (bildplatshållare, botten) | #241F1C |
| stripe (bildplatshållare, rand) | #2C2622 |
| primary | #E8543F |
| ink (text på primary) | #12100E |
| accent (belopp, AI-markering) | #F2B544 |
| positive (utbetalning, matchning) | #4FA97B |
| danger | #D9534F |
| tint (svag primärton) | #241C19 |

### Färger — ljust tema
| Token | Hex |
| --- | --- |
| bg | #F7F2EA |
| surface | #FFFFFF |
| raised | #F1EAE0 |
| border | #E1D7C9 |
| text | #1A1512 |
| muted | #75695C |
| dim | #A99C8C |
| photo | #EFE8DD |
| stripe | #E7DFD3 |
| primary | #E8543F |
| ink | #FFFFFF |
| accent | #9A6A00 |
| positive | #2E7D57 |
| danger | #C0392B |
| tint | #FBEFEA |

Ljust tema är en färdig variant i prototypen (växlas i vänsterspalten). Behåll båda och
följ systeminställningen, eller lås till mörkt om ni vill börja enklare.

### Alternativ primärfärg
Prototypen kan växla primary till **plommon #B0426B** (ink #FFFFFF i ljust tema, #1A0F14 i
mörkt). Korall #E8543F är förstahandsvalet; plommon finns som beslutsunderlag.

### Typografi
Instrument Sans (Google Fonts), vikter 400/500/600/700. Fallback: system.
Monospace (SFMono/Menlo) används **endast** för små versala etiketter och platshållartext.

| Roll | Storlek / vikt / övrigt |
| --- | --- |
| Skärmrubrik | 24 px / 700 / letter-spacing −0.01em |
| Stor rubrik (inloggning, matchning, onboarding) | 27–32 px / 700 / line-height 1.12–1.15 / −0.02em |
| Korttitel | 22 px / 700 / line-height 1.15 |
| Belopp, stort | 34–38 px / 700 / −0.02em, färg accent (eller positive vid utbetalt) |
| Belopp, i kort | 20–22 px / 700, accent |
| Radrubrik / listtitel | 15–17 px / 600–700 |
| Brödtext | 14–15 px / 400 / line-height 1.5 |
| Sekundär text | 13 px / 400, muted |
| Versal etikett | 10–11 px / 400–700 / letter-spacing 0.06–0.1em, muted |
| Knappetikett | 16 px / 700 (primär), 600 (sekundär) |
| Fliketikett | 11 px / 400, 600 när aktiv |

### Avstånd
4 / 8 / 12 / 14 / 16 / 20 / 24. Sidmarginal 16 (24 på inloggning och onboarding-variant A).
Kortpadding 14–18. Gap mellan kort i listor 10–12.

### Hörnradier
5 (taggar och statusmärken) · 6 (segmenterade val, nischchips) · 8 (knappar, nyckeltalsrutor,
ikonrutor) · 12 (kort och paneler) · 999 (endast avatarer, prickar och de två runda
svepknapparna). Telefonramen i prototypen (30) är bara attrapp.

### Träffytor
Alla tryckytor minst 44 × 44. Primärknappar 52 hög, sekundära 48–52.
Svepknappar: hoppa över 64 × 64, intresserad 76 × 76.

## Ikoner
Alla ikoner är enkla streckikoner, 24 × 24 viewBox, stroke 1.75 (2–2.5 för bock),
\`stroke-linecap/linejoin: round\`, färg = currentColor. Inga emoji någonstans.
Ersätt med motsvarande från kodbasens ikonbibliotek (t.ex. Lucide/Feather):
hänglås (escrow), fyrstrålig gnista (AI-markering), chevron vänster (tillbaka),
kryss (hoppa över), bock (intresserad, signerat, klart), reglage (filter),
kortstapel (Upptäck), chatbubbla (Matchningar), dokument (Avtal), plånbok (Plånbok),
rutnät (Kampanjer), penna (restaurangens Avtal).

## Skärmar

### 1. Inloggning
Syfte: välja roll och legitimera sig.
Layout, uppifrån: bildplatshållare (\`flex:1\`, min 120, radius 12, "BILD: BORD MED MAT") ·
rubrik 32/700 "Restauranger och kreatörer, ihop." · beskrivning 15/1.55 muted ·
två rollkort · fotnot.
Rollkort (surface, 1 px border, radius 12, padding 18): ikonruta 44 × 44 radius 8
(influencer: tint-bakgrund + primärfärgad kortstapel; restaurang: raised + rutnät),
titel 17/700, undertitel 13 muted, och en BankID-knapp 48 hög radius 8 — primär för
influencer, sekundär (outline) för restaurang.
Fotnot: hänglås + "Plattformsavgift 12 %. Inga avgifter innan avtal."
Båda korten leder till BankID-vyn.

### 2. BankID
Header: chevron tillbaka + "Legitimera dig".
Centrerat: QR-platshållare 220 × 220 (surface, border, radius 12) med 164 × 164 rutmönster ·
"Skriv in din säkerhetskod" 22/700 · förklaring 15/1.5 muted centrerad, max 280 ·
statuspill (raised, radius 6, padding 9/12) med accentprick + "Väntar på BankID …".
Statustexten byts under tiden (kö → "Skriv in din säkerhetskod i BankID-appen" → klar).
Nederst: primär "Öppna BankID på denna enhet" (leder in i appen) och sekundär "Avbryt".

### 3. Upptäck — kortlek (influencer)
Header: "Upptäck" 24/700 + "14 kampanjer i Göteborg" 13 muted, samt filterknapp 44 × 44 rund
outline till höger.
**Kortets komposition är det viktigaste i hela designen:** kortet är en kolumn där
bildytan har \`flex:1\` (min-height 168) och all text är intrinsisk. Kort brief ⇒ större bild,
aldrig ett hål i mitten. Bakom kortet ligger nästa kort synligt (inset 10 px i sidorna,
14 px ned, radius 12).
Kort (surface, border, radius 12, overflow hidden):
1. Bildyta: matchningspill uppe till höger (bg-färgad, 1 px accentkant, gnista + "87 % match"
   700 accent) och en fot i \`bg\`-färg med logotyp 48 × 48 radius 8, namn 17/700,
   "Göteborg · 2 lediga platser" 13 muted.
2. Kropp (padding 16, gap 12): titel 22/700 · ersättning "4 000 kr" 22/700 accent +
   "+ besök (300 kr)" 14 muted · motiveringsrad med 7 px positiv prick + "Finns på plats i
   Göteborg" 13 positive · brief 14/1.5 (text, 82 % opacitet) · leverabeltaggar.
3. Fot (1 px topborder, padding 12/16): plattformsrutor 28 × 28 radius 5 (aktiv full
   opacitet, inaktiv muted) och "Sista ansökan 17 sep." 13 muted.
Under kortleken: trygghetsrad (hänglås + "Arvodet spärras hos Pacta") och de två
svepknapparna (64 rund outline med kryss, 76 rund primary med bock).
Flikrad: Upptäck / Matchningar / Avtal / Plånbok.

### 4. Upptäck — mitt i svepet
Samma kort med \`transform: rotate(7deg) translate(52px, -8px)\` (vänstersvep: −7deg,
−52 px), 420 ms ease. Kortkanten byter till positive (höger) eller danger (vänster).
Stämpel: "INTRESSERAD" 22/800 positive i en 3 px positiv ram, radius 12, roterad −10deg,
uppe till vänster; "HOPPAR ÖVER" i danger, roterad +10deg, uppe till höger.
Motsvarande svepknapp fylls med positive. Efter 650 ms: högersvep → matchningsskärmen,
vänstersvep → nästa kort.

### 5. Upptäck — slut på kort (tomt läge)
Inget felutseende. Header-undertitel "Du har sett alla 14 kampanjer".
Kort 1: "Du är i kö på 3 kampanjer" 20/700, förklaring om att nya kampanjer läggs upp
löpande, och tre kölistrader (logotyp 40 × 40, namn 15/600, "Väntar på svar" 13 muted,
belopp 15/700 accent, \`white-space:nowrap\`).
Kort 2: "Få fler kort att svepa på" + primär "Utöka till 50 km" och sekundär
"Ändra mina nischer".

### 6. Matchningen — variant A "Kvitto på matchningen" (rekommenderad)
Full bildyta upptill (\`flex:1\`, min 200) med de två parternas bilder överlappande, 84 × 84,
runda, 4 px ram i bg-färg, förskjutna −14 px mot varandra och hängande 40 px ned över
bildkanten.
Under: "NI MATCHADE" 13/700 positive letter-spacing 0.08em · "Sävenäs Kök & Bar vill jobba
med dig" 30/700 centrerad · sammanfattningskort (kampanjtitel 16/600, "4 000 kr" 26/700
accent + besök, avdelare, hänglås + escrow-mening) · primär "Skriv till Sävenäs" ·
sekundär "Fortsätt svepa".

### 7. Matchningen — variant B "Nästa steg direkt"
Två runda bilder 64 × 64 överlappande · "NI MATCHADE" · "Nu är det tre steg kvar till
4 000 kr" 30/700 · numrerad tidslinje (32 px runda nummer, steg 1 primary/ink, resten
raised/muted, 2 px förbindelselinje i border): Chatta om detaljerna / Signera avtalet med
BankID / Leverera och få betalt, var och en med förklaring 14 muted ·
bildplatshållare (\`flex:1\`) · primär "Skriv till Sävenäs" · sekundär "Senare".

### 8. Hitta influencers (restaurangens kortlek)
Samma kortmekanik, andra innehåll. Header: chevron + "Hitta influencers" 20/700 +
"Ny lunchmeny · 2 av 3 platser kvar".
Kort: bildyta ("BILD: SENASTE INLÄGGET") med 91 %-matchningspill och fot med rund avatar
52 × 52, namn 18/700, "Göteborg · Street food, Kafé" · tre nyckeltalsrutor
(raised, radius 8, padding 12: FÖLJARE 42 300 / SNITTVISN. 18 900 / ENGAGEMANG 6,4 % i
positive, etiketter 10 px versala muted, värden 18/700) · AI-motivering (gnista + accent
13 px) · presentation 14/1.5 · nischtaggar · fot med plattformsrutor och
"Riktpris **3 500 kr**".
Trygghetsrad: "Du betalar först när avtalet är signerat".
Flikrad restaurang (tre flikar): Kampanjer / Matchningar / Avtal.

### 9. Nytt samarbete, steg 1 — variant A "Skriv fritt" (rekommenderad)
Header: chevron + "Nytt samarbete" + "1 / 2" mono. Under headern en tvådelad
stegindikator (3 px staplar, primary/border).
Rubrik "Beskriv vad du vill ha" 27/700 + "Som du skulle sagt det till en kollega. Vi gör om
det till en färdig kampanj som du får ändra i." 15 muted.
Fältet är en \`flex:1\` panel (surface, border, radius 12, padding 16) med texten 17/1.5 och
teckenräknare 12 muted nere till höger — det ska se ut som en anteckning, inte ett formulär.
Under: "ELLER BÖRJA HÄR" mono + tre outline-chips (Ny lunchmeny / Fredagsafterwork /
Vi öppnar nytt).
Primär knapp med gnistikon "Gör ett utkast" + "Tar några sekunder. Inget publiceras än."

### 10. Nytt samarbete, steg 1 — variant B "Guidade exempel"
Tre valbara exempelkort med kategorietikett (LUNCH / KVÄLL / NYÖPPNING), ett citat i
16/1.45 och en prisindikation 13 muted ("Ger oftast 3 500 – 4 500 kr, 1 video").
Valt kort har 1 px primärkant. Nederst sekundär "Skriv med egna ord i stället".

### 11. Nytt samarbete, steg 2 — utkastet
Stegindikator båda staplarna primary. Överst en AI-notis (tint-bakgrund, radius 8,
gnista i accent + "Ifyllt utifrån det du skrev. Ändra fritt.").
Redigerbara fält som kort med versal etikett + värde: RUBRIK (19/700), BRIEF (15/1.5),
LEVERABLER (taggar + streckad "+ lägg till"), ERSÄTTNING (segmenterat 3-val: Bara arvode /
Bara besök / **Arvode + besök** — valt fyllt i primary, 40 px höga, radius 6 — plus två
nyckeltalsrutor ARVODE 4 000 kr och BESÖK 300 kr), samt en rad-lista: Antal kreatörer 3,
Lägsta följarantal 5 000, Plattformar TikTok, Instagram.
Summering (raised, radius 12): "Arvode 4 000 kr × 3 → 12 000 kr", "Plattformsavgift 12 % →
1 440 kr", avdelare, "Du betalar in **13 440 kr**" (20/700 accent), och escrow-noten
"Först när avtalet är signerat. Beloppet ligger spärrat hos oss tills du godkänt leveransen."
Fast fot (1 px topborder): primär "Publicera och hitta influencers".

### 12. Avtalsvyn — läge "Väntar på signaturer"
Header: chevron + "Avtal" + statusmärke (1 px accentkant, accenttext).
Kampanjtitel 23/700 + motpart 14 muted.
Ekonomikort: Arvode 4 000 kr / Plattformsavgift 12 % −480 kr / avdelare / **Till kreatören
3 520 kr** (20/700 accent) / avdelare / Deadline 24 sep. / Leverans 1 video + 3 stories.
Signaturkort: rad med positiv bock + "Sävenäs Kök & Bar" / "Signerade 12 sep. 14:20", och
rad med tom 18 px ring + "Amanda Lindh" / "Väntar på signatur".
Åtgärdskort (1 px primärkant): "Din tur att signera" 17/700, förklaring, primär
"Signera med BankID". Åtgärden byts med status: signera → betala in arvodet → rapportera
leverans → godkänn och betala ut.
Trygghetsband (raised): hänglås + "Så hanteras pengarna" och tre steg som 3 px staplar
(klart = positive, kommande = border) med etiketter Avtal signeras / 4 000 kr spärras /
Utbetalning.
Nederst avtalstexten: versal etikett, 13/1.6 muted utdrag, "Läs hela avtalet" 14/600 primary.

### 13. Avtalsvyn — läge "Klart och utbetalt"
Statusmärke fyllt i positive med bock, text i bg-färg.
Utbetalningskort (1 px positiv kant): "Utbetalt till dig 26 sep." 13 muted,
"3 520 kr" 34/700 positive, "Till konto ●●●● 4471, Swedbank" 13 muted.
Ekonomikort som ovan plus Besök 300 kr, betalt på plats och Levererat 23 sep.
Tidslinje med fyra avklarade steg (positiv bock + 2 px linje): Båda signerade /
4 000 kr spärrades / Leverans godkänd (25 sep., av Sävenäs) / 3 520 kr utbetalt.
Två sekundära knappar: "Hämta kvitto (PDF)", "Läs hela avtalet".

### 14. Plånboken
"Plånbok" 24/700. Toppkort: "På väg till dig" 13 muted + "3 520 kr" 38/700 accent +
"1 avtal, spärrat tills leveransen godkänts" 13 muted, avdelare, "Utbetalt totalt"
15 muted / "11 200 kr" 20/700.
Kontostatuskort: positiv bock + "Utbetalningskontot är klart" / "Swedbank ●●●● 4471" +
"Ändra" 14/600 primary.
Förklaringskort (raised): hänglås + "Så får du dina pengar" och tre numrerade rader
(01/02/03 i mono muted): avtal signeras · restaurangen betalar in, spärrat · du levererar,
restaurangen godkänner, pengar inom 1–2 bankdagar.
"SENASTE": lista med motpart, "Utbetalt 2 sep." och belopp 15/700 nowrap.

### 15. Onboarding — variant A "Ett steg per fråga" (rekommenderad)
Chevron + femdelad framstegsindikator (3 px staplar) + "3 / 5" mono.
En fråga per skärm: "Vad filmar du helst?" 30/700 + "Välj minst två. Vi visar bara kampanjer
som passar." Nischchips 11/14 padding, radius 6 — vald = primary/ink 600, ovald = outline.
Nederst ett kort som motiverar valet: "Med Street food och Kafé i Göteborg" 15/600,
"9" 30/700 accent + "kampanjer att svepa på nu", "Arvodena ligger mellan 1 500 kr och
6 000 kr." Sedan primär "Fortsätt".
Övriga steg i samma mall: visningsnamn, stad, presentation, arvode/riktpris, koppla konton.

### 16. Onboarding — variant B "Kort som fylls i"
Ser inte ut som ett formulär: profilkortet visas överst så som restaurangerna ser det
(omslagsplatshållare 104 hög "LÄGG TILL EN BILD", rund avatar 48, namn, stad · nischer).
Under: en checklista av kort — klara poster har positiv bock, aktuell post har primärkant och
sin egen knapp ("Koppla TikTok" + "Vi hämtar följarantal och snittvisningar. Restaurangerna
ser bara siffrorna."), kommande poster har tom ring. Fast fot: "Klar för nu — börja svepa".

### 17. Komponentbibliotek
Referensskärm med: knappar (primär/sekundär/inaktiv 52 hög, samt runda svepknappar),
taggar (fylld, outline, vald, streckad "+ lägg till", matchningspill),
alla sex statusmärken (Väntar på signaturer, En part har signerat, Pågår, Levererat – väntar,
Klart och utbetalt, Avbrutet), nyckeltalsrutor, trygghetsbandet, tomt läge och de tre
bildplatserna (kampanjbild radius 12, logotyp radius 8, avatar rund).

## Interactions & Behavior
- **Svep:** dra kortet horisontellt; över tröskel visas stämpeln och kortkanten byter färg.
  Släpp → kortet flyger ut (420 ms ease), nytt kort centreras efter 650 ms. Knapparna gör
  samma sak. Högersvep på ömsesidigt intresse → matchningsskärmen.
- **Matchning:** kortet ska kännas som en händelse — bilderna kan skala in kort (~200 ms) och
  "NI MATCHADE" tona in. Inga konfettieffekter.
- **BankID:** statustexten roterar medan man väntar; "öppna på samma enhet" hoppar till
  BankID-appen. Avbryt tar tillbaka till inloggningen.
- **Kampanjguiden:** steg 1 → laddningsläge medan utkastet genereras (behåll rubriken, visa
  vad som skapas) → steg 2. Alla fält i steg 2 ska vara redigerbara innan publicering.
- **Avtal:** exakt en aktuell åtgärd åt gången, som ett eget kort med primärknapp.
- **Tomma lägen:** aldrig bara en ikon och en mening — säg vad som händer härnäst och ge en
  handling.
- Inga hover-lägen. Tryckrespons: opacitet ~0.85 eller lätt nedskalning.

## State Management
Prototypens tillstånd (motsvarande skärmar/lägen i appen):
- \`screen\`: login | bankid | discover | empty | match | find | wizard1 | wizard2 |
  contract | contractDone | wallet | onb | kit
- \`swipe\`: null | 'left' | 'right' (styr stämpel, kortets transform och kanten)
- \`theme\`: 'dark' | 'light' · \`primary\`: 'korall' | 'plommon'
- variantväljare för matchning, kampanjguidens steg 1 och onboarding (endast prototyp)

I den riktiga appen behövs dessutom: roll (influencer/restaurang), autentiseringsstatus,
kortlekens index och kö, matchningar med olästa meddelanden, avtalsstatus per avtal
(sex lägen), escrow-status per avtal, samt kopplade sociala konton med följarsiffror.
Datahämtning: kampanjer/kreatörer per stad och nisch, matchningspoäng från backend,
avtalstext, saldon till plånboken.

## Assets
Prototypen innehåller **inga** bilder. Alla bildytor är randiga platshållare med
monospace-etikett (BILD: LUNCHRÄTT, LOGO, FOTO, BILD: SENASTE INLÄGGET, LÄGG TILL EN BILD).
Riktigt material behövs på fem ställen:
1. Kampanjbild (restaurangens matbild) — kortlekens bildyta, 16:10 eller friare, radius 12.
2. Restaurangens logotyp — 48 × 48, radius 8.
3. Kreatörens avatar — 52 × 52 rund.
4. Kreatörens senaste inlägg — bildytan i restaurangens kortlek.
5. Profilomslag i onboarding — 104 hög.
Saknas bild ska ytan bli en tom \`photo\`-färgad yta (ingen ikon, ingen text) — kortet håller
ändå eftersom bildytan är den som flexar.
Ikoner: streckikoner enligt avsnittet Ikoner. Typsnitt: Instrument Sans.

## Files
- \`Pacta.dc.html\` — hela prototypen, alla 17 lägen. Öppna i webbläsare;
  vänsterspalten växlar skärm, tema och primärfärg, och A/B-växlaren ovanför telefonen
  växlar variant på matchningen, kampanjguidens steg 1 och onboarding.
- \`support.js\` — runtime som prototypen behöver för att köra. Ingen designinformation.
