/**
 * ComposerPanel - Unified composer for new posts, replies, and quotes
 *
 * Used within ContentPanel (not as an overlay modal).
 * Replaces: PostComposer, ReplyComposer, QuoteComposer
 *
 * Modes:
 * - 'reply': Reply to a post - shows original post above composer
 * - 'quote': Quote a post - shows original post above composer
 */

import { useState, useRef, useEffect } from 'react';
import type { Post } from '../types';
import { formatAuthor, truncateText } from '../lib/composerUtils';

export type ComposerMode = 'reply' | 'quote';

interface ComposerPanelProps {
  /** The mode of the composer */
  mode: ComposerMode;
  /** The post being replied to or quoted (required for reply/quote modes) */
  targetPost?: Post | null;
  /** Called when the user submits */
  onSubmit: (text: string) => Promise<void>;
  /** Called when the user cancels */
  onCancel: () => void;
  /** Whether the submission is in progress */
  isSubmitting?: boolean;
}

/**
 * EmbeddedPost - Shows the post being replied to or quoted
 * Similar visual treatment to quoted posts in the feed
 */
function EmbeddedPost({ post, mode }: { post: Post; mode: 'reply' | 'quote' }) {
  const borderColor = mode === 'reply'
    ? 'border-[var(--memphis-cyan)]'
    : 'border-[var(--memphis-yellow)]';
  const label = mode === 'reply' ? 'Replying to:' : 'Quoting:';

  return (
    <div className={`mb-4 p-3 border ${borderColor} rounded-md bg-[var(--memphis-bg)]/50`}>
      <p className="text-xs text-[var(--memphis-text-muted)] mb-2">{label}</p>
      <div className="flex items-center gap-2 mb-2">
        {post.author.avatar && (
          <img
            src={post.author.avatar}
            alt=""
            className="w-6 h-6 rounded-full"
          />
        )}
        <span className="text-sm font-medium text-[var(--memphis-text)]">
          {formatAuthor(post.author)}
        </span>
        <span className="text-xs text-[var(--memphis-text-muted)]">
          @{post.author.handle}
        </span>
      </div>
      <p className="text-sm text-[var(--memphis-text)]">
        {truncateText(post.text, 200)}
      </p>
    </div>
  );
}

export function ComposerPanel({
  mode,
  targetPost,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ComposerPanelProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when component mounts
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Handle Enter key to submit (without Shift)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && text.trim() && !isSubmitting) {
      e.preventDefault();
      handleSubmit();
    }
    // Note: Escape is handled by ContentPanel at App level
  };

  const handleSubmit = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || isSubmitting) return;
    await onSubmit(trimmedText);
  };

  const charCount = text.length;
  const maxChars = 300; // Bluesky character limit
  const isOverLimit = charCount > maxChars;
  const canSubmit = text.trim().length > 0 && !isOverLimit && !isSubmitting;

  // Mode-specific configuration
  const config = {
    reply: {
      placeholder: 'Write your reply...',
      submitLabel: 'Reply',
      submittingLabel: 'Posting...',
      accentColor: 'var(--memphis-cyan)',
    },
    quote: {
      placeholder: 'Add your thoughts...',
      submitLabel: 'Quote',
      submittingLabel: 'Posting...',
      accentColor: 'var(--memphis-yellow)',
    },
  }[mode];

  return (
    <div className="flex flex-col h-full">
      {/* Embedded post for reply/quote modes */}
      {(mode === 'reply' || mode === 'quote') && targetPost && (
        <EmbeddedPost post={targetPost} mode={mode} />
      )}

      {/* Composer textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={config.placeholder}
        className="w-full flex-1 min-h-[120px] px-3 py-2 bg-[var(--memphis-bg)] border border-[var(--memphis-border)] rounded-md text-[var(--memphis-text)] placeholder-[var(--memphis-text-muted)] focus:outline-none resize-none"
        style={{ borderColor: `${config.accentColor}33` }}
        disabled={isSubmitting}
      />

      {/* Footer with char count and buttons */}
      <div className="flex items-center justify-between mt-3">
        <span
          className={`text-sm ${
            isOverLimit
              ? 'text-[var(--memphis-pink)]'
              : 'text-[var(--memphis-text-muted)]'
          }`}
        >
          {charCount}/{maxChars}
        </span>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-1.5 text-sm text-[var(--memphis-text-muted)] hover:text-[var(--memphis-text)] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-4 py-1.5 text-sm text-[var(--memphis-bg)] font-medium rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: config.accentColor }}
          >
            {isSubmitting ? config.submittingLabel : config.submitLabel}
          </button>
        </div>
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-[var(--memphis-text-muted)] mt-2">
        Press <kbd className="px-1 py-0.5 bg-[var(--memphis-bg)] border border-[var(--memphis-border)] rounded text-xs">Enter</kbd> to post, <kbd className="px-1 py-0.5 bg-[var(--memphis-bg)] border border-[var(--memphis-border)] rounded text-xs">Esc</kbd> to cancel
      </p>
    </div>
  );
}
