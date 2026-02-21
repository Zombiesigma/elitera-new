'use server';
/**
 * @fileOverview Alur AI khusus untuk membantu penulisan naskah film profesional.
 *
 * - screenplayHelper - Fungsi utama untuk membantu penulis naskah.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScreenplayHelperInputSchema = z.object({
  context: z.string().describe('Teks naskah yang sedang dikerjakan.'),
  task: z.enum(['summarize', 'naturalize_dialogue', 'suggest_plot']).describe('Tugas yang diinginkan.'),
});
export type ScreenplayHelperInput = z.infer<typeof ScreenplayHelperInputSchema>;

const ScreenplayHelperOutputSchema = z.object({
  result: z.string().describe('Hasil dari tugas AI.'),
});
export type ScreenplayHelperOutput = z.infer<typeof ScreenplayHelperOutputSchema>;

export async function screenplayHelper(
  input: ScreenplayHelperInput
): Promise<ScreenplayHelperOutput> {
  return screenplayHelperFlow(input);
}

const prompt = ai.definePrompt({
  name: 'screenplayHelperPrompt',
  input: {schema: ScreenplayHelperInputSchema},
  output: {schema: ScreenplayHelperOutputSchema},
  prompt: `Anda adalah asisten penulis naskah film profesional (Script Doctor).
  
Tugas Anda adalah: {{{task}}}

Berdasarkan naskah berikut:
"""
{{{context}}}
"""

PANDUAN TUGAS:
1. summarize: Ringkas adegan ini menjadi satu logline yang padat dan menarik.
2. naturalize_dialogue: Evaluasi dialognya. Jika kaku, berikan saran revisi agar terdengar lebih manusiawi dan subtekstual.
3. suggest_plot: Berikan 3 poin kemungkinan konflik atau aksi yang bisa terjadi selanjutnya dalam adegan ini.

Berikan jawaban dalam Bahasa Indonesia yang profesional namun kreatif.`,
});

const screenplayHelperFlow = ai.defineFlow(
  {
    name: 'screenplayHelperFlow',
    inputSchema: ScreenplayHelperInputSchema,
    outputSchema: ScreenplayHelperOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
