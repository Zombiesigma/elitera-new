'use server';

import mammoth from 'mammoth';
import pdf from 'pdf-parse';

/**
 * Server action to extract text from .docx, .txt, or .pdf files.
 */
export async function extractBookContent(fileData: string, fileName: string, fileType: string): Promise<string> {
  try {
    // Convert base64 back to buffer
    const buffer = Buffer.from(fileData, 'base64');

    if (!buffer || buffer.length === 0) {
      throw new Error("Berkas kosong atau tidak terbaca.");
    }

    // 1. Process DOCX (Word)
    if (fileType.includes('officedocument.wordprocessingml.document') || fileName.toLowerCase().endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.trim();
      if (!text) throw new Error("Tidak ada teks yang terdeteksi dalam berkas Word.");
      return text;
    }

    // 2. Process Plain Text (TXT)
    if (fileType.includes('text/plain') || fileName.toLowerCase().endsWith('.txt')) {
      const text = buffer.toString('utf-8').trim();
      if (!text) throw new Error("Berkas teks kosong.");
      return text;
    }

    // 3. Process PDF
    if (fileType.includes('application/pdf') || fileName.toLowerCase().endsWith('.pdf')) {
      try {
        const data = await pdf(buffer);
        
        if (!data || !data.text) {
            throw new Error("Teks tidak dapat diekstrak dari PDF.");
        }
        
        // Clean text: remove null chars, standardize line breaks
        const cleanedText = data.text
            .replace(/\u0000/g, '') // Remove NULL characters
            .replace(/\r\n/g, '\n') // Standardize line breaks
            .replace(/\n\s*\n/g, '\n\n') // Collapse multiple empty lines
            .trim();
            
        if (!cleanedText || cleanedText.length < 5) {
            throw new Error("Konten PDF tidak mengandung teks yang terbaca. Pastikan PDF bukan hasil scan gambar.");
        }
        
        return cleanedText;
      } catch (pdfError: any) {
        console.error('[PDF Extraction Error]', pdfError);
        throw new Error("Gagal membaca struktur PDF: " + (pdfError.message || "Unknown error"));
      }
    }

    throw new Error("Tipe berkas ini tidak didukung untuk ekstraksi teks otomatis.");
  } catch (error: any) {
    console.error('[Book Processor Error]', error.message);
    throw new Error(error.message || "Terjadi kesalahan saat memproses isi berkas.");
  }
}
