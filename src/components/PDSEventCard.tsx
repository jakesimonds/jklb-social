/**
 * PDSEventCard - Displays non-Bluesky records from ATProto PDSes
 *
 * This is a bare-bones card for displaying activity from non-Bluesky
 * ATProto apps like Atmosphere, WhiteWind, and custom lexicons.
 *
 * Features:
 * - Shows lexicon/collection name with badge
 * - Shows author handle and timestamp
 * - Shows text content preview when available
 * - Shows record key for traceability
 * - Links to appropriate client based on lexicon (pdsls fallback)
 *
 * Memphis styling, minimal - think pdsls aesthetic
 */

import type { PDSRecord } from '../lib/pds';

interface PDSEventCardProps {
  record: PDSRecord;
  handle?: string; // Optional author handle for display
  isFocused?: boolean;
}

/**
 * Format a timestamp for display
 */
function formatTime(isoTimestamp: string): string {
  if (!isoTimestamp) return '';

  try {
    const date = new Date(isoTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Get a human-readable name for a lexicon collection
 */
function getLexiconDisplayName(collection: string): string {
  // Known lexicon mappings
  const lexiconNames: Record<string, string> = {
    'blue.atmosphere.post': 'Atmosphere Post',
    'com.whtwnd.blog.entry': 'WhiteWind Blog',
    'app.bsky.feed.post': 'Bluesky Post',
    'app.bsky.feed.like': 'Like',
    'app.bsky.feed.repost': 'Boost',
    'app.bsky.graph.follow': 'Follow',
    'dev.tangled.issue': 'Tangled Issue',
    'dev.tangled.repo': 'Tangled Repo',
    'sh.tangled.repo.issue': 'Tangled Issue',
    'sh.tangled.repo': 'Tangled Repo',
    'sh.grain.photo': 'Grain Photo',
    'social.psky.feed.post': 'Psky Post',
    'li.plonk.paste': 'Plonk Paste',
    'pub.leaflet.document': 'Leaflet Doc',
    'pub.leaflet.publication': 'Leaflet Pub',
    'ing.dasl.masl': 'Web Tile',
  };

  if (lexiconNames[collection]) {
    return lexiconNames[collection];
  }

  // For unknown lexicons, format the collection name nicely
  // e.g., "com.example.thing" -> "Example Thing"
  const parts = collection.split('.');
  if (parts.length >= 2) {
    // Take the last two parts and capitalize
    const name = parts.slice(-2).map((part) =>
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' ');
    return name;
  }

  return collection;
}

/**
 * Get the client name for "Open in X" link text
 */
function getClientName(collection: string): string {
  const clientNames: Record<string, string> = {
    'blue.atmosphere.post': 'Atmosphere',
    'com.whtwnd.blog.entry': 'WhiteWind',
    'app.bsky.feed.post': 'Bluesky',
    'dev.tangled.issue': 'Tangled',
    'dev.tangled.repo': 'Tangled',
    'sh.tangled.repo.issue': 'Tangled',
    'sh.tangled.repo': 'Tangled',
    'sh.grain.photo': 'Grain',
    'social.psky.feed.post': 'Psky',
    'li.plonk.paste': 'Plonk',
    'pub.leaflet.document': 'Leaflet',
    'pub.leaflet.publication': 'Leaflet',
    'ing.dasl.masl': 'WebTil.es',
  };

  return clientNames[collection] || 'PDSls';
}

/**
 * Extract text content from a record if available
 */
function getRecordText(record: unknown): string | null {
  if (!record || typeof record !== 'object') return null;

  const rec = record as Record<string, unknown>;

  // Common text field names across lexicons
  if (typeof rec.text === 'string' && rec.text.trim()) {
    return rec.text;
  }

  // Title + body/description for structured content (issues, documents)
  let result = '';
  if (typeof rec.title === 'string' && rec.title.trim()) {
    result = rec.title.trim();
  }

  // Body field (Tangled issues, etc.)
  if (typeof rec.body === 'string' && rec.body.trim()) {
    const body = rec.body.trim();
    const truncated = body.length > 150 ? body.slice(0, 150) + '...' : body;
    result = result ? `${result}\n\n${truncated}` : truncated;
  }

  // Description field (Leaflet documents)
  if (typeof rec.description === 'string' && rec.description.trim()) {
    const desc = rec.description.trim();
    result = result ? `${result}\n\n${desc}` : desc;
  }

  // Content field (WhiteWind blog entries)
  if (!result && typeof rec.content === 'string' && rec.content.trim()) {
    const content = rec.content.trim();
    return content.length > 200 ? content.slice(0, 200) + '...' : content;
  }

  // Code field (Plonk pastes) - show snippet
  if (!result && typeof rec.code === 'string' && rec.code.trim()) {
    const code = rec.code.trim();
    const lines = code.split('\n').slice(0, 5).join('\n');
    return lines.length > 200 ? lines.slice(0, 200) + '...' : lines;
  }

  // Name field (Web Tiles / DASL MASL records)
  if (!result && typeof rec.name === 'string' && rec.name.trim()) {
    return rec.name.trim();
  }

  return result || null;
}

/**
 * Parse an AT URI to extract components
 * Format: at://did:plc:xxx/collection/rkey
 */
function parseAtUri(uri: string): { did: string; collection: string; rkey: string } | null {
  const match = uri.match(/^at:\/\/(did:[^/]+)\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { did: match[1], collection: match[2], rkey: match[3] };
}

/**
 * Get the URL to view this record in its native client
 * Falls back to pdsls.dev for unknown lexicons
 */
function getClientUrl(record: PDSRecord, handle?: string): string {
  const { collection, uri } = record;

  const parsed = parseAtUri(uri);
  if (!parsed) {
    // Fallback: link to pdsls with raw URI
    return `https://pdsls.dev/at/${encodeURIComponent(uri)}`;
  }

  const { did, rkey } = parsed;
  const identifier = handle || did;

  // Map known lexicons to their clients
  if (collection === 'app.bsky.feed.post') {
    return `https://bsky.app/profile/${identifier}/post/${rkey}`;
  }

  if (collection === 'blue.atmosphere.post') {
    return `https://atmosphere.blue/profile/${identifier}/post/${rkey}`;
  }

  if (collection === 'com.whtwnd.blog.entry') {
    return `https://whtwnd.com/${identifier}/${rkey}`;
  }

  if (collection === 'sh.tangled.repo.issue' || collection === 'sh.tangled.repo') {
    // Tangled uses @handle/repo format
    return `https://tangled.sh/@${identifier}`;
  }

  if (collection === 'social.psky.feed.post') {
    // Psky/Picosky - link to pdsls since no dedicated web client
    return `https://pdsls.dev/at/${did}/${collection}/${rkey}`;
  }

  if (collection === 'li.plonk.paste') {
    // Plonk pastes
    return `https://plonk.li/${rkey}`;
  }

  if (collection === 'pub.leaflet.document' || collection === 'pub.leaflet.publication') {
    // Leaflet documents
    return `https://leaflet.pub/@${identifier}`;
  }

  if (collection === 'ing.dasl.masl') {
    return `https://webtil.es/browser/?tile=${encodeURIComponent(uri)}`;
  }

  // For unknown lexicons, fall back to pdsls
  return `https://pdsls.dev/at/${did}/${collection}/${rkey}`;
}

export function PDSEventCard({ record, handle, isFocused = false }: PDSEventCardProps) {
  const displayName = getLexiconDisplayName(record.collection);
  const timestamp = formatTime(record.createdAt);
  const clientUrl = getClientUrl(record, handle);
  const clientName = getClientName(record.collection);
  const textContent = getRecordText(record.record);
  const parsed = parseAtUri(record.uri);
  const rkey = parsed?.rkey;

  return (
    <article
      className={`
        rounded-lg border-2 transition-all duration-200
        flex flex-col p-3
        ${isFocused
          ? 'border-[var(--memphis-pink)] bg-[var(--memphis-pink)]/10 shadow-lg shadow-[var(--memphis-pink)]/20'
          : 'border-[var(--memphis-cyan)]/50 bg-white/5 hover:border-[var(--memphis-cyan)]'
        }
      `}
      data-record-uri={record.uri}
    >
      {/* Lexicon badge */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-mono px-2 py-1 rounded bg-[var(--memphis-cyan)]/20 text-[var(--memphis-cyan)] border border-[var(--memphis-cyan)]/30">
          {displayName}
        </span>
        {timestamp && (
          <span className="text-xs text-white/50">
            {timestamp}
          </span>
        )}
      </div>

      {/* Author handle + collection */}
      <div className="flex items-center gap-2 text-xs text-white/50 mb-2">
        {handle && (
          <>
            <span className="text-[var(--memphis-yellow)]">@{handle}</span>
            <span>·</span>
          </>
        )}
        <span className="font-mono truncate">{record.collection}</span>
      </div>

      {/* Record key (for traceability) */}
      {rkey && (
        <div className="text-xs text-white/30 font-mono truncate mb-2">
          rkey: {rkey}
        </div>
      )}

      {/* Text content preview (if available) */}
      {textContent && (
        <p className="text-sm text-white/80 leading-relaxed mb-3 whitespace-pre-wrap break-words">
          {textContent}
        </p>
      )}

      {/* View link with client name */}
      <a
        href={clientUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-[var(--memphis-cyan)] hover:text-[var(--memphis-cyan)]/80 transition-colors flex items-center gap-1 mt-auto"
      >
        Open in {clientName} <span aria-hidden="true">→</span>
      </a>
    </article>
  );
}
