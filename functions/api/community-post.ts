// Cloudflare Pages Function: /api/community-post
// Posts community photos to jklb.social Bluesky account on behalf of users.
// POST: multipart/form-data with image, caption, userHandle
// Piggyback cleanup deletes posts older than 48 hours.

interface Env {
  COMMUNITY_POSTS: KVNamespace;
  JKLB_APP_PASSWORD: string;
  JKLB_DID: string;
}

const ALLOWED_CAPTIONS = [
  'Look where I am',
  'Look at this',
  'Check this out',
  'Felt cute',
];

const BSKY_SERVICE = 'https://bsky.social';
const CLEANUP_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// --- ATProto helpers (raw XRPC fetch, no SDK dependency) ---

interface SessionData {
  accessJwt: string;
  did: string;
}

async function createSession(identifier: string, password: string): Promise<SessionData> {
  const res = await fetch(`${BSKY_SERVICE}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Login failed: ${err}`);
  }
  return res.json() as Promise<SessionData>;
}

interface BlobRef {
  $type: 'blob';
  ref: { $link: string };
  mimeType: string;
  size: number;
}

async function uploadBlob(accessJwt: string, imageBytes: Uint8Array): Promise<BlobRef> {
  const res = await fetch(`${BSKY_SERVICE}/xrpc/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessJwt}`,
      'Content-Type': 'image/jpeg',
    },
    body: imageBytes.buffer as ArrayBuffer,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Blob upload failed: ${err}`);
  }
  const data = (await res.json()) as { blob: BlobRef };
  return data.blob;
}

async function createPost(
  accessJwt: string,
  did: string,
  text: string,
  imageBlob: BlobRef,
  altText: string,
): Promise<{ uri: string; cid: string }> {
  const record = {
    $type: 'app.bsky.feed.post',
    text,
    embed: {
      $type: 'app.bsky.embed.images',
      images: [{ alt: altText, image: imageBlob }],
    },
    createdAt: new Date().toISOString(),
  };

  const res = await fetch(`${BSKY_SERVICE}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      repo: did,
      collection: 'app.bsky.feed.post',
      record,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Post creation failed: ${err}`);
  }
  return res.json() as Promise<{ uri: string; cid: string }>;
}

async function deleteRecord(
  accessJwt: string,
  repo: string,
  collection: string,
  rkey: string,
): Promise<boolean> {
  const res = await fetch(`${BSKY_SERVICE}/xrpc/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ repo, collection, rkey }),
  });
  return res.ok;
}

// --- Piggyback cleanup: delete community posts older than 48h ---

interface CommunityPostEntry {
  uri: string;
  cid: string;
  createdAt: string;
}

async function piggybackCleanup(
  accessJwt: string,
  did: string,
  kv: KVNamespace,
): Promise<void> {
  const listed = await kv.list({ prefix: 'jklb:' });
  const now = Date.now();

  for (const key of listed.keys) {
    const entry = (await kv.get(key.name, 'json')) as CommunityPostEntry | null;
    if (!entry) {
      await kv.delete(key.name);
      continue;
    }

    const age = now - new Date(entry.createdAt).getTime();
    if (age > CLEANUP_AGE_MS) {
      const rkey = entry.uri.split('/').pop();
      if (rkey) {
        await deleteRecord(accessJwt, did, 'app.bsky.feed.post', rkey);
      }
      await kv.delete(key.name);
    }
  }
}

// --- Main handler ---

async function handlePost(request: Request, env: Env): Promise<Response> {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: 'Invalid form data' }, 400);
  }

  const image = formData.get('image') as File | null;
  const caption = formData.get('caption') as string | null;
  const userHandle = formData.get('userHandle') as string | null;

  if (!image) {
    return jsonResponse({ error: 'Missing image' }, 400);
  }
  if (!caption || !ALLOWED_CAPTIONS.includes(caption)) {
    return jsonResponse(
      { error: `Invalid caption. Must be one of: ${ALLOWED_CAPTIONS.join(', ')}` },
      400,
    );
  }
  if (!userHandle) {
    return jsonResponse({ error: 'Missing userHandle' }, 400);
  }

  // Authenticate as jklb.social community account
  let session: SessionData;
  try {
    session = await createSession(env.JKLB_DID, env.JKLB_APP_PASSWORD);
  } catch (err) {
    console.error('Auth failed:', err);
    return jsonResponse({ error: 'Community account auth failed' }, 500);
  }

  // Piggyback cleanup — delete posts older than 48h (non-fatal)
  try {
    await piggybackCleanup(session.accessJwt, session.did, env.COMMUNITY_POSTS);
  } catch (err) {
    console.error('Cleanup error:', err);
  }

  // Upload image blob
  let imageBlob: BlobRef;
  try {
    const imageBytes = new Uint8Array(await image.arrayBuffer());
    imageBlob = await uploadBlob(session.accessJwt, imageBytes);
  } catch (err) {
    console.error('Upload failed:', err);
    return jsonResponse({ error: 'Image upload failed' }, 500);
  }

  // Create the community post
  const postText = `${caption}\n\n📸 via @${userHandle} on jklb`;
  let post: { uri: string; cid: string };
  try {
    post = await createPost(session.accessJwt, session.did, postText, imageBlob, caption);
  } catch (err) {
    console.error('Post failed:', err);
    return jsonResponse({ error: 'Post creation failed' }, 500);
  }

  // Track in KV for 48h cleanup
  const rkey = post.uri.split('/').pop();
  if (rkey) {
    await env.COMMUNITY_POSTS.put(
      `jklb:${rkey}`,
      JSON.stringify({
        uri: post.uri,
        cid: post.cid,
        createdAt: new Date().toISOString(),
      } satisfies CommunityPostEntry),
    );
  }

  return jsonResponse({ ok: true, uri: post.uri });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    return handlePost(request, context.env);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
};
