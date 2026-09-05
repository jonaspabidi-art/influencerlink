import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { InviteToCampaign } from '../../src/components/InviteToCampaign';
import { GridIcon } from '../../src/components/icons';
import {
  Avatar,
  Body,
  Card,
  ErrorState,
  Header,
  Label,
  Loading,
  Photo,
  Rating,
  ScrollScreen,
  StatBox,
  Tag,
} from '../../src/components/ui';
import {
  CATEGORY_LABELS,
  PLATFORM_LABELS,
  formatFollowers,
  formatPercent,
  formatSek,
} from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { InfluencerProfile, ProfileReviews } from '../../src/types';

/**
 * Kreatörens profil, så som en restaurang ser den.
 *
 * Kortet i kortleken är ett snabbt intryck. Här ligger hela underlaget för
 * beslutet: räckvidden, betyget, priset och framför allt innehållet – det är
 * det man vill se innan man betalar någon för att göra mer av det.
 */
export default function CreatorProfile() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const profile = useQuery({
    queryKey: ['influencer', id],
    queryFn: () => api.get<InfluencerProfile>(`/influencers/${id}`),
    enabled: Boolean(id),
  });

  const reviews = useQuery({
    queryKey: ['profile-reviews', 'INFLUENCER', id],
    queryFn: () => api.get<ProfileReviews>(`/influencers/${id}/reviews`),
    enabled: Boolean(id),
  });

  const data = profile.data;
  const summary = reviews.data?.summary;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title={data?.displayName ?? name ?? 'Kreatör'} onBack={() => router.back()} />

      {profile.isLoading ? <Loading /> : null}
      {profile.isError ? (
        <ErrorState message="Kunde inte hämta profilen." onRetry={() => void profile.refetch()} />
      ) : null}

      {data ? (
        <>
          <Card>
            <View style={styles.identity}>
              <Avatar uri={data.avatarUrl} name={data.displayName} size={64} />
              <View style={styles.identityText}>
                <Text style={styles.name}>{data.displayName}</Text>
                <Text style={styles.secondary}>{data.city}</Text>
                {summary && summary.count > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Läs omdömena"
                    onPress={() =>
                      router.push({
                        pathname: '/reviews/[type]/[id]',
                        params: { type: 'influencer', id: String(id), name: data.displayName },
                      })
                    }
                  >
                    <Rating summary={summary} size={12} />
                  </Pressable>
                ) : (
                  <Text style={styles.secondary}>Inga omdömen än</Text>
                )}
              </View>
            </View>

            {data.bio ? <Body>{data.bio}</Body> : null}

            <View style={styles.tagRow}>
              {data.categories.map((category) => (
                <Tag key={category} label={CATEGORY_LABELS[category] ?? category} />
              ))}
            </View>
          </Card>

          {/* Utan det här går profilen inte att göra något med. */}
          {user?.role === 'BUSINESS' ? (
            <InviteToCampaign influencerId={String(id)} displayName={data.displayName} />
          ) : null}

          <View style={styles.statRow}>
            <StatBox label="FÖLJARE" value={formatFollowers(data.followers)} />
            <StatBox label="SNITTVISN." value={formatFollowers(data.avgViews)} />
            <StatBox label="ENGAGEMANG" value={formatPercent(data.engagementRate)} tone="positive" />
          </View>

          <Card>
            <Label>RIKTPRIS</Label>
            <Text style={styles.price}>{formatSek(data.priceTarget)}</Text>
            <Text style={styles.secondary}>
              Lägsta arvode {formatSek(data.priceMin)} ·{' '}
              {data.platforms.map((platform) => PLATFORM_LABELS[platform]).join(', ')}
            </Text>
          </Card>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <GridIcon size={18} color={colors.muted} />
              <Text style={styles.sectionTitle}>Innehåll</Text>
            </View>

            {data.showcase.length === 0 ? (
              <Body>Kreatören har inte valt ut något innehåll att visa upp än.</Body>
            ) : (
              <View style={styles.grid}>
                {data.showcase.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="link"
                    accessibilityLabel={item.title || `Öppna inlägget på ${PLATFORM_LABELS[item.platform]}`}
                    onPress={() => void Linking.openURL(item.url)}
                    style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                  >
                    <Photo uri={item.thumbnailUrl} name={item.title || data.displayName} style={styles.tilePhoto} />
                    <View style={styles.tileFooter}>
                      {/*
                        Visningarna är det restaurangen jämför med. Saknas de –
                        en inklistrad länk, där plattformen inte lämnar ut
                        siffran – står plattformen kvar i stället.
                      */}
                      {item.views === null ? (
                        <Text style={styles.tileLabel} numberOfLines={1}>
                          {PLATFORM_LABELS[item.platform]}
                        </Text>
                      ) : (
                        <Text style={styles.tileViews} numberOfLines={1}>
                          {formatFollowers(item.views)} visningar
                        </Text>
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: spacing.md },
  secondary: { ...type.secondary, color: colors.muted },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityText: { flex: 1, gap: 2 },
  name: { ...type.sectionTitle, color: colors.text },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  price: { ...type.amountHero, color: colors.accent },

  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...type.sectionTitle, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '31%', borderRadius: radius.control, overflow: 'hidden' },
  tilePhoto: { aspectRatio: 9 / 16, borderRadius: radius.control },
  pressed: { opacity: 0.75 },
  tileFooter: { paddingTop: 4 },
  tileLabel: { ...type.label, color: colors.muted },
  tileViews: { fontFamily: type.listTitle.fontFamily, fontSize: 12, color: colors.text },
});
