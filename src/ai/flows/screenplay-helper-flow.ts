'use server';
/**
 * @fileOverview Alur AI khusus untuk membantu penulisan puisi dan sajak indah.
 *
 * - poetryHelper - Fungsi utama untuk membantu penyair dalam memperkuat rima dan metafora.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';

const PoetryHelperInputSchema = z.object({
  context: z.string().describe('Bait puisi yang sedang dikerjakan.'),
  task: z.enum(['rhyme_polish', 'deepen_metaphor', 'emotional_boost']).describe('Tugas puitis yang diinginkan.'),
});
export type PoetryHelperInput = z.infer<typeof PoetryHelperInputSchema>;

const PoetryHelperOutputSchema = z.object({
  result: z.string().describe('Hasil dari saran puitis AI.'),
});
export type PoetryHelperOutput = z.infer<typeof PoetryHelperOutputSchema>;

export async function poetryHelper(
  input: PoetryHelperInput
): Promise<PoetryHelperOutput> {
  return poetryHelperFlow(input);
}

const prompt = ai.definePrompt({
  name: 'poetryHelperPrompt',
  input: {schema: PoetryHelperInputSchema},
  output: {schema: PoetryHelperOutputSchema},
  prompt: `Anda adalah Maestro Puisi Elitera yang sangat ahli dalam estetika sajak Indonesia.
  
Tugas Anda adalah: {{{task}}}

Berdasarkan bait puisi berikut:
"""
{{{context}}}
"""

PANDUAN TUGAS:
1. rhyme_polish: Periksa rima dan aliterasi. Berikan saran kata yang memiliki rima akhir yang lebih indah namun tetap bermakna dalam.
2. deepen_metaphor: Cari kata-kata yang terlalu harfiah dan ubah menjadi metafora atau personifikasi yang kuat dan puitis.
3. emotional_boost: Perkuat suasana emosional (sedih, gembira, rindu, marah) dengan pemilihan diksi yang lebih menggugah perasaan.

Berikan jawaban dalam Bahasa Indonesia yang sangat indah, tenang, dan inspiratif. Tunjukkan jiwa penyair sejati.`,
});

const poetryHelperFlow = ai.defineFlow(
  {
    name: 'poetryHelperFlow',
    inputSchema: PoetryHelperInputSchema,
    outputSchema: PoetryHelperOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
