import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { DemoBanner } from '../../src/components/DemoBanner';
import { LinkIcon, SignOutIcon, StarIcon, UserIcon } from '../../src/components/icons';
import {
  Avatar,
  Card,
  Loading,
  MenuGroup,
  MenuRow,
  Rating,
  ScrollScreen,
  StatBox,
} from '../../src/components/ui';
import { formatFollowers, formatPercent } from '../../src/format';
import { colors, spacing, type } from '../../src/theme';
import type { InfluencerProfile, ProfileReviews } from '../../src/types';

/**
 * Kreatörens startsida för allt som rör hen själv.
 *
 * Tidigare låg profil, sociala konton och utloggning inklämda längst ned i
 * plånboken. Här är de en egen flik: överst det restaurangen ser om en –
 * betyg, räckvidd, uppvisat innehåll – och därunder allt som går att ändra.
 */
export default function InfluencerProfileTab() {
  const { user, signOut } = useAuth();

  const profile = useQuery({
    queryKey: ['influencer', user?.profileId],
    queryFn: () => api.get<InfluencerProfile>(`/influencers/${user?.profileId}`),
    enabled: Boolean(user?.profileId),
  });

  const reviews = useQuery({
    queryKey: ['profile-reviews', 'INFLUENCER', user?.profileId],
    queryFn: () => api.get<ProfileReviews>(`/influencers/${user?.profileId}/reviews`),
    enabled: Boolean(user?.profileId),
  });

  const data = profile.data;
  const summary = reviews.data?.summary;

  return (
    <ScrollScreen contentStyle={styles.content}>
      {profile.isLoading ? <Loading /> : null}

      {data ? (
        <Card>
          <View style={styles.identity}>
            <Avatar uri={data.avatarUrl} name={data.displayName} size={56} />
            <View style={styles.identityText}>
              <Text style={styles.name}>{data.displayName}</Text>
              <Text style={styles.secondary}>{data.city}</Text>
              {summary && summary.count > 0 ? (
                <Rating summary={summary} size={12} />
              ) : (
                <Text style={styles.secondary}>Inga omdömen än</Text>
              )}
            </View>
          </View>

          <View style={styles.statRow}>
            <StatBox label="FÖLJARE" value={formatFollowers(data.followers)} />
            <StatBox label="SNITTVISN." value={formatFollowers(data.avgViews)} />
            <StatBox
              label="ENGAGEMANG"
              value={formatPercent(data.engagementRate)}
              tone="positive"
            />
          </View>
        </Card>
      ) : null}

      <MenuGroup>
        <MenuRow
          icon={<UserIcon size={20} color={colors.primary} />}
          label="Redigera profil"
          onPress={() => router.push('/profile/edit')}
        />
        <MenuRow
          icon={<LinkIcon size={20} color={colors.primary} />}
          label="Sociala konton"
          hint={data ? `${data.socialAccounts.length} av 3` : undefined}
          onPress={() => router.push('/social')}
        />
        <MenuRow
          icon={<StarIcon size={20} variant="empty" color={colors.primary} />}
          label="Omdömen"
          hint={summary && summary.count > 0 ? String(summary.count) : undefined}
          onPress={() =>
            router.push({
              pathname: '/reviews/[type]/[id]',
              params: { type: 'influencer', id: user?.profileId ?? '', name: data?.displayName ?? '' },
            })
          }
        />
      </MenuGroup>

      <MenuGroup>
        <MenuRow
          icon={<SignOutIcon size={20} color={colors.danger} />}
          label="Logga ut"
          tone="danger"
          onPress={() => void signOut()}
        />
      </MenuGroup>

      <DemoBanner />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  secondary: { ...type.secondary, color: colors.muted },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityText: { flex: 1, gap: 2 },
  name: { ...type.sectionTitle, color: colors.text },
  statRow: { flexDirection: 'row', gap: spacing.sm },
});
