import { NextResponse } from 'next/server';

/**
 * API Route Handler untuk menangani upload ke ImgBB secara server-side.
 * Menghindari kebocoran API Key ke sisi client dan masalah CORS.
 */

const IMGBB_API_KEY = '80e32f6064c9704398ae67c51c84cbc2';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'File tidak ditemukan.' }, { status: 400 });
    }

    // Persiapkan FormData untuk ImgBB
    const imgbbFormData = new FormData();
    imgbbFormData.append('image', file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
      method: 'POST',
      body: imgbbFormData,
      signal: AbortSignal.timeout(30000), // Timeout 30 detik
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json({ 
        success: false, 
        error: errorData.error?.message || `ImgBB merespons dengan status: ${response.status}` 
      }, { status: response.status });
    }

    const data = await response.json();
    
    if (data.success && data.data && data.data.url) {
      return NextResponse.json({
        success: true,
        url: data.data.url, // Direct link dari ImgBB
      });
    }

    return NextResponse.json({ success: false, error: 'Gagal mendapatkan URL dari ImgBB.' }, { status: 500 });

  } catch (error: any) {
    console.error('[ImgBB Route] Fatal Error:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: `Kesalahan server internal: ${error.message}` 
    }, { status: 500 });
  }
}
