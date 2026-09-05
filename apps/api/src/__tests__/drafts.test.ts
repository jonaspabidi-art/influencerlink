import { daysLeftToReviewDraft, draftDeadline, isDraftCleared } from '@pacta/shared';
import { describe, expect, it } from 'vitest';

const submittedAt = new Date('2026-09-01T12:00:00Z');
const reviewDays = 7;

describe('draftDeadline', () => {
  it('lägger granskningsfönstret på inlämningen', () => {
    expect(draftDeadline(submittedAt, reviewDays).toISOString()).toBe('2026-09-08T12:00:00.000Z');
  });
});

describe('isDraftCleared', () => {
  it('är klart när företaget godkänt', () => {
    expect(isDraftCleared({ status: 'APPROVED', submittedAt }, reviewDays, submittedAt)).toBe(true);
  });

  it('är inte klart medan svaret dröjer', () => {
    const dagenEfter = new Date('2026-09-02T12:00:00Z');
    expect(isDraftCleared({ status: 'PENDING', submittedAt }, reviewDays, dagenEfter)).toBe(false);
  });

  // Ett tyst kök får inte blockera kreatören i evighet.
  it('är klart när tiden gått ut utan svar', () => {
    const efterFonstret = new Date('2026-09-08T12:00:01Z');
    expect(isDraftCleared({ status: 'PENDING', submittedAt }, reviewDays, efterFonstret)).toBe(true);
  });

  // En begärd ändring hänger inte ut sig själv genom att tiden går.
  it('blir aldrig klart av sig självt när ändring begärts', () => {
    const langtSenare = new Date('2027-01-01T00:00:00Z');
    expect(
      isDraftCleared({ status: 'CHANGES_REQUESTED', submittedAt }, reviewDays, langtSenare),
    ).toBe(false);
  });
});

describe('daysLeftToReviewDraft', () => {
  it('räknar ned mot sista svarsdagen', () => {
    expect(daysLeftToReviewDraft(submittedAt, reviewDays, submittedAt)).toBe(7);
    expect(daysLeftToReviewDraft(submittedAt, reviewDays, new Date('2026-09-06T12:00:00Z'))).toBe(2);
  });

  it('går aldrig under noll', () => {
    expect(daysLeftToReviewDraft(submittedAt, reviewDays, new Date('2026-10-01T00:00:00Z'))).toBe(0);
  });
});
