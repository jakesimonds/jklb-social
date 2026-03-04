// CardStack — Shows current swipeable card with next card peeking behind
// In compose mode, shows compact context bar + inline ReplyComposer
// End-of-feed shows "ending" screen with action slot grid

import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import type { Post } from '../lib/types';
import type { SwipeDirection } from './SwipeCard';
import { SwipeCard } from './SwipeCard';
import { PostCard } from './PostCard';
import { ProfileHeader } from './ProfileHeader';
import { ReplyComposer } from './ReplyComposer';

interface CardStackProps {
  posts: Post[];
  currentIndex: number;
  onSwipe: (direction: SwipeDirection, post: Post) => void;
  swipeEnabled?: boolean;
  composeMode: 'none' | 'reply' | 'quote';
  composeTarget: Post | null;
  onSubmitCompose: (text: string, imageUri?: string) => Promise<void>;
  isSubmitting: boolean;
  onDismissCompose: () => void;
  onToggleComposeMode: () => void;
  onTakePhoto: () => void;
  onLongPress?: () => void;
}

export function CardStack({
  posts, currentIndex, onSwipe, swipeEnabled = true,
  composeMode, composeTarget, onSubmitCompose, isSubmitting,
  onDismissCompose, onToggleComposeMode, onTakePhoto, onLongPress,
}: CardStackProps) {
  const keyboard = useAnimatedKeyboard();
  const animatedStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value,
  }));

  const currentPost = posts[currentIndex];
  const nextPost = posts[currentIndex + 1];

  if (posts.length === 0 || currentIndex >= posts.length) {
    return (
      <View style={styles.endContainer}>
        <Text style={styles.endingTitle}>ending</Text>

        <View style={styles.slotGrid}>
          {/* Active slot: Take a photo */}
          <TouchableOpacity onPress={onTakePhoto} style={styles.slot}>
            <Text style={styles.slotIcon}>📸</Text>
            <Text style={styles.slotLabel}>Take a photo</Text>
          </TouchableOpacity>

          {/* Placeholder slots for future actions */}
          <View style={[styles.slot, styles.slotEmpty]}>
            <Text style={styles.slotEmptyText}>+</Text>
          </View>
          <View style={[styles.slot, styles.slotEmpty]}>
            <Text style={styles.slotEmptyText}>+</Text>
          </View>
          <View style={[styles.slot, styles.slotEmpty]}>
            <Text style={styles.slotEmptyText}>+</Text>
          </View>
        </View>
      </View>
    );
  }

  // Compose mode: compact context bar + toggle + inline composer
  if (composeMode !== 'none' && composeTarget) {
    return (
      <Animated.View style={[styles.composeContainer, animatedStyle]}>
        {/* Context bar: compact post preview + X button */}
        <View style={styles.contextBar}>
          <View style={styles.contextBarContent}>
            <PostCard post={composeTarget} compact />
          </View>
          <TouchableOpacity onPress={onDismissCompose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Pill toggle: Reply | Quote */}
        <View style={styles.pillContainer}>
          <TouchableOpacity
            onPress={() => composeMode !== 'reply' && onToggleComposeMode()}
            style={[styles.pillSegment, composeMode === 'reply' && styles.pillSegmentActive]}
          >
            <Text style={[styles.pillText, composeMode === 'reply' && styles.pillTextActive]}>
              Reply
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => composeMode !== 'quote' && onToggleComposeMode()}
            style={[styles.pillSegment, composeMode === 'quote' && styles.pillSegmentActive]}
          >
            <Text style={[styles.pillText, composeMode === 'quote' && styles.pillTextActive]}>
              Quote
            </Text>
          </TouchableOpacity>
        </View>

        {/* Inline composer */}
        <ReplyComposer
          mode={composeMode}
          targetPost={composeTarget}
          onSubmit={onSubmitCompose}
          isSubmitting={isSubmitting}
        />
      </Animated.View>
    );
  }

  // Normal browsing mode: swipeable card stack
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={500} style={styles.container}>
      {/* Back card removed — it bled through at 50% opacity, creating
         "shadow" artifacts behind the cover photo and profile pic */}

      {/* Top card — swipeable */}
      <SwipeCard
        key={currentPost.uri}
        onSwipe={(direction) => onSwipe(direction, currentPost)}
        enabled={swipeEnabled}
      >
        <ProfileHeader
          bannerUri={currentPost.author.banner}
          avatarUri={currentPost.author.avatar}
          displayName={currentPost.author.displayName}
          handle={currentPost.author.handle}
        />
        <PostCard post={currentPost} />
      </SwipeCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  composeContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  contextBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contextBarContent: {
    flex: 1,
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 18,
    fontWeight: '600',
  },
  pillContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 2,
    marginVertical: 8,
    alignSelf: 'flex-start',
  },
  pillSegment: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  pillSegmentActive: {
    backgroundColor: '#e94560',
  },
  pillText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: 'white',
  },
  endContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    alignItems: 'center',
  },
  endingTitle: {
    fontSize: 28,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 4,
    textTransform: 'lowercase',
    marginBottom: 40,
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
  },
  slot: {
    width: '44%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  slotIcon: {
    fontSize: 32,
  },
  slotLabel: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  slotEmpty: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  slotEmptyText: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 28,
    fontWeight: '300',
  },
});
