/**
 * Uppgifterna som står i villkoren och integritetspolicyn.
 *
 * Samlade här för att bara behöva ändras på ett ställe. Fyll i det som står
 * inom hakparentes innan sidorna används skarpt – en integritetspolicy utan
 * personuppgiftsansvarig och kontaktväg uppfyller inte kraven.
 */
export const LEGAL = {
  serviceName: 'Pacta',
  companyName: '[FÖRETAGSNAMN]',
  orgNumber: '[ORGANISATIONSNUMMER]',
  contactEmail: '[KONTAKT-E-POST]',
  /** Datum då dokumenten senast ändrades. */
  updated: '2026-09-06',
  /** Avgiften är delad: företaget betalar sin del ovanpå, kreatören sin av arvodet. */
  businessFeePercent: 10,
  creatorFeePercent: 10,
};

export interface LegalSection {
  title: string;
  paragraphs: string[];
  /** Punktlista under styckena. */
  bullets?: string[];
}
