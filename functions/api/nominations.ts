// Cloudflare Pages Function: /api/nominations
// Stores and retrieves nomination data for the Award for Excellence in Posting.
// POST: Client sends nomination data after writing to PDS (indexed by recipientDid)
// GET:  Claim page queries nominations by DID or handle

interface Env {
  NOMINATIONS: KVNamespace;
}

interface Nomination {
  awarderDid: string;
  awarderHandle: string;
  recipientDid: string;
  nominationUri: string;
  subjectUri: string;
  exitPostUri: string;
  createdAt: string;
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

async function handlePost(request: Request, env: Env): Promise<Response> {
  let body: Nomination;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { awarderDid, awarderHandle, recipientDid, nominationUri, subjectUri, exitPostUri, createdAt } = body;

  if (!awarderDid || !recipientDid || !nominationUri || !subjectUri || !exitPostUri || !createdAt) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  const nomination: Nomination = {
    awarderDid,
    awarderHandle: awarderHandle || '',
    recipientDid,
    nominationUri,
    subjectUri,
    exitPostUri,
    createdAt,
  };

  // Read existing nominations for this recipient
  const existing = await env.NOMINATIONS.get(recipientDid, 'json') as Nomination[] | null;
  const nominations = existing || [];

  // Deduplicate by nominationUri
  if (!nominations.some((n) => n.nominationUri === nominationUri)) {
    nominations.push(nomination);
  }

  await env.NOMINATIONS.put(recipientDid, JSON.stringify(nominations));

  return jsonResponse({ ok: true });
}

async function resolveHandleToDid(handle: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`
    );
    if (!res.ok) return null;
    const data = await res.json() as { did: string };
    return data.did || null;
  } catch {
    return null;
  }
}

async function handleGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  let did = url.searchParams.get('did');
  const handle = url.searchParams.get('handle');

  if (!did && !handle) {
    return jsonResponse({ error: 'Provide ?did= or ?handle= query parameter' }, 400);
  }

  // Resolve handle to DID if needed
  if (!did && handle) {
    did = await resolveHandleToDid(handle);
    if (!did) {
      return jsonResponse({ error: `Could not resolve handle: ${handle}` }, 404);
    }
  }

  const nominations = await env.NOMINATIONS.get(did!, 'json') as Nomination[] | null;
  return jsonResponse(nominations || []);
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;

  // Handle CORS preflight
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
