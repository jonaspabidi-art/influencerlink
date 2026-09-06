import {
  CATEGORIES,
  DELIVERABLE_KINDS,
  PLATFORMS,
  type Category,
  type DeliverableKind,
  type Platform,
} from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import {
  Body,
  Button,
  Card,
  Chip,
  Field,
  Header,
  Label,
  Loading,
  ScrollScreen,
} from '../../src/components/ui';
import {
  CATEGORY_LABELS,
  DELIVERABLE_LABELS,
  PLATFORM_LABELS,
  kronorToOre,
  oreToKronor,
} from '../../src/format';
import { colors, spacing, type } from '../../src/theme';
import type { Campaign } from '../../src/types';

const RUN_DAYS = 30;

/**
 * Kampanjen vi bygger åt ett företag.
 *
 * Den sparas alltid som utkast. Att publicera är företagets beslut – det är de
 * som binder sig ekonomiskt, inte vi.
 */
export default function AdminCampaignEditor() {
  const { businessId, campaignId } = useLocalSearchParams<{
    businessId?: string;
    campaignId?: string;
  }>();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [city, setCity] = useState('');
  const [budget, setBudget] = useState('');
  const [slots, setSlots] = useState('1');
  const [categories, setCategories] = useState<Category[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>(['TIKTOK']);
  const [deliverables, setDeliverables] = useState<DeliverableKind[]>(['TIKTOK_VIDEO']);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.get<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
  });

  const loaded = existing.data;
  useEffect(() => {
    if (!loaded) return;
    setTitle(loaded.title);
    setBrief(loaded.brief);
    setCity(loaded.city);
    setBudget(String(oreToKronor(loaded.budgetPerCreator)));
    setSlots(String(loaded.slots));
    setCategories(loaded.categories);
    setPlatforms(loaded.platforms);
    setDeliverables(loaded.deliverables);
  }, [loaded]);

  const toggle = <T,>(list: T[], set: (next: T[]) => void, value: T, max: number) => {
    setError(null);
    set(
      list.includes(value)
        ? list.filter((item) => item !== value)
        : list.length < max
          ? [...list, value]
          : list,
    );
  };

  const save = useMutation({
    mutationFn: () => {
      const now = new Date();
      const end = new Date(now.getTime() + RUN_DAYS * 24 * 60 * 60 * 1000);
      const campaign = {
        title: title.trim(),
        brief: brief.trim(),
        categories,
        platforms,
        deliverables,
        compensationType: 'FIXED' as const,
        budgetPerCreator: kronorToOre(Number(budget) || 0),
        productValue: 0,
        slots: Math.max(1, Number(slots) || 1),
        city: city.trim(),
        minFollowers: 0,
        imageUrl: null,
        startDate: now.toISOString(),
        endDate: end.toISOString(),
      };
      return campaignId
        ? api.patch(`/admin/campaigns/${campaignId}`, { campaign })
        : api.post('/admin/campaigns', { businessId, campaign });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-business'] });
      router.back();
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte spara kampanjen.'),
  });

  const submit = () => {
    if (title.trim().length < 4) return setError('Rubriken är för kort.');
    if (brief.trim().length < 10) return setError('Beskriv uppdraget.');
    if (city.trim().length < 2) return setError('Ange stad.');
    if (categories.length === 0) return setError('Välj minst en nisch.');
    if (platforms.length === 0) return setError('Välj minst en plattform.');
    if (deliverables.length === 0) return setError('Välj minst en leverabel.');
    if (kronorToOre(Number(budget) || 0) <= 0) return setError('Ange ett arvode.');
    setError(null);
    save.mutate();
  };

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title={campaignId ? 'Ändra kampanjen' : 'Ny kampanj åt företaget'}
        onBack={() => router.back()}
      />

      {existing.isLoading ? <Loading /> : null}

      <Card>
        <Body>
          Kampanjen sparas som utkast. Företaget publicerar den själv – det är de som binder sig.
        </Body>
      </Card>

      <Field label="Rubrik" value={title} onChangeText={setTitle} />
      <Field label="Brief" value={brief} onChangeText={setBrief} multiline />
      <Field label="Stad" value={city} onChangeText={setCity} />
      <View style={styles.row}>
        <View style={styles.half}>
          <Field label="Arvode (kr)" value={budget} onChangeText={setBudget} keyboardType="numeric" />
        </View>
        <View style={styles.half}>
          <Field label="Antal" value={slots} onChangeText={setSlots} keyboardType="numeric" />
        </View>
      </View>

      <View style={styles.section}>
        <Label>NISCHER</Label>
        <View style={styles.chipRow}>
          {CATEGORIES.map((item) => (
            <Chip
              key={item}
              label={CATEGORY_LABELS[item]}
              selected={categories.includes(item)}
              onPress={() => toggle(categories, setCategories, item, 6)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Label>PLATTFORMAR</Label>
        <View style={styles.chipRow}>
          {PLATFORMS.map((item) => (
            <Chip
              key={item}
              label={PLATFORM_LABELS[item]}
              selected={platforms.includes(item)}
              onPress={() => toggle(platforms, setPlatforms, item, 3)}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Label>LEVERABLER</Label>
        <View style={styles.chipRow}>
          {DELIVERABLE_KINDS.map((item) => (
            <Chip
              key={item}
              label={DELIVERABLE_LABELS[item]}
              selected={deliverables.includes(item)}
              onPress={() => toggle(deliverables, setDeliverables, item, 10)}
            />
          ))}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Spara som utkast" onPress={submit} loading={save.isPending} />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  section: { gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { ...type.secondary, color: colors.danger },
});
