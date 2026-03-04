// Mobile swipe hook — handles swipe direction → action mapping
// Manages compose state machine (none → reply ↔ quote) internally

import { useState, useCallback } from 'react';
import type { Agent } from '@atproto/api';
import type { Post, FeedItem, UndoableAction } from '../lib/types';
import { isPostFeedItem } from '../lib/types';
import { toggleLike, toggleRepost, createReply, createQuotePost } from '../lib/actions';
import { trackLike, trackUnlike, trackRepost, trackUnrepost } from '../lib/session';
import type { SwipeDirection } from '../components/SwipeCard';

export interface UseMobileSwipeParams {
  agent: Agent | null;
  feedItems: FeedItem[];
  setFeedItems: React.Dispatch<React.SetStateAction<FeedItem[]>>;
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  logAction: (action: Omit<UndoableAction, 'id' | 'timestamp'>) => void;
}

export interface UseMobileSwipeReturn {
  handleSwipe: (direction: SwipeDirection, post: Post) => void;
  composeMode: 'none' | 'reply' | 'quote';
  composeTarget: Post | null;
  toggleComposeMode: () => void;
  dismissCompose: () => void;
  handleSubmitCompose: (text: string, imageUri?: string) => Promise<'replied' | 'quoted' | null>;
  isSubmitting: boolean;
}

export function useMobileSwipe({
  agent,
  setFeedItems,
  setCurrentIndex,
  logAction,
}: UseMobileSwipeParams): UseMobileSwipeReturn {
  const [composeMode, setComposeMode] = useState<'none' | 'reply' | 'quote'>('none');
  const [composeTarget, setComposeTarget] = useState<Post | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const advanceToNext = useCallback(() => {
    setCurrentIndex(prev => prev + 1);
  }, [setCurrentIndex]);

  // Update the liked/reposted state in feedItems so the card reflects the action
  const updatePostInFeed = useCallback((postUri: string, updates: Partial<Post>) => {
    setFeedItems(prev => prev.map(item => {
      if (isPostFeedItem(item) && item.post.uri === postUri) {
        return { ...item, post: { ...item.post, ...updates } };
      }
      return item;
    }));
  }, [setFeedItems]);

  const makeTargetPost = useCallback((post: Post) => ({
    uri: post.uri,
    cid: post.cid,
    authorHandle: post.author.handle,
    authorDisplayName: post.author.displayName,
    textPreview: (post.text || '').slice(0, 60),
  }), []);

  const handleSwipe = useCallback((direction: SwipeDirection, post: Post) => {
    if (!agent) return;

    switch (direction) {
      case 'right': {
        // Like + advance
        toggleLike(agent, post).then(result => {
          if (result.success) {
            updatePostInFeed(post.uri, {
              isLiked: result.isLiked,
              likeUri: result.likeUri,
            });
            if (result.isLiked) {
              trackLike();
              if (result.likeUri) {
                logAction({ type: 'like', targetPost: makeTargetPost(post), resultUri: result.likeUri });
              }
            } else {
              trackUnlike();
            }
          }
        });
        advanceToNext();
        break;
      }

      case 'left': {
        // Skip — just advance, no action
        advanceToNext();
        break;
      }

      case 'up': {
        // Like + Boost + advance
        toggleLike(agent, post).then(result => {
          if (result.success) {
            updatePostInFeed(post.uri, {
              isLiked: result.isLiked,
              likeUri: result.likeUri,
            });
            if (result.isLiked) {
              trackLike();
              if (result.likeUri) {
                logAction({ type: 'like', targetPost: makeTargetPost(post), resultUri: result.likeUri });
              }
            } else {
              trackUnlike();
            }
          }
        });
        toggleRepost(agent, post).then(result => {
          if (result.success) {
            updatePostInFeed(post.uri, {
              isReposted: result.isReposted,
              repostUri: result.repostUri,
            });
            if (result.isReposted) {
              trackRepost();
              if (result.repostUri) {
                logAction({ type: 'boost', targetPost: makeTargetPost(post), resultUri: result.repostUri });
              }
            } else {
              trackUnrepost();
            }
          }
        });
        advanceToNext();
        break;
      }

      case 'down': {
        // Enter reply compose mode (don't advance)
        setComposeTarget(post);
        setComposeMode('reply');
        break;
      }
    }
  }, [agent, advanceToNext, updatePostInFeed, logAction, makeTargetPost]);

  const toggleComposeMode = useCallback(() => {
    setComposeMode(prev => prev === 'reply' ? 'quote' : 'reply');
  }, []);

  const dismissCompose = useCallback(() => {
    setComposeMode('none');
    setComposeTarget(null);
  }, []);

  const handleSubmitCompose = useCallback(async (text: string, imageUri?: string): Promise<'replied' | 'quoted' | null> => {
    if (!agent || !composeTarget || !text.trim()) return null;

    setIsSubmitting(true);
    try {
      // Capture mode before dismiss clears it
      const mode = composeMode;
      if (mode === 'reply') {
        const result = await createReply(agent, composeTarget, text, imageUri);
        if (result.success && result.uri) {
          logAction({ type: 'reply', targetPost: makeTargetPost(composeTarget), resultUri: result.uri });
        }
      } else {
        const result = await createQuotePost(agent, composeTarget, text, imageUri);
        if (result.success && result.uri) {
          logAction({ type: 'quote', targetPost: makeTargetPost(composeTarget), resultUri: result.uri });
        }
      }
      dismissCompose();
      advanceToNext();
      return mode === 'reply' ? 'replied' : 'quoted';
    } catch (err) {
      console.error('Failed to submit:', err);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [agent, composeTarget, composeMode, dismissCompose, advanceToNext, logAction, makeTargetPost]);

  return {
    handleSwipe,
    composeMode,
    composeTarget,
    toggleComposeMode,
    dismissCompose,
    handleSubmitCompose,
    isSubmitting,
  };
}
