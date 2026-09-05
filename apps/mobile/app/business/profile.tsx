import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { useAuth } from '../../src/auth';
import { DemoBanner } from '../../src/components/DemoBanner';
import { SignOutIcon, StarIcon, UserIcon } from '../../src/components/icons';
import {
  Card,
  Loading,
  Logo,
  MenuGroup,
  MenuRow,
  Rating,
  ScrollScreen,
} from '../../src/components/ui';
import { colors, spacing, type } from '../../src/theme';
import type { OwnBusinessProfile, ProfileReviews } from '../../src/types';

/** Företagets motsvarighet till kreatörernas profilflik. */
export default function BusinessProfileTab() {
  const { signOut } = useAuth();

  const profile = useQuery({
    queryKey: ['own-business'],
    queryFn: () => api.get<OwnBusinessProfile>('/me/business-profile'),
  });

  const data = profile.data;

  const reviews = useQuery({
    queryKey: ['profile-reviews', 'BUSINESS', data?.id],
    queryFn: () => api.get<ProfileReviews>(`/businesses/${data?.id}/reviews`),
    enabled: Boolean(data?.id),
  });

  const summary = reviews.data?.summary;

  return (
    <ScrollScreen contentStyle={styles.content}>
      {profile.isLoading ? <Loading /> : null}

      {data ? (
        <Card>
          <View style={styles.identity}>
            <Logo uri={data.logoUrl} name={data.companyName} size={56} />
            <View style={styles.identityText}>
              <Text style={styles.name}>{data.companyName}</Text>
              <Text style={styles.secondary}>{data.city}</Text>
              {summary && summary.count > 0 ? (
                <Rating summary={summary} size={12} />
              ) : (
                <Text style={styles.secondary}>Inga omdömen än</Text>
              )}
            </View>
          </View>
        </Card>
      ) : null}

      <MenuGroup>
        <MenuRow
          icon={<UserIcon size={20} color={colors.primary} />}
          label="Redigera företagsprofil"
          onPress={() => router.push('/profile/business')}
        />
        <MenuRow
          icon={<StarIcon size={20} variant="empty" color={colors.primary} />}
          label="Omdömen"
          hint={summary && summary.count > 0 ? String(summary.count) : undefined}
          onPress={() =>
            router.push({
              pathname: '/reviews/[type]/[id]',
              params: { type: 'business', id: data?.id ?? '', name: data?.companyName ?? '' },
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
});
