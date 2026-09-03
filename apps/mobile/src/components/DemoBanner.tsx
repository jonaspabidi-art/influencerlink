import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DEMO_MODE } from '../api';
import { useAuth } from '../auth';
import { resetDemo } from '../demo/backend';
import { colors, radius, spacing, type } from '../theme';

/**
 * Syns bara när appen kör utan backend. Gör tydligt att inga riktiga pengar
 * rör sig och att BankID inte är på riktigt, och ger en väg tillbaka till
 * utgångsläget när man testat klart.
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
      <Text style={styles.text}>
        Demoläge: BankID legitimerar inte på riktigt och inga pengar rör sig.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Återställ demo"
        onPress={() => void reset()}
      >
        <Text style={styles.action}>Återställ</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.raised,
    borderRadius: radius.control,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  text: { ...type.secondary, color: colors.muted, flex: 1, lineHeight: 17 },
  action: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.primary },
});
