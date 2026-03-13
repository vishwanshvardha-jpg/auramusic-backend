import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase.js";

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    console.log("🔐 Verifying token...");
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error("❌ Auth Error:", error?.message || "User not found");
      return res.status(401).json({ error: "Unauthorized" });
    }

    console.log("✅ Authenticated user:", user.id);
    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
