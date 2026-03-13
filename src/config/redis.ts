import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// export const redis = new Redis(redisUrl, {
//   maxRetriesPerRequest: 3,
// });

// redis.on("connect", () => console.log("🚀 Redis Connected"));
// redis.on("error", (err: Error) => console.error("❌ Redis Error:", err));

export const redis = null; // Placeholder to avoid breaking imports
