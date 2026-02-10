import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ReelsClient } from '@/components/reels/ReelsClient';
import type { Metadata } from 'next';
import { getReelById } from '@/firebase/server-service';

type Props = {
  searchParams: Promise<{ id?: string }>;
};

/**
 * Generate dynamic metadata for Reels when shared.
 * This ensures a rich preview card appears on social platforms.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { id } = await searchParams;
  const brandLogo = 'https://raw.githubusercontent.com/Zombiesigma/elitera-asset/main/uploads/1770617037724-WhatsApp_Image_2026-02-07_at_13.45.35.jpeg';

  if (!id) {
    return {
      title: 'Reels - Elitera',
      description: 'Tonton momen puitis dan video kreatif dari para pujangga Elitera.',
    };
  }

  const reel = await getReelById(id);

  if (!reel) {
    return {
      title: 'Video Tidak Ditemukan - Elitera',
    };
  }

  const title = `Karya Video oleh ${reel.authorName}`;
  const description = reel.caption || 'Saksikan momen puitis ini hanya di Elitera.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://www.litera.my.id/reels?id=${reel.id}`,
      siteName: 'Elitera',
      images: [
        {
          url: brandLogo,
          width: 800,
          height: 800,
          alt: `Profil ${reel.authorName}`,
        },
      ],
      videos: [
        {
          url: reel.videoUrl,
          width: 720,
          height: 1280,
        },
      ],
      type: 'video.other',
    },
    twitter: {
      card: 'player',
      title,
      description,
      images: [brandLogo],
      players: [
        {
          playerUrl: reel.videoUrl,
          streamUrl: reel.videoUrl,
          width: 720,
          height: 1280,
        },
      ],
    },
  };
}

export default function ReelsPage() {
  return (
    <Suspense fallback={
      <div className="h-[calc(100dvh-130px)] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
        <p className="text-muted-foreground font-black uppercase text-[10px] tracking-widest">Sinkronisasi...</p>
      </div>
    }>
      <ReelsClient />
    </Suspense>
  );
}
