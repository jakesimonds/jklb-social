/**
 * Trophy System Types
 * Progressive award chain: claim → give → claim → give
 * Each award writes to user's PDS + indexes in Cloudflare KV
 */

export type AwardMode = 'claim' | 'give';

export type AwardDefinition = {
  id: string;                      // e.g. 'participationTrophy', 'bestThingISaw'
  name: string;                    // display name
  level: number;                   // 1, 2, 3... — ordering in Trophy Case
  collection: string;              // e.g. 'social.jklb.participationTrophy'
  giverCollection?: string;        // for 'give' mode: giver's collection
  winnerCollection?: string;       // for 'give' mode: winner's collection
  mode: AwardMode;                 // 'claim' = self-serve, 'give' = nominate someone
  oneTimeOnly: boolean;            // participation = true, bestThingISaw = false
  prerequisite: string | null;     // award id required before this unlocks
};

export type CommunityMember = {
  did: string;
  handle: string;
  joinedAt: string;
  awards: {
    participationTrophy: {
      number: number;
      claimedAt: string;
    } | null;
    bestThingISawGiven: Array<{
      recipientDid: string;
      subjectUri: string;
      nominationUri: string;
      givenAt: string;
    }>;
    bestThingISawWon: Array<{
      nominatedByDid: string;
      subjectUri: string;
      claimedAt: string;
    }>;
  };
};

/**
 * Current awards (v1)
 * Level 1: Participation Trophy (claim, one-time)
 * Level 2: Best Thing I Saw (give, repeatable, requires participationTrophy)
 */
export const AWARDS: AwardDefinition[] = [
  {
    id: 'participationTrophy',
    name: 'Participation Trophy',
    level: 1,
    collection: 'social.jklb.participationTrophy',
    mode: 'claim',
    oneTimeOnly: true,
    prerequisite: null,
  },
  {
    id: 'bestThingISaw',
    name: 'Best Thing I Saw',
    level: 2,
    collection: 'social.jklb.bestThingISawAwardGiver',
    giverCollection: 'social.jklb.bestThingISawAwardGiver',
    winnerCollection: 'social.jklb.bestThingISawAwardWinner',
    mode: 'give',
    oneTimeOnly: false,
    prerequisite: 'participationTrophy',
  },
];

/** Get an award definition by its level number */
export function getAwardByLevel(level: number): AwardDefinition | undefined {
  return AWARDS.find((a) => a.level === level);
}

/** Get the next award in the chain after the given award */
export function getNextAward(currentAwardId: string): AwardDefinition | undefined {
  const current = AWARDS.find((a) => a.id === currentAwardId);
  if (!current) return undefined;
  return AWARDS.find((a) => a.prerequisite === currentAwardId) ?? undefined;
}

/** Check if an award is unlocked based on a member's current awards */
export function isAwardUnlocked(
  awardId: string,
  memberAwards: CommunityMember['awards'],
): boolean {
  const award = AWARDS.find((a) => a.id === awardId);
  if (!award) return false;

  // No prerequisite — always unlocked
  if (award.prerequisite === null) return true;

  // Check prerequisite
  if (award.prerequisite === 'participationTrophy') {
    return memberAwards.participationTrophy !== null;
  }

  // Future awards: check if the prerequisite award has been given/won at least once
  if (award.prerequisite === 'bestThingISaw') {
    return memberAwards.bestThingISawGiven.length > 0;
  }

  return false;
}
