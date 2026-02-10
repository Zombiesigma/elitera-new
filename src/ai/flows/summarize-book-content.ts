'use server';

/**
 * @fileOverview Alur yang merangkum konten buku menggunakan Gemini API.
 *
 * - summarizeBookContent - Fungsi yang merangkum konten sebuah buku.
 * - SummarizeBookContentInput - Tipe input untuk fungsi summarizeBookContent.
 * - SummarizeBookContentOutput - Tipe kembalian untuk fungsi summarizeBookContent.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeBookContentInputSchema = z.object({
  bookContent: z
    .string()
    .describe('Konten buku yang akan diringkas.'),
});
export type SummarizeBookContentInput = z.infer<typeof SummarizeBookContentInputSchema>;

const SummarizeBookContentOutputSchema = z.object({
  summary: z
    .string()
    .describe('Ringkasan singkat dari konten buku.'),
});
export type SummarizeBookContentOutput = z.infer<typeof SummarizeBookContentOutputSchema>;

export async function summarizeBookContent(
  input: SummarizeBookContentInput
): Promise<SummarizeBookContentOutput> {
  return summarizeBookContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeBookContentPrompt',
  input: {schema: SummarizeBookContentInputSchema},
  output: {schema: SummarizeBookContentOutputSchema},
  prompt: `Ringkas konten buku berikut secara singkat:\n\n{{{bookContent}}}`,
});

const summarizeBookContentFlow = ai.defineFlow(
  {
    name: 'summarizeBookContentFlow',
    inputSchema: SummarizeBookContentInputSchema,
    outputSchema: SummarizeBookContentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
