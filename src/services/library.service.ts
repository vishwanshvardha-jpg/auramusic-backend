import { supabase } from "../config/supabase.js";

// Ported from lib/itunes.ts (types)
export interface iTunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  artworkUrl100: string;
  previewUrl: string;
  [key: string]: any;
}

export const getLikedSongs = async (userId: string) => {
  console.log("📥 Fetching liked songs for user:", userId);
  const { data, error } = await supabase
    .from("liked_songs")
    .select("user_id, track_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ Database Error (liked_songs):", error.message);
    throw error;
  }
  console.log(`✅ Found ${data?.length || 0} liked songs`);
  return (data ?? []).map(row => ({
    track_id: row.track_id,
    created_at: row.created_at,
  }));
};

export const toggleLikeSong = async (userId: string, track: iTunesTrack, isLiked: boolean) => {
  if (isLiked) {
    const { error } = await supabase
      .from("liked_songs")
      .delete()
      .eq("user_id", userId)
      .eq("track_id", track.trackId);
    if (error) throw error;
    return { status: "unliked" };
  } else {
    // Check for existing to prevent duplicates
    const { data: existing } = await supabase
      .from("liked_songs")
      .select("id")
      .eq("user_id", userId)
      .eq("track_id", track.trackId)
      .maybeSingle();

    if (existing) return { status: "already_liked" };

    const { error } = await supabase.from("liked_songs").insert({
      user_id: userId,
      track_id: track.trackId,
    });
    if (error) throw error;
    return { status: "liked" };
  }
};
