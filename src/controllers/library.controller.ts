import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import * as libraryService from "../services/library.service.js";

export const getLikedSongs = async (req: AuthRequest, res: Response) => {
  try {
    const songs = await libraryService.getLikedSongs(req.user.id);
    return res.json(songs);
  } catch (error) {
    console.error("Get Liked Songs Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const toggleLike = async (req: AuthRequest, res: Response) => {
  const { track, isLiked } = req.body;

  if (!track) {
    return res.status(400).json({ error: "Missing track data" });
  }

  try {
    const result = await libraryService.toggleLikeSong(req.user.id, track, isLiked);
    return res.json(result);
  } catch (error) {
    console.error("Toggle Like Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
