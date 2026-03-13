import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import * as playlistService from "../services/playlist.service.js";

export const getPlaylists = async (req: AuthRequest, res: Response) => {
  try {
    const playlists = await playlistService.getPlaylists(req.user.id);
    return res.json(playlists);
  } catch (error) {
    console.error("Get Playlists Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const createPlaylist = async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });

  try {
    const playlist = await playlistService.createPlaylist(req.user.id, name);
    return res.status(201).json(playlist);
  } catch (error) {
    console.error("Create Playlist Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const deletePlaylist = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await playlistService.deletePlaylist(req.user.id, id);
    return res.status(204).send();
  } catch (error) {
    console.error("Delete Playlist Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getPlaylistSongs = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const songs = await playlistService.getPlaylistSongs(id);
    return res.json(songs);
  } catch (error) {
    console.error("Get Playlist Songs Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addSong = async (req: AuthRequest, res: Response) => {
  const { playlistId, track } = req.body;
  if (!playlistId || !track) return res.status(400).json({ error: "Missing data" });

  try {
    const result = await playlistService.addSongToPlaylist(playlistId, track);
    return res.json(result);
  } catch (error) {
    console.error("Add Song Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
