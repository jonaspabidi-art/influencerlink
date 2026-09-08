import { CATEGORIES, type Category } from '@pacta/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import {
  Button,
  Card,
  Chip,
  Field,
  Header,
  Progress,
  ScrollScreen,
} from '../../src/components/ui';
import { CATEGORY_LABELS } from '../../src/format';
import { colors, spacing, type } from '../../src/theme';

interface SavedProfile {
  profile: { id: string };
  accessToken: string;
}

const TOTAL_STEPS = 3;

/** Samma mall som kreatörens onboarding: en fråga i taget. */
export default function BusinessOnboarding() {
  const router = useRouter();
  const { replaceToken, refresh } = useAuth();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
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

  const save = async (then: 'browse' | 'campaign') => {
    setError(null);
    if (categories.length === 0) return setError('Välj minst en kategori.');

    setSaving(true);
    try {
      const saved = await api.put<SavedProfile>('/me/business-profile', {
        companyName: companyName.trim(),
        city: city.trim(),
        address: address.trim(),
        description: description.trim(),
        categories,
      });
      await replaceToken(saved.accessToken);
      await refresh();
      /*
       * Ägaren väljer själv var det börjar.
       *
       * Att tvinga fram en kampanj innan man sett om det finns någon att
       * samarbeta med är fel ordning – men att bestämma åt någon att titta
       * först är också ett beslut. Här står båda vägarna, och den som vill
       * skriva sitt samarbete direkt slipper leta rätt på knappen efteråt.
       */
      router.replace(then === 'campaign' ? '/campaign/new' : '/business/discover');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte spara uppgifterna.');
    } finally {
      setSaving(false);
    }
  };

  const next = (then: 'browse' | 'campaign' = 'browse') => {
    setError(null);
    if (step === 1) {
      if (companyName.trim().length < 2) return setError('Ange företagets namn.');
    }
    if (step === 2 && city.trim().length < 2) return setError('Ange stad.');
    if (step === TOTAL_STEPS) return void save(then);
    setStep((current) => current + 1);
  };

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title="Om företaget"
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
            title="Vad heter företaget?"
            lead="Namnet kreatörerna ser. Organisationsnumret fyller ni i under Profil, det behövs först när ett avtal ska skrivas."
          />
          <Card>
            <Field
              label="Företagets namn"
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Restaurang Kajutan"
            />
          </Card>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Question
            title="Var ligger ni?"
            lead="Kreatörer måste kunna besöka er, så vi matchar i första hand lokalt."
          />
          <Card>
            <Field label="Stad" value={city} onChangeText={setCity} placeholder="Göteborg" />
            <Field
              label="Adress"
              value={address}
              onChangeText={setAddress}
              placeholder="Kungsportsavenyen 12"
            />
            <Field
              label="Beskriv verksamheten"
              value={description}
              onChangeText={setDescription}
              placeholder="Vad serverar ni, och vilka kommer hit?"
              multiline
            />
          </Card>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Question
            title="Vad är ni för slags ställe?"
            lead="Styr vilka kreatörer vi föreslår. Välj det som stämmer bäst."
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
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step === TOTAL_STEPS ? (
        <>
          <Button label="Klar – visa kreatörer" onPress={() => next('browse')} loading={saving} />
          <Button
            label="Skapa vårt första samarbete"
            variant="secondary"
            onPress={() => next('campaign')}
          />
          <Text style={styles.footnote}>
            Samarbetet kan ni skriva när ni vill. Inget kostar något förrän ett avtal är
            signerat.
          </Text>
        </>
      ) : (
        <Button label="Fortsätt" onPress={() => next()} loading={saving} />
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
  footnote: { ...type.secondary, color: colors.muted },
  error: { ...type.secondary, color: colors.danger },
});
