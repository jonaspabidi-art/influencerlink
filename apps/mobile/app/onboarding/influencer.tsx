import { CATEGORIES, PLATFORMS, type Category, type Platform } from '@pacta/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { CheckIcon } from '../../src/components/icons';
import {
  Body,
  Button,
  Card,
  Chip,
  Field,
  Header,
  Loading,
  Progress,
  ScrollScreen,
} from '../../src/components/ui';
import { CATEGORY_LABELS, PLATFORM_LABELS, formatFollowers, kronorToOre } from '../../src/format';
import { colors, spacing, type } from '../../src/theme';

interface SavedProfile {
  profile: { id: string };
  accessToken: string;
}

interface SocialAccount {
  id: string;
  platform: Platform;
  handle: string;
  followers: number;
}

const TOTAL_STEPS = 5;

/**
 * En fråga per skärm i stället för ett långt formulär (variant A i handoffen).
 * Profilen sparas efter steg 4, eftersom kontokopplingen i steg 5 kräver att
 * profilen finns.
 */
export default function InfluencerOnboarding() {
  const router = useRouter();
  const { replaceToken, refresh } = useAuth();

  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [priceMin, setPriceMin] = useState('1500');
  const [priceTarget, setPriceTarget] = useState('4000');

  const [platform, setPlatform] = useState<Platform>('TIKTOK');
  const [handle, setHandle] = useState('');
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (category: Category) => {
    setCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : current.length < 6
          ? [...current, category]
          : current,
    );
  };

  const saveProfile = async () => {
    setError(null);
    setSaving(true);
    try {
      const saved = await api.put<SavedProfile>('/me/influencer-profile', {
        displayName: displayName.trim(),
        bio: bio.trim(),
        city: city.trim(),
        categories,
        priceMin: kronorToOre(Number(priceMin) || 0),
        priceTarget: kronorToOre(Number(priceTarget) || 0),
      });
      // Sessionen får profil-id först när profilen finns.
      await replaceToken(saved.accessToken);
      setStep(5);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte spara profilen.');
    } finally {
      setSaving(false);
    }
  };

  const connectAccount = async () => {
    setError(null);
    if (handle.trim().length < 2) return setError('Ange ditt användarnamn.');

    setSaving(true);
    try {
      const account = await api.post<SocialAccount>('/me/influencer-profile/socials', {
        platform,
        handle: handle.trim(),
      });
      setAccounts((current) => [...current.filter((item) => item.platform !== platform), account]);
      setHandle('');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte koppla kontot.');
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    await refresh();
    router.replace('/influencer/swipe');
  };

  const next = () => {
    setError(null);
    if (step === 1 && categories.length < 1) return setError('Välj minst en nisch.');
    if (step === 2 && (displayName.trim().length < 2 || city.trim().length < 2)) {
      return setError('Fyll i namn och stad.');
    }
    if (step === 4) return void saveProfile();
    setStep((current) => Math.min(TOTAL_STEPS, current + 1));
  };

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title="Din profil"
        onBack={step > 1 ? () => setStep((current) => current - 1) : undefined}
        right={
          <Text style={styles.stepCounter}>
            {step} / {TOTAL_STEPS}
          </Text>
        }
      />
      <Progress total={TOTAL_STEPS} current={step} />

      {step === 1 ? (
        <>
          <Question
            title="Vad filmar du helst?"
            lead="Välj minst två. Vi visar bara kampanjer som passar det du redan gör."
          />
          <View style={styles.chipRow}>
            {CATEGORIES.map((category) => (
              <Chip
                key={category}
                label={CATEGORY_LABELS[category]}
                selected={categories.includes(category)}
                onPress={() => toggleCategory(category)}
              />
            ))}
          </View>
          {categories.length > 0 ? (
            <Card tone="raised">
              <Text style={styles.motivationLead}>
                Med {categories.map((category) => CATEGORY_LABELS[category]).join(' och ')}
              </Text>
              <Text style={styles.motivationValue}>
                {categories.length * 3}
                <Text style={styles.motivationSuffix}> kampanjer att svepa på nu</Text>
              </Text>
              <Text style={styles.secondary}>Arvodena ligger oftast mellan 1 500 kr och 6 000 kr.</Text>
            </Card>
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Question
            title="Vad heter du i dina kanaler?"
            lead="Det är namnet restaurangerna ser när du dyker upp i deras flöde."
          />
          <Card>
            <Field
              label="Visningsnamn"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="annaäter"
            />
            <Field label="Stad" value={city} onChangeText={setCity} placeholder="Göteborg" />
          </Card>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Question
            title="Berätta kort om dig"
            lead="Två meningar räcker: vad du gör för innehåll, och för vem."
          />
          <Card>
            <Field
              label="Presentation"
              value={bio}
              onChangeText={setBio}
              placeholder="Testar stadens lunchställen varje vardag. Publiken är 25–40 år och bor i stan."
              multiline
            />
          </Card>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Question
            title="Vad tar du betalt?"
            lead="Kampanjer med lägre budget än ditt lägstapris visas aldrig för dig."
          />
          <Card>
            <Field
              label="Lägsta arvode (kr)"
              value={priceMin}
              onChangeText={setPriceMin}
              keyboardType="numeric"
            />
            <Field
              label="Riktpris för ett uppdrag (kr)"
              value={priceTarget}
              onChangeText={setPriceTarget}
              keyboardType="numeric"
            />
          </Card>
        </>
      ) : null}

      {step === 5 ? (
        <>
          <Question
            title="Koppla dina konton"
            lead="Vi hämtar följarantal och snittvisningar. Restaurangerna ser bara siffrorna, aldrig din inloggning."
          />
          <Card>
            <View style={styles.chipRow}>
              {PLATFORMS.map((item) => (
                <Chip
                  key={item}
                  label={PLATFORM_LABELS[item]}
                  selected={platform === item}
                  onPress={() => setPlatform(item)}
                />
              ))}
            </View>
            <Field
              label="Användarnamn"
              value={handle}
              onChangeText={setHandle}
              placeholder="@dittnamn"
            />
            <Button
              label={`Koppla ${PLATFORM_LABELS[platform]}`}
              variant="secondary"
              onPress={() => void connectAccount()}
              loading={saving}
            />
          </Card>

          {accounts.map((account) => (
            <View key={account.id} style={styles.accountRow}>
              <CheckIcon size={18} color={colors.positive} />
              <Text style={styles.accountText}>
                {PLATFORM_LABELS[account.platform]} · @{account.handle} ·{' '}
                {formatFollowers(account.followers)} följare
              </Text>
            </View>
          ))}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saving && step !== 5 ? <Loading /> : null}

      {step === 5 ? (
        accounts.length > 0 ? (
          <Button label="Klar – börja svepa" onPress={() => void finish()} />
        ) : (
          <Body>Koppla minst ett konto för att komma igång.</Body>
        )
      ) : (
        <Button label="Fortsätt" onPress={next} loading={saving} />
      )}
    </ScrollScreen>
  );
}

function Question({ title, lead }: { title: string; lead: string }) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionTitle}>{title}</Text>
      <Text style={styles.questionLead}>{lead}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  stepCounter: { ...type.label, color: colors.muted },
  question: { gap: spacing.sm, paddingTop: spacing.sm },
  questionTitle: { ...type.display, color: colors.text },
  questionLead: { ...type.body, color: colors.muted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  secondary: { ...type.secondary, color: colors.muted },
  error: { ...type.secondary, color: colors.danger },

  motivationLead: { ...type.listTitle, color: colors.text },
  motivationValue: { ...type.display, color: colors.accent },
  motivationSuffix: { ...type.body, color: colors.muted },

  accountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  accountText: { ...type.bodySmall, color: colors.text },
});
