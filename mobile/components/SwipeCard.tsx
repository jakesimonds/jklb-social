import React, { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

interface SwipeCardProps {
  children: React.ReactNode;
  onSwipe: (direction: SwipeDirection) => void;
  enabled?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 0.25 * SCREEN_WIDTH; // 25% of screen width
const VELOCITY_THRESHOLD = 500; // px/s
const EXIT_DISTANCE = SCREEN_WIDTH * 1.5;

export function SwipeCard({ children, onSwipe, enabled = true }: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isExiting = useSharedValue(false);
  const enabledValue = useSharedValue(enabled);

  // Sync enabled prop to shared value for worklet access
  useEffect(() => {
    enabledValue.value = enabled;
  }, [enabled, enabledValue]);

  // Reset all gesture state when re-enabled (e.g., reply modal closed)
  useAnimatedReaction(
    () => enabledValue.value,
    (current, previous) => {
      if (current && previous === false) {
        isExiting.value = false;
        translateX.value = 0;
        translateY.value = 0;
      }
    },
  );

  const fireSwipe = (direction: SwipeDirection) => {
    onSwipe(direction);
  };

  const panGesture = Gesture.Pan()
    .enabled(enabled)
    .onUpdate((event) => {
      'worklet';
      if (isExiting.value) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      'worklet';
      if (isExiting.value) return;

      const absX = Math.abs(event.translationX);
      const absY = Math.abs(event.translationY);
      const absVX = Math.abs(event.velocityX);
      const absVY = Math.abs(event.velocityY);

      const isHorizontal = absX > absY;
      const offset = isHorizontal ? absX : absY;
      const velocity = isHorizontal ? absVX : absVY;
      const thresholdMet = offset > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD;

      if (!thresholdMet) {
        // Snap back
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        return;
      }

      // Determine direction
      let direction: SwipeDirection;
      if (isHorizontal) {
        direction = event.translationX > 0 ? 'right' : 'left';
      } else {
        direction = event.translationY > 0 ? 'down' : 'up';
      }

      // Down-swipe: snap back and notify parent (enters compose mode)
      if (direction === 'down') {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        runOnJS(fireSwipe)('down');
        return;
      }

      // All other directions: fly off screen
      isExiting.value = true;
      const exitX = direction === 'right' ? EXIT_DISTANCE
                   : direction === 'left' ? -EXIT_DISTANCE : 0;
      const exitY = direction === 'up' ? -EXIT_DISTANCE : 0;

      translateX.value = withTiming(exitX, { duration: 200 });
      translateY.value = withTiming(exitY, { duration: 200 }, () => {
        runOnJS(fireSwipe)(direction);
      });
    });

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-8, 0, 8]
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    ...StyleSheet.absoluteFillObject,
  },
});
