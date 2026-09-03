import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DEMO_MODE } from '../api';
import { useAuth } from '../auth';
import { resetDemo } from '../demo/backend';
import { colors, radius, spacing, typography } from '../theme';

/**
 * Syns bara när appen kör utan backend. Gör det tydligt att inga riktiga
 * pengar rör sig och att BankID inte är på riktigt, och ger en väg tillbaka
 * till utgångsläget när man testat klart.
 */
export function DemoBanner() {
  const router = useRouter();
  const { signOut } = useAuth();

  if (!DEMO_MODE) return null;

  const reset = async () => {
    resetDemo();
    await signOut();
    router.replace('/login');
  };

  return (
    <View style={styles.banner}>
      <Ionicons name="flask-outline" size={16} color={colors.accent} />
      <Text style={styles.text}>
        Demoläge: BankID legitimerar inte på riktigt och inga pengar rör sig.
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Återställ demo" onPress={() => void reset()}>
        <Text style={styles.action}>Återställ</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  text: { ...typography.caption, color: colors.textMuted, flex: 1, lineHeight: 16 },
  action: { ...typography.label, color: colors.primary },
});
