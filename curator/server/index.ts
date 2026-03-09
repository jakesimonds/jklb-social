import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gatherCandidates, getUserTasteSample, getUserProfile } from "./feeds.js";
import { curate } from "./agent.js";
import type { CurationRequest } from "./types.js";

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

    res.json(result);
  } catch (err: any) {
    console.error("Curation error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Curator server listening on http://localhost:${PORT}`);
});
