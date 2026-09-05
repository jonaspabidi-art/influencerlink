import { Image, StyleSheet, View } from 'react-native';
import { spacing } from '../theme';

/**
 * Ordmärket. Levererat som bild och inte ritat i kod, så att bokstäverna är
 * exakt de designade – A:na saknar tvärslå och det är det som gör märket
 * igenkännligt. Färgen är appens primära, så märket och knapparna är samma röda.
 */
export function Wordmark({ width = 150 }: { width?: number }) {
  // Bilden är 787 × 143 i original.
  return (
    <View style={styles.wrap}>
      <Image
        source={require('../../assets/wordmark.png')}
        style={{ width, height: Math.round((width * 143) / 787) }}
        resizeMode="contain"
        accessibilityLabel="Pacta"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.sm },
});
