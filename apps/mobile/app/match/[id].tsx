import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import {
  Body,
  Button,
  Caption,
  Card,
  Field,
  Heading,
  Loading,
  Screen,
} from '../../src/components/ui';
import { formatSek, kronorToOre, oreToKronor } from '../../src/format';
import { colors, radius, spacing, typography } from '../../src/theme';
import type { Campaign, ChatMessage, Contract, Match } from '../../src/types';

/** Meddelanden hämtas om regelbundet – enkelt och tillräckligt för ett fåtal rader. */
const MESSAGE_POLL_MS = 5_000;
const DEFAULT_DUE_DAYS = 14;

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState('');
  const [showContractForm, setShowContractForm] = useState(false);
  const [fee, setFee] = useState('');
  const [error, setError] = useState<string | null>(null);

  const matches = useQuery({ queryKey: ['matches'], queryFn: () => api.get<Match[]>('/matches') });
  const match = matches.data?.find((item) => item.id === id);

  const campaign = useQuery({
    queryKey: ['campaign', match?.campaign.id],
    queryFn: () => api.get<Campaign>(`/campaigns/${match?.campaign.id}`),
    enabled: Boolean(match?.campaign.id),
  });

  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: () => api.get<ChatMessage[]>(`/matches/${id}/messages`),
    enabled: Boolean(id),
    refetchInterval: MESSAGE_POLL_MS,
  });

  const send = useMutation({
    mutationFn: (body: string) => api.post<ChatMessage>(`/matches/${id}/messages`, { body }),
    onSuccess: () => {
      setDraft('');
      void queryClient.invalidateQueries({ queryKey: ['messages', id] });
    },
  });

  const createContract = useMutation({
    mutationFn: () =>
      api.post<Contract>('/contracts', {
        matchId: id,
        fee: kronorToOre(Number(fee) || 0),
        deliverables: campaign.data?.deliverables ?? [],
        dueDate: new Date(Date.now() + DEFAULT_DUE_DAYS * 86_400_000).toISOString(),
        reviewDays: 7,
        extraTerms: '',
      }),
    onSuccess: (contract) => {
      void queryClient.invalidateQueries({ queryKey: ['contracts'] });
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
      router.push(`/contract/${contract.id}`);
    },
    onError: (caught) => {
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte skapa avtalet.');
    },
  });

  if (matches.isLoading || !match) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const isBusiness = user?.role === 'BUSINESS';
  const counterpart = isBusiness ? match.influencer.displayName : match.campaign.businessName;

  return (
    <Screen>
      <View style={styles.header}>
        <Heading>{counterpart}</Heading>
        <Caption>
          {match.campaign.title} · {Math.round(match.matchScore)} % match
        </Caption>
        <Body muted>{match.matchReason}</Body>
      </View>

      {match.contractId ? (
        <Button
          label="Öppna avtalet"
          icon="document-text-outline"
          onPress={() => router.push(`/contract/${match.contractId}`)}
        />
      ) : isBusiness ? (
        showContractForm ? (
          <Card>
            <Heading>Skicka avtal</Heading>
            <Caption>
              Avtalet skickas för signering med BankID. Ni betalar först när båda signerat, och
              pengarna går vidare till kreatören när ni godkänt leveransen.
            </Caption>
            <Field
              label="Arvode (kr)"
              value={fee}
              onChangeText={setFee}
              keyboardType="numeric"
              hint={
                campaign.data
                  ? `Kampanjens budget är ${formatSek(campaign.data.budgetPerCreator)}.`
                  : undefined
              }
            />
            {error ? <Body>{error}</Body> : null}
            <Button
              label="Skapa och skicka"
              onPress={() => createContract.mutate()}
              loading={createContract.isPending}
            />
            <Button label="Avbryt" variant="ghost" onPress={() => setShowContractForm(false)} />
          </Card>
        ) : (
          <Button
            label="Skicka avtal"
            onPress={() => {
              setFee(String(oreToKronor(campaign.data?.budgetPerCreator ?? 0)));
              setShowContractForm(true);
            }}
          />
        )
      ) : (
        <Card>
          <Caption>
            Restaurangen skickar avtalet när ni kommit överens. Du får signera med BankID innan
            något blir bindande.
          </Caption>
        </Card>
      )}

      <FlatList
        data={messages.data ?? []}
        keyExtractor={(message) => message.id}
        contentContainerStyle={styles.messages}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              {!mine ? <Text style={styles.sender}>{item.senderName}</Text> : null}
              <Text style={styles.messageText}>{item.body}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Caption>Skriv första meddelandet så kommer ni igång.</Caption>
        }
      />

      <View style={styles.composer}>
        <View style={styles.composerField}>
          <Field label="Meddelande" value={draft} onChangeText={setDraft} placeholder="Skriv här …" />
        </View>
        <Button
          label="Skicka"
          onPress={() => draft.trim() && send.mutate(draft.trim())}
          loading={send.isPending}
          disabled={draft.trim().length === 0}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: spacing.md, gap: 2 },
  messages: { gap: spacing.sm, paddingVertical: spacing.md },
  bubble: { maxWidth: '85%', borderRadius: radius.md, padding: spacing.sm },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceRaised },
  sender: { ...typography.caption, color: colors.textMuted, marginBottom: 2 },
  messageText: { ...typography.body, color: colors.text },
  composer: { paddingBottom: spacing.md, gap: spacing.sm },
  composerField: {},
});
