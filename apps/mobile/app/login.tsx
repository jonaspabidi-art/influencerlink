import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BankIdPanel, useBankId } from '../src/bankid';
import { DemoBanner } from '../src/components/DemoBanner';
import { Body, Button, Caption, Card, Heading, Screen, Title } from '../src/components/ui';
import { useAuth } from '../src/auth';
import { colors, radius, spacing } from '../src/theme';
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
      router.replace(
        status.user.role === 'BUSINESS' ? '/business/campaigns' : '/influencer/swipe',
      );
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
      <Screen scroll>
        <Title>Logga in</Title>
        <BankIdPanel
          phase={bankId.phase}
          qrData={bankId.qrData}
          hintText={bankId.hintText}
          autoStartUrl={bankId.autoStartUrl}
          onCancel={() => void bankId.cancel()}
          onRetry={() => role && beginLogin(role)}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Title>InfluencerLink</Title>
        <Body muted>
          Restauranger och kreatörer som hittar varandra. Swipa, kom överens, signera med BankID –
          och få betalt när jobbet är gjort.
        </Body>
      </View>

      <Card>
        <Heading>Jag är influencer</Heading>
        <Body muted>
          Koppla TikTok, Instagram eller YouTube och swipa bland samarbeten nära dig.
        </Body>
        <Button label="Logga in med BankID" onPress={() => beginLogin('INFLUENCER')} />
      </Card>

      <Card>
        <Heading>Jag driver en restaurang</Heading>
        <Body muted>
          Beskriv vad du vill ha med några rader – vi föreslår kampanjen och matchar dig med rätt
          kreatörer.
        </Body>
        <Button
          label="Logga in med BankID"
          variant="secondary"
          onPress={() => beginLogin('BUSINESS')}
        />
      </Card>

      <DemoBanner />

      <View style={styles.legal}>
        <Caption>
          Vi använder BankID för att veta vem du är. Ditt personnummer sparas aldrig i klartext.
        </Caption>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  legal: { paddingVertical: spacing.md },
});
