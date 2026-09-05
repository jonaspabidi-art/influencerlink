import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../src/api';
import { SparkIcon } from '../src/components/icons';
import { Body, Button, Card, Field, Header, Label, ScrollScreen } from '../src/components/ui';
import { colors, radius, spacing, type } from '../src/theme';
import type { Campaign } from '../src/types';

interface Answer {
  available: boolean;
  answer: string | null;
  candidateCount: number;
}

/** Frågor som faktiskt hjälper någon som gör det här första gången. */
const SUGGESTIONS = [
  'Vem av kreatörerna passar oss bäst, och varför?',
  'Vad är ett rimligt arvode för ett samarbete hos oss?',
  'Hur vet jag om en kreatör är värd sitt pris?',
  'Hur skriver jag en brief som ger bra innehåll?',
];

/**
 * Rådgivaren.
 *
 * Företagaren har sällan gjort det här förut. Svaret bygger på kreatörerna som
 * faktiskt finns i staden och på plattformens egna regler – modellen får inte
 * hitta på en profil, och den lovar inget om utfallet.
 */
export default function Assistant() {
  const { campaignId } = useLocalSearchParams<{ campaignId?: string }>();
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const campaign = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: () => api.get<Campaign>(`/campaigns/${campaignId}`),
    enabled: Boolean(campaignId),
  });

  const ask = useMutation({
    mutationFn: (text: string) =>
      api.post<Answer>('/assistant/ask', {
        question: text,
        ...(campaignId ? { campaignId } : {}),
      }),
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte hämta ett svar.'),
  });

  const send = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < 3) return setError('Skriv din fråga först.');
    setError(null);
    setAsked(trimmed);
    ask.mutate(trimmed);
  };

  const result = ask.data;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title="Fråga Pacta"
        subtitle={campaign.data ? campaign.data.title : 'Hjälp att välja rätt kreatör'}
        onBack={() => router.back()}
      />

      <Card tone="raised">
        <View style={styles.headRow}>
          <SparkIcon size={18} color={colors.accent} />
          <Text style={styles.headTitle}>Vad vill du veta?</Text>
        </View>
        <Body>
          Svaren bygger på kreatörerna som finns i din stad och på deras riktiga siffror. Vi
          gissar inte, och vi lovar inget om resultatet.
        </Body>
      </Card>

      {asked ? (
        <>
          <View style={styles.question}>
            <Label>DIN FRÅGA</Label>
            <Text style={styles.questionText}>{asked}</Text>
          </View>

          <Card>
            {ask.isPending ? (
              <Body>Tänker …</Body>
            ) : result?.answer ? (
              <>
                <Text style={styles.answer}>{result.answer}</Text>
                <Text style={styles.secondary}>
                  {result.candidateCount === 0
                    ? 'Inga kreatörer i din stad än – svaret är allmänt.'
                    : `Bygger på ${result.candidateCount} ${
                        result.candidateCount === 1 ? 'kreatör' : 'kreatörer'
                      } i din stad.`}
                </Text>
              </>
            ) : (
              <Body>
                {result && !result.available
                  ? 'Rådgivaren är inte påslagen än. Lägg in en API-nyckel för Claude i Railway så börjar den svara.'
                  : 'Inget svar den här gången. Prova att fråga om igen.'}
              </Body>
            )}
          </Card>
        </>
      ) : null}

      <Field
        label="Din fråga"
        value={question}
        onChangeText={setQuestion}
        placeholder="Skriv vad du undrar över"
        multiline
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label="Fråga" onPress={() => send(question)} loading={ask.isPending} />

      <View style={styles.section}>
        <Label>ELLER BÖRJA HÄR</Label>
        {SUGGESTIONS.map((suggestion) => (
          <Pressable
            key={suggestion}
            accessibilityRole="button"
            accessibilityLabel={suggestion}
            onPress={() => {
              setQuestion(suggestion);
              send(suggestion);
            }}
            style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
          >
            <Text style={styles.suggestionText}>{suggestion}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: spacing.md },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headTitle: { ...type.listTitle, color: colors.text },
  question: { gap: 2 },
  questionText: { ...type.body, color: colors.text },
  answer: { ...type.body, color: colors.text },
  secondary: { ...type.secondary, color: colors.muted },
  error: { ...type.secondary, color: colors.danger },
  section: { gap: spacing.sm },
  suggestion: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    padding: spacing.md,
  },
  pressed: { opacity: 0.8 },
  suggestionText: { ...type.bodySmall, color: colors.primary },
});
