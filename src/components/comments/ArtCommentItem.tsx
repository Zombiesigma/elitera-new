'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { doc, serverTimestamp, increment, writeBatch, collection, query, orderBy } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Heart, Send as SendIcon, Loader2, CornerDownRight, Reply, Sparkles } from 'lucide-react';
import type { ArtComment, ArtCommentLike } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useToast } from '@/hooks/use-toast';

interface ArtCommentItemProps {
    artId: string;
    comment: ArtComment;
    parentPath: string; 
    depth?: number;
}

export function ArtCommentItem({ artId, comment, parentPath, depth = 0 }: ArtCommentItemProps) {
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
    
    const { data: likeDoc } = useDoc<ArtCommentLike>(likeRef);
    const isLiked = !!likeDoc;
    
    const handleToggleLike = async () => {
        if (!likeRef || !firestore || !currentUser || isLiking) return;
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
            console.error("Error toggling art comment like:", error);
        } finally {
            setIsLiking(false);
        }
    };

    const repliesQuery = useMemo(() => (
        firestore ? query(collection(firestore, repliesPath), orderBy('createdAt', 'asc')) : null
    ), [firestore, repliesPath]);
    
    const { data: replies } = useCollection<ArtComment>(repliesQuery);

    const handleReplySubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!replyText.trim() || !currentUser || !firestore || isSubmittingReply) return;

        setIsSubmittingReply(true);
        const commentRef = doc(firestore, currentCommentRefPath);
        const repliesCol = collection(firestore, repliesPath);
        
        const replyData = {
            text: replyText.trim(),
            userId: currentUser.uid,
            userName: currentUser.displayName || 'Pujangga Elitera',
            username: currentUser.email?.split('@')[0] || 'user',
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
            toast({ variant: 'success', title: "Balasan Terkirim" });
        } catch (error) {
            console.error("Error submitting reply:", error);
            toast({ variant: 'destructive', title: "Gagal Mengirim" });
        } finally {
            setIsSubmittingReply(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleReplySubmit();
        }
    };

    const maxDepth = 3;

    return (
        <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn("flex flex-col", depth > 0 && "mt-5")}
        >
            <div className="flex items-start gap-4 py-1 group/item">
                <Link href={`/profile/${comment.username}`} className="shrink-0 pt-1">
                    <Avatar className="h-9 w-9 border-2 border-background ring-1 ring-border/50 shadow-md group-hover/item:scale-105 transition-transform">
                        <AvatarImage src={comment.userAvatarUrl} className="object-cover" />
                        <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">{comment.userName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                </Link>
                
                <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <Link href={`/profile/${comment.username}`} className="font-black text-[13px] hover:text-primary transition-colors uppercase tracking-tight">{comment.userName}</Link>
                            {depth === 0 && <Sparkles className="h-2.5 w-2.5 text-primary opacity-40" />}
                        </div>
                        <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-p:m-0 max-w-none text-foreground/80 font-medium text-[13px] bg-white/50 dark:bg-zinc-900/50 p-3 rounded-2xl rounded-tl-none border border-white/10 shadow-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {comment.text}
                            </ReactMarkdown>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-5 pl-1">
                        <span className="text-[8px] text-muted-foreground font-black uppercase tracking-widest opacity-50">
                            {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { locale: id, addSuffix: true }) : 'Baru saja'}
                        </span>
                        
                        <button 
                            onClick={handleToggleLike}
                            disabled={isLiking}
                            className={cn(
                                "flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em] transition-all",
                                isLiked ? "text-rose-500" : "text-muted-foreground hover:text-primary"
                            )}
                        >
                            <Heart className={cn("h-3.5 w-3.5", isLiked && "fill-current")} />
                            <span>{comment.likeCount || 0}</span>
                        </button>

                        <button 
                            onClick={() => setShowReplyInput(!showReplyInput)}
                            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground hover:text-primary transition-all"
                        >
                            <Reply className="h-3.5 w-3.5" />
                            <span>Balas</span>
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
                        <form onSubmit={handleReplySubmit} className="flex items-start gap-3 pl-12 pt-4 pr-2">
                            <div className="shrink-0 mt-3.5"><CornerDownRight className="h-4 w-4 text-primary/30" /></div>
                            <div className="relative flex-1 group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
                                <Textarea 
                                    placeholder={`Balas ulasan puitis ${comment.userName}...`}
                                    className="relative w-full min-h-[70px] bg-muted/30 border-none shadow-none focus-visible:ring-primary/20 text-xs rounded-2xl py-3 px-4 resize-none pr-12 font-medium"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={isSubmittingReply}
                                />
                                <Button 
                                    type="submit"
                                    size="icon" 
                                    className="absolute bottom-2 right-2 h-9 w-9 rounded-xl shadow-xl shadow-primary/20 active:scale-90 transition-all" 
                                    disabled={isSubmittingReply || !replyText.trim()}
                                >
                                    {isSubmittingReply ? <Loader2 className="h-4 w-4 animate-spin"/> : <SendIcon className="h-4 w-4"/>}
                                </Button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {replies && replies.length > 0 && (
                <div className={cn(
                    "pl-8 md:pl-12 mt-4 relative",
                    depth < maxDepth && "border-l border-primary/10 ml-4 md:ml-5"
                )}>
                    {replies.map(reply => (
                        <ArtCommentItem 
                            key={reply.id} 
                            artId={artId} 
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
