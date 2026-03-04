// useAtmosphereReport hook - Background pre-fetch of atmosphere data
// Scans chorus members' PDSes once after login for non-Bluesky activity in last 24h
// Results are cached so opening the report is instant
//
// Performance: Members are fetched in parallel batches of 5 (each on different PDS
// endpoints), with 10-second per-request timeouts. A 30-member scan typically
// completes in ~10 seconds since most members have 0 non-Bluesky collections.

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ChorusMember } from '../types';
import type { PDSRecord } from '../lib/pds';
import { getPdsUrl, fetchRecentRecords } from '../lib/pds';

/** How many members to scan concurrently */
const CONCURRENCY = 5;

export interface AtmosphereRecord extends PDSRecord {
  authorHandle: string;
}

export interface UseAtmosphereReportParams {
  chorusMembers: ChorusMember[];
  isAuthenticated: boolean;
  /** True once the first post has been served to the user */
  hasFirstPost: boolean;
}

export interface UseAtmosphereReportReturn {
  /** Cached atmosphere records, sorted newest first */
  records: AtmosphereRecord[];
  /** Whether the background scan is still running */
  isScanning: boolean;
  /** Progress of the scan */
  progress: { current: number; total: number };
  /** Force a fresh re-scan (e.g., if user wants to refresh) */
  rescan: () => void;
}

/**
 * Fetch atmosphere records for a single member
 * Returns tagged records or empty array on failure
 */
async function fetchMemberRecords(
  member: ChorusMember,
  since: string,
): Promise<AtmosphereRecord[]> {
  try {
    const pdsUrl = await getPdsUrl(member.did);
    if (!pdsUrl) return [];

    const memberRecords = await fetchRecentRecords(pdsUrl, member.did, since);

    return memberRecords.map((r) => ({
      ...r,
      authorHandle: member.handle,
    }));
  } catch (err) {
    console.error(`[atmosphere] Failed to fetch records for ${member.handle}:`, err);
    return [];
  }
}

export function useAtmosphereReport({
  chorusMembers,
  isAuthenticated,
  hasFirstPost,
}: UseAtmosphereReportParams): UseAtmosphereReportReturn {
  const [records, setRecords] = useState<AtmosphereRecord[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Track whether we've already scanned this session
  const hasScannedRef = useRef(false);
  const abortRef = useRef(false);

  const runScan = useCallback((members: ChorusMember[]) => {
    if (members.length === 0) return;

    abortRef.current = false;
    setIsScanning(true);
    setProgress({ current: 0, total: members.length });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const fetchAll = async () => {
      const allRecords: AtmosphereRecord[] = [];
      let completed = 0;

      // Process members in parallel batches
      for (let i = 0; i < members.length; i += CONCURRENCY) {
        if (abortRef.current) break;

        const batch = members.slice(i, i + CONCURRENCY);

        const batchResults = await Promise.all(
          batch.map((member) => fetchMemberRecords(member, since))
        );

        if (abortRef.current) break;

        // Collect results from this batch
        for (const memberRecords of batchResults) {
          allRecords.push(...memberRecords);
        }

        completed += batch.length;
        setProgress({ current: completed, total: members.length });

        // Sort and update after each batch so UI shows results incrementally
        allRecords.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        setRecords([...allRecords]);
      }

      setIsScanning(false);
    };

    fetchAll();
  }, []);

  // Fire-and-forget scan once per session:
  // Triggers when authenticated + first post served + haven't scanned yet
  useEffect(() => {
    if (
      !isAuthenticated ||
      !hasFirstPost ||
      hasScannedRef.current ||
      chorusMembers.length === 0
    ) {
      return;
    }

    hasScannedRef.current = true;
    runScan(chorusMembers);

    return () => {
      abortRef.current = true;
    };
  }, [isAuthenticated, hasFirstPost, chorusMembers, runScan]);

  // Manual rescan function
  const rescan = useCallback(() => {
    hasScannedRef.current = false;
    abortRef.current = true;
    setTimeout(() => {
      hasScannedRef.current = true;
      runScan(chorusMembers);
    }, 100);
  }, [chorusMembers, runScan]);

  return {
    records,
    isScanning,
    progress,
    rescan,
  };
}
