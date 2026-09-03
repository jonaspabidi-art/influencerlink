import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import {
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Heading,
  Loading,
  Screen,
  Title,
} from '../../src/components/ui';
import {
  CATEGORY_LABELS,
  DELIVERABLE_LABELS,
  PLATFORM_LABELS,
  describeCompensation,
  formatDate,
  formatSek,
} from '../../src/format';
import { colors, radius, spacing, typography } from '../../src/theme';
import type { Campaign } from '../../src/types';

interface Application {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  pitch: string;
  proposedFee: number | null;
  createdAt: string;
  influencer: { id: string; displayName: string; avatarUrl: string | null; city: string };
}

export default function CampaignDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const campaign = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.get<Campaign>(`/campaigns/${id}`),
    enabled: Boolean(id),
  });

  const applications = useQuery({
    queryKey: ['applications', id],
    queryFn: () => api.get<Application[]>(`/campaigns/${id}/applications`),
    enabled: Boolean(id),
  });

  const setStatus = useMutation({
    mutationFn: (status: 'ACTIVE' | 'PAUSED' | 'CLOSED') =>
      api.post<Campaign>(`/campaigns/${id}/status`, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      void queryClient.invalidateQueries({ queryKey: ['campaigns', 'mine'] });
    },
  });

  const decide = useMutation({
    mutationFn: (input: { applicationId: string; accept: boolean }) =>
      api.post<{ matchId: string | null }>(`/applications/${input.applicationId}/decision`, {
        accept: input.accept,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['applications', id] });
      void queryClient.invalidateQueries({ queryKey: ['matches'] });
      if (result.matchId) router.push(`/match/${result.matchId}`);
    },
  });

  if (campaign.isLoading || !campaign.data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const data = campaign.data;
  const pending = (applications.data ?? []).filter((item) => item.status === 'PENDING');

  return (
    <Screen scroll>
      <Title>{data.title}</Title>
      <Caption>
        {data.city} · {data.slotsFilled}/{data.slots} platser · till {formatDate(data.endDate)}
      </Caption>

      <Card>
        <Heading>Ersättning</Heading>
        <Text style={styles.pay}>
          {describeCompensation(
            data.compensationType,
            data.budgetPerCreator,
            data.productValue,
            formatSek,
          )}
        </Text>
        <Caption>Minst {data.minFollowers.toLocaleString('sv-SE')} följare.</Caption>
      </Card>

      <Card>
        <Heading>Brief</Heading>
        <Body muted>{data.brief}</Body>
        <View style={styles.chips}>
          {data.categories.map((category) => (
            <Chip key={category} label={CATEGORY_LABELS[category]} />
          ))}
          {data.platforms.map((platform) => (
            <Chip key={platform} label={PLATFORM_LABELS[platform]} />
          ))}
          {data.deliverables.map((deliverable) => (
            <Chip key={deliverable} label={DELIVERABLE_LABELS[deliverable]} />
          ))}
        </View>
      </Card>

      {data.status === 'ACTIVE' ? (
        <Button label="Hitta influencers" onPress={() => router.push(`/discover/${data.id}`)} />
      ) : null}

      <Card>
        <Heading>Ansökningar</Heading>
        {applications.isLoading ? <Caption>Hämtar …</Caption> : null}
        {!applications.isLoading && pending.length === 0 ? (
          <Caption>Inga obehandlade ansökningar just nu.</Caption>
        ) : null}
        {pending.map((application) => (
          <View key={application.id} style={styles.application}>
            <Text style={styles.applicant}>
              {application.influencer.displayName} · {application.influencer.city}
            </Text>
            <Body muted>{application.pitch}</Body>
            {application.proposedFee !== null ? (
              <Caption>Föreslår {formatSek(application.proposedFee)}</Caption>
            ) : null}
            <View style={styles.applicationActions}>
              <Button
                label="Tacka nej"
                variant="ghost"
                onPress={() => decide.mutate({ applicationId: application.id, accept: false })}
              />
              <Button
                label="Matcha"
                onPress={() => decide.mutate({ applicationId: application.id, accept: true })}
              />
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Heading>Status</Heading>
        <View style={styles.chips}>
          {(['ACTIVE', 'PAUSED', 'CLOSED'] as const).map((status) => (
            <Chip
              key={status}
              label={
                status === 'ACTIVE' ? 'Publicerad' : status === 'PAUSED' ? 'Pausad' : 'Avslutad'
              }
              selected={data.status === status}
              onPress={() => setStatus.mutate(status)}
            />
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pay: { ...typography.heading, color: colors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  application: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
    borderRadius: radius.sm,
  },
  applicant: { ...typography.label, color: colors.text, fontSize: 15 },
  applicationActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
});
