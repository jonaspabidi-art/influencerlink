import { PREPAY_MONTHS, RETAINER_PACKAGES } from '@pacta/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import {
  Avatar,
  Body,
  Button,
  Card,
  Divider,
  Header,
  Label,
  Loading,
  ScrollScreen,
} from '../../src/components/ui';
import { formatFollowers, formatSek } from '../../src/format';
import { colors, radius, spacing, type } from '../../src/theme';
import type { InfluencerProfile, RatingSummary } from '../../src/types';

type Available = InfluencerProfile & { rating: RatingSummary };

/** Vad som faktiskt händer, i den ordning det händer. */
const STEPS = [
  'Kreatören filmar hos er, en dag i veckan eller varannan.',
  'Ni ser varje film och bildtext i appen och godkänner innan något publiceras.',
  'Kreatören lägger upp den på ert eget konto. Materialet blir ert.',
];

/**
 * Ingången till löpande uppdrag.
 *
 * Knappen ledde tidigare till kreatörslistan med ett filter på. Men en lista
 * med personer förklarar inte vad man köper – den förutsätter att man redan
 * vet, och det gör en krögare som aldrig gjort det här förut inte.
 *
 * Ordningen här är därför: vad det är, vad det kostar, och först därefter vem
 * som är ledig. Personerna är det sista beslutet, inte det första.
 */
export default function RetainerStart() {
  const creators = useQuery({
    queryKey: ['browse-influencers', 'retainers'],
    queryFn: () => api.get<Available[]>('/influencers?retainers=1'),
  });

  const available = creators.data ?? [];
  const cheapest = available
    .map((creator) => creator.retainerPackages[0]?.monthlyRate ?? 0)
    .filter((rate) => rate > 0)
    .sort((a, b) => a - b)[0];

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title="Löpande uppdrag"
        subtitle="Innehåll till era egna kanaler, varje månad"
        onBack={() => router.back()}
      />

      <Card tone="raised">
        <Body>
          En kampanj går ut på kreatörens kanal och når kreatörens följare, en gång. Ett löpande
          uppdrag är motsatsen: innehållet går ut på <Text style={styles.strong}>ert eget
          konto</Text>, vecka efter vecka, och blir kvar hos er.
        </Body>
      </Card>

      <View style={styles.section}>
        <Label>SÅ GÅR DET TILL</Label>
        <Card>
          {STEPS.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <Text style={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </Card>
      </View>

      <View style={styles.section}>
        <Label>VAD DET KOSTAR</Label>
        <Card>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Videor i månaden</Text>
            <Text style={styles.priceValue}>{RETAINER_PACKAGES.join(', ')}</Text>
          </View>
          <Divider />
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Från</Text>
            <Text style={styles.priceValue}>
              {cheapest ? `${formatSek(Math.round(cheapest * 1.1))} i månaden` : 'Sätts av kreatören'}
            </Text>
          </View>
          <Divider />
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Bindningstid</Text>
            <Text style={styles.priceValue}>Ingen</Text>
          </View>
          <Text style={styles.footnote}>
            Ni betalar en månad i taget, i förskott. Levereras färre videor än avtalat får ni
            mellanskillnaden tillbaka. Vissa kreatörer ger rabatt om ni betalar {PREPAY_MONTHS}{' '}
            månader på en gång.
          </Text>
        </Card>
      </View>

      <View style={styles.section}>
        <Label>LEDIGA PLATSER NU</Label>
        {creators.isLoading ? <Loading /> : null}

        {!creators.isLoading && available.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>Ingen har en ledig plats just nu</Text>
            <Body>
              Platserna är riktiga – en dag i veckan går inte att sälja två gånger. Titta igen om
              någon dag, eller kör en enstaka kampanj under tiden.
            </Body>
            <Button
              label="Skapa kampanj i stället"
              variant="secondary"
              onPress={() => router.push('/campaign/new')}
            />
          </Card>
        ) : null}

        {available.map((creator) => (
          /* Samma delning som i utbudslistan: en yta som öppnar profilen, en
             knapp som frågar. En knapp inuti en knapp är ogiltig på webben. */
          <View key={creator.id} style={styles.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Öppna ${creator.displayName}s profil`}
              onPress={() =>
                router.push({
                  pathname: '/creator/[id]',
                  params: { id: creator.id, name: creator.displayName },
                })
              }
              style={({ pressed }) => [styles.rowTop, pressed && styles.pressed]}
            >
              <Avatar uri={creator.avatarUrl} name={creator.displayName} size={44} />
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {creator.displayName}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {formatFollowers(creator.followers)} följare · {creator.city}
                </Text>
                <Text style={styles.rowPrice}>
                  Från{' '}
                  {formatSek(Math.round((creator.retainerPackages[0]?.monthlyRate ?? 0) * 1.1))}
                  /mån · {creator.retainerSlots}{' '}
                  {creator.retainerSlots === 1 ? 'plats' : 'platser'}
                </Text>
              </View>
            </Pressable>

            <Button
              label="Fråga om en plats"
              compact
              onPress={() =>
                router.push({
                  pathname: '/retainer/new',
                  params: { influencerId: creator.id },
                })
              }
            />
          </View>
        ))}
      </View>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: 14 },
  section: { gap: spacing.sm },
  strong: { fontFamily: type.listTitle.fontFamily },
  footnote: { ...type.secondary, color: colors.muted },
  emptyTitle: { ...type.listTitle, color: colors.text },

  stepRow: { flexDirection: 'row', gap: spacing.md },
  stepNumber: { fontFamily: type.label.fontFamily, fontSize: 11, color: colors.muted, paddingTop: 3 },
  stepText: { ...type.bodySmall, color: colors.text, flex: 1 },

  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  priceLabel: { ...type.bodySmall, color: colors.muted, flex: 1 },
  priceValue: { fontFamily: type.rowTitle.fontFamily, fontSize: 15, color: colors.text },

  row: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.base,
  },
  pressed: { opacity: 0.9 },
  rowTop: { flexDirection: 'row', gap: spacing.md },
  rowText: { flex: 1, gap: 4 },
  name: { ...type.listTitle, fontSize: 16, color: colors.text },
  meta: { ...type.secondary, color: colors.muted },
  rowPrice: { ...type.secondary, color: colors.accent },
});
