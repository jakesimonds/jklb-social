// ActionLabel — brief word flash confirming what a swipe did
// Fades in, holds ~500ms, fades out. Absolutely positioned over the card area.

import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';

export type ActionType = 'liked' | 'boosted' | 'next' | 'replied' | 'quoted' | null;

interface ActionLabelProps {
  action: ActionType;
  onComplete: () => void;
}

const ACTION_CONFIG: Record<NonNullable<ActionType>, { text: string; color: string }> = {
  liked: { text: 'Liked', color: '#e94560' },
  boosted: { text: 'Boosted', color: '#f5c542' },
  next: { text: 'Next', color: 'rgba(255,255,255,0.5)' },
  replied: { text: 'Replied', color: '#0f9b8e' },
  quoted: { text: 'Quoted', color: '#0f9b8e' },
};

export function ActionLabel({ action, onComplete }: ActionLabelProps) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!action) return;

    // Fade in 150ms → hold 500ms → fade out 300ms
    opacity.value = withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(500, withTiming(0, { duration: 300 }, () => {
        runOnJS(onComplete)();
      })),
    );
  }, [action]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!action) return null;

  const config = ACTION_CONFIG[action];

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="none">
      <Animated.Text style={[styles.text, { color: config.color }]}>
        {config.text}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  text: {
    fontSize: 48,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
});
