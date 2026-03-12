/** What the user submits via the test site */
export type CurationRequest = {
  handle: string       // bluesky handle, e.g. "jake.bsky.social"
  prompt: string       // natural language: "no politics, funny stuff, 10 posts under 5 likes..."
}

/** Metadata the agent sees for each candidate post */
export type CandidatePost = {
  uri: string          // at:// URI
  cid: string
  author: {
    did: string
    handle: string
    displayName?: string
  }
  text: string
  likeCount: number
  repostCount: number
  replyCount: number
  indexedAt: string
  hasImages: boolean
  hasVideo: boolean
  hasExternal: boolean // link card
}

/** What the agent returns — just IDs, no content */
export type CurationResult = {
  postUris: string[]   // ordered list of at:// URIs (up to 50)
}

/** Enriched result sent to the frontend with post text/author */
export type EnrichedPost = {
  uri: string
  author: { handle: string; displayName?: string }
  text: string
  likeCount: number
  repostCount: number
  replyCount: number
}

export type EnrichedCurationResult = {
  posts: EnrichedPost[]
}

/** A batch of posts streamed to the frontend as they're selected */
export type CurationBatch = {
  batch: number        // 1, 2, 3...
  postUris: string[]   // this batch's URIs
  done: boolean        // true on final batch
}
