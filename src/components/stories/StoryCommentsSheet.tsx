'use client';

import { useMemo, useEffect } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { StoryComment } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, MessageCircle, Clock, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';

interface StoryCommentsSheetProps {
  storyId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function StoryCommentsSheet({ storyId, isOpen, onOpenChange }: StoryCommentsSheetProps) {
  const firestore = useFirestore();

  useEffect(() => {
    if (!isOpen) {
        const timer = setTimeout(() => {
            document.body.style.pointerEvents = '';
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const commentsQuery = useMemo(() => (
    firestore ? query(collection(firestore, 'stories', storyId, 'comments'), orderBy('createdAt', 'desc')) : null
  ), [firestore, storyId]);

  const { data: comments, isLoading } = useCollection<StoryComment>(commentsQuery);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[75vh] md:h-[65vh] flex flex-col rounded-t-[3rem] border-t-0 bg-background p-0 overflow-hidden z-[300] shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.3)]"
        onCloseAutoFocus={(e) => {
            e.preventDefault();
            document.body.style.pointerEvents = '';
        }}
      >
        <div className="mx-auto w-16 h-1.5 bg-muted rounded-full mt-4 shrink-0 opacity-50" />
        
        <SheetHeader className="px-8 pt-6 pb-6 text-left shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary">
                    <MessageCircle className="h-6 w-6" />
                    <SheetTitle className="text-2xl font-headline font-black tracking-tight">Apresiasi Momen</SheetTitle>
                </div>
                <SheetDescription className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    {isLoading ? 'Menyelaraskan suara...' : `${comments?.length || 0} komentar inspiratif`}
                </SheetDescription>
            </div>
            <div className="bg-primary/5 p-3 rounded-2xl">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </div>
          </div>
        </SheetHeader>

        <Separator className="opacity-50" />

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-muted/5">
          <AnimatePresence mode="wait">
            {isLoading ? (
                <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center h-full gap-4 opacity-40"
                >
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">Membuka Gulungan Pesan...</p>
                </motion.div>
            ) : !comments || comments.length === 0 ? (
                <motion.div 
                    key="empty"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center h-full text-center p-12 opacity-30"
                >
                    <div className="bg-muted p-8 rounded-[2rem] mb-6 shadow-inner">
                        <MessageCircle className="h-16 w-16 text-muted-foreground" />
                    </div>
                    <h3 className="font-headline text-xl font-bold italic">Hening Sekali...</h3>
                    <p className="text-sm max-w-[240px] mx-auto mt-2 leading-relaxed font-medium">Jadilah pujangga pertama yang memberikan kritik atau pujian pada momen ini.</p>
                </motion.div>
            ) : (
                <motion.div 
                    key="list"
                    initial="hidden"
                    animate="show"
                    variants={{
                        show: { transition: { staggerChildren: 0.05 } }
                    }}
                    className="divide-y divide-border/20"
                >
                {comments.map((comment) => (
                    <motion.div 
                        key={comment.id}
                        variants={{
                            hidden: { opacity: 0, x: -10 },
                            show: { opacity: 1, x: 0 }
                        }}
                        className="flex items-start gap-4 px-8 py-6 transition-colors hover:bg-muted/20"
                    >
                    <Avatar className="h-12 w-12 border-2 border-background shrink-0 shadow-lg transition-transform active:scale-90">
                        <AvatarImage src={comment.userAvatarUrl} className="object-cover" />
                        <AvatarFallback className="bg-primary/5 text-primary font-black">
                            {comment.userName?.charAt(0) || 'U'}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-1.5 pt-1">
                        <div className="flex items-center justify-between gap-2">
                            <p className="font-black text-sm truncate text-foreground/90">{comment.userName}</p>
                            <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-black uppercase tracking-widest shrink-0 opacity-60">
                                <Clock className="h-3 w-3" />
                                {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { locale: id, addSuffix: true }) : 'Baru saja'}
                            </div>
                        </div>
                        <p className="text-sm text-foreground/70 leading-relaxed font-medium bg-white/50 dark:bg-zinc-900/50 p-3 rounded-2xl rounded-tl-none border border-white/10 shadow-sm">
                            {comment.text}
                        </p>
                    </div>
                    </motion.div>
                ))}
                <div className="h-24" />
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </Sheet>
  );
}
