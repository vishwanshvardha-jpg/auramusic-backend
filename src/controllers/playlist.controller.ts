import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import * as playlistService from "../services/playlist.service.js";

export const getCollaborators = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    const collaborators = await playlistService.getCollaborators(id, req.user.id);
    return res.json(collaborators);
  } catch (error: any) {
    console.error("Get Collaborators Error:", error);
    const status = error.status ?? 500;
    const body = status >= 500 ? "Internal Server Error" : error.message;
    return res.status(status).json({ error: body });
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
    const body = status >= 500 ? "Internal Server Error" : error.message;
    return res.status(status).json({ error: body });
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
    const body = status >= 500 ? "Internal Server Error" : error.message;
    return res.status(status).json({ error: body });
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
  const { name, image_url } = req.body;
  if (!name) return res.status(400).json({ error: "Missing name" });

  try {
    const playlist = await playlistService.createPlaylist(req.user.id, name, image_url);
    return res.status(201).json(playlist);
  } catch (error) {
    console.error("Create Playlist Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const leavePlaylist = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  try {
    await playlistService.leavePlaylist(req.user.id, id);
    return res.status(204).send();
  } catch (error: any) {
    console.error("Leave Playlist Error:", error);
    const status = error.status ?? 500;
    const body = status >= 500 ? "Internal Server Error" : error.message;
    return res.status(status).json({ error: body });
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
  } catch (error: any) {
    console.error("Add Song Error:", error);
    const status = error.status ?? 500;
    const body = status >= 500 ? "Internal Server Error" : error.message;
    return res.status(status).json({ error: body });
  }
};

export const getPendingInvites = async (req: AuthRequest, res: Response) => {
  try {
    const invites = await playlistService.getPendingInvites(req.user.id);
    return res.json(invites);
  } catch (error: any) {
    console.error("Get Pending Invites Error:", error);
    const status = error.status ?? 500;
    const body = status >= 500 ? "Internal Server Error" : error.message;
    return res.status(status).json({ error: body });
  }
};

export const respondToInvite = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const { status } = req.body as { status?: string };

  if (status !== "accepted" && status !== "declined") {
    return res.status(400).json({ error: "status must be 'accepted' or 'declined'" });
  }

  try {
    await playlistService.respondToInvite(id, req.user.id, status);
    return res.status(204).send();
  } catch (error: any) {
    console.error("Respond To Invite Error:", error);
    const statusCode = error.status ?? 500;
    const body = statusCode >= 500 ? "Internal Server Error" : error.message;
    return res.status(statusCode).json({ error: body });
  }
};
