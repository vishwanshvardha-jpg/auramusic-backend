import { APP_URL, EMAIL_FROM, resend } from "../config/resend.js";
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

export const createPlaylist = async (userId: string, name: string, imageUrl?: string) => {
  const { data, error } = await supabase
    .from("playlists")
    .insert({ user_id: userId, name, ...(imageUrl ? { image_url: imageUrl } : {}) })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updatePlaylist = async (userId: string, playlistId: string, fields: { image_url?: string }) => {
  const { data: playlist, error: ownerError } = await supabase
    .from("playlists")
    .select("user_id")
    .eq("id", playlistId)
    .maybeSingle();

  if (ownerError) throw ownerError;
  if (!playlist) {
    const err: any = new Error("Playlist not found");
    err.status = 404;
    throw err;
  }

  if (playlist.user_id !== userId) {
    const err: any = new Error("Only the owner can update this playlist");
    err.status = 403;
    throw err;
  }

  const { error } = await supabase
    .from("playlists")
    .update(fields)
    .eq("id", playlistId);

  if (error) throw error;
};

export const leavePlaylist = async (userId: string, playlistId: string) => {
  // Verify the user is actually a collaborator (not the owner)
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

  if (playlist.user_id === userId) {
    const err: any = new Error("Owners cannot leave their own playlist — delete it instead");
    err.status = 400;
    throw err;
  }

  const { error } = await supabase
    .from("playlist_collaborators")
    .delete()
    .eq("playlist_id", playlistId)
    .eq("user_id", userId);

  if (error) throw error;
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
    .select("track_id, position, created_at")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(ps => ({
    track_id: ps.track_id,
    position: ps.position,
    added_at: ps.created_at,
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
      position: nextPosition,
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

// ─── Share Token ─────────────────────────────────────────────────────────────

export const generateShareToken = async (playlistId: string, ownerUserId: string): Promise<string> => {
  // Verify caller owns the playlist
  const { data: playlist, error: ownerError } = await supabase
    .from("playlists")
    .select("id, name")
    .eq("id", playlistId)
    .eq("user_id", ownerUserId)
    .maybeSingle();

  if (ownerError) throw ownerError;
  if (!playlist) {
    const err: any = new Error("Not the playlist owner");
    err.status = 403;
    throw err;
  }

  // Upsert: return existing token if one already exists for this playlist
  const { data, error } = await supabase
    .from("playlist_share_tokens")
    .upsert({ playlist_id: playlistId, created_by: ownerUserId }, { onConflict: "playlist_id" })
    .select("token")
    .single();

  if (error) throw error;
  return data.token;
};

export const getPublicPlaylist = async (token: string): Promise<{ playlist: any; tracks: any[] } | null> => {
  // Look up share token
  const { data: tokenRow, error: tokenError } = await supabase
    .from("playlist_share_tokens")
    .select("playlist_id")
    .eq("token", token)
    .maybeSingle();

  if (tokenError) throw tokenError;
  if (!tokenRow) return null;

  const playlistId = tokenRow.playlist_id;

  // Fetch playlist metadata
  const { data: playlist, error: playlistError } = await supabase
    .from("playlists")
    .select("id, name, description, image_url, user_id, created_at")
    .eq("id", playlistId)
    .maybeSingle();

  if (playlistError) throw playlistError;
  if (!playlist) return null;

  // Fetch songs (track IDs + positions only — no track_data stored in DB per architecture)
  const { data: songs, error: songsError } = await supabase
    .from("playlist_songs")
    .select("track_id, position, created_at")
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });

  if (songsError) throw songsError;

  const tracks = (songs ?? []).map(s => ({
    track_id: s.track_id,
    position: s.position,
    added_at: s.created_at,
  }));

  return { playlist, tracks };
};

export const sendShareEmail = async (playlistId: string, ownerUserId: string, recipientEmail: string): Promise<void> => {
  // Generate (or fetch existing) share token
  const token = await generateShareToken(playlistId, ownerUserId);

  // Get playlist name + owner email for the email template
  const { data: playlist } = await supabase
    .from("playlists")
    .select("name")
    .eq("id", playlistId)
    .maybeSingle();

  const allUsers = await listAllUsers();
  const owner = allUsers.find(u => u.id === ownerUserId);
  const ownerName = owner?.email?.split("@")[0] ?? "Someone";
  const playlistName = playlist?.name ?? "a playlist";
  const shareUrl = `${APP_URL}/share/${token}`;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <tr>
          <td style="padding:32px 36px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:13px;font-weight:900;letter-spacing:0.2em;color:#00d4aa;text-transform:uppercase;">Repose Music</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 36px;">
            <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#ffffff;line-height:1.3;">
              ${ownerName} shared a playlist with you
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:rgba(255,255,255,0.5);line-height:1.5;">
              You've been invited to listen to <strong style="color:rgba(255,255,255,0.8);">${playlistName}</strong> on Repose Music.
            </p>
            <a href="${shareUrl}"
               style="display:inline-block;background:#00d4aa;color:#000000;font-size:13px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:14px 28px;border-radius:100px;">
              Open Playlist
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 36px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);">
              Or copy this link: <a href="${shareUrl}" style="color:#00d4aa;text-decoration:none;">${shareUrl}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // Idempotency key prevents duplicate emails if the request is retried
  const idempotencyKey = `share-email/${playlistId}/${Buffer.from(recipientEmail).toString("base64url")}`;

  const text = `${ownerName} shared "${playlistName}" with you on Repose Music.\n\nOpen the playlist: ${shareUrl}`;

  const { error } = await resend.emails.send(
    {
      from: EMAIL_FROM,
      to: recipientEmail,
      subject: `${ownerName} shared "${playlistName}" with you on Repose Music`,
      html,
      text,
    },
    { idempotencyKey }
  );

  if (error) {
    console.error("Resend error:", error);
    const err: any = new Error("Failed to send email");
    err.status = 500;
    throw err;
  }
};
