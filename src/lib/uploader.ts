
/**
 * @fileOverview Utilitas unggahan file Elitera yang ultra-resilient.
 * Menggunakan GitHub sebagai Storage Utama dan Catbox sebagai Failover untuk Gambar.
 * Untuk Video dan Audio, hanya menggunakan GitHub Storage.
 */

/**
 * Memastikan URL menggunakan protokol HTTPS.
 */
function ensureHttps(url: string): string {
  if (!url) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  if (!url.startsWith('http')) return `https://${url}`;
  return url;
}

/**
 * PRIORITAS 1: GitHub via API Route Internal
 */
async function uploadToGithub(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload/github', {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(120000), // Timeout 120 detik untuk klien
  });

  const data = await response.json();
  
  if (data.success && data.url) {
    console.log('[Uploader] Berhasil mengunggah ke GitHub Storage.');
    return ensureHttps(data.url);
  }
  
  throw new Error(data.error || 'GitHub Storage gagal merespons.');
}

/**
 * CADANGAN GAMBAR: Catbox via Proxy
 */
async function uploadToCatbox(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('service', 'Catbox');

  const response = await fetch('https://uploader.himmel.web.id/api/upload', {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`Catbox Proxy Error: ${response.status}`);
  }
  
  const data = await response.json();
  const url = data.result || data.url;
  
  if (!url) {
    throw new Error('Gagal mendapatkan URL dari Catbox.');
  }
  
  return ensureHttps(url);
}

/**
 * FUNGSI UNGGAL GAMBAR: uploadFile (Failover GitHub-Catbox)
 */
export async function uploadFile(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file terlalu besar (Maksimal 5MB).');
  }

  // Coba GitHub (Utama)
  try {
    return await uploadToGithub(file);
  } catch (err: any) {
    console.warn('[Uploader] GitHub gagal, mencoba cadangan Catbox:', err.message);
  }

  // Coba Catbox (Cadangan)
  try {
    return await uploadToCatbox(file);
  } catch (err: any) {
    console.error('[Uploader] Fatal: Seluruh sistem upload gagal!', err.message);
    throw new Error(`Gagal mengunggah file: ${err.message}. Harap periksa koneksi Anda.`);
  }
}

/**
 * FUNGSI UNGGAL VIDEO: uploadVideo (Eksklusif GitHub)
 */
export async function uploadVideo(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Ukuran video terlalu besar (Maksimal 20MB).');
  }

  try {
    return await uploadToGithub(file);
  } catch (err: any) {
    console.error('[Uploader] Gagal mengunggah video ke GitHub:', err.message);
    throw new Error(`Unggahan Video Gagal: ${err.message}.`);
  }
}

/**
 * FUNGSI UNGGAL AUDIO: uploadAudio (Eksklusif GitHub)
 */
export async function uploadAudio(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Rekaman suara terlalu besar (Maksimal 10MB).');
  }

  try {
    return await uploadToGithub(file);
  } catch (err: any) {
    console.error('[Uploader] Gagal mengunggah audio ke GitHub:', err.message);
    throw new Error(`Gagal mengirim rekaman suara: ${err.message}.`);
  }
}
