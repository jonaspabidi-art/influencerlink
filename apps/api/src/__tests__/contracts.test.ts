import { describe, expect, it } from 'vitest';
import {
  buildSigningText,
  describeDeliverable,
  hashTerms,
  renderContractTerms,
  type ContractTermsInput,
} from '../services/contracts.js';

function input(overrides: Partial<ContractTermsInput> = {}): ContractTermsInput {
  return {
    contractId: 'ctr_123',
    businessName: 'Restaurang Kajutan',
    businessOrgNumber: '5560001234',
    influencerName: 'Anna Karlsson',
    influencerPersonalNumberMask: '19900101-****',
    campaignTitle: 'Ny lunchmeny',
    campaignBrief: 'Vi lanserar en ny lunchmeny med råvaror från Västkusten.',
    deliverables: ['TIKTOK_VIDEO', 'INSTAGRAM_STORY'],
    fee: 400_000,
    platformFeeBps: 1200,
    dueDate: new Date('2026-05-20T00:00:00Z'),
    reviewDays: 7,
    extraTerms: '',
    ...overrides,
  };
}

describe('renderContractTerms', () => {
  it('namnger kontot kreatören ska tagga, i fast ordning', () => {
    const terms = renderContractTerms(
      input({
        businessAccounts: [
          { platform: 'INSTAGRAM', handle: 'kajutan_gbg' },
          { platform: 'TIKTOK', handle: 'kajutan' },
        ],
      }),
    );
    expect(terms).toContain('TikTok @kajutan, Instagram @kajutan_gbg');
  });

  it('utelämnar taggningen helt när företaget saknar konton', () => {
    expect(renderContractTerms(input())).not.toContain('ska tagga');
  });

  it('får med båda parter och avtalsnumret', () => {
    const terms = renderContractTerms(input());
    expect(terms).toContain('Restaurang Kajutan');
    expect(terms).toContain('556000-1234');
    expect(terms).toContain('Anna Karlsson');
    expect(terms).toContain('19900101-****');
    expect(terms).toContain('ctr_123');
  });

  it('redovisar arvode, avgift och nettoutbetalning', () => {
    const terms = renderContractTerms(input()).replace(/\s/g, ' ');
    expect(terms).toContain('4 000 kr');
    expect(terms).toContain('480 kr');
    expect(terms).toContain('3 520 kr');
  });

  it('listar varje leverabel numrerat', () => {
    const terms = renderContractTerms(input());
    expect(terms).toContain('1. en TikTok-video');
    expect(terms).toContain('2. en Instagram-story');
  });

  it('nämner reklammärkning enligt marknadsföringslagen', () => {
    expect(renderContractTerms(input())).toContain('marknadsföringslagen');
  });

  it('anger granskningstiden som avtalats', () => {
    expect(renderContractTerms(input({ reviewDays: 14 }))).toContain('14 dagar');
  });

  it('lägger till särskilda villkor bara när sådana finns', () => {
    expect(renderContractTerms(input())).not.toContain('Särskilda villkor');
    const withExtra = renderContractTerms(input({ extraTerms: 'Filmning sker på tisdagar.' }));
    expect(withExtra).toContain('Särskilda villkor');
    expect(withExtra).toContain('Filmning sker på tisdagar.');
  });

  it('är deterministisk – samma indata ger exakt samma text', () => {
    // Avgörande: texten hashas och signeras med BankID.
    expect(renderContractTerms(input())).toBe(renderContractTerms(input()));
  });

  it('ändrar texten när villkoren ändras', () => {
    expect(renderContractTerms(input())).not.toBe(renderContractTerms(input({ fee: 500_000 })));
  });
});

describe('hashTerms', () => {
  it('ger en stabil sha256-hash', () => {
    const terms = renderContractTerms(input());
    expect(hashTerms(terms)).toBe(hashTerms(terms));
    expect(hashTerms(terms)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('ändras vid minsta ändring i avtalstexten', () => {
    const terms = renderContractTerms(input());
    expect(hashTerms(terms)).not.toBe(hashTerms(`${terms} `));
  });
});

describe('buildSigningText', () => {
  it('visar motpart, kampanj och belopp i BankID-appen', () => {
    const text = buildSigningText({
      campaignTitle: 'Ny lunchmeny',
      counterpartName: 'Restaurang Kajutan',
      fee: 400_000,
      contractId: 'ctr_123',
    }).replace(/\s/g, ' ');
    expect(text).toContain('Restaurang Kajutan');
    expect(text).toContain('Ny lunchmeny');
    expect(text).toContain('4 000 kr');
    expect(text).toContain('ctr_123');
  });
});

describe('describeDeliverable', () => {
  it('beskriver varje leverabel på svenska', () => {
    expect(describeDeliverable('YOUTUBE_SHORT')).toBe('en YouTube Short');
  });
});
