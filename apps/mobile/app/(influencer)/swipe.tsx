import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api } from '../../src/api';
import { CampaignSwipeCard } from '../../src/components/cards';
import { SwipeDeck, type SwipeDirection } from '../../src/components/SwipeDeck';
import { Body, Button, Card, EmptyState, ErrorState, Heading, Loading, Screen } from '../../src/components/ui';
import { spacing } from '../../src/theme';
import type { CampaignCard, SwipeResult } from '../../src/types';

export default function InfluencerSwipe() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newMatch, setNewMatch] = useState<{ id: string; title: string } | null>(null);

  const feed = useQuery({
    queryKey: ['feed', 'campaigns'],
    queryFn: () => api.get<CampaignCard[]>('/feed/campaigns'),
  });

  const swipe = useMutation({
    mutationFn: (input: { campaignId: string; direction: SwipeDirection }) =>
      api.post<SwipeResult>('/swipes', input),
    onSuccess: (result, variables) => {
      if (!result.match) return;
      const card = feed.data?.find((item) => item.campaign.id === variables.campaignId);
      setNewMatch({ id: result.match.id, title: card?.campaign.title ?? 'Nytt samarbete' });
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });

  if (feed.isLoading) {
    return (
      <Screen>
        <Loading label="Hämtar samarbeten …" />
      </Screen>
    );
  }

  if (feed.isError) {
    return (
      <Screen>
        <ErrorState
          message="Kunde inte hämta samarbeten just nu."
          onRetry={() => void feed.refetch()}
        />
      </Screen>
    );
  }

  const cards = feed.data ?? [];

  if (newMatch) {
    return (
      <Screen>
        <View style={styles.matchScreen}>
          <Heading>Det är en matchning!</Heading>
          <Body muted>
            Restaurangen bakom “{newMatch.title}” vill också jobba med dig. Skriv ett hej så sätter
            ni igång.
          </Body>
          <Button
            label="Öppna matchningen"
            onPress={() => {
              const matchId = newMatch.id;
              setNewMatch(null);
              router.push(`/match/${matchId}`);
            }}
          />
          <Button label="Fortsätt swipa" variant="ghost" onPress={() => setNewMatch(null)} />
        </View>
      </Screen>
    );
  }

  if (cards.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="albums-outline"
          title="Inga fler samarbeten just nu"
          message="Vi hör av oss när något nytt dyker upp i din stad. Titta gärna över dina nischer och ditt lägsta arvode under tiden."
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <SwipeDeck
        items={cards}
        keyExtractor={(card) => card.campaign.id}
        renderCard={(card) => <CampaignSwipeCard card={card} />}
        onSwipe={(card, direction) =>
          swipe.mutate({ campaignId: card.campaign.id, direction })
        }
        onExhausted={() => void feed.refetch()}
      />
      {swipe.isError ? (
        <Card>
          <Body>Svepet kunde inte sparas. Kontrollera nätet och försök igen.</Body>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingVertical: spacing.sm },
  matchScreen: { flex: 1, justifyContent: 'center', gap: spacing.md, padding: spacing.md },
});
