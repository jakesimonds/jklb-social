// Cloudflare Pages Function: /api/best-thing
// Handles "Best Thing I Saw" award actions using CommunityMember records in TROPHIES KV.
// POST: record a give or win action on the appropriate CommunityMember record
// GET: look up a member's best-thing awards by DID

import type { CommunityMember } from '../../src/types/awards';

interface Env {
  TROPHIES: KVNamespace;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

/** KV key prefix for member records (matches participation.ts) */
function memberKey(did: string): string {
  return `member:${did}`;
}

/** KV key for the members index (matches participation.ts) */
const MEMBERS_INDEX_KEY = 'community:members';

/** Ensure a CommunityMember exists in KV, creating a blank one if needed */
async function ensureMember(
  env: Env,
  did: string,
  handle: string,
): Promise<CommunityMember> {
  const existing = await env.TROPHIES.get(memberKey(did), 'json') as CommunityMember | null;
  if (existing) {
    return { ...existing, handle }; // update handle in case it changed
  }

  const now = new Date().toISOString();
  const member: CommunityMember = {
    did,
    handle,
    joinedAt: now,
    awards: {
      participationTrophy: null,
      bestThingISawGiven: [],
      bestThingISawWon: [],
    },
  };

  // Add to members index
  const indexRaw = await env.TROPHIES.get(MEMBERS_INDEX_KEY, 'text');
  const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
  if (!index.includes(did)) {
    index.push(did);
    await env.TROPHIES.put(MEMBERS_INDEX_KEY, JSON.stringify(index));
  }

  return member;
}

type GiveBody = {
  action: 'give';
  giverDid: string;
  giverHandle: string;
  recipientDid: string;
  subjectUri: string;
  nominationUri: string;
};

type WinBody = {
  action: 'win';
  winnerDid: string;
  winnerHandle: string;
  nominatedByDid: string;
  subjectUri: string;
};

type PostBody = GiveBody | WinBody;

async function handlePost(request: Request, env: Env): Promise<Response> {
  let body: PostBody;
  try {
    body = await request.json() as PostBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.action || (body.action !== 'give' && body.action !== 'win')) {
    return jsonResponse({ error: 'Missing or invalid action. Must be "give" or "win".' }, 400);
  }

  if (body.action === 'give') {
    const { giverDid, giverHandle, recipientDid, subjectUri, nominationUri } = body;
    if (!giverDid || !giverHandle || !recipientDid || !subjectUri || !nominationUri) {
      return jsonResponse({ error: 'Missing required fields for give action' }, 400);
    }

    const member = await ensureMember(env, giverDid, giverHandle);

    // Deduplicate by nominationUri
    if (!member.awards.bestThingISawGiven.some((g) => g.nominationUri === nominationUri)) {
      member.awards.bestThingISawGiven.push({
        recipientDid,
        subjectUri,
        nominationUri,
        givenAt: new Date().toISOString(),
      });
    }

    await env.TROPHIES.put(memberKey(giverDid), JSON.stringify(member));
    return jsonResponse({ ok: true, action: 'give', giverDid });
  }

  // action === 'win'
  const { winnerDid, winnerHandle, nominatedByDid, subjectUri } = body;
  if (!winnerDid || !winnerHandle || !nominatedByDid || !subjectUri) {
    return jsonResponse({ error: 'Missing required fields for win action' }, 400);
  }

  const member = await ensureMember(env, winnerDid, winnerHandle);

  // Deduplicate by subjectUri + nominatedByDid combo
  if (!member.awards.bestThingISawWon.some(
    (w) => w.subjectUri === subjectUri && w.nominatedByDid === nominatedByDid,
  )) {
    member.awards.bestThingISawWon.push({
      nominatedByDid,
      subjectUri,
      claimedAt: new Date().toISOString(),
    });
  }

  await env.TROPHIES.put(memberKey(winnerDid), JSON.stringify(member));
  return jsonResponse({ ok: true, action: 'win', winnerDid });
}

async function handleGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const did = url.searchParams.get('did');

  if (!did) {
    return jsonResponse({ error: 'Missing query parameter: did' }, 400);
  }

  const member = await env.TROPHIES.get(memberKey(did), 'json') as CommunityMember | null;
  if (!member) {
    return jsonResponse({ given: [], won: [] });
  }

  return jsonResponse({
    given: member.awards.bestThingISawGiven,
    won: member.awards.bestThingISawWon,
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    return handlePost(request, context.env);
  }

  if (request.method === 'GET') {
    return handleGet(request, context.env);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
};
