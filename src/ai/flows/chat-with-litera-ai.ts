'use server';
/**
 * @fileOverview Alur chatbot Elitera AI yang canggih dengan dukungan Markdown dan riwayat percakapan.
 *
 * - chatWithEliteraAI - Fungsi utama untuk berinteraksi dengan asisten Elitera.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ChatWithEliteraAIInputSchema = z.object({
  userName: z.string().describe('Nama pengguna yang sedang mengobrol.'),
  message: z.string().describe('Pesan dari pengguna.'),
  chatHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        content: z.string(),
      })
    )
    .optional()
    .describe('Riwayat obrolan sebelumnya untuk konteks.'),
});
export type ChatWithEliteraAIInput = z.infer<typeof ChatWithEliteraAIInputSchema>;

const ChatWithEliteraAIOutputSchema = z.object({
  response: z.string().describe('Respons cerdas dari Elitera AI.'),
});
export type ChatWithEliteraAIOutput = z.infer<
  typeof ChatWithEliteraAIOutputSchema
>;

export async function chatWithEliteraAI(
  input: ChatWithEliteraAIInput
): Promise<ChatWithEliteraAIOutput> {
  return chatWithEliteraAIFlow(input);
}

const chatWithEliteraAIFlow = ai.defineFlow(
  {
    name: 'chatWithEliteraAIFlow',
    inputSchema: ChatWithEliteraAIInputSchema,
    outputSchema: ChatWithEliteraAIOutputSchema,
  },
  async input => {
    // Transform riwayat pesan ke format pesan Genkit
    const history = (input.chatHistory || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model' as any,
      content: [{ text: msg.content }]
    }));

    const response = await ai.generate({
      system: `Anda adalah Elitera AI, asisten virtual cerdas di ekosistem Elitera. 
  
      IDENTITAS ANDA:
      - Nama: Elitera AI.
      - Pengembang: Guntur Padilah (https://www.gunturpadilah.web.id/).
      - Karakter: Ramah, inspiratif, berwawasan luas tentang literasi, dan sangat membantu.
      - Bahasa: Indonesia (dengan nada yang sopan namun santai dan menyemangati).

      FORMAT RESPONS:
      - Gunakan **Markdown** untuk memperindah jawaban Anda.
      - Gunakan **teks tebal** untuk poin penting.
      - Gunakan *bullet points* untuk daftar saran atau langkah-langkah.
      - Gunakan > blockquote untuk kutipan inspiratif atau kutipan buku.
      - Jika memberikan contoh kode atau struktur draf, gunakan blok kode (code blocks).

      MISI ANDA:
      Membantu pengguna Elitera (penulis dan pembaca) dalam:
      1. **Inspirasi Menulis**: Memberikan ide plot, membantu mengatasi hambatan menulis (writer's block), atau memberikan saran tata bahasa.
      2. **Rekomendasi Buku**: Menyarankan genre atau jenis cerita yang populer di Elitera.
      3. **Panduan Fitur**: Menjelaskan cara kerja Story, unggah buku, sistem verifikasi penulis, dan pesan langsung.
      4. **Analisis Cerita**: Jika ditanya tentang draf, berikan kritik konstruktif yang membangun.

      KONTEKS PENGGUNA:
      Anda sedang mengobrol dengan ${input.userName}. Jika ini adalah awal percakapan, sapalah mereka dengan hangat. Jika ini adalah kelanjutan dari riwayat obrolan, langsung bantu mereka berdasarkan konteks yang ada.

      PANDUAN RESPONS:
      - Gunakan emoji sesekali untuk menjaga keramahan.
      - Berikan jawaban yang terstruktur rapi.
      - Jika pengguna bertanya hal di luar Elitera, tetap bantu dengan bijak tetapi kaitkan kembali dengan konteks literasi jika memungkinkan.`,
      messages: [
        ...history,
        { role: 'user', content: [{ text: input.message }] }
      ],
    });

    return { response: response.text };
  }
);
