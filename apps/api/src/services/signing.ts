import type { PrismaClient, SignatureMethod } from '@prisma/client';
import { recordAudit } from '../lib/audit.js';
import { sha256Hex } from '../lib/crypto.js';
import { forbidden } from '../lib/errors.js';

/**
 * Signering av avtal, oberoende av hur undertecknaren bevisade vem hen är.
 *
 * Två sätt finns. BankID ger en signatur med bevisvärde men kräver avtal med
 * en bank. Enkel signering är den inloggade som bekräftar avtalstexten – det
 * är bindande, men bevisningen vilar på kontot, tidpunkten och att texten
 * sparas ordagrant. Vilket som gäller styrs av SIGNING_MODE.
 *
 * Skillnaden ligger bara i bevisfälten. Allt annat – vem som får signera, när
 * avtalet blir aktivt, vad som loggas – är detsamma, och därför en funktion.
 */

export interface SignatureEvidence {
  method: SignatureMethod;
  /** Fylls bara vid BankID. */
  bankIdOrderRef?: string;
  signatureBlob?: string;
  ocspResponse?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SignResult {
  /** Sant när motparten redan hade signerat och avtalet nu är aktivt. */
  bothSigned: boolean;
}

/**
 * Skriver signaturen och flyttar avtalet framåt. Avtalet blir ACTIVE först
 * när båda parter har signerat.
 *
 * Undertecknaren måste vara part i avtalet. Att signera två gånger är tillåtet
 * men gör ingenting: den första signaturen står kvar, med sin tidpunkt.
 */
export async function recordSignature(
  prisma: PrismaClient,
  input: { contractId: string; signerUserId: string; evidence: SignatureEvidence },
): Promise<SignResult> {
  const { contractId, signerUserId, evidence } = input;

  const signer = await prisma.user.findUnique({ where: { id: signerUserId } });
  if (!signer) throw forbidden('Den som signerade har inget konto i appen.');

  const contract = await prisma.contract.findUniqueOrThrow({
    where: { id: contractId },
    include: {
      campaign: { include: { business: true } },
      influencer: true,
    },
  });

  const isInfluencer = contract.influencer.userId === signer.id;
  const isBusiness = contract.campaign.business.userId === signer.id;
  if (!isInfluencer && !isBusiness) {
    throw forbidden('Du är inte part i det här avtalet.');
  }

  const termsHash = sha256Hex(contract.terms);

  return prisma.$transaction(async (tx) => {
    /*
     * En signatur skrivs en gång. Trycker någon två gånger – dubbeltryck,
     * omladdad sida – står den första kvar med sin tidpunkt, och då ska inget
     * nytt revisionsspår heller skrivas. Ett "contract.signed" per tryck hade
     * fått loggen att se ut som att avtalet signerats flera gånger.
     */
    const existing = await tx.signature.findUnique({
      where: { contractId_userId: { contractId, userId: signer.id } },
      select: { id: true },
    });

    if (!existing) {
      await tx.signature.create({
        data: {
          contractId,
          userId: signer.id,
          method: evidence.method,
          bankIdOrderRef: evidence.bankIdOrderRef ?? null,
          signatureBlob: evidence.signatureBlob ?? null,
          ocspResponse: evidence.ocspResponse ?? null,
          termsHash,
          // Namnet fryses här: kontot kan byta namn, avtalet ska ändå visa vem
          // som skrev under.
          signerName: signer.name,
          ipAddress: evidence.ipAddress ?? null,
          userAgent: evidence.userAgent ?? null,
        },
      });
    }

    const signedByInfluencerAt = isInfluencer
      ? (contract.signedByInfluencerAt ?? new Date())
      : contract.signedByInfluencerAt;
    const signedByBusinessAt = isBusiness
      ? (contract.signedByBusinessAt ?? new Date())
      : contract.signedByBusinessAt;
    const bothSigned = signedByInfluencerAt !== null && signedByBusinessAt !== null;

    await tx.contract.update({
      where: { id: contractId },
      data: {
        signedByInfluencerAt,
        signedByBusinessAt,
        status: bothSigned ? 'ACTIVE' : 'PARTIALLY_SIGNED',
      },
    });

    if (!existing) {
      await recordAudit(tx, {
        userId: signer.id,
        action: 'contract.signed',
        entityType: 'Contract',
        entityId: contractId,
        metadata: {
          party: isInfluencer ? 'influencer' : 'business',
          method: evidence.method,
          termsHash,
        },
      });
    }

    return { bothSigned };
  });
}
