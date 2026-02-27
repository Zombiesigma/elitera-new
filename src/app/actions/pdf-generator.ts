'use server';

import { PDFDocument as PDFLib, StandardFonts, rgb } from 'pdf-lib';
import { initializeFirebase } from '@/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import type { Book, Chapter, Shot, ScreenplayBlock, User } from '@/lib/types';

const PAGE_WIDTH = 595.28; 
const PAGE_HEIGHT = 841.89; 
const MARGIN = 72; 
const LEFT_MARGIN = 108; 

/**
 * Membersihkan string untuk digunakan sebagai nama folder kawan.
 */
function sanitizePath(str: string): string {
  return str.replace(/[^a-z0-9]/gi, '_').toLowerCase().trim();
}

export async function generateBookPdf(bookId: string): Promise<string> {
  const { firestore } = initializeFirebase();
  if (!firestore) throw new Error('Firestore not initialized');

  const bookRef = doc(firestore, 'books', bookId);
  const bookSnap = await getDoc(bookRef);
  if (!bookSnap.exists()) throw new Error('Book not found');
  const book = { id: bookSnap.id, ...bookSnap.data() } as Book;

  // Ambil data penulis industri kawan
  const authorUserRef = doc(firestore, 'users', book.authorId);
  const authorUserSnap = await getDoc(authorUserRef);
  const authorProfile = authorUserSnap.exists() ? authorUserSnap.data() as User : null;

  const chaptersQuery = query(collection(firestore, 'books', bookId, 'chapters'), orderBy('order', 'asc'));
  const chaptersSnap = await getDocs(chaptersQuery);
  const chapters = chaptersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Chapter));

  const pdfDoc = await PDFLib.create();
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontSerifBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const fontSerifRegular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontSerifItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);
  const fontMonoBold = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const fontMonoItalic = await pdfDoc.embedFont(StandardFonts.CourierOblique);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const { width, height } = page.getSize();

  // Draw Industry Border
  page.drawRectangle({
    x: 36, y: 36, width: width - 72, height: height - 72,
    borderColor: rgb(0.23, 0.51, 0.96), borderWidth: 1.5,
  });

  const titleFontSize = 36;
  const titleText = book.title.toUpperCase();
  const titleWidth = fontBold.widthOfTextAtSize(titleText, titleFontSize);
  
  page.drawText(titleText, {
    x: (width - Math.min(titleWidth, width - 120)) / 2,
    y: height - 280,
    size: titleFontSize,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
    maxWidth: width - 120,
    lineHeight: 42,
  });

  const authorIntro = 'Ditulis Oleh:';
  const authorIntroWidth = fontItalic.widthOfTextAtSize(authorIntro, 14);
  page.drawText(authorIntro, {
    x: (width - authorIntroWidth) / 2,
    y: height - 380,
    size: 14,
    font: fontItalic,
    color: rgb(0.4, 0.4, 0.4),
  });

  const authorName = book.authorName;
  const authorFontSize = 26;
  const authorWidth = fontBold.widthOfTextAtSize(authorName, authorFontSize);
  page.drawText(authorName, {
    x: (width - authorWidth) / 2,
    y: height - 415,
    size: authorFontSize,
    font: fontBold,
    color: rgb(0.23, 0.51, 0.96),
  });

  // Industry Contact Info - Bottom Left kawan
  if (authorProfile) {
    let contactY = 120;
    const contactFontSize = 10;
    const contactColor = rgb(0.3, 0.3, 0.3);

    const contactLines = [
      authorProfile.email,
      authorProfile.phoneNumber || '',
      authorProfile.domicile || ''
    ].filter(Boolean);

    contactLines.forEach(line => {
      page.drawText(line, {
        x: MARGIN,
        y: contactY,
        size: contactFontSize,
        font: fontRegular,
        color: contactColor,
      });
      contactY -= 14;
    });
  }

  const footerText = `Diterbitkan secara digital melalui ELITERA • ${new Date().getFullYear()}`;
  page.drawText(footerText, {
    x: (width - fontRegular.widthOfTextAtSize(footerText, 9)) / 2,
    y: 60,
    size: 9,
    font: fontRegular,
    color: rgb(0.6, 0.6, 0.6),
  });

  let pageCount = 1;

  for (const chapter of chapters) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageCount++;

    const isScreenplay = book.type === 'screenplay';
    const isPoem = book.type === 'poem';
    const currentMargin = isScreenplay ? LEFT_MARGIN : MARGIN;

    page.drawText('ELITERA DIGITAL LITERACY', { x: currentMargin, y: height - 40, size: 7, font: fontBold, color: rgb(0.7, 0.7, 0.7) });
    page.drawText(book.title.toUpperCase(), { x: width - MARGIN - fontRegular.widthOfTextAtSize(book.title.toUpperCase(), 7), y: height - 40, size: 7, font: fontRegular, color: rgb(0.7, 0.7, 0.7) });

    const chapterTitleX = (isScreenplay || isPoem) ? (width - (isPoem ? fontSerifBold : fontMonoBold).widthOfTextAtSize(chapter.title.toUpperCase(), 16)) / 2 : MARGIN;
    page.drawText(isScreenplay || isPoem ? chapter.title.toUpperCase() : chapter.title, {
      x: chapterTitleX,
      y: height - 90,
      size: (isScreenplay || isPoem) ? 16 : 22,
      font: isScreenplay ? fontMonoBold : isPoem ? fontSerifBold : fontSerifBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    let currentY = height - 130;
    const contentWidth = width - currentMargin - MARGIN;

    if (isScreenplay) {
      try {
        if (chapter.content.trim().startsWith('[') && chapter.content.trim().endsWith(']')) {
          const blocks: ScreenplayBlock[] = JSON.parse(chapter.content);
          let lastCharacterInScene: string | null = null;

          for (const block of blocks) {
            let x = currentMargin;
            let font = fontMono;
            let size = 12;
            let wrapWidth = contentWidth;
            let displayText = block.text;

            switch (block.type) {
              case 'slugline':
                font = fontMonoBold;
                currentY -= 20;
                lastCharacterInScene = null;
                break;
              case 'character':
                font = fontMonoBold;
                x = currentMargin + 158; 
                wrapWidth = contentWidth - 250;
                currentY -= 15;
                const cleanName = block.text.trim().toUpperCase();
                if (lastCharacterInScene === cleanName && cleanName !== "") {
                    displayText = `${cleanName} (CONT'D)`;
                } else {
                    lastCharacterInScene = cleanName;
                }
                break;
              case 'parenthetical':
                font = fontMonoItalic;
                x = currentMargin + 115; 
                wrapWidth = contentWidth - 200;
                break;
              case 'dialogue':
                x = currentMargin + 72; 
                wrapWidth = contentWidth - 144;
                break;
              case 'transition':
                font = fontMonoBold;
                x = width - MARGIN - fontMonoBold.widthOfTextAtSize(block.text.toUpperCase(), size);
                currentY -= 15;
                break;
            }

            const cleanText = block.type === 'parenthetical' ? `(${displayText})` : displayText;
            const wrappedLines = wrapText(cleanText, wrapWidth, font, size);
            for (const wLine of wrappedLines) {
              if (currentY < 70) {
                page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
                pageCount++;
                addFooter(page, pageCount, fontRegular, width);
                currentY = height - 60;
              }
              page.drawText(wLine, { x, y: currentY, size, font });
              currentY -= 14;
            }
          }
        }
      } catch (e) {}
    } else if (isPoem) {
      const paras = chapter.content.split('\n');
      for (const para of paras) {
        if (!para.trim()) {
            currentY -= 10;
            continue;
        }
        const size = 14;
        const font = fontSerifItalic;
        const wrappedLines = wrapText(para, contentWidth, font, size);
        for (const line of wrappedLines) {
          if (currentY < 70) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            pageCount++;
            addFooter(page, pageCount, fontRegular, width);
            currentY = height - 60;
          }
          const lineX = (width - font.widthOfTextAtSize(line, size)) / 2;
          page.drawText(line, { x: lineX, y: currentY, size, font });
          currentY -= 18;
        }
      }
    } else {
      const paras = chapter.content.split('\n');
      for (const para of paras) {
        const wrappedLines = wrapText(para, contentWidth, fontSerifRegular, 12);
        for (const line of wrappedLines) {
          if (currentY < 70) {
            page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            pageCount++;
            addFooter(page, pageCount, fontRegular, width);
            currentY = height - 60;
          }
          page.drawText(line, { x: MARGIN, y: currentY, size: 12, font: fontSerifRegular });
          currentY -= 16;
        }
        currentY -= 8;
      }
    }
    addFooter(page, pageCount, fontRegular, width);
  }

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);
  const safeFileName = `${sanitizePath(book.title)}.pdf`;
  
  const typeMap: Record<string, string> = {
    'book': 'books',
    'screenplay': 'naskah',
    'poem': 'puisi'
  };
  const typeFolder = typeMap[book.type] || 'books';
  const folderPath = `${typeFolder}/${sanitizePath(book.title)}`;

  return await uploadPdf(pdfBuffer, safeFileName, folderPath);
}

export async function generateShotListPdf(bookId: string): Promise<string> {
  const { firestore } = initializeFirebase();
  if (!firestore) throw new Error('Firestore not initialized');

  const bookRef = doc(firestore, 'books', bookId);
  const bookSnap = await getDoc(bookRef);
  if (!bookSnap.exists()) throw new Error('Book not found');
  const book = bookSnap.data() as Book;

  const shotsQuery = query(collection(firestore, 'books', bookId, 'shotList'), orderBy('number', 'asc'));
  const shotsSnap = await getDocs(shotsQuery);
  const shotList = shotsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Shot));

  const pdfDoc = await PDFLib.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const { width, height } = page.getSize();

  page.drawText('SHOT LIST PRODUKSI', {
    x: (width - fontBold.widthOfTextAtSize('SHOT LIST PRODUKSI', 20)) / 2,
    y: height - 60,
    size: 20,
    font: fontBold,
    color: rgb(0.96, 0.26, 0.21), 
  });

  page.drawText(`Karya: ${book.title.toUpperCase()}`, {
    x: (width - fontRegular.widthOfTextAtSize(`Karya: ${book.title.toUpperCase()}`, 12)) / 2,
    y: height - 85,
    size: 12,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  });

  let currentY = height - 130;
  const colWidths = [40, 40, 60, 80, 80, 150];
  const startX = (width - colWidths.reduce((a, b) => a + b, 0)) / 2;

  const headers = ['#', 'SC', 'TYPE', 'ANGLE', 'MOVE', 'DESCRIPTION'];
  let currentX = startX;
  
  page.drawRectangle({
      x: startX, y: currentY - 5, width: colWidths.reduce((a,b)=>a+b, 0), height: 20,
      color: rgb(0.95, 0.95, 0.95)
  });

  for (let i = 0; i < headers.length; i++) {
      page.drawText(headers[i], { x: currentX + 5, y: currentY, size: 9, font: fontBold });
      currentX += colWidths[i];
  }
  currentY -= 25;

  let pageCount = 1;
  for (const shot of shotList) {
      if (currentY < 60) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          pageCount++;
          addFooter(page, pageCount, fontRegular, width);
          currentY = height - 60;
      }

      currentX = startX;
      const rowData = [shot.number, shot.scene, shot.type, shot.angle, shot.movement, shot.description];
      
      for (let i = 0; i < rowData.length; i++) {
          const val = rowData[i] || "-";
          const wrapped = wrapText(val, colWidths[i] - 10, fontRegular, 8);
          page.drawText(wrapped[0] || "-", { x: currentX + 5, y: currentY, size: 8, font: fontRegular });
          currentX += colWidths[i];
      }
      
      page.drawLine({
          start: { x: startX, y: currentY - 5 },
          end: { x: startX + colWidths.reduce((a,b)=>a+b, 0), y: currentY - 5 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8)
      });
      
      currentY -= 20;
  }
  addFooter(page, pageCount, fontRegular, width);

  const pdfBytes = await pdfDoc.save();
  const safeFileName = `shot_list_${sanitizePath(book.title)}.pdf`;
  const folderPath = `naskah/${sanitizePath(book.title)}`;

  return await uploadPdf(Buffer.from(pdfBytes), safeFileName, folderPath);
}

async function uploadPdf(buffer: Buffer, fileName: string, folderPath: string): Promise<string> {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER;
  const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME;

  if (GITHUB_TOKEN && GITHUB_REPO_OWNER && GITHUB_REPO_NAME) {
    try {
      return await uploadPdfToGithub(buffer, fileName, folderPath, GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME);
    } catch (e) {
      console.warn("[PDF Generator] GitHub upload failed, falling back...");
    }
  }

  try {
    return await uploadToPublicService(buffer, fileName);
  } catch (e) {
    console.error("[PDF Generator] All upload methods failed:", e);
    throw new Error("Gagal mengunggah file PDF.");
  }
}

async function uploadPdfToGithub(buffer: Buffer, fileName: string, folderPath: string, token: string, owner: string, repo: string): Promise<string> {
  const base64Content = buffer.toString('base64');
  const timestamp = Date.now();
  const filePath = `${folderPath}/${timestamp}-${fileName}`;

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
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

  if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'GitHub Error');
  }

  return `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;
}

async function uploadToPublicService(buffer: Buffer, fileName: string): Promise<string> {
  const POMF_MIRRORS = ['https://pomf.lain.la/upload.php', 'https://quax.moe/upload.php', 'https://pomf.cat/upload.php'];
  for (const mirror of POMF_MIRRORS) {
    try {
      const formData = new FormData();
      const blob = new Blob([buffer], { type: 'application/pdf' });
      formData.append('files[]', blob, fileName);
      const response = await fetch(mirror, { method: 'POST', body: formData, signal: AbortSignal.timeout(30000) });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.files && data.files[0]) return data.files[0].url;
      }
    } catch (err) { continue; }
  }
  throw new Error("Public storage mirrors failed.");
}

function addFooter(page: any, pageNum: number, font: any, width: number) {
    page.drawText(`${pageNum}.`, { x: width - 60, y: PAGE_HEIGHT - 40, size: 10, font: font, color: rgb(0.1, 0.1, 0.1) });
}

function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  if (!text) return [""];
  const paragraphs = text.split('\n');
  const allLines: string[] = [];
  for (const para of paragraphs) {
    if (!para.trim()) { allLines.push(""); continue; }
    const words = para.split(/\s+/);
    let currentLine = '';
    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth) {
            allLines.push(currentLine);
            currentLine = word;
        } else { currentLine = testLine; }
    }
    allLines.push(currentLine);
  }
  return allLines;
}
