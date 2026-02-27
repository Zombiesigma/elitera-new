/**
 * @fileOverview Utilitas unggahan file Elitera yang ultra-resilient dan terstruktur.
 * Menggunakan GitHub sebagai Storage Utama dengan hirarki folder yang rapi kawan.
 */

function ensureHttps(url: string): string {
  if (!url) return url;
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://')) return url.replace('http://', 'https://');
  if (!url.startsWith('http')) return `https://${url}`;
  return url;
}

/**
 * Membersihkan string untuk digunakan sebagai nama folder yang aman kawan.
 */
function sanitizePath(str: string): string {
  return str.replace(/[^a-z0-9]/gi, '_').toLowerCase().trim();
}

/**
 * Generic GitHub Uploader
 */
export async function uploadToGithub(file: File, customPath: string = 'uploads'): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', customPath);

  const response = await fetch('/api/upload/github', {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(120000),
  });

  const text = await response.text();
  if (!response.ok || !text) {
      const errorData = text ? JSON.parse(text) : { error: 'Respons server kosong.' };
      throw new Error(errorData.error || 'GitHub Storage gagal merespons.');
  }

  const data = JSON.parse(text);
  if (data.success && data.url) {
    return ensureHttps(data.url);
  }
  
  throw new Error(data.error || 'Gagal mendapatkan URL dari penyimpanan.');
}

/**
 * Struktur: foto profile/{nama user}/{filename}
 */
export async function uploadProfilePhoto(file: File, userName: string): Promise<string> {
  const path = `foto profile/${sanitizePath(userName)}`;
  return await uploadToGithub(file, path);
}

/**
 * Struktur: covers/{jenis buku}/{judul buku}/{filename}
 */
export async function uploadBookCover(file: File, type: string, title: string): Promise<string> {
  const typeMap: Record<string, string> = {
    'book': 'books',
    'screenplay': 'naskah',
    'poem': 'puisi'
  };
  const typeFolder = typeMap[type] || 'general';
  const path = `covers/${typeFolder}/${sanitizePath(title)}`;
  return await uploadToGithub(file, path);
}

/**
 * Struktur: books/{judul buku}/{filename}.pdf
 */
export async function uploadBookFile(file: File, title: string): Promise<string> {
  const path = `books/${sanitizePath(title)}`;
  return await uploadToGithub(file, path);
}

/**
 * Fallback Generic Uploader
 */
export async function uploadFile(file: File): Promise<string> {
  return await uploadToGithub(file, 'uploads');
}

export async function uploadVideo(file: File): Promise<string> {
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Ukuran video terlalu besar (Maksimal 25MB).');
  }
  return await uploadToGithub(file, 'videos');
}

export async function uploadAudio(file: File): Promise<string> {
  return await uploadToGithub(file, 'audio');
}

export async function uploadMusic(file: File): Promise<string> {
  return await uploadToGithub(file, 'musik');
}
