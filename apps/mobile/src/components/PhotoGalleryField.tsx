import { MAX_IMAGE_DIMENSION } from '@pacta/shared';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { resolveMediaUrl } from '../media';
import { colors, radius, spacing, type } from '../theme';
import { CloseIcon, PlusIcon } from './icons';
import { Label, Loading } from './ui';

/**
 * Flera bilder i en rad, som kreatörens rutnät av klipp.
 *
 * Företaget behöver visa upp sig av samma skäl som kreatören: motparten ska
 * kunna avgöra om det är värt en dag av sitt liv innan hon tackar ja.
 */
export function PhotoGalleryField({
  label,
  value,
  onChange,
  max = 8,
  hint,
}: {
  label: string;
  value: string[];
  onChange: (photos: string[]) => void;
  max?: number;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setError(null);
    if (value.length >= max) return setError(`Du kan visa upp högst ${max} bilder.`);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return setError('Appen behöver komma åt dina bilder för att du ska kunna välja en.');
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Flera åt gången: en restaurang har sällan bara en bild att visa.
      allowsMultipleSelection: true,
      selectionLimit: max - value.length,
      quality: 1,
    });
    if (picked.canceled || picked.assets.length === 0) return;

    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const asset of picked.assets) {
        const longest = Math.max(asset.width ?? 0, asset.height ?? 0);
        const resized = await ImageManipulator.manipulateAsync(
          asset.uri,
          longest > MAX_IMAGE_DIMENSION
            ? [
                (asset.width ?? 0) >= (asset.height ?? 0)
                  ? { resize: { width: MAX_IMAGE_DIMENSION } }
                  : { resize: { height: MAX_IMAGE_DIMENSION } },
              ]
            : [],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        if (!resized.base64) continue;

        const result = await api.post<{ url: string }>('/media', {
          mimeType: 'image/jpeg',
          data: resized.base64,
          width: resized.width,
          height: resized.height,
        });
        uploaded.push(result.url);
      }
      onChange([...value, ...uploaded].slice(0, max));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte ladda upp bilderna.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.field}>
      <Label>{label.toUpperCase()}</Label>
      {hint ? <Text style={styles.secondary}>{hint}</Text> : null}

      <View style={styles.grid}>
        {value.map((photo, index) => (
          <View key={photo} style={styles.tile}>
            <Image
              source={{ uri: resolveMediaUrl(photo) ?? undefined }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ta bort bild ${index + 1}`}
              onPress={() => {
                setError(null);
                onChange(value.filter((item) => item !== photo));
              }}
              style={styles.remove}
            >
              <CloseIcon size={13} color={colors.ink} />
            </Pressable>
          </View>
        ))}

        {value.length < max ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Lägg till bild"
            onPress={() => void add()}
            disabled={busy}
            style={({ pressed }) => [styles.tile, styles.addTile, pressed && styles.pressed]}
          >
            {busy ? <Loading /> : <PlusIcon size={22} color={colors.dim} />}
          </Pressable>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: radius.control,
    backgroundColor: colors.raised,
    overflow: 'hidden',
  },
  addTile: {
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  remove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#00000099',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { ...type.secondary, color: colors.muted },
  error: { ...type.secondary, color: colors.danger },
});
