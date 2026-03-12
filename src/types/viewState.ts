export interface ViewState {
  stage: StageView;
  panel: PanelView | null;
}

export type StageView =
  // Tutorial (can appear in ANY phase — placement rule determines where)
  | { type: 'tutorial'; id: string }
  // Beginning (notification walkthrough)
  | { type: 'unactionable'; index: number }
  | { type: 'follower'; index: number }
  | { type: 'reply-to-user'; index: number }
  | { type: 'mention'; index: number }
  | { type: 'quote-post'; index: number }
  // Middle
  | { type: 'middle-card' }
  | { type: 'post'; index: number }
  | { type: 'thread'; postIndex: number }
  // End
  | { type: 'end-grid' }
  | { type: 'atmosphere' }
  | { type: 'liked-posts-grid' }
  | { type: 'share' }
  | { type: 'end-stats' }
  | { type: 'participation-claim' }
  | { type: 'participation-share' }
  | { type: 'award-nominate' }
  | { type: 'trophy-case' }

export type PanelView =
  | { type: 'settings' }
  | { type: 'hotkeys' }
  | { type: 'composer-reply'; targetUri: string }
  | { type: 'composer-quote'; targetUri: string }
  | { type: 'composer-new' }
