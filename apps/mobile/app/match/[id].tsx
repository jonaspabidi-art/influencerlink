import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import {
  Body,
  Button,
  Card,
  Field,
  Header,
  Loading,
  Rating,
  Screen,
} from '../../src/components/ui';
import { formatSek, kronorToOre, oreToKronor } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { Campaign, ChatMessage, Contract, Match } from '../../src/types';

/** Meddelanden hämtas om regelbundet – tillräckligt för ett fåtal rader. */
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
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
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
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte skapa avtalet.'),
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
    <Screen avoidKeyboard>
      <Header
        title={counterpart}
        subtitle={`${match.campaign.title} · ${Math.round(match.matchScore)} % match`}
        onBack={() => router.back()}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Omdömen om ${counterpart}`}
        onPress={() =>
          router.push({
            pathname: '/reviews/[type]/[id]',
            params: {
              type: isBusiness ? 'influencer' : 'business',
              id: isBusiness ? match.influencer.id : match.campaign.businessId,
              name: counterpart,
            },
          })
        }
        style={({ pressed }) => [styles.reviewLink, pressed && styles.pressed]}
      >
        <Rating
          summary={match.counterpartRating}
          size={13}
          emptyLabel="Inga omdömen än"
        />
        <Text style={styles.reviewLinkLabel}>Läs omdömen</Text>
      </Pressable>

      <View style={styles.actionArea}>
        {match.contractId ? (
          <Button
            label="Öppna avtalet"
            onPress={() => router.push(`/contract/${match.contractId}`)}
          />
        ) : isBusiness ? (
          showContractForm ? (
            <Card tone="primary">
              <Text style={styles.actionTitle}>Skicka avtal</Text>
              <Body>
                Avtalet signeras med BankID av båda parter. Ni betalar in arvodet först när det är
                signerat, och pengarna går till kreatören när ni godkänt leveransen.
              </Body>
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
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button
                label="Skapa och skicka"
                onPress={() => createContract.mutate()}
                loading={createContract.isPending}
              />
              <Button
                label="Avbryt"
                variant="secondary"
                onPress={() => setShowContractForm(false)}
              />
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
          <Card tone="raised">
            <Text style={styles.hint}>
              Restaurangen skickar avtalet när ni kommit överens. Du signerar med BankID innan
              något blir bindande.
            </Text>
          </Card>
        )}
      </View>

      <FlatList
        data={messages.data ?? []}
        keyExtractor={(message) => message.id}
        contentContainerStyle={styles.messages}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          return (
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              {!mine ? <Text style={styles.sender}>{item.senderName}</Text> : null}
              <Text style={mine ? styles.messageMine : styles.messageTheirs}>{item.body}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.hint}>Skriv första meddelandet så kommer ni igång.</Text>
        }
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Skriv ett meddelande …"
          placeholderTextColor={colors.dim}
          accessibilityLabel="Meddelande"
          onSubmitEditing={() => draft.trim() && send.mutate(draft.trim())}
        />
        <Button
          label="Skicka"
          onPress={() => draft.trim() && send.mutate(draft.trim())}
          loading={send.isPending}
          disabled={draft.trim().length === 0}
          style={styles.sendButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  reviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
  },
  reviewLinkLabel: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.primary },
  pressed: { opacity: 0.9 },
  actionArea: { paddingHorizontal: spacing.base, paddingBottom: spacing.md, gap: spacing.md },
  actionTitle: { ...type.rowTitle, color: colors.text },
  hint: { ...type.bodySmall, color: colors.muted },
  error: { ...type.secondary, color: colors.danger },

  messages: { gap: spacing.sm, paddingHorizontal: spacing.base, paddingBottom: spacing.md },
  bubble: { maxWidth: '85%', borderRadius: radius.card, padding: spacing.md },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sender: { ...type.secondary, color: colors.muted, marginBottom: 2 },
  messageMine: { ...type.bodySmall, color: colors.ink },
  messageTheirs: { ...type.bodySmall, color: colors.text },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
  },
  composerInput: {
    flex: 1,
    height: 48,
    backgroundColor: colors.surface,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontFamily: type.bodySmall.fontFamily,
    fontSize: 15,
    color: colors.text,
  },
  sendButton: { paddingHorizontal: spacing.base },
});
