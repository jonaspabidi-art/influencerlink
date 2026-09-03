import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/api';
import {
  Avatar,
  Body,
  Button,
  Card,
  Chip,
  Divider,
  Header,
  Label,
  Loading,
  ScrollScreen,
  Tag,
} from '../../src/components/ui';
import {
  CATEGORY_LABELS,
  DELIVERABLE_LABELS,
  PLATFORM_LABELS,
  describeCompensation,
  formatDate,
  formatSek,
} from '../../src/format';
import { colors, spacing, type } from '../../src/theme';
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
      <ScrollScreen>
        <Loading />
      </ScrollScreen>
    );
  }

  const data = campaign.data;
  const pending = (applications.data ?? []).filter((item) => item.status === 'PENDING');

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header title="Kampanj" onBack={() => router.back()} />

      <View style={styles.titleBlock}>
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.secondary}>
          {data.city} · {data.slotsFilled} av {data.slots} platser · till {formatDate(data.endDate)}
        </Text>
      </View>

      <Card>
        <Label>ERSÄTTNING</Label>
        <Text style={styles.amount}>
          {describeCompensation(
            data.compensationType,
            data.budgetPerCreator,
            data.productValue,
            formatSek,
          )}
        </Text>
        <Divider />
        <Text style={styles.secondary}>
          Minst {data.minFollowers.toLocaleString('sv-SE')} följare · {' '}
          {data.platforms.map((platform) => PLATFORM_LABELS[platform]).join(', ')}
        </Text>
      </Card>

      <Card>
        <Label>BRIEF</Label>
        <Body>{data.brief}</Body>
        <View style={styles.tagRow}>
          {data.deliverables.map((deliverable) => (
            <Tag key={deliverable} label={DELIVERABLE_LABELS[deliverable]} />
          ))}
          {data.categories.map((category) => (
            <Tag key={category} label={CATEGORY_LABELS[category]} tone="outline" />
          ))}
        </View>
      </Card>

      {data.status === 'ACTIVE' ? (
        <Button label="Hitta influencers" onPress={() => router.push(`/discover/${data.id}`)} />
      ) : null}

      <Card>
        <Label>ANSÖKNINGAR</Label>
        {applications.isLoading ? <Text style={styles.secondary}>Hämtar …</Text> : null}
        {!applications.isLoading && pending.length === 0 ? (
          <Text style={styles.secondary}>
            Inga obehandlade ansökningar. Kreatörer kan både svepa och söka med en egen pitch.
          </Text>
        ) : null}
        {pending.map((application) => (
          <View key={application.id} style={styles.application}>
            <View style={styles.applicantRow}>
              <Avatar uri={application.influencer.avatarUrl} size={40} />
              <View style={styles.applicantText}>
                <Text style={styles.applicantName}>{application.influencer.displayName}</Text>
                <Text style={styles.secondary}>{application.influencer.city}</Text>
              </View>
              {application.proposedFee !== null ? (
                <Text style={styles.proposedFee}>{formatSek(application.proposedFee)}</Text>
              ) : null}
            </View>
            <Body>{application.pitch}</Body>
            <View style={styles.applicationActions}>
              <Button
                label="Tacka nej"
                variant="secondary"
                onPress={() => decide.mutate({ applicationId: application.id, accept: false })}
                style={styles.applicationButton}
              />
              <Button
                label="Matcha"
                onPress={() => decide.mutate({ applicationId: application.id, accept: true })}
                style={styles.applicationButton}
              />
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <Label>STATUS</Label>
        <View style={styles.tagRow}>
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
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0 },
  titleBlock: { gap: 6 },
  title: { fontFamily: type.cardTitle.fontFamily, fontSize: 23, lineHeight: 27.6, color: colors.text },
  secondary: { ...type.secondary, color: colors.muted },
  amount: { fontFamily: type.rowTitle.fontFamily, fontSize: 18, color: colors.accent },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  application: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  applicantRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  applicantText: { flex: 1 },
  applicantName: { ...type.listTitle, color: colors.text },
  proposedFee: { fontFamily: type.rowTitle.fontFamily, fontSize: 15, color: colors.accent },
  applicationActions: { flexDirection: 'row', gap: spacing.sm },
  applicationButton: { flex: 1 },
});
