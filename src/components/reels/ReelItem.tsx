'use client';

import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc, increment, updateDoc, serverTimestamp, writeBatch, getDoc, collection, addDoc } from 'firebase/firestore';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Reel, ReelLike, User } from '@/lib/types';
import { Heart, MessageSquare, Share2, Sparkles, Loader2, Music2, Send as SendIcon, Play, Pause } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ReelCommentsSheet } from './ReelCommentsSheet';
import { ShareReelDialog } from './ShareReelDialog';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface ReelItemProps {
  reel: Reel;
  isMuted: boolean;
  onToggleMute: () => void;
  isPausedByModal?: boolean;
}

export function ReelItem({ reel, isMuted, onToggleMute, isPausedByModal = false }: ReelItemProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  
  const [isVisible, setIsVisible] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showPlayPauseAnim, setShowPlayPauseAnim] = useState<'play' | 'pause' | null>(null);
  const [progress, setProgress] = useState(0);
  
  const viewTracked = useRef(false);
  const lastClickTime = useRef(0);

  const likeRef = useMemo(() => (
    (firestore && currentUser) ? doc(firestore, 'reels', reel.id, 'likes', currentUser.uid) : null
  ), [firestore, currentUser, reel.id]);
  const { data: likeDoc } = useDoc<ReelLike>(likeRef);
  const isLiked = !!likeDoc;

  // Intersection Observer to track visibility
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting && !viewTracked.current && firestore && currentUser && currentUser.uid !== reel.authorId) {
            const reelRef = doc(firestore, 'reels', reel.id);
            const viewRef = doc(firestore, 'reels', reel.id, 'views', currentUser.uid);
            const batch = writeBatch(firestore);
            batch.update(reelRef, { viewCount: increment(1) });
            batch.set(viewRef, { viewedAt: serverTimestamp() });
            batch.commit().then(() => { viewTracked.current = true; });
        }
      },
      { threshold: 0.8 }
    );

    const currentRef = containerRef.current;
    if (currentRef) observer.observe(currentRef);
    return () => { if (currentRef) observer.unobserve(currentRef); };
  }, [firestore, currentUser, reel.id, reel.authorId]);

  // Unified Play/Pause logic: Pause if not visible, paused by modal, or manually paused
  useEffect(() => {
    if (!videoRef.current) return;

    if (isVisible && !isPausedByModal && !isPaused) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isVisible, isPausedByModal, isPaused]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const currentProgress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(currentProgress);
    }
  };

  const handleToggleLike = useCallback(async (forcedState?: boolean) => {
    if (!firestore || !currentUser || !likeRef || isLiking) return;
    
    if (forcedState === true && isLiked) {
        setShowHeartAnim(true);
        setTimeout(() => setShowHeartAnim(false), 1000);
        return;
    }

    setIsLiking(true);
    if (forcedState === true) {
        setShowHeartAnim(true);
        setTimeout(() => setShowHeartAnim(false), 1000);
    }
    
    const reelRef = doc(firestore, 'reels', reel.id);
    const batch = writeBatch(firestore);

    try {
      const willBeLiked = forcedState !== undefined ? forcedState : !isLiked;
      
      if (!willBeLiked && isLiked) {
        batch.delete(likeRef);
        batch.update(reelRef, { likes: increment(-1) });
      } else if (willBeLiked && !isLiked) {
        batch.set(likeRef, { userId: currentUser.uid, likedAt: serverTimestamp() });
        batch.update(reelRef, { likes: increment(1) });
      }
      
      await batch.commit();

      if (willBeLiked && !isLiked && currentUser.uid !== reel.authorId) {
          const authorDoc = await getDoc(doc(firestore, 'users', reel.authorId));
          if (authorDoc.exists()) {
              const authorProfile = authorDoc.data() as User;
              if (authorProfile.notificationPreferences?.onReelLike !== false) {
                  addDoc(collection(firestore, 'users', reel.authorId, 'notifications'), {
                      type: 'reel_like',
                      text: `${currentUser.displayName} menyukai video Reel Anda.`,
                      link: `/reels?id=${reel.id}`,
                      actor: {
                          uid: currentUser.uid,
                          displayName: currentUser.displayName!,
                          photoURL: currentUser.photoURL!,
                      },
                      read: false,
                      createdAt: serverTimestamp()
                  }).catch(err => console.warn("Notification failed", err));
              }
          }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLiking(false);
    }
  }, [firestore, currentUser, likeRef, isLiking, isLiked, reel.id, reel.authorId]);

  const handleScreenClick = (e: React.MouseEvent) => {
    const now = Date.now();
    const DOUBLE_CLICK_DELAY = 300;
    
    if (now - lastClickTime.current < DOUBLE_CLICK_DELAY) {
        handleToggleLike(true);
    } else {
        if (videoRef.current) {
            if (isPaused) {
                videoRef.current.play();
                setIsPaused(false);
                setShowPlayPauseAnim('play');
            } else {
                videoRef.current.pause();
                setIsPaused(true);
                setShowPlayPauseAnim('pause');
            }
            setTimeout(() => setShowPlayPauseAnim(null), 800);
        }
    }
    lastClickTime.current = now;
  };

  const handleExternalShare = async () => {
    const shareUrl = `${window.location.origin}/reels?id=${reel.id}`;
    const shareData = {
      title: `Karya Video ${reel.authorName} di Elitera`,
      text: reel.caption || 'Saksikan momen puitis ini di Elitera!',
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          await navigator.clipboard.writeText(shareUrl);
          toast({ variant: 'success', title: 'Tautan Disalin' });
        }
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast({ variant: 'success', title: 'Tautan Disalin' });
    }
  };

  const profileHref = useMemo(() => {
      const slug = reel.authorName.toLowerCase().replace(/\s+/g, '');
      return `/profile/${slug}`;
  }, [reel.authorName]);

  return (
    <div 
      ref={containerRef}
      id={`reel-${reel.id}`}
      className="h-full w-full snap-start snap-always relative bg-black flex flex-col items-center justify-center overflow-hidden shrink-0"
    >
      {/* Main Video Layer */}
      <video
        ref={videoRef}
        src={reel.videoUrl}
        className="h-full w-full object-cover"
        loop
        playsInline
        muted={isMuted}
        onClick={handleScreenClick}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Play/Pause Animation */}
      <AnimatePresence>
        {showPlayPauseAnim && (
            <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1.5, opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
            >
                <div className="bg-black/20 backdrop-blur-md p-6 rounded-full border border-white/10">
                    {showPlayPauseAnim === 'play' ? <Play className="w-12 h-12 text-white fill-white" /> : <Pause className="w-12 h-12 text-white fill-white" />}
                </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Double Tap Heart Animation */}
      <AnimatePresence>
        {showHeartAnim && (
            <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
            >
                <Heart className="w-32 h-32 text-white fill-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
            </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />

      {/* Right Interaction Sidebar */}
      <div className="absolute right-4 bottom-28 flex flex-col items-center gap-5 z-[105]">
        <div className="flex flex-col items-center gap-1">
            <motion.button 
                whileTap={{ scale: 0.8 }}
                onClick={() => handleToggleLike()}
                disabled={isLiking}
                className={cn(
                    "h-12 w-12 rounded-full backdrop-blur-xl border flex items-center justify-center transition-all shadow-2xl",
                    isLiked 
                        ? "bg-rose-500 border-rose-400 text-white shadow-rose-500/40" 
                        : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                )}
            >
                {isLiking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Heart className={cn("h-6 w-6 transition-transform", isLiked && "fill-current scale-110")} />}
            </motion.button>
            <span className="text-[11px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(reel.likes || 0)}
            </span>
        </div>

        <div className="flex flex-col items-center gap-1">
            <motion.button 
                whileTap={{ scale: 0.8 }}
                onClick={() => setShowComments(true)}
                className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white transition-all hover:bg-white/20 shadow-2xl"
            >
                <MessageSquare className="h-6 w-6" />
            </motion.button>
            <span className="text-[11px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(reel.commentCount || 0)}
            </span>
        </div>

        <div className="flex flex-col items-center gap-4">
            <motion.button 
                whileTap={{ scale: 0.8 }}
                onClick={() => setShowShare(true)}
                className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white transition-all hover:bg-primary/40 shadow-2xl"
            >
                <SendIcon className="h-5 w-5 ml-0.5" />
            </motion.button>
            <motion.button 
                whileTap={{ scale: 0.8 }}
                onClick={handleExternalShare}
                className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white transition-all hover:bg-emerald-500/40 shadow-2xl"
            >
                <Share2 className="h-5 w-5" />
            </motion.button>
        </div>
        
        {/* Animated Music Disk */}
        <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="h-10 w-10 rounded-full border-2 border-white/20 bg-zinc-900 p-1 flex items-center justify-center shadow-2xl mt-2 overflow-hidden"
        >
            <Avatar className="h-full w-full">
                <AvatarImage src={reel.authorAvatarUrl} className="object-cover" />
                <AvatarFallback><Music2 className="h-4 w-4 text-white/40" /></AvatarFallback>
            </Avatar>
        </motion.div>
      </div>

      {/* Bottom Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pb-12 space-y-4 z-[100] pointer-events-none">
        <div className="flex flex-col items-start gap-4 max-w-[85%]">
            <div className="flex items-center gap-3 pointer-events-auto">
                <Link href={profileHref} className="group flex items-center gap-3">
                    <div className="relative">
                        <Avatar className="h-11 w-11 border-2 border-white/40 shadow-2xl transition-transform group-hover:scale-110">
                            <AvatarImage src={reel.authorAvatarUrl} className="object-cover" />
                            <AvatarFallback className="bg-primary text-white font-black">{reel.authorName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 bg-primary text-white p-0.5 rounded-full ring-2 ring-black shadow-lg">
                            <Sparkles className="h-3 w-3" />
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <p className="text-white font-black text-sm tracking-tight group-hover:text-primary transition-colors drop-shadow-md">
                            {reel.authorName}
                        </p>
                        <p className="text-[9px] text-white/60 font-bold uppercase tracking-widest drop-shadow-sm">
                            {reel.createdAt ? formatDistanceToNow(reel.createdAt.toDate(), { locale: id, addSuffix: true }) : 'Baru saja'}
                        </p>
                    </div>
                </Link>
                
                <button className="pointer-events-auto bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all ml-2 shadow-xl">
                    Ikuti
                </button>
            </div>

            <p className="text-white text-[15px] font-medium leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] line-clamp-3 italic">
                {reel.caption || "Momen puitis di Elitera."}
            </p>

            <div className="flex items-center gap-3 text-white/70 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5 max-w-full overflow-hidden shadow-inner">
                <Music2 className="h-3 w-3 shrink-0" />
                <div className="overflow-hidden flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap animate-marquee">
                        Suara Asli - {reel.authorName} • {reel.caption?.substring(0, 30) || 'Karya Elitera'} • {reel.authorName}
                    </p>
                </div>
            </div>
        </div>
      </div>

      {/* Progress Bar at the absolute bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-[110]">
          <motion.div 
            className="h-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.8)]"
            style={{ width: `${progress}%` }}
          />
      </div>

      {/* Sheets & Dialogs */}
      <ReelCommentsSheet 
        reelId={reel.id} 
        reelAuthorId={reel.authorId} 
        isOpen={showComments} 
        onOpenChange={setShowComments} 
      />
      <ShareReelDialog 
        reel={reel} 
        open={showShare} 
        onOpenChange={setShowShare} 
      />

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 15s linear infinite;
          padding-right: 50px;
        }
      `}</style>
    </div>
  );
}
