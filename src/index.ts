import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

import musicRoutes from "./routes/music.routes.js";
import libraryRoutes from "./routes/library.routes.js";
import playlistRoutes from "./routes/playlist.routes.js";
import artistsRoutes from "./routes/artists.routes.js";
import tracksRoutes from "./routes/tracks.routes.js";

app.use("/v1/music", musicRoutes);
app.use("/v1/library", libraryRoutes);
app.use("/v1/playlists", playlistRoutes);
app.use("/v1/artists", artistsRoutes);
app.use("/v1/tracks", tracksRoutes);

app.get("/", (req, res) => {
  res.send("🎵 Aura Music Backend is Alive!");
});

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🎵 Aura Music Backend running on http://localhost:${PORT}`);
});
