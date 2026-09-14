-- CreateEnum
CREATE TYPE "SignatureMethod" AS ENUM ('BANKID', 'SIMPLE');

-- AlterTable
ALTER TABLE "Signature" ADD COLUMN     "method" "SignatureMethod" NOT NULL DEFAULT 'BANKID',
ADD COLUMN     "signerName" TEXT,
ADD COLUMN     "userAgent" TEXT,
ALTER COLUMN "bankIdOrderRef" DROP NOT NULL,
ALTER COLUMN "signatureBlob" DROP NOT NULL,
ALTER COLUMN "ocspResponse" DROP NOT NULL;
