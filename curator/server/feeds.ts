import { BskyAgent } from "@atproto/api";
import type { CandidatePost } from "./types.js";

const agent = new BskyAgent({ service: "https://public.api.bsky.app" });

// Feed generator URIs
const FEED_FOR_YOU =
  "at://did:plc:3guzzweuqraryl3rdkimjamk/app.bsky.feed.generator/for-you";
const FEED_QUIET_POSTERS =
  "at://did:plc:vpkhqolt662uhesyj6nxm7ys/app.bsky.feed.generator/infreq";
const FEED_MUTUALS =
  "at://did:plc:z72i7hdynmk6r22z27h6tvur/feed/mutuals";

/** Convert an API feed post into our CandidatePost shape */
function toCandidate(item: any): CandidatePost | null {
  const post = item.post;
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

/** Pull ~limit posts from a feed generator, paginating if needed */
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

/** Fetch a sample of user's recent likes for taste profiling */
export async function getUserLikesSample(
  handle: string,
  count: number = 50
): Promise<CandidatePost[]> {
  const posts: CandidatePost[] = [];
  let cursor: string | undefined;

  try {
    while (posts.length < count) {
      const pageSize = Math.min(count - posts.length, 50);
      const res = await agent.app.bsky.feed.getActorLikes({
        actor: handle,
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
    console.error(`Error fetching likes for ${handle}:`, err);
  }

  return posts;
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

/** Pull from all 3 feeds, deduplicate by URI, return ~300 candidates */
export async function gatherCandidates(
  handle: string
): Promise<CandidatePost[]> {
  console.log(`Gathering candidates for ${handle}...`);

  const [forYou, quietPosters, mutuals] = await Promise.all([
    getAlgorithmicFeed(FEED_FOR_YOU, 100),
    getAlgorithmicFeed(FEED_QUIET_POSTERS, 100),
    getAlgorithmicFeed(FEED_MUTUALS, 100),
  ]);

  console.log(
    `Raw counts — For You: ${forYou.length}, Quiet Posters: ${quietPosters.length}, Mutuals: ${mutuals.length}`
  );

  // Deduplicate by URI
  const seen = new Set<string>();
  const all: CandidatePost[] = [];

  for (const post of [...forYou, ...quietPosters, ...mutuals]) {
    if (!seen.has(post.uri)) {
      seen.add(post.uri);
      all.push(post);
    }
  }

  console.log(`After dedup: ${all.length} candidates`);
  return all;
}
