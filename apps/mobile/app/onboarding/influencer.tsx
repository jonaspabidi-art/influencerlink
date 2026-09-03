import { CATEGORIES, PLATFORMS, type Category, type Platform } from '@influencerlink/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import {
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Field,
  Heading,
  Screen,
  Title,
} from '../../src/components/ui';
import { CATEGORY_LABELS, PLATFORM_LABELS, kronorToOre } from '../../src/format';
import { spacing } from '../../src/theme';

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

export default function InfluencerOnboarding() {
  const router = useRouter();
  const { replaceToken, refresh } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [priceMin, setPriceMin] = useState('1500');
  const [priceTarget, setPriceTarget] = useState('4000');
  const [profileSaved, setProfileSaved] = useState(false);

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
    if (displayName.trim().length < 2) return setError('Skriv ditt visningsnamn.');
    if (city.trim().length < 2) return setError('Ange vilken stad du är verksam i.');
    if (categories.length === 0) return setError('Välj minst en nisch.');

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
      setProfileSaved(true);
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
    router.replace('/(influencer)/swipe');
  };

  return (
    <Screen scroll>
      <Title>Din profil</Title>
      <Body muted>
        Restauranger ser det här när du dyker upp i deras flöde. Ju tydligare nischer, desto bättre
        matchningar.
      </Body>

      <Card>
        <Field
          label="Visningsnamn"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="t.ex. annaäter"
        />
        <Field label="Stad" value={city} onChangeText={setCity} placeholder="Göteborg" />
        <Field
          label="Kort om dig"
          value={bio}
          onChangeText={setBio}
          placeholder="Vad gör du för innehåll, och för vem?"
          multiline
        />
      </Card>

      <Card>
        <Heading>Nischer</Heading>
        <Caption>Välj upp till sex.</Caption>
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

      <Card>
        <Heading>Vad du tar betalt</Heading>
        <Field
          label="Lägsta arvode (kr)"
          value={priceMin}
          onChangeText={setPriceMin}
          keyboardType="numeric"
          hint="Kampanjer med lägre budget visas inte för dig."
        />
        <Field
          label="Riktpris för ett uppdrag (kr)"
          value={priceTarget}
          onChangeText={setPriceTarget}
          keyboardType="numeric"
        />
        <Button
          label={profileSaved ? 'Uppdatera profilen' : 'Spara profilen'}
          onPress={() => void saveProfile()}
          loading={saving}
        />
      </Card>

      {profileSaved ? (
        <Card>
          <Heading>Koppla dina konton</Heading>
          <Caption>
            Vi hämtar följare och engagemang så att restauranger ser din räckvidd. Minst ett konto
            krävs.
          </Caption>
          <View style={styles.chips}>
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
          <Button label="Koppla konto" variant="secondary" onPress={() => void connectAccount()} loading={saving} />

          {accounts.map((account) => (
            <Body key={account.id}>
              {PLATFORM_LABELS[account.platform]} · @{account.handle} ·{' '}
              {account.followers.toLocaleString('sv-SE')} följare
            </Body>
          ))}

          {accounts.length > 0 ? (
            <Button label="Klar – börja swipa" onPress={() => void finish()} />
          ) : null}
        </Card>
      ) : null}

      {error ? <Body>{error}</Body> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
