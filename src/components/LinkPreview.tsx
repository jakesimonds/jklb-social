/**
 * LinkPreview - External link card component
 *
 * Displays a preview card for external links embedded in posts.
 * Shows thumbnail, title, and domain.
 */

import type { PostExternal } from '../types';
import { extractDomain } from '../lib/post-utils';

interface LinkPreviewProps {
  external: PostExternal;
  compact?: boolean;
  isHighlighted?: boolean;
}

export function LinkPreview({ external, compact = false, isHighlighted = false }: LinkPreviewProps) {
  const domain = extractDomain(external.uri);

  return (
    <a
      href={external.uri}
      target="_blank"
      rel="noopener noreferrer"
      className={`block mt-2 rounded border overflow-hidden transition-colors ${
        compact ? 'text-xs' : ''
      } ${
        isHighlighted
          ? 'border-[var(--memphis-yellow)] border-2 bg-white/10 shadow-[0_0_8px_#ffeb3b4d]'
          : 'border-white/20 bg-white/5 hover:bg-white/10'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex gap-2">
        {/* Thumbnail */}
        {external.thumb ? (
          <div className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} flex-shrink-0 bg-white/10`}>
            <img
              src={external.thumb}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ) : (
          <div className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} flex-shrink-0 bg-white/10 flex items-center justify-center`}>
            <span className="text-white/30 text-lg">🔗</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 py-1 pr-2">
          {/* Title */}
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} font-medium text-white/90 line-clamp-2 leading-tight`}>
            {external.title || domain}
          </div>

          {/* Domain */}
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-[var(--memphis-cyan)] mt-0.5 truncate`}>
            {domain}
          </div>
        </div>
      </div>
    </a>
  );
}
