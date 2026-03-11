/**
 * AppLayout - Main layout component for the app
 *
 * Receives all state and handlers as props, App.tsx acts as the controller
 * that wires hooks to this layout component.
 *
 * Layout structure:
 * - Top Bar: chorus avatars + jklb buttons + feed indicator + UserWidget
 * - Right Bar: more chorus avatars + action buttons
 * - Content Area: PostCard, Slab, or ScrollThread
 * - Mobile Strip: jklb buttons for narrow screens
 * - Overlays: modals for login, fullscreen media, etc.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  LoginModal,
  ComposerPanel,
  SettingsPanel,
  HotkeysPanel,
  AwardNominationPanel,
  FullscreenMedia,
  PostCard,
  PDSEventCard,
  TileFrame,
  ScrollThread,
  PerimeterCell,
  UserWidget,
  Slab,
  ProfileHover,
  calculateHoverPosition,
  HotkeyTooltip,
  calculateTooltipPosition,
  AtmosphereReport,
} from './index';
import { useHandleTypeahead } from '../hooks/useHandleTypeahead';
import type { HotkeyTooltipData } from './HotkeyTooltip';
import type { ProfileHoverData } from './ProfileHover';
import { useAuth } from '../lib/AuthContext';
import { FOOTER_LINKS } from '../lib/config';
import type { ViewState } from '../types';
import type { FullscreenMediaContent } from '../hooks/useFullscreenMedia';
import type { BeginningState } from '../hooks/useBeginning';
import type { EndFlowState } from '../hooks/useEndFlow';
import { BeginningView } from './beginning/BeginningView';
import { BeginningMiddleEnd } from './BeginningMiddleEnd';
import { SectionCard } from './SectionCard';
import { TutorialCard } from './TutorialCard';
import { TUTORIAL_CONTENT, getPhase } from '../lib/tutorials';
import { getPhaseBackground } from '../lib/themeConfig';
import { LikedPostsGrid } from './LikedPostsGrid';
import { EndScreenGrid } from './end/EndScreenGrid';
import { SessionStats } from './end/SessionStats';
import { ParticipationClaim } from './end/ParticipationClaim';
import { TrophyCase } from './end/TrophyCase';
import type { ChorusState } from '../lib/chorus';
import type { Post, FeedItem, Settings, PDSFeedItem, LikedPost, SessionMetrics } from '../types';
import type { ResolvedFeed } from '../lib/saved-feeds';
import type { ComposerMode } from './ComposerPanel';
// ComposeModal removed — compose now uses Slab like Settings/Hotkeys
import type { PlayerFMTrack } from '../lib/pds';
import { CuratorIndicator } from './CuratorIndicator';
import { usePremium } from '../hooks/usePremium';

/**
 * Props for the AppLayout component
 * All state and handlers are passed in from App.tsx
 */
export interface AppLayoutProps {
  // ViewState (derived from current state — VS-03 will replace the ternary chain)
  viewState: ViewState;

  // Middle progress bar (postsViewed / postsBeforePrompt, 0-1)
  middleProgress?: number;

  // Theme settings
  settings: Settings;

  // Chorus state
  chorusState: ChorusState;

  // Feed state
  feedItems: FeedItem[];
  feedLoading: boolean;
  feedError: string | null;
  currentPost: Post | null;
  currentPDSRecord: PDSFeedItem | null;
  authorBanner: string | null;

  // Thread state
  threadPosts: Post[];
  threadDepths: number[];
  threadIndex: number;
  navigateThread: (newIndex: number) => void;
  originalPostIndex: number;

  // Panel management callbacks
  onClosePanel: () => void;
  onToggleSettings: () => void;

  // Composer state
  composerTarget: Post | null;
  setComposerTarget: (target: Post | null) => void;
  isSubmittingComposer: boolean;
  handleSubmitComposer: (text: string, mode: ComposerMode) => Promise<void>;

  // Award nomination state
  onSkipJournal: () => void;
  getSessionData: () => { metrics: SessionMetrics; likedPosts: LikedPost[] };
  onAwardPost: (selectedPost: LikedPost | null, activity: string, image: File | null) => Promise<void>;
  isSubmittingAward: boolean;

  // Fullscreen media state
  isMediaFullscreen: boolean;
  fullscreenStartTime: number;
  currentImageIndex: number;
  getFullscreenMedia: () => FullscreenMediaContent;
  toggleFullscreen: () => void;
  exitFullscreen: () => void;
  goToNextImage: () => void;
  goToPrevImage: () => void;

  // Modal states
  showLoginPrompt: boolean;
  setShowLoginPrompt: (show: boolean) => void;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;

  // Auth state for login modal
  isLoading: boolean;
  error: string | null;
  login: (handle: string) => void;

  // Navigation handlers (phase-aware: during Beginning, j/k navigate the flow)
  goToNextPost: () => void;
  goToPreviousPost: () => void;
  currentPostIndex: number;

  // Beginning flow
  beginningState: BeginningState;
  beginningBanner: string | null;
  onBeginningAdvance: () => void;
  onBeginningGoBack: () => void;
  onMiddleCardAdvance: () => void;
  /** Setter for beginning component action handlers (like/boost/follow/reply) routed through useKeybindings */
  setBeginningActions?: (actions: {
    like?: () => void;
    boost?: () => void;
    follow?: () => void;
    viewOnBluesky?: () => void;
    reply?: () => void;
  } | null) => void;
  /** Reply handler for Beginning post cards — opens composer with the given post */
  onBeginningReply?: (post: Post) => void;

  // Action handlers
  handleLike: () => void;
  handleBoost: () => void;
  handleReply: () => void;
  handleFollow: () => void;
  handleViewOnBluesky: () => void;
  handleShowHotkeys: () => void;

  // Unread notifications (used by Beginning flow)
  clearUnreadNotifications: () => void;

  // Reply notification handler
  onReplyNotificationClick?: (replyUri: string) => void;

  // Atmosphere report (pre-fetched data from useAtmosphereReport hook)
  atmosphereRecords: import('../hooks/useAtmosphereReport').AtmosphereRecord[];
  atmosphereScanning: boolean;
  atmosphereProgress: { current: number; total: number };
  // End flow state machine
  endFlowState: EndFlowState;
  onEndButton: (id: string) => void;
  onEndHoverButton: (index: number | null) => void;
  onEndReturnToGrid: () => void;
  onEndFlowAdvanceAward: () => void;
  onEndFlowGoBackAward: () => void;
  onEndFlowSelectPost: (post: LikedPost | null) => void;
  /** Trophy state for End screen dynamic buttons + Trophy Case */
  trophyState: {
    hasParticipationTrophy: boolean;
    hasTrophies: boolean;
    participationTrophyNumber: number | null;
    hasGivenBestThing: boolean;
  };
  /** Exit the end flow entirely (close Slab) */
  onEndFlowExit: () => void;
  /** Refetch trophy data after claiming */
  onRefetchTrophies: () => void;

  // Quit/logout handler (q key)
  onQuit: () => void;

  // Available feeds for settings dropdown
  availableFeeds?: ResolvedFeed[];

  // Background music tracks for settings dropdown
  tracks?: PlayerFMTrack[];
  isLoadingTracks?: boolean;

  // Link cycling state for O/Shift+O
  activeUrl?: string;

  // Quote focus state for Shift+J/K
  isFocusedOnQuote?: boolean;

  // Curator: called when user clicks the green checkmark to enter curated mode
  onCuratorReady?: () => void;
}

/** Inline "Begin" login form with typeahead autocomplete */
function InlineLoginForm({ login, isLoading }: { login: (handle: string) => void; isLoading: boolean }) {
  const [handle, setHandle] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    suggestions,
    showSuggestions,
    selectedIndex,
    setSelectedIndex,
    handleKeyDown: typeaheadKeyDown,
    selectSuggestion,
    clearSuggestions,
    onFocus,
  } = useHandleTypeahead(handle);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = handle.trim();
    if (trimmed) {
      clearSuggestions();
      login(trimmed);
    }
  };

  const handleSelect = useCallback((suggestion: { handle: string; did: string }) => {
    setHandle(suggestion.handle);
    selectSuggestion(suggestion as Parameters<typeof selectSuggestion>[0]);
    // Auto-submit on selection
    login(suggestion.handle);
  }, [selectSuggestion, login]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const selected = typeaheadKeyDown(e);
    if (selected) {
      setHandle(selected.handle);
      login(selected.handle);
    }
  };

  // Close suggestions on outside click (dropdown is portaled, so check both)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        // Also check if click is inside the portaled dropdown
        const dropdown = document.querySelector('.typeahead-portal-dropdown');
        if (!dropdown || !dropdown.contains(target)) {
          clearSuggestions();
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearSuggestions]);

  return (
    <form
      onSubmit={handleSubmit}
      className="topbar-login-form flex items-center rounded-lg border border-[var(--memphis-pink)] bg-[var(--memphis-bg)] px-3 gap-3 flex-shrink min-w-0"
      style={{ width: `${8 * 72 + 7 * 4}px`, maxWidth: '100%', height: '72px' }}
    >
      <div ref={containerRef} className="relative flex flex-col gap-0.5 flex-1 min-w-0">
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          placeholder="alice.bsky.social"
          disabled={isLoading}
          autoComplete="off"
          className="w-full px-2 py-1 rounded text-sm bg-white/10 border border-[var(--memphis-cyan)] text-white placeholder-white/40 focus:outline-none focus:border-[var(--memphis-pink)] disabled:opacity-50"
        />
        <span className="text-[9px] text-[var(--memphis-text-muted)] leading-tight">
          Log in with your Bluesky handle
        </span>

        {/* Typeahead dropdown - portaled to body so it escapes overflow:hidden parents */}
        {showSuggestions && suggestions.length > 0 && containerRef.current && createPortal(
          <ul
            className="typeahead-portal-dropdown fixed z-[9999] rounded-lg border-2 border-[var(--memphis-cyan)] bg-[var(--memphis-navy)] overflow-hidden shadow-lg shadow-black/50"
            style={{
              top: containerRef.current.getBoundingClientRect().bottom + 4,
              left: containerRef.current.getBoundingClientRect().left,
              width: containerRef.current.closest('form')?.getBoundingClientRect().width ?? containerRef.current.getBoundingClientRect().width,
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {suggestions.map((actor, index) => (
              <li key={actor.did}>
                <button
                  type="button"
                  onClick={() => handleSelect(actor)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-3 py-2 flex items-center gap-2 text-left text-sm transition-colors
                    ${index === selectedIndex
                      ? 'bg-[var(--memphis-cyan)]/20 text-white'
                      : 'text-white/80 hover:bg-white/5'
                    }`}
                >
                  {actor.avatar ? (
                    <img src={actor.avatar} alt="" className="w-6 h-6 rounded-full flex-shrink-0 border border-white/20" />
                  ) : (
                    <div className="w-6 h-6 rounded-full flex-shrink-0 bg-white/10 border border-white/20" />
                  )}
                  <div className="min-w-0 flex-1">
                    {actor.displayName && (
                      <span className="text-[var(--memphis-text)] truncate">{actor.displayName}</span>
                    )}
                    <span className="text-[var(--memphis-text-muted)] ml-1 truncate">@{actor.handle}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )}
      </div>
      <button
        type="submit"
        disabled={isLoading}
        className="flex-shrink-0 px-5 rounded-lg font-bold bg-[var(--memphis-pink)] text-white hover:bg-[var(--memphis-pink)]/80 disabled:opacity-50 transition-colors"
        style={{ fontSize: '32px', lineHeight: 1, paddingTop: '6px', paddingBottom: '6px' }}
      >
        {isLoading ? '...' : 'begin'}
      </button>
    </form>
  );
}

export function AppLayout({
  viewState,
  middleProgress,
  settings: _settings,
  chorusState,
  feedItems,
  feedLoading,
  feedError,
  currentPost,
  currentPDSRecord,
  authorBanner,
  threadPosts,
  threadDepths,
  threadIndex,
  navigateThread,
  originalPostIndex,
  onClosePanel,
  onToggleSettings,
  composerTarget,
  setComposerTarget,
  isSubmittingComposer,
  handleSubmitComposer,
  onSkipJournal,
  getSessionData,
  onAwardPost,
  isSubmittingAward,
  isMediaFullscreen,
  fullscreenStartTime,
  currentImageIndex,
  getFullscreenMedia,
  toggleFullscreen,
  exitFullscreen,
  goToNextImage,
  goToPrevImage,
  showLoginPrompt,
  setShowLoginPrompt,
  showLoginModal,
  setShowLoginModal,
  isLoading,
  error,
  login,
  goToNextPost,
  goToPreviousPost,
  currentPostIndex: _currentPostIndex,
  beginningState,
  beginningBanner,
  onBeginningAdvance,
  onBeginningGoBack,
  onMiddleCardAdvance,
  setBeginningActions,
  onBeginningReply,
  handleLike,
  handleBoost,
  handleReply,
  handleFollow,
  handleViewOnBluesky: _handleViewOnBluesky,
  handleShowHotkeys,
  clearUnreadNotifications: _clearUnreadNotifications,
  onReplyNotificationClick: _onReplyNotificationClick,
  atmosphereRecords,
  atmosphereScanning,
  atmosphereProgress,
  endFlowState,
  onEndButton,
  onEndHoverButton,
  onEndReturnToGrid,
  onEndFlowAdvanceAward,
  onEndFlowGoBackAward,
  onEndFlowSelectPost,
  trophyState,
  onEndFlowExit,
  onRefetchTrophies,
  onQuit,
  availableFeeds = [],
  tracks = [],
  isLoadingTracks = false,
  activeUrl,
  isFocusedOnQuote = false,
  onCuratorReady,
}: AppLayoutProps) {
  // Get auth state for conditional rendering
  const { agent, isAuthenticated } = useAuth();
  const { isPremium } = usePremium();

  // Profile hover state
  const [hoveredProfile, setHoveredProfile] = useState<ProfileHoverData | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ top: number; left: number } | null>(null);
  const profileCacheRef = useRef<Map<string, ProfileHoverData>>(new Map());
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hotkey tooltip state
  const [hoveredHotkey, setHoveredHotkey] = useState<HotkeyTooltipData | null>(null);
  const [hotkeyTooltipPosition, setHotkeyTooltipPosition] = useState<{ top: number; left: number } | null>(null);
  const hotkeyHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Chorus grid capacity calculation
  // The border is a discrete grid - we calculate exactly how many cells fit
  const topBarRef = useRef<HTMLDivElement>(null);
  const rightBarRef = useRef<HTMLDivElement>(null);
  const [chorusCapacity, setChorusCapacity] = useState({ top: 0, right: 0 });

  // Cell dimensions
  const CELL_SIZE = 72;
  const GAP = 4;

  useEffect(() => {
    const calculateCapacity = () => {
      const cellWithGap = CELL_SIZE + GAP;

      // Top bar: measure container, subtract fixed elements
      // Fixed: 4 jklb buttons (4*76) + feed label (~80px) + UserWidget (~100px) + padding
      const TOP_FIXED = 4 * (CELL_SIZE + GAP) + 80 + 100 + 16;

      // Right bar: measure container, subtract action buttons
      // Fixed: up to 4 action buttons (o, ⎵, s, q) at (4*76) + padding
      const RIGHT_FIXED = 4 * (CELL_SIZE + GAP) + 16;

      let topCount = 0;
      let rightCount = 0;

      if (topBarRef.current) {
        const availableWidth = topBarRef.current.clientWidth - TOP_FIXED;
        topCount = Math.max(0, Math.floor(availableWidth / cellWithGap));
      }

      if (rightBarRef.current) {
        const availableHeight = rightBarRef.current.clientHeight - RIGHT_FIXED;
        rightCount = Math.max(0, Math.floor(availableHeight / cellWithGap));
      }

      setChorusCapacity({ top: topCount, right: rightCount });
    };

    calculateCapacity();
    window.addEventListener('resize', calculateCapacity);

    // ResizeObserver for container changes
    const observers: ResizeObserver[] = [];
    if (topBarRef.current) {
      const obs = new ResizeObserver(calculateCapacity);
      obs.observe(topBarRef.current);
      observers.push(obs);
    }
    if (rightBarRef.current) {
      const obs = new ResizeObserver(calculateCapacity);
      obs.observe(rightBarRef.current);
      observers.push(obs);
    }

    return () => {
      window.removeEventListener('resize', calculateCapacity);
      observers.forEach(obs => obs.disconnect());
    };
  }, []);

  // Slice chorus members to exactly what fits
  const topChorusMembers = chorusState.members.slice(0, chorusCapacity.top);
  const rightChorusMembers = chorusState.members.slice(
    chorusCapacity.top,
    chorusCapacity.top + chorusCapacity.right
  );

  // Track which chorus members are "new" for entry animation.
  // Compare current visible DIDs against previously seen DIDs.
  const prevChorusDidsRef = useRef<Set<string>>(new Set());
  const newChorusDids = useMemo(() => {
    const allVisible = new Set(chorusState.members.map(m => m.did));
    const entering = new Set<string>();
    for (const did of allVisible) {
      if (!prevChorusDidsRef.current.has(did)) {
        entering.add(did);
      }
    }
    return entering;
  }, [chorusState.members]);

  // After render, update the ref so next render knows what was already visible
  useEffect(() => {
    prevChorusDidsRef.current = new Set(chorusState.members.map(m => m.did));
  }, [chorusState.members]);

  // Build a stagger index for animation delay (50ms per avatar)
  const enteringStaggerIndex = useMemo(() => {
    const map = new Map<string, number>();
    let idx = 0;
    for (const member of chorusState.members) {
      if (newChorusDids.has(member.did)) {
        map.set(member.did, idx++);
      }
    }
    return map;
  }, [chorusState.members, newChorusDids]);

  // Handle mouse enter on a chorus avatar
  const handleAvatarMouseEnter = useCallback(async (
    member: { did: string; handle: string; displayName?: string; avatar?: string },
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Calculate position using shared utility that handles all edge cases
    const rect = event.currentTarget.getBoundingClientRect();
    const position = calculateHoverPosition(rect);

    setHoverPosition(position);

    // Check cache first
    const cached = profileCacheRef.current.get(member.did);
    if (cached) {
      setHoveredProfile(cached);
      return;
    }

    // Show basic profile data immediately (from chorus member)
    const basicProfile: ProfileHoverData = {
      did: member.did,
      handle: member.handle,
      displayName: member.displayName,
      avatar: member.avatar,
    };
    setHoveredProfile(basicProfile);

    // Fetch full profile (including description/website) if agent is available
    if (agent) {
      try {
        const response = await agent.getProfile({ actor: member.did });
        const fullProfile: ProfileHoverData = {
          did: response.data.did,
          handle: response.data.handle,
          displayName: response.data.displayName,
          avatar: response.data.avatar,
          description: response.data.description,
        };
        // Cache the profile
        profileCacheRef.current.set(member.did, fullProfile);
        setHoveredProfile(fullProfile);
      } catch (error) {
        console.error('Failed to fetch profile for hover:', error);
        // Keep showing basic profile on error
        profileCacheRef.current.set(member.did, basicProfile);
      }
    } else {
      // No agent, just cache the basic profile
      profileCacheRef.current.set(member.did, basicProfile);
    }
  }, [agent]);

  // Handle mouse leave on a chorus avatar
  const handleAvatarMouseLeave = useCallback(() => {
    // Add small delay before hiding to allow moving to the card
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredProfile(null);
      setHoverPosition(null);
    }, 150);
  }, []);

  // Handle mouse enter on the hover card itself (keep it visible)
  const handleHoverCardMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  // Handle mouse leave on the hover card
  const handleHoverCardMouseLeave = useCallback(() => {
    setHoveredProfile(null);
    setHoverPosition(null);
  }, []);

  // Handle mouse enter on a hotkey button
  const handleHotkeyMouseEnter = useCallback((
    hotkey: HotkeyTooltipData,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    // Clear any pending timeout
    if (hotkeyHoverTimeoutRef.current) {
      clearTimeout(hotkeyHoverTimeoutRef.current);
      hotkeyHoverTimeoutRef.current = null;
    }

    // Calculate position using shared utility
    const rect = event.currentTarget.getBoundingClientRect();
    const position = calculateTooltipPosition(rect);

    setHotkeyTooltipPosition(position);
    setHoveredHotkey(hotkey);
  }, []);

  // Handle mouse leave on a hotkey button
  const handleHotkeyMouseLeave = useCallback(() => {
    // Add small delay before hiding
    hotkeyHoverTimeoutRef.current = setTimeout(() => {
      setHoveredHotkey(null);
      setHotkeyTooltipPosition(null);
    }, 100);
  }, []);

  // Derive phase from viewState for phase indicator and theming
  const phase = getPhase(viewState.stage);

  // Active cover photo — either from the current post author or the beginning flow
  const activeBanner = (() => {
    const stageType = viewState.stage.type;
    if (stageType === 'post') return authorBanner;
    if (['unactionable', 'follower', 'reply-to-user', 'mention', 'quote-post'].includes(stageType)) return beginningBanner;
    return null;
  })();

  // Helper to render content based on viewState (flat switch replaces old ternary chain)
  function renderContent(): React.ReactNode {
    // 1. Panel takes priority (stack model — see specs/app-architecture.md)
    if (viewState.panel) {
      switch (viewState.panel.type) {
        case 'settings':
          return (
            <div className="postcard-container">
              <Slab title="Settings" onClose={onClosePanel}>
                <SettingsPanel tracks={tracks} isLoadingTracks={isLoadingTracks} />
              </Slab>
            </div>
          );
        case 'hotkeys':
          return (
            <div className="postcard-container">
              <Slab title="Hotkeys" onClose={onClosePanel}>
                <HotkeysPanel />
              </Slab>
            </div>
          );
        case 'composer-reply':
          return (
            <div className="postcard-container">
              <Slab title="Reply" onClose={() => { setComposerTarget(null); onClosePanel(); }}>
                <ComposerPanel
                  mode="reply"
                  targetPost={composerTarget}
                  onSubmit={(text) => handleSubmitComposer(text, 'reply')}
                  onCancel={() => { setComposerTarget(null); onClosePanel(); }}
                  isSubmitting={isSubmittingComposer}
                />
              </Slab>
            </div>
          );
        case 'composer-quote':
          return (
            <div className="postcard-container">
              <Slab title="Quote Post" onClose={() => { setComposerTarget(null); onClosePanel(); }}>
                <ComposerPanel
                  mode="quote"
                  targetPost={composerTarget}
                  onSubmit={(text) => handleSubmitComposer(text, 'quote')}
                  onCancel={() => { setComposerTarget(null); onClosePanel(); }}
                  isSubmitting={isSubmittingComposer}
                />
              </Slab>
            </div>
          );
        case 'composer-new':
          return (
            <div className="postcard-container">
              <Slab title="Compose" onClose={onClosePanel}>
                <ComposerPanel
                  mode="new"
                  onSubmit={(text) => handleSubmitComposer(text, 'new')}
                  onCancel={onClosePanel}
                  isSubmitting={isSubmittingComposer}
                />
              </Slab>
            </div>
          );
      }
    }

    // 2. Stage rendering — flat switch, no nesting
    switch (viewState.stage.type) {
      case 'tutorial':
        return (
          <div className="postcard-container">
            <TutorialCard
              id={viewState.stage.id}
              title={TUTORIAL_CONTENT[viewState.stage.id]?.title ?? ''}
              message={TUTORIAL_CONTENT[viewState.stage.id]?.message ?? ''}
              onAdvance={goToNextPost}
              onGoBack={goToPreviousPost}
              handleKeys={false}
            />
          </div>
        );

      case 'unactionable':
      case 'follower':
      case 'reply-to-user':
      case 'mention':
      case 'quote-post':
        return agent ? (
            <div className="postcard-container relative z-10">
              <BeginningView
                state={beginningState}
                advance={onBeginningAdvance}
                goBack={onBeginningGoBack}
                agent={agent}
                setBeginningActions={setBeginningActions}
                onReplyToPost={onBeginningReply}
              />
            </div>
        ) : null;

      case 'middle-card':
        return (
          <div className="postcard-container">
            <SectionCard
              section="middle"
              onAdvance={onMiddleCardAdvance}
              onGoBack={goToPreviousPost}
              availableFeeds={availableFeeds}
              handleKeys={false}
            />
          </div>
        );

      case 'post':
        return (
            <div
              className="postcard-container relative z-10"
              style={authorBanner ? { background: '#1a1a2e', borderRadius: 'var(--card-radius)' } : undefined}
            >
              {feedLoading && feedItems.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <svg className="animate-spin h-10 w-10 text-[var(--memphis-cyan)]" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              ) : feedError ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[var(--memphis-pink)] text-sm">{feedError}</p>
                </div>
              ) : currentPost ? (
                <PostCard
                  post={currentPost}
                  onFollow={handleFollow}
                  onLike={handleLike}
                  onBoost={handleBoost}
                  onReply={handleReply}
                  onImageClick={toggleFullscreen}
                  activeUrl={activeUrl}
                  isFocusedOnQuote={isFocusedOnQuote}
                />
              ) : currentPDSRecord ? (
                currentPDSRecord.record.collection === 'ing.dasl.masl' ? (
                  <TileFrame
                    record={currentPDSRecord.record}
                    handle={currentPDSRecord.authorHandle}
                    isFocused={true}
                  />
                ) : (
                  <PDSEventCard
                    record={currentPDSRecord.record}
                    handle={currentPDSRecord.authorHandle}
                    isFocused={true}
                  />
                )
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-[var(--memphis-text-muted)] text-sm">No posts to display</p>
                </div>
              )}
            </div>
        );

      case 'thread':
        return threadPosts.length > 0 ? (
          <ScrollThread
            posts={threadPosts}
            depths={threadDepths}
            currentIndex={threadIndex}
            onNavigate={navigateThread}
            originalPostIndex={originalPostIndex}
          />
        ) : null;

      case 'end-grid':
      case 'atmosphere':
      case 'end-stats':
      case 'liked-posts-grid':
      case 'share':
      case 'participation-claim':
      case 'award-nominate':
      case 'trophy-case': {
        // All end stages render inside a single Slab.
        // Escape from a sub-flow → back to grid; Escape from grid → exit end flow.
        const isAtGrid = viewState.stage.type === 'end-grid';
        const slabClose = isAtGrid ? onEndFlowExit : onEndReturnToGrid;
        const slabTitle = isAtGrid ? 'End' : undefined;

        let content: React.ReactNode = null;
        switch (viewState.stage.type) {
          case 'end-grid':
            content = (
              <EndScreenGrid
                onSelectButton={onEndButton}
                onHoverButton={onEndHoverButton}
                highlightedIndex={endFlowState.highlightedIndex}
                trophyState={trophyState}
              />
            );
            break;
          case 'atmosphere':
            content = (
              <AtmosphereReport
                cachedRecords={atmosphereRecords}
                isScanning={atmosphereScanning}
                progress={atmosphereProgress}
                onClose={onEndReturnToGrid}
              />
            );
            break;
          case 'end-stats': {
            const sessionData = getSessionData();
            const netLikes = sessionData.metrics.likes - sessionData.metrics.unlikes;
            content = (
              <SessionStats
                postsViewed={sessionData.metrics.postsViewed}
                likes={netLikes}
                boosts={sessionData.metrics.reposts}
                replies={sessionData.metrics.replies}
                linksOpened={sessionData.metrics.linksOpened}
                onBack={onEndReturnToGrid}
              />
            );
            break;
          }
          case 'liked-posts-grid': {
            const sessionData = getSessionData();
            content = (
              <LikedPostsGrid
                likedPosts={sessionData.likedPosts}
                onSelectPost={onEndFlowSelectPost}
                selectedPostUri={endFlowState.selectedPost?.uri}
                onAdvance={onEndFlowAdvanceAward}
                onGoBack={onEndFlowGoBackAward}
              />
            );
            break;
          }
          case 'share': {
            const selectedPost = endFlowState.selectedPost;
            const nominationDefault = selectedPost
              ? `I nominate @${selectedPost.authorHandle} for a JKLB award for this post`
              : '';
            content = (
              <AwardNominationPanel
                defaultText={nominationDefault}
                quotedPost={selectedPost}
                onPost={async (post, postText, image) => {
                  await onAwardPost(post, postText, image);
                }}
                onSkip={onSkipJournal}
                isSubmitting={isSubmittingAward}
              />
            );
            break;
          }
          case 'participation-claim':
            content = (
              <ParticipationClaim
                onBack={onEndReturnToGrid}
                onRefetchTrophies={onRefetchTrophies}
              />
            );
            break;
          case 'award-nominate':
            content = (
              <div className="flex items-center justify-center h-full">
                <p className="text-[var(--memphis-text-muted)] text-sm">Award nomination — coming soon</p>
              </div>
            );
            break;
          case 'trophy-case':
            content = (
              <TrophyCase
                onBack={onEndReturnToGrid}
                onStartNomination={() => onEndButton('active-award')}
                hasParticipationTrophy={trophyState.hasParticipationTrophy}
                participationTrophyNumber={trophyState.participationTrophyNumber}
                hasGivenBestThing={trophyState.hasGivenBestThing}
              />
            );
            break;
        }

        return (
          <div className="postcard-container">
            <Slab title={slabTitle} onClose={slabClose}>
              {content}
            </Slab>
          </div>
        );
      }
    }
  }

  return (
    <div className="text-[var(--memphis-text)] transition-colors app-layout" style={{ backgroundColor: getPhaseBackground(phase) }}>
      {/* Cover photo — extends behind the entire app layout */}
      {activeBanner && (
        <div
          className="absolute inset-0 opacity-40 z-0 pointer-events-none"
          style={{
            backgroundImage: `url(${activeBanner})`,
            backgroundRepeat: 'repeat-y',
            backgroundSize: '100% auto',
            backgroundPosition: 'top left',
          }}
        />
      )}
      {/* Tutorial grid — extends behind the entire app layout */}
      {viewState.stage.type === 'tutorial' && (
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(var(--memphis-border) 1px, transparent 1px), linear-gradient(90deg, var(--memphis-border) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      )}
      {/* Top Bar - jklb buttons + chorus avatars (fills remaining space) + UserWidget */}
      <div ref={topBarRef} className={`area-top-bar top-bar perimeter-bar`}>
        {/* jklb functional buttons - branding + hotkey reminder + clickable action */}
        <div
          onMouseEnter={(e) => handleHotkeyMouseEnter({ key: 'j', description: 'Next post (down)' }, e)}
          onMouseLeave={handleHotkeyMouseLeave}
        >
          <PerimeterCell
            onClick={goToNextPost}
            aria-label="j - Next post"
            className="jklb-button flex-col !gap-0"
            style={{ borderColor: 'var(--memphis-pink)' }}
          >
            <span className="font-mono text-lg font-bold text-[var(--memphis-pink)]">j</span>
            <span className="text-[8px] text-[var(--memphis-text-muted)] leading-none">next</span>
          </PerimeterCell>
        </div>
        <div
          onMouseEnter={(e) => handleHotkeyMouseEnter({ key: 'k', description: 'Previous post (up)' }, e)}
          onMouseLeave={handleHotkeyMouseLeave}
        >
          <PerimeterCell
            onClick={goToPreviousPost}
            aria-label="k - Previous post"
            className="jklb-button flex-col !gap-0"
            style={{ borderColor: 'var(--memphis-cyan)' }}
          >
            <span className="font-mono text-lg font-bold text-[var(--memphis-cyan)]">k</span>
            <span className="text-[8px] text-[var(--memphis-text-muted)] leading-none">prev</span>
          </PerimeterCell>
        </div>
        <div
          onMouseEnter={(e) => handleHotkeyMouseEnter({ key: 'l', description: 'Like / Unlike' }, e)}
          onMouseLeave={handleHotkeyMouseLeave}
        >
          <PerimeterCell
            onClick={handleLike}
            aria-label="l - Like post"
            className="jklb-button flex-col !gap-0"
            style={{ borderColor: 'var(--memphis-pink)' }}
          >
            <span className="font-mono text-lg font-bold text-[var(--memphis-pink)]">l</span>
            <span className="text-[8px] text-[var(--memphis-text-muted)] leading-none">like</span>
          </PerimeterCell>
        </div>
        <div
          onMouseEnter={(e) => handleHotkeyMouseEnter({ key: 'b', description: 'Boost / Unboost' }, e)}
          onMouseLeave={handleHotkeyMouseLeave}
        >
          <PerimeterCell
            onClick={handleBoost}
            aria-label="b - Boost"
            className="jklb-button flex-col !gap-0"
            style={{ borderColor: 'var(--memphis-yellow)' }}
          >
            <span className="font-mono text-lg font-bold text-[var(--memphis-yellow)]">b</span>
            <span className="text-[8px] text-[var(--memphis-text-muted)] leading-none">boost</span>
          </PerimeterCell>
        </div>

        {/* Spacer / Chorus avatars - fills remaining space */}
        {isAuthenticated ? (
          <div className="chorus-grid-top">
            {topChorusMembers.map((member) => {
              const isNewest = member.did === chorusState.newestMemberDid;
              const isEntering = newChorusDids.has(member.did);
              const staggerIdx = enteringStaggerIndex.get(member.did) ?? 0;
              return (
                <div
                  key={member.did}
                  className={`relative flex-shrink-0 ${isEntering ? 'chorus-entering' : ''}`}
                  style={isEntering ? { animationDelay: `${staggerIdx * 50}ms` } : undefined}
                  onMouseEnter={(e) => handleAvatarMouseEnter(member, e)}
                  onMouseLeave={handleAvatarMouseLeave}
                >
                  <PerimeterCell
                    onClick={() => window.open(`https://bsky.app/profile/${member.handle}`, '_blank')}
                    title={`@${member.handle}${member.interactionType ? ` (${member.interactionType})` : ''}${isNewest ? ' (newest!)' : ''}`}
                    className={`!p-0 overflow-hidden ${
                      isNewest
                        ? '!border-[var(--memphis-yellow)] shadow-[0_0_6px_var(--memphis-yellow)]'
                        : ''
                    }`}
                  >
                    {member.avatar ? (
                      <img src={member.avatar} alt={member.handle} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[var(--memphis-cyan)] flex items-center justify-center text-sm font-bold text-white">
                        {member.handle.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </PerimeterCell>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1" /> /* Spacer pushes login form to right corner */
        )}

        {/* Phase indicator (logged in) or inline login form (logged out) - pinned to far-right corner */}
        {isAuthenticated ? (
          <BeginningMiddleEnd phase={phase} />
        ) : (
          <InlineLoginForm login={login} isLoading={isLoading} />
        )}
      </div>

      {/* Right Bar - Chorus avatars (fills space) + action buttons at bottom */}
      <div ref={rightBarRef} className={`area-right-bar right-bar perimeter-bar`}>
        {/* Chorus avatars - renders exactly what fits in available space */}
        {/* Shows overflow from top bar (members that didn't fit) */}
        <div className="chorus-grid-right">
          {rightChorusMembers.map((member) => {
            const isNewest = member.did === chorusState.newestMemberDid;
            const isEntering = newChorusDids.has(member.did);
            const staggerIdx = enteringStaggerIndex.get(member.did) ?? 0;
            return (
              <div
                key={member.did}
                className={`relative ${isEntering ? 'chorus-entering' : ''}`}
                style={isEntering ? { animationDelay: `${staggerIdx * 50}ms` } : undefined}
                onMouseEnter={(e) => handleAvatarMouseEnter(member, e)}
                onMouseLeave={handleAvatarMouseLeave}
              >
                <PerimeterCell
                  onClick={() => window.open(`https://bsky.app/profile/${member.handle}`, '_blank')}
                  title={`@${member.handle}${member.interactionType ? ` (${member.interactionType})` : ''}${isNewest ? ' (newest!)' : ''}`}
                  className={`!p-0 overflow-hidden ${
                    isNewest
                      ? '!border-[var(--memphis-yellow)] shadow-[0_0_6px_var(--memphis-yellow)]'
                      : ''
                  }`}
                >
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.handle} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[var(--memphis-cyan)] flex items-center justify-center text-sm font-bold text-white">
                      {member.handle.charAt(0).toUpperCase()}
                    </div>
                  )}
                </PerimeterCell>
              </div>
            );
          })}
        </div>

        {/* Spacer to push action buttons to bottom */}
        <div className="flex-1" />

        {/* Action buttons at bottom of right bar - show hotkey letters */}
        <div
          onMouseEnter={(e) => handleHotkeyMouseEnter({ key: 'space', description: 'All hotkeys' }, e)}
          onMouseLeave={handleHotkeyMouseLeave}
        >
          <PerimeterCell
            onClick={handleShowHotkeys}
            aria-label="space - All hotkeys"
            title="space → all hotkeys"
            className="jklb-button flex-col !gap-0"
            style={{ borderColor: 'var(--memphis-cyan)' }}
          >
            <span className="font-mono text-xs font-bold text-[var(--memphis-cyan)]">space</span>
            <span className="text-[8px] text-[var(--memphis-text-muted)] leading-none">all hotkeys</span>
          </PerimeterCell>
        </div>

        <div
          onMouseEnter={(e) => handleHotkeyMouseEnter({ key: 's', description: 'Settings' }, e)}
          onMouseLeave={handleHotkeyMouseLeave}
        >
          <PerimeterCell
            onClick={onToggleSettings}
            aria-label="s - Settings"
            className="jklb-button flex-col !gap-0"
            style={{ borderColor: 'var(--memphis-yellow)' }}
          >
            <span className="font-mono text-lg font-bold text-[var(--memphis-yellow)]">s</span>
            <span className="text-[8px] text-[var(--memphis-text-muted)] leading-none">settings</span>
          </PerimeterCell>
        </div>

        {isAuthenticated && (
          <PerimeterCell
            onClick={onQuit}
            aria-label="Log out"
            title="log out"
            className="jklb-button flex-col !gap-0"
            style={{ borderColor: 'var(--memphis-pink)' }}
          >
            <span className="font-mono text-lg font-bold text-[var(--memphis-pink)]">⏻</span>
            <span className="text-[8px] text-[var(--memphis-text-muted)] leading-none">log out</span>
          </PerimeterCell>
        )}
      </div>

      {/* Content Area */}
      <div className="area-content content-area">
        {renderContent()}
      </div>

      {/* Progress bar — visible during Middle feed browsing */}
      {viewState.stage.type === 'post' && (middleProgress ?? 0) > 0 && (
        <div className="award-progress-track">
          <div className="award-progress-bar"
               style={{ width: `${(middleProgress ?? 0) * 100}%` }} />
        </div>
      )}

      {/* Mobile jklb Strip - visible only at narrow breakpoint (< 640px) */}
      {/* Shows the four core navigation/action keys + UserWidget for login/logout */}
      <div className="area-mobile-jklb mobile-jklb-strip">
        <button
          onClick={goToNextPost}
          className="mobile-jklb-button"
          style={{ borderColor: 'var(--memphis-pink)' }}
          title="j → Next post"
        >
          <span className="font-mono text-lg font-bold text-[var(--memphis-pink)]">j</span>
        </button>
        <button
          onClick={goToPreviousPost}
          className="mobile-jklb-button"
          style={{ borderColor: 'var(--memphis-cyan)' }}
          title="k → Previous post"
        >
          <span className="font-mono text-lg font-bold text-[var(--memphis-cyan)]">k</span>
        </button>
        <button
          onClick={handleLike}
          className="mobile-jklb-button"
          style={{ borderColor: 'var(--memphis-pink)' }}
          title="l → Like post"
        >
          <span className="font-mono text-lg font-bold text-[var(--memphis-pink)]">l</span>
        </button>
        <button
          onClick={handleBoost}
          className="mobile-jklb-button"
          style={{ borderColor: 'var(--memphis-yellow)' }}
          title="b → Boost"
        >
          <span className="font-mono text-lg font-bold text-[var(--memphis-yellow)]">b</span>
        </button>
        {/* Spacer to push UserWidget to the right */}
        <div className="flex-1" />
        {/* UserWidget for login/logout on mobile */}
        <UserWidget className="mobile-user-widget" onLoginRequest={() => setShowLoginModal(true)} />
      </div>

      {/* Fullscreen Media Overlay */}
      {isMediaFullscreen && (() => {
        const media = getFullscreenMedia();
        return (
          <FullscreenMedia
            images={media.images}
            video={media.video}
            startTime={fullscreenStartTime}
            currentImageIndex={currentImageIndex}
            onNextImage={goToNextImage}
            onPrevImage={goToPrevImage}
            onClose={exitFullscreen}
          />
        );
      })()}

      {/* Footer - desktop only (>1024px) */}
      <div className="hotkey-footer">
        <a
          href={FOOTER_LINKS.featureRequestBugReport}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--memphis-cyan)]"
        >
          feature requests/bug reports
        </a>
        <span className="mx-2">|</span>
        <a
          href={FOOTER_LINKS.blog}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[var(--memphis-cyan)]"
        >
          blog
        </a>
        <span className="mx-2">|</span>
        {'thank you for trying this!'}
      </div>

      {/* Curator Indicator — shows curation status for Premium users */}
      {isPremium && (
        <CuratorIndicator onClick={() => onCuratorReady?.()} />
      )}

      {/* Login Prompt Modal - shown when unauthenticated user tries an action */}
      {showLoginPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="bg-[var(--memphis-navy)] border-2 border-[var(--memphis-cyan)] rounded-xl p-6 max-w-md mx-4 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-2">Login Required</h2>
            <p className="text-[var(--memphis-cyan)] mb-6">
              You need to log in to perform this action. Browse posts with <span className="font-mono text-[var(--memphis-pink)]">j</span>/<span className="font-mono text-[var(--memphis-cyan)]">k</span> or log in to like, reply, and more.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="flex-1 py-2 px-4 rounded-lg border border-[var(--memphis-cyan)] text-[var(--memphis-cyan)] hover:bg-[var(--memphis-cyan)]/10 transition-colors"
              >
                Keep Browsing
              </button>
              <button
                onClick={() => {
                  setShowLoginPrompt(false);
                  setShowLoginModal(true);
                }}
                className="flex-1 py-2 px-4 rounded-lg bg-[var(--memphis-pink)] text-white font-semibold hover:bg-[var(--memphis-pink)]/80 transition-colors"
              >
                Log In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal - shown when user wants to log in */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
          <div className="relative">
            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute -top-10 right-0 text-white/50 hover:text-white text-sm"
            >
              Close (Esc)
            </button>
            <LoginModal
              onLogin={login}
              isLoading={isLoading}
              error={error}
            />
          </div>
        </div>
      )}

      {/* Profile Hover Card - shown when hovering over chorus avatars */}
      {hoveredProfile && hoverPosition && (
        <div
          className="fixed z-50"
          style={{ top: hoverPosition.top, left: hoverPosition.left }}
          onMouseEnter={handleHoverCardMouseEnter}
          onMouseLeave={handleHoverCardMouseLeave}
        >
          <ProfileHover
            profile={hoveredProfile}
            isVisible={true}
            className="relative"
          />
        </div>
      )}

      {/* Hotkey Tooltip - shown when hovering over hotkey buttons */}
      {hoveredHotkey && hotkeyTooltipPosition && (
        <div
          className="fixed z-50"
          style={{ top: hotkeyTooltipPosition.top, left: hotkeyTooltipPosition.left }}
        >
          <HotkeyTooltip
            hotkey={hoveredHotkey}
            isVisible={true}
            className="relative"
          />
        </div>
      )}
    </div>
  );
}
