import { supabase } from "../config/supabase.js";
import { iTunesTrack } from "./library.service.js";

const listAllUsers = async () => {
  const allUsers: any[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    allUsers.push(...data.users);
    if (data.users.length < perPage) break;
    page++;
  }
  return allUsers;
};

export const getPlaylists = async (userId: string) => {
  console.log("📥 Fetching playlists for user:", userId);

  // Owned playlists
  const { data: owned, error: ownedError } = await supabase
    .from("playlists")
    .select("*, playlist_songs(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (ownedError) {
    console.error("❌ Database Error (playlists):", ownedError.message);
    throw ownedError;
  }

  // Playlists shared with this user as a collaborator (accepted invites only)
  const { data: collabRows, error: collabError } = await supabase
    .from("playlist_collaborators")
    .select("playlist_id, playlists(*, playlist_songs(count))")
    .eq("user_id", userId)
    .eq("status", "accepted");

  if (collabError) {
    console.error("❌ Database Error (collaborator playlists):", collabError.message);
    throw collabError;
  }

  const sharedPlaylists = (collabRows ?? [])
    .map((row: any) => row.playlists)
    .filter(Boolean)
    .map((p: any) => ({
      ...p,
      trackCount: p.playlist_songs?.[0]?.count || 0,
      isShared: true,
    }));

  const ownedPlaylists = (owned ?? []).map(p => ({
    ...p,
    trackCount: p.playlist_songs?.[0]?.count || 0,
    isShared: false,
  }));

  const combined = [...ownedPlaylists, ...sharedPlaylists];
  console.log(`✅ Found ${combined.length} playlists (${ownedPlaylists.length} owned, ${sharedPlaylists.length} shared)`);
  return combined;
};

export const createPlaylist = async (userId: string, name: string) => {
  const { data, error } = await supabase
    .from("playlists")
    .insert({ user_id: userId, name })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deletePlaylist = async (userId: string, playlistId: string) => {
  const { error } = await supabase
    .from("playlists")
    .delete()
    .eq("user_id", userId)
    .eq("id", playlistId);

  if (error) throw error;
};

export const getPlaylistSongs = async (playlistId: string) => {
  const { data, error } = await supabase
    .from("playlist_songs")
    .select("*")
    .eq("playlist_id", playlistId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data.map(ps => ({
    ...ps.track_data,
    addedAt: ps.created_at
  }));
};

export const getCollaborators = async (playlistId: string, callerId: string) => {
  // Verify playlist exists and check caller is owner or collaborator
  const { data: playlist, error: playlistError } = await supabase
    .from("playlists")
    .select("user_id")
    .eq("id", playlistId)
    .maybeSingle();

  if (playlistError) throw playlistError;
  if (!playlist) {
    const err: any = new Error("Playlist not found");
    err.status = 404;
    throw err;
  }

  const isOwner = playlist.user_id === callerId;

  if (!isOwner) {
    const { data: collab, error: collabError } = await supabase
      .from("playlist_collaborators")
      .select("id")
      .eq("playlist_id", playlistId)
      .eq("user_id", callerId)
      .eq("status", "accepted")
      .maybeSingle();

    if (collabError) throw collabError;
    if (!collab) {
      const err: any = new Error("Not authorized to view collaborators");
      err.status = 403;
      throw err;
    }
  }

  const { data, error } = await supabase
    .from("playlist_collaborators")
    .select("id, user_id, role, status, created_at")
    .eq("playlist_id", playlistId);

  if (error) throw error;

  // Resolve emails via admin API (paginated)
  const allUsers = await listAllUsers();
  const userMap = new Map(allUsers.map(u => [u.id, u.email ?? ""]));

  return (data ?? []).map(row => ({
    ...row,
    email: userMap.get(row.user_id) ?? "",
  }));
};

export const addCollaborator = async (playlistId: string, ownerUserId: string, inviteeEmail: string) => {
  // Verify caller owns the playlist
  const { data: playlist, error: ownerError } = await supabase
    .from("playlists")
    .select("id")
    .eq("id", playlistId)
    .eq("user_id", ownerUserId)
    .maybeSingle();

  if (ownerError) throw ownerError;
  if (!playlist) {
    const err: any = new Error("Not the playlist owner");
    err.status = 403;
    throw err;
  }

  // Look up invitee by email (paginated)
  const allUsers = await listAllUsers();
  const invitee = allUsers.find(u => u.email === inviteeEmail);
  if (!invitee) {
    const err: any = new Error("User not found");
    err.status = 404;
    throw err;
  }

  if (invitee.id === ownerUserId) {
    const err: any = new Error("Cannot add yourself as a collaborator");
    err.status = 400;
    throw err;
  }

  const { error } = await supabase
    .from("playlist_collaborators")
    .insert({ playlist_id: playlistId, user_id: invitee.id, role: "editor", status: "pending" });

  if (error) {
    if (error.code === "23505") {
      const err: any = new Error("User is already a collaborator");
      err.status = 409;
      throw err;
    }
    throw error;
  }
};

export const removeCollaborator = async (playlistId: string, ownerUserId: string, collaboratorUserId: string) => {
  // Verify caller owns the playlist
  const { data: playlist, error: ownerError } = await supabase
    .from("playlists")
    .select("id")
    .eq("id", playlistId)
    .eq("user_id", ownerUserId)
    .maybeSingle();

  if (ownerError) throw ownerError;
  if (!playlist) {
    const err: any = new Error("Not the playlist owner");
    err.status = 403;
    throw err;
  }

  const { error } = await supabase
    .from("playlist_collaborators")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("user_id", collaboratorUserId);

  if (error) throw error;
};

export const addSongToPlaylist = async (playlistId: string, track: iTunesTrack, callerId: string) => {
  // Verify caller is the owner or an editor collaborator
  const { data: playlist, error: playlistError } = await supabase
    .from("playlists")
    .select("user_id")
    .eq("id", playlistId)
    .maybeSingle();

  if (playlistError) throw playlistError;
  if (!playlist) {
    const err: any = new Error("Playlist not found");
    err.status = 404;
    throw err;
  }

  const isOwner = playlist.user_id === callerId;

  if (!isOwner) {
    const { data: collab, error: collabError } = await supabase
      .from("playlist_collaborators")
      .select("id")
      .eq("playlist_id", playlistId)
      .eq("user_id", callerId)
      .eq("role", "editor")
      .eq("status", "accepted")
      .maybeSingle();

    if (collabError) throw collabError;
    if (!collab) {
      const err: any = new Error("Not authorized to add songs to this playlist");
      err.status = 403;
      throw err;
    }
  }

  // Check for uniqueness
  const { data: existing } = await supabase
    .from("playlist_songs")
    .select("id")
    .eq("playlist_id", playlistId)
    .eq("track_id", track.trackId)
    .maybeSingle();

  if (existing) return { status: "already_exists" };

  // Get current max position
  const { data: posData } = await supabase
    .from("playlist_songs")
    .select("position")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (posData?.position ?? -1) + 1;

  const { error } = await supabase
    .from("playlist_songs")
    .insert({
      playlist_id: playlistId,
      track_id: track.trackId,
      track_data: track,
      position: nextPosition
    });

  if (error) throw error;
  return { status: "added" };
};

export const getPendingInvites = async (userId: string) => {
  const { data, error } = await supabase
    .from("playlist_collaborators")
    .select("id, playlist_id, role, created_at, playlists(id, name, user_id)")
    .eq("user_id", userId)
    .eq("status", "pending");

  if (error) throw error;

  const allUsers = await listAllUsers();
  const userMap = new Map(allUsers.map(u => [u.id, u.email ?? ""]));

  return (data ?? []).map((row: any) => ({
    id: row.id,
    playlist_id: row.playlist_id,
    playlist_name: row.playlists?.name ?? "",
    owner_user_id: row.playlists?.user_id ?? "",
    owner_email: userMap.get(row.playlists?.user_id ?? "") ?? "",
    role: row.role,
    created_at: row.created_at,
  }));
};

export const respondToInvite = async (
  playlistId: string,
  userId: string,
  status: "accepted" | "declined"
) => {
  const { data: updated, error: updateError } = await supabase
    .from("playlist_collaborators")
    .update({ status })
    .eq("playlist_id", playlistId)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;

  if (!updated) {
    // No row was updated — determine why
    const { data: existing, error: lookupError } = await supabase
      .from("playlist_collaborators")
      .select("id")
      .eq("playlist_id", playlistId)
      .eq("user_id", userId)
      .maybeSingle();

    if (lookupError) throw lookupError;

    const err: any = existing
      ? new Error("Invite has already been responded to")
      : new Error("Invite not found");
    err.status = existing ? 409 : 404;
    throw err;
  }
};
