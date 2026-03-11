// Cloudflare Pages Function: /api/participation
// Handles participation trophy claims and member lookups.
// POST: claim a participation trophy (idempotent, sequential numbering)
// GET: look up a CommunityMember record by DID

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

/** KV key for the global participation counter */
const COUNTER_KEY = 'participation:counter';
/** KV key prefix for member records */
function memberKey(did: string): string {
  return `member:${did}`;
}
/** KV key for the members index (list of all DIDs) */
const MEMBERS_INDEX_KEY = 'community:members';

async function handlePost(request: Request, env: Env): Promise<Response> {
  let body: { did?: string; handle?: string };
  try {
    body = await request.json() as { did?: string; handle?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { did, handle } = body;
  if (!did || !handle) {
    return jsonResponse({ error: 'Missing required fields: did, handle' }, 400);
  }

  // Check for existing member record
  const existing = await env.TROPHIES.get(memberKey(did), 'json') as CommunityMember | null;

  // Idempotent: if already claimed, return existing trophy data
  if (existing?.awards.participationTrophy) {
    return jsonResponse({
      number: existing.awards.participationTrophy.number,
      claimedAt: existing.awards.participationTrophy.claimedAt,
    });
  }

  // Atomically increment counter
  const currentCount = await env.TROPHIES.get(COUNTER_KEY, 'text');
  const newNumber = (currentCount ? parseInt(currentCount, 10) : 0) + 1;
  await env.TROPHIES.put(COUNTER_KEY, String(newNumber));

  const claimedAt = new Date().toISOString();

  // Create or update member record
  const member: CommunityMember = existing
    ? {
        ...existing,
        handle, // update handle in case it changed
        awards: {
          ...existing.awards,
          participationTrophy: { number: newNumber, claimedAt },
        },
      }
    : {
        did,
        handle,
        joinedAt: claimedAt,
        awards: {
          participationTrophy: { number: newNumber, claimedAt },
          bestThingISawGiven: [],
          bestThingISawWon: [],
        },
      };

  await env.TROPHIES.put(memberKey(did), JSON.stringify(member));

  // Update members index
  const indexRaw = await env.TROPHIES.get(MEMBERS_INDEX_KEY, 'text');
  const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
  if (!index.includes(did)) {
    index.push(did);
    await env.TROPHIES.put(MEMBERS_INDEX_KEY, JSON.stringify(index));
  }

  return jsonResponse({ number: newNumber, claimedAt });
}

async function handleGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const did = url.searchParams.get('did');

  if (!did) {
    return jsonResponse({ error: 'Missing query parameter: did' }, 400);
  }

  const member = await env.TROPHIES.get(memberKey(did), 'json') as CommunityMember | null;
  return jsonResponse(member);
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
