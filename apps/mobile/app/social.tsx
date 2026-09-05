import { PLATFORMS, recogniseLink, type Platform } from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform as RNPlatform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { api, ApiError } from '../src/api';
import { useAuth } from '../src/auth';
import { CheckIcon, CloseIcon, PlusIcon } from '../src/components/icons';
import {
  Body,
  Button,
  Card,
  Field,
  Header,
  Label,
  Loading,
  Photo,
  ScrollScreen,
} from '../src/components/ui';
import { formatFollowers, PLATFORM_LABELS } from '../src/format';
import { colors, radius, spacing, type } from '../src/theme';
import type { InfluencerProfile, ShowcaseItem, SocialAccount } from '../src/types';

/**
 * Sociala konton och uppvisat innehåll.
 *
 * Kopplingen är ännu inte OAuth mot plattformarna – kreatören anger sitt
 * användarnamn och klistrar in länkar till inlägg hon vill visa upp. När
 * TikToks och Metas API:er är godkända byts anslutningsraden mot en riktig
 * inloggning, medan resten av skärmen kan stå kvar som den är.
 */
export default function SocialAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  // Länkfelet visas i länkkortet, inte högst upp – annars hamnar det utanför
  // skärmen när man just tryckt på Lägg till.
  const [linkError, setLinkError] = useState<string | null>(null);
  const [handles, setHandles] = useState<Partial<Record<Platform, string>>>({});
  const [linkInput, setLinkInput] = useState('');

  const profile = useQuery({
    queryKey: ['influencer', user?.profileId],
    queryFn: () => api.get<InfluencerProfile>(`/influencers/${user?.profileId}`),
    enabled: Boolean(user?.profileId),
  });

  const showcase = useQuery({
    queryKey: ['showcase'],
    queryFn: () => api.get<ShowcaseItem[]>('/me/influencer-profile/showcase'),
  });

  const fail = (caught: unknown, fallback: string) =>
    setError(caught instanceof ApiError ? caught.message : fallback);

  const failLink = (caught: unknown, fallback: string) =>
    setLinkError(caught instanceof ApiError ? caught.message : fallback);

  const connect = useMutation({
    mutationFn: (input: { platform: Platform; handle: string }) =>
      api.post<SocialAccount>('/me/influencer-profile/socials', input),
    onSuccess: (_account, input) => {
      setHandles((current) => ({ ...current, [input.platform]: '' }));
      void profile.refetch();
    },
    onError: (caught) => fail(caught, 'Kunde inte koppla kontot.'),
  });

  /**
   * TikTok-inloggningen. Servern bygger adressen – klientnyckeln ska aldrig
   * ligga i appen – och vi skickar kreatören dit.
   */
  const startTikTok = useMutation({
    mutationFn: () =>
      api.post<{ url: string; state: string }>(
        '/me/influencer-profile/socials/tiktok/authorize',
      ),
    onSuccess: async ({ url }) => {
      if (RNPlatform.OS === 'web') {
        // Hel omdirigering i stället för ett fönster som blockeras av
        // webbläsaren. State ligger i adressen och överlever hoppet.
        window.location.assign(url);
        return;
      }
      await WebBrowser.openAuthSessionAsync(url);
    },
    onError: (caught) => fail(caught, 'Kunde inte starta inloggningen hos TikTok.'),
  });

  const disconnect = useMutation({
    mutationFn: (id: string) => api.del(`/me/influencer-profile/socials/${id}`),
    onSuccess: () => void profile.refetch(),
    onError: (caught) => fail(caught, 'Kunde inte koppla bort kontot.'),
  });

  const addLink = useMutation({
    mutationFn: (url: string) => api.post<ShowcaseItem>('/me/influencer-profile/showcase', { url }),
    onSuccess: () => {
      setLinkInput('');
      void queryClient.invalidateQueries({ queryKey: ['showcase'] });
    },
    onError: (caught) => failLink(caught, 'Kunde inte spara länken.'),
  });

  const removeLink = useMutation({
    mutationFn: (id: string) => api.del(`/me/influencer-profile/showcase/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['showcase'] }),
    onError: (caught) => failLink(caught, 'Kunde inte ta bort inlägget.'),
  });

  const submitLink = () => {
    setLinkError(null);
    // Vi känner igen länken redan här, så felet syns direkt i stället för
    // efter en tur till servern.
    if (!recogniseLink(linkInput)) {
      return setLinkError('Klistra in en länk till ett inlägg på TikTok, Instagram eller YouTube.');
    }
    addLink.mutate(linkInput.trim());
  };

  if (profile.isLoading) {
    return (
      <ScrollScreen>
        <Header title="Sociala konton" onBack={() => router.back()} />
        <Loading />
      </ScrollScreen>
    );
  }

  const accounts = profile.data?.socialAccounts ?? [];
  const items = showcase.data ?? [];

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title="Sociala konton"
        subtitle="Restauranger ser räckvidden och innehållet du visar upp."
        onBack={() => router.back()}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {PLATFORMS.map((platform) => {
        const account = accounts.find((item) => item.platform === platform);
        const draft = handles[platform] ?? '';
        return (
          <Card key={platform}>
            <View style={styles.accountRow}>
              <View style={styles.accountText}>
                <Text style={styles.accountTitle}>{PLATFORM_LABELS[platform]}</Text>
                {account ? (
                  <>
                    <Text style={styles.connected}>
                      @{account.handle} · {formatFollowers(account.followers)} följare
                    </Text>
                    <Text style={styles.secondary}>
                      {account.statsSource === 'PLATFORM'
                        ? `${formatFollowers(account.avgViews)} visningar i snitt${
                            account.sampleSize ? ` på senaste ${account.sampleSize}` : ''
                          } · hämtat från ${PLATFORM_LABELS[platform]}`
                        : 'Siffrorna är ogranskade tills kontot kopplas med inloggning'}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.secondary}>Inte kopplat</Text>
                )}
              </View>
              {account ? <CheckIcon size={18} color={colors.positive} /> : null}
            </View>

            {account ? (
              <Button
                label="Koppla bort"
                variant="secondary"
                onPress={() => {
                  setError(null);
                  disconnect.mutate(account.id);
                }}
              />
            ) : platform === 'TIKTOK' ? (
              <>
                <Body>
                  Du loggar in hos TikTok. Vi läser ditt följarantal och visningarna på dina
                  senaste videor – vi kan inte publicera något åt dig.
                </Body>
                <Button
                  label="Logga in med TikTok"
                  onPress={() => {
                    setError(null);
                    startTikTok.mutate();
                  }}
                  loading={startTikTok.isPending}
                />
              </>
            ) : (
              <>
                <Field
                  label="Användarnamn"
                  value={draft}
                  onChangeText={(value) =>
                    setHandles((current) => ({ ...current, [platform]: value }))
                  }
                  placeholder="dittnamn"
                />
                <Button
                  label={`Koppla ${PLATFORM_LABELS[platform]}`}
                  onPress={() => {
                    setError(null);
                    const handle = draft.trim().replace(/^@/, '');
                    if (handle.length < 2) return setError('Ange ditt användarnamn.');
                    connect.mutate({ platform, handle });
                  }}
                  loading={connect.isPending}
                />
              </>
            )}
          </Card>
        );
      })}

      <View style={styles.section}>
        <Label>DITT INNEHÅLL</Label>
        <Body>
          Klistra in länkar till inlägg du är stolt över. De visas på ditt kort när restauranger
          swipar.
        </Body>

        <Card>
          <Field
            label="Länk till inlägg"
            value={linkInput}
            onChangeText={setLinkInput}
            placeholder="https://www.tiktok.com/@dittnamn/video/..."
          />
          <Button
            label="Lägg till"
            onPress={submitLink}
            loading={addLink.isPending}
            icon={<PlusIcon size={16} color={colors.ink} />}
          />
          {linkError ? <Text style={styles.error}>{linkError}</Text> : null}
        </Card>

        {items.length === 0 ? (
          <Text style={styles.secondary}>Inga inlägg än.</Text>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={item.title || 'Öppna inlägget'}
                onPress={() => void Linking.openURL(item.url)}
                style={styles.itemPress}
              >
                <Photo uri={item.thumbnailUrl} style={styles.thumb}>
                  {item.thumbnailUrl ? null : (
                    <Text style={styles.thumbFallback}>
                      {PLATFORM_LABELS[item.platform].slice(0, 2).toUpperCase()}
                    </Text>
                  )}
                </Photo>
                <View style={styles.itemText}>
                  <Text style={styles.itemTitle} numberOfLines={2}>
                    {item.title || item.url}
                  </Text>
                  <Text style={styles.secondary}>{PLATFORM_LABELS[item.platform]}</Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ta bort inlägget"
                onPress={() => {
                  setLinkError(null);
                  removeLink.mutate(item.id);
                }}
                style={styles.remove}
              >
                <CloseIcon size={16} color={colors.muted} />
              </Pressable>
            </View>
          ))
        )}
      </View>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  secondary: { ...type.secondary, color: colors.muted },
  error: { ...type.secondary, color: colors.danger },

  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  accountText: { flex: 1, gap: 2 },
  accountTitle: { ...type.listTitle, color: colors.text },
  connected: { ...type.secondary, color: colors.positive },

  section: { gap: spacing.sm },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: spacing.sm,
  },
  itemPress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 48, height: 64, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  thumbFallback: { ...type.label, color: colors.muted },
  itemText: { flex: 1, gap: 2 },
  itemTitle: { ...type.listTitle, color: colors.text },
  remove: { padding: spacing.sm },
});
