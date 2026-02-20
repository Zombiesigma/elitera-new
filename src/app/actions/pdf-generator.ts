'use server';

import { PDFDocument as PDFLib, StandardFonts, rgb } from 'pdf-lib';
import { initializeFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import type { Book, Chapter } from '@/lib/types';

export async function generateBookPdf(bookId: string): Promise<string> {
  const { firestore } = initializeFirebase();
  if (!firestore) throw new Error('Firestore not initialized');

  const bookRef = doc(firestore, 'books', bookId);
  const bookSnap = await getDoc(bookRef);
  if (!bookSnap.exists()) throw new Error('Book not found');
  const book = { id: bookSnap.id, ...bookSnap.data() } as Book;

  const chaptersQuery = query(collection(firestore, 'books', bookId, 'chapters'), orderBy('order', 'asc'));
  const chaptersSnap = await getDocs(chaptersQuery);
  const chapters = chaptersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Chapter));

  const pdfDoc = await PDFLib.create();
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontSerifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontSerifRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontMonoBold = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const PAGE_WIDTH = 595.28; // A4
  const PAGE_HEIGHT = 841.89; // A4
  const MARGIN = 60;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const { width, height } = page.getSize();

  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: rgb(0.23, 0.51, 0.96), 
    borderWidth: 2,
  });

  page.drawRectangle({
    x: 40,
    y: 40,
    width: width - 80,
    height: height - 80,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.5,
  });

  const titleFontSize = 32;
  const titleText = book.title.toUpperCase();
  const titleWidth = fontBold.widthOfTextAtSize(titleText, titleFontSize);
  
  page.drawText(titleText, {
    x: (width - Math.min(titleWidth, width - 100)) / 2,
    y: height - 250,
    size: titleFontSize,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
    maxWidth: width - 100,
    lineHeight: 38,
  });

  const authorIntro = 'Sebuah Mahakarya Oleh:';
  const authorIntroWidth = fontItalic.widthOfTextAtSize(authorIntro, 14);
  page.drawText(authorIntro, {
    x: (width - authorIntroWidth) / 2,
    y: height - 340,
    size: 14,
    font: fontItalic,
    color: rgb(0.4, 0.4, 0.4),
  });

  const authorName = book.authorName;
  const authorFontSize = 24;
  const authorWidth = fontBold.widthOfTextAtSize(authorName, authorFontSize);
  page.drawText(authorName, {
    x: (width - authorWidth) / 2,
    y: height - 375,
    size: authorFontSize,
    font: fontBold,
    color: rgb(0.23, 0.51, 0.96),
  });

  const categoryText = `${book.genre.toUpperCase()} | ${book.type === 'screenplay' ? 'NASKAH FILM' : 'NOVEL'}`;
  const catFontSize = 10;
  const catWidth = fontRegular.widthOfTextAtSize(categoryText, catFontSize);
  
  page.drawRectangle({
    x: (width - catWidth - 30) / 2,
    y: 100,
    width: catWidth + 30,
    height: 25,
    color: rgb(0.95, 0.95, 0.95),
    opacity: 0.8,
  });

  page.drawText(categoryText, {
    x: (width - catWidth) / 2,
    y: 110,
    size: catFontSize,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  });

  page.drawText('ELITERA', {
    x: (width - fontBold.widthOfTextAtSize('ELITERA', 16)) / 2,
    y: 60,
    size: 16,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });

  let pageCount = 1;

  for (const chapter of chapters) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageCount++;

    page.drawText('ELITERA DIGITAL LITERACY', {
      x: MARGIN,
      y: height - 40,
      size: 7,
      font: fontBold,
      color: rgb(0.7, 0.7, 0.7),
    });

    page.drawText(book.title.toUpperCase(), {
      x: width - MARGIN - fontRegular.widthOfTextAtSize(book.title.toUpperCase(), 7),
      y: height - 40,
      size: 7,
      font: fontRegular,
      color: rgb(0.7, 0.7, 0.7),
    });

    const isScreenplay = book.type === 'screenplay';
    const chapterFont = isScreenplay ? fontMonoBold : fontSerifBold;
    
    const chapterTitleX = isScreenplay ? (width - fontMonoBold.widthOfTextAtSize(chapter.title.toUpperCase(), 18)) / 2 : MARGIN;
    page.drawText(isScreenplay ? chapter.title.toUpperCase() : chapter.title, {
      x: chapterTitleX,
      y: height - 90,
      size: isScreenplay ? 18 : 22,
      font: chapterFont,
      color: rgb(0.1, 0.1, 0.1),
    });

    let currentY = height - 135;
    const contentWidth = width - (MARGIN * 2);

    if (isScreenplay) {
      const lines = chapter.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          currentY -= 14;
          continue;
        }

        let x = MARGIN;
        let font = fontMono;
        let size = 12;
        let wrapWidth = contentWidth;

        if (trimmed.startsWith('INT.') || trimmed.startsWith('EXT.') || (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && !trimmed.includes(':') && !trimmed.startsWith('(') && !trimmed.includes(' - '))) {
          font = fontMonoBold;
          currentY -= 10;
        } 
        else if (trimmed === trimmed.toUpperCase() && (trimmed.endsWith(':') || trimmed.startsWith('FADE '))) {
          x = width - MARGIN - fontMono.widthOfTextAtSize(trimmed, size);
          font = fontMonoBold;
        } 
        else if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
          x = (width - fontItalic.widthOfTextAtSize(trimmed, size)) / 2;
          font = fontItalic;
        } 
        else if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
          x = (width - fontMonoBold.widthOfTextAtSize(trimmed, size)) / 2;
          font = fontMonoBold;
          currentY -= 5;
        } 
        else {
            const linesArray = chapter.content.split('\n');
            const currentLineIdx = linesArray.indexOf(line);
            const prevLine = currentLineIdx > 0 ? linesArray[currentLineIdx - 1].trim() : "";
            const isPrevCharOrParen = (prevLine === prevLine.toUpperCase() && prevLine !== "") || (prevLine.startsWith('(') && prevLine.endsWith(')'));
            
            if (isPrevCharOrParen) {
                x = MARGIN + 100; 
                wrapWidth = contentWidth - 200;
            }
        }

        const wrappedLines = wrapText(trimmed, wrapWidth, font, size);
        for (const wLine of wrappedLines) {
            if (currentY < 70) {
                page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
                pageCount++;
                addFooter(page, pageCount, fontRegular, width);
                currentY = height - 60;
            }
            
            let finalX = x;
            if (wrapWidth < contentWidth) {
                finalX = (width - font.widthOfTextAtSize(wLine, size)) / 2;
            }

            page.drawText(wLine, { x: finalX, y: currentY, size, font });
            currentY -= 15;
        }
      }
    } else {
      const lines = wrapText(chapter.content, contentWidth, fontSerifRegular, 12);
      for (const line of lines) {
        if (currentY < 70) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          pageCount++;
          addFooter(page, pageCount, fontRegular, width);
          currentY = height - 60;
        }
        page.drawText(line, { x: MARGIN, y: currentY, size: 12, font: fontSerifRegular, lineHeight: 16 });
        currentY -= 18; 
      }
    }

    addFooter(page, pageCount, fontRegular, width);
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);
  const safeFileName = book.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const url = await uploadPdfToGithub(pdfBuffer, `${safeFileName}.pdf`);
  
  return url;
}

function addFooter(page: any, pageNum: number, font: any, width: number) {
    page.drawText(`Halaman ${pageNum}`, {
        x: (width - font.widthOfTextAtSize(`Halaman ${pageNum}`, 8)) / 2,
        y: 25,
        size: 8,
        font: font,
        color: rgb(0.6, 0.6, 0.6),
    });
}

function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const paragraphs = text.split('\n');
  const allLines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
        allLines.push("");
        continue;
    }

    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth) {
            allLines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    allLines.push(currentLine);
  }
  
  return allLines;
}

async function uploadPdfToGithub(buffer: Buffer, fileName: string): Promise<string> {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER;
  const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME;

  if (!GITHUB_TOKEN || !GITHUB_REPO_OWNER || !GITHUB_REPO_NAME) {
      throw new Error('Konfigurasi GitHub Storage tidak lengkap.');
  }

  const base64Content = buffer.toString('base64');
  const timestamp = Date.now();
  const filePath = `books/${timestamp}-${fileName}`;

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
  if (!response.ok) throw new Error(data.message || 'Gagal mengunggah ke GitHub.');

  return `https://raw.githubusercontent.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/main/${filePath}`;
}
