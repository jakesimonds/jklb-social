import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CandidatePost, CurationResult } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.join(__dirname, "..", "logs");

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

## User's Recent Posts (to understand their taste)
${likesSection || "(no posts available)"}

## Candidate Posts
${candidatesSection}

## Instructions
- Select exactly 50 posts that best match the user's preferences
- Order them from most relevant to least relevant
- Consider the user's taste (based on their recent posts) when making selections
- Spread out authors — never put more than 2 posts by the same person in a row
- Only include English-language posts unless the user explicitly requests other languages

IMPORTANT: First, write a brief reasoning log explaining your curation decisions:
1. What themes/topics you're prioritizing based on the user's preferences
2. How many sports, pets, mutual, and other category posts you're including
3. Any posts you're excluding and why (negativity, non-English, off-topic, etc.)

Then return the JSON array of AT URI strings.

Format your response as:
## Reasoning
[your reasoning here]

## Selected Posts
[JSON array of AT URI strings]`;
}

/** Run a command with stdin input and return stdout */
function runWithStdin(
  cmd: string,
  args: string[],
  input: string,
  timeoutMs: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("Agent timed out"));
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}: ${stderr.slice(0, 500)}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.stdin.write(input);
    proc.stdin.end();
  });
}

/** Run the curation agent via Claude Code CLI, save reasoning log */
export async function curate(
  candidates: CandidatePost[],
  userLikes: CandidatePost[],
  userPrompt: string
): Promise<CurationResult & { logId: string }> {
  const prompt = buildPrompt(candidates, userLikes, userPrompt);
  const logId = `curation-${Date.now()}`;

  console.log(
    `Running agent with ${candidates.length} candidates, ${userLikes.length} taste samples...`
  );
  console.log(`Prompt size: ${(prompt.length / 1024).toFixed(1)}KB`);

  const stdout = await runWithStdin(
    "claude",
    ["-p", "--output-format", "text"],
    prompt,
    180_000 // 3 minute timeout
  );

  // Extract JSON array from the response
  const jsonMatch = stdout.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error("Agent output (first 500 chars):", stdout.slice(0, 500));
    throw new Error("Agent response did not contain a JSON array");
  }

  const uris: unknown = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(uris) || !uris.every((u) => typeof u === "string")) {
    throw new Error("Agent returned invalid URI array");
  }

  // Extract reasoning (everything before the JSON array)
  const jsonStart = stdout.indexOf(jsonMatch[0]);
  const reasoning = stdout.slice(0, jsonStart).trim();

  // Write reasoning log
  await mkdir(LOGS_DIR, { recursive: true });
  const logContent = `# Curation Log — ${new Date().toISOString()}

## User Prompt
${userPrompt}

## Candidates
${candidates.length} posts (75 mutuals, 25 chronological, 25 reverse-chrono, 25 quiet posters — shuffled)

## Agent Reasoning
${reasoning || "(no reasoning captured)"}

## Selected ${uris.length} Posts
${uris.map((u, i) => `${i + 1}. ${u}`).join("\n")}
`;

  await writeFile(path.join(LOGS_DIR, `${logId}.md`), logContent);
  console.log(`Agent selected ${uris.length} posts — log: ${logId}`);

  return { postUris: uris, logId };
}
