import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api } from '../../src/api';
import { InfluencerSwipeCard } from '../../src/components/cards';
import { SwipeDeck, type SwipeDirection } from '../../src/components/SwipeDeck';
import {
  Body,
  Button,
  EmptyState,
  ErrorState,
  Heading,
  Loading,
  Screen,
} from '../../src/components/ui';
import { spacing } from '../../src/theme';
import type { InfluencerCard, SwipeResult } from '../../src/types';

export default function Discover() {
  const { campaignId } = useLocalSearchParams<{ campaignId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newMatch, setNewMatch] = useState<{ id: string; name: string } | null>(null);

  const feed = useQuery({
    queryKey: ['feed', 'influencers', campaignId],
    queryFn: () => api.get<InfluencerCard[]>(`/feed/influencers?campaignId=${campaignId}`),
    enabled: Boolean(campaignId),
  });

  const swipe = useMutation({
    mutationFn: (input: { influencerId: string; direction: SwipeDirection }) =>
      api.post<SwipeResult>('/swipes', { campaignId, ...input }),
    onSuccess: (result, variables) => {
      if (!result.match) return;
      const card = feed.data?.find((item) => item.influencer.id === variables.influencerId);
      setNewMatch({ id: result.match.id, name: card?.influencer.displayName ?? 'Kreatören' });
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });

  if (feed.isLoading) {
    return (
      <Screen>
        <Loading label="Letar efter kreatörer …" />
      </Screen>
    );
  }
  if (feed.isError) {
    return (
      <Screen>
        <ErrorState message="Kunde inte hämta förslagen." onRetry={() => void feed.refetch()} />
      </Screen>
    );
  }

  if (newMatch) {
    return (
      <Screen>
        <View style={styles.matchScreen}>
          <Heading>Det är en matchning!</Heading>
          <Body muted>
            {newMatch.name} vill också jobba med er. Kom överens om upplägget och skicka ett avtal.
          </Body>
          <Button
            label="Öppna matchningen"
            onPress={() => {
              const matchId = newMatch.id;
              setNewMatch(null);
              router.push(`/match/${matchId}`);
            }}
          />
          <Button label="Fortsätt leta" variant="ghost" onPress={() => setNewMatch(null)} />
        </View>
      </Screen>
    );
  }

  const cards = feed.data ?? [];
  if (cards.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="people-outline"
          title="Inga fler förslag"
          message="Du har gått igenom alla kreatörer som matchar kampanjens krav. Sänk följarkravet eller höj budgeten för att se fler."
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <SwipeDeck
        items={cards}
        keyExtractor={(card) => card.influencer.id}
        renderCard={(card) => <InfluencerSwipeCard card={card} />}
        onSwipe={(card, direction) =>
          swipe.mutate({ influencerId: card.influencer.id, direction })
        }
        onExhausted={() => void feed.refetch()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingVertical: spacing.sm },
  matchScreen: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.md },
});
