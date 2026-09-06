-- Delad förmedlingsavgift: företaget betalar sin del ovanpå arvodet,
-- kreatören får sin dragen vid utbetalning.
ALTER TABLE "Contract" ADD COLUMN     "businessFeeBps" INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE "Contract" ADD COLUMN     "creatorFeeBps" INTEGER NOT NULL DEFAULT 1000;

-- Avtal tecknade före ändringen lade hela avgiften på kreatören. De ska
-- fortsätta räknas precis som när de signerades.
UPDATE "Contract" SET "businessFeeBps" = 0, "creatorFeeBps" = "platformFeeBps";

ALTER TABLE "Contract" DROP COLUMN "platformFeeBps";
