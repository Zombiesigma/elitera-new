'use server';

/**
 * @fileOverview Server Action untuk berinteraksi dengan API Last.fm dan YouTube.
 * Digunakan untuk mencari referensi soundtrack bagi penulis dan pembaca.
 */

export type MusicTrack = {
  id?: string;
  name: string;
  artist: string;
  image: string;
  source: 'lastfm' | 'youtube' | 'internal';
};

// Search via Last.fm (Metadata Only)
export async function searchMusic(query: string): Promise<MusicTrack[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  
  if (!apiKey) {
    console.warn("Last.fm API Key tidak ditemukan.");
    return [];
  }

  if (!query || query.length < 2) return [];

  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(query)}&api_key=${apiKey}&format=json&limit=10`;
    
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const tracks = data.results?.trackmatches?.track || [];

    return tracks.map((t: any) => ({
      name: t.name,
      artist: t.artist,
      image: t.image?.find((img: any) => img.size === 'medium')?.['#text'] || 'https://placehold.co/64x64?text=Music',
      source: 'lastfm' as const
    }));
  } catch (error) {
    console.error("Error searching Last.fm:", error);
    return [];
  }
}

// Search via YouTube (Playable via Iframe)
export async function searchYouTube(query: string): Promise<MusicTrack[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    console.warn("YouTube API Key tidak ditemukan di .env.");
    return [];
  }

  if (!query || query.length < 2) return [];

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(query + " music")}&type=video&key=${apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    const items = data.items || [];

    return items.map((item: any) => ({
      id: item.id.videoId,
      name: item.snippet.title,
      artist: item.snippet.channelTitle,
      image: item.snippet.thumbnails.medium.url,
      source: 'youtube' as const
    }));
  } catch (error) {
    console.error("Error searching YouTube:", error);
    return [];
  }
}
