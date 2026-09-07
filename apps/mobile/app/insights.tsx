import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../src/api';
import { SparkIcon } from '../src/components/icons';
import {
  Body,
  Button,
  Card,
  Divider,
  ErrorState,
  Header,
  Label,
  Loading,
  ScrollScreen,
} from '../src/components/ui';
import { insightsQuery } from '../src/queries';
import { colors, radius, spacing, type } from '../src/theme';
import type { CreatorInsights } from '../src/types';

interface Advice {
  available: boolean;
  advice: string | null;
}

/**
 * Varför får jag få matchningar?
 *
 * Skärmen är byggd i den ordning frågan faktiskt går att besvara. Först det
 * som är räknat: hur många kampanjer som ligger ute, hur många hon är behörig
 * till, och vad de andra faller på. Sedan stegen, med antalet kampanjer varje
 * steg öppnar – de talen är kontrollerade mot kampanjerna, inte uppskattade.
 * Sist rådet från modellen, som bara får prioritera bland det som redan står.
 *
 * Ordningen är hela poängen. Ett råd först hade läst som en spådom; efter
 * siffrorna läser det som en slutsats man kan kontrollera.
 */
export default function Insights() {
  const insights = useQuery(insightsQuery());
  const [asked, setAsked] = useState(false);

  /*
   * Rådet hämtas först när hon ber om det.
   *
   * Skärmen är läsbar utan det – siffrorna står där de står. Att starta ett
   * modellanrop bara för att någon öppnat skärmen är att svara på en fråga
   * ingen ställt, och det syns som en spinner mitt i det som redan är klart.
   */
  const advice = useQuery({
    queryKey: ['insights', 'advice'],
    queryFn: () => api.post<Advice>('/me/insights/advice'),
    enabled: asked,
    staleTime: 30 * 60_000,
    retry: false,
  });

  if (insights.isLoading) {
    return (
      <ScrollScreen>
        <Header title="Dina matchningar" onBack={() => router.back()} />
        <Loading />
      </ScrollScreen>
    );
  }

  if (insights.isError || !insights.data) {
    return (
      <ScrollScreen>
        <Header title="Dina matchningar" onBack={() => router.back()} />
        <ErrorState message="Kunde inte räkna ut läget just nu." onRetry={() => void insights.refetch()} />
      </ScrollScreen>
    );
  }

  const data = insights.data;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title="Varför får jag få matchningar?"
        subtitle="Räknat på kampanjerna som ligger ute just nu"
        onBack={() => router.back()}
      />

      <Numbers data={data} />
      <Blockers data={data} />
      <Actions data={data} />
      <Gaps data={data} />

      <Card tone="raised">
        <View style={styles.headRow}>
          <SparkIcon size={18} color={colors.accent} />
          <Text style={styles.headTitle}>Vad du bör göra först</Text>
        </View>

        {!asked ? (
          <>
            <Body>
              Vi läser igenom siffrorna ovan och säger vilket steg som är värt att ta först.
              Vi räknar inte om något – rådet bygger på det du redan ser.
            </Body>
            <Button label="Fråga Pacta" onPress={() => setAsked(true)} />
          </>
        ) : advice.isFetching ? (
          <Loading label="Läser igenom ditt läge" />
        ) : advice.data?.advice ? (
          <Text style={styles.advice}>{advice.data.advice}</Text>
        ) : (
          <>
            <Body>
              Vi kunde inte skriva ihop ett råd just nu. Siffrorna ovan gäller ändå – de är
              räknade, inte hämtade härifrån.
            </Body>
            <Button label="Försök igen" variant="secondary" onPress={() => void advice.refetch()} />
          </>
        )}
      </Card>
    </ScrollScreen>
  );
}

/** Det hårda talet först: behörig till hur många av dem som finns. */
function Numbers({ data }: { data: CreatorInsights }) {
  return (
    <Card>
      <Text style={styles.secondary}>Du kan söka</Text>
      <Text style={styles.hero}>
        {data.eligible} av {data.openCampaigns}
      </Text>
      <Text style={styles.secondary}>
        {data.openCampaigns === 1 ? 'kampanj ligger ute' : 'kampanjer ligger ute just nu'}
      </Text>

      <Divider />

      <Row label={`I ${data.city}`} value={String(data.eligibleInCity)} />
      <Row label="Kvar att svepa på" value={String(data.waiting)} />
      <Row label="Du har redan svarat på" value={String(data.reviewed)} />
      <Row label="Matchningar totalt" value={String(data.matches)} />
    </Card>
  );
}

/** Vad de bortsorterade kampanjerna faller på. Inte gissat – räknat per hinder. */
function Blockers({ data }: { data: CreatorInsights }) {
  const rows = [
    { label: 'Kräver fler följare än du har', count: data.blockers.followers },
    { label: 'Efterfrågar en plattform du inte har', count: data.blockers.platforms },
    { label: 'Budgeten ligger under ditt lägstapris', count: data.blockers.budget },
  ].filter((row) => row.count > 0);

  if (rows.length === 0) return null;

  return (
    <View style={styles.section}>
      <Label>VARFÖR DE ANDRA INTE SYNS</Label>
      <Card>
        {rows.map((row) => (
          <Row
            key={row.label}
            label={row.label}
            value={`${row.count} ${row.count === 1 ? 'kampanj' : 'kampanjer'}`}
          />
        ))}
      </Card>
    </View>
  );
}

/**
 * Stegen. Varje rad säger exakt hur många kampanjer den öppnar, och bara
 * kampanjer där just det hindret är det enda räknas – annars vore siffran ett
 * löfte som inte infrias.
 */
function Actions({ data }: { data: CreatorInsights }) {
  if (data.actions.length === 0) return null;

  return (
    <View style={styles.section}>
      <Label>DET HÄR SKULLE ÖPPNA FLER</Label>
      {data.actions.map((action) => (
        <Card key={`${action.kind}-${action.message}`}>
          <View style={styles.actionRow}>
            <Text style={styles.unlocks}>+{action.unlocks}</Text>
            <Text style={styles.actionText}>{action.message}</Text>
          </View>
          {action.kind === 'BUDGET' ? (
            <Button
              label="Ändra mitt lägstapris"
              variant="secondary"
              onPress={() => router.push('/profile/edit')}
            />
          ) : null}
          {action.kind === 'PLATFORMS' ? (
            <Button
              label="Koppla ett konto"
              variant="secondary"
              onPress={() => router.push('/social')}
            />
          ) : null}
        </Card>
      ))}
    </View>
  );
}

/** Luckorna i profilen. De blockerar ingenting, men företaget ser dem. */
function Gaps({ data }: { data: CreatorInsights }) {
  if (data.gaps.length === 0) return null;

  return (
    <View style={styles.section}>
      <Label>DIN PROFIL</Label>
      <Card>
        {data.gaps.map((gap) => (
          <View key={gap.field} style={styles.gapRow}>
            <View style={styles.dot} />
            <Text style={styles.gapText}>{gap.message}</Text>
          </View>
        ))}
        <Button
          label="Redigera profilen"
          variant="secondary"
          onPress={() => router.push('/profile/edit')}
        />
      </Card>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: 14 },
  section: { gap: spacing.sm },
  secondary: { ...type.secondary, color: colors.muted },
  hero: { ...type.amountHero, color: colors.accent },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rowLabel: { ...type.bodySmall, color: colors.muted, flex: 1 },
  rowValue: { fontFamily: type.rowTitle.fontFamily, fontSize: 15, color: colors.text },

  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  unlocks: {
    fontFamily: type.rowTitle.fontFamily,
    fontSize: 15,
    color: colors.positive,
    backgroundColor: colors.raised,
    borderRadius: radius.control,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  actionText: { ...type.bodySmall, color: colors.text, flex: 1 },

  gapRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.muted,
    marginTop: 7,
  },
  gapText: { ...type.bodySmall, color: colors.muted, flex: 1 },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headTitle: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.text },
  advice: { ...type.body, color: colors.text },
});
