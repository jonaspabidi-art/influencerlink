import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { formatFollowers } from '../format';
import { colors, radius, spacing, type } from '../theme';
import type { TikTokVideo } from '../types';
import { CheckIcon } from './icons';
import { Body, Button, Label, Loading } from './ui';

/** Så många videor får ligga på profilen. Fler blir en scroll, inte ett urval. */
const MAX_PICKS = 12;

/**
 * Väljer vilka TikTok-videor som ska synas på profilen.
 *
 * Kreatören ser sina senaste videor som ett rutnät och trycker på dem hon vill
 * visa. Numret på en vald video är dess plats i ordningen, så profilen får den
 * ordning hon valde i – inte den TikTok råkar leverera.
 */
export function VideoPicker() {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const videos = useQuery({
    queryKey: ['tiktok-videos'],
    queryFn: () => api.get<TikTokVideo[]>('/me/influencer-profile/tiktok/videos'),
  });

  // Det som redan ligger på profilen är förvalt när rutnätet öppnas.
  const loaded = videos.data;
  useEffect(() => {
    if (!loaded) return;
    setPicked(loaded.filter((video) => video.showcased).map((video) => video.id));
  }, [loaded]);

  const save = useMutation({
    mutationFn: (videoIds: string[]) =>
      api.put('/me/influencer-profile/showcase/tiktok', { videoIds }),
    onSuccess: () => {
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['showcase'] });
      void queryClient.invalidateQueries({ queryKey: ['tiktok-videos'] });
      void queryClient.invalidateQueries({ queryKey: ['influencer'] });
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte spara urvalet.'),
  });

  const toggle = (id: string) => {
    setError(null);
    setSaved(false);
    setPicked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= MAX_PICKS) {
        setError(`Du kan visa upp högst ${MAX_PICKS} videor.`);
        return current;
      }
      return [...current, id];
    });
  };

  if (videos.isLoading) return <Loading label="Hämtar dina videor …" />;

  if (videos.isError) {
    return (
      <Body>
        {videos.error instanceof ApiError
          ? videos.error.message
          : 'Kunde inte hämta dina videor från TikTok.'}
      </Body>
    );
  }

  const list = videos.data ?? [];
  if (list.length === 0) {
    return <Body>Du har inga publicerade videor på TikTok än.</Body>;
  }

  return (
    <View style={styles.wrap}>
      <Label>VÄLJ VAD SOM SYNS PÅ PROFILEN</Label>
      <Body>
        Tryck på de videor du vill visa upp. Företag ser dem när de tittar på din profil.
      </Body>

      <View style={styles.grid}>
        {list.map((video) => {
          const order = picked.indexOf(video.id);
          return (
            <Pressable
              key={video.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: order >= 0 }}
              accessibilityLabel={video.title || 'Video'}
              onPress={() => toggle(video.id)}
              style={({ pressed }) => [
                styles.tile,
                order >= 0 && styles.tilePicked,
                pressed && styles.pressed,
              ]}
            >
              {video.coverImageUrl ? (
                <Image
                  source={{ uri: video.coverImageUrl }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                />
              ) : null}
              <View style={styles.tileFooter}>
                <Text style={styles.views}>{formatFollowers(video.views)}</Text>
              </View>
              {order >= 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{order + 1}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? (
        <View style={styles.savedRow}>
          <CheckIcon size={16} color={colors.positive} />
          <Text style={styles.savedText}>Sparat. Så här ser din profil ut nu.</Text>
        </View>
      ) : null}

      <Button
        label={picked.length === 0 ? 'Ta bort alla från profilen' : `Spara ${picked.length} valda`}
        onPress={() => {
          setError(null);
          save.mutate(picked);
        }}
        loading={save.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    // Tre per rad: tillräckligt stort för att känna igen klippet, tillräckligt
    // många för att se hela urvalet utan att scrolla.
    width: '31%',
    aspectRatio: 9 / 16,
    borderRadius: radius.control,
    backgroundColor: colors.photo,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tilePicked: { borderColor: colors.primary },
  pressed: { opacity: 0.75 },
  tileFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 4,
    backgroundColor: '#00000066',
  },
  views: { ...type.label, color: '#FFFFFF' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...type.label, color: colors.ink },
  error: { ...type.secondary, color: colors.danger },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  savedText: { ...type.secondary, color: colors.positive },
});
