import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { InfluencerSwipeCard } from '../../src/components/cards';
import { MatchScreen } from '../../src/components/MatchScreen';
import { SwipeDeck, type SwipeDirection } from '../../src/components/SwipeDeck';
import { Button, Card, ErrorState, Header, Loading, Screen } from '../../src/components/ui';
import { colors, spacing, type } from '../../src/theme';
import type { Campaign, InfluencerCard, SwipeResult } from '../../src/types';

export default function Discover() {
  const { campaignId } = useLocalSearchParams<{ campaignId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newMatch, setNewMatch] = useState<{ id: string; card: InfluencerCard } | null>(null);

  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.get<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
  });

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
      if (card) setNewMatch({ id: result.match.id, card });
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
      void queryClient.invalidateQueries({ queryKey: ['campaigns', 'mine'] });
    },
  });

  if (newMatch) {
    return (
      <MatchScreen
        eyebrow="NI MATCHADE"
        headline={`${newMatch.card.influencer.displayName} vill jobba med er`}
        summaryTitle={campaign.data?.title ?? 'Ert samarbete'}
        amount={campaign.data?.budgetPerCreator ?? 0}
        productValue={
          campaign.data?.compensationType === 'FIXED' ? 0 : (campaign.data?.productValue ?? 0)
        }
        escrowNote="Ni betalar först när avtalet är signerat. Beloppet ligger spärrat tills ni godkänt leveransen."
        primaryLabel={`Skriv till ${newMatch.card.influencer.displayName}`}
        onPrimary={() => {
          const matchId = newMatch.id;
          setNewMatch(null);
          router.push(`/match/${matchId}`);
        }}
        secondaryLabel="Fortsätt leta"
        onSecondary={() => setNewMatch(null)}
      />
    );
  }

  if (feed.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (feed.isError) {
    return (
      <Screen>
        <Header title="Hitta influencers" onBack={() => router.back()} />
        <ErrorState message="Kunde inte hämta förslagen." onRetry={() => void feed.refetch()} />
      </Screen>
    );
  }

  const cards = feed.data ?? [];
  const spotsLeft = campaign.data
    ? Math.max(0, campaign.data.slots - campaign.data.slotsFilled)
    : 0;

  if (cards.length === 0) {
    return (
      <Screen>
        <Header
          title="Hitta influencers"
          onBack={() => router.back()}
          subtitle={campaign.data?.title}
        />
        <View style={styles.emptyBody}>
          <Card>
            <Text style={styles.emptyTitle}>Du har sett alla som matchar</Text>
            <Text style={styles.emptyText}>
              Fler kreatörer dyker upp när de kopplar sina konton. Sänk följarkravet eller höj
              budgeten för att se fler direkt.
            </Text>
            <Button
              label="Justera kampanjen"
              onPress={() => router.push(`/campaign/${campaignId}`)}
            />
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Hitta influencers"
        onBack={() => router.back()}
        subtitle={
          campaign.data
            ? `${campaign.data.title} · ${spotsLeft} av ${campaign.data.slots} platser kvar`
            : undefined
        }
      />
      <SwipeDeck
        items={cards}
        keyExtractor={(card) => card.influencer.id}
        renderCard={(card) => <InfluencerSwipeCard card={card} />}
        onSwipe={(card, direction) =>
          swipe.mutate({ influencerId: card.influencer.id, direction })
        }
        trustText="Du betalar först när avtalet är signerat"
        onExhausted={() => void feed.refetch()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyBody: { flex: 1, paddingHorizontal: spacing.base },
  emptyTitle: { ...type.sectionTitle, color: colors.text },
  emptyText: { ...type.bodySmall, color: colors.muted },
});
