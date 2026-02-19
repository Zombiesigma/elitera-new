
'use server';

import { PDFDocument as PDFLib, StandardFonts, rgb } from 'pdf-lib';
import { initializeFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import type { Book, Chapter } from '@/lib/types';

/**
 * Server action to generate a PDF for a book or screenplay and upload it to GitHub.
 * Uses pdf-lib for stable server-side generation without local font dependency.
 */
export async function generateBookPdf(bookId: string): Promise<string> {
  const { firestore } = initializeFirebase();
  if (!firestore) throw new Error('Firestore not initialized');

  // 1. Fetch Book Data
  const bookRef = doc(firestore, 'books', bookId);
  const bookSnap = await getDoc(bookRef);
  if (!bookSnap.exists()) throw new Error('Book not found');
  const book = { id: bookSnap.id, ...bookSnap.data() } as Book;

  // 2. Fetch Chapters
  const chaptersQuery = query(collection(firestore, 'books', bookId, 'chapters'), orderBy('order', 'asc'));
  const chaptersSnap = await getDocs(chaptersQuery);
  const chapters = chaptersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Chapter));

  // 3. Create PDF with pdf-lib
  const pdfDoc = await PDFLib.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontMonoBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

  // --- Cover Page ---
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  page.drawText(book.title.toUpperCase(), {
    x: 50,
    y: height - 200,
    size: 36,
    font: fontBold,
    maxWidth: width - 100,
    lineHeight: 42,
  });

  page.drawText('Sebuah karya oleh:', {
    x: 50,
    y: height - 280,
    size: 14,
    font: fontItalic,
  });

  page.drawText(book.authorName, {
    x: 50,
    y: height - 310,
    size: 24,
    font: fontBold,
  });

  page.drawText(`Genre: ${book.genre}`, {
    x: 50,
    y: height - 360,
    size: 12,
    font: fontRegular,
  });

  page.drawText(`Tipe: ${book.type === 'screenplay' ? 'Naskah Film' : 'Novel / Buku'}`, {
    x: 50,
    y: height - 380,
    size: 12,
    font: fontRegular,
  });

  // --- Chapters & Content ---
  for (const chapter of chapters) {
    page = pdfDoc.addPage([595.28, 841.89]);
    
    // Watermark Header
    page.drawText('Diterbitkan secara resmi di ELITERA - Platform Sosial Literasi Digital', {
      x: 50,
      y: height - 30,
      size: 8,
      font: fontRegular,
      color: rgb(0.8, 0.8, 0.8),
    });

    page.drawText(chapter.title, {
      x: 50,
      y: height - 80,
      size: 20,
      font: fontBold,
    });

    let currentY = height - 120;
    const margin = 50;
    const contentWidth = width - (margin * 2);

    if (book.type === 'screenplay') {
      const lines = chapter.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          currentY -= 15;
          continue;
        }

        let x = margin;
        let font = fontMono;
        let size = 12;

        // Industry Formatting Logic
        if (trimmed.startsWith('INT.') || trimmed.startsWith('EXT.') || (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes(':'))) {
          font = fontMonoBold;
        } else if (trimmed === trimmed.toUpperCase() && trimmed.endsWith(':')) {
          x = width - margin - fontMono.widthOfTextAtSize(trimmed, size);
        } else if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
          x = margin + 150;
          font = fontItalic;
        } else if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
          x = margin + 180;
          font = fontMonoBold;
        } else {
          // Action or Dialogue
          x = line.startsWith('    ') ? margin + 100 : margin;
        }

        if (currentY < 50) {
          page = pdfDoc.addPage([595.28, 841.89]);
          currentY = height - 50;
        }

        page.drawText(trimmed, { x, y: currentY, size, font });
        currentY -= 15;
      }
    } else {
      const lines = wrapText(chapter.content, contentWidth, fontRegular, 12);
      for (const line of lines) {
        if (currentY < 50) {
          page = pdfDoc.addPage([595.28, 841.89]);
          currentY = height - 50;
        }
        page.drawText(line, { x: margin, y: currentY, size: 12, font: fontRegular });
        currentY -= 16;
      }
    }

    // Footer Watermark
    page.drawText('Diterbitkan secara resmi di ELITERA - Platform Sosial Literasi Digital', {
      x: width / 2 - 150,
      y: 20,
      size: 8,
      font: fontRegular,
      color: rgb(0.8, 0.8, 0.8),
    });
  }

  // 4. Save and Upload to GitHub
  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);
  const url = await uploadPdfToGithub(pdfBuffer, `${book.title.replace(/\s+/g, '_')}.pdf`);
  
  return url;
}

/**
 * Simple text wrapping utility for pdf-lib
 */
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Uploads generated PDF buffer to GitHub.
 */
async function uploadPdfToGithub(buffer: Buffer, fileName: string): Promise<string> {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER;
  const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME;

  const base64Content = buffer.toString('base64');
  const filePath = `books/${Date.now()}-${fileName}`;

  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Elitera-App',
    },
    body: JSON.stringify({
      message: `Automatic PDF Generation for ${fileName}`,
      content: base64Content,
      branch: 'main'
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'GitHub upload failed');

  return `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/main/${filePath}`;
}
