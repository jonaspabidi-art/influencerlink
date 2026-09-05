import { StyleSheet, Text, View } from 'react-native';
import type { Category, Platform } from '@pacta/shared';
import {
  CATEGORY_LABELS,
  DELIVERABLE_LABELS,
  describeCompensation,
  formatDate,
  formatFollowers,
  formatPercent,
  formatSek,
} from '../format';
import { colors, radius, spacing, type } from '../theme';
import type { CampaignCard, InfluencerCard } from '../types';
import { SparkIcon } from './icons';
import { Avatar, Logo, MatchPill, Photo, Rating, StatBox, Tag } from './ui';

/** Förkortningar i plattformsrutorna längst ned på korten. */
const PLATFORM_SHORT: Record<Platform, string> = {
  TIKTOK: 'TT',
  INSTAGRAM: 'IG',
  YOUTUBE: 'YT',
};

const ALL_PLATFORMS: Platform[] = ['TIKTOK', 'INSTAGRAM', 'YOUTUBE'];

/**
 * Kampanjkortet i influencerns kortlek.
 *
 * Kompositionen är det viktigaste i designen: bildytan har `flex: 1` och all
 * text är intrinsisk. Kort brief ger större bild i stället för ett hål i mitten.
 */
export function CampaignSwipeCard({ card }: { card: CampaignCard }) {
  const { campaign } = card;
  const spotsLeft = Math.max(0, campaign.slots - campaign.slotsFilled);

  return (
    <View style={styles.card}>
      <Photo uri={campaign.businessLogoUrl} style={styles.photo}>
        <View style={styles.pillSlot}>
          <MatchPill
            score={card.score}
            icon={card.aiReviewed ? <SparkIcon size={13} color={colors.accent} /> : undefined}
          />
        </View>
        <View style={styles.photoFooter}>
          <Logo uri={campaign.businessLogoUrl} />
          <View style={styles.photoFooterText}>
            <Text style={styles.name}>{campaign.businessName}</Text>
            <View style={styles.metaRow}>
              <Rating summary={card.rating} size={12} />
              {card.rating.count > 0 ? <Text style={styles.secondary}>·</Text> : null}
              <Text style={styles.meta} numberOfLines={1}>
                {campaign.city} · {spotsLeft} {spotsLeft === 1 ? 'ledig plats' : 'lediga platser'}
              </Text>
            </View>
          </View>
        </View>
      </Photo>

      <View style={styles.body}>
        <Text style={styles.title}>{campaign.title}</Text>

        <View style={styles.amountRow}>
          <Text style={styles.amount}>
            {campaign.compensationType === 'PRODUCT'
              ? 'Besök på huset'
              : formatSek(campaign.budgetPerCreator)}
          </Text>
          {campaign.compensationType !== 'FIXED' ? (
            <Text style={styles.amountSuffix}>+ besök ({formatSek(campaign.productValue)})</Text>
          ) : null}
        </View>

        <View style={styles.reasonRow}>
          <View style={styles.dot} />
          <Text style={styles.reason} numberOfLines={2}>
            {card.reason}
          </Text>
        </View>

        <Text style={styles.brief} numberOfLines={4}>
          {campaign.brief}
        </Text>

        <View style={styles.tagRow}>
          {campaign.deliverables.slice(0, 3).map((deliverable) => (
            <Tag key={deliverable} label={DELIVERABLE_LABELS[deliverable]} />
          ))}
        </View>
      </View>

      <View style={styles.cardFooter}>
        <PlatformRow active={campaign.platforms} />
        <Text style={styles.secondary}>Sista ansökan {formatDate(campaign.endDate)}</Text>
      </View>
    </View>
  );
}

/** Kreatörskortet i restaurangens kortlek. Samma mekanik, andra innehåll. */
export function InfluencerSwipeCard({ card }: { card: InfluencerCard }) {
  const { influencer } = card;
  const niches = influencer.categories
    .map((category) => CATEGORY_LABELS[category as Category] ?? category)
    .slice(0, 2)
    .join(', ');

  return (
    <View style={styles.card}>
      <Photo uri={influencer.avatarUrl} style={styles.photo}>
        <View style={styles.pillSlot}>
          <MatchPill
            score={card.score}
            icon={card.aiReviewed ? <SparkIcon size={13} color={colors.accent} /> : undefined}
          />
        </View>
        <View style={styles.photoFooter}>
          <Avatar uri={influencer.avatarUrl} />
          <View style={styles.photoFooterText}>
            <Text style={styles.nameLarge}>{influencer.displayName}</Text>
            <View style={styles.metaRow}>
              <Rating summary={card.rating} size={12} />
              {card.rating.count > 0 ? <Text style={styles.secondary}>·</Text> : null}
              <Text style={styles.meta} numberOfLines={1}>
                {influencer.city}
                {niches ? ` · ${niches}` : ''}
              </Text>
            </View>
          </View>
        </View>
      </Photo>

      <View style={styles.body}>
        <View style={styles.statRow}>
          <StatBox label="FÖLJARE" value={formatFollowers(influencer.followers)} />
          <StatBox label="SNITTVISN." value={formatFollowers(influencer.avgViews)} />
          <StatBox
            label="ENGAGEMANG"
            value={formatPercent(influencer.engagementRate)}
            tone="positive"
          />
        </View>

        <View style={styles.reasonRow}>
          {card.aiReviewed ? (
            <SparkIcon size={13} color={colors.accent} />
          ) : (
            <View style={styles.dot} />
          )}
          <Text style={card.aiReviewed ? styles.reasonAi : styles.reason} numberOfLines={2}>
            {card.reason}
          </Text>
        </View>

        <Text style={styles.brief} numberOfLines={3}>
          {influencer.bio}
        </Text>

        <View style={styles.tagRow}>
          {influencer.categories.slice(0, 3).map((category) => (
            <Tag key={category} label={CATEGORY_LABELS[category as Category] ?? category} />
          ))}
        </View>
      </View>

      <View style={styles.cardFooter}>
        <PlatformRow active={influencer.platforms as Platform[]} />
        <Text style={styles.footerPrice}>
          Riktpris <Text style={styles.footerPriceValue}>{formatSek(influencer.priceTarget)}</Text>
        </Text>
      </View>
    </View>
  );
}

/** Plattformsrutor: aktiva i full opacitet, övriga dämpade. */
function PlatformRow({ active }: { active: Platform[] }) {
  return (
    <View style={styles.platformRow}>
      {ALL_PLATFORMS.filter((platform) => active.includes(platform)).map((platform) => (
        <View key={platform} style={styles.platformBox}>
          <Text style={styles.platformLabel}>{PLATFORM_SHORT[platform]}</Text>
        </View>
      ))}
      {ALL_PLATFORMS.filter((platform) => !active.includes(platform)).map((platform) => (
        <View key={platform} style={styles.platformBox}>
          <Text style={[styles.platformLabel, styles.platformLabelMuted]}>
            {PLATFORM_SHORT[platform]}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Används av swipe-decken när kompensationen ska visas i en rad. */
export function compensationLine(card: CampaignCard): string {
  return describeCompensation(
    card.campaign.compensationType,
    card.campaign.budgetPerCreator,
    card.campaign.productValue,
    formatSek,
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },

  // Bildytan flexar, texten är intrinsisk – därför inget hål vid kort brief.
  photo: { flex: 1, minHeight: 168 },
  pillSlot: { position: 'absolute', top: 14, right: 14 },
  photoFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    backgroundColor: colors.bg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  photoFooterText: { flex: 1, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { ...type.secondary, color: colors.muted, flexShrink: 1 },
  name: { ...type.rowTitle, color: colors.text },
  nameLarge: { fontFamily: type.rowTitle.fontFamily, fontSize: 18, color: colors.text },
  secondary: { ...type.secondary, color: colors.muted },

  body: { padding: spacing.base, gap: spacing.md },
  title: { ...type.cardTitle, color: colors.text },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  amount: { ...type.amount, color: colors.accent },
  amountSuffix: { ...type.bodySmall, color: colors.muted },

  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 7, height: 7, borderRadius: radius.round, backgroundColor: colors.positive },
  reason: { ...type.secondary, color: colors.positive, flex: 1 },
  reasonAi: { ...type.secondary, color: colors.accent, flex: 1 },

  brief: { ...type.bodySmall, color: colors.text, opacity: 0.82 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statRow: { flexDirection: 'row', gap: spacing.sm },

  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  platformRow: { flexDirection: 'row', gap: 6 },
  platformBox: {
    width: 28,
    height: 28,
    borderRadius: radius.tag,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformLabel: { fontFamily: type.rowTitle.fontFamily, fontSize: 10, color: colors.text },
  platformLabelMuted: { color: colors.dim },
  footerPrice: { ...type.secondary, color: colors.muted },
  footerPriceValue: { fontFamily: type.listTitle.fontFamily, color: colors.text },
});
