'use client';

import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Reel, User as AppUser } from '@/lib/types';
import { Loader2, Plus, Sparkles, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateReelModal } from '@/components/reels/CreateReelModal';
import { ReelItem } from '@/components/reels/ReelItem';
import { motion, AnimatePresence } from 'framer-motion';

export function ReelsClient() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const searchParams = useSearchParams();
  const [isMuted] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const reelIdFromUrl = searchParams.get('id');

  const { data: userProfile } = useDoc<AppUser>(
    (firestore && currentUser) ? doc(firestore, 'users', currentUser.uid) : null
  );

  const reelsQuery = useMemo(() => (
    (firestore && currentUser) ? query(
      collection(firestore, 'reels'),
      orderBy('createdAt', 'desc')
    ) : null
  ), [firestore, currentUser]);

  const { data: reels, isLoading } = useCollection<Reel>(reelsQuery);

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

  if (isLoading) {
    return (
      <div className="h-[calc(100dvh-64px)] -mt-6 -mx-4 md:-mx-6 flex flex-col items-center justify-center gap-6 bg-zinc-950 overflow-hidden">
        <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
            <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
        </div>
        <div className="text-center space-y-2">
            <p className="text-white font-black uppercase text-[10px] tracking-[0.3em] animate-pulse">Menyiapkan Panggung...</p>
            <p className="text-white/20 text-[8px] font-bold uppercase tracking-widest italic">Sinkronisasi Imajinasi</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-64px)] -mt-6 -mx-4 md:-mx-6 bg-black overflow-y-auto snap-y snap-mandatory no-scrollbar rounded-none shadow-2xl relative scroll-smooth">
      
      {/* Floating Global Controls - Subtler Glassmorphism Plus Button */}
      <div className="fixed top-24 left-6 z-[110] flex items-center pointer-events-none">
          <motion.button 
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.05)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCreateModalOpen(true)}
            className="pointer-events-auto bg-white/[0.02] backdrop-blur-3xl border border-white/5 p-4 rounded-[2rem] text-white/20 hover:text-white/60 transition-all"
          >
            <Plus className="h-5 w-5" />
          </motion.button>
      </div>

      <AnimatePresence>
        {reels && reels.length > 0 ? (
            reels.map((reel) => (
            <ReelItem 
                key={reel.id} 
                reel={reel} 
                isMuted={isMuted} 
                onToggleMute={() => {}}
                isPausedByModal={isCreateModalOpen}
            />
            ))
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
                    <h2 className="text-3xl font-headline font-black text-white uppercase tracking-tight">Panggung <span className="text-primary italic">Hening.</span></h2>
                    <p className="text-white/40 max-w-xs mx-auto text-sm leading-relaxed font-medium">Belum ada mahakarya video yang diterbitkan. Jadilah pujangga pertama yang tampil di sini!</p>
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
