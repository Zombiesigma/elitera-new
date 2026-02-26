'use server';

/**
 * @fileOverview Server Action untuk mengambil kredensial ICE (STUN/TURN) secara dinamis dari Metered.ca.
 * Diperbarui dengan API Key dan Domain Elitera yang baru untuk koneksi global kawan.
 */

export async function getIceServers() {
  const apiKey = 'e36a59ebc0069ac41fa01f7136d4fb5d0d2f';
  const domain = 'elitera.metered.live';

  try {
    const response = await fetch(
      `https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`,
      { 
        method: 'GET',
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error(`Metered API responded with status: ${response.status}`);
    }

    // Metered returns an array of ice server objects
    const iceServers = await response.json();
    console.log('[ICE] Servers fetched successfully kawan.');
    return iceServers;
  } catch (error) {
    console.error('[ICE Server Fetch Error] Gagal menjangkau Metered kawan:', error);
    
    // Fallback ke STUN publik milik Google jika Metered gagal kawan
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ];
  }
}
