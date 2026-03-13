import { Request, Response } from "express";
import * as itunesService from "../services/itunes.service.js";
import { redis } from "../config/redis.js";

const CACHE_TTL = 3600; // 1 hour

export const searchMusic = async (req: Request, res: Response) => {
  const query = req.query.q as string;

  if (!query) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  try {
    // Caching disabled for now to avoid connection errors
    console.log(`🔍 Fetching from iTunes: ${query}`);
    const tracks = await itunesService.searchTracks(query);

    return res.json({ tracks, source: "network" });
  } catch (error) {
    console.error("Search Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
