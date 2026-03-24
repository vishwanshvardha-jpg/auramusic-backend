import { Request, Response } from "express";
import * as itunesService from "../services/itunes.service.js";
import { redis } from "../config/redis.js";

const TRACK_CACHE_TTL = 60 * 60 * 24 * 30; // 30 days

export const lookupTracks = async (req: Request, res: Response) => {
  const raw = req.query.ids as string;
  if (!raw) return res.status(400).json({ error: "Missing 'ids' query parameter" });

  const tokens = raw.split(",").map((t) => t.trim());
  const validIds: number[] = [];
  for (const token of tokens) {
    if (!/^\d+$/.test(token)) {
      return res.status(400).json({ error: `Invalid track ID: "${token}"` });
    }
    const n = parseInt(token, 10);
    if (n <= 0) {
      return res.status(400).json({ error: `Track ID must be a positive integer: "${token}"` });
    }
    validIds.push(n);
  }
  const trackIds = [...new Set(validIds)];
  if (trackIds.length === 0) return res.json({ tracks: [] });
  if (trackIds.length > 100) {
    return res.status(400).json({ error: "Too many IDs — maximum 100 per request" });
  }

  try {
    const cached: itunesService.iTunesTrack[] = [];
    const missing: number[] = [];

    if (redis && redis.status === "ready") {
      try {
        const keys = trackIds.map((id) => `track:${id}`);
        const values = await redis.mget(keys);
        values.forEach((val, i) => {
          if (val) {
            try {
              cached.push(JSON.parse(val) as itunesService.iTunesTrack);
            } catch {
              missing.push(trackIds[i]);
            }
          } else {
            missing.push(trackIds[i]);
          }
        });
      } catch (err) {
        console.error("Redis mget error:", err);
        cached.length = 0;
        missing.push(...trackIds); // fail-open: treat all as cache miss
      }
    } else {
      missing.push(...trackIds);
    }

    let fetched: itunesService.iTunesTrack[] = [];
    if (missing.length > 0) {
      console.log(`🔍 Cache Miss - Fetching ${missing.length} tracks from iTunes`);
      fetched = await itunesService.lookupTracks(missing);

      if (redis && redis.status === "ready" && fetched.length > 0) {
        try {
          const pipeline = redis.pipeline();
          fetched.forEach((t) =>
            pipeline.set(`track:${t.trackId}`, JSON.stringify(t), "EX", TRACK_CACHE_TTL)
          );
          await pipeline.exec();
        } catch (err) {
          console.error("Redis pipeline set error:", err);
        }
      }
    }

    return res.json({ tracks: [...cached, ...fetched] });
  } catch (error) {
    console.error("Track lookup error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
