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
    // 1. Generate a unique cache key for this search query
    // We prefix with 'search:' to keep the Redis namespace organized
    const cacheKey = `search:${query.toLowerCase().trim()}`;

    // 2. Try to get data from Redis cache
    // We only attempt this if Redis is 'ready' to avoid connection timeouts or noise
    if (redis && redis.status === "ready") {
      try {
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
          console.log(`🎯 Cache Hit for: ${query}`);
          return res.json({ 
            tracks: JSON.parse(cachedData), 
            source: "cache" 
          });
        }
      } catch (redisError) {
        // If Redis fails, we log it but continue to the network fetch (fail-open)
        console.error("Redis Get Error:", redisError);
      }
    }

    // 3. Cache Miss: Fetch from iTunes service
    console.log(`🔍 Cache Miss - Fetching from iTunes: ${query}`);
    const tracks = await itunesService.searchTracks(query);

    // 4. Store the new results in Redis for future requests
    // We only do this if Redis is 'ready' and we have results
    if (redis && redis.status === "ready" && tracks.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(tracks), "EX", CACHE_TTL);
      } catch (redisError) {
        console.error("Redis Set Error:", redisError);
      }
    }

    // 5. Return the fresh results to the client
    return res.json({ tracks, source: "network" });
  } catch (error) {
    console.error("Search Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }

};
