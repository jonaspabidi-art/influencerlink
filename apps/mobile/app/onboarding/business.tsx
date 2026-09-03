import { CATEGORIES, type Category } from '@influencerlink/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { Body, Button, Caption, Card, Chip, Field, Heading, Screen, Title } from '../../src/components/ui';
import { CATEGORY_LABELS } from '../../src/format';
import { spacing } from '../../src/theme';

interface SavedProfile {
  profile: { id: string };
  accessToken: string;
}

export default function BusinessOnboarding() {
  const router = useRouter();
  const { replaceToken, refresh } = useAuth();

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
    const digits = orgNumber.replace(/\D/g, '');
    if (companyName.trim().length < 2) return setError('Ange restaurangens namn.');
    if (digits.length !== 10) return setError('Organisationsnumret ska ha tio siffror.');
    if (city.trim().length < 2) return setError('Ange stad.');
    if (categories.length === 0) return setError('Välj minst en kategori.');

    setSaving(true);
    try {
      const saved = await api.put<SavedProfile>('/me/business-profile', {
        companyName: companyName.trim(),
        orgNumber: digits,
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

  return (
    <Screen scroll>
      <Title>Om restaurangen</Title>
      <Body muted>
        Tre minuter nu, sedan kan du skapa ditt första samarbete. Uppgifterna används i avtalen.
      </Body>

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
          hint="Står i avtalen mot influencern."
        />
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

      <Card>
        <Heading>Kategori</Heading>
        <Caption>Styr vilka kreatörer vi föreslår.</Caption>
        <View style={styles.chips}>
          {CATEGORIES.map((category) => (
            <Chip
              key={category}
              label={CATEGORY_LABELS[category]}
              selected={categories.includes(category)}
              onPress={() => toggleCategory(category)}
            />
          ))}
        </View>
      </Card>

      {error ? <Body>{error}</Body> : null}
      <Button label="Fortsätt" onPress={() => void save()} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
