// SwipeTutorial — Full-screen overlay teaching swipe directions
// Shows on first launch, dismisses on tap, returns on long press

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SwipeTutorialProps {
  visible: boolean;
  onDismiss: () => void;
}

export function SwipeTutorial({ visible, onDismiss }: SwipeTutorialProps) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onDismiss}
      style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View style={styles.content}>
        {/* Up arrow — Boost */}
        <View style={styles.direction}>
          <Text style={styles.arrow}>↑</Text>
          <Text style={styles.label}>BOOST</Text>
        </View>

        {/* Middle row — Left and Right */}
        <View style={styles.middleRow}>
          <View style={styles.direction}>
            <Text style={styles.arrow}>←</Text>
            <Text style={styles.label}>NO ACTION</Text>
          </View>

          <View style={styles.centerDot} />

          <View style={styles.direction}>
            <Text style={styles.arrow}>→</Text>
            <Text style={styles.label}>LIKE</Text>
          </View>
        </View>

        {/* Down arrow — Reply / Quote */}
        <View style={styles.direction}>
          <Text style={styles.arrow}>↓</Text>
          <Text style={styles.label}>REPLY / QUOTE</Text>
        </View>
      </View>

      <Text style={styles.hint}>tap anywhere to close</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 26, 46, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  content: {
    alignItems: 'center',
    gap: 48,
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 64,
  },
  direction: {
    alignItems: 'center',
    gap: 8,
  },
  arrow: {
    fontSize: 40,
    color: '#00bcd4',
    fontWeight: '300',
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 2,
  },
  centerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  hint: {
    position: 'absolute',
    bottom: 60,
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },
});
