'use server';

/**
 * @fileOverview Server Action untuk pencarian musik dan pengambilan stream URL secara instan.
 * Dioptimalkan untuk performa tinggi tanpa penyimpanan permanen.
 */

import axios from 'axios';

export type MusicTrack = {
  id?: string;
  name: string;
  artist: string;
  image: string;
  url?: string;
  source: 'youtube' | 'spotify' | 'internal';
};

/**
 * Mencari video musik di YouTube menggunakan Data API v3.
 */
export async function searchYouTube(query: string): Promise<MusicTrack[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || !query || query.length < 2) return [];

  try {
    const q = `${query} official audio`;
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(q)}&type=video&videoCategoryId=10&key=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    const items = data.items || [];

    return items.map((item: any) => ({
      id: item.id.videoId,
      name: item.snippet.title.replace(/ *\([^)]*\) */g, "").replace(/ *\[[^\]]*\] */g, ""), 
      artist: item.snippet.channelTitle.replace(" - Topic", ""),
      image: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium.url,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      source: 'youtube' as const
    }));
  } catch (error) {
    console.error("[YouTube API Error]", error);
    return [];
  }
}

/**
 * Mendapatkan URL stream MP3 secara instan menggunakan mesin konversi ymcdn.
 * Digunakan baik untuk pratinjau penulis maupun pemutaran utama pembaca.
 */
export async function getPreviewAudioUrl(youtubeId: string): Promise<string | null> {
  const hr = {
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Referer': 'https://id.ytmp3.mobi/',
  };

  try {
    // Inisialisasi konversi
    const init = await axios.get(`https://d.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=${Math.random()}`, { headers: hr });
    if (!init.data.convertURL) return null;

    // Mulai konversi ke MP3
    const convert = await axios.get(`${init.data.convertURL}&v=${youtubeId}&f=mp3&_=${Math.random()}`, { headers: hr });
    const convertData = convert.data;

    if (!convertData.progressURL || !convertData.downloadURL) return null;

    // Polling singkat untuk menunggu link siap (biasanya sangat cepat)
    let currentProgress = 0;
    let attempts = 0;
    let maxAttempts = 15; // Maks 7.5 detik pencarian

    while (currentProgress < 3 && attempts < maxAttempts) {
      const resp = await axios.get(convertData.progressURL, { headers: hr });
      currentProgress = resp.data.progress;
      if (currentProgress >= 3) return convertData.downloadURL;
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    return convertData.downloadURL;
  } catch (error) {
    console.error("[Stream Fetch Error]", error);
    return null;
  }
}
