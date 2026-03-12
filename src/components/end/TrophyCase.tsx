/**
 * TrophyCase — 3x3 grid showing earned and locked awards.
 *
 * Nested inside the End Slab. Each square represents an award level.
 * Earned awards are active with interactions; locked awards are greyed out teasers.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { AWARDS } from '../../types/awards';
import { EndSubFlowWrapper } from './EndSubFlowWrapper';
import { EndButton } from './EndButton';

interface TrophyCaseProps {
  onBack: () => void;
  /** Enter the Best Thing I Saw nomination flow (liked-posts → share) */
  onStartNomination: () => void;
  hasParticipationTrophy: boolean;
  hasGivenBestThing: boolean;
}

/** Total grid squares — always 9 (3x3) */
const GRID_SIZE = 9;

interface GridSquare {
  level: number;
  title: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
}

export function TrophyCase({
  onBack,
  onStartNomination,
  hasParticipationTrophy,
  hasGivenBestThing,
}: TrophyCaseProps) {
  const { profile } = useAuth();
  const did = profile?.did ?? '';

  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(0);

  // Build grid squares from AWARDS + placeholder future levels
  const buildSquares = useCallback((): GridSquare[] => {
    const squares: GridSquare[] = [];

    for (let level = 1; level <= GRID_SIZE; level++) {
      const award = AWARDS.find((a) => a.level === level);

      if (level === 1) {
        // Participation Trophy
        if (hasParticipationTrophy) {
          squares.push({
            level,
            title: 'Participation Trophy',
            description: 'view your record on pdsls.dev',
            disabled: false,
            onClick: () => {
              window.open(`https://pdsls.dev/at/${did}/social.jklb.participationTrophy`, '_blank');
            },
          });
        } else {
          // Shouldn't happen — you need it to access Trophy Case — but handle gracefully
          squares.push({
            level,
            title: 'Participation Trophy',
            description: 'claim to unlock the trophy case',
            disabled: true,
            onClick: () => {},
          });
        }
      } else if (level === 2) {
        // Best Thing I Saw (given)
        if (hasGivenBestThing) {
          squares.push({
            level,
            title: 'Best Thing I Saw (given)',
            description: 'give again',
            disabled: false,
            onClick: onStartNomination,
          });
        } else {
          // Locked — show as numbered placeholder
          squares.push({
            level,
            title: `${level}`,
            description: hasParticipationTrophy ? 'give a nomination to unlock' : 'claim level 1 to unlock',
            disabled: true,
            onClick: () => {},
          });
        }
      } else if (award) {
        // Future defined awards — locked
        const prereqLevel = level - 1;
        squares.push({
          level,
          title: `${level}`,
          description: `reach level ${prereqLevel} to unlock`,
          disabled: true,
          onClick: () => {},
        });
      } else {
        // Placeholder future levels
        const prereqLevel = level - 1;
        squares.push({
          level,
          title: `${level}`,
          description: `reach level ${prereqLevel} to unlock`,
          disabled: true,
          onClick: () => {},
        });
      }
    }

    return squares;
  }, [hasParticipationTrophy, hasGivenBestThing, did, onStartNomination]);

  const squares = buildSquares();

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const idx = highlightedIndex ?? 0;

      switch (e.key) {
        case 'ArrowRight':
        case 'l': {
          e.preventDefault();
          const next = idx + 1;
          if (next < GRID_SIZE) setHighlightedIndex(next);
          break;
        }
        case 'ArrowLeft':
        case 'h': {
          e.preventDefault();
          const prev = idx - 1;
          if (prev >= 0) setHighlightedIndex(prev);
          break;
        }
        case 'ArrowDown':
        case 'j': {
          e.preventDefault();
          const below = idx + 3;
          if (below < GRID_SIZE) setHighlightedIndex(below);
          break;
        }
        case 'ArrowUp':
        case 'k': {
          e.preventDefault();
          const above = idx - 3;
          if (above >= 0) setHighlightedIndex(above);
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const sq = squares[idx];
          if (sq && !sq.disabled) {
            sq.onClick();
          }
          break;
        }
        case 'Escape': {
          e.preventDefault();
          onBack();
          break;
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [highlightedIndex, squares, onBack]);

  return (
    <EndSubFlowWrapper onBack={onBack}>
      <div
        className="w-full h-full overflow-auto flex items-center justify-center p-6"
        onMouseLeave={() => setHighlightedIndex(null)}
      >
        <div
          className="grid grid-cols-3 gap-3"
          style={{ minWidth: 480, minHeight: 480, maxWidth: 600 }}
        >
          {squares.map((sq, i) => (
            <EndButton
              key={sq.level}
              title={sq.title}
              description={sq.description}
              onClick={sq.onClick}
              isHighlighted={highlightedIndex === i}
              disabled={sq.disabled}
              onMouseEnter={() => !sq.disabled && setHighlightedIndex(i)}
            />
          ))}
        </div>
      </div>
    </EndSubFlowWrapper>
  );
}
