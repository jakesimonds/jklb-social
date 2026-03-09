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

/** Gather ~300 candidates from follows' posts + What's Hot, deduplicated */
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

  // Deduplicate by URI
  const seen = new Set<string>();
  const all: CandidatePost[] = [];

  for (const post of [...followPosts, ...hotPosts]) {
    if (!seen.has(post.uri)) {
      seen.add(post.uri);
      all.push(post);
    }
  }

  console.log(`After dedup: ${all.length} candidates`);
  return all;
}
