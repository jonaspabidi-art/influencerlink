import { DRAFT_STATUS_LABELS, MAX_VIDEO_BYTES, type DraftStatus } from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { colors, radius, spacing, type } from '../theme';
import type { Draft } from '../types';
import { Body, Button, Card, Field, Label, Loading, StatusBadge, type StatusTone } from './ui';
import { VideoPlayer } from './VideoPlayer';

/**
 * Utkastet: kreatören lämnar filmen för godkännande, företaget svarar.
 *
 * Filen går direkt till lagringen med en signerad adress – den passerar aldrig
 * vårt API. Först när den ligger uppe sparar vi raden, så en avbruten
 * uppladdning inte lämnar ett utkast som pekar på ingenting.
 */
export function DraftReview({
  contractId,
  role,
  contractStatus,
}: {
  contractId: string;
  role: 'INFLUENCER' | 'BUSINESS';
  contractStatus: string;
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const drafts = useQuery({
    queryKey: ['drafts', contractId],
    queryFn: () => api.get<Draft[]>(`/contracts/${contractId}/drafts`),
    enabled: Boolean(contractId),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['drafts', contractId] });
    void queryClient.invalidateQueries({ queryKey: ['contract', contractId] });
  };

  const review = useMutation({
    mutationFn: (input: { draftId: string; approve: boolean; note: string }) =>
      api.post<Draft>(`/drafts/${input.draftId}/review`, {
        approve: input.approve,
        note: input.note,
      }),
    onSuccess: () => {
      setReviewNote('');
      refresh();
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte spara svaret.'),
  });

  const upload = async () => {
    setError(null);

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];
    const contentType = asset.mimeType ?? 'video/mp4';
    const response = await fetch(asset.uri);
    const blob = await response.blob();

    if (blob.size > MAX_VIDEO_BYTES) {
      return setError('Filmen är för stor. Exportera i 1080p i stället för 4K.');
    }

    setUploading(true);
    try {
      const target = await api.post<{ uploadUrl: string; storagePath: string }>(
        `/contracts/${contractId}/drafts/upload-url`,
        { contentType, fileName: asset.fileName ?? '', sizeBytes: blob.size },
      );

      const put = await fetch(target.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': contentType },
        body: blob,
      });
      if (!put.ok) throw new Error('Uppladdningen avbröts.');

      await api.post<Draft>(`/contracts/${contractId}/drafts`, {
        storagePath: target.storagePath,
        contentType,
        fileName: asset.fileName ?? '',
        sizeBytes: blob.size,
        note: note.trim(),
      });
      setNote('');
      refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Uppladdningen gick inte igenom. Försök igen.',
      );
    } finally {
      setUploading(false);
    }
  };

  if (drafts.isLoading) return <Loading />;

  const list = drafts.data ?? [];
  const latest = list[0];
  const isCreator = role === 'INFLUENCER';
  const canUpload = isCreator && contractStatus === 'ACTIVE';
  // En ny version behövs bara när företaget bett om en ändring, eller när
  // inget lämnats än. Ett godkänt utkast ska inte bytas ut i tysthet.
  const needsNewVersion = !latest || latest.status === 'CHANGES_REQUESTED';

  return (
    <Card>
      <Label>UTKAST</Label>

      {list.length === 0 ? (
        <Body>
          {isCreator
            ? 'Lämna filmen här innan du publicerar. Företaget får se den och godkänna, och slipper överraskningar.'
            : 'Kreatören har inte lämnat något utkast än. Du får en chans att se filmen innan den publiceras.'}
        </Body>
      ) : null}

      {list.map((draft) => (
        <View key={draft.id} style={styles.draft}>
          <View style={styles.draftHead}>
            <Text style={styles.version}>Version {draft.version}</Text>
            <StatusBadge
              label={
                draft.autoApproved
                  ? 'Godkänt automatiskt'
                  : DRAFT_STATUS_LABELS[draft.status as DraftStatus]
              }
              tone={toneFor(draft.status as DraftStatus)}
            />
          </View>

          <VideoPlayer uri={draft.playbackUrl} />

          {draft.note ? <Text style={styles.note}>{draft.note}</Text> : null}

          {draft.status === 'PENDING' ? (
            <Text style={styles.secondary}>
              {draft.daysLeftToReview === 0
                ? 'Svarstiden har gått ut – utkastet räknas som godkänt.'
                : `${draft.daysLeftToReview} dagar kvar att svara.`}
            </Text>
          ) : null}

          {draft.reviewNote ? (
            <View style={styles.reviewNote}>
              <Text style={styles.reviewNoteLabel}>Företaget skrev</Text>
              <Text style={styles.note}>{draft.reviewNote}</Text>
            </View>
          ) : null}

          {!isCreator && draft.status === 'PENDING' ? (
            <>
              <Field
                label="Vad ska ändras?"
                value={reviewNote}
                onChangeText={setReviewNote}
                placeholder="Behövs bara om du ber om en ändring"
                multiline
              />
              <View style={styles.actions}>
                <Button
                  label="Be om ändring"
                  variant="secondary"
                  style={styles.action}
                  onPress={() => {
                    setError(null);
                    review.mutate({ draftId: draft.id, approve: false, note: reviewNote });
                  }}
                />
                <Button
                  label="Godkänn"
                  style={styles.action}
                  loading={review.isPending}
                  onPress={() => {
                    setError(null);
                    review.mutate({ draftId: draft.id, approve: true, note: '' });
                  }}
                />
              </View>
            </>
          ) : null}
        </View>
      ))}

      {canUpload && needsNewVersion ? (
        <>
          <Field
            label="Medskick till företaget"
            value={note}
            onChangeText={setNote}
            placeholder="Frivilligt, t.ex. vilken musik som ligger under"
            multiline
          />
          <Button
            label={latest ? 'Ladda upp ny version' : 'Ladda upp utkast'}
            onPress={() => void upload()}
            loading={uploading}
          />
          {Platform.OS === 'web' ? (
            <Text style={styles.secondary}>Filmen laddas upp direkt och kan ta en stund.</Text>
          ) : null}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </Card>
  );
}

function toneFor(status: DraftStatus): StatusTone {
  if (status === 'APPROVED') return 'done';
  if (status === 'CHANGES_REQUESTED') return 'cancelled';
  return 'pending';
}

const styles = StyleSheet.create({
  draft: {
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  draftHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  version: { ...type.listTitle, color: colors.text },
  note: { ...type.bodySmall, color: colors.muted },
  secondary: { ...type.secondary, color: colors.muted },
  reviewNote: {
    backgroundColor: colors.raised,
    borderRadius: radius.control,
    padding: spacing.md,
    gap: 2,
  },
  reviewNoteLabel: { ...type.label, color: colors.muted },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1 },
  error: { ...type.secondary, color: colors.danger },
});
