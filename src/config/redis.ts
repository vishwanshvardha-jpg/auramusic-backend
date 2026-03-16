import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 1, // Fail fast if Redis is down
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    if (times > 3) return null; // stop retrying after 3 attempts to avoid console spam
    return delay;
  },
});

redis.on("connect", () => console.log("🚀 Redis Connected"));
redis.on("error", (err: any) => {
  if (err.code === "ECONNREFUSED") {
    // Be more descriptive but less noisy for connection issues
    console.warn("⚠️  Redis is not running. Caching is disabled. (Run 'brew services start redis' to fix)");
  } else {
    console.error("❌ Redis Error:", err);
  }
});


