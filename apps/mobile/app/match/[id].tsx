import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { ChevronRightIcon } from '../../src/components/icons';
import {
  Avatar,
  Body,
  Button,
  Card,
  Field,
  Header,
  Loading,
  Logo,
  Rating,
  Screen,
  StatusBadge,
} from '../../src/components/ui';
import {
  CONTRACT_STATUS_LABELS,
  describeNextStep,
  formatSek,
  kronorToOre,
  oreToKronor,
} from '../../src/format';
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

  const contract = useQuery({
    queryKey: ['contract', match?.contractId],
    queryFn: () => api.get<Contract>(`/contracts/${match?.contractId}`),
    enabled: Boolean(match?.contractId),
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

      {/*
        En rad i stället för två. Bilden gör det tydligt vem man skriver med,
        och hela raden leder till profilen – det var två separata länkar förut,
        en till omdömena och en till profilen, och ingen av dem visade vem det
        var man pratade med.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Öppna ${counterpart}s profil`}
        onPress={() =>
          router.push(
            isBusiness
              ? {
                  pathname: '/creator/[id]',
                  params: { id: match.influencer.id, name: counterpart },
                }
              : {
                  pathname: '/venue/[id]',
                  params: { id: match.campaign.businessId, name: counterpart },
                },
          )
        }
        style={({ pressed }) => [styles.counterpart, pressed && styles.pressed]}
      >
        {isBusiness ? (
          <Avatar uri={match.influencer.avatarUrl} name={counterpart} size={44} />
        ) : (
          <Logo uri={match.campaign.businessLogoUrl} name={counterpart} size={44} />
        )}
        <View style={styles.counterpartText}>
          <Text style={styles.counterpartName}>{counterpart}</Text>
          <Rating summary={match.counterpartRating} size={12} emptyLabel="Inga omdömen än" />
        </View>
        <ChevronRightIcon size={18} color={colors.dim} />
      </Pressable>

      <View style={styles.actionArea}>
        {match.contractId ? (
          /*
            Avtalet i korthet, inte bara en knapp. Parterna pratar här och
            behöver veta var det står utan att först gå in i det.
          */
          <Card tone="raised">
            <View style={styles.contractHead}>
              <Text style={styles.actionTitle}>Avtalet</Text>
              {contract.data ? (
                <StatusBadge
                  label={CONTRACT_STATUS_LABELS[contract.data.status]}
                  tone={contract.data.status === 'COMPLETED' ? 'done' : 'active'}
                />
              ) : null}
            </View>
            {contract.data ? (
              <>
                <Text style={styles.contractAmount}>
                  {formatSek(isBusiness ? contract.data.fee : contract.data.payout)}
                  <Text style={styles.hint}>
                    {isBusiness ? ' att betala' : ' till dig efter avgift'}
                  </Text>
                </Text>
                <Text style={styles.hint}>
                  {describeNextStep(
                    contract.data.status,
                    isBusiness,
                    isBusiness
                      ? contract.data.signedByBusinessAt !== null
                      : contract.data.signedByInfluencerAt !== null,
                  )}
                </Text>
              </>
            ) : null}
            <Button
              label="Öppna avtalet"
              onPress={() => router.push(`/contract/${match.contractId}`)}
            />
          </Card>
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
              Företaget skickar avtalet när ni kommit överens. Du signerar med BankID innan
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
          if (mine) {
            return (
              <View style={[styles.bubble, styles.bubbleMine]}>
                <Text style={styles.messageMine}>{item.body}</Text>
              </View>
            );
          }
          // Bilden bredvid bubblan, inte namnet ovanför: man ser vem det är
          // utan att läsa, och det blir en rad mindre per meddelande.
          return (
            <View style={styles.theirRow}>
              {isBusiness ? (
                <Avatar uri={match.influencer.avatarUrl} name={item.senderName} size={28} />
              ) : (
                <Logo uri={match.campaign.businessLogoUrl} name={item.senderName} size={28} />
              )}
              <View style={[styles.bubble, styles.bubbleTheirs]}>
                <Text style={styles.messageTheirs}>{item.body}</Text>
              </View>
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
  counterpart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.base,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
  },
  counterpartText: { flex: 1, gap: 2 },
  contractHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contractAmount: { fontFamily: type.amountSmall.fontFamily, fontSize: 20, color: colors.text },
  counterpartName: { ...type.listTitle, color: colors.text },
  theirRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },

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
    // Minst 16 px, annars zoomar Safari på iPhone in vid fokus.
    fontSize: 16,
    color: colors.text,
  },
  sendButton: { paddingHorizontal: spacing.base },
});
