import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import * as artistsService from "../services/artists.service.js";

export const getFollowedArtists = async (req: AuthRequest, res: Response) => {
  try {
    const artists = await artistsService.getFollowedArtists(req.user.id);
    return res.json(artists);
  } catch (error) {
    console.error("Get Followed Artists Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const toggleFollow = async (req: AuthRequest, res: Response) => {
  const { artistName, artworkUrl } = req.body;

  if (typeof artistName !== "string" || typeof artworkUrl !== "string") {
    return res.status(400).json({ error: "artistName and artworkUrl must be strings" });
  }

  const trimmedArtistName = artistName.trim();
  const trimmedArtworkUrl = artworkUrl.trim();

  if (!trimmedArtistName || !trimmedArtworkUrl) {
    return res.status(400).json({ error: "artistName and artworkUrl cannot be empty" });
  }

  try {
    const result = await artistsService.toggleFollowArtist(
      req.user.id,
      trimmedArtistName,
      trimmedArtworkUrl
    );
    return res.json(result);
  } catch (error) {
    console.error("Toggle Follow Artist Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
