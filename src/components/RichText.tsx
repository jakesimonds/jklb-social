/**
 * RichText - Renders post text with link highlighting
 *
 * Takes post text and link facets (with byte positions) and renders
 * the text with links as styled spans. The active link (for O key)
 * is highlighted with underline.
 *
 * Handles UTF-8 to UTF-16 conversion for byte offsets from AT Proto.
 */

import type { RichLinkFacet } from '../types';

interface RichTextProps {
  text: string;
  linkFacets?: RichLinkFacet[];
  /** URL of the link that should be highlighted (the one O would open) */
  activeUrl?: string;
  className?: string;
}

/**
 * Convert UTF-8 byte offset to JavaScript string index (UTF-16 code units).
 * AT Proto facets use byte offsets, but JS strings use code unit indices.
 */
function byteOffsetToCharIndex(text: string, byteOffset: number): number {
  const encoder = new TextEncoder();
  let byteCount = 0;
  let charIndex = 0;

  for (const char of text) {
    if (byteCount >= byteOffset) break;
    byteCount += encoder.encode(char).length;
    charIndex += char.length; // Handle surrogate pairs
  }

  return charIndex;
}

interface TextSegment {
  type: 'text' | 'link';
  content: string;
  url?: string;
  isActive?: boolean;
}

/**
 * Split text into segments based on link facets.
 * Returns array of text and link segments in order.
 */
function segmentText(
  text: string,
  linkFacets: RichLinkFacet[],
  activeUrl?: string
): TextSegment[] {
  if (!linkFacets || linkFacets.length === 0) {
    return [{ type: 'text', content: text }];
  }

  // Sort facets by byte start position
  const sortedFacets = [...linkFacets].sort((a, b) => a.byteStart - b.byteStart);

  const segments: TextSegment[] = [];
  let lastCharIndex = 0;

  for (const facet of sortedFacets) {
    const startChar = byteOffsetToCharIndex(text, facet.byteStart);
    const endChar = byteOffsetToCharIndex(text, facet.byteEnd);

    // Add text before this link
    if (startChar > lastCharIndex) {
      segments.push({
        type: 'text',
        content: text.slice(lastCharIndex, startChar),
      });
    }

    // Add the link segment
    segments.push({
      type: 'link',
      content: text.slice(startChar, endChar),
      url: facet.url,
      isActive: facet.url === activeUrl,
    });

    lastCharIndex = endChar;
  }

  // Add any remaining text after the last link
  if (lastCharIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.slice(lastCharIndex),
    });
  }

  return segments;
}

export function RichText({ text, linkFacets, activeUrl, className }: RichTextProps) {
  const segments = segmentText(text, linkFacets || [], activeUrl);

  return (
    <p className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'text') {
          return <span key={index}>{segment.content}</span>;
        }

        // Link segment
        return (
          <a
            key={index}
            href={segment.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`
              transition-all duration-150
              ${segment.isActive
                ? 'text-[var(--memphis-yellow)] underline decoration-2 underline-offset-2 font-medium'
                : 'text-[var(--memphis-cyan)] hover:underline'
              }
            `}
            onClick={(e) => e.stopPropagation()}
          >
            {segment.content}
          </a>
        );
      })}
    </p>
  );
}
