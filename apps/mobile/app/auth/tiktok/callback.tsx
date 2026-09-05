import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text } from 'react-native';
import { api, ApiError } from '../../../src/api';
import { Body, Button, Card, Header, Loading, ScrollScreen } from '../../../src/components/ui';
import { colors, spacing, type } from '../../../src/theme';
import type { SocialAccount } from '../../../src/types';

/**
 * Hit skickar TikTok tillbaka kreatören efter inloggningen.
 *
 * Adressen måste vara exakt den som står i TikToks utvecklarportal. Koden i
 * frågesträngen växlas in av servern – den lämnar aldrig appen till någon annan
 * än vårt eget API.
 */
export default function TikTokCallback() {
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }>();
  const started = useRef(false);

  const connect = useMutation({
    mutationFn: (input: { code: string; state: string }) =>
      api.post<SocialAccount>('/me/influencer-profile/socials/tiktok/connect', input),
    onSuccess: () => router.replace('/social'),
  });

  // Koden går bara att lösa in en gång, så den får inte skickas två gånger.
  useEffect(() => {
    if (started.current) return;
    if (!params.code || !params.state) return;
    started.current = true;
    connect.mutate({ code: params.code, state: params.state });
  }, [params.code, params.state, connect]);

  const denied = params.error
    ? params.error_description || 'Du avbröt inloggningen hos TikTok.'
    : null;
  const failed =
    connect.error instanceof ApiError
      ? connect.error.message
      : connect.error
        ? 'Kopplingen gick inte igenom.'
        : null;
  const missing = !params.code && !params.error ? 'Svaret från TikTok saknade en kod.' : null;
  const problem = denied ?? failed ?? missing;

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title="Kopplar TikTok" />
      {problem ? (
        <Card>
          <Text style={styles.error}>{problem}</Text>
          <Body>Inget är sparat. Du kan försöka igen från Sociala konton.</Body>
          <Button label="Tillbaka" onPress={() => router.replace('/social')} />
        </Card>
      ) : (
        <Loading label="Hämtar dina siffror från TikTok …" />
      )}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  error: { ...type.secondary, color: colors.danger },
});
