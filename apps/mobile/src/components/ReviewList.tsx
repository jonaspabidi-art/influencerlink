import { REVIEW_CRITERIA, REVIEW_CRITERION_LABELS, formatRating } from '@pacta/shared';
import { StyleSheet, Text, View } from 'react-native';
import { formatDate } from '../format';
import { colors, radius, spacing, type } from '../theme';
import type { Review } from '../types';
import { Stars } from './ui';

/**
 * Ett enskilt omdöme. `subject` avgör etiketterna: samma delbetyg heter olika
 * saker beroende på om det är kreatören eller företaget som blir bedömd.
 */
export function ReviewCard({ review, showBreakdown = false }: { review: Review; showBreakdown?: boolean }) {
  const labels = REVIEW_CRITERION_LABELS[review.subject];

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.author}>{review.authorName}</Text>
          <Text style={styles.secondary}>
            {review.campaignTitle} · {formatDate(review.createdAt)}
          </Text>
        </View>
        <View style={styles.headRating}>
          <Stars value={review.rating} size={13} />
          <Text style={styles.ratingValue}>{formatRating(review.rating)}</Text>
        </View>
      </View>

      {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}

      {showBreakdown ? (
        <View style={styles.breakdown}>
          {REVIEW_CRITERIA.map((criterion) => (
            <View key={criterion} style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{labels[criterion]}</Text>
              <Stars value={review.scores[criterion]} size={12} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Tomt läge: en ny profil har inga omdömen, och det är inget fel. */
export function NoReviews({ subject }: { subject: 'INFLUENCER' | 'BUSINESS' }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Inga omdömen än</Text>
      <Text style={styles.emptyText}>
        {subject === 'INFLUENCER'
          ? 'Omdömen skrivs av företag efter att ett samarbete är klart och utbetalt. Den här kreatören har inte hunnit avsluta något ännu.'
          : 'Omdömen skrivs av kreatörer efter att ett samarbete är klart och utbetalt. Den här företaget har inte hunnit avsluta något ännu.'}
      </Text>
    </View>
  );
}

/** Betygsraden överst på en profils omdömessida. */
export function RatingHeadline({ average, count }: { average: number; count: number }) {
  return (
    <View style={styles.headline}>
      <Text style={styles.headlineValue}>{formatRating(average)}</Text>
      <View style={styles.headlineText}>
        <Stars value={average} size={15} />
        <Text style={styles.secondary}>
          {count} {count === 1 ? 'omdöme' : 'omdömen'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.base,
    gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  headRating: { alignItems: 'flex-end', gap: 2 },
  author: { ...type.listTitle, fontSize: 15, color: colors.text },
  secondary: { ...type.secondary, color: colors.muted },
  ratingValue: { fontFamily: type.listTitle.fontFamily, fontSize: 13, color: colors.text },
  comment: { ...type.bodySmall, color: colors.text },

  breakdown: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  breakdownLabel: { ...type.secondary, color: colors.muted, flexShrink: 1 },

  headline: { flexDirection: 'row', alignItems: 'center', gap: spacing.base },
  headlineValue: { ...type.amountLarge, color: colors.text },
  headlineText: { gap: 4 },

  empty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 22,
    gap: 10,
  },
  emptyTitle: { ...type.sectionTitle, color: colors.text },
  emptyText: { ...type.bodySmall, color: colors.muted },
});
