'use client';

import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Reel, User as AppUser } from '@/lib/types';
import { Loader2, Plus, Sparkles, Film, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateReelModal } from '@/components/reels/CreateReelModal';
import { ReelItem } from '@/components/reels/ReelItem';
import { motion, AnimatePresence } from 'framer-motion';

export function ReelsClient() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const searchParams = useSearchParams();
  const [isMuted, setIsMuted] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const reelIdFromUrl = searchParams.get('id');

  const { data: userProfile } = useDoc<AppUser>(
    firestore && currentUser ? doc(firestore, 'users', currentUser.uid) : null
  );

  const reelsQuery = useMemo(
    () =>
      firestore && currentUser
        ? query(collection(firestore, 'reels'), orderBy('createdAt', 'desc'))
        : null,
    [firestore, currentUser]
  );

  const { data: reels, isLoading } = useCollection<Reel>(reelsQuery);

  // Scroll ke reel spesifik dari URL
  useEffect(() => {
    if (reelIdFromUrl && !isLoading && reels) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`reel-${reelIdFromUrl}`);
        if (element) {
          element.scrollIntoView({ behavior: 'auto' });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [reelIdFromUrl, isLoading, reels]);

  // Deteksi slide aktif berdasarkan scroll snap
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    const index = Math.round(scrollTop / itemHeight);
    setActiveIndex(index);
  }, []);

  // Toggle mute global
  const toggleMute = () => setIsMuted((prev) => !prev);

  // Loading state dengan skeleton yang lebih estetik
  if (isLoading) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center gap-6 bg-zinc-950 overflow-hidden">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
          <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
        </div>
        <div className="text-center space-y-3">
          <p className="text-white font-black uppercase text-[10px] tracking-[0.3em] animate-pulse">
            Menyiapkan Panggung...
          </p>
          <p className="text-white/20 text-[8px] font-bold uppercase tracking-widest italic">
            Sinkronisasi Imajinasi
          </p>
        </div>
        {/* Skeleton reel */}
        <div className="w-full max-w-sm aspect-[9/16] rounded-2xl bg-white/5 animate-pulse relative overflow-hidden mt-4">
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh -mx-4 md:-mx-6 bg-black overflow-y-auto snap-y snap-mandatory no-scrollbar rounded-none shadow-2xl relative scroll-smooth">
      {/* Tombol plus di kiri atas */}
      <div className="fixed top-8 left-6 z-[110] flex items-center pointer-events-none">
        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.05)' }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsCreateModalOpen(true)}
          className="pointer-events-auto bg-white/[0.02] backdrop-blur-3xl border border-white/5 p-4 rounded-[2rem] text-white/40 hover:text-white transition-all shadow-2xl"
        >
          <Plus className="h-5 w-5" />
        </motion.button>
      </div>

      {/* Tombol mute global */}
      <div className="fixed top-8 right-6 z-[110] pointer-events-none">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleMute}
          className="pointer-events-auto bg-black/30 backdrop-blur-md p-3 rounded-full text-white/80 hover:text-white transition"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </motion.button>
      </div>

      <AnimatePresence>
        {reels && reels.length > 0 ? (
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="h-full snap-y snap-mandatory no-scrollbar"
          >
            {reels.map((reel, idx) => (
              <ReelItem
                key={reel.id}
                reel={reel}
                isActive={idx === activeIndex}
                isMuted={isMuted}
                onToggleMute={toggleMute}
                isPausedByModal={isCreateModalOpen}
              />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col items-center justify-center text-center p-8 gap-8 bg-zinc-950"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-150 animate-pulse" />
              <div className="p-10 rounded-[3.5rem] bg-white/5 border border-white/10 shadow-2xl relative z-10">
                <Film className="h-20 w-20 text-primary/20" />
              </div>
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-headline font-black text-white uppercase tracking-tight">
                Panggung <span className="text-primary italic">Hening.</span>
              </h2>
              <p className="text-white/40 max-w-xs mx-auto text-sm leading-relaxed font-medium">
                Belum ada mahakarya video yang diterbitkan. Jadilah pujangga pertama yang tampil di sini!
              </p>
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              size="lg"
              className="rounded-2xl px-10 h-14 font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
            >
              Mulai Berkarya <Sparkles className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <CreateReelModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        currentUserProfile={userProfile}
      />
    </div>
  );
    }
