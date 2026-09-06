import { EXPERT_ORDER_QUESTIONS } from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { SparkIcon } from '../../src/components/icons';
import {
  Body,
  Button,
  Card,
  Field,
  Header,
  Label,
  Loading,
  ScrollScreen,
} from '../../src/components/ui';
import { formatSek } from '../../src/format';
import { colors, spacing, type } from '../../src/theme';
import type { ExpertAvailability, ExpertOrder } from '../../src/types';

type Answers = Record<string, string>;

/**
 * Beställning av en kampanj gjord av oss.
 *
 * Fyra frågor. Den som beställer det här gör det för att slippa fylla i
 * formulär, så ett långt intag hade motverkat hela poängen. Vi tar betalt
 * först när kampanjen är levererad och företaget sett den.
 */
export default function ExpertOrderScreen() {
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);

  const availability = useQuery({
    queryKey: ['expert-availability'],
    queryFn: () => api.get<ExpertAvailability>('/expert-orders/availability'),
  });

  const order = useMutation({
    mutationFn: () =>
      api.post<ExpertOrder>('/expert-orders', {
        goal: answers.goal?.trim() ?? '',
        timing: answers.timing?.trim() ?? '',
        budget: answers.budget?.trim() ?? '',
        notes: answers.notes?.trim() ?? '',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expert-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['expert-availability'] });
      router.replace('/business/campaigns');
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte skicka beställningen.'),
  });

  const send = () => {
    for (const question of EXPERT_ORDER_QUESTIONS) {
      if (question.required && (answers[question.key]?.trim().length ?? 0) < 3) {
        return setError(`Fyll i: ${question.label}`);
      }
    }
    setError(null);
    order.mutate();
  };

  const data = availability.data;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title="Låt en Pacta-expert göra det" onBack={() => router.back()} />

      {availability.isLoading ? <Loading /> : null}

      {data && !data.available ? (
        <Card>
          <Text style={styles.title}>Vi är fullbokade just nu</Text>
          <Body>
            Vi tar ett fåtal uppdrag åt gången för att hinna göra dem ordentligt. Titta in om
            några dagar – under tiden hjälper rådgivaren dig gratis.
          </Body>
          <Button
            label="Fråga Pacta i stället"
            variant="secondary"
            onPress={() => router.replace('/assistant')}
          />
        </Card>
      ) : null}

      {data?.hasOpenOrder ? (
        <Card>
          <Text style={styles.title}>Ni har redan ett uppdrag på gång</Text>
          <Body>Vi hör av oss så fort det är klart att granska.</Body>
          <Button
            label="Se status"
            variant="secondary"
            onPress={() => router.replace('/business/campaigns')}
          />
        </Card>
      ) : null}

      {data?.available && !data.hasOpenOrder ? (
        <>
          <Card tone="raised">
            <View style={styles.headRow}>
              <SparkIcon size={18} color={colors.accent} />
              <Text style={styles.title}>Vi bygger kampanjen åt er</Text>
            </View>
            <Body>
              Vi skriver briefen, sätter ersättningen och väljer ut kreatörerna med hjälp av
              siffrorna vi har på plattformen. Ni får den färdig i ert konto och publicerar
              själva.
            </Body>
            <Text style={styles.price}>{formatSek(data.price)}</Text>
            <Text style={styles.secondary}>
              Betalas först när kampanjen är klar och ni sagt ja till den.
            </Text>
          </Card>

          <View style={styles.section}>
            <Label>FYRA FRÅGOR</Label>
            {EXPERT_ORDER_QUESTIONS.map((question) => (
              <Field
                key={question.key}
                label={question.required ? question.label : `${question.label} (frivilligt)`}
                value={answers[question.key] ?? ''}
                onChangeText={(value) => {
                  setError(null);
                  setAnswers((current) => ({ ...current, [question.key]: value }));
                }}
                placeholder={question.placeholder}
                multiline
              />
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Skicka beställningen" onPress={send} loading={order.isPending} />
          <Text style={styles.secondary}>
            Vi hör av oss inom ett dygn. Ni binder er inte till något genom att skicka den här.
          </Text>
        </>
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: spacing.md },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { ...type.listTitle, color: colors.text },
  price: { ...type.sectionTitle, color: colors.accent },
  secondary: { ...type.secondary, color: colors.muted },
  section: { gap: spacing.sm },
  error: { ...type.secondary, color: colors.danger },
});
