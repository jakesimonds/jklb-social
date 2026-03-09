import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { AppLayout, SunsetPage, LoginModal } from './components';
import { useAuth } from './lib/AuthContext';
import { useSettings } from './lib/SettingsContext';
import { useToast } from './lib/ToastContext';
import { useFocusNavigation, useKeybindings, useFeed, useThread, usePostActions, useFullscreenMedia, useUnreadNotifications, useAtmosphereReport, useAvailableFeeds, useAuthorBanner, useBackgroundMusic, useBeginning, useEndFlow } from './hooks';
import { usePremium } from './hooks/usePremium';
import { applyTheme } from './lib/theme';
import { getPhase } from './lib/tutorials';
import type { ViewState, PanelView, StageView } from './types';
import { fetchPostReplies, getCachedReplies, transformPostView } from './lib/feed';
// Note: action functions are now called from usePostActions hook
import {
  createInitialChorusState,
  type ChorusState,
} from './lib/chorus';
import {
  startSession,
  getCurrentSession,
  setupSessionSaveOnUnload,
  trackLinkOpened,
  endSession,
  resetPostsViewed,
  createDefaultMetrics,
} from './lib/session';
import { createAwardNominationPost } from './lib/actions';
import type { LikedPost, SessionMetrics } from './types';
import { buildBskyPostUrl, getAllLinks, type LinkInfo } from './lib/post-utils';
import type { Post, FeedItem } from './types';
import { isPostFeedItem } from './types';

function App() {
  const {
    isInitializing,
    isLoading,
    isAuthenticated,
    session,
    profile,
    agent,
    error,
    login,
    logout,
  } = useAuth();

  const { settings, updateFeed } = useSettings();
  const { isPremium } = usePremium();

  // ── ViewState: single source of truth for app stage + panel ──────────
  const [viewState, setViewState] = useState<ViewState>({
    stage: { type: 'post', index: 0 },
    panel: null,
  });

  // ViewState helpers
  const openPanel = useCallback((panel: PanelView) =>
    setViewState(prev => ({ ...prev, panel })), []);
  const closePanel = useCallback(() =>
    setViewState(prev => ({ ...prev, panel: null })), []);
  const setStage = useCallback((stage: StageView) =>
    setViewState(prev => ({ ...prev, stage })), []);

  // Derived: is the current stage a thread view?
  const isInThreadView = viewState.stage.type === 'thread';

  // Beginning flow: fetches notifications and provides stage navigation
  const {
    state: beginningState,
    advance: beginningAdvance,
    goBack: beginningGoBack,
    isDone: beginningDone,
    sectionAvatarMap,
  } = useBeginning({
    agent,
    isAuthenticated,
    tutorialEnabled: settings.tutorial,
    isPremium,
  });

  // Chorus state for the right sidebar
  const [chorusState, setChorusState] = useState<ChorusState>(createInitialChorusState);

  // Staged chorus: during Beginning, only show avatars from stages the user has passed.
  // During Middle/End, show the full chorus.
  const visibleChorusState = useMemo((): ChorusState => {
    const phase = getPhase(viewState.stage);
    if (phase !== 'beginning') return chorusState;

    // Build set of visible DIDs from all passed stages' actors
    const visibleDids = new Set<string>();
    for (const section of sectionAvatarMap) {
      if (beginningState.passedStages.includes(section.stage)) {
        for (const actor of section.actors) {
          visibleDids.add(actor.did);
        }
      }
    }

    return {
      ...chorusState,
      members: chorusState.members.filter(m => visibleDids.has(m.did)),
    };
  }, [chorusState, viewState.stage, sectionAvatarMap, beginningState.passedStages]);

  // Feed state, fetching, and navigation via useFeed hook
  const {
    feedItems,
    currentItemIndex,
    isLoading: feedLoading,
    error: feedError,
    currentPost,
    currentPDSRecord,
    goToNextPost: feedGoToNext,
    goToPreviousPost: feedGoToPrev,
    setFeedItems,
    setCurrentItemIndex,
  } = useFeed({
    agent,
    isAuthenticated,
    isInitializing,
    feedSettings: settings.feed,
    chorusMemberDids: chorusState.members.map(m => m.did),
    onChorusRefresh: setChorusState,
  });

  // Thread view state via useThread hook
  const {
    isInThreadView: _threadHookInThreadView,
    threadPosts,
    threadDepths,
    threadIndex,
    originalPostIndex,
    enterThreadView,
    exitThreadView,
    navigateThread,
    handleThreadNavigate,
    setThreadPosts,
  } = useThread({ agent });

  // Replies state for the current post (unused in single-post view, kept for future)
  const [, setCurrentReplies] = useState<Post[]>([]);

  // Toast notifications from context
  const { showError, showInfo } = useToast();

  // Unread notifications indicator state via useUnreadNotifications hook
  // Defer polling until Beginning is done — the Beginning screen already shows notifications
  const {
    clearUnread: clearUnreadNotifications,
  } = useUnreadNotifications({ agent, isAuthenticated, beginningComplete: beginningDone });

  // Fullscreen media state via useFullscreenMedia hook
  const {
    isMediaFullscreen,
    fullscreenStartTime,
    currentImageIndex,
    currentPostHasMedia,
    toggleFullscreen,
    exitFullscreen,
    getFullscreenMedia,
    goToNextImage,
    goToPrevImage,
  } = useFullscreenMedia({ currentPost });

  // Derived state for quote navigation (currentPost comes from useFeed)
  const hasQuotedPost = !!(currentPost?.embed?.record);

  // Focus navigation between main post and quoted post
  const { focusTarget, resetHighlight, focusQuote, unfocusQuote } = useFocusNavigation({
    hasQuotedPost,
  });

  // Link cycling state for O/Shift+O — tracks which link is highlighted
  const [activeLinkIndex, setActiveLinkIndex] = useState(0);

  // Collect all links from the current post (for O and Shift+O)
  const currentLinks: LinkInfo[] = useMemo(() => {
    if (!currentPost) return [];
    return getAllLinks(currentPost);
  }, [currentPost]);

  // Reset active link index when post changes
  useEffect(() => {
    setActiveLinkIndex(0);
  }, [currentPost?.uri]);

  // Background atmosphere report pre-fetch
  // Starts scanning chorus members' PDSes once after login when first post arrives
  const {
    records: atmosphereRecords,
    isScanning: atmosphereScanning,
    progress: atmosphereProgress,
  } = useAtmosphereReport({
    chorusMembers: chorusState.members,
    isAuthenticated,
    hasFirstPost: feedItems.length > 0,
  });

  // Available feeds for settings dropdown (fetched from user's Bluesky preferences)
  const availableFeeds = useAvailableFeeds({ agent, isAuthenticated });

  // Fetch current post author's banner/cover image (not included in feed API)
  const authorBanner = useAuthorBanner({ agent, authorDid: currentPost?.author.did });

  // Fetch banner for the current Beginning notification author (follower, quote, reply, mention)
  const beginningAuthorDid = (() => {
    const { stage, currentIndex, items } = beginningState;
    switch (stage) {
      case 'follower': return items.followers[currentIndex]?.actor.did;
      case 'quotePost': return items.quotePosts[currentIndex]?.actor.did;
      case 'reply': return items.replies[currentIndex]?.actor.did;
      case 'mention': return items.mentions[currentIndex]?.actor.did;
      default: return undefined;
    }
  })();
  const beginningBanner = useAuthorBanner({ agent, authorDid: beginningAuthorDid });

  // Background music — fetch Player FM liked tracks and manage audio playback
  const { tracks: musicTracks, isLoadingTracks: musicLoadingTracks } = useBackgroundMusic({
    did: session?.did ?? null,
    isAuthenticated,
    musicSettings: settings.music,
    appPhase: getPhase(viewState.stage),
  });

  // End flow state machine: grid → sub-flows → grid
  const {
    state: endFlowState,
    enter: enterEndFlow,
    openSubFlow: endFlowOpenSubFlow,
    selectPost: selectEndFlowPost,
    exit: exitEndFlow,
    returnToGrid: endFlowReturnToGrid,
    advanceAward: endFlowAdvanceAward,
    goBackAward: endFlowGoBackAward,
    setHighlightedIndex: endFlowSetHighlightedIndex,
  } = useEndFlow();

  // ── Login modal state (standalone, not part of ViewState) ────────────
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Post actions (like, boost, reply, quote, post, unfollow, follow) via usePostActions hook
  const {
    handleLike,
    handleBoost,
    handleReply,
    handleQuote,
    handleUnfollow,
    handleFollow,
    handleSubmitComposer,
    handleCompose,
    composerTarget,
    setComposerTarget,
    isSubmittingComposer,
  } = usePostActions({
    agent,
    session,
    focusTarget,
    currentPost,
    isInThreadView,
    threadPosts,
    threadIndex,
    setFeedItems,
    setThreadPosts,
    setShowLoginPrompt,
    openPanel,
    closePanel,
  });

  // ── Panel management ─────────────────────────────────────────────────

  /**
   * Close just the ViewState panel (for panel stack j/k pop behavior).
   * Does NOT exit thread view or close login modals — only closes panels.
   */
  const closePanelClean = useCallback(() => {
    if (viewState.panel) {
      if (viewState.panel.type === 'composer-reply' || viewState.panel.type === 'composer-quote') {
        setComposerTarget(null);
      }
      closePanel();
    }
  }, [viewState.panel, closePanel, setComposerTarget]);

  /**
   * Close any active panel (settings, hotkeys, composers, login prompt, thread view)
   * Priority order: thread → login modal → login prompt → panel
   */
  const closeActivePanel = useCallback(() => {
    // Exit thread view if active
    if (isInThreadView) {
      exitThreadView();
      setStage({ type: 'post', index: currentItemIndex });
      return;
    }
    // Close login modal if open
    if (showLoginModal) {
      setShowLoginModal(false);
      return;
    }
    // Close login prompt if open
    if (showLoginPrompt) {
      setShowLoginPrompt(false);
      return;
    }
    // Close panel if open
    if (viewState.panel) {
      // For composers, clear the target post
      if (viewState.panel.type === 'composer-reply' || viewState.panel.type === 'composer-quote') {
        setComposerTarget(null);
      }
      closePanel();
      return;
    }
  }, [isInThreadView, exitThreadView, showLoginModal, showLoginPrompt, viewState.panel, closePanel, setStage, currentItemIndex, setComposerTarget]);

  // Ref for beginning component action handlers (like/boost/follow/viewOnBluesky/reply)
  // Beginning components register their handlers here; useKeybindings routes through it
  const beginningActionRef = useRef<{
    like?: () => void;
    boost?: () => void;
    follow?: () => void;
    viewOnBluesky?: () => void;
    reply?: () => void;
  }>({});

  const setBeginningActions = useCallback((actions: {
    like?: () => void;
    boost?: () => void;
    follow?: () => void;
    viewOnBluesky?: () => void;
    reply?: () => void;
  } | null) => {
    beginningActionRef.current = actions ?? {};
  }, []);

  // Saved posts via '?' key - session clipboard for award export
  const [savedPosts, setSavedPosts] = useState<string[]>([]);

  // Award nomination state - track submitting status
  const [isSubmittingAward, setIsSubmittingAward] = useState(false);

  // Sunset page state - shown after award nomination logout
  const [showSunset, setShowSunset] = useState(false);

  // Hash route state - track current route (e.g., '#/login')
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  // Get session data for award nomination panel
  const getSessionData = useCallback((): { metrics: SessionMetrics; likedPosts: LikedPost[] } => {
    const currentSession = getCurrentSession();
    return {
      metrics: currentSession?.metrics ?? createDefaultMetrics(),
      likedPosts: currentSession?.likedPosts ?? [],
    };
  }, []);

  // Handle award nomination post submission
  const handleAwardPost = useCallback(async (
    selectedPost: LikedPost | null,
    activity: string,
    image: File | null
  ) => {
    if (!agent) return;

    setIsSubmittingAward(true);
    try {
      // If the award-winning post was already boosted/reposted, undo the boost
      // (we're about to quote-post it instead, so the repost is redundant)
      if (selectedPost) {
        const boostedItem = feedItems.find(
          (item) => isPostFeedItem(item) && item.post.uri === selectedPost.uri
        );
        if (boostedItem && isPostFeedItem(boostedItem)) {
          const boostedPost = boostedItem.post;
          if (boostedPost.isReposted && boostedPost.repostUri) {
            try {
              await agent.deleteRepost(boostedPost.repostUri);
            } catch (err) {
              console.warn('Failed to undo boost on award post:', err);
            }
          }
        }
      }

      const currentSession = getCurrentSession();
      const metrics = currentSession?.metrics ?? createDefaultMetrics();

      const result = await createAwardNominationPost(agent, selectedPost, metrics, activity, image);

      if (result.success) {
        // Open the new post on bsky.app so the user can verify formatting
        if (result.uri && profile?.handle) {
          const postUrl = buildBskyPostUrl(profile.handle, result.uri);
          if (postUrl) {
            window.open(postUrl, '_blank', 'noopener,noreferrer');
          }
        }
        // End the session, clear saved posts, and log out
        endSession();
        setSavedPosts([]);
        showInfo('Shared! Logging out...');
        await logout();
        // Show sunset page after logout completes
        setShowSunset(true);
      } else {
        showError(result.error ?? 'Failed to post');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setIsSubmittingAward(false);
    }
  }, [agent, profile, logout, showInfo, showError, feedItems]);

  // Handle log back in from sunset page
  const handleLogBackIn = useCallback(() => {
    setShowSunset(false);
    setShowLoginModal(true);
  }, []);

  // ── ViewState sync effects ───────────────────────────────────────────

  // Sync beginning hook state → viewState
  // Maps useBeginning's internal stages to ViewState StageView types
  useEffect(() => {
    if (!isAuthenticated) return;
    if (beginningState.stage === 'done') return;

    let stage: StageView;
    switch (beginningState.stage) {
      case 'tutorialNav':      stage = { type: 'tutorial', id: 'nav' }; break;
      case 'tutorialActions':  stage = { type: 'tutorial', id: 'actions' }; break;
      case 'tutorialMoreKeys': stage = { type: 'tutorial', id: 'moreKeys' }; break;
      case 'unactionable':    stage = { type: 'unactionable', index: beginningState.currentIndex }; break;
      case 'follower':        stage = { type: 'follower', index: beginningState.currentIndex }; break;
      case 'quotePost':       stage = { type: 'quote-post', index: beginningState.currentIndex }; break;
      case 'reply':           stage = { type: 'reply-to-user', index: beginningState.currentIndex }; break;
      case 'mention':         stage = { type: 'mention', index: beginningState.currentIndex }; break;
      default: return;
    }

    setViewState(prev => ({ ...prev, stage }));
  }, [isAuthenticated, beginningState.stage, beginningState.currentIndex]);

  // Transition from Beginning to Middle card when Beginning is done
  // Premium users skip the middle card entirely
  useEffect(() => {
    if (beginningDone) {
      if (isPremium) {
        setStage({ type: 'post', index: 0 });
      } else {
        setStage({ type: 'middle-card' });
      }
    }
  }, [beginningDone, setStage, isPremium]);

  // Premium users always use chronological feed
  useEffect(() => {
    if (isPremium && isAuthenticated) {
      updateFeed({ algoFeed: null });
    }
  }, [isPremium, isAuthenticated, updateFeed]);

  // Sync end flow state → viewState
  useEffect(() => {
    if (!endFlowState.isActive) return;

    switch (endFlowState.stage) {
      case 'grid':          setStage({ type: 'end-grid' }); break;
      case 'award-liked':   setStage({ type: 'liked-posts-grid' }); break;
      case 'award-share':   setStage({ type: 'share' }); break;
      case 'stats':         setStage({ type: 'end-stats' }); break;
      case 'atmosphere':    setStage({ type: 'atmosphere' }); break;
    }
  }, [endFlowState.isActive, endFlowState.stage, setStage]);

  // When end flow deactivates, return to middle post browsing
  const prevEndFlowActiveRef = useRef(false);
  useEffect(() => {
    if (prevEndFlowActiveRef.current && !endFlowState.isActive) {
      setStage({ type: 'post', index: currentItemIndex });
    }
    prevEndFlowActiveRef.current = endFlowState.isActive;
  }, [endFlowState.isActive, currentItemIndex, setStage]);

  // Keep viewState.stage.index in sync with currentItemIndex (only during post stage)
  useEffect(() => {
    setViewState(prev => {
      if (prev.stage.type !== 'post') return prev;
      if (prev.stage.index === currentItemIndex) return prev;
      return { ...prev, stage: { type: 'post', index: currentItemIndex } };
    });
  }, [currentItemIndex]);

  // ── Session and auth effects ─────────────────────────────────────────

  // Start a new session when user becomes authenticated
  // This handles both fresh logins and returning users
  useEffect(() => {
    if (!isAuthenticated) return;

    // Check if there's already an active session
    const existingSession = getCurrentSession();
    if (existingSession) {
      // Session already exists (e.g., user refreshed the page)
      // Reset postsViewed counter on page reload so award progress starts fresh
      // This prevents "phantom" counts from before the reload
      resetPostsViewed();
      return;
    }

    // No active session - start a new one
    startSession();
  }, [isAuthenticated]);

  // Set up session save on page unload (beforeunload event)
  // Ensures session is saved when user closes tab/browser
  useEffect(() => {
    if (!isAuthenticated) return;

    // Set up the beforeunload handler and get the cleanup function
    const cleanup = setupSessionSaveOnUnload();

    // Clean up listener on unmount or when auth state changes
    return cleanup;
  }, [isAuthenticated]);

  // Reset all UI state on logout — ensures clean "not logged in" view from any path
  const prevAuthRef = useRef(isAuthenticated);
  useEffect(() => {
    if (prevAuthRef.current && !isAuthenticated) {
      // Just logged out — reset everything to default view
      setViewState({ stage: { type: 'post', index: 0 }, panel: null });
      exitThreadView();
      setShowSunset(false);
      setSavedPosts([]);
      setShowLoginPrompt(false);
      setShowLoginModal(false);
      // End the session so next login starts completely fresh
      endSession();
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, exitThreadView]);

  // Listen for hash changes (simple hash routing for /#/login)
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Navigate away from /#/login when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && currentHash === '#/login') {
      window.location.hash = '';
    }
  }, [isAuthenticated, currentHash]);

  // Derived: current post URI for replies fetching
  const currentPostUri = currentPost?.uri;

  // Fetch replies when current post changes
  useEffect(() => {
    if (!agent || !currentPostUri) {
      setCurrentReplies([]);
      return;
    }

    // Check cache first for instant response
    const cached = getCachedReplies(currentPostUri);
    if (cached) {
      setCurrentReplies(cached);
      return;
    }

    // Fetch replies asynchronously
    let isCancelled = false;

    fetchPostReplies(agent, currentPostUri).then((result) => {
      if (!isCancelled) {
        setCurrentReplies(result.replies);
      }
    });

    // Cleanup to avoid setting state on unmounted component
    return () => {
      isCancelled = true;
    };
  }, [agent, currentPostUri]);

  // ── Navigation ───────────────────────────────────────────────────────

  // Navigation functions for j/k keys (wrap useFeed navigation with thread view logic)
  const goToNextPost = useCallback(() => {
    if (isInThreadView) {
      exitThreadView();
    }
    feedGoToNext();
    // Explicitly set stage to 'post' — the sync effect can't transition from 'thread' to 'post'
    setStage({ type: 'post', index: currentItemIndex + 1 });
  }, [isInThreadView, exitThreadView, feedGoToNext, setStage, currentItemIndex]);

  const goToPreviousPost = useCallback(() => {
    if (isInThreadView) {
      exitThreadView();
    }
    feedGoToPrev();
    // Explicitly set stage to 'post' — the sync effect can't transition from 'thread' to 'post'
    setStage({ type: 'post', index: Math.max(0, currentItemIndex - 1) });
  }, [isInThreadView, exitThreadView, feedGoToPrev, setStage, currentItemIndex]);

  // Phase-aware navigation: j/k buttons in the perimeter use these
  // During Beginning, j/k navigate the Beginning flow instead of the feed
  const effectiveGoToNext = useCallback(() => {
    const phase = getPhase(viewState.stage);

    if (phase === 'beginning') {
      beginningAdvance();
    } else if (viewState.stage.type === 'middle-card') {
      setStage({ type: 'post', index: 0 });
    } else {
      goToNextPost();
    }
  }, [viewState.stage, beginningAdvance, goToNextPost, setStage]);

  const effectiveGoToPrev = useCallback(() => {
    const phase = getPhase(viewState.stage);

    if (phase === 'beginning') {
      beginningGoBack();
    } else if (viewState.stage.type === 'middle-card') {
      // Go back from middleCard to the last content stage in Beginning
      beginningGoBack();
    } else if (viewState.stage.type === 'post' && viewState.stage.index === 0) {
      // At first feed post — go back to middle-card (or Beginning for premium)
      if (isPremium) {
        beginningGoBack();
      } else {
        setStage({ type: 'middle-card' });
      }
    } else {
      goToPreviousPost();
    }
  }, [viewState.stage, beginningGoBack, goToPreviousPost, setStage, isPremium]);

  // ── Action handlers ──────────────────────────────────────────────────

  /**
   * Drill into the quoted post - loads it as the main post
   * Only works when focused on the quoted post (focusTarget === 'quote')
   */
  const drillIntoQuote = useCallback(() => {
    // Only drill in when focused on the quoted post
    if (focusTarget !== 'quote') return;

    const quotedPost = currentPost?.embed?.record;
    if (!quotedPost) return;

    // Convert QuotedPost to Post
    const targetPost: Post = {
      uri: quotedPost.uri,
      cid: quotedPost.cid,
      author: quotedPost.author,
      text: quotedPost.text,
      indexedAt: quotedPost.indexedAt,
      isLiked: false,
      isReposted: false,
    };

    // Check if this post already exists in our feed items array
    const existingIndex = feedItems.findIndex(item =>
      isPostFeedItem(item) && item.uri === targetPost.uri
    );

    if (existingIndex !== -1) {
      // Navigate to existing post
      setCurrentItemIndex(existingIndex);
    } else {
      // Add the post to the array and navigate to it
      // Insert it right after the current item for context
      const newItems = [...feedItems];
      const insertIndex = currentItemIndex + 1;
      const wrappedPost: FeedItem = {
        type: 'post',
        uri: targetPost.uri,
        indexedAt: targetPost.indexedAt,
        post: targetPost,
      };
      newItems.splice(insertIndex, 0, wrappedPost);
      setFeedItems(newItems);
      setCurrentItemIndex(insertIndex);
    }

    // Reset focus to main post after drilling in
    resetHighlight();
  }, [focusTarget, currentPost, feedItems, currentItemIndex, resetHighlight]);

  /**
   * Handle hotkeys button press (spacebar)
   * Toggles the hotkeys panel
   */
  const handleShowHotkeys = useCallback(() => {
    if (viewState.panel?.type === 'hotkeys') {
      closePanel();
    } else {
      openPanel({ type: 'hotkeys' });
    }
  }, [viewState.panel, closePanel, openPanel]);

  /**
   * Handle settings toggle (s key or S button)
   */
  const handleToggleSettings = useCallback(() => {
    if (viewState.panel?.type === 'settings') {
      closePanel();
    } else {
      openPanel({ type: 'settings' });
    }
  }, [viewState.panel, closePanel, openPanel]);

  /**
   * Handle E key press — trigger the End flow (atmosphere → liked posts grid → share)
   */
  const handleEnd = useCallback(() => {
    const phase = getPhase(viewState.stage);
    if (phase === 'end') return; // Already in end flow
    enterEndFlow();
  }, [viewState.stage, enterEndFlow]);

  /**
   * Handle End screen button press — routes instant actions or opens sub-flows
   */
  const handleEndButton = useCallback((id: string) => {
    if (id === 'logout') {
      endSession();
      logout();
      setShowSunset(true);
      return;
    }
    if (id === 'another') {
      // Full reset — end current session, start fresh
      exitEndFlow();
      endSession();
      startSession();
      setSavedPosts([]);
      setCurrentItemIndex(0);
      setStage({ type: 'post', index: 0 });
      return;
    }
    if (id === 'glitch') {
      window.open('https://tools.jakesimonds.com/glitchapp/', '_blank');
      return;
    }
    if (id === 'plyr') {
      window.open('https://plyr.fm', '_blank');
      return;
    }
    if (id === 'clipboard') {
      if (savedPosts.length === 0) {
        showInfo('No posts saved yet — press ? on a post to save it');
        return;
      }
      const postsText = savedPosts
        .map((post, i) => `Post ${i + 1}:\n${post}`)
        .join('\n\n---\n\n');
      const text = `A user of jklb.social had questions about these social media posts. Please explain any unfamiliar terms, references, or context:\n\n---\n\n${postsText}`;
      navigator.clipboard.writeText(text);
      showInfo(`Copied ${savedPosts.length} post(s) to clipboard!`);
      return;
    }
    endFlowOpenSubFlow(id);
  }, [logout, exitEndFlow, endFlowOpenSubFlow, savedPosts, showInfo, setCurrentItemIndex, setStage]);

  /**
   * Handle End screen grid hover — sync mouse highlight with keyboard state
   */
  const handleEndHoverButton = useCallback((index: number | null) => {
    endFlowSetHighlightedIndex(index);
  }, [endFlowSetHighlightedIndex]);

  /**
   * Grid keyboard navigation for End screen
   * Arrow keys move highlight, Enter/Space activates
   */
  useEffect(() => {
    if (!endFlowState.isActive || endFlowState.stage !== 'grid') return;

    const handleGridKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const idx = endFlowState.highlightedIndex ?? 0;
      const COLS = 3;
      const MAX = 8; // 0-8 for 3x3 grid
      const NON_EMPTY_COUNT = 6; // first 6 buttons are active

      // Helper: find next non-empty index in a direction
      const clamp = (n: number) => Math.max(0, Math.min(n, MAX));
      const skipEmpty = (target: number) => Math.min(target, NON_EMPTY_COUNT - 1);

      switch (e.key) {
        case 'ArrowRight': {
          e.preventDefault();
          endFlowSetHighlightedIndex(skipEmpty(clamp(idx + 1)));
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          endFlowSetHighlightedIndex(clamp(idx - 1));
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          endFlowSetHighlightedIndex(skipEmpty(clamp(idx + COLS)));
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          endFlowSetHighlightedIndex(clamp(idx - COLS));
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          // Import END_BUTTONS config inline to get button id
          const END_BUTTON_IDS = ['award', 'stats', 'atmosphere', 'clipboard', 'another', 'logout', 'empty1', 'empty2', 'empty3'];
          const id = END_BUTTON_IDS[idx];
          if (id && !id.startsWith('empty')) {
            handleEndButton(id);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleGridKeyDown);
    return () => window.removeEventListener('keydown', handleGridKeyDown);
  }, [endFlowState.isActive, endFlowState.stage, endFlowState.highlightedIndex, endFlowSetHighlightedIndex, handleEndButton]);

  /**
   * Handle open link button press ('o' key)
   * Opens the currently highlighted link (controlled by activeLinkIndex)
   */
  const handleOpenLink = useCallback(() => {
    if (currentLinks.length === 0) return;

    // Clamp index in case links changed
    const index = Math.min(activeLinkIndex, currentLinks.length - 1);
    const link = currentLinks[index];

    if (link?.url) {
      window.open(link.url, '_blank', 'noopener,noreferrer');
      trackLinkOpened();
    }
  }, [currentLinks, activeLinkIndex]);

  /**
   * Handle cycle link (Shift+O) — move to next link in the post
   */
  const handleCycleLink = useCallback(() => {
    if (currentLinks.length <= 1) return;
    setActiveLinkIndex(prev => (prev + 1) % currentLinks.length);
  }, [currentLinks.length]);

  /**
   * Handle view on Bluesky button press ('v' key)
   */
  const handleViewOnBluesky = useCallback(() => {
    const extractRkey = (uri: string): string | null => {
      const parts = uri.split('/');
      return parts.length > 0 ? parts[parts.length - 1] : null;
    };
    const buildBskyUrl = (handle: string, uri: string): string | null => {
      const rkey = extractRkey(uri);
      if (!rkey) return null;
      return `https://bsky.app/profile/${handle}/post/${rkey}`;
    };

    let url: string | null = null;
    if (focusTarget === 'main') {
      if (currentPost) {
        url = buildBskyUrl(currentPost.author.handle, currentPost.uri);
      }
    } else if (focusTarget === 'quote') {
      const quotedPost = currentPost?.embed?.record;
      if (quotedPost) {
        url = buildBskyUrl(quotedPost.author.handle, quotedPost.uri);
      }
    }
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [focusTarget, currentPost]);

  /**
   * Handle save post button press ('?' key)
   */
  const handleSavePost = useCallback(() => {
    const getThreadPost = () => {
      if (!isInThreadView || threadPosts.length === 0) return null;
      return threadPosts[threadIndex];
    };
    const targetPost = isInThreadView ? getThreadPost() : currentPost;

    if (!targetPost) return;

    const entry = `@${targetPost.author.handle}: ${targetPost.text}`;
    setSavedPosts(prev => [...prev, entry]);
    showInfo(`Saved (${savedPosts.length + 1})`);
  }, [currentPost, isInThreadView, threadPosts, threadIndex, savedPosts.length, showInfo]);

  /**
   * Handle reply from Beginning phase — post already fetched by BeginningPostCard
   */
  const handleBeginningReply = useCallback((post: Post) => {
    setComposerTarget(post);
    openPanel({ type: 'composer-reply', targetUri: post.uri });
  }, [openPanel, setComposerTarget]);

  /**
   * Handle reply notification click - fetch the reply post and open reply composer
   */
  const handleReplyNotificationClick = useCallback(async (replyUri: string) => {
    if (!agent) return;

    try {
      const response = await agent.getPostThread({
        uri: replyUri,
        depth: 0,
        parentHeight: 0,
      });

      const thread = response.data.thread;
      if (thread.$type !== 'app.bsky.feed.defs#threadViewPost' || !('post' in thread)) {
        showError('Could not load reply post');
        return;
      }

      const replyPost = transformPostView(
        thread.post as Parameters<typeof transformPostView>[0]
      );

      // Close notifications, set composer target, and open reply composer
      setComposerTarget(replyPost);
      openPanel({ type: 'composer-reply', targetUri: replyPost.uri });
    } catch (err) {
      console.error('Failed to fetch reply post:', err);
      showError('Failed to load reply post');
    }
  }, [agent, openPanel, showError, setComposerTarget]);

  /**
   * Handle Enter key press - enter thread view to see full thread context
   */
  const handleEnterThreadView = useCallback(() => {
    if (currentPost) {
      enterThreadView(currentPost);
      setStage({ type: 'thread', postIndex: currentItemIndex });
    }
  }, [currentPost, enterThreadView, setStage, currentItemIndex]);

  /**
   * Handle exiting thread view (t key when in thread, or Escape)
   */
  const handleExitThreadView = useCallback(() => {
    exitThreadView();
    setStage({ type: 'post', index: currentItemIndex });
  }, [exitThreadView, setStage, currentItemIndex]);

  // ── Keybindings ──────────────────────────────────────────────────────

  // Derive phase for action callback routing
  const currentPhase = getPhase(viewState.stage);

  // Centralized keybindings — always active, reads viewState for key gating.
  // Action callbacks route through beginningActionRef during Beginning phase,
  // and through usePostActions handlers during Middle/End.
  useKeybindings({
    viewState,
    isMediaFullscreen,
    currentPostHasMedia,
    isFocusedOnQuote: focusTarget === 'quote',
    onThreadNavigate: handleThreadNavigate,
    onNextPost: effectiveGoToNext,
    onPreviousPost: effectiveGoToPrev,
    onPostChange: resetHighlight,
    onDrillIn: drillIntoQuote,
    onToggleFullscreen: toggleFullscreen,
    onEnterThreadView: handleEnterThreadView,
    onExitThreadView: handleExitThreadView,
    onExitFullscreen: exitFullscreen,
    onEscape: closeActivePanel,
    onClosePanel: closePanelClean,
    // Action callbacks: route to beginning ref or main handlers per phase
    onLike: currentPhase === 'beginning'
      ? () => beginningActionRef.current.like?.()
      : (currentPhase === 'middle' || currentPhase === 'end') ? handleLike : undefined,
    onBoost: currentPhase === 'beginning'
      ? () => beginningActionRef.current.boost?.()
      : (currentPhase === 'middle' || currentPhase === 'end') ? handleBoost : undefined,
    onFollow: currentPhase === 'beginning'
      ? () => beginningActionRef.current.follow?.()
      : (currentPhase === 'middle' || currentPhase === 'end') ? handleFollow : undefined,
    onViewOnBluesky: currentPhase === 'beginning'
      ? () => beginningActionRef.current.viewOnBluesky?.()
      : handleViewOnBluesky,
    onReply: currentPhase === 'beginning'
      ? () => beginningActionRef.current.reply?.()
      : (currentPhase === 'middle' || currentPhase === 'end') ? handleReply : undefined,
    onQuote: (currentPhase === 'middle' || currentPhase === 'end') ? handleQuote : undefined,
    onOpen: currentPhase === 'middle' || currentPhase === 'end' ? handleOpenLink : undefined,
    onCycleLink: currentPhase === 'middle' || currentPhase === 'end' ? handleCycleLink : undefined,
    onFocusQuote: focusQuote,
    onUnfocusQuote: unfocusQuote,
    onUnfollow: currentPhase === 'middle' || currentPhase === 'end' ? handleUnfollow : undefined,
    onShowHotkeys: handleShowHotkeys,
    onSettings: handleToggleSettings,
    onSavePost: handleSavePost,
    onCompose: handleCompose,
    onEnd: handleEnd,
  });

  // Always apply dark theme
  useEffect(() => {
    applyTheme();
  }, []);

  // Compute middle progress: postsViewed / postsBeforePrompt (clamped 0-1)
  // Re-derives on every currentItemIndex change (which is when trackPostViewed fires)
  const middleProgress = (() => {
    const session = getCurrentSession();
    if (!session) return 0;
    const threshold = settings.credibleExit.postsBeforePrompt;
    if (threshold <= 0) return 0;
    return Math.min(session.metrics.postsViewed / threshold, 1);
  })();

  // Auto-transition to End flow when middle progress reaches 100%
  useEffect(() => {
    if (middleProgress < 1) return;
    const phase = getPhase(viewState.stage);
    if (phase !== 'middle') return; // Only trigger from Middle phase
    if (endFlowState.isActive) return; // Already in End flow
    enterEndFlow();
  }, [middleProgress, viewState.stage, endFlowState.isActive, enterEndFlow]);

  // ── Render ───────────────────────────────────────────────────────────

  // Show loading spinner during initialization
  if (isInitializing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--memphis-bg)]">
        <div className="text-center">
          <svg className="animate-spin h-10 w-10 text-[var(--memphis-pink)] mx-auto mb-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-[var(--memphis-cyan)]">Loading...</p>
        </div>
      </div>
    );
  }

  // Show sunset page after award nomination logout
  if (showSunset) {
    return <SunsetPage onLogBackIn={handleLogBackIn} />;
  }

  // Show dedicated login page at /#/login (only when not authenticated)
  if (currentHash === '#/login' && !isAuthenticated) {
    return (
      <LoginModal
        onLogin={login}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  // Main app content - rendered via AppLayout component
  // App.tsx acts as the controller, wiring hooks to the layout
  return (
    <>
    <AppLayout
      // ViewState (single source of truth for stage + panel)
      viewState={viewState}
      // Middle progress bar (postsViewed / postsBeforePrompt, 0-1)
      middleProgress={middleProgress}
      // Theme settings
      settings={settings}
      // Chorus state (staged during Beginning, full during Middle/End)
      chorusState={visibleChorusState}
      // Feed state
      feedItems={feedItems}
      feedLoading={feedLoading}
      feedError={feedError}
      currentPost={currentPost}
      currentPDSRecord={currentPDSRecord}
      authorBanner={authorBanner}
      // Thread state
      threadPosts={threadPosts}
      threadDepths={threadDepths}
      threadIndex={threadIndex}
      navigateThread={navigateThread}
      originalPostIndex={originalPostIndex}
      // Panel management
      onClosePanel={closePanel}
      onToggleSettings={handleToggleSettings}
      // Composer state
      composerTarget={composerTarget}
      setComposerTarget={setComposerTarget}
      isSubmittingComposer={isSubmittingComposer}
      handleSubmitComposer={handleSubmitComposer}
      // End flow state (award nomination / share step)
      onSkipJournal={() => { endFlowReturnToGrid(); }}
      getSessionData={getSessionData}
      onAwardPost={handleAwardPost}
      isSubmittingAward={isSubmittingAward}
      // End flow state machine
      endFlowState={endFlowState}
      onEndButton={handleEndButton}
      onEndHoverButton={handleEndHoverButton}
      onEndReturnToGrid={endFlowReturnToGrid}
      onEndFlowAdvanceAward={endFlowAdvanceAward}
      onEndFlowGoBackAward={endFlowGoBackAward}
      onEndFlowSelectPost={selectEndFlowPost}
      // Fullscreen media state
      isMediaFullscreen={isMediaFullscreen}
      fullscreenStartTime={fullscreenStartTime}
      currentImageIndex={currentImageIndex}
      getFullscreenMedia={getFullscreenMedia}
      toggleFullscreen={toggleFullscreen}
      exitFullscreen={exitFullscreen}
      goToNextImage={goToNextImage}
      goToPrevImage={goToPrevImage}
      // Modal states
      showLoginPrompt={showLoginPrompt}
      setShowLoginPrompt={setShowLoginPrompt}
      showLoginModal={showLoginModal}
      setShowLoginModal={setShowLoginModal}
      // Auth state for login modal
      isLoading={isLoading}
      error={error}
      login={login}
      // Navigation handlers (phase-aware: during Beginning, j/k navigate the flow)
      goToNextPost={effectiveGoToNext}
      goToPreviousPost={effectiveGoToPrev}
      currentPostIndex={currentItemIndex}
      // Beginning flow
      beginningState={beginningState}
      beginningBanner={beginningBanner}
      onBeginningAdvance={beginningAdvance}
      onBeginningGoBack={beginningGoBack}
      setBeginningActions={setBeginningActions}
      onBeginningReply={handleBeginningReply}
      onMiddleCardAdvance={() => {
        setStage({ type: 'post', index: 0 });
      }}
      // Quit/logout handler
      onQuit={logout}
      // Action handlers
      handleLike={handleLike}
      handleBoost={handleBoost}
      handleReply={handleReply}
      handleFollow={handleFollow}
      handleViewOnBluesky={handleViewOnBluesky}
      handleShowHotkeys={handleShowHotkeys}
      // Unread notifications (kept for Beginning flow)
      clearUnreadNotifications={clearUnreadNotifications}
      // Reply notification handler
      onReplyNotificationClick={handleReplyNotificationClick}
      // Atmosphere report (pre-fetched data)
      atmosphereRecords={atmosphereRecords}
      atmosphereScanning={atmosphereScanning}
      atmosphereProgress={atmosphereProgress}
      availableFeeds={availableFeeds}
      // Background music tracks for settings dropdown
      tracks={musicTracks}
      isLoadingTracks={musicLoadingTracks}
      // Link cycling state for O/Shift+O
      activeUrl={currentLinks[activeLinkIndex]?.url}
      // Quote focus state for Shift+J/K
      isFocusedOnQuote={focusTarget === 'quote'}
    />
    </>
  );
}

export default App;
