import { CATEGORIES, type Category } from '@pacta/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import {
  Body,
  Button,
  Card,
  Chip,
  ErrorState,
  Field,
  Header,
  Label,
  Loading,
  ScrollScreen,
} from '../../src/components/ui';
import { CATEGORY_LABELS } from '../../src/format';
import { colors, spacing, type } from '../../src/theme';
import type { OwnBusinessProfile } from '../../src/types';

/** Redigera företagsprofilen. Motsvarigheten till kreatörernas /profile/edit. */
export default function EditBusinessProfile() {
  const { replaceToken } = useAuth();

  const profile = useQuery({
    queryKey: ['own-business'],
    queryFn: () => api.get<OwnBusinessProfile>('/me/business-profile'),
  });

  const [companyName, setCompanyName] = useState('');
  const [orgNumber, setOrgNumber] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loaded = profile.data;
  useEffect(() => {
    if (!loaded) return;
    setCompanyName(loaded.companyName);
    setOrgNumber(loaded.orgNumber);
    setCity(loaded.city);
    setAddress(loaded.address);
    setDescription(loaded.description);
    setCategories(loaded.categories);
  }, [loaded]);

  const toggleCategory = (category: Category) => {
    setSaved(false);
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
    setSaved(false);
    if (companyName.trim().length < 2) return setError('Ange företagets namn.');
    if (!/^\d{10}$/.test(orgNumber.trim())) {
      return setError('Organisationsnummer ska vara 10 siffror utan bindestreck.');
    }
    if (city.trim().length < 2) return setError('Ange vilken stad ni finns i.');
    if (categories.length < 1) return setError('Välj minst en nisch.');

    setSaving(true);
    try {
      const result = await api.put<{ accessToken: string }>('/me/business-profile', {
        companyName: companyName.trim(),
        orgNumber: orgNumber.trim(),
        city: city.trim(),
        address: address.trim(),
        description: description.trim(),
        categories,
      });
      await replaceToken(result.accessToken);
      await profile.refetch();
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte spara profilen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title="Redigera företagsprofil" onBack={() => router.back()} />

      {profile.isLoading ? <Loading /> : null}
      {profile.isError ? (
        <ErrorState message="Kunde inte hämta profilen." onRetry={() => void profile.refetch()} />
      ) : null}

      {loaded ? (
        <>
          <Card>
            <Field
              label="Företagsnamn"
              value={companyName}
              onChangeText={(value) => {
                setSaved(false);
                setCompanyName(value);
              }}
            />
            <Field
              label="Organisationsnummer"
              value={orgNumber}
              onChangeText={(value) => {
                setSaved(false);
                setOrgNumber(value);
              }}
              keyboardType="numeric"
              hint="10 siffror utan bindestreck. Står på avtalen ni signerar."
            />
            <Field
              label="Stad"
              value={city}
              onChangeText={(value) => {
                setSaved(false);
                setCity(value);
              }}
            />
            <Field
              label="Adress"
              value={address}
              onChangeText={(value) => {
                setSaved(false);
                setAddress(value);
              }}
              hint="Dit kreatören kommer."
            />
            <Field
              label="Om stället"
              value={description}
              onChangeText={(value) => {
                setSaved(false);
                setDescription(value);
              }}
              multiline
            />
          </Card>

          <View style={styles.section}>
            <Label>NISCHER</Label>
            <Body>Styr vilka kreatörer vi föreslår. Välj upp till sex.</Body>
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
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {saved ? <Text style={styles.saved}>Sparat.</Text> : null}

          <Button label="Spara" onPress={() => void save()} loading={saving} />
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  section: { gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { ...type.secondary, color: colors.danger },
  saved: { ...type.secondary, color: colors.positive },
});
