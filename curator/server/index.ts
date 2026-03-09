import express from "express";

const app = express();
const PORT = 3847;

app.get("/", (_req, res) => {
  res.send("Curator is running");
});

app.listen(PORT, () => {
  console.log(`Curator server listening on http://localhost:${PORT}`);
});
