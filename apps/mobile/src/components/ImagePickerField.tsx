import { MAX_IMAGE_DIMENSION } from '@pacta/shared';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api';
import { colors, radius, spacing, type } from '../theme';
import { CloseIcon, PlusIcon } from './icons';
import { Label, Loading } from './ui';
import { resolveMediaUrl } from '../media';

interface UploadResult {
  url: string;
}

/**
 * Väljer en bild ur telefonens bibliotek, skalar ned den och laddar upp.
 *
 * Nedskalningen sker här i appen och inte på servern: en obehandlad
 * mobilkamerabild är flera megabyte, och den ska varken belasta uppkopplingen
 * eller databasen. 1280 px räcker för en kortbild även på en skarp skärm.
 */
export function ImagePickerField({
  label,
  value,
  onChange,
  aspect = [4, 3],
  shape = 'rectangle',
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  aspect?: [number, number];
  /** 'circle' till profilbilder, 'rectangle' till kampanjbilder och logotyper. */
  shape?: 'circle' | 'rectangle';
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);

    // På webben finns inget bibliotekstillstånd att fråga om; där öppnar
    // väljaren en vanlig filruta.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return setError('Appen behöver komma åt dina bilder för att du ska kunna välja en.');
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      quality: 1,
    });
    if (picked.canceled || !picked.assets[0]) return;

    setBusy(true);
    try {
      const asset = picked.assets[0];
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
      if (!resized.base64) throw new Error('Bilden gick inte att läsa.');

      const result = await api.post<UploadResult>('/media', {
        mimeType: 'image/jpeg',
        data: resized.base64,
        width: resized.width,
        height: resized.height,
      });
      onChange(result.url);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Kunde inte ladda upp bilden.');
    } finally {
      setBusy(false);
    }
  };

  const preview = value ? resolveMediaUrl(value) : null;

  return (
    <View style={styles.field}>
      <Label>{label.toUpperCase()}</Label>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={value ? `Byt ${label.toLowerCase()}` : `Välj ${label.toLowerCase()}`}
          onPress={() => void pick()}
          disabled={busy}
          style={({ pressed }) => [
            styles.frame,
            shape === 'circle' ? styles.frameCircle : styles.frameRectangle,
            pressed && styles.pressed,
          ]}
        >
          {busy ? (
            <Loading />
          ) : preview ? (
            <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <PlusIcon size={22} color={colors.dim} />
          )}
        </Pressable>

        <View style={styles.actions}>
          <Text style={styles.action} onPress={() => void pick()}>
            {value ? 'Byt bild' : 'Välj bild'}
          </Text>
          {value ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ta bort ${label.toLowerCase()}`}
              onPress={() => {
                setError(null);
                onChange(null);
              }}
              style={styles.remove}
            >
              <CloseIcon size={14} color={colors.muted} />
              <Text style={styles.secondary}>Ta bort</Text>
            </Pressable>
          ) : null}
          {hint ? <Text style={styles.secondary}>{hint}</Text> : null}
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const SIZE = 88;

const styles = StyleSheet.create({
  field: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  frame: {
    width: SIZE,
    height: SIZE,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  frameCircle: { borderRadius: SIZE / 2 },
  frameRectangle: { borderRadius: radius.control },
  pressed: { opacity: 0.7 },
  actions: { flex: 1, gap: 4 },
  action: { fontFamily: type.listTitle.fontFamily, fontSize: 14, color: colors.primary },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  secondary: { ...type.secondary, color: colors.muted },
  error: { ...type.secondary, color: colors.danger },
});
