import express from "express";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gatherCandidates, getUserTasteSample, getUserProfile } from "./feeds.js";
import { curate } from "./agent.js";
import type { CurationRequest, CandidatePost, EnrichedPost } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3847;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "web")));

app.post("/curate", async (req, res) => {
  const { handle, prompt } = req.body as CurationRequest;

  if (!handle || !prompt) {
    res.status(400).json({ error: "handle and prompt are required" });
    return;
  }

  console.log(`\n=== Curation request: @${handle} ===`);
  console.log(`Prompt: "${prompt}"`);
  const totalStart = Date.now();

  try {
    // Phase 1: Fetch candidates + likes in parallel
    const fetchStart = Date.now();
    const [candidates, likes, profile] = await Promise.all([
      gatherCandidates(handle),
      getUserTasteSample(handle, 30),
      getUserProfile(handle),
    ]);
    const fetchMs = Date.now() - fetchStart;
    console.log(`Fetch phase: ${fetchMs}ms (${candidates.length} candidates, ${likes.length} taste samples)`);

    if (profile) {
      console.log(`Profile: ${profile.displayName} (@${profile.handle})`);
    }

    if (candidates.length === 0) {
      res.status(400).json({ error: "No candidate posts found. Check the handle." });
      return;
    }

    // Phase 2: Run the agent
    const agentStart = Date.now();
    const result = await curate(candidates, likes, prompt);
    const agentMs = Date.now() - agentStart;
    console.log(`Agent phase: ${agentMs}ms`);

    const totalMs = Date.now() - totalStart;
    console.log(`Total: ${totalMs}ms — ${result.postUris.length} posts selected\n`);

    // Build a lookup map from candidates so we can enrich the response
    const candidateMap = new Map<string, CandidatePost>();
    for (const c of candidates) candidateMap.set(c.uri, c);

    const posts: EnrichedPost[] = result.postUris
      .map((uri): EnrichedPost | null => {
        const c = candidateMap.get(uri);
        if (!c) return null;
        return {
          uri: c.uri,
          author: { handle: c.author.handle, displayName: c.author.displayName },
          text: c.text,
          likeCount: c.likeCount,
          repostCount: c.repostCount,
          replyCount: c.replyCount,
        };
      })
      .filter((p): p is EnrichedPost => p !== null);

    res.json({ posts, postUris: result.postUris, logId: result.logId });
  } catch (err: any) {
    console.error("Curation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/** Serve reasoning logs */
app.get("/log/:logId", async (req, res) => {
  const logPath = path.join(__dirname, "..", "logs", `${req.params.logId}.md`);
  try {
    const content = await readFile(logPath, "utf-8");
    res.type("text/plain").send(content);
  } catch {
    res.status(404).json({ error: "Log not found" });
  }
});

app.listen(PORT, () => {
  console.log(`Curator server listening on http://localhost:${PORT}`);
});
