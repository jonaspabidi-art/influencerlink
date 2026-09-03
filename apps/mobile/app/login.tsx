import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BankIdScreen, useBankId } from '../src/bankid';
import { useAuth } from '../src/auth';
import { DemoBanner } from '../src/components/DemoBanner';
import { DeckIcon, GridIcon, LockIcon } from '../src/components/icons';
import { Button, IconBox, Photo, Screen } from '../src/components/ui';
import { colors, radius, spacing, type } from '../src/theme';
import type { BankIdStatus } from '../src/types';

type Role = 'INFLUENCER' | 'BUSINESS';

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [role, setRole] = useState<Role | null>(null);

  const handleComplete = useCallback(
    async (status: BankIdStatus) => {
      if (!status.accessToken || !status.user) return;
      await signIn(status.accessToken, status.user);
      if (!status.user.onboardingComplete) {
        router.replace(
          status.user.role === 'BUSINESS' ? '/onboarding/business' : '/onboarding/influencer',
        );
        return;
      }
      router.replace(status.user.role === 'BUSINESS' ? '/business/campaigns' : '/influencer/swipe');
    },
    [router, signIn],
  );

  const bankId = useBankId({
    purpose: 'LOGIN',
    onComplete: (status) => {
      void handleComplete(status);
    },
  });

  const beginLogin = useCallback(
    (selected: Role) => {
      setRole(selected);
      void bankId.start({ role: selected });
    },
    [bankId],
  );

  if (bankId.phase !== 'idle') {
    return (
      <BankIdScreen
        phase={bankId.phase}
        qrData={bankId.qrData}
        hintText={bankId.hintText}
        autoStartUrl={bankId.autoStartUrl}
        onCancel={() => void bankId.cancel()}
        onRetry={() => role && beginLogin(role)}
      />
    );
  }

  return (
    <Screen style={styles.screen}>
      <Photo style={styles.hero} />

      <View style={styles.intro}>
        <Text style={styles.title}>Restauranger och kreatörer, ihop.</Text>
        <Text style={styles.lead}>
          Hitta ett samarbete, signera med BankID och låt pengarna ligga spärrade tills jobbet är
          godkänt.
        </Text>
      </View>

      <View style={styles.roles}>
        <RoleCard
          icon={<DeckIcon size={21} color={colors.primary} />}
          iconTone="tint"
          title="Jag är influencer"
          subtitle="Svep bland betalda uppdrag"
          variant="primary"
          onPress={() => beginLogin('INFLUENCER')}
        />
        <RoleCard
          icon={<GridIcon size={21} color={colors.text} />}
          iconTone="raised"
          title="Jag driver en restaurang"
          subtitle="Lägg upp ett samarbete på 2 minuter"
          variant="secondary"
          onPress={() => beginLogin('BUSINESS')}
        />
      </View>

      <View style={styles.footnote}>
        <LockIcon size={14} color={colors.positive} />
        <Text style={styles.footnoteText}>Plattformsavgift 12 %. Inga avgifter innan avtal.</Text>
      </View>

      <DemoBanner />
    </Screen>
  );
}

function RoleCard({
  icon,
  iconTone,
  title,
  subtitle,
  variant,
  onPress,
}: {
  icon: React.ReactNode;
  iconTone: 'tint' | 'raised';
  title: string;
  subtitle: string;
  variant: 'primary' | 'secondary';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.roleCard, pressed && styles.pressed]}
    >
      <View style={styles.roleHeader}>
        <IconBox tone={iconTone}>{icon}</IconBox>
        <View style={styles.roleText}>
          <Text style={styles.roleTitle}>{title}</Text>
          <Text style={styles.roleSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Button label="Fortsätt med BankID" variant={variant} compact onPress={onPress} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.xl, gap: spacing.xl },
  hero: { flex: 1, minHeight: 120, borderRadius: radius.card },
  intro: { gap: 10 },
  title: { fontFamily: type.displayLarge.fontFamily, fontSize: 32, lineHeight: 35.2, letterSpacing: -0.64, color: colors.text },
  lead: { ...type.body, lineHeight: 23.25, color: colors.muted },

  roles: { gap: spacing.md },
  roleCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 18,
    gap: 14,
  },
  pressed: { opacity: 0.9 },
  roleHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  roleText: { flex: 1, gap: 2 },
  roleTitle: { ...type.rowTitle, color: colors.text },
  roleSubtitle: { ...type.secondary, color: colors.muted },

  footnote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  footnoteText: { ...type.secondary, color: colors.muted },
});
