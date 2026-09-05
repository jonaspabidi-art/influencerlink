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
  const [orgNumber, setOrgNumber] = useState('');
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

  const save = async () => {
    setError(null);
    if (categories.length === 0) return setError('Välj minst en kategori.');

    setSaving(true);
    try {
      const saved = await api.put<SavedProfile>('/me/business-profile', {
        companyName: companyName.trim(),
        orgNumber: orgNumber.replace(/\D/g, ''),
        city: city.trim(),
        address: address.trim(),
        description: description.trim(),
        categories,
      });
      await replaceToken(saved.accessToken);
      await refresh();
      router.replace('/campaign/new');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte spara uppgifterna.');
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    setError(null);
    if (step === 1) {
      if (companyName.trim().length < 2) return setError('Ange restaurangens namn.');
      if (orgNumber.replace(/\D/g, '').length !== 10) {
        return setError('Organisationsnumret ska ha tio siffror.');
      }
    }
    if (step === 2 && city.trim().length < 2) return setError('Ange stad.');
    if (step === TOTAL_STEPS) return void save();
    setStep((current) => current + 1);
  };

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title="Om restaurangen"
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
            title="Vad heter stället?"
            lead="Namnet och organisationsnumret står i avtalen mot kreatören."
          />
          <Card>
            <Field
              label="Restaurangens namn"
              value={companyName}
              onChangeText={setCompanyName}
              placeholder="Restaurang Kajutan"
            />
            <Field
              label="Organisationsnummer"
              value={orgNumber}
              onChangeText={setOrgNumber}
              placeholder="556012-3456"
              keyboardType="numeric"
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
              label="Beskriv stället"
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
      <Button
        label={step === TOTAL_STEPS ? 'Klar – skapa ert första samarbete' : 'Fortsätt'}
        onPress={next}
        loading={saving}
      />
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
  error: { ...type.secondary, color: colors.danger },
});
