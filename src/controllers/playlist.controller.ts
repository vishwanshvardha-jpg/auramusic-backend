import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import * as playlistService from "../services/playlist.service.js";

export const getCollaborators = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const collaborators = await playlistService.getCollaborators(id);
    return res.json(collaborators);
  } catch (error) {
    console.error("Get Collaborators Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const addCollaborator = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Missing email" });

  try {
    await playlistService.addCollaborator(id, req.user.id, email);
    return res.status(201).json({ success: true });
  } catch (error: any) {
    console.error("Add Collaborator Error:", error);
    const status = error.status ?? 500;
    return res.status(status).json({ error: error.message ?? "Internal Server Error" });
  }
};

export const removeCollaborator = async (req: AuthRequest, res: Response) => {
  const { id, userId } = req.params as { id: string; userId: string };
  try {
    await playlistService.removeCollaborator(id, req.user.id, userId);
    return res.status(204).send();
  } catch (error: any) {
    console.error("Remove Collaborator Error:", error);
    const status = error.status ?? 500;
    return res.status(status).json({ error: error.message ?? "Internal Server Error" });
  }
};

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
    const result = await playlistService.addSongToPlaylist(playlistId, track, req.user.id);
    return res.json(result);
  } catch (error) {
    console.error("Add Song Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
