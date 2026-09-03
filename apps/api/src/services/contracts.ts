import { sha256Hex } from '../lib/crypto.js';

export {
  buildSigningText,
  describeDeliverable,
  renderContractTerms,
  type ContractTermsInput,
} from '@influencerlink/shared';

/**
 * Kontrollsumman som signeras med BankID och sparas tillsammans med signaturen.
 * Bor kvar i API:et eftersom den kräver Nodes kryptobibliotek – själva
 * avtalstexten ligger i det delade paketet så att appen kan visa den offline.
 */
export function hashTerms(terms: string): string {
  return sha256Hex(terms);
}
