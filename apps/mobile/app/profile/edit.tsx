import { CATEGORIES, kronorToOre, oreToKronor, type Category } from '@pacta/shared';
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
import type { InfluencerProfile } from '../../src/types';

/**
 * Redigera kreatörsprofilen.
 *
 * Onboardingen är en guide som körs en gång. Den här skärmen är samma fält i
 * ett formulär, så att pris och bio går att ändra i efterhand utan att gå
 * igenom guiden på nytt.
 */
export default function EditProfile() {
  const { user, replaceToken } = useAuth();

  const profile = useQuery({
    queryKey: ['influencer', user?.profileId],
    queryFn: () => api.get<InfluencerProfile>(`/influencers/${user?.profileId}`),
    enabled: Boolean(user?.profileId),
  });

  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceTarget, setPriceTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Fälten fylls när profilen kommit. Sedan äger formuläret värdena, annars
  // skulle en omhämtning skriva över det användaren just skrivit.
  const loaded = profile.data;
  useEffect(() => {
    if (!loaded) return;
    setDisplayName(loaded.displayName);
    setCity(loaded.city);
    setBio(loaded.bio);
    setCategories(loaded.categories);
    setPriceMin(String(oreToKronor(loaded.priceMin)));
    setPriceTarget(String(oreToKronor(loaded.priceTarget)));
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
    if (displayName.trim().length < 2) return setError('Ange ditt profilnamn.');
    if (city.trim().length < 2) return setError('Ange vilken stad du utgår från.');
    if (categories.length < 1) return setError('Välj minst en nisch.');

    setSaving(true);
    try {
      const result = await api.put<{ accessToken: string }>('/me/influencer-profile', {
        displayName: displayName.trim(),
        bio: bio.trim(),
        city: city.trim(),
        categories,
        priceMin: kronorToOre(Number(priceMin) || 0),
        priceTarget: kronorToOre(Number(priceTarget) || 0),
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
      <Header title="Redigera profil" onBack={() => router.back()} />

      {profile.isLoading ? <Loading /> : null}
      {profile.isError ? (
        <ErrorState message="Kunde inte hämta profilen." onRetry={() => void profile.refetch()} />
      ) : null}

      {loaded ? (
        <>
          <Card>
            <Field
              label="Profilnamn"
              value={displayName}
              onChangeText={(value) => {
                setSaved(false);
                setDisplayName(value);
              }}
              placeholder="dittnamn"
            />
            <Field
              label="Stad"
              value={city}
              onChangeText={(value) => {
                setSaved(false);
                setCity(value);
              }}
              placeholder="Göteborg"
            />
            <Field
              label="Om dig"
              value={bio}
              onChangeText={(value) => {
                setSaved(false);
                setBio(value);
              }}
              placeholder="Vad filmar du, och vilka tittar?"
              multiline
              hint="Det här är det första en restaurang läser om dig."
            />
          </Card>

          <View style={styles.section}>
            <Label>NISCHER</Label>
            <Body>Vi visar bara kampanjer som passar det du redan gör. Välj upp till sex.</Body>
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

          <Card>
            <Field
              label="Lägsta arvode (kr)"
              value={priceMin}
              onChangeText={(value) => {
                setSaved(false);
                setPriceMin(value);
              }}
              keyboardType="numeric"
              hint="Kampanjer under den här nivån visas inte för dig."
            />
            <Field
              label="Riktpris (kr)"
              value={priceTarget}
              onChangeText={(value) => {
                setSaved(false);
                setPriceTarget(value);
              }}
              keyboardType="numeric"
              hint="Det restaurangen ser på ditt kort."
            />
          </Card>

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
