/**
 * ParticipationClaim — Claim flow for participation trophies.
 *
 * Two states: confirm → loading. On success, calls onSuccess to transition
 * to the share composer (AwardNominationPanel).
 * Writes to both KV (via /api/participation) and PDS (createRecord).
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { EndSubFlowWrapper } from './EndSubFlowWrapper';

type ClaimStage = 'confirm' | 'loading';

interface ParticipationClaimProps {
  onBack: () => void;
  onRefetchTrophies: () => void;
  /** Called after successful claim — transitions to the share composer */
  onSuccess: () => void;
}

export function ParticipationClaim({ onBack, onRefetchTrophies, onSuccess }: ParticipationClaimProps) {
  const { agent, profile } = useAuth();
  const [stage, setStage] = useState<ClaimStage>('confirm');
  const [error, setError] = useState<string | null>(null);

  const did = profile?.did ?? '';
  const handle = profile?.handle ?? '';

  const handleClaim = useCallback(async () => {
    if (!agent || !did || !handle) return;

    setStage('loading');
    setError(null);

    try {
      // 1. POST to /api/participation → get { number, claimedAt }
      const res = await fetch('/api/participation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ did, handle }),
      });

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json() as { number: number; claimedAt: string };
      const number = data.number;

      // 2. Write PDS record (putRecord with fixed rkey for idempotency)
      await agent.com.atproto.repo.putRecord({
        repo: agent.assertDid,
        collection: 'social.jklb.participationTrophy',
        rkey: 'self',
        record: {
          $type: 'social.jklb.participationTrophy',
          number,
          createdAt: new Date().toISOString(),
        },
      });

      onRefetchTrophies();
      onSuccess();
    } catch (err) {
      console.error('Failed to claim participation trophy:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStage('confirm');
    }
  }, [agent, did, handle, onRefetchTrophies, onSuccess]);

  // Enter key confirms on confirm screen
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (stage === 'confirm' && e.key === 'Enter') {
        e.preventDefault();
        handleClaim();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage, handleClaim]);

  return (
    <EndSubFlowWrapper onBack={onBack}>
      <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-4">
        {stage === 'confirm' && (
          <>
            <h2 className="text-lg font-bold text-[var(--memphis-cyan)]">
              Claim your participation trophy
            </h2>
            <p className="text-sm text-[var(--memphis-text-muted)] max-w-sm">
              Writes a <span className="text-[var(--memphis-text)]">social.jklb.participationTrophy</span> record
              to your PDS. Makes you eligible for future jklb.social community stuff.
            </p>
            {error && (
              <p className="text-sm text-[var(--memphis-pink)]">{error}</p>
            )}
            <button
              onClick={handleClaim}
              className="mt-2 px-6 py-2 text-sm font-medium rounded-md cursor-pointer bg-[var(--memphis-cyan)] text-[var(--memphis-bg)] hover:opacity-90 transition-colors"
            >
              Claim
            </button>
            <p className="text-xs text-[var(--memphis-text-muted)]">
              press Enter to confirm
            </p>
          </>
        )}

        {stage === 'loading' && (
          <p className="text-sm text-[var(--memphis-text-muted)] animate-pulse">
            Writing to your PDS...
          </p>
        )}
      </div>
    </EndSubFlowWrapper>
  );
}
