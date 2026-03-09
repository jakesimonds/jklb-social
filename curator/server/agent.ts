import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CandidatePost, CurationResult } from "./types.js";

const execFileAsync = promisify(execFile);

/** Build the prompt for the curation agent */
function buildPrompt(
  candidates: CandidatePost[],
  userLikes: CandidatePost[],
  userPrompt: string
): string {
  const likesSection = userLikes
    .map(
      (p) =>
        `- "${p.text.slice(0, 120)}" by @${p.author.handle} (${p.likeCount} likes)`
    )
    .join("\n");

  const candidatesSection = candidates
    .map(
      (p, i) =>
        `[${i}] URI: ${p.uri}\n    Author: @${p.author.handle}${p.author.displayName ? ` (${p.author.displayName})` : ""}\n    Text: ${p.text.slice(0, 300)}\n    Likes: ${p.likeCount} | Reposts: ${p.repostCount} | Replies: ${p.replyCount}\n    Media: ${[p.hasImages && "images", p.hasVideo && "video", p.hasExternal && "link"].filter(Boolean).join(", ") || "none"}`
    )
    .join("\n\n");

  return `You are a feed curation agent for Bluesky. Your job is to select the best 50 posts from a pool of ~${candidates.length} candidates based on the user's preferences.

## User's Preferences
${userPrompt}

## User's Recent Likes (to understand their taste)
${likesSection || "(no likes available)"}

## Candidate Posts
${candidatesSection}

## Instructions
- Select exactly 50 posts that best match the user's preferences
- Order them from most relevant to least relevant
- Consider the user's taste (based on their likes) when making selections
- Return ONLY a JSON array of AT URI strings, no other text
- Example format: ["at://did:plc:xxx/app.bsky.feed.post/yyy", ...]

Return the JSON array now:`;
}

/** Run the curation agent via Claude Code CLI */
export async function curate(
  candidates: CandidatePost[],
  userLikes: CandidatePost[],
  userPrompt: string
): Promise<CurationResult> {
  const prompt = buildPrompt(candidates, userLikes, userPrompt);

  console.log(
    `Running agent with ${candidates.length} candidates, ${userLikes.length} taste samples...`
  );

  try {
    const { stdout } = await execFileAsync(
      "claude",
      ["-p", prompt, "--output-format", "text"],
      {
        timeout: 120_000, // 2 minute timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large responses
      }
    );

    // Extract JSON array from the response
    const jsonMatch = stdout.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Agent response did not contain a JSON array");
    }

    const uris: unknown = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(uris) || !uris.every((u) => typeof u === "string")) {
      throw new Error("Agent returned invalid URI array");
    }

    console.log(`Agent selected ${uris.length} posts`);
    return { postUris: uris };
  } catch (err: any) {
    if (err.killed) {
      throw new Error("Agent timed out after 2 minutes");
    }
    throw new Error(`Agent failed: ${err.message}`);
  }
}
