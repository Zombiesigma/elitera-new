import { NextResponse } from 'next/server';

/**
 * API Route untuk mengunggah file ke GitHub Repository (Hardcoded Config).
 * Mendukung file hingga 20MB (Limit REST API GitHub).
 */

// Ganti baris const lama dengan ini:
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER;
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'File tidak ditemukan dalam permintaan.' }, { status: 400 });
    }

    // Validasi limit keras GitHub REST API
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ 
        success: false, 
        error: 'File terlalu besar untuk GitHub API (Maksimal 20MB).' 
      }, { status: 413 });
    }

    // Konversi file ke Base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString('base64');

    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}-${cleanFileName}`;
    const filePath = `uploads/${fileName}`;

    // Kirim ke GitHub dengan timeout yang panjang
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Elitera-App',
      },
      body: JSON.stringify({
        message: `Upload ${fileName} from Elitera App`,
        content: base64Content,
        branch: 'main'
      }),
      signal: AbortSignal.timeout(110000), // Timeout 110 detik untuk API GitHub
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[GitHub API Error]', data);
      return NextResponse.json({ 
        success: false, 
        error: data.message || `GitHub gagal merespons dengan status ${response.status}` 
      }, { status: response.status });
    }

    // URL Raw GitHub untuk akses langsung
    const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/main/${filePath}`;

    return NextResponse.json({
      success: true,
      url: rawUrl,
    });

  } catch (error: any) {
    console.error('[GitHub Route Fatal Error]', error.message);
    let errorMessage = error.message;
    if (error.name === 'TimeoutError') {
      errorMessage = 'Koneksi ke GitHub terputus (Timeout). File mungkin terlalu besar untuk koneksi saat ini.';
    }
    return NextResponse.json({ 
      success: false, 
      error: `Kesalahan server internal: ${errorMessage}` 
    }, { status: 500 });
  }
}
