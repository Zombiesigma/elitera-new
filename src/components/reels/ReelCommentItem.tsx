
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { doc, collection, serverTimestamp, query, orderBy, increment, writeBatch } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Heart, MessageSquare, Send, Loader2, CornerDownRight } from 'lucide-react';
import type { ReelComment, ReelCommentLike } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ReelCommentItemProps {
    reelId: string;
    comment: ReelComment;
}

export function ReelCommentItem({ reelId, comment }: ReelCommentItemProps) {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [isLiking, setIsLiking] = useState(false);

    // Like logic
    const likeRef = useMemo(() => (
        (firestore && currentUser) ? doc(firestore, 'reels', reelId, 'comments', comment.id, 'likes', currentUser.uid) : null
    ), [firestore, currentUser, reelId, comment.id]);
    const { data: likeDoc } = useDoc<ReelCommentLike>(likeRef);
    const isLiked = !!likeDoc;
    
    const handleToggleLike = async () => {
        if (!likeRef || !firestore || !currentUser) {
            toast({ variant: 'destructive', title: 'Harap Masuk', description: 'Anda harus masuk untuk menyukai komentar.' });
            return;
        }
        setIsLiking(true);
        const commentRef = doc(firestore, 'reels', reelId, 'comments', comment.id);
        const batch = writeBatch(firestore);

        try {
            if (isLiked) {
                batch.delete(likeRef);
                batch.update(commentRef, { likeCount: increment(-1) });
            } else {
                batch.set(likeRef, { userId: currentUser.uid, likedAt: serverTimestamp() });
                batch.update(commentRef, { likeCount: increment(1) });
            }
            await batch.commit();
        } catch (error) {
            console.error("Error toggling reel comment like:", error);
        } finally {
            setIsLiking(false);
        }
    };

    // Replies logic
    const repliesQuery = useMemo(() => (
        firestore ? query(collection(firestore, 'reels', reelId, 'comments', comment.id, 'replies'), orderBy('createdAt', 'asc')) : null
    ), [firestore, reelId, comment.id]);
    const { data: replies } = useCollection<ReelComment>(repliesQuery);

    const handleReplySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !currentUser || !firestore) return;

        setIsSubmittingReply(true);
        const commentRef = doc(firestore, 'reels', reelId, 'comments', comment.id);
        const repliesCol = collection(commentRef, 'replies');
        
        const replyData = {
            text: replyText.trim(),
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Pujangga Elitera',
            userAvatarUrl: currentUser.photoURL || '',
            likeCount: 0,
            replyCount: 0,
            createdAt: serverTimestamp(),
        };

        const batch = writeBatch(firestore);
        batch.set(doc(repliesCol), replyData);
        batch.update(commentRef, { replyCount: increment(1) });

        try {
            await batch.commit();
            setReplyText('');
            setShowReplyInput(false);
            toast({ title: "Balasan Terkirim" });
        } catch (error) {
            console.error("Error submitting reel reply:", error);
            toast({ variant: 'destructive', title: "Gagal Mengirim" });
        } finally {
            setIsSubmittingReply(false);
        }
    };

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col"
        >
            <div className="flex items-start gap-4">
                <Avatar className="h-10 w-10 border-2 border-background shrink-0 shadow-sm">
                    <AvatarImage src={comment.userAvatarUrl} className="object-cover" />
                    <AvatarFallback className="bg-primary/5 text-primary font-black">
                        {comment.userName?.charAt(0) || 'U'}
                    </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="bg-white/50 dark:bg-zinc-900/50 p-4 rounded-2xl rounded-tl-none border border-white/10 shadow-sm group hover:shadow-md transition-all">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                            <p className="font-black text-sm truncate text-foreground/90">{comment.userName}</p>
                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                                {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { locale: id, addSuffix: true }) : 'Baru saja'}
                            </span>
                        </div>
                        <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-blockquote:border-l-2 prose-blockquote:pl-3 prose-p:m-0 max-w-none text-foreground/80 font-medium">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {comment.text}
                            </ReactMarkdown>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 pl-2">
                        <button 
                            onClick={handleToggleLike}
                            disabled={isLiking}
                            className={cn(
                                "flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                                isLiked ? "text-rose-500" : "text-muted-foreground hover:text-primary"
                            )}
                        >
                            <Heart className={cn("h-3.5 w-3.5", isLiked && "fill-current")} />
                            <span>{comment.likeCount || 0}</span>
                        </button>
                        
                        <button 
                            onClick={() => setShowReplyInput(!showReplyInput)}
                            className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
                        >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>{comment.replyCount || 0} Balas</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Reply Input */}
            <AnimatePresence>
                {showReplyInput && currentUser && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <form onSubmit={handleReplySubmit} className="flex items-start gap-3 pl-14 pt-4 pr-4">
                            <div className="shrink-0 mt-3"><CornerDownRight className="h-4 w-4 text-muted-foreground/40" /></div>
                            <div className="relative flex-1 group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                <Textarea 
                                    placeholder={`Balas ulasan ${comment.userName}...`}
                                    className="relative w-full min-h-[80px] bg-muted/30 border-none shadow-none focus-visible:ring-primary/20 text-sm rounded-xl py-3 px-4 resize-none pr-12"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    disabled={isSubmittingReply}
                                />
                                <Button 
                                    type="submit"
                                    size="icon" 
                                    className="absolute bottom-2 right-2 h-8 w-8 rounded-lg shadow-lg" 
                                    disabled={isSubmittingReply || !replyText.trim()}
                                >
                                    {isSubmittingReply ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Nested Replies List */}
            {replies && replies.length > 0 && (
                <div className="pl-14 pt-6 space-y-6 relative border-l-2 border-border/20 ml-5 mt-2">
                    {replies.map(reply => (
                        <motion.div 
                            key={reply.id} 
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-start gap-3"
                        >
                            <Avatar className="h-8 w-8 border-2 border-background shrink-0 shadow-sm">
                                <AvatarImage src={reply.userAvatarUrl} className="object-cover" />
                                <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">
                                    {reply.userName?.charAt(0) || 'U'}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="bg-muted/30 p-3.5 rounded-2xl rounded-tl-none border border-border/10">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <p className="font-black text-xs truncate text-foreground/80">{reply.userName}</p>
                                        <span className="text-[8px] uppercase font-bold tracking-widest text-muted-foreground opacity-50">
                                            {reply.createdAt ? formatDistanceToNow(reply.createdAt.toDate(), { locale: id, addSuffix: true }) : 'Baru saja'}
                                        </span>
                                    </div>
                                    <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-p:m-0 max-w-none text-foreground/70">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {reply.text}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}
