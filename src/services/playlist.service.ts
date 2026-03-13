import { supabase } from "../config/supabase.js";
import { iTunesTrack } from "./library.service.js";

export const getPlaylists = async (userId: string) => {
  console.log("📥 Fetching playlists for user:", userId);
  const { data, error } = await supabase
    .from("playlists")
    .select("*, playlist_songs(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Database Error (playlists):", error.message);
    throw error;
  }
  console.log(`✅ Found ${data?.length || 0} playlists`);
  
  // Flatten the counts
  return data.map(p => ({
    ...p,
    trackCount: p.playlist_songs?.[0]?.count || 0
  }));
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

export const addSongToPlaylist = async (playlistId: string, track: iTunesTrack) => {
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
