import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors, radius, type } from '../theme';

/**
 * Uppspelning av ett utkast.
 *
 * På webben – där både du och de flesta granskare kör appen idag – räcker
 * webbläsarens egen spelare. På telefonen finns ingen inbyggd videovy i
 * react-native, så där visas en förklaring tills expo-video är inlagt.
 */
export function VideoPlayer({ uri }: { uri: string | null }) {
  if (!uri) {
    return (
      <View style={styles.frame}>
        <Text style={styles.placeholder}>Filmen kunde inte hämtas just nu.</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    // react-native-web släpper igenom okända taggar till DOM:en.
    const Video = 'video' as unknown as React.ElementType;
    return (
      <View style={styles.frame}>
        <Video
          src={uri}
          controls
          playsInline
          preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
        />
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <Text style={styles.placeholder}>Öppna i webbappen för att se filmen.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 9 / 16,
    maxHeight: 360,
    borderRadius: radius.control,
    backgroundColor: colors.photo,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { ...type.secondary, color: colors.muted, textAlign: 'center', padding: 12 },
});
