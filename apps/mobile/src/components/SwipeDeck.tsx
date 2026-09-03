import * as Haptics from 'expo-haptics';
import { useCallback, useState, type ReactNode } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { HEIGHTS, colors, radius, spacing, type } from '../theme';
import { CheckIcon, CloseIcon, LockIcon } from './icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** Hur långt kortet måste dras för att räknas som ett svep. */
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;
/** Hastighet som räknas som ett svep även vid kort dragning. */
const FLICK_VELOCITY = 900;
/** Kortet flyger ut på 420 ms, nytt kort centreras efter 650 ms (handoffen). */
const FLY_OUT_MS = 420;
const SETTLE_MS = 230;

export type SwipeDirection = 'LIKE' | 'PASS';

interface SwipeDeckProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onSwipe: (item: T, direction: SwipeDirection) => void;
  /** Meningen i trygghetsraden under kortleken. */
  trustText: string;
  onExhausted?: () => void;
}

/**
 * Kortleken. Gesten körs på UI-tråden; först när svepet är avgjort hoppar vi
 * över till JS-tråden för att rapportera resultatet.
 *
 * Kortkanten byter färg och en stämpel tonas in när dragningen passerar
 * tröskeln, så att utfallet syns innan man släpper.
 */
export function SwipeDeck<T>({
  items,
  keyExtractor,
  renderCard,
  onSwipe,
  trustText,
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

  /** Knapparna ska kännas som ett svep, inte som ett hopp. */
  const swipeProgrammatically = useCallback(
    (direction: SwipeDirection) => {
      translateX.value = withTiming(
        direction === 'LIKE' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5,
        { duration: FLY_OUT_MS },
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
          { duration: FLY_OUT_MS },
          (finished) => {
            if (finished) runOnJS(commit)(direction);
          },
        );
        return;
      }
      translateX.value = withSpring(0, { duration: SETTLE_MS });
      translateY.value = withSpring(0, { duration: SETTLE_MS });
    });

  const topCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-SCREEN_WIDTH, SCREEN_WIDTH], [-12, 12])}deg` },
    ],
    borderColor: interpolateColor(
      translateX.value,
      [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
      [colors.danger, colors.border, colors.positive],
    ),
  }));

  const likeStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [30, SWIPE_THRESHOLD], [0, 1], 'clamp'),
  }));

  const passStampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, -30], [1, 0], 'clamp'),
  }));

  if (!current) return null;

  return (
    <View style={styles.container}>
      <View style={styles.deck}>
        {/* Nästa kort skymtar bakom, indraget i sidorna och nedskjutet. */}
        {next ? <View style={styles.cardBehind} pointerEvents="none" /> : null}

        <GestureDetector gesture={pan}>
          <Animated.View key={keyExtractor(current)} style={[styles.card, topCardStyle]}>
            {renderCard(current)}

            <Animated.View style={[styles.stamp, styles.stampLike, likeStampStyle]} pointerEvents="none">
              <Text style={[styles.stampLabel, styles.stampLabelLike]}>INTRESSERAD</Text>
            </Animated.View>
            <Animated.View style={[styles.stamp, styles.stampPass, passStampStyle]} pointerEvents="none">
              <Text style={[styles.stampLabel, styles.stampLabelPass]}>HOPPAR ÖVER</Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.trustBar}>
        <LockIcon size={14} color={colors.positive} />
        <Text style={styles.trustText}>{trustText}</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hoppa över"
          onPress={() => swipeProgrammatically('PASS')}
          style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
        >
          <CloseIcon size={26} color={colors.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Intresserad"
          onPress={() => swipeProgrammatically('LIKE')}
          style={({ pressed }) => [styles.likeButton, pressed && styles.pressed]}
        >
          <CheckIcon size={30} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  deck: { flex: 1, marginHorizontal: spacing.base, position: 'relative' },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBehind: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 14,
    bottom: -10,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  stamp: {
    position: 'absolute',
    top: 56,
    paddingVertical: 10,
    paddingHorizontal: spacing.base,
    borderWidth: 3,
    borderRadius: radius.card,
    backgroundColor: colors.bg,
  },
  stampLike: { left: 16, borderColor: colors.positive, transform: [{ rotate: '-10deg' }] },
  stampPass: { right: 16, borderColor: colors.danger, transform: [{ rotate: '10deg' }] },
  stampLabel: { fontFamily: type.amount.fontFamily, fontSize: 22, letterSpacing: 0.88 },
  stampLabelLike: { color: colors.positive },
  stampLabelPass: { color: colors.danger },

  trustBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: 14,
    paddingBottom: 4,
    paddingHorizontal: spacing.lg,
  },
  trustText: { ...type.secondary, color: colors.muted },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingTop: 4,
    paddingBottom: 14,
  },
  skipButton: {
    width: HEIGHTS.swipeSkip,
    height: HEIGHTS.swipeSkip,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeButton: {
    width: HEIGHTS.swipeLike,
    height: HEIGHTS.swipeLike,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
});
