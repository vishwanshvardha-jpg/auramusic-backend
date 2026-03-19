import { supabase } from "../config/supabase.js";
import { iTunesTrack } from "./library.service.js";

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

  // Playlists shared with this user as a collaborator
  const { data: collabRows, error: collabError } = await supabase
    .from("playlist_collaborators")
    .select("playlist_id, playlists(*, playlist_songs(count))")
    .eq("user_id", userId);

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

export const getCollaborators = async (playlistId: string) => {
  const { data, error } = await supabase
    .from("playlist_collaborators")
    .select("id, user_id, role, created_at")
    .eq("playlist_id", playlistId);

  if (error) throw error;

  // Resolve emails via admin API
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) throw usersError;

  const userMap = new Map(usersData.users.map(u => [u.id, u.email ?? ""]));

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

  // Look up invitee by email
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) throw usersError;

  const invitee = usersData.users.find(u => u.email === inviteeEmail);
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
    .insert({ playlist_id: playlistId, user_id: invitee.id, role: "editor" });

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
  const { data: playlist } = await supabase
    .from("playlists")
    .select("user_id")
    .eq("id", playlistId)
    .maybeSingle();

  const isOwner = playlist?.user_id === callerId;

  if (!isOwner) {
    const { data: collab } = await supabase
      .from("playlist_collaborators")
      .select("id")
      .eq("playlist_id", playlistId)
      .eq("user_id", callerId)
      .eq("role", "editor")
      .maybeSingle();

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
