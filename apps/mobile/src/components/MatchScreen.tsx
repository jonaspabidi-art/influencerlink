import { StyleSheet, Text, View } from 'react-native';
import { formatSek } from '../format';
import { colors, radius, spacing, type } from '../theme';
import { LockIcon } from './icons';
import { Avatar, Button, Divider, Photo, Screen } from './ui';

/**
 * Matchningsskärmen, variant A i handoffen: ett kvitto på matchningen.
 *
 * Bildytan flexar och de två parternas bilder hänger ned över kanten, så att
 * ögonblicket får en egen komposition i stället för en rubrik och två knappar.
 */
export function MatchScreen({
  eyebrow,
  headline,
  summaryTitle,
  amount,
  productValue,
  escrowNote,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  leftAvatarUrl,
  rightAvatarUrl,
}: {
  eyebrow: string;
  headline: string;
  summaryTitle: string;
  amount: number;
  productValue: number;
  escrowNote: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel: string;
  onSecondary: () => void;
  leftAvatarUrl?: string | null;
  rightAvatarUrl?: string | null;
}) {
  return (
    <Screen>
      <View style={styles.hero}>
        <Photo style={styles.photo} />
        <View style={styles.avatars}>
          <Avatar uri={leftAvatarUrl} size={84} ring />
          <View style={styles.avatarRight}>
            <Avatar uri={rightAvatarUrl} size={84} ring />
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.headline}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{headline}</Text>
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{summaryTitle}</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amount}>{amount > 0 ? formatSek(amount) : 'Besök på huset'}</Text>
            {productValue > 0 ? (
              <Text style={styles.amountSuffix}>+ besök ({formatSek(productValue)})</Text>
            ) : null}
          </View>
          <Divider />
          <View style={styles.escrowRow}>
            <LockIcon size={14} color={colors.positive} />
            <Text style={styles.escrowText}>{escrowNote}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button label={primaryLabel} onPress={onPrimary} />
          <Button label={secondaryLabel} variant="secondary" onPress={onSecondary} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, minHeight: 200 },
  photo: { flex: 1 },
  // Bilderna hänger 40 px ned över bildkanten och möts i mitten.
  avatars: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRight: { marginLeft: -14 },

  body: { paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: spacing.xl, gap: 22 },
  headline: { alignItems: 'center', gap: spacing.sm },
  eyebrow: {
    fontFamily: type.rowTitle.fontFamily,
    fontSize: 13,
    letterSpacing: 1.04,
    color: colors.positive,
  },
  title: { ...type.display, color: colors.text, textAlign: 'center' },

  summary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 18,
    gap: spacing.md,
  },
  summaryTitle: { fontFamily: type.listTitle.fontFamily, fontSize: 16, color: colors.text },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  amount: { fontFamily: type.amount.fontFamily, fontSize: 26, color: colors.accent },
  amountSuffix: { ...type.bodySmall, color: colors.muted },
  escrowRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  escrowText: { ...type.secondary, color: colors.muted, flex: 1, lineHeight: 18 },

  actions: { gap: spacing.md },
});
