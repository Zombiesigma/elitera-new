'use server';
/**
 * @fileOverview Alur AI khusus untuk membantu penulisan prosa dan novel puitis.
 *
 * - novelHelper - Fungsi utama untuk membantu penulis novel dalam memperindah narasi.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const NovelHelperInputSchema = z.object({
  context: z.string().describe('Potongan narasi yang sedang dikerjakan.'),
  task: z.enum(['tone_polish', 'describe_scene', 'show_dont_tell']).describe('Tugas puitis yang diinginkan.'),
});
export type NovelHelperInput = z.infer<typeof NovelHelperInputSchema>;

const NovelHelperOutputSchema = z.object({
  result: z.string().describe('Hasil dari saran puitis AI.'),
});
export type NovelHelperOutput = z.infer<typeof NovelHelperOutputSchema>;

export async function novelHelper(
  input: NovelHelperInput
): Promise<NovelHelperOutput> {
  return novelHelperFlow(input);
}

const prompt = ai.definePrompt({
  name: 'novelHelperPrompt',
  input: {schema: NovelHelperInputSchema},
  output: {schema: NovelHelperOutputSchema},
  prompt: `Anda adalah Editor Sastra Elitera yang sangat ahli dalam estetika bahasa Indonesia.
  
Tugas Anda adalah: {{{task}}}

Berdasarkan potongan teks berikut:
"""
{{{context}}}
"""

PANDUAN TUGAS:
1. tone_polish: Perhalus diksi dan rima kalimat agar terdengar lebih puitis, elegan, dan mendalam namun tetap mudah dipahami.
2. describe_scene: Berikan saran penambahan deskripsi sensorik (suara, bau, suasana) untuk memperkuat latar dalam teks tersebut.
3. show_dont_tell: Jika ada kalimat yang terlalu lugas (tell), ubah menjadi narasi yang menunjukkan aksi atau perasaan (show) untuk membangkitkan emosi pembaca.

Berikan jawaban dalam Bahasa Indonesia yang sangat indah, inspiratif, dan siap digunakan oleh penulis.`,
});

const novelHelperFlow = ai.defineFlow(
  {
    name: 'novelHelperFlow',
    inputSchema: NovelHelperInputSchema,
    outputSchema: NovelHelperOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
