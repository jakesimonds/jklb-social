import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../lib/AuthContext';

interface ParticipationTrophy {
  number: number;
  claimedAt: string;
}

interface GiverRecord {
  uri: string;
  recipientDid: string;
  createdAt: string;
}

interface WinnerRecord {
  uri: string;
  nominatedByDid: string;
  createdAt: string;
}

export interface UseTrophiesReturn {
  loading: boolean;
  hasParticipationTrophy: boolean;
  participationTrophy: ParticipationTrophy | null;
  giverRecords: GiverRecord[];
  winnerRecords: WinnerRecord[];
  hasGivenBestThing: boolean;
  hasWonBestThing: boolean;
  refetch: () => void;
}

/**
 * Check the authenticated user's PDS for trophy records.
 * Fetches participation trophy, best-thing-giver, and best-thing-winner collections.
 */
export function useTrophies(): UseTrophiesReturn {
  const { agent, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [participationTrophy, setParticipationTrophy] = useState<ParticipationTrophy | null>(null);
  const [giverRecords, setGiverRecords] = useState<GiverRecord[]>([]);
  const [winnerRecords, setWinnerRecords] = useState<WinnerRecord[]>([]);
  const fetchedRef = useRef(false);

  const fetchTrophies = useCallback(async () => {
    if (!agent || !profile?.did) {
      setLoading(false);
      // Don't mark as fetched — retry when agent/profile become available
      return;
    }

    setLoading(true);

    try {
      const [participationRes, giverRes, winnerRes] = await Promise.all([
        agent.com.atproto.repo.listRecords({
          repo: profile.did,
          collection: 'social.jklb.participationTrophy',
          limit: 1,
        }).catch(() => null),
        agent.com.atproto.repo.listRecords({
          repo: profile.did,
          collection: 'social.jklb.bestThingISawAwardGiver',
          limit: 100,
        }).catch(() => null),
        agent.com.atproto.repo.listRecords({
          repo: profile.did,
          collection: 'social.jklb.bestThingISawAwardWinner',
          limit: 100,
        }).catch(() => null),
      ]);

      // Parse participation trophy
      const pRecord = participationRes?.data?.records?.[0];
      if (pRecord) {
        const val = pRecord.value as Record<string, unknown>;
        setParticipationTrophy({
          number: typeof val.number === 'number' ? val.number : 0,
          claimedAt: typeof val.claimedAt === 'string' ? val.claimedAt : '',
        });
      } else {
        setParticipationTrophy(null);
      }

      // Parse giver records
      const givers: GiverRecord[] = (giverRes?.data?.records ?? []).map((r) => {
        const val = r.value as Record<string, unknown>;
        return {
          uri: r.uri,
          recipientDid: typeof val.recipientDid === 'string' ? val.recipientDid : '',
          createdAt: typeof val.createdAt === 'string' ? val.createdAt : '',
        };
      });
      setGiverRecords(givers);

      // Parse winner records
      const winners: WinnerRecord[] = (winnerRes?.data?.records ?? []).map((r) => {
        const val = r.value as Record<string, unknown>;
        return {
          uri: r.uri,
          nominatedByDid: typeof val.nominatedByDid === 'string' ? val.nominatedByDid : '',
          createdAt: typeof val.createdAt === 'string' ? val.createdAt : '',
        };
      });
      setWinnerRecords(winners);
    } catch (err) {
      console.error('Failed to fetch trophies:', err);
      // Graceful fallback — empty state
      setParticipationTrophy(null);
      setGiverRecords([]);
      setWinnerRecords([]);
    } finally {
      setLoading(false);
    }
  }, [agent, profile?.did]);

  // Fetch once agent/profile are available
  useEffect(() => {
    if (fetchedRef.current || !agent || !profile?.did) return;
    fetchedRef.current = true;
    fetchTrophies();
  }, [fetchTrophies, agent, profile?.did]);

  const refetch = useCallback(() => {
    fetchedRef.current = false;
    fetchTrophies();
  }, [fetchTrophies]);

  return {
    loading,
    hasParticipationTrophy: participationTrophy !== null,
    participationTrophy,
    giverRecords,
    winnerRecords,
    hasGivenBestThing: giverRecords.length > 0,
    hasWonBestThing: winnerRecords.length > 0,
    refetch,
  };
}
