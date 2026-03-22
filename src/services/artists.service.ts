import { supabase } from "../config/supabase.js";

export const getFollowedArtists = async (userId: string) => {
  const { data, error } = await supabase
    .from("followed_artists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

export const toggleFollowArtist = async (
  userId: string,
  artistName: string,
  artworkUrl: string
) => {
  // Check if already following
  const { data: existing } = await supabase
    .from("followed_artists")
    .select("id")
    .eq("user_id", userId)
    .eq("artist_name", artistName)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("followed_artists")
      .delete()
      .eq("user_id", userId)
      .eq("artist_name", artistName);

    if (error) throw error;
    return { status: "unfollowed" };
  } else {
    const { error } = await supabase
      .from("followed_artists")
      .insert({ user_id: userId, artist_name: artistName, artwork_url: artworkUrl });

    if (error) throw error;
    return { status: "followed" };
  }
};
