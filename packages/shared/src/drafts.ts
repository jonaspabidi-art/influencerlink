/**
 * Videoutkast som lämnas för godkännande innan publicering.
 *
 * Poängen är dubbel: restaurangen slipper bli överraskad av vad som läggs ut,
 * och den får filen – vilket är vad nyttjanderätten i avtalet handlar om. Ett
 * godkännande som ingen svarar på får inte stoppa kreatören, så tystnad räknas
 * som ett ja efter granskningsfönstret.
 */

export const DRAFT_STATUSES = ['PENDING', 'APPROVED', 'CHANGES_REQUESTED'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const DRAFT_STATUS_LABELS: Record<DraftStatus, string> = {
  PENDING: 'Väntar på godkännande',
  APPROVED: 'Godkänt',
  CHANGES_REQUESTED: 'Ändring begärd',
};

/** Största fil vi tar emot. En minut i 1080p ligger en bra bit under. */
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

export const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;
export type VideoMimeType = (typeof VIDEO_MIME_TYPES)[number];

/** Sista dag restaurangen kan svara innan utkastet räknas som godkänt. */
export function draftDeadline(submittedAt: Date, reviewDays: number): Date {
  return new Date(submittedAt.getTime() + reviewDays * 86_400_000);
}

/**
 * Är utkastet klart att publicera?
 *
 * Antingen har restaurangen godkänt, eller så har granskningsfönstret gått ut
 * utan svar. Ett utkast med begärd ändring är aldrig klart – då finns en ny
 * version att ladda upp.
 */
export function isDraftCleared(
  draft: { status: DraftStatus; submittedAt: Date },
  reviewDays: number,
  now: Date = new Date(),
): boolean {
  if (draft.status === 'APPROVED') return true;
  if (draft.status === 'CHANGES_REQUESTED') return false;
  return draftDeadline(draft.submittedAt, reviewDays).getTime() <= now.getTime();
}

/** Dagar kvar för restaurangen att svara. Noll när tiden gått ut. */
export function daysLeftToReviewDraft(
  submittedAt: Date,
  reviewDays: number,
  now: Date = new Date(),
): number {
  const left = draftDeadline(submittedAt, reviewDays).getTime() - now.getTime();
  return Math.max(0, Math.ceil(left / 86_400_000));
}
