import {
  CATEGORIES,
  DELIVERABLE_KINDS,
  PLATFORMS,
  type Category,
  type CompensationType,
  type DeliverableKind,
  type Platform,
} from '@influencerlink/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api, ApiError } from '../../src/api';
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
import {
  CATEGORY_LABELS,
  DELIVERABLE_LABELS,
  PLATFORM_LABELS,
  kronorToOre,
  oreToKronor,
} from '../../src/format';
import { spacing } from '../../src/theme';
import type { Campaign } from '../../src/types';

interface CampaignDraft {
  title: string;
  brief: string;
  categories: Category[];
  platforms: Platform[];
  deliverables: DeliverableKind[];
  compensationType: CompensationType;
  budgetPerCreator: number;
  productValue: number;
  slots: number;
  minFollowers: number;
  rationale: string;
}

const COMPENSATION_LABELS: Record<CompensationType, string> = {
  FIXED: 'Bara arvode',
  PRODUCT: 'Bara besök',
  HYBRID: 'Arvode + besök',
};

/** 30 dagar framåt räcker för de flesta kampanjer och slipper en datumväljare. */
const DEFAULT_RUN_DAYS = 30;

export default function NewCampaign() {
  const router = useRouter();

  const [prompt, setPrompt] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [rationale, setRationale] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [deliverables, setDeliverables] = useState<DeliverableKind[]>([]);
  const [compensationType, setCompensationType] = useState<CompensationType>('HYBRID');
  const [budget, setBudget] = useState('4000');
  const [productValue, setProductValue] = useState('300');
  const [slots, setSlots] = useState('3');
  const [minFollowers, setMinFollowers] = useState('5000');
  const [city, setCity] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyDraft = (draft: CampaignDraft) => {
    setTitle(draft.title);
    setBrief(draft.brief);
    setCategories(draft.categories);
    setPlatforms(draft.platforms);
    setDeliverables(draft.deliverables);
    setCompensationType(draft.compensationType);
    setBudget(String(oreToKronor(draft.budgetPerCreator)));
    setProductValue(String(oreToKronor(draft.productValue)));
    setSlots(String(draft.slots));
    setMinFollowers(String(draft.minFollowers));
    setRationale(draft.rationale);
    setShowForm(true);
  };

  const generateDraft = async () => {
    setError(null);
    if (prompt.trim().length < 10) {
      return setError('Skriv några rader om vad du vill ha.');
    }
    setDrafting(true);
    try {
      const result = await api.post<{ available: boolean; draft: CampaignDraft | null }>(
        '/campaigns/draft',
        { prompt: prompt.trim(), ...(city.trim() ? { city: city.trim() } : {}) },
      );
      if (result.draft) {
        applyDraft(result.draft);
      } else {
        setError('Förslaget kunde inte skapas just nu. Fyll i formuläret själv så länge.');
        setShowForm(true);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte skapa förslaget.');
      setShowForm(true);
    } finally {
      setDrafting(false);
    }
  };

  const toggle = <T,>(value: T, list: T[], set: (next: T[]) => void, max = 10) => {
    set(
      list.includes(value)
        ? list.filter((item) => item !== value)
        : list.length < max
          ? [...list, value]
          : list,
    );
  };

  const publish = async () => {
    setError(null);
    if (title.trim().length < 4) return setError('Ge kampanjen en rubrik.');
    if (brief.trim().length < 10) return setError('Beskriv uppdraget.');
    if (categories.length === 0) return setError('Välj minst en kategori.');
    if (platforms.length === 0) return setError('Välj minst en plattform.');
    if (deliverables.length === 0) return setError('Välj vad influencern ska leverera.');
    if (city.trim().length < 2) return setError('Ange stad.');

    setSaving(true);
    try {
      const now = new Date();
      const end = new Date(now.getTime() + DEFAULT_RUN_DAYS * 86_400_000);
      const campaign = await api.post<Campaign>('/campaigns', {
        title: title.trim(),
        brief: brief.trim(),
        categories,
        platforms,
        deliverables,
        compensationType,
        budgetPerCreator: compensationType === 'PRODUCT' ? 0 : kronorToOre(Number(budget) || 0),
        productValue: compensationType === 'FIXED' ? 0 : kronorToOre(Number(productValue) || 0),
        slots: Math.max(1, Number(slots) || 1),
        city: city.trim(),
        minFollowers: Math.max(0, Number(minFollowers) || 0),
        startDate: now.toISOString(),
        endDate: end.toISOString(),
      });
      await api.post(`/campaigns/${campaign.id}/publish`);
      router.replace(`/discover/${campaign.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte publicera kampanjen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <Title>Nytt samarbete</Title>

      {!showForm ? (
        <Card>
          <Heading>Beskriv vad du vill ha</Heading>
          <Body muted>
            Skriv som du skulle sagt det till en kollega. Vi föreslår rubrik, brief, ersättning och
            vilka kreatörer som passar – sedan justerar du.
          </Body>
          <Field
            label="Din beskrivning"
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Vi vill fylla luncherna på tisdagar och torsdagar. Gärna någon som gör snabba matvideor i Göteborg."
            multiline
          />
          <Field label="Stad" value={city} onChangeText={setCity} placeholder="Göteborg" />
          <Button label="Skapa förslag" onPress={() => void generateDraft()} loading={drafting} />
          <Button label="Fyll i själv" variant="ghost" onPress={() => setShowForm(true)} />
          {error ? <Body>{error}</Body> : null}
        </Card>
      ) : null}

      {showForm ? (
        <>
          {rationale ? (
            <Card>
              <Heading>Varför det här upplägget</Heading>
              <Body muted>{rationale}</Body>
            </Card>
          ) : null}

          <Card>
            <Field label="Rubrik" value={title} onChangeText={setTitle} />
            <Field label="Brief till influencern" value={brief} onChangeText={setBrief} multiline />
            <Field label="Stad" value={city} onChangeText={setCity} placeholder="Göteborg" />
          </Card>

          <Card>
            <Heading>Kategori</Heading>
            <View style={styles.chips}>
              {CATEGORIES.map((category) => (
                <Chip
                  key={category}
                  label={CATEGORY_LABELS[category]}
                  selected={categories.includes(category)}
                  onPress={() => toggle(category, categories, setCategories, 6)}
                />
              ))}
            </View>
          </Card>

          <Card>
            <Heading>Plattformar</Heading>
            <View style={styles.chips}>
              {PLATFORMS.map((platform) => (
                <Chip
                  key={platform}
                  label={PLATFORM_LABELS[platform]}
                  selected={platforms.includes(platform)}
                  onPress={() => toggle(platform, platforms, setPlatforms)}
                />
              ))}
            </View>

            <Heading>Vad ska levereras?</Heading>
            <View style={styles.chips}>
              {DELIVERABLE_KINDS.map((kind) => (
                <Chip
                  key={kind}
                  label={DELIVERABLE_LABELS[kind]}
                  selected={deliverables.includes(kind)}
                  onPress={() => toggle(kind, deliverables, setDeliverables)}
                />
              ))}
            </View>
          </Card>

          <Card>
            <Heading>Ersättning</Heading>
            <View style={styles.chips}>
              {(['FIXED', 'HYBRID', 'PRODUCT'] as CompensationType[]).map((type) => (
                <Chip
                  key={type}
                  label={COMPENSATION_LABELS[type]}
                  selected={compensationType === type}
                  onPress={() => setCompensationType(type)}
                />
              ))}
            </View>
            {compensationType !== 'PRODUCT' ? (
              <Field
                label="Arvode per kreatör (kr)"
                value={budget}
                onChangeText={setBudget}
                keyboardType="numeric"
                hint="Plattformsavgiften på 12 % dras vid utbetalningen till influencern."
              />
            ) : null}
            {compensationType !== 'FIXED' ? (
              <Field
                label="Värde på det ni bjuder på (kr)"
                value={productValue}
                onChangeText={setProductValue}
                keyboardType="numeric"
              />
            ) : null}
            <Field
              label="Antal kreatörer"
              value={slots}
              onChangeText={setSlots}
              keyboardType="numeric"
            />
            <Field
              label="Lägsta antal följare"
              value={minFollowers}
              onChangeText={setMinFollowers}
              keyboardType="numeric"
              hint="Sätt lågt om du hellre vill nå en engagerad lokal publik."
            />
          </Card>

          {error ? <Body>{error}</Body> : null}
          <Button label="Publicera och hitta kreatörer" onPress={() => void publish()} loading={saving} />
          <Caption>Kampanjen ligger uppe i {DEFAULT_RUN_DAYS} dagar. Du kan pausa den när som helst.</Caption>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
