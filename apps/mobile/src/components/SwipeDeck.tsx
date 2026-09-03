import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useState, type ReactNode } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** Hur långt kortet måste dras för att räknas som ett svep. */
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
/** Hastighet som räknas som ett svep även vid kort dragning. */
const FLICK_VELOCITY = 900;

export type SwipeDirection = 'LIKE' | 'PASS';

interface SwipeDeckProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onSwipe: (item: T, direction: SwipeDirection) => void;
  /** Anropas när sista kortet lämnat högen. */
  onExhausted?: () => void;
}

/**
 * Kortlek där översta kortet dras i sidled. Kortet under skalas upp när det
 * översta rör sig, så att högen känns fysisk.
 *
 * Gesten körs på UI-tråden via Reanimated; först när svepet är avgjort hoppar
 * vi över till JS-tråden för att rapportera resultatet.
 */
export function SwipeDeck<T>({
  items,
  keyExtractor,
  renderCard,
  onSwipe,
  onExhausted,
}: SwipeDeckProps<T>) {
  const [index, setIndex] = useState(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const current = items[index];
  const next = items[index + 1];

  const commit = useCallback(
    (direction: SwipeDirection) => {
      const item = items[index];
      if (item) {
        void Haptics.impactAsync(
          direction === 'LIKE'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
        );
        onSwipe(item, direction);
      }
      translateX.value = 0;
      translateY.value = 0;
      const nextIndex = index + 1;
      setIndex(nextIndex);
      if (nextIndex >= items.length) onExhausted?.();
    },
    [index, items, onSwipe, onExhausted, translateX, translateY],
  );

  /** Knapparna under kortleken ska kännas som ett svep, inte som ett hopp. */
  const swipeProgrammatically = useCallback(
    (direction: SwipeDirection) => {
      translateX.value = withTiming(
        direction === 'LIKE' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5,
        { duration: 220 },
        (finished) => {
          if (finished) runOnJS(commit)(direction);
        },
      );
    },
    [commit, translateX],
  );

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const passedThreshold = Math.abs(event.translationX) > SWIPE_THRESHOLD;
      const flicked = Math.abs(event.velocityX) > FLICK_VELOCITY;

      if (passedThreshold || flicked) {
        const direction: SwipeDirection = event.translationX > 0 ? 'LIKE' : 'PASS';
        translateX.value = withTiming(
          Math.sign(event.translationX || 1) * SCREEN_WIDTH * 1.5,
          { duration: 200 },
          (finished) => {
            if (finished) runOnJS(commit)(direction);
          },
        );
        return;
      }
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });

  const topCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-SCREEN_WIDTH, SCREEN_WIDTH], [-12, 12])}deg` },
    ],
  }));

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], 'clamp'),
  }));

  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], 'clamp'),
  }));

  const nextCardStyle = useAnimatedStyle(() => {
    const progress = Math.min(Math.abs(translateX.value) / SWIPE_THRESHOLD, 1);
    return {
      transform: [{ scale: interpolate(progress, [0, 1], [0.94, 1]) }],
      opacity: interpolate(progress, [0, 1], [0.6, 1]),
    };
  });

  if (!current) return null;

  return (
    <View style={styles.container}>
      <View style={styles.deck}>
        {next ? (
          <Animated.View
            key={keyExtractor(next)}
            style={[styles.card, styles.cardBehind, nextCardStyle]}
            pointerEvents="none"
          >
            {renderCard(next)}
          </Animated.View>
        ) : null}

        <GestureDetector gesture={pan}>
          <Animated.View key={keyExtractor(current)} style={[styles.card, topCardStyle]}>
            {renderCard(current)}
            <Animated.View style={[styles.stamp, styles.stampLike, likeStyle]} pointerEvents="none">
              <Ionicons name="heart" size={20} color={colors.success} />
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampPass, passStyle]} pointerEvents="none">
              <Ionicons name="close" size={20} color={colors.danger} />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.actions}>
        <SwipeButton
          icon="close"
          color={colors.danger}
          label="Hoppa över"
          onPress={() => swipeProgrammatically('PASS')}
        />
        <SwipeButton
          icon="heart"
          color={colors.success}
          label="Intresserad"
          onPress={() => swipeProgrammatically('LIKE')}
        />
      </View>
    </View>
  );
}

function SwipeButton({
  icon,
  color,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { borderColor: color },
        pressed && styles.actionButtonPressed,
      ]}
    >
      <Ionicons name={icon} size={28} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  deck: { flex: 1, justifyContent: 'center' },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBehind: { zIndex: -1 },
  stamp: {
    position: 'absolute',
    top: spacing.lg,
    borderRadius: radius.pill,
    padding: spacing.sm,
    backgroundColor: colors.overlay,
  },
  stampLike: { right: spacing.lg },
  stampPass: { left: spacing.lg },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.md,
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  actionButtonPressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
});
