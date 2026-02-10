import { NextResponse } from 'next/server';

/**
 * API Route Handler untuk menangani upload ke kategori layanan Pomf secara server-side.
 * Menggunakan sistem Multi-Mirror Failover untuk menjamin keberhasilan unggahan.
 */

// Daftar Mirror Pomf yang bersifat permanen dan stabil
const POMF_MIRRORS = [
  'https://pomf.lain.la/upload.php',
  'https://quax.moe/upload.php',
  'https://pomf.cat/upload.php'
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'File tidak ditemukan dalam permintaan.' }, { status: 400 });
    }

    let lastErrorMessage = 'Semua mirror Pomf gagal merespons.';

    // Mencoba satu per satu mirror hingga berhasil
    for (const mirror of POMF_MIRRORS) {
      try {
        const pomfFormData = new FormData();
        pomfFormData.append('files[]', file);

        const response = await fetch(mirror, {
          method: 'POST',
          body: pomfFormData,
          signal: AbortSignal.timeout(20000), // Batas waktu 20 detik per mirror
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.files && data.files.length > 0) {
            console.log(`[Pomf API] Berhasil mengunggah via mirror: ${new URL(mirror).hostname}`);
            return NextResponse.json(data);
          }
        }
        
        lastErrorMessage = `Mirror ${new URL(mirror).hostname} merespons dengan status: ${response.status}`;
      } catch (err: any) {
        console.warn(`[Pomf API] Mirror ${new URL(mirror).hostname} gagal:`, err.message);
        lastErrorMessage = `Gagal menghubungi ${new URL(mirror).hostname}: ${err.message}`;
        // Lanjut ke mirror berikutnya
        continue;
      }
    }

    return NextResponse.json({ 
      success: false, 
      error: `Gagal mengunggah ke seluruh mirror Pomf. Detail terakhir: ${lastErrorMessage}` 
    }, { status: 500 });

  } catch (error: any) {
    console.error('[Pomf Route] Fatal Error:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: `Kesalahan server internal: ${error.message}` 
    }, { status: 500 });
  }
}
