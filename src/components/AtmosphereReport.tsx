/**
 * AtmosphereReport - Full-screen view of recent AT protocol records from chorus members
 *
 * Features:
 * - Directory-style view: records grouped by lexicon/collection
 * - Collapsible groups with triangle toggle (all collapsed by default)
 * - Uses pre-fetched records from useAtmosphereReport hook (background scan)
 * - Displays results using PDSEventCard components
 * - Keyboard: Escape/Delete to close
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AtmosphereRecord } from '../hooks/useAtmosphereReport';
import { PDSEventCard } from './PDSEventCard';
import { EndSubFlowWrapper } from './end/EndSubFlowWrapper';

interface AtmosphereReportProps {
  /** Pre-fetched records from useAtmosphereReport hook */
  cachedRecords: AtmosphereRecord[];
  /** Whether the background scan is still running */
  isScanning: boolean;
  /** Progress of the background scan */
  progress: { current: number; total: number };
  onClose: () => void;
}

/** Extract the first two dot-segments as the directory key: "network.cosmik" from "network.cosmik.card" */
function getDirectoryKey(collection: string): string {
  const parts = collection.split('.');
  return parts.length >= 2 ? `${parts[0]}.${parts[1]}` : collection;
}

/** Group records by first two dot-segments of collection, sorted by count descending */
function groupByDirectory(records: AtmosphereRecord[]): Map<string, AtmosphereRecord[]> {
  const groups = new Map<string, AtmosphereRecord[]>();
  for (const record of records) {
    const key = getDirectoryKey(record.collection);
    const existing = groups.get(key);
    if (existing) {
      existing.push(record);
    } else {
      groups.set(key, [record]);
    }
  }
  // Sort by count descending
  return new Map(
    [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
  );
}

/** Flip "pub.leaflet" → "https://leaflet.pub" */
function getDirectoryUrl(key: string): string {
  const parts = key.split('.');
  return `https://${parts[1]}.${parts[0]}`;
}

function CollectionDirectory({
  directoryKey,
  records,
  isExpanded,
  onToggle,
}: {
  directoryKey: string;
  records: AtmosphereRecord[];
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const url = getDirectoryUrl(directoryKey);

  return (
    <div className="border border-[var(--memphis-cyan)]/30 overflow-hidden" style={{ borderRadius: 'var(--card-radius)' }}>
      <div
        onClick={onToggle}
        className="
          w-full flex items-center gap-3 px-4 py-3
          bg-white/5 hover:bg-white/10
          transition-colors cursor-pointer
          text-left
        "
      >
        <span
          className="text-[var(--memphis-cyan)] text-xs transition-transform duration-200 select-none"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          &#9654;
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-sm text-[var(--memphis-cyan)] hover:underline"
        >
          {directoryKey}
        </a>
        <span className="text-xs text-[var(--memphis-text-muted)] font-mono">
          {records.length}
        </span>
      </div>
      {isExpanded && (
        <div className="px-4 py-3 border-t border-[var(--memphis-cyan)]/20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {records.map((record) => (
            <PDSEventCard
              key={record.uri}
              record={record}
              handle={record.authorHandle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AtmosphereReport({
  cachedRecords,
  isScanning,
  progress,
  onClose,
}: AtmosphereReportProps) {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => groupByDirectory(cachedRecords), [cachedRecords]);

  const toggleCollection = useCallback((collection: string) => {
    setExpandedCollections(prev => {
      const next = new Set(prev);
      if (next.has(collection)) {
        next.delete(collection);
      } else {
        next.add(collection);
      }
      return next;
    });
  }, []);

  // Keyboard handler: j/Escape/Delete to close
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Delete') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleKeyDown]);

  return (
    <EndSubFlowWrapper onBack={onClose}>
    <article
      className="
        bg-[var(--memphis-bg)]
        flex flex-col h-full overflow-hidden
      "
    >
      {/* Header with close hint and progress */}
      <header className="flex items-center justify-between px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-mono text-[var(--memphis-cyan)] font-bold">
            ATmosphere Report
          </span>
          {isScanning && (
            <span className="text-xs text-[var(--memphis-text-muted)]">
              scanning {progress.current}/{progress.total} members...
            </span>
          )}
          {!isScanning && (
            <span className="text-xs text-[var(--memphis-text-muted)]">
              {cachedRecords.length} record{cachedRecords.length !== 1 ? 's' : ''} in last 24h
            </span>
          )}
        </div>
        <span />

      </header>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {isScanning && cachedRecords.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-[var(--memphis-text-muted)] text-lg mb-2">
                Scanning the ATmosphere...
              </div>
              <div className="text-[var(--memphis-cyan)] text-sm font-mono">
                {progress.current}/{progress.total} members queried
              </div>
            </div>
          </div>
        ) : cachedRecords.length === 0 && !isScanning ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-[var(--memphis-text-muted)] text-lg">
              No recent non-Bluesky activity from chorus members
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {[...grouped.entries()].map(([dirKey, records]) => (
              <CollectionDirectory
                key={dirKey}
                directoryKey={dirKey}
                records={records}
                isExpanded={expandedCollections.has(dirKey)}
                onToggle={() => toggleCollection(dirKey)}
              />
            ))}
          </div>
        )}
      </div>
    </article>
    </EndSubFlowWrapper>
  );
}
