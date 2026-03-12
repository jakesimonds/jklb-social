import { BskyAgent } from "@atproto/api";
import type { CandidatePost } from "./types.js";

const agent = new BskyAgent({ service: "https://public.api.bsky.app" });

// What's Hot — works without auth
const FEED_WHATS_HOT =
  "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot";

/** Convert an API feed post into our CandidatePost shape */
function toCandidate(item: any): CandidatePost | null {
  const post = item.post ?? item;
  if (!post?.record) return null;
  const record = post.record as any;
  const embed = post.embed;

  return {
    uri: post.uri,
    cid: post.cid,
    author: {
      did: post.author.did,
      handle: post.author.handle,
      displayName: post.author.displayName,
    },
    text: record.text ?? "",
    likeCount: post.likeCount ?? 0,
    repostCount: post.repostCount ?? 0,
    replyCount: post.replyCount ?? 0,
    indexedAt: post.indexedAt,
    hasImages: embed?.$type === "app.bsky.embed.images#view",
    hasVideo: embed?.$type === "app.bsky.embed.video#view",
    hasExternal: embed?.$type === "app.bsky.embed.external#view",
  };
}

/** Pull posts from a feed generator */
export async function getAlgorithmicFeed(
  feedUri: string,
  limit: number = 100
): Promise<CandidatePost[]> {
  const posts: CandidatePost[] = [];
  let cursor: string | undefined;

  try {
    while (posts.length < limit) {
      const pageSize = Math.min(limit - posts.length, 50);
      const res = await agent.app.bsky.feed.getFeed({
        feed: feedUri,
        limit: pageSize,
        cursor,
      });

      for (const item of res.data.feed) {
        const candidate = toCandidate(item);
        if (candidate) posts.push(candidate);
      }

      cursor = res.data.cursor;
      if (!cursor || res.data.feed.length === 0) break;
    }
  } catch (err) {
    console.error(`Error fetching feed ${feedUri}:`, err);
  }

  return posts;
}

/** Get recent posts from a specific user */
async function getAuthorPosts(
  actor: string,
  limit: number = 10
): Promise<CandidatePost[]> {
  try {
    const res = await agent.app.bsky.feed.getAuthorFeed({
      actor,
      limit,
      filter: "posts_no_replies",
    });
    return res.data.feed
      .map((item) => toCandidate(item))
      .filter((p): p is CandidatePost => p !== null);
  } catch {
    return [];
  }
}

/** Get user's follows */
async function getFollows(
  handle: string,
  limit: number = 50
): Promise<{ did: string; handle: string }[]> {
  const follows: { did: string; handle: string }[] = [];
  let cursor: string | undefined;

  try {
    while (follows.length < limit) {
      const res = await agent.app.bsky.graph.getFollows({
        actor: handle,
        limit: Math.min(limit - follows.length, 50),
        cursor,
      });
      for (const f of res.data.follows) {
        follows.push({ did: f.did, handle: f.handle });
      }
      cursor = res.data.cursor;
      if (!cursor || res.data.follows.length === 0) break;
    }
  } catch (err) {
    console.error(`Error fetching follows for ${handle}:`, err);
  }

  return follows;
}

/** Fetch user's own posts as a taste signal (since likes aren't public) */
export async function getUserTasteSample(
  handle: string,
  count: number = 30
): Promise<CandidatePost[]> {
  return getAuthorPosts(handle, count);
}

/** Fetch user profile for context */
export async function getUserProfile(handle: string) {
  try {
    const res = await agent.app.bsky.actor.getProfile({ actor: handle });
    return res.data;
  } catch (err) {
    console.error(`Error fetching profile for ${handle}:`, err);
    return null;
  }
}

/** Shuffle an array in place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Gather 150 curated candidates: 75 mutuals, 25 newest, 25 oldest, 25 quiet */
export async function gatherCandidates(
  handle: string
): Promise<CandidatePost[]> {
  console.log(`Gathering candidates for ${handle}...`);

  // Get follows
  const follows = await getFollows(handle, 50);
  console.log(`Found ${follows.length} follows`);

  // Fetch posts from follows in parallel (batches of 10 to avoid hammering)
  const followPosts: CandidatePost[] = [];
  const batchSize = 10;
  for (let i = 0; i < follows.length; i += batchSize) {
    const batch = follows.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((f) => getAuthorPosts(f.did, 10))
    );
    for (const posts of results) {
      followPosts.push(...posts);
    }
  }
  console.log(`Follow posts: ${followPosts.length}`);

  // Get What's Hot for discovery
  const hotPosts = await getAlgorithmicFeed(FEED_WHATS_HOT, 100);
  console.log(`What's Hot posts: ${hotPosts.length}`);

  // Deduplicate everything by URI
  const seen = new Set<string>();
  const allDeduped: CandidatePost[] = [];
  const followDeduped: CandidatePost[] = [];

  for (const post of followPosts) {
    if (!seen.has(post.uri)) {
      seen.add(post.uri);
      allDeduped.push(post);
      followDeduped.push(post);
    }
  }
  for (const post of hotPosts) {
    if (!seen.has(post.uri)) {
      seen.add(post.uri);
      allDeduped.push(post);
    }
  }
  console.log(`After dedup: ${allDeduped.length} total`);

  // === Build 150-post mix ===
  const selected = new Set<string>();
  const final: CandidatePost[] = [];

  function addPost(p: CandidatePost): boolean {
    if (selected.has(p.uri)) return false;
    selected.add(p.uri);
    final.push(p);
    return true;
  }

  // Bucket 1: 75 from mutuals (random sample of follow posts)
  const shuffledFollows = shuffle([...followDeduped]);
  let mutualCount = 0;
  for (const p of shuffledFollows) {
    if (mutualCount >= 75) break;
    if (addPost(p)) mutualCount++;
  }
  console.log(`Mutuals bucket: ${mutualCount}`);

  // Bucket 2: 25 newest (chronological — most recent first)
  const byNewest = [...allDeduped].sort(
    (a, b) => new Date(b.indexedAt).getTime() - new Date(a.indexedAt).getTime()
  );
  let chronoCount = 0;
  for (const p of byNewest) {
    if (chronoCount >= 25) break;
    if (addPost(p)) chronoCount++;
  }
  console.log(`Chronological bucket: ${chronoCount}`);

  // Bucket 3: 25 oldest (reverse chronological — oldest first)
  const byOldest = [...allDeduped].sort(
    (a, b) => new Date(a.indexedAt).getTime() - new Date(b.indexedAt).getTime()
  );
  let reverseCount = 0;
  for (const p of byOldest) {
    if (reverseCount >= 25) break;
    if (addPost(p)) reverseCount++;
  }
  console.log(`Reverse-chrono bucket: ${reverseCount}`);

  // Bucket 4: 25 quiet posters (lowest engagement)
  const byQuiet = [...allDeduped].sort(
    (a, b) =>
      (a.likeCount + a.repostCount + a.replyCount) -
      (b.likeCount + b.repostCount + b.replyCount)
  );
  let quietCount = 0;
  for (const p of byQuiet) {
    if (quietCount >= 25) break;
    if (addPost(p)) quietCount++;
  }
  console.log(`Quiet posters bucket: ${quietCount}`);

  console.log(`Final candidate pool: ${final.length} (shuffled)`);

  // Shuffle the whole thing so the agent doesn't see bucket ordering
  return shuffle(final);
}
