// Settings screen — post budget, feed picker, undo, logout, swipe legend

import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, FlatList, Modal, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/AuthContext';
import { useSettings } from '../hooks/useSettings';
import { useActionLogContext } from '../lib/ActionLogContext';
import { KNOWN_FEEDS } from '../lib/types';
import type { UndoableAction } from '../lib/types';
import { undoAction } from '../lib/actions';

const FEED_OPTIONS: { label: string; value: string | null }[] = [
  { label: 'Following (Chronological)', value: null },
  { label: 'Discover', value: KNOWN_FEEDS.DISCOVER },
  { label: "What's Hot", value: KNOWN_FEEDS.WHATS_HOT },
  { label: 'For You', value: KNOWN_FEEDS.FOR_YOU },
];

export default function SettingsScreen() {
  const { logout, profile, agent } = useAuth();
  const { settings, updateFeed, updateCredibleExit } = useSettings();
  const { actions, removeAction } = useActionLogContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showUndoModal, setShowUndoModal] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);

  const currentFeedValue = settings.feed.algoFeed;
  const postBudget = settings.credibleExit.postsBeforePrompt;

  const handleUndo = useCallback(async (action: UndoableAction) => {
    if (!agent) return;
    setUndoingId(action.id);
    const success = await undoAction(agent, action);
    if (success) {
      removeAction(action.id);
    }
    setUndoingId(null);
  }, [agent, removeAction]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {profile && (
          <Text style={styles.profileInfo}>
            Signed in as @{profile.handle}
          </Text>
        )}

        {/* Post budget */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Post budget</Text>
          <Text style={styles.sectionDescription}>
            Number of posts before a check-in prompt. Helps you stay intentional.
          </Text>
          <View style={styles.sliderRow}>
            <Slider
              style={styles.slider}
              minimumValue={5}
              maximumValue={50}
              step={5}
              value={postBudget}
              onSlidingComplete={(val: number) => updateCredibleExit({ postsBeforePrompt: val })}
              minimumTrackTintColor="#e94560"
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor="#e94560"
            />
            <Text style={styles.sliderValue}>{postBudget}</Text>
          </View>
        </View>

        {/* Feed picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feed</Text>
          <Text style={styles.sectionDescription}>
            Choose which feed to swipe through.
          </Text>
          {FEED_OPTIONS.map((option) => {
            const isSelected = currentFeedValue === option.value;
            return (
              <TouchableOpacity
                key={option.label}
                onPress={() => updateFeed({ algoFeed: option.value })}
                style={[styles.feedOption, isSelected && styles.feedOptionSelected]}
              >
                <Text style={[styles.feedOptionText, isSelected && styles.feedOptionTextSelected]}>
                  {option.label}
                </Text>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Undo button */}
        <TouchableOpacity onPress={() => setShowUndoModal(true)} style={styles.undoButton}>
          <Text style={styles.undoButtonText}>⌘Z Undo</Text>
          {actions.length > 0 && (
            <View style={styles.undoBadge}>
              <Text style={styles.undoBadgeText}>{actions.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity
          onPress={async () => { await logout(); router.replace('/login'); }}
          style={styles.logoutButton}
        >
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        {/* Swipe legend */}
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Swipe actions</Text>
          <Text style={styles.legendText}>→ Right: Like</Text>
          <Text style={styles.legendText}>← Left: Skip</Text>
          <Text style={styles.legendText}>↑ Up: Like + Boost</Text>
          <Text style={styles.legendText}>↓ Down: Reply (×2 = Quote)</Text>
        </View>

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>

      {/* Undo modal */}
      <Modal visible={showUndoModal} transparent animationType="slide">
        <View style={styles.undoModalOverlay}>
          <View style={styles.undoModalContent}>
            <View style={styles.undoModalHeader}>
              <Text style={styles.undoModalTitle}>Recent Actions</Text>
              <TouchableOpacity onPress={() => setShowUndoModal(false)}>
                <Text style={styles.undoModalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {actions.length === 0 ? (
              <Text style={styles.emptyText}>No actions to undo</Text>
            ) : (
              <FlatList
                data={actions}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <View style={styles.undoItem}>
                    <View style={styles.undoItemInfo}>
                      <Text style={styles.undoActionType}>
                        {item.type === 'like' ? '❤️ Liked' :
                         item.type === 'boost' ? '🔁 Boosted' :
                         item.type === 'reply' ? '↩️ Replied to' :
                         '💬 Quoted'}
                      </Text>
                      <Text style={styles.undoAuthor} numberOfLines={1}>
                        @{item.targetPost.authorHandle}
                      </Text>
                      <Text style={styles.undoPreview} numberOfLines={1}>
                        {item.targetPost.textPreview || '(no text)'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleUndo(item)}
                      style={styles.undoActionButton}
                      disabled={undoingId === item.id}
                    >
                      <Text style={styles.undoActionButtonText}>
                        {undoingId === item.id ? '...' : 'Undo'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  closeButton: { color: 'rgba(255,255,255,0.5)', fontSize: 18, paddingHorizontal: 8 },
  scrollContent: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  profileInfo: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 24 },

  // Sections
  section: { marginBottom: 28 },
  sectionTitle: { color: 'white', fontWeight: '600', fontSize: 16, marginBottom: 4 },
  sectionDescription: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 12 },

  // Slider
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  slider: { flex: 1, height: 40 },
  sliderValue: { color: '#e94560', fontWeight: '700', fontSize: 18, minWidth: 36, textAlign: 'right' },

  // Feed picker
  feedOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  feedOptionSelected: {
    backgroundColor: 'rgba(233,69,96,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(233,69,96,0.3)',
  },
  feedOptionText: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  feedOptionTextSelected: { color: 'white', fontWeight: '600' },
  checkmark: { color: '#e94560', fontSize: 16, fontWeight: '700' },

  // Undo button
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  undoButtonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  undoBadge: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  undoBadgeText: { color: 'white', fontSize: 12, fontWeight: '700' },

  // Logout
  logoutButton: {
    backgroundColor: 'rgba(220,38,38,0.8)',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: { color: 'white', fontWeight: '600', fontSize: 16 },

  // Legend
  legend: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  legendTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  legendText: { color: 'rgba(255,255,255,0.2)', fontSize: 12, marginBottom: 4 },

  // Undo modal
  undoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  undoModalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 32,
  },
  undoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  undoModalTitle: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  undoModalClose: { color: 'rgba(255,255,255,0.5)', fontSize: 18, paddingHorizontal: 8 },
  emptyText: { color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 32, fontSize: 14 },
  undoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  undoItemInfo: { flex: 1, marginRight: 12 },
  undoActionType: { color: 'white', fontWeight: '600', fontSize: 14 },
  undoAuthor: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 2 },
  undoPreview: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 2 },
  undoActionButton: {
    backgroundColor: 'rgba(233,69,96,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(233,69,96,0.4)',
  },
  undoActionButtonText: { color: '#e94560', fontWeight: '600', fontSize: 13 },
});
