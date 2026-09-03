import { Ionicons } from '@expo/vector-icons';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Category, DeliverableKind, Platform } from '@influencerlink/shared';
import {
  CATEGORY_LABELS,
  DELIVERABLE_LABELS,
  PLATFORM_LABELS,
  describeCompensation,
  formatDate,
  formatFollowers,
  formatPercent,
  formatSek,
} from '../format';
import { colors, radius, spacing, typography } from '../theme';
import type { CampaignCard, InfluencerCard } from '../types';
import { Chip, ScoreBadge } from './ui';

const PLATFORM_ICONS: Record<Platform, keyof typeof Ionicons.glyphMap> = {
  TIKTOK: 'musical-notes',
  INSTAGRAM: 'logo-instagram',
  YOUTUBE: 'logo-youtube',
};

/** Kampanjkortet som influencern swipar på. */
export function CampaignSwipeCard({ card }: { card: CampaignCard }) {
  const { campaign } = card;
  const spotsLeft = Math.max(0, campaign.slots - campaign.slotsFilled);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {campaign.businessLogoUrl ? (
          <Image source={{ uri: campaign.businessLogoUrl }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Ionicons name="restaurant" size={22} color={colors.accent} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.businessName}>{campaign.businessName}</Text>
          <Text style={styles.location}>
            {campaign.city} · {spotsLeft} {spotsLeft === 1 ? 'plats kvar' : 'platser kvar'}
          </Text>
        </View>
        <ScoreBadge score={card.score} aiReviewed={card.aiReviewed} />
      </View>

      <Text style={styles.title}>{campaign.title}</Text>

      <View style={styles.payRow}>
        <Ionicons name="wallet-outline" size={18} color={colors.accent} />
        <Text style={styles.pay}>
          {describeCompensation(
            campaign.compensationType,
            campaign.budgetPerCreator,
            campaign.productValue,
            formatSek,
          )}
        </Text>
      </View>

      <View style={styles.reasonBox}>
        {card.aiReviewed ? <Ionicons name="sparkles" size={14} color={colors.accent} /> : null}
        <Text style={styles.reason}>{card.reason}</Text>
      </View>

      <ScrollView style={styles.brief} contentContainerStyle={styles.briefContent}>
        <Text style={styles.briefText}>{campaign.brief}</Text>
      </ScrollView>

      <View style={styles.chipRow}>
        {campaign.deliverables.map((deliverable: DeliverableKind) => (
          <Chip key={deliverable} label={DELIVERABLE_LABELS[deliverable]} />
        ))}
      </View>

      <View style={styles.footer}>
        <View style={styles.platformRow}>
          {campaign.platforms.map((platform: Platform) => (
            <Ionicons
              key={platform}
              name={PLATFORM_ICONS[platform]}
              size={18}
              color={colors.textMuted}
            />
          ))}
        </View>
        <Text style={styles.footerText}>Ansök senast {formatDate(campaign.endDate)}</Text>
      </View>
    </View>
  );
}

/** Influencerkortet som restaurangen swipar på. */
export function InfluencerSwipeCard({ card }: { card: InfluencerCard }) {
  const { influencer } = card;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {influencer.avatarUrl ? (
          <Image source={{ uri: influencer.avatarUrl }} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Ionicons name="person" size={22} color={colors.accent} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.businessName}>{influencer.displayName}</Text>
          <Text style={styles.location}>{influencer.city}</Text>
        </View>
        <ScoreBadge score={card.score} aiReviewed={card.aiReviewed} />
      </View>

      <View style={styles.statRow}>
        <Stat label="Följare" value={formatFollowers(influencer.followers)} />
        <Stat label="Snittvisningar" value={formatFollowers(influencer.avgViews)} />
        <Stat label="Engagemang" value={formatPercent(influencer.engagementRate)} />
      </View>

      <View style={styles.reasonBox}>
        {card.aiReviewed ? <Ionicons name="sparkles" size={14} color={colors.accent} /> : null}
        <Text style={styles.reason}>{card.reason}</Text>
      </View>

      <ScrollView style={styles.brief} contentContainerStyle={styles.briefContent}>
        <Text style={styles.briefText}>{influencer.bio}</Text>
      </ScrollView>

      <View style={styles.chipRow}>
        {influencer.categories.map((category) => (
          <Chip key={category} label={CATEGORY_LABELS[category as Category] ?? category} />
        ))}
      </View>

      <View style={styles.footer}>
        <View style={styles.platformRow}>
          {influencer.platforms.map((platform) => (
            <Text key={platform} style={styles.footerText}>
              {PLATFORM_LABELS[platform as Platform] ?? platform}
            </Text>
          ))}
        </View>
        <Text style={styles.footerText}>Riktpris {formatSek(influencer.priceTarget)}</Text>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: spacing.md, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerText: { flex: 1 },
  logo: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceRaised },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  businessName: { ...typography.label, color: colors.text, fontSize: 15 },
  location: { ...typography.caption, color: colors.textMuted },
  title: { ...typography.title, color: colors.text, fontSize: 24 },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pay: { ...typography.heading, color: colors.accent, fontSize: 17 },
  reasonBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  reason: { ...typography.caption, color: colors.text, flex: 1, lineHeight: 17 },
  brief: { flex: 1 },
  briefContent: { paddingVertical: spacing.xs },
  briefText: { ...typography.body, color: colors.textMuted, lineHeight: 21 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  platformRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  footerText: { ...typography.caption, color: colors.textMuted },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  statValue: { ...typography.heading, color: colors.text, fontSize: 17 },
  statLabel: { ...typography.caption, color: colors.textMuted },
});
