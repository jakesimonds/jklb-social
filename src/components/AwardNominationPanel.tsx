/**
 * AwardNominationPanel - Share composer for JKLB awards.
 *
 * Displays an editable textarea with a prefilled nomination message
 * and an optional quoted post embed. Used by both the Best Thing I Saw
 * nomination flow and the participation trophy share flow.
 */

import { useState, useCallback } from 'react';
import type { LikedPost } from '../types';

interface AwardNominationPanelProps {
  /** Default text to prefill in the textarea */
  defaultText: string;
  /** Optional quoted post to embed */
  quotedPost?: LikedPost | null;
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
  defaultText,
  quotedPost,
  onPost,
  onSkip,
  isSubmitting = false,
}: AwardNominationPanelProps) {
  const [postText, setPostText] = useState(defaultText);

  // Submit the post
  const handlePost = useCallback(async () => {
    if (isSubmitting) return;
    await onPost(quotedPost ?? null, postText, null);
  }, [isSubmitting, quotedPost, postText, onPost]);

  const canPost = !isSubmitting && postText.trim().length > 0;

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Editable post text */}
      <div>
        <label className="block text-sm text-[var(--memphis-text-muted)] mb-2">
          POST:
        </label>
        <textarea
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          disabled={isSubmitting}
          rows={3}
          className="w-full p-3 bg-[var(--memphis-bg)] border border-[var(--memphis-border)] rounded-md text-sm text-[var(--memphis-text)] resize-none focus:outline-none focus:border-[var(--memphis-cyan)] disabled:opacity-50"
          placeholder="Write your nomination..."
        />
      </div>

      {/* Quoted post indicator */}
      {quotedPost && (
        <div className="p-2 border border-dashed border-[var(--memphis-yellow)] rounded-md text-xs text-[var(--memphis-text-muted)]">
          Quote embed: @{quotedPost.authorHandle} — {truncate(quotedPost.textPreview, 60)}
        </div>
      )}

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
