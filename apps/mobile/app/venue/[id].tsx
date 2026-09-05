import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import { GridIcon } from '../../src/components/icons';
import {
  Body,
  Card,
  ErrorState,
  Header,
  Label,
  Loading,
  Logo,
  Rating,
  ScrollScreen,
  Tag,
} from '../../src/components/ui';
import { CATEGORY_LABELS, describeCompensation, formatSek } from '../../src/format';
import { resolveMediaUrl } from '../../src/media';
import { colors, radius, spacing, type } from '../../src/theme';
import type { ProfileReviews, VenueProfile } from '../../src/types';

/**
 * Företaget, så som kreatören ser det.
 *
 * Motsvarigheten till kreatörsprofilen. Kreatören ser annars bara en rubrik
 * och en logotyp, och ska ändå avgöra om uppdraget är värt en dag av hennes tid.
 * Här finns lokalen, vad de sagt om sig själva, vad andra tyckt om att jobba
 * med dem, och vad de söker just nu.
 */
export default function VenueProfileScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();

  const venue = useQuery({
    queryKey: ['venue', id],
    queryFn: () => api.get<VenueProfile>(`/businesses/${id}`),
    enabled: Boolean(id),
  });

  const reviews = useQuery({
    queryKey: ['profile-reviews', 'BUSINESS', id],
    queryFn: () => api.get<ProfileReviews>(`/businesses/${id}/reviews`),
    enabled: Boolean(id),
  });

  const data = venue.data;
  const summary = reviews.data?.summary;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title={data?.companyName ?? name ?? 'Företag'} onBack={() => router.back()} />

      {venue.isLoading ? <Loading /> : null}
      {venue.isError ? (
        <ErrorState message="Kunde inte hämta företaget." onRetry={() => void venue.refetch()} />
      ) : null}

      {data ? (
        <>
          <Card>
            <View style={styles.identity}>
              <Logo uri={data.logoUrl} name={data.companyName} size={64} />
              <View style={styles.identityText}>
                <Text style={styles.name}>{data.companyName}</Text>
                <Text style={styles.secondary}>{data.address || data.city}</Text>
                {summary && summary.count > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Läs omdömena"
                    onPress={() =>
                      router.push({
                        pathname: '/reviews/[type]/[id]',
                        params: { type: 'business', id: String(id), name: data.companyName },
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

            {data.description ? <Body>{data.description}</Body> : null}

            <View style={styles.tagRow}>
              {data.categories.map((category) => (
                <Tag key={category} label={CATEGORY_LABELS[category] ?? category} />
              ))}
            </View>
          </Card>

          {data.photos.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <GridIcon size={18} color={colors.muted} />
                <Text style={styles.sectionTitle}>Bilder</Text>
              </View>
              {/* I sidled: bilderna får vara stora nog att säga något. */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photoRow}
              >
                {data.photos.map((photo) => (
                  <Image
                    key={photo}
                    source={{ uri: resolveMediaUrl(photo) ?? undefined }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <View style={styles.section}>
            <Label>SÖKER JUST NU</Label>
            {data.openCampaigns.length === 0 ? (
              <Body>Inga publicerade samarbeten just nu.</Body>
            ) : (
              data.openCampaigns.map((campaign) => (
                <Pressable
                  key={campaign.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Öppna ${campaign.title}`}
                  onPress={() => router.push(`/campaign/${campaign.id}`)}
                  style={({ pressed }) => [styles.campaign, pressed && styles.pressed]}
                >
                  <Text style={styles.campaignTitle} numberOfLines={1}>
                    {campaign.title}
                  </Text>
                  <Text style={styles.campaignAmount}>
                    {describeCompensation(
                      campaign.compensationType,
                      campaign.budgetPerCreator,
                      campaign.productValue,
                      formatSek,
                    )}
                  </Text>
                </Pressable>
              ))
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

  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...type.sectionTitle, color: colors.text },
  photoRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.base },
  photo: { width: 220, height: 165, borderRadius: radius.card, backgroundColor: colors.photo },

  campaign: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: spacing.md,
    gap: 2,
  },
  pressed: { opacity: 0.8 },
  campaignTitle: { ...type.listTitle, color: colors.text },
  campaignAmount: { ...type.secondary, color: colors.accent },
});
