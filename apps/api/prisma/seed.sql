-- Demodata för Pacta.
-- Klistra in i Supabase SQL Editor EFTER att Railway skapat tabellerna.
-- 6 influencers, 2 restauranger, 4 kampanjer, en färdig matchning och ett
-- avslutat samarbete med omdömen från båda parter.

INSERT INTO public."User" VALUES ('cmtnc1h0l00007drmef4r8uxa', 'INFLUENCER', 'e1f4bb327cafad910b748c9cf12ebd64aa1b1acd9cc9eb0145ec8d6e5f9a2d8a', '19920315-****', 'Anna Karlsson', NULL, NULL, '2026-09-04 19:14:04.003', true, '2026-09-04 19:14:04.005', '2026-09-04 19:14:04.005');
INSERT INTO public."User" VALUES ('cmtnc1h0s00047drmnw69zsq9', 'INFLUENCER', '835522d930a799e560a309e69664fbea2d0486f99395b786e64f580d04e018da', '19880722-****', 'Erik Lindberg', NULL, NULL, '2026-09-04 19:14:04.012', true, '2026-09-04 19:14:04.013', '2026-09-04 19:14:04.013');
INSERT INTO public."User" VALUES ('cmtnc1h0w00087drm18ehvtya', 'INFLUENCER', '58b5b012f8abc5b04cbeb098a81565318356249c55f2769fb22ecb5bde318d3b', '19991102-****', 'Sara Nyström', NULL, NULL, '2026-09-04 19:14:04.015', true, '2026-09-04 19:14:04.016', '2026-09-04 19:14:04.016');
INSERT INTO public."User" VALUES ('cmtnc1h0z000b7drmn1fy6ykp', 'INFLUENCER', '8b9905452bd869960bbdce102661f604b644d69b7aee456880b491e74b065aed', '19950530-****', 'Johan Bergqvist', NULL, NULL, '2026-09-04 19:14:04.019', true, '2026-09-04 19:14:04.02', '2026-09-04 19:14:04.02');
INSERT INTO public."User" VALUES ('cmtnc1h12000f7drmgfrl8qx3', 'INFLUENCER', '1140743a28b2460a95aa169ab4e46baf0d8a6532af2398578cea6e23530b7975', '19940117-****', 'Maja Öberg', NULL, NULL, '2026-09-04 19:14:04.022', true, '2026-09-04 19:14:04.023', '2026-09-04 19:14:04.023');
INSERT INTO public."User" VALUES ('cmtnc1h15000i7drmk8erycri', 'INFLUENCER', '6c6c36e462b1609aa7d507dfad899a619b1e950e22f35ae7bb4d46e9f1f1160e', '20010228-****', 'Oskar Holm', NULL, NULL, '2026-09-04 19:14:04.025', true, '2026-09-04 19:14:04.026', '2026-09-04 19:14:04.026');
INSERT INTO public."User" VALUES ('cmtnc1h18000l7drmaygd0wjw', 'BUSINESS', '9431d29729752576901b65e282f703b9c7487f864907c91883e2dda4af28a3f9', '19700101-****', 'Petra Sandell', NULL, NULL, '2026-09-04 19:14:04.028', true, '2026-09-04 19:14:04.029', '2026-09-04 19:14:04.029');
INSERT INTO public."User" VALUES ('cmtnc1h1b000n7drmbnles470', 'BUSINESS', 'c2e8cdd51c1076cac950300a2acc1a5df2c1a2034142e447252675157a06b1ce', '19801212-****', 'Ali Rahimi', NULL, NULL, '2026-09-04 19:14:04.031', true, '2026-09-04 19:14:04.032', '2026-09-04 19:14:04.032');


--
-- Data for Name: BusinessProfile; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."BusinessProfile" VALUES ('cmtnc1h18000m7drm8vy9nwoe', 'cmtnc1h18000l7drmaygd0wjw', 'Restaurang Kajutan', '5560123456', 'Göteborg', 'Kungsportsavenyen 12, 411 36 Göteborg', 'Västkustkök med råvaror från Fiskhamnen. 60 sittplatser.', NULL, '{RESTAURANG,FINE_DINING}', NULL, '2026-09-04 19:14:04.029', '2026-09-04 19:14:04.029');
INSERT INTO public."BusinessProfile" VALUES ('cmtnc1h1b000o7drmtfw3df98', 'cmtnc1h1b000n7drmbnles470', 'Bageri Solrosen', '5569876543', 'Göteborg', 'Andra Långgatan 4, 413 03 Göteborg', 'Surdegsbageri och kafé i Linné. Öppnar 07 varje dag.', NULL, '{BAGERI,CAFE}', NULL, '2026-09-04 19:14:04.032', '2026-09-04 19:14:04.032');


--
-- Data for Name: Campaign; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Campaign" VALUES ('cmtnc1h1e000q7drmk72tm4sx', 'cmtnc1h18000m7drm8vy9nwoe', 'Lansera vår nya lunchmeny', 'Vi byter till en ny lunchmeny med råvaror från Fiskhamnen. Du kommer förbi en vardag mellan 11 och 14, äter på vår bekostnad och gör innehåll som visar rätterna och stämningen i lokalen. Ta gärna med att lunchen kostar 145 kr inklusive kaffe.', '{RESTAURANG,MAT_OCH_DRYCK}', '{TIKTOK,INSTAGRAM}', '{TIKTOK_VIDEO,INSTAGRAM_STORY}', 'HYBRID', 400000, 30000, 3, 'Göteborg', 10000, '2026-09-04 19:14:04.034', '2026-11-03 19:14:04.033', 'ACTIVE', '2026-09-04 19:14:04.034', '2026-09-04 19:14:04.034');
INSERT INTO public."Campaign" VALUES ('cmtnc1h1h000s7drm9ikv0pgk', 'cmtnc1h18000m7drm8vy9nwoe', 'Smakmeny för matintresserade', 'Sexrättersmeny med dryckespaket för dig som gör innehåll om fine dining. Vi vill ha en längre film där du berättar om rätterna och köket.', '{FINE_DINING,RESTAURANG}', '{YOUTUBE,INSTAGRAM}', '{YOUTUBE_VIDEO,INSTAGRAM_POST}', 'HYBRID', 1200000, 240000, 1, 'Göteborg', 30000, '2026-09-04 19:14:04.037', '2026-11-03 19:14:04.033', 'ACTIVE', '2026-09-04 19:14:04.038', '2026-09-04 19:14:04.038');
INSERT INTO public."Campaign" VALUES ('cmtnc1h1j000u7drmaoo4ltvx', 'cmtnc1h1b000o7drmtfw3df98', 'Morgonbröd och kaffe i Linné', 'Vi vill nå studenter och folk som jobbar hemifrån. Kom förbi på förmiddagen, visa surdegen och våra sittplatser. Nämn att vi öppnar 07.', '{BAGERI,CAFE}', '{TIKTOK,INSTAGRAM}', '{TIKTOK_VIDEO}', 'PRODUCT', 0, 40000, 5, 'Göteborg', 3000, '2026-09-04 19:14:04.038', '2026-09-18 19:14:04.033', 'ACTIVE', '2026-09-04 19:14:04.039', '2026-09-04 19:14:04.039');
INSERT INTO public."Campaign" VALUES ('cmtnc1h1p00107drmngu00i0a', 'cmtnc1h1b000o7drmtfw3df98', 'Fredagsfika med kanelbullar', 'Vi bakade extra inför fredagen och ville visa det. En kortare film från disken och en story när bullarna kommer ut ur ugnen.', '{BAGERI,CAFE}', '{INSTAGRAM}', '{INSTAGRAM_REEL}', 'FIXED', 350000, 0, 1, 'Göteborg', 3000, '2026-08-05 19:14:04.044', '2026-08-23 19:14:04.044', 'CLOSED', '2026-09-04 19:14:04.045', '2026-09-04 19:14:04.045');


--
-- Data for Name: InfluencerProfile; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."InfluencerProfile" VALUES ('cmtnc1h0l00017drmgk03kxo8', 'cmtnc1h0l00007drmef4r8uxa', 'annaäter', 'Testar Göteborgs lunchställen varje vardag. Kort, snabbt, ärligt.', 'Göteborg', NULL, '{RESTAURANG,MAT_OCH_DRYCK,LIVSSTIL}', 200000, 450000, 'acct_demo_annaäter', true, '2026-09-04 19:14:04.005', '2026-09-04 19:14:04.005');
INSERT INTO public."InfluencerProfile" VALUES ('cmtnc1h0s00057drm5cfznkc1', 'cmtnc1h0s00047drmnw69zsq9', 'Kocken Erik', 'Utbildad kock som recenserar fine dining och nya öppningar.', 'Göteborg', NULL, '{FINE_DINING,RESTAURANG}', 500000, 1200000, 'acct_demo_Kocken Erik', true, '2026-09-04 19:14:04.013', '2026-09-04 19:14:04.013');
INSERT INTO public."InfluencerProfile" VALUES ('cmtnc1h0w00097drm2iggx81n', 'cmtnc1h0w00087drm18ehvtya', 'saraiskafferiet', 'Kaféhäng, bakverk och studieplatser med bra kaffe.', 'Göteborg', NULL, '{CAFE,BAGERI,LIVSSTIL}', 120000, 280000, 'acct_demo_saraiskafferiet', true, '2026-09-04 19:14:04.016', '2026-09-04 19:14:04.016');
INSERT INTO public."InfluencerProfile" VALUES ('cmtnc1h0z000c7drmulitlz48', 'cmtnc1h0z000b7drmn1fy6ykp', 'gbgstreetfood', 'Street food, food trucks och sena kvällsmackor.', 'Göteborg', NULL, '{STREET_FOOD,MAT_OCH_DRYCK}', 150000, 350000, 'acct_demo_gbgstreetfood', true, '2026-09-04 19:14:04.02', '2026-09-04 19:14:04.02');
INSERT INTO public."InfluencerProfile" VALUES ('cmtnc1h12000g7drm4s421lw4', 'cmtnc1h12000f7drmgfrl8qx3', 'majagront', 'Vegetariskt och veganskt i Stockholm. Recept och restaurangtips.', 'Stockholm', NULL, '{VEGETARISKT,MAT_OCH_DRYCK}', 300000, 700000, 'acct_demo_majagront', true, '2026-09-04 19:14:04.023', '2026-09-04 19:14:04.023');
INSERT INTO public."InfluencerProfile" VALUES ('cmtnc1h15000j7drm6onhdad5', 'cmtnc1h15000i7drmk8erycri', 'oskarpakrogen', 'Barer, cocktails och afterwork. 21+.', 'Göteborg', NULL, '{BAR,NOJE}', 250000, 550000, 'acct_demo_oskarpakrogen', true, '2026-09-04 19:14:04.026', '2026-09-04 19:14:04.026');


--
-- Data for Name: Application; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: AuditEvent; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: BankIdSession; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Match; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Match" VALUES ('cmtnc1h1m000y7drmh0pllpfn', 'cmtnc1h1e000q7drmk72tm4sx', 'cmtnc1h0l00017drmgk03kxo8', 'IN_CONVERSATION', 94, 'Täcker alla nischer kampanjen efterfrågar', '2026-09-04 19:14:04.043', '2026-09-04 19:14:04.043');
INSERT INTO public."Match" VALUES ('cmtnc1h1s00147drmk6g5qaxj', 'cmtnc1h1p00107drmngu00i0a', 'cmtnc1h0s00057drm5cfznkc1', 'CONTRACTED', 88, 'Finns på plats i Göteborg och gör mat i samma stil', '2026-09-04 19:14:04.048', '2026-09-04 19:14:04.048');


--
-- Data for Name: Contract; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Contract" VALUES ('cmtnc1h1z00167drmhc6olick', 'cmtnc1h1s00147drmk6g5qaxj', 'cmtnc1h1p00107drmngu00i0a', 'cmtnc1h0s00057drm5cfznkc1', 350000, 1200, '{INSTAGRAM_REEL}', '2026-08-23 19:14:04.044', 7, '# Samarbetsavtal

**Avtalsnummer:** seed-fredagsfika

## 1. Parter

**Uppdragsgivare:** Bageri Solrosen, org.nr 556987-6543
**Uppdragstagare:** Kocken Erik, personnr 19900101-****

Avtalet ingås via Pacta, som förmedlar uppdraget och hanterar betalningen.

## 2. Uppdraget

Kampanj: **Fredagsfika med kanelbullar**

Vi bakade extra inför fredagen och ville visa det. En kortare film från disken och en story när bullarna kommer ut ur ugnen.

Uppdragstagaren ska leverera:

1. en Instagram Reel (minst 15 sekunder)

Materialet ska vara publicerat senast **23 augusti 2026**.

## 3. Ersättning

| Post | Belopp |
| --- | --- |
| Arvode | 3 500 kr |
| Plattformsavgift (12.0 %) | −420 kr |
| **Utbetalas till uppdragstagaren** | **3 080 kr** |

Uppdragsgivaren betalar in hela arvodet till Pacta när avtalet blir bindande. Beloppet hålls kvar och betalas ut till uppdragstagaren när leveransen godkänts. Uppdragsgivaren har 7 dagar på sig att granska leveransen; därefter godkänns den automatiskt och utbetalning sker.

Angivna belopp är exklusive mervärdesskatt. Uppdragstagaren ansvarar själv för skatt och eventuella sociala avgifter på ersättningen.

## 4. Marknadsföringsrättslig märkning

Uppdragstagaren ska tydligt märka allt material som reklam i enlighet med marknadsföringslagen (2008:486) och Konsumentverkets vägledning, till exempel med "Reklam för Bageri Solrosen" eller "Samarbete". Märkningen ska synas utan att mottagaren behöver klicka vidare.

## 5. Rättigheter till materialet

Uppdragstagaren behåller upphovsrätten till materialet. Uppdragsgivaren får en icke-exklusiv rätt att återpublicera materialet i sina egna kanaler i sex (6) månader från publiceringen, med angivande av uppdragstagarens användarnamn. All annan användning, inklusive betald annonsering, kräver skriftligt medgivande.

## 6. Ändring och avbokning

Avbokas uppdraget av uppdragsgivaren senare än 48 timmar före avtalad publicering utgår halva arvodet. Levererar uppdragstagaren inte i tid återbetalas hela beloppet till uppdragsgivaren, om parterna inte kommer överens om ett nytt datum.

## 7. Personuppgifter

Parterna behandlar personuppgifter enligt dataskyddsförordningen (EU) 2016/679. Pacta är personuppgiftsansvarig för uppgifterna i plattformen.

## 8. Tvist

Svensk rätt tillämpas. Tvist avgörs av svensk allmän domstol med Stockholms tingsrätt som första instans.

---

Avtalet undertecknas av båda parter med svenskt BankID. Signaturerna loggas med tidsstämpel och avtalstextens kontrollsumma.', 'COMPLETED', '2026-08-15 19:14:04.049', '2026-08-15 19:14:04.049', '2026-08-28 19:14:04.049', '2026-08-30 19:14:04.044', '2026-09-04 19:14:04.056', '2026-09-04 19:14:04.056');


--
-- Data for Name: Delivery; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Message; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Payment; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Payment" VALUES ('cmtnc1h2300187drmqgpkqhat', 'cmtnc1h1z00167drmhc6olick', 350000, 42000, 308000, 'sek', NULL, NULL, 'RELEASED', '2026-08-17 19:14:04.058', '2026-08-30 19:14:04.044', NULL, '2026-09-04 19:14:04.059', '2026-09-04 19:14:04.059');


--
-- Data for Name: ProcessedWebhook; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Review; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Review" VALUES ('cmtnc1h2600197drmw6jit5q6', 'cmtnc1h1z00167drmhc6olick', 'BUSINESS', 'cmtnc1h1b000n7drmbnles470', 'cmtnc1h0s00057drm5cfznkc1', 'cmtnc1h1b000o7drmtfw3df98', 4.7, 5, 5, 4, 'Kom när vi kom överens om, förstod direkt vad vi ville visa och filmen låg uppe samma kväll. Vi fick fler bordsbokningar dagen efter.', '2026-08-31 19:14:04.044', '2026-08-31 19:14:04.044', '2026-09-13 19:14:04.044');
INSERT INTO public."Review" VALUES ('cmtnc1h26001a7drmnngytxkb', 'cmtnc1h1z00167drmhc6olick', 'INFLUENCER', 'cmtnc1h0s00047drmnw69zsq9', 'cmtnc1h0s00057drm5cfznkc1', 'cmtnc1h1b000o7drmtfw3df98', 4.7, 4, 5, 5, 'Tydlig brief och de hade förberett allt när jag kom. Betalningen låg spärrad från början, så jag behövde aldrig fundera på om pengarna skulle komma.', '2026-08-31 19:14:04.044', '2026-08-31 19:14:04.044', '2026-09-13 19:14:04.044');


--
-- Data for Name: Signature; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: SocialAccount; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0l00027drmlkf06mwq', 'cmtnc1h0l00017drmgk03kxo8', 'TIKTOK', 'annaater', NULL, 48000, 39000, 0.071, false, NULL, NULL, NULL, '2026-09-04 19:14:04.003', '2026-09-04 19:14:04.005', '2026-09-04 19:14:04.005');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0l00037drmzah35vy3', 'cmtnc1h0l00017drmgk03kxo8', 'INSTAGRAM', 'annaater', NULL, 21000, 9000, 0.048, false, NULL, NULL, NULL, '2026-09-04 19:14:04.003', '2026-09-04 19:14:04.005', '2026-09-04 19:14:04.005');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0s00067drm1xlkwiqa', 'cmtnc1h0s00057drm5cfznkc1', 'INSTAGRAM', 'kockenerik', NULL, 96000, 41000, 0.032, true, NULL, NULL, NULL, '2026-09-04 19:14:04.012', '2026-09-04 19:14:04.013', '2026-09-04 19:14:04.013');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0t00077drmwknq38sk', 'cmtnc1h0s00057drm5cfznkc1', 'YOUTUBE', 'kockenerik', NULL, 34000, 22000, 0.041, false, NULL, NULL, NULL, '2026-09-04 19:14:04.012', '2026-09-04 19:14:04.013', '2026-09-04 19:14:04.013');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0w000a7drm7hc5o5l5', 'cmtnc1h0w00097drm2iggx81n', 'TIKTOK', 'saraiskafferiet', NULL, 14500, 18000, 0.093, false, NULL, NULL, NULL, '2026-09-04 19:14:04.015', '2026-09-04 19:14:04.016', '2026-09-04 19:14:04.016');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0z000d7drmp21di518', 'cmtnc1h0z000c7drmulitlz48', 'TIKTOK', 'gbgstreetfood', NULL, 62000, 55000, 0.065, true, NULL, NULL, NULL, '2026-09-04 19:14:04.019', '2026-09-04 19:14:04.02', '2026-09-04 19:14:04.02');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h0z000e7drmekb2mt8r', 'cmtnc1h0z000c7drmulitlz48', 'INSTAGRAM', 'gbgstreetfood', NULL, 18000, 7500, 0.039, false, NULL, NULL, NULL, '2026-09-04 19:14:04.019', '2026-09-04 19:14:04.02', '2026-09-04 19:14:04.02');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h12000h7drmtekfgzsc', 'cmtnc1h12000g7drm4s421lw4', 'INSTAGRAM', 'majagront', NULL, 71000, 28000, 0.044, true, NULL, NULL, NULL, '2026-09-04 19:14:04.022', '2026-09-04 19:14:04.023', '2026-09-04 19:14:04.023');
INSERT INTO public."SocialAccount" VALUES ('cmtnc1h15000k7drmk77yxw5f', 'cmtnc1h15000j7drm6onhdad5', 'TIKTOK', 'oskarpakrogen', NULL, 29000, 24000, 0.058, false, NULL, NULL, NULL, '2026-09-04 19:14:04.025', '2026-09-04 19:14:04.026', '2026-09-04 19:14:04.026');


--
-- Data for Name: Swipe; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Swipe" VALUES ('cmtnc1h1k000v7drmrnomvo5d', 'cmtnc1h1e000q7drmk72tm4sx', 'cmtnc1h0l00017drmgk03kxo8', 'INFLUENCER', 'LIKE', '2026-09-04 19:14:04.041');
INSERT INTO public."Swipe" VALUES ('cmtnc1h1k000w7drmqytvqleq', 'cmtnc1h1e000q7drmk72tm4sx', 'cmtnc1h0l00017drmgk03kxo8', 'BUSINESS', 'LIKE', '2026-09-04 19:14:04.041');
INSERT INTO public."Swipe" VALUES ('cmtnc1h1q00117drmaft7lu5m', 'cmtnc1h1p00107drmngu00i0a', 'cmtnc1h0s00057drm5cfznkc1', 'INFLUENCER', 'LIKE', '2026-09-04 19:14:04.047');
INSERT INTO public."Swipe" VALUES ('cmtnc1h1q00127drmp5vm3t73', 'cmtnc1h1p00107drmngu00i0a', 'cmtnc1h0s00057drm5cfznkc1', 'BUSINESS', 'LIKE', '2026-09-04 19:14:04.047');


--
-- PostgreSQL database dump complete
--

--
-- Data for Name: BusinessSocial; Type: TABLE DATA; Schema: public; Owner: -
-- Kontot kreatören ska tagga. Skrivs in i avtalet när det skapas.
--

INSERT INTO public."BusinessSocial" VALUES ('cmtnc1h18000m7drmsoc1', 'cmtnc1h18000m7drm8vy9nwoe', 'TIKTOK', 'restaurangkajutan');
INSERT INTO public."BusinessSocial" VALUES ('cmtnc1h18000m7drmsoc2', 'cmtnc1h18000m7drm8vy9nwoe', 'INSTAGRAM', 'kajutan_gbg');
INSERT INTO public."BusinessSocial" VALUES ('cmtnc1h1b000o7drmsoc1', 'cmtnc1h1b000o7drmtfw3df98', 'INSTAGRAM', 'bagerisolrosen');

UPDATE public."BusinessProfile" SET "websiteUrl" = 'https://kajutan.se' WHERE id = 'cmtnc1h18000m7drm8vy9nwoe';
UPDATE public."BusinessProfile" SET "websiteUrl" = 'https://bagerisolrosen.se' WHERE id = 'cmtnc1h1b000o7drmtfw3df98';
