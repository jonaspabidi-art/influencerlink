import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError, setAccessToken } from '../src/api';
import { useAuth } from '../src/auth';
import { DemoBanner } from '../src/components/DemoBanner';
import { DeckIcon, GridIcon, LockIcon } from '../src/components/icons';
import { Button, Field, IconBox, ScrollScreen, Segmented } from '../src/components/ui';
import { Wordmark } from '../src/components/Wordmark';
import { colors, radius, spacing, type } from '../src/theme';
import type { DemoAccount, SessionUser } from '../src/types';
import { useQuery } from '@tanstack/react-query';

type Role = 'INFLUENCER' | 'BUSINESS';
type Mode = 'login' | 'register';

interface SessionResponse {
  accessToken: string;
  user: SessionUser;
}

/**
 * Inloggning med e-post och lösenord.
 *
 * BankID sitter kvar där det juridiskt behövs – på avtalssigneringen – men
 * att kräva legitimering bara för att titta på appen stänger ute för många.
 */
export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<Role>('INFLUENCER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Finns bara när BankID är simulerat. I skarp drift svarar den 404 och
  // väljaren visas inte alls.
  const demoAccounts = useQuery({
    queryKey: ['demo-accounts'],
    queryFn: () => api.get<DemoAccount[]>('/auth/demo-accounts'),
    retry: false,
  });

  const enter = useCallback(
    async (session: SessionResponse) => {
      await signIn(session.accessToken, session.user);
      if (!session.user.onboardingComplete) {
        router.replace(
          session.user.role === 'BUSINESS' ? '/onboarding/business' : '/onboarding/influencer',
        );
        return;
      }
      router.replace(
        session.user.role === 'BUSINESS' ? '/business/discover' : '/influencer/swipe',
      );
    },
    [router, signIn],
  );

  const submit = useCallback(async () => {
    setError(null);
    if (mode === 'register' && name.trim().length < 2) return setError('Skriv ditt namn.');
    if (!email.includes('@')) return setError('Ange en giltig e-postadress.');
    if (password.length < 8) return setError('Lösenordet behöver minst 8 tecken.');

    setBusy(true);
    try {
      const session =
        mode === 'register'
          ? await api.post<SessionResponse>('/auth/register', {
              email: email.trim(),
              password,
              name: name.trim(),
              role,
            })
          : await api.post<SessionResponse>('/auth/login', { email: email.trim(), password });
      await enter(session);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Något gick fel. Försök igen.');
    } finally {
      setBusy(false);
    }
  }, [email, enter, mode, name, password, role]);

  const useDemoAccount = useCallback(
    async (account: DemoAccount) => {
      setError(null);
      setBusy(true);
      try {
        const { accessToken } = await api.post<{ accessToken: string }>('/auth/demo-login', {
          userId: account.id,
        });
        // Tokenen måste gälla innan /auth/me hämtas.
        setAccessToken(accessToken);
        const user = await api.get<SessionUser>('/auth/me');
        await enter({ accessToken, user });
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : 'Kunde inte byta konto.');
      } finally {
        setBusy(false);
      }
    },
    [enter],
  );

  return (
    <ScrollScreen contentStyle={styles.screen}>
      <Wordmark />

      <View style={styles.intro}>
        <Text style={styles.title}>Företag och kreatörer, ihop.</Text>
        <Text style={styles.lead}>
          Hitta ett samarbete, signera med BankID och låt pengarna ligga spärrade tills jobbet är
          godkänt.
        </Text>
      </View>

      <Segmented
        value={mode}
        onChange={(next) => {
          setMode(next);
          setError(null);
        }}
        options={[
          { value: 'login', label: 'Logga in' },
          { value: 'register', label: 'Skapa konto' },
        ]}
      />

      <View style={styles.form}>
        {mode === 'register' ? (
          <>
            <View style={styles.roles}>
              <RoleCard
                icon={<DeckIcon size={21} color={colors.primary} />}
                iconTone="tint"
                title="Jag är influencer"
                subtitle="Svep bland betalda uppdrag"
                selected={role === 'INFLUENCER'}
                onPress={() => setRole('INFLUENCER')}
              />
              <RoleCard
                icon={<GridIcon size={21} color={colors.text} />}
                iconTone="raised"
                title="Jag driver en restaurang"
                subtitle="Lägg upp ett samarbete på 2 minuter"
                selected={role === 'BUSINESS'}
                onPress={() => setRole('BUSINESS')}
              />
            </View>
            <Field label="Namn" value={name} onChangeText={setName} placeholder="Anna Karlsson" />
          </>
        ) : null}

        <Field
          label="E-post"
          value={email}
          onChangeText={setEmail}
          placeholder="du@exempel.se"
          keyboardType="email"
        />
        <Field
          label="Lösenord"
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'register' ? 'Minst 8 tecken' : ''}
          secure
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={mode === 'register' ? 'Skapa konto' : 'Logga in'}
          onPress={() => void submit()}
          loading={busy}
        />
      </View>

      {demoAccounts.data && demoAccounts.data.length > 0 ? (
        <View style={styles.demoBlock}>
          <Text style={styles.demoTitle}>Testkonton</Text>
          <Text style={styles.demoLead}>
            Finns bara så länge BankID är simulerat. Logga in direkt för att prova appen med
            färdigt innehåll.
          </Text>
          {demoAccounts.data.map((account) => (
            <Pressable
              key={account.id}
              accessibilityRole="button"
              onPress={() => void useDemoAccount(account)}
              disabled={busy}
              style={({ pressed }) => [styles.demoRow, pressed && styles.pressed]}
            >
              <View style={styles.demoText}>
                <Text style={styles.demoName}>{account.displayName}</Text>
                <Text style={styles.demoSummary}>
                  {account.role === 'BUSINESS' ? 'Företag' : 'Kreatör'} · {account.summary}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.footnote}>
        <LockIcon size={14} color={colors.positive} />
        <Text style={styles.footnoteText}>Förmedlingsavgift 10 %. Inga avgifter innan avtal.</Text>
      </View>

      {/* Måste gå att nå utan konto – både granskare och besökare läser dem här. */}
      <View style={styles.legalRow}>
        <Text style={styles.legalLink} onPress={() => router.push('/terms')}>
          Användarvillkor
        </Text>
        <Text style={styles.footnoteText}>·</Text>
        <Text style={styles.legalLink} onPress={() => router.push('/privacy')}>
          Integritetspolicy
        </Text>
      </View>

      <DemoBanner />
    </ScrollScreen>
  );
}

/** Rollval vid registrering. Vald roll får primärfärgad kant. */
function RoleCard({
  icon,
  iconTone,
  title,
  subtitle,
  selected,
  onPress,
}: {
  icon: React.ReactNode;
  iconTone: 'tint' | 'raised';
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleCard,
        selected && styles.roleCardSelected,
        pressed && styles.pressed,
      ]}
    >
      <IconBox tone={iconTone}>{icon}</IconBox>
      <View style={styles.roleText}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.xl, gap: spacing.lg },
  intro: { gap: 8 },
  title: { ...type.display, color: colors.text },
  lead: { ...type.bodySmall, color: colors.muted },

  form: { gap: spacing.md },
  error: { ...type.secondary, color: colors.danger },

  roles: { gap: spacing.sm },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  roleCardSelected: { borderColor: colors.primary, backgroundColor: colors.tint },
  roleText: { flex: 1, gap: 2 },
  roleTitle: { ...type.listTitle, fontSize: 15, color: colors.text },
  roleSubtitle: { ...type.secondary, color: colors.muted },
  pressed: { opacity: 0.9 },

  demoBlock: { gap: spacing.sm },
  demoTitle: { ...type.listTitle, fontSize: 15, color: colors.text },
  demoLead: { ...type.secondary, color: colors.muted },
  demoRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
  },
  demoText: { gap: 2 },
  demoName: { ...type.listTitle, fontSize: 15, color: colors.text },
  demoSummary: { ...type.secondary, color: colors.muted },

  legalRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  legalLink: { ...type.secondary, color: colors.primary },
  footnote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footnoteText: { ...type.secondary, color: colors.muted },
});
