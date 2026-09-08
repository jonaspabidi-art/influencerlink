import { MAX_VIDEO_BYTES } from '@pacta/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { CheckIcon, LockIcon } from '../../src/components/icons';
import {
  Body,
  Button,
  Card,
  Divider,
  ErrorState,
  Field,
  Header,
  Label,
  Loading,
  ScrollScreen,
  StatusBadge,
  type StatusTone,
} from '../../src/components/ui';
import { VideoPlayer } from '../../src/components/VideoPlayer';
import { formatDate, formatSek } from '../../src/format';
import { retainersQuery } from '../../src/queries';
import { colors, radius, spacing, type } from '../../src/theme';
import type { RetainerDetail, RetainerPeriod, RetainerPost } from '../../src/types';

const STATUS_LABELS: Record<RetainerDetail['status'], string> = {
  REQUESTED: 'Väntar på svar',
  DECLINED: 'Tackade nej',
  ACTIVE: 'Pågår',
  CANCELLING: 'Avslutas',
  ENDED: 'Avslutat',
};

const STATUS_TONES: Record<RetainerDetail['status'], StatusTone> = {
  REQUESTED: 'pending',
  DECLINED: 'cancelled',
  ACTIVE: 'active',
  CANCELLING: 'pending',
  ENDED: 'done',
};

const POST_LABELS: Record<RetainerPost['status'], string> = {
  PENDING: 'Väntar på godkännande',
  APPROVED: 'Godkänd – klar att publiceras',
  CHANGES_REQUESTED: 'Ändring begärd',
  PUBLISHED: 'Publicerad',
};

/**
 * Ett löpande uppdrag.
 *
 * Perioden är det skärmen kretsar kring: den är betald i förskott, videorna
 * levereras under månaden, och när den löper ut avräknas det som godkänts.
 * Därför står "levererat X av Y" överst – det är den siffran som avgör vad
 * kreatören får och vad företaget får tillbaka.
 */
export default function RetainerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const isBusiness = user?.role === 'BUSINESS';

  const retainer = useQuery({
    queryKey: ['retainer', id],
    queryFn: () => api.get<RetainerDetail>(`/retainers/${id}`),
    enabled: Boolean(id),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['retainer', id] });
    void queryClient.invalidateQueries({ queryKey: retainersQuery().queryKey });
  };

  const fail = (caught: unknown, fallback: string) =>
    setError(caught instanceof ApiError ? caught.message : fallback);

  const respond = useMutation({
    mutationFn: (accept: boolean) => api.post(`/retainers/${id}/respond`, { accept }),
    onSuccess: refresh,
    onError: (caught) => fail(caught, 'Kunde inte skicka svaret.'),
  });

  const access = useMutation({
    mutationFn: (granted: boolean) => api.post(`/retainers/${id}/access`, { granted }),
    onSuccess: refresh,
    onError: (caught) => fail(caught, 'Kunde inte spara.'),
  });

  const cancel = useMutation({
    mutationFn: () => api.post(`/retainers/${id}/cancel`),
    onSuccess: refresh,
    onError: (caught) => fail(caught, 'Kunde inte säga upp uppdraget.'),
  });

  const pay = useMutation({
    mutationFn: (periodId: string) =>
      api.post<{ clientSecret: string; amount: number }>(
        `/retainer-periods/${periodId}/payment`,
      ),
    onSuccess: refresh,
    onError: (caught) => fail(caught, 'Kunde inte starta betalningen.'),
  });

  if (retainer.isLoading) {
    return (
      <ScrollScreen>
        <Header title="Löpande uppdrag" onBack={() => router.back()} />
        <Loading />
      </ScrollScreen>
    );
  }
  if (retainer.isError || !retainer.data) {
    return (
      <ScrollScreen>
        <Header title="Löpande uppdrag" onBack={() => router.back()} />
        <ErrorState message="Kunde inte hämta uppdraget." onRetry={() => void retainer.refetch()} />
      </ScrollScreen>
    );
  }

  const data = retainer.data;
  const counterpart = isBusiness ? data.influencerName : data.businessName;
  const current =
    data.periods.find((period) => period.status === 'ACTIVE') ??
    data.periods.find((period) => period.status === 'AWAITING_PAYMENT');

  return (
    <ScrollScreen contentStyle={styles.content}>
      <Header
        title={counterpart}
        subtitle={`${data.videosPerMonth} videor i månaden`}
        onBack={() => router.back()}
        right={<StatusBadge label={STATUS_LABELS[data.status]} tone={STATUS_TONES[data.status]} />}
      />

      {/* Förfrågan: kreatören svarar, företaget väntar. */}
      {data.status === 'REQUESTED' ? (
        isBusiness ? (
          <Card>
            <Text style={styles.cardTitle}>Väntar på {counterpart}</Text>
            <Body>
              Hon ser förfrågan i appen. Svarar hon ja betalar ni första månaden och uppdraget
              startar.
            </Body>
          </Card>
        ) : (
          <Card tone="primary">
            <Text style={styles.cardTitle}>{data.businessName} vill anlita dig</Text>
            <Body>
              {data.videosPerMonth} videor i månaden till deras egna kanaler.{' '}
              {formatSek(data.monthlyRate)} i månaden till dig, minus 10 % i avgift.
              {data.prepaidMonths > 1 ? ` De betalar ${data.prepaidMonths} månader i förskott.` : ''}
            </Body>
            {data.requestNote ? <Text style={styles.quote}>{data.requestNote}</Text> : null}
            <Button label="Tacka ja" onPress={() => respond.mutate(true)} loading={respond.isPending} />
            <Button label="Tacka nej" variant="secondary" onPress={() => respond.mutate(false)} />
          </Card>
        )
      ) : null}

      {/* Åtkomsten. Utan den får hon producera men inte publicera. */}
      {data.status === 'ACTIVE' || data.status === 'CANCELLING' ? (
        <Card tone={data.accessGranted ? 'raised' : 'primary'}>
          <View style={styles.headRow}>
            <LockIcon size={16} color={data.accessGranted ? colors.positive : colors.text} />
            <Text style={styles.cardTitle}>
              {data.accessGranted ? 'Åtkomst till kanalerna är given' : 'Ge åtkomst till kanalerna'}
            </Text>
          </View>
          <Body>
            {isBusiness
              ? 'Lägg till henne i Meta Business Suite och TikTok Business Center. Lämna aldrig ut ditt lösenord – varken till henne eller till oss.'
              : data.accessGranted
                ? 'Du kan publicera godkända videor på deras kanaler.'
                : 'Företaget har inte lagt till dig ännu. Du kan producera, men inte publicera.'}
          </Body>
          {isBusiness ? (
            <Button
              label={data.accessGranted ? 'Dra tillbaka åtkomsten' : 'Jag har gett åtkomst'}
              variant={data.accessGranted ? 'secondary' : 'primary'}
              onPress={() => access.mutate(!data.accessGranted)}
              loading={access.isPending}
            />
          ) : null}
        </Card>
      ) : null}

      {current ? (
        <PeriodCard
          period={current}
          isBusiness={isBusiness}
          onPay={() => pay.mutate(current.id)}
          paying={pay.isPending}
        />
      ) : null}

      {current && current.status === 'ACTIVE' ? (
        <Posts
          period={current}
          isBusiness={isBusiness}
          accessGranted={data.accessGranted}
          onChanged={refresh}
          onError={setError}
        />
      ) : null}

      {data.periods.length > 1 ? (
        <View style={styles.section}>
          <Label>ALLA MÅNADER</Label>
          <Card>
            {data.periods.map((period, index) => (
              <View key={period.id}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.historyRow}>
                  <View style={styles.historyText}>
                    <Text style={styles.historyTitle}>Månad {period.index}</Text>
                    <Text style={styles.secondary}>
                      {formatDate(period.startsAt)} – {formatDate(period.endsAt)}
                    </Text>
                  </View>
                  <Text style={styles.secondary}>
                    {period.videosDelivered}/{period.videosAgreed}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {data.status === 'ACTIVE' ? (
        <View style={styles.section}>
          <Button
            label="Säg upp uppdraget"
            variant="secondary"
            onPress={() => cancel.mutate()}
            loading={cancel.isPending}
          />
          <Text style={styles.footnote}>
            Uppsägningen gäller från nästa månad. Den pågående månaden är betald och löper klart.
          </Text>
        </View>
      ) : null}

      {data.terms ? (
        <View style={styles.section}>
          <Label>AVTALSTEXT</Label>
          <Card tone="raised">
            <Text style={styles.terms}>{data.terms}</Text>
          </Card>
        </View>
      ) : null}
    </ScrollScreen>
  );
}

/** Månadens pengar och leveranstakt. */
function PeriodCard({
  period,
  isBusiness,
  onPay,
  paying,
}: {
  period: RetainerPeriod;
  isBusiness: boolean;
  onPay: () => void;
  paying: boolean;
}) {
  if (period.status === 'AWAITING_PAYMENT') {
    return (
      <Card tone="primary">
        <Text style={styles.cardTitle}>Månad {period.index} väntar på betalning</Text>
        <Body>
          {isBusiness
            ? 'Beloppet ligger hos Pacta under månaden och betalas ut när videorna är godkända. Levereras färre än avtalat får ni mellanskillnaden tillbaka.'
            : 'Företaget har inte betalat in månaden ännu. Du får en notis så fort det är klart.'}
        </Body>
        {isBusiness ? (
          <Button label={`Betala ${formatSek(period.chargeAmount)}`} onPress={onPay} loading={paying} />
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.secondary}>Månad {period.index}</Text>
      <Text style={styles.hero}>
        {period.videosDelivered} av {period.videosAgreed}
      </Text>
      <Text style={styles.secondary}>videor godkända den här månaden</Text>
      <Divider />
      <View style={styles.row}>
        <Text style={styles.rowLabel}>Perioden slutar</Text>
        <Text style={styles.rowValue}>{formatDate(period.endsAt)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{isBusiness ? 'Ni har betalat' : 'Till dig vid full leverans'}</Text>
        <Text style={styles.rowValue}>
          {formatSek(isBusiness ? period.chargeAmount : Math.round(period.grossAmount * 0.9))}
        </Text>
      </View>
    </Card>
  );
}

/**
 * Videorna i månaden.
 *
 * Företaget godkänner varje video innan den får publiceras, och ingenting
 * auto-godkänns: hon publicerar i deras namn, på deras konto, och ett inlägg
 * som inte borde ha gått ut går inte att ta tillbaka.
 */
function Posts({
  period,
  isBusiness,
  accessGranted,
  onChanged,
  onError,
}: {
  period: RetainerPeriod;
  isBusiness: boolean;
  accessGranted: boolean;
  onChanged: () => void;
  onError: (message: string | null) => void;
}) {
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [publishUrl, setPublishUrl] = useState('');

  const review = useMutation({
    mutationFn: (input: { postId: string; approve: boolean }) =>
      api.post(`/retainer-posts/${input.postId}/review`, {
        approve: input.approve,
        note: input.approve ? '' : reviewNote.trim(),
      }),
    onSuccess: () => {
      setReviewNote('');
      onChanged();
    },
    onError: (caught) =>
      onError(caught instanceof ApiError ? caught.message : 'Kunde inte spara svaret.'),
  });

  const publish = useMutation({
    mutationFn: (postId: string) =>
      api.post(`/retainer-posts/${postId}/published`, { url: publishUrl.trim() }),
    onSuccess: () => {
      setPublishUrl('');
      onChanged();
    },
    onError: (caught) =>
      onError(caught instanceof ApiError ? caught.message : 'Kunde inte spara länken.'),
  });

  const upload = async () => {
    onError(null);
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];
    const contentType = asset.mimeType ?? 'video/mp4';
    const blob = await (await fetch(asset.uri)).blob();
    if (blob.size > MAX_VIDEO_BYTES) {
      return onError('Filmen är för stor. Exportera i 1080p i stället för 4K.');
    }

    setUploading(true);
    try {
      const target = await api.post<{ uploadUrl: string; storagePath: string }>(
        `/retainer-periods/${period.id}/posts/upload-url`,
        { contentType, sizeBytes: blob.size },
      );
      const put = await fetch(target.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': contentType },
        body: blob,
      });
      if (!put.ok) throw new Error('Uppladdningen avbröts.');

      await api.post(`/retainer-periods/${period.id}/posts`, {
        storagePath: target.storagePath,
        contentType,
        fileName: asset.fileName ?? '',
        sizeBytes: blob.size,
        platform: 'INSTAGRAM',
        caption: caption.trim(),
      });
      setCaption('');
      onChanged();
    } catch (caught) {
      onError(caught instanceof ApiError ? caught.message : 'Uppladdningen gick inte igenom.');
    } finally {
      setUploading(false);
    }
  };

  const room = period.videosAgreed - period.posts.length;

  return (
    <View style={styles.section}>
      <Label>MÅNADENS VIDEOR</Label>

      {period.posts.map((post) => (
        <Card key={post.id}>
          <View style={styles.postHead}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {post.caption || post.fileName || 'Utan text'}
            </Text>
            {post.status === 'PUBLISHED' ? <CheckIcon size={18} color={colors.positive} /> : null}
          </View>
          <Text style={[styles.postStatus, post.status === 'PUBLISHED' && styles.postDone]}>
            {POST_LABELS[post.status]}
            {post.revision > 1 ? ` · version ${post.revision}` : ''}
          </Text>

          {post.playbackUrl ? <VideoPlayer uri={post.playbackUrl} /> : null}

          {post.reviewNote ? <Text style={styles.quote}>{post.reviewNote}</Text> : null}

          {isBusiness && post.status === 'PENDING' ? (
            <>
              <Field
                label="Vad ska ändras? (om du inte godkänner)"
                value={reviewNote}
                onChangeText={setReviewNote}
                multiline
                placeholder="Klipp bort sista sekunderna och lägg till öppettiderna."
              />
              <Button
                label="Godkänn för publicering"
                onPress={() => review.mutate({ postId: post.id, approve: true })}
                loading={review.isPending}
              />
              <Button
                label="Be om en ändring"
                variant="secondary"
                onPress={() => review.mutate({ postId: post.id, approve: false })}
              />
            </>
          ) : null}

          {!isBusiness && post.status === 'APPROVED' ? (
            accessGranted ? (
              <>
                <Field
                  label="Länk till inlägget"
                  value={publishUrl}
                  onChangeText={setPublishUrl}
                  keyboardType="url"
                  placeholder="https://instagram.com/p/..."
                  hint="Klistra in länken när du lagt upp den. Utan den kan vi inte mäta vad den gav."
                />
                <Button
                  label="Jag har publicerat"
                  onPress={() => publish.mutate(post.id)}
                  loading={publish.isPending}
                />
              </>
            ) : (
              <Body>Vänta på att företaget ger dig åtkomst till kanalen.</Body>
            )
          ) : null}

          {post.publishedUrl ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(post.publishedUrl ?? '')}
            >
              <Text style={styles.link}>Öppna inlägget</Text>
            </Pressable>
          ) : null}
        </Card>
      ))}

      {!isBusiness && room > 0 ? (
        <Card tone="raised">
          <Text style={styles.cardTitle}>
            {room} {room === 1 ? 'video' : 'videor'} kvar den här månaden
          </Text>
          <Field
            label="Bildtext"
            value={caption}
            onChangeText={setCaption}
            multiline
            placeholder="Nybakat varje morgon klockan sju."
            hint="Företaget godkänner texten tillsammans med filmen."
          />
          <Button label="Ladda upp video" onPress={() => void upload()} loading={uploading} />
        </Card>
      ) : null}

      {isBusiness && period.posts.length === 0 ? (
        <Card tone="raised">
          <Body>
            Inga videor inlämnade ännu den här månaden. Du får en notis så fort det finns något
            att godkänna.
          </Body>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 0, gap: 14 },
  section: { gap: spacing.sm },
  secondary: { ...type.secondary, color: colors.muted },
  footnote: { ...type.secondary, color: colors.muted },
  error: { ...type.secondary, color: colors.danger },
  cardTitle: { ...type.listTitle, color: colors.text, flex: 1 },
  hero: { ...type.amountHero, color: colors.accent },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rowLabel: { ...type.bodySmall, color: colors.muted, flex: 1 },
  rowValue: { fontFamily: type.rowTitle.fontFamily, fontSize: 15, color: colors.text },

  postHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  postStatus: { ...type.secondary, color: colors.accent },
  postDone: { color: colors.positive },
  link: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.primary },

  quote: {
    ...type.bodySmall,
    color: colors.text,
    backgroundColor: colors.raised,
    borderRadius: radius.control,
    padding: spacing.md,
  },

  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 4 },
  historyText: { flex: 1, gap: 2 },
  historyTitle: { ...type.listTitle, color: colors.text },

  terms: { ...type.bodySmall, color: colors.muted },
});
