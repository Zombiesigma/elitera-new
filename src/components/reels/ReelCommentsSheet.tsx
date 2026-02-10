'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp, doc, increment, writeBatch, getDoc } from 'firebase/firestore';
import type { ReelComment, User } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, MessageSquare, Send, Sparkles, MessageCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { ReelCommentItem } from './ReelCommentItem';

interface ReelCommentsSheetProps {
  reelId: string;
  reelAuthorId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function ReelCommentsSheet({ reelId, reelAuthorId, isOpen, onOpenChange }: ReelCommentsSheetProps) {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
        setCommentText("");
        const timer = setTimeout(() => {
            document.body.style.pointerEvents = '';
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const commentsQuery = useMemo(() => (
    firestore ? query(collection(firestore, 'reels', reelId, 'comments'), orderBy('createdAt', 'desc')) : null
  ), [firestore, reelId]);

  const { data: comments, isLoading } = useCollection<ReelComment>(commentsQuery);

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser || !firestore || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const batch = writeBatch(firestore);
      const commentsCol = collection(firestore, 'reels', reelId, 'comments');
      const reelRef = doc(firestore, 'reels', reelId);

      const newComment = {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Pujangga Elitera',
        userAvatarUrl: currentUser.photoURL || '',
        text: commentText.trim(),
        likeCount: 0,
        replyCount: 0,
        createdAt: serverTimestamp()
      };

      batch.set(doc(commentsCol), newComment);
      batch.update(reelRef, { commentCount: increment(1) });

      await batch.commit();

      if (currentUser.uid !== reelAuthorId) {
          const authorDoc = await getDoc(doc(firestore, 'users', reelAuthorId));
          if (authorDoc.exists()) {
              const authorProfile = authorDoc.data() as User;
              if (authorProfile.notificationPreferences?.onReelComment !== false) {
                  addDoc(collection(firestore, 'users', reelAuthorId, 'notifications'), {
                      type: 'reel_comment',
                      text: `${currentUser.displayName} mengomentari video Reel Anda.`,
                      link: `/reels?id=${reelId}`,
                      actor: {
                          uid: currentUser.uid,
                          displayName: currentUser.displayName!,
                          photoURL: currentUser.photoURL!,
                      },
                      read: false,
                      createdAt: serverTimestamp()
                  }).catch(err => console.warn("Notif failed", err));
              }
          }
      }

      setCommentText("");
    } catch (error) {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Tidak dapat mengirim komentar.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] md:h-[75vh] flex flex-col rounded-t-[3rem] border-t-0 bg-background p-0 overflow-hidden z-[300] shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.3)]"
        onCloseAutoFocus={(e) => {
            e.preventDefault();
            document.body.style.pointerEvents = '';
        }}
      >
        <div className="mx-auto w-16 h-1.5 bg-muted rounded-full mt-4 shrink-0 opacity-50" />
        
        <SheetHeader className="px-8 pt-6 pb-6 text-left shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
                <div className="flex items-center gap-3 text-primary">
                    <div className="p-2.5 bg-primary/10 rounded-2xl">
                        <MessageCircle className="h-6 w-6" />
                    </div>
                    <SheetTitle className="text-2xl font-headline font-black tracking-tight">Diskusi Karya</SheetTitle>
                </div>
                <SheetDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                    {isLoading ? 'Menghubungkan pikiran...' : `${comments?.length || 0} Ulasan Pujangga`}
                </SheetDescription>
            </div>
            <div className="bg-primary/5 p-3 rounded-2xl hidden sm:block">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            </div>
          </div>
        </SheetHeader>

        <Separator className="opacity-50" />

        <div className="flex-1 overflow-y-auto custom-scrollbar bg-muted/5 p-6 md:p-8">
          <AnimatePresence mode="wait">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">Memuat Suara...</p>
                </div>
            ) : !comments || comments.length === 0 ? (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center h-full text-center p-12 opacity-30"
                >
                    <div className="bg-muted p-10 rounded-[2.5rem] mb-6 shadow-inner">
                        <MessageSquare className="h-16 w-16 text-muted-foreground" />
                    </div>
                    <h3 className="font-headline text-xl font-bold italic">Belum Ada Suara</h3>
                    <p className="text-sm max-w-[240px] mx-auto mt-2 leading-relaxed font-medium">Jadilah yang pertama memberikan apresiasi puitis pada video ini.</p>
                </motion.div>
            ) : (
                <div className="space-y-10 pb-24">
                {comments.map((comment) => (
                    <ReelCommentItem key={comment.id} reelId={reelId} comment={comment} />
                ))}
                </div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating Input Area */}
        <div className="p-6 pb-10 border-t bg-background/95 backdrop-blur-xl relative z-10">
            <form onSubmit={handleSendComment} className="flex items-center gap-3 relative max-w-4xl mx-auto group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 rounded-[1.5rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                <Input 
                    value={commentText} 
                    onChange={(e) => setCommentText(e.target.value)} 
                    placeholder="Tulis ulasan Anda yang memikat..." 
                    className="relative flex-1 h-14 rounded-2xl bg-muted/40 border-none px-6 font-medium text-sm focus-visible:ring-primary/20 focus-visible:bg-background transition-all shadow-inner"
                    disabled={isSubmitting}
                />
                <Button 
                    type="submit" 
                    size="icon" 
                    className="relative h-14 w-14 rounded-2xl bg-primary shadow-xl shadow-primary/30 transition-all active:scale-90"
                    disabled={isSubmitting || !commentText.trim()}
                >
                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
            </form>
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
