import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ReelsClient } from '@/components/reels/ReelsClient';
import type { Metadata } from 'next';
import { getReelById } from '@/firebase/server-service';

type Props = {
  searchParams: Promise<{ id?: string }>;
};

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { id } = await searchParams;
  const brandLogo =
    'https://raw.githubusercontent.com/Zombiesigma/elitera-asset/main/uploads/1770617037724-WhatsApp_Image_2026-02-07_at_13.45.35.jpeg';

  if (!id) {
    return {
      title: 'Reels – Elitera',
      description:
        'Tonton momen puitis dan video kreatif dari para pujangga Elitera.',
      openGraph: {
        title: 'Reels – Elitera',
        description:
          'Tonton momen puitis dan video kreatif dari para pujangga Elitera.',
        images: [brandLogo],
      },
    };
  }

  const reel = await getReelById(id);

  if (!reel) {
    return {
      title: 'Video Tidak Ditemukan – Elitera',
    };
  }

  const title = `Karya Video oleh ${reel.authorName}`;
  const description = reel.caption || 'Saksikan momen puitis ini hanya di Elitera.';
  const ogImage = reel.thumbnailUrl || brandLogo;
  const ogVideo = reel.videoUrl;

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
          url: ogImage,
          width: 800,
          height: 800,
          alt: `Profil ${reel.authorName}`,
        },
      ],
      videos: [
        {
          url: ogVideo,
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
      images: [ogImage],
      players: [
        {
          playerUrl: ogVideo,
          streamUrl: ogVideo,
          width: 720,
          height: 1280,
        },
      ],
    },
  };
}

export default function ReelsPage() {
  return (
    <Suspense fallback={<ReelsLoadingSkeleton />}>
      <ReelsClient />
    </Suspense>
  );
}

function ReelsLoadingSkeleton() {
  return (
    <div className="h-[calc(100dvh-130px)] flex flex-col items-center justify-center gap-6 px-4">
      {/* Skeleton video */}
      <div className="w-full max-w-sm aspect-[9/16] rounded-2xl bg-muted/40 animate-pulse relative overflow-hidden">
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Skeleton teks */}
      <div className="space-y-3 w-full max-w-sm">
        <div className="h-4 w-3/4 rounded-full bg-muted/50 animate-pulse" />
        <div className="h-3 w-1/2 rounded-full bg-muted/40 animate-pulse" />
      </div>

      <Loader2 className="h-6 w-6 animate-spin text-primary/40 mt-4" />
      <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
        Menyiapkan reels...
      </p>
    </div>
  );
}      description,
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
