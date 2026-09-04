import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { api } from '../../../src/api';
import { NoReviews, RatingHeadline, ReviewCard } from '../../../src/components/ReviewList';
import {
  Body,
  Card,
  ErrorState,
  Header,
  Loading,
  RatingBars,
  ScrollScreen,
} from '../../../src/components/ui';
import { spacing } from '../../../src/theme';
import type { ProfileReviews } from '../../../src/types';

/**
 * Alla publicerade omdömen om en profil. Nås från matchningen, avtalet och
 * kortet – överallt där man står inför att säga ja till någon.
 */
export default function ProfileReviewsScreen() {
  const { type, id, name } = useLocalSearchParams<{ type: string; id: string; name?: string }>();
  const router = useRouter();
  const subject = type === 'business' ? ('BUSINESS' as const) : ('INFLUENCER' as const);

  const reviews = useQuery({
    queryKey: ['profile-reviews', subject, id],
    queryFn: () =>
      api.get<ProfileReviews>(
        subject === 'BUSINESS' ? `/businesses/${id}/reviews` : `/influencers/${id}/reviews`,
      ),
    enabled: Boolean(id),
  });

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title={name ?? 'Omdömen'} subtitle="Omdömen" onBack={() => router.back()} />

      {reviews.isLoading ? <Loading /> : null}
      {reviews.isError ? (
        <ErrorState message="Kunde inte hämta omdömena." onRetry={() => void reviews.refetch()} />
      ) : null}

      {reviews.data ? (
        reviews.data.summary.count === 0 ? (
          <NoReviews subject={subject} />
        ) : (
          <>
            <Card>
              <RatingHeadline
                average={reviews.data.summary.average}
                count={reviews.data.summary.count}
              />
              <RatingBars summary={reviews.data.summary} />
              <Body>
                Varje omdöme kommer från ett avtal som gått hela vägen till utbetalning, och båda
                parter skrev sitt utan att se det andra.
              </Body>
            </Card>

            <View style={styles.list}>
              {reviews.data.reviews.map((review) => (
                <ReviewCard key={review.id} review={review} showBreakdown />
              ))}
            </View>
          </>
        )
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  list: { gap: spacing.md },
});
