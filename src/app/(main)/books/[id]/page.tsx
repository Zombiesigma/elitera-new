import { getBookById } from '@/firebase/server-service';
import type { Metadata, ResolvingMetadata } from 'next';
import BookDetailsClient from './BookDetailsClient';
import { notFound } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }>
}

/**
 * Generate SEO Metadata for social sharing (OpenGraph/Twitter).
 */
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { id } = await params;
  const book = await getBookById(id);

  if (!book) {
    return {
      title: 'Karya Tidak Ditemukan',
    }
  }

  const previousImages = (await parent).openGraph?.images || [];

  return {
    title: book.title,
    description: book.synopsis,
    openGraph: {
      title: `${book.title} oleh ${book.authorName}`,
      description: book.synopsis,
      images: [
        {
          url: book.coverUrl,
          width: 800,
          height: 1200,
          alt: `Sampul Mahakarya: ${book.title}`,
        },
        ...previousImages,
      ],
      type: 'book',
      authors: [book.authorName],
    },
    twitter: {
      card: 'summary_large_image',
      title: book.title,
      description: book.synopsis,
      images: [book.coverUrl],
    },
  }
}

/**
 * Main Book Details Page.
 * Server component that delegates interactivity to BookDetailsClient.
 */
export default async function BookDetailsPage({ params }: Props) {
  const { id } = await params;
  
  // Preliminary server-side check
  const book = await getBookById(id);
  if (!book) notFound();

  return <BookDetailsClient />;
}
