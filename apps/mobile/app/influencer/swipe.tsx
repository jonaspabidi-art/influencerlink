import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { CampaignSwipeCard } from '../../src/components/cards';
import { SwipeDeck, type SwipeDirection } from '../../src/components/SwipeDeck';
import { SlidersIcon } from '../../src/components/icons';
import {
  Button,
  ErrorState,
  Header,
  IconButton,
  Loading,
  Logo,
  Screen,
} from '../../src/components/ui';
import { MatchScreen } from '../../src/components/MatchScreen';
import { formatSek } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { CampaignCard, PendingLike, SwipeResult } from '../../src/types';

export default function InfluencerSwipe() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [newMatch, setNewMatch] = useState<{ id: string; card: CampaignCard } | null>(null);

  const feed = useQuery({
    queryKey: ['feed', 'campaigns'],
    queryFn: () => api.get<CampaignCard[]>('/feed/campaigns'),
  });

  const pending = useQuery({
    queryKey: ['feed', 'pending'],
    queryFn: () => api.get<PendingLike[]>('/feed/pending'),
  });

  const swipe = useMutation({
    mutationFn: (input: { campaignId: string; direction: SwipeDirection }) =>
      api.post<SwipeResult>('/swipes', input),
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['feed', 'pending'] });
      if (!result.match) return;
      const card = feed.data?.find((item) => item.campaign.id === variables.campaignId);
      if (card) setNewMatch({ id: result.match.id, card });
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });

  if (newMatch) {
    return (
      <MatchScreen
        eyebrow="NI MATCHADE"
        headline={`${newMatch.card.campaign.businessName} vill jobba med dig`}
        summaryTitle={newMatch.card.campaign.title}
        amount={newMatch.card.campaign.budgetPerCreator}
        productValue={
          newMatch.card.campaign.compensationType === 'FIXED'
            ? 0
            : newMatch.card.campaign.productValue
        }
        escrowNote="Arvodet betalas in till ett spärrat konto när avtalet är signerat och betalas ut när leveransen godkänts."
        primaryLabel={`Skriv till ${newMatch.card.campaign.businessName}`}
        onPrimary={() => {
          const matchId = newMatch.id;
          setNewMatch(null);
          router.push(`/match/${matchId}`);
        }}
        secondaryLabel="Fortsätt svepa"
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
        <Header title="Upptäck" large />
        <ErrorState
          message="Kunde inte hämta samarbeten just nu."
          onRetry={() => void feed.refetch()}
        />
      </Screen>
    );
  }

  const cards = feed.data ?? [];
  const queue = pending.data ?? [];

  if (cards.length === 0) {
    return <EmptyDeck queue={queue} onRefresh={() => void feed.refetch()} />;
  }

  return (
    <Screen>
      <Header
        title="Upptäck"
        large
        subtitle={`${cards.length} ${cards.length === 1 ? 'kampanj' : 'kampanjer'} som passar dig`}
        right={
          <IconButton label="Filter" onPress={() => router.push('/onboarding/influencer')}>
            <SlidersIcon size={17} color={colors.muted} />
          </IconButton>
        }
      />
      <SwipeDeck
        items={cards}
        keyExtractor={(card) => card.campaign.id}
        renderCard={(card) => <CampaignSwipeCard card={card} />}
        onSwipe={(card, direction) => swipe.mutate({ campaignId: card.campaign.id, direction })}
        trustText="Arvodet spärras hos Pacta"
        onExhausted={() => void feed.refetch()}
      />
    </Screen>
  );
}

/**
 * Slut på kort. Ska inte se ut som ett fel: visa vad som händer härnäst och
 * ge något att göra.
 */
function EmptyDeck({ queue, onRefresh }: { queue: PendingLike[]; onRefresh: () => void }) {
  const router = useRouter();

  return (
    <Screen>
      <Header
        title="Upptäck"
        large
        subtitle={queue.length > 0 ? 'Du har sett alla kampanjer just nu' : 'Inga kampanjer just nu'}
      />
      <View style={styles.emptyBody}>
        {queue.length > 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Du är i kö på {queue.length} {queue.length === 1 ? 'kampanj' : 'kampanjer'}
            </Text>
            <Text style={styles.emptyText}>
              Restaurangerna svarar oftast inom några dagar. Vi hör av oss så snart någon vill
              jobba med dig.
            </Text>
            <View style={styles.queue}>
              {queue.slice(0, 3).map((item) => (
                <View key={item.campaignId} style={styles.queueRow}>
                  <Logo uri={item.businessLogoUrl} name={item.businessName} size={40} />
                  <View style={styles.queueText}>
                    <Text style={styles.queueName}>{item.businessName}</Text>
                    <Text style={styles.queueStatus}>Väntar på svar</Text>
                  </View>
                  <Text style={styles.queueAmount}>{formatSek(item.budgetPerCreator)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.emptyCard}>
          <Text style={styles.emptySubtitle}>Få fler kort att svepa på</Text>
          <Text style={styles.emptyText}>
            Nya kampanjer läggs upp löpande, oftast i början av veckan. Lägg gärna till fler
            nischer i din profil under tiden.
          </Text>
          <View style={styles.emptyActions}>
            <Button label="Leta igen" onPress={onRefresh} />
            <Button
              label="Ändra mina nischer"
              variant="secondary"
              onPress={() => router.push('/onboarding/influencer')}
            />
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  emptyBody: { flex: 1, paddingHorizontal: spacing.base, gap: 14 },
  emptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 22,
    gap: 14,
  },
  emptyTitle: { ...type.sectionTitle, color: colors.text },
  emptySubtitle: { ...type.rowTitle, color: colors.text },
  emptyText: { ...type.bodySmall, color: colors.muted },
  queue: { gap: 10 },
  queueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.raised,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  queueText: { flex: 1 },
  queueName: { ...type.listTitle, color: colors.text },
  queueStatus: { ...type.secondary, color: colors.muted },
  queueAmount: { fontFamily: type.rowTitle.fontFamily, fontSize: 15, color: colors.accent },
  emptyActions: { gap: 10 },
});
