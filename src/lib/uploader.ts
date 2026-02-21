/**
 * @fileOverview Utilitas unggahan file Elitera yang ultra-resilient.
 * Menggunakan GitHub sebagai Storage Utama dan Catbox sebagai Failover untuk Gambar.
 */

function ensureHttps(url: string): string {
  if (!url) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  if (!url.startsWith('http')) return `https://${url}`;
  return url;
}

async function uploadToGithub(file: File, folder: string = 'uploads'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);

  const response = await fetch('/api/upload/github', {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(120000),
  });

  const data = await response.json();
  
  if (data.success && data.url) {
    return ensureHttps(data.url);
  }
  
  throw new Error(data.error || 'GitHub Storage gagal merespons.');
}

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

export async function uploadFile(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file terlalu besar (Maksimal 5MB).');
  }

  try {
    return await uploadToGithub(file, 'uploads');
  } catch (err: any) {
    console.warn('[Uploader] GitHub gagal, mencoba cadangan Catbox:', err.message);
  }

  try {
    return await uploadToCatbox(file);
  } catch (err: any) {
    throw new Error(`Gagal mengunggah file: ${err.message}.`);
  }
}

export async function uploadBookFile(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Berkas buku terlalu besar (Maksimal 20MB).');
  }
  return await uploadToGithub(file, 'books');
}

export async function uploadVideo(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('Ukuran video terlalu besar (Maksimal 20MB).');
  }
  return await uploadToGithub(file, 'videos');
}

export async function uploadAudio(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Rekaman suara terlalu besar (Maksimal 10MB).');
  }
  return await uploadToGithub(file, 'audio');
}
