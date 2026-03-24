// ─── Types ───────────────────────────────────────────────────────────

export interface iTunesTrack {
  wrapperType: string;
  kind: string;
  artistId: number;
  collectionId: number;
  trackId: number;
  artistName: string;
  collectionName: string;
  trackName: string;
  artistViewUrl: string;
  collectionViewUrl: string;
  trackViewUrl: string;
  previewUrl: string;
  artworkUrl30: string;
  artworkUrl60: string;
  artworkUrl100: string;
  collectionPrice: number;
  trackPrice: number;
  releaseDate: string;
  discCount: number;
  discNumber: number;
  trackCount: number;
  trackNumber: number;
  trackTimeMillis: number;
  country: string;
  currency: string;
  primaryGenreName: string;
  isStreamable: boolean;
}

export interface iTunesSearchResponse {
  resultCount: number;
  results: iTunesTrack[];
}

// ─── Search Service ────────────────────────────────────────────────

export async function searchTracks(query: string, limit: number = 20): Promise<iTunesTrack[]> {
  const params = new URLSearchParams({
    term: query,
    entity: "song",
    limit: String(limit),
  });

  const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`, {
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("iTunes API Error:", errorBody);
    throw new Error(`iTunes search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as iTunesSearchResponse;

  // Normalize results: filter for songs with previews
  return data.results.filter(
    (track) => track.wrapperType === "track" && track.kind === "song" && track.previewUrl
  );
}

// ─── Lookup Service ────────────────────────────────────────────────

export async function lookupTracks(trackIds: number[]): Promise<iTunesTrack[]> {
  const uniqueTrackIds = [...new Set(trackIds)];
  if (uniqueTrackIds.length === 0) return [];

  // iTunes lookup supports up to 200 IDs per request
  const chunks: number[][] = [];
  for (let i = 0; i < uniqueTrackIds.length; i += 200) chunks.push(uniqueTrackIds.slice(i, i + 200));

  const results: iTunesTrack[] = [];
  for (const chunk of chunks) {
    const response = await fetch(
      `https://itunes.apple.com/lookup?id=${chunk.join(",")}&entity=song`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) throw new Error(`iTunes lookup failed: ${response.status}`);
    const data = (await response.json()) as iTunesSearchResponse;
    results.push(...data.results.filter(
      (t) => t.wrapperType === "track" && t.kind === "song"
    ));
  }
  return results;
}
