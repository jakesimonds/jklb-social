// Main swipe screen — card stack with feed data and swipe actions
// Redirects to login if not authenticated

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../lib/AuthContext';
import { useActionLogContext } from '../lib/ActionLogContext';
import { CardStack } from '../components/CardStack';
import { SwipeTutorial } from '../components/SwipeTutorial';
import { ActionLabel } from '../components/ActionLabel';
import type { ActionType } from '../components/ActionLabel';
import { useMobileSwipe } from '../hooks/useMobileSwipe';
import { useFeed } from '../hooks/useFeed';
import { useSettings } from '../hooks/useSettings';
import type { Post } from '../lib/types';
import { isPostFeedItem } from '../lib/types';
import type { SwipeDirection } from '../components/SwipeCard';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

// Module-level flag: skip AppState reset when camera/end screen is active.
// Set to true before navigating to /end, cleared when AppState fires.
let _cameraActive = false;

export default function SwipeScreen() {
  const { isAuthenticated, isInitializing, agent } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { logAction } = useActionLogContext();

  // Tutorial overlay — show on first launch, re-show on long press
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('tutorial_seen').then((seen) => {
      if (!seen) setShowTutorial(true);
    });
  }, []);

  const dismissTutorial = useCallback(() => {
    setShowTutorial(false);
    AsyncStorage.setItem('tutorial_seen', 'true');
  }, []);

  const handleLongPress = useCallback(() => {
    setShowTutorial(true);
  }, []);

  const { feedItems, setFeedItems, isLoading, error, currentItemIndex, setCurrentItemIndex, resetFeed } = useFeed({
    agent,
    isAuthenticated,
    isInitializing,
    feedSettings: settings.feed,
  });

  // Reset feed when app returns from background — fresh session every time
  // Also dismiss any modal screens (end, settings) so user lands on fresh feed
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Don't reset if user is on the end/camera screen — the camera
        // activity causes a background→active transition we need to ignore
        if (_cameraActive) {
          _cameraActive = false;
          appState.current = nextAppState;
          return;
        }
        // Dismiss any modals (end screen, settings) first
        if (router.canDismiss()) {
          router.dismissAll();
        }
        resetFeed();
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [resetFeed, router]);

  const posts: Post[] = useMemo(() =>
    feedItems.filter(isPostFeedItem).map(item => item.post),
    [feedItems]
  );

  // Post budget from settings — controls progress bar + when to show end screen
  const postBudget = settings.credibleExit.postsBeforePrompt;

  // Animated progress bar — tracks against budget, not total posts loaded
  const progressValue = useSharedValue(0);
  useEffect(() => {
    if (posts.length > 0) {
      progressValue.value = withTiming(
        Math.min((currentItemIndex + 1) / postBudget, 1),
        { duration: 300 }
      );
    } else {
      progressValue.value = 0;
    }
  }, [currentItemIndex, postBudget, posts.length]);
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%`,
  }));

  const {
    handleSwipe: rawHandleSwipe, composeMode, composeTarget,
    toggleComposeMode, dismissCompose, handleSubmitCompose, isSubmitting,
  } = useMobileSwipe({
    agent,
    feedItems,
    setFeedItems,
    currentIndex: currentItemIndex,
    setCurrentIndex: setCurrentItemIndex,
    logAction,
  });

  // Action feedback label state
  const [lastAction, setLastAction] = useState<ActionType>(null);

  const handleSwipe = useCallback((direction: SwipeDirection, post: Post) => {
    // Show feedback label (down = compose mode, no label until submit)
    const actionMap: Record<SwipeDirection, ActionType> = {
      right: 'liked',
      left: 'next',
      up: 'boosted',
      down: null,
    };
    const action = actionMap[direction];
    if (action) setLastAction(action);

    rawHandleSwipe(direction, post);
  }, [rawHandleSwipe]);

  // Wrap submit to show replied/quoted action label on success
  const onSubmitCompose = useCallback(async (text: string, imageUri?: string) => {
    const result = await handleSubmitCompose(text, imageUri);
    if (result) {
      setLastAction(result);
    }
  }, [handleSubmitCompose]);

  // Show loading spinner during auth init
  if (isInitializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e94560" size="large" />
      </View>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e94560" size="large" />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.logo}>
          <Text style={{ color: '#e91e63' }}>j</Text>
          <Text style={{ color: '#00bcd4' }}>k</Text>
          <Text style={{ color: '#e91e63' }}>l</Text>
          <Text style={{ color: '#ffeb3b' }}>b</Text>
        </Text>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <Text style={styles.settingsButton}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      {posts.length > 0 && (
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressBar, progressBarStyle]} />
        </View>
      )}

      {/* Card stack + action feedback */}
      <View style={{ flex: 1 }}>
        <CardStack
          posts={posts.slice(0, postBudget)}
          currentIndex={currentItemIndex}
          onSwipe={handleSwipe}
          swipeEnabled={composeMode === 'none'}
          composeMode={composeMode}
          composeTarget={composeTarget}
          onSubmitCompose={onSubmitCompose}
          isSubmitting={isSubmitting}
          onDismissCompose={dismissCompose}
          onToggleComposeMode={toggleComposeMode}
          onTakePhoto={() => {
            _cameraActive = true;
            router.push('/end');
          }}
          onLongPress={handleLongPress}
        />
        <ActionLabel action={lastAction} onComplete={() => setLastAction(null)} />
        <SwipeTutorial visible={showTutorial} onDismiss={dismissTutorial} />
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  logo: { fontWeight: 'bold', fontSize: 18 },
  settingsButton: { color: 'rgba(255,255,255,0.5)', fontSize: 20 },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    width: '100%',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#00bcd4',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#e94560',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
