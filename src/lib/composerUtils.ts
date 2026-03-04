/**
 * Shared utilities for composer components (PostComposer, ReplyComposer, QuoteComposer)
 */

import type { PostAuthor } from '../types';

/**
 * Format author for display (displayName or handle)
 */
export function formatAuthor(author: PostAuthor): string {
  return author.displayName || `@${author.handle}`;
}

/**
 * Truncate text with ellipsis if over limit
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}
