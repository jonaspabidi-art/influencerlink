import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { formatSek } from '../format';
import { colors, radius, spacing, type } from '../theme';
import type { Campaign, SwipeResult } from '../types';
import { CheckIcon, PlusIcon } from './icons';
import { Body, Button, Card, Label } from './ui';

/**
 * Bjuder in en kreatör till en av restaurangens kampanjer.
 *
 * Ett högersvep, fast från profilen i stället för kortleken. Utan det här var
 * Upptäck en katalog man inte kunde handla ur: man hittade rätt person och
 * kunde sedan ingenting göra åt det.
 */
export function InviteToCampaign({
  influencerId,
  displayName,
}: {
  influencerId: string;
  displayName: string;
}) {
  const [open, setOpen] = useState(false);
  const [invited, setInvited] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const campaigns = useQuery({
    queryKey: ['campaigns', 'mine', 'ACTIVE'],
    queryFn: () => api.get<Campaign[]>('/campaigns/mine?status=ACTIVE'),
  });

  const invite = useMutation({
    mutationFn: (campaignId: string) =>
      api.post<SwipeResult>('/swipes', { campaignId, influencerId, direction: 'LIKE' }),
    onSuccess: (result, campaignId) => {
      setInvited((current) => [...current, campaignId]);
      // Har kreatören redan visat intresse för kampanjen uppstår matchningen
      // direkt, och då är chatten det enda rimliga nästa steget.
      if (result.match) router.push(`/match/${result.match.id}`);
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Inbjudan gick inte fram.'),
  });

  const active = campaigns.data ?? [];

  if (!open) {
    return (
      <Button
        label="Bjud in till kampanj"
        icon={<PlusIcon size={18} color={colors.ink} />}
        onPress={() => {
          setError(null);
          setOpen(true);
        }}
      />
    );
  }

  return (
    <Card>
      <Label>BJUD IN {displayName.toUpperCase()}</Label>

      {campaigns.isLoading ? <Body>Hämtar dina kampanjer …</Body> : null}

      {campaigns.isSuccess && active.length === 0 ? (
        <>
          <Body>
            Du har ingen publicerad kampanj än. Skapa en först – den beskriver vad du vill ha gjort
            och vad du betalar.
          </Body>
          <Button label="Skapa samarbete" onPress={() => router.push('/campaign/new')} />
        </>
      ) : null}

      {active.map((campaign) => {
        const done = invited.includes(campaign.id);
        return (
          <Pressable
            key={campaign.id}
            accessibilityRole="button"
            accessibilityState={{ disabled: done }}
            accessibilityLabel={`Bjud in till ${campaign.title}`}
            disabled={done || invite.isPending}
            onPress={() => {
              setError(null);
              invite.mutate(campaign.id);
            }}
            style={({ pressed }) => [styles.row, done && styles.rowDone, pressed && styles.pressed]}
          >
            <View style={styles.rowText}>
              <Text style={styles.title} numberOfLines={1}>
                {campaign.title}
              </Text>
              <Text style={styles.meta}>
                {formatSek(campaign.budgetPerCreator)} ·{' '}
                {campaign.slots - campaign.slotsFilled} lediga platser
              </Text>
            </View>
            {done ? <CheckIcon size={18} color={colors.positive} /> : null}
          </Pressable>
        );
      })}

      {invited.length > 0 ? (
        <Body>
          Inbjudan är skickad. Tackar {displayName} ja uppstår en matchning och ni kan börja komma
          överens.
        </Body>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Stäng" variant="secondary" onPress={() => setOpen(false)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.raised,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  rowDone: { opacity: 0.6 },
  pressed: { opacity: 0.75 },
  rowText: { flex: 1, gap: 2 },
  title: { ...type.listTitle, color: colors.text },
  meta: { ...type.secondary, color: colors.muted },
  error: { ...type.secondary, color: colors.danger },
});
