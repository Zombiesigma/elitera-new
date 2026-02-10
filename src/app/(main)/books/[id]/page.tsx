import { getBookById } from '@/firebase/server-service';
import type { Metadata, ResolvingMetadata } from 'next';
import BookDetailsClient from './BookDetailsClient';

type Props = {
  params: { id: string }
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const book = await getBookById(params.id);

  if (!book) {
    return {
      title: 'Buku Tidak Ditemukan',
    }
  }

  const previousImages = (await parent).openGraph?.images || [];

  return {
    title: book.title,
    description: book.synopsis,
    openGraph: {
      title: book.title,
      description: book.synopsis,
      images: [
        {
          url: book.coverUrl,
          width: 400,
          height: 600,
          alt: `Sampul buku ${book.title}`,
        },
        ...previousImages,
      ],
      type: 'book' as any,
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

// This is the page component that will be rendered.
// It renders the Client Component that contains all the interactive logic.
export default function BookDetailsPage({ params }: Props) {
  return <BookDetailsClient />;
}

    