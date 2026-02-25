'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { doc, collection, serverTimestamp, query, orderBy, increment, writeBatch } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Heart, MessageSquare, Send, Loader2, CornerDownRight, Reply } from 'lucide-react';
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
    parentPath: string; 
    depth?: number;     
}

export function ReelCommentItem({ reelId, comment, parentPath, depth = 0 }: ReelCommentItemProps) {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [isLiking, setIsLiking] = useState(false);

    const currentCommentRefPath = `${parentPath}/${comment.id}`;
    const repliesPath = `${currentCommentRefPath}/replies`;

    const likeRef = useMemo(() => (
        (firestore && currentUser) ? doc(firestore, `${currentCommentRefPath}/likes`, currentUser.uid) : null
    ), [firestore, currentUser, currentCommentRefPath]);
    
    const { data: likeDoc } = useDoc<ReelCommentLike>(likeRef);
    const isLiked = !!likeDoc;
    
    const handleToggleLike = async () => {
        if (!likeRef || !firestore || !currentUser) {
            toast({ variant: 'destructive', title: 'Harap Masuk', description: 'Anda harus masuk untuk menyukai komentar.' });
            return;
        }
        setIsLiking(true);
        const commentRef = doc(firestore, currentCommentRefPath);
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
            console.error("Error toggling like:", error);
        } finally {
            setIsLiking(false);
        }
    };

    const repliesQuery = useMemo(() => (
        firestore ? query(collection(firestore, repliesPath), orderBy('createdAt', 'asc')) : null
    ), [firestore, repliesPath]);
    
    const { data: replies } = useCollection<ReelComment>(repliesQuery);

    const handleReplySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !currentUser || !firestore) return;

        setIsSubmittingReply(true);
        const commentRef = doc(firestore, currentCommentRefPath);
        const repliesCol = collection(firestore, repliesPath);
        
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
            console.error("Error submitting reply:", error);
            toast({ variant: 'destructive', title: "Gagal Mengirim" });
        } finally {
            setIsSubmittingReply(false);
        }
    };

    const maxDepth = 3;
    const currentDepth = depth > maxDepth ? maxDepth : depth;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn("flex flex-col", depth > 0 && "mt-4")}
        >
            <div className="flex items-start gap-3 md:gap-4">
                <Avatar className="h-8 w-8 md:h-10 md:w-10 border-2 border-background shrink-0 shadow-sm">
                    <AvatarImage src={comment.userAvatarUrl} className="object-cover" />
                    <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">
                        {comment.userName?.charAt(0) || 'U'}
                    </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="bg-white/50 dark:bg-zinc-900/50 p-3 md:p-4 rounded-2xl rounded-tl-none border border-white/10 shadow-sm group hover:shadow-md transition-all">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="font-black text-xs md:text-sm truncate text-foreground/90">{comment.userName}</p>
                            <span className="text-[8px] md:text-[9px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                                {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { locale: id, addSuffix: true }) : 'Baru saja'}
                            </span>
                        </div>
                        <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-p:m-0 max-w-none text-foreground/80 font-medium text-[13px] md:text-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {comment.text}
                            </ReactMarkdown>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4 pl-1">
                        <button 
                            onClick={handleToggleLike}
                            disabled={isLiking}
                            className={cn(
                                "flex items-center gap-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all",
                                isLiked ? "text-rose-500" : "text-muted-foreground hover:text-primary"
                            )}
                        >
                            <Heart className={cn("h-3 w-3 md:h-3.5 md:w-3.5", isLiked && "fill-current")} />
                            <span>{comment.likeCount || 0}</span>
                        </button>
                        
                        <button 
                            onClick={() => setShowReplyInput(!showReplyInput)}
                            className="flex items-center gap-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
                        >
                            <Reply className="h-3 w-3 md:h-3.5 md:w-3.5" />
                            <span>{comment.replyCount || 0}</span>
                        </button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showReplyInput && currentUser && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <form onSubmit={handleReplySubmit} className="flex items-start gap-2 pl-10 md:pl-14 pt-3 pr-2">
                            <div className="shrink-0 mt-3"><CornerDownRight className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground/40" /></div>
                            <div className="relative flex-1 group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                <Textarea 
                                    placeholder={`Balas ${comment.userName}...`}
                                    className="relative w-full min-h-[60px] md:min-h-[80px] bg-muted/30 border-none shadow-none focus-visible:ring-primary/20 text-xs md:text-sm rounded-xl py-2 px-3 md:py-3 md:px-4 resize-none pr-10"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    disabled={isSubmittingReply}
                                />
                                <Button 
                                    type="submit"
                                    size="icon" 
                                    className="absolute bottom-1.5 right-1.5 h-7 w-7 md:h-8 md:w-8 rounded-lg shadow-lg" 
                                    disabled={isSubmittingReply || !replyText.trim()}
                                >
                                    {isSubmittingReply ? <Loader2 className="h-3 w-3 md:h-4 md:w-4 animate-spin"/> : <Send className="h-3 w-3 md:h-4 md:w-4"/>}
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {replies && replies.length > 0 && (
                <div className={cn(
                    "pl-6 md:pl-10 mt-2 relative",
                    depth < maxDepth && "border-l-2 border-border/20 ml-4 md:ml-5"
                )}>
                    {replies.map(reply => (
                        <ReelCommentItem 
                            key={reply.id} 
                            reelId={reelId} 
                            comment={reply} 
                            parentPath={repliesPath}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </motion.div>
    );
}
