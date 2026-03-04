/**
 * AwardNominationPanel - JKLB Award nomination post composer
 *
 * Displays a non-editable nomination post with a quoted post embed.
 * The favorite post is pre-selected in the LikedPostsGrid (previous step).
 */

import { useCallback } from 'react';
import type { LikedPost } from '../types';

interface AwardNominationPanelProps {
  /** Pre-selected favorite post from LikedPostsGrid (null if none selected) */
  selectedPost: LikedPost | null;
  /** Called when user posts */
  onPost: (selectedPost: LikedPost | null, postText: string, image: File | null) => Promise<void>;
  /** Called when user skips */
  onSkip: () => void;
  /** Whether post is being submitted */
  isSubmitting?: boolean;
}

/**
 * Truncate text to specified length with ellipsis
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

export function AwardNominationPanel({
  selectedPost,
  onPost,
  onSkip,
  isSubmitting = false,
}: AwardNominationPanelProps) {
  // Full post text — simple nomination format
  const fullPostText = selectedPost
    ? `I nominate @${selectedPost.authorHandle} for a JKLB award for this post`
    : '';

  // Submit the post
  const handlePost = useCallback(async () => {
    if (isSubmitting) return;
    await onPost(selectedPost, fullPostText, null);
  }, [isSubmitting, selectedPost, fullPostText, onPost]);

  const canPost = !isSubmitting && !!selectedPost;

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Post preview */}
      <div>
        <label className="block text-sm text-[var(--memphis-text-muted)] mb-2">
          POST PREVIEW:
        </label>
        <div className="p-3 bg-[var(--memphis-bg)] border border-[var(--memphis-border)] rounded-md space-y-2">
          {/* Post text preview */}
          <pre className="text-sm text-[var(--memphis-text)] whitespace-pre-wrap font-sans">
            {fullPostText}
          </pre>

          {/* Quoted post indicator */}
          {selectedPost && (
            <div className="p-2 border border-dashed border-[var(--memphis-yellow)] rounded-md text-xs text-[var(--memphis-text-muted)]">
              Quote embed: @{selectedPost.authorHandle} — {truncate(selectedPost.textPreview, 60)}
            </div>
          )}
        </div>
      </div>

      <hr className="border-[var(--memphis-border)]" />

      {/* Footer with buttons */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onSkip}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm text-[var(--memphis-text-muted)] hover:text-[var(--memphis-text)] transition-colors disabled:opacity-50"
        >
          Skip
        </button>
        <button
          onClick={handlePost}
          disabled={!canPost}
          className={`px-6 py-2 text-sm rounded-md font-medium transition-colors ${
            canPost
              ? 'bg-[var(--memphis-cyan)] text-[var(--memphis-bg)] hover:opacity-90'
              : 'bg-[var(--memphis-border)] text-[var(--memphis-text-muted)] cursor-not-allowed'
          }`}
        >
          {isSubmitting ? 'Posting...' : 'Share'}
        </button>
      </div>
    </div>
  );
}
