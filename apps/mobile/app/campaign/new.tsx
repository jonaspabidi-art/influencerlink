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
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { SparkIcon } from '../../src/components/icons';
import {
  Body,
  Button,
  Card,
  Chip,
  Divider,
  Field,
  Header,
  Label,
  Progress,
  ScrollScreen,
  Screen,
  Segmented,
  Tag,
} from '../../src/components/ui';
import {
  CATEGORY_LABELS,
  DELIVERABLE_LABELS,
  PLATFORM_LABELS,
  kronorToOre,
  oreToKronor,
  formatSek,
} from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
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

const COMPENSATION_OPTIONS: Array<{ value: CompensationType; label: string }> = [
  { value: 'FIXED', label: 'Bara arvode' },
  { value: 'PRODUCT', label: 'Bara besök' },
  { value: 'HYBRID', label: 'Arvode + besök' },
];

/** Snabbstarter i steg 1, som i handoffen. */
const STARTERS = [
  'Vi vill fylla luncherna på tisdagar och torsdagar med en ny meny.',
  'Vi kör afterwork på torsdagar och vill nå folk som jobbar i stan.',
  'Vi öppnar nytt om tre veckor och vill ha uppmärksamhet innan.',
];

const PROMPT_MAX = 1000;
const DEFAULT_RUN_DAYS = 30;
const PLATFORM_FEE_BPS = 1200;

export default function NewCampaign() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  const [prompt, setPrompt] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [rationale, setRationale] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>(['TIKTOK', 'INSTAGRAM']);
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
    setStep(2);
  };

  const generateDraft = async () => {
    setError(null);
    if (prompt.trim().length < 10) return setError('Skriv några rader om vad du vill ha.');

    setDrafting(true);
    try {
      const result = await api.post<{ available: boolean; draft: CampaignDraft | null }>(
        '/campaigns/draft',
        { prompt: prompt.trim(), ...(city.trim() ? { city: city.trim() } : {}) },
      );
      if (result.draft) applyDraft(result.draft);
      else {
        setError('Förslaget kunde inte skapas. Fyll i formuläret själv så länge.');
        setStep(2);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte skapa förslaget.');
      setStep(2);
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
    if (deliverables.length === 0) return setError('Välj vad kreatören ska leverera.');
    if (city.trim().length < 2) return setError('Ange stad.');

    setSaving(true);
    try {
      const now = new Date();
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
        endDate: new Date(now.getTime() + DEFAULT_RUN_DAYS * 86_400_000).toISOString(),
      });
      await api.post(`/campaigns/${campaign.id}/publish`);
      router.replace(`/discover/${campaign.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte publicera kampanjen.');
    } finally {
      setSaving(false);
    }
  };

  // --- Steg 1: skriv fritt -------------------------------------------------

  if (step === 1) {
    return (
      <ScrollScreen contentStyle={styles.step1Content}>
        <Header
          title="Nytt samarbete"
          onBack={() => router.back()}
          right={<Text style={styles.stepCounter}>1 / 2</Text>}
        />
        <Progress total={2} current={1} />

        <View style={styles.step1Body}>
          <View style={styles.intro}>
            <Text style={styles.stepTitle}>Beskriv vad du vill ha</Text>
            <Text style={styles.lead}>
              Som du skulle sagt det till en kollega. Vi gör om det till en färdig kampanj som du
              får ändra i.
            </Text>
          </View>

          {/* Ska se ut som en anteckning, inte ett formulär. */}
          <View style={styles.note}>
            <TextInput
              style={styles.noteInput}
              value={prompt}
              onChangeText={(value) => setPrompt(value.slice(0, PROMPT_MAX))}
              placeholder="Vi vill fylla luncherna på tisdagar och torsdagar. Gärna någon som gör snabba matvideor här i stan."
              placeholderTextColor={colors.dim}
              multiline
              accessibilityLabel="Beskriv vad du vill ha"
            />
            <Text style={styles.counter}>
              {prompt.length} / {PROMPT_MAX}
            </Text>
          </View>

          <Field label="Stad" value={city} onChangeText={setCity} placeholder="Göteborg" />

          <View style={styles.starters}>
            <Label>ELLER BÖRJA HÄR</Label>
            <View style={styles.starterRow}>
              {STARTERS.map((starter) => (
                <Chip
                  key={starter}
                  label={starter.split(' ').slice(0, 3).join(' ') + ' …'}
                  onPress={() => setPrompt(starter)}
                />
              ))}
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.step1Actions}>
            <Button
              label="Gör ett utkast"
              icon={<SparkIcon size={18} color={colors.ink} />}
              onPress={() => void generateDraft()}
              loading={drafting}
            />
            <Text style={styles.footnote}>Tar några sekunder. Inget publiceras än.</Text>
            <Button label="Fyll i själv" variant="secondary" onPress={() => setStep(2)} />
          </View>
        </View>
      </ScrollScreen>
    );
  }

  // --- Steg 2: utkastet ----------------------------------------------------

  const feeTotal = kronorToOre(Number(budget) || 0) * Math.max(1, Number(slots) || 1);
  const platformFee = Math.floor((feeTotal * PLATFORM_FEE_BPS) / 10_000);

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title="Nytt samarbete"
        onBack={() => setStep(1)}
        right={<Text style={styles.stepCounter}>2 / 2</Text>}
      />
      <Progress total={2} current={2} />

      {rationale ? (
        <View style={styles.aiNote}>
          <SparkIcon size={16} color={colors.accent} />
          <Text style={styles.aiNoteText}>{rationale}</Text>
        </View>
      ) : null}

      <Card>
        <Field label="Rubrik" value={title} onChangeText={setTitle} />
        <Field label="Brief till kreatören" value={brief} onChangeText={setBrief} multiline />
        <Field label="Stad" value={city} onChangeText={setCity} placeholder="Göteborg" />
      </Card>

      <Card>
        <Label>KATEGORI</Label>
        <View style={styles.chipRow}>
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
        <Label>PLATTFORMAR</Label>
        <View style={styles.chipRow}>
          {PLATFORMS.map((platform) => (
            <Chip
              key={platform}
              label={PLATFORM_LABELS[platform]}
              selected={platforms.includes(platform)}
              onPress={() => toggle(platform, platforms, setPlatforms)}
            />
          ))}
        </View>

        <Label>LEVERABLER</Label>
        <View style={styles.chipRow}>
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
        <Label>ERSÄTTNING</Label>
        <Segmented
          options={COMPENSATION_OPTIONS}
          value={compensationType}
          onChange={setCompensationType}
        />
        <View style={styles.moneyRow}>
          {compensationType !== 'PRODUCT' ? (
            <View style={styles.moneyField}>
              <Field
                label="Arvode (kr)"
                value={budget}
                onChangeText={setBudget}
                keyboardType="numeric"
              />
            </View>
          ) : null}
          {compensationType !== 'FIXED' ? (
            <View style={styles.moneyField}>
              <Field
                label="Besök (kr)"
                value={productValue}
                onChangeText={setProductValue}
                keyboardType="numeric"
              />
            </View>
          ) : null}
        </View>
        <View style={styles.moneyRow}>
          <View style={styles.moneyField}>
            <Field
              label="Antal kreatörer"
              value={slots}
              onChangeText={setSlots}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.moneyField}>
            <Field
              label="Lägsta följarantal"
              value={minFollowers}
              onChangeText={setMinFollowers}
              keyboardType="numeric"
            />
          </View>
        </View>
      </Card>

      {compensationType !== 'PRODUCT' ? (
        <Card tone="raised">
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Arvode {formatSek(kronorToOre(Number(budget) || 0))} × {slots}
            </Text>
            <Text style={styles.summaryValue}>{formatSek(feeTotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Plattformsavgift 12 %</Text>
            <Text style={styles.summaryValue}>{formatSek(platformFee)}</Text>
          </View>
          <Divider />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Du betalar in</Text>
            <Text style={styles.summaryTotal}>{formatSek(feeTotal)}</Text>
          </View>
          <Text style={styles.summaryNote}>
            Först när avtalet är signerat. Beloppet ligger spärrat hos oss tills du godkänt
            leveransen.
          </Text>
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button label="Publicera och hitta influencers" onPress={() => void publish()} loading={saving} />
      <Text style={styles.footnote}>
        Kampanjen ligger uppe i {DEFAULT_RUN_DAYS} dagar. Du kan pausa den när som helst.
      </Text>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  step1Content: { paddingTop: 0, flexGrow: 1 },
  content: { paddingTop: 0 },
  stepCounter: { ...type.label, color: colors.muted },

  step1Body: { flexGrow: 1, gap: spacing.base },
  intro: { gap: spacing.sm },
  stepTitle: { fontFamily: type.display.fontFamily, fontSize: 27, lineHeight: 31, letterSpacing: -0.54, color: colors.text },
  lead: { ...type.body, color: colors.muted },

  note: {
    minHeight: 150,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.base,
  },
  noteInput: {
    flex: 1,
    fontFamily: type.body.fontFamily,
    fontSize: 17,
    lineHeight: 25.5,
    color: colors.text,
    textAlignVertical: 'top',
  },
  counter: { ...type.secondary, fontSize: 12, color: colors.muted, textAlign: 'right' },

  starters: { gap: spacing.sm },
  starterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  step1Actions: { gap: spacing.sm },
  footnote: { ...type.secondary, color: colors.muted, textAlign: 'center' },
  error: { ...type.secondary, color: colors.danger },

  aiNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.tint,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  aiNoteText: { ...type.secondary, color: colors.text, flex: 1, lineHeight: 18 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  moneyRow: { flexDirection: 'row', gap: spacing.sm },
  moneyField: { flex: 1 },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  summaryLabel: { ...type.bodySmall, color: colors.muted },
  summaryValue: { ...type.bodySmall, color: colors.text },
  summaryTotalLabel: { ...type.listTitle, color: colors.text },
  summaryTotal: { ...type.amountSmall, color: colors.accent },
  summaryNote: { ...type.secondary, color: colors.muted, lineHeight: 18 },
});
