import {
  REVIEW_CRITERIA,
  REVIEW_CRITERION_LABELS,
  overallRating,
  type ReviewCriterion,
  type ReviewScores,
} from '@influencerlink/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError, api } from '../../../src/api';
import { useAuth } from '../../../src/auth';
import { LockIcon } from '../../../src/components/icons';
import { ReviewCard } from '../../../src/components/ReviewList';
import {
  Body,
  Button,
  Card,
  Field,
  Header,
  Loading,
  RatingInput,
  ScrollScreen,
  Stars,
} from '../../../src/components/ui';
import { colors, spacing, type } from '../../../src/theme';
import type { Contract, Review, ReviewState } from '../../../src/types';

/**
 * Skriva omdöme efter ett avslutat samarbete.
 *
 * Skärmen säger rakt ut att omdömet är blint, eftersom det är det som gör att
 * folk vågar sätta något annat än fem.
 */
export default function WriteReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [scores, setScores] = useState<Partial<ReviewScores>>({});
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const contract = useQuery({
    queryKey: ['contract', id],
    queryFn: () => api.get<Contract>(`/contracts/${id}`),
    enabled: Boolean(id),
  });
  const state = useQuery({
    queryKey: ['contract-reviews', id],
    queryFn: () => api.get<ReviewState>(`/contracts/${id}/reviews`),
    enabled: Boolean(id),
  });

  const submit = useMutation({
    mutationFn: () =>
      api.post<Review>(`/contracts/${id}/reviews`, {
        scores: scores as ReviewScores,
        comment: comment.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contract-reviews', id] });
      void queryClient.invalidateQueries({ queryKey: ['reviews-pending'] });
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Omdömet kunde inte sparas.'),
  });

  if (contract.isLoading || state.isLoading || !contract.data || !state.data) {
    return (
      <ScrollScreen>
        <Loading />
      </ScrollScreen>
    );
  }

  const isBusiness = user?.role === 'BUSINESS';
  // Restaurangen bedömer kreatören, och tvärtom.
  const subject = isBusiness ? ('INFLUENCER' as const) : ('BUSINESS' as const);
  const counterpart = isBusiness ? contract.data.influencerName : contract.data.businessName;
  const labels = REVIEW_CRITERION_LABELS[subject];
  const complete = REVIEW_CRITERIA.every((criterion) => scores[criterion] !== undefined);

  if (state.data.mine) {
    return (
      <ScrollScreen contentStyle={styles.content}>
        <Header title="Ditt omdöme" onBack={() => router.back()} />
        <ReviewCard review={state.data.mine} showBreakdown />
        {state.data.theirs ? (
          <>
            <Text style={styles.sectionTitle}>{counterpart} skrev</Text>
            <ReviewCard review={state.data.theirs} showBreakdown />
          </>
        ) : (
          <Card tone="raised">
            <View style={styles.blindHead}>
              <LockIcon size={16} color={colors.positive} />
              <Text style={styles.blindTitle}>
                {state.data.theirsPending ? 'Båda har skrivit' : 'Väntar på motparten'}
              </Text>
            </View>
            <Body>
              {state.data.theirsPending
                ? 'Omdömena släpps fram samtidigt. Ladda om om en stund.'
                : `${counterpart} har ${state.data.daysLeft} dagar kvar att skriva sitt. Ditt syns när båda lämnat, eller när tiden gått ut.`}
            </Body>
          </Card>
        )}
      </ScrollScreen>
    );
  }

  if (!state.data.canReview) {
    return (
      <ScrollScreen contentStyle={styles.content}>
        <Header title="Omdöme" onBack={() => router.back()} />
        <Card>
          <Text style={styles.sectionTitle}>Går inte att lämna</Text>
          <Body>{state.data.reason ?? 'Omdömet går inte att lämna just nu.'}</Body>
        </Card>
      </ScrollScreen>
    );
  }

  const preview = complete ? overallRating(scores as ReviewScores) : 0;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title={`Omdöme om ${counterpart}`} onBack={() => router.back()} />

      <Card tone="raised">
        <View style={styles.blindHead}>
          <LockIcon size={16} color={colors.positive} />
          <Text style={styles.blindTitle}>Ni ser varandras omdömen samtidigt</Text>
        </View>
        <Body>
          Varken du eller {counterpart} ser det andra omdömet förrän båda skrivit, eller tills
          fönstret går ut om {state.data.daysLeft} dagar. Skriv det du faktiskt tycker.
        </Body>
      </Card>

      {REVIEW_CRITERIA.map((criterion: ReviewCriterion) => (
        <View key={criterion} style={styles.criterion}>
          <Text style={styles.criterionLabel}>{labels[criterion]}</Text>
          <RatingInput
            label={labels[criterion]}
            value={scores[criterion] ?? 0}
            onChange={(value) => setScores((current) => ({ ...current, [criterion]: value }))}
          />
        </View>
      ))}

      {complete ? (
        <View style={styles.previewRow}>
          <Text style={styles.previewLabel}>Helhetsbetyg</Text>
          <View style={styles.previewValue}>
            <Stars value={preview} size={16} />
            <Text style={styles.previewNumber}>{preview.toFixed(1).replace('.', ',')}</Text>
          </View>
        </View>
      ) : null}

      <Field
        label="Kommentar"
        value={comment}
        onChangeText={setComment}
        placeholder={`Vad ska andra veta innan de jobbar med ${counterpart}?`}
        multiline
        hint="Frivillig, men det är den här texten folk faktiskt läser."
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label="Skicka omdöme"
        onPress={() => {
          setError(null);
          submit.mutate();
        }}
        loading={submit.isPending}
        disabled={!complete}
      />
      <Text style={styles.footnote}>
        Ett skickat omdöme går inte att ändra. Det står kvar på {counterpart}s profil.
      </Text>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  sectionTitle: { ...type.rowTitle, color: colors.text },
  blindHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  blindTitle: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.text },

  criterion: { gap: spacing.sm },
  criterionLabel: { ...type.listTitle, fontSize: 15, color: colors.text },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  previewLabel: { ...type.body, color: colors.muted },
  previewValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewNumber: { ...type.amountSmall, color: colors.text },

  error: { ...type.secondary, color: colors.danger },
  footnote: { ...type.secondary, color: colors.dim },
});
