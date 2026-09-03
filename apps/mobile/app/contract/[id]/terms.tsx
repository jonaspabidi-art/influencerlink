import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { api } from '../../../src/api';
import { Header, Loading, ScrollScreen } from '../../../src/components/ui';
import { colors, type } from '../../../src/theme';
import type { Contract } from '../../../src/types';

/** Hela avtalstexten i eget läge, så att detaljvyn kan hålla sig kort. */
export default function ContractTerms() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const contract = useQuery({
    queryKey: ['contract', id],
    queryFn: () => api.get<Contract>(`/contracts/${id}`),
    enabled: Boolean(id),
  });

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title="Avtalstext" onBack={() => router.back()} />
      {contract.isLoading || !contract.data ? (
        <Loading />
      ) : (
        <Text style={styles.terms}>{contract.data.terms}</Text>
      )}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  terms: { fontFamily: type.bodySmall.fontFamily, fontSize: 14, lineHeight: 22, color: colors.text },
});
