'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { doc, collection, serverTimestamp, query, orderBy, increment, writeBatch } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Heart, MessageSquare, Send, Loader2, CornerDownRight } from 'lucide-react';
import type { Comment, BookCommentLike, User as AppUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface BookCommentItemProps {
    bookId: string;
    comment: Comment;
    currentUserProfile: AppUser | null;
}

export function BookCommentItem({ bookId, comment, currentUserProfile }: BookCommentItemProps) {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isMounted, setIsMounted] = useState(false);

    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [isLiking, setIsLiking] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const likeRef = useMemo(() => (
        (firestore && currentUser) ? doc(firestore, 'books', bookId, 'comments', comment.id, 'likes', currentUser.uid) : null
    ), [firestore, currentUser, bookId, comment.id]);
    const { data: likeDoc } = useDoc<BookCommentLike>(likeRef);
    const isLiked = !!likeDoc;
    
    const handleToggleLike = async () => {
        if (!likeRef || !firestore || !currentUser) {
            toast({ variant: 'destructive', title: 'Harap Masuk', description: 'Anda harus masuk untuk menyukai komentar.' });
            return;
        }
        setIsLiking(true);
        const commentRef = doc(firestore, 'books', bookId, 'comments', comment.id);
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
            console.error("Error toggling comment like:", error);
        } finally {
            setIsLiking(false);
        }
    };

    const repliesQuery = useMemo(() => (
        firestore ? query(collection(firestore, 'books', bookId, 'comments', comment.id, 'replies'), orderBy('createdAt', 'asc')) : null
    ), [firestore, bookId, comment.id]);
    const { data: replies } = useCollection<Comment>(repliesQuery);

    const handleReplySubmit = async () => {
        if (!replyText.trim() || !currentUser || !firestore || !currentUserProfile) return;

        setIsSubmittingReply(true);
        const commentRef = doc(firestore, 'books', bookId, 'comments', comment.id);
        const repliesCol = collection(commentRef, 'replies');
        
        const replyData = {
            text: replyText,
            userId: currentUser.uid,
            userName: currentUser.displayName,
            username: currentUserProfile.username,
            userAvatarUrl: currentUser.photoURL,
            createdAt: serverTimestamp(),
            likeCount: 0,
            replyCount: 0,
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

    return (
        <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col group"
        >
            <div className="flex items-start gap-4">
                <Link href={comment.username ? `/profile/${comment.username}` : '#'} className="shrink-0">
                    <Avatar className="h-10 w-10 ring-2 ring-background shadow-md">
                        <AvatarImage src={comment.userAvatarUrl} alt={comment.userName} />
                        <AvatarFallback>{comment.userName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                </Link>
                <div className="flex-1 space-y-1">
                    <div className="bg-card/50 backdrop-blur-sm border border-border/50 p-4 rounded-2xl rounded-tl-none shadow-sm group-hover:shadow-md transition-all">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <Link href={comment.username ? `/profile/${comment.username}` : '#'} className="font-bold text-sm hover:text-primary transition-colors">
                                {comment.userName}
                            </Link>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground opacity-60">
                                {isMounted && comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { locale: id, addSuffix: true }) : '...'}
                            </span>
                        </div>
                        <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-blockquote:border-l-2 prose-blockquote:pl-3 prose-p:m-0 max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {comment.text}
                            </ReactMarkdown>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pl-2">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className={cn(
                                "h-8 px-3 rounded-full text-xs font-bold transition-all",
                                isLiked ? "text-red-500 bg-red-500/5 hover:bg-red-500/10" : "text-muted-foreground hover:text-primary"
                            )} 
                            onClick={handleToggleLike} 
                            disabled={isLiking}
                        >
                            <Heart className={cn("h-3.5 w-3.5 mr-1.5 transition-transform", isLiked && "fill-current scale-110")} />
                            {comment.likeCount > 0 && <span className="mr-1.5">{comment.likeCount}</span>}
                            {isLiked ? 'Disukai' : 'Suka'}
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-3 rounded-full text-xs font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                            onClick={() => setShowReplyInput(!showReplyInput)}
                        >
                            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                            {comment.replyCount > 0 && <span className="mr-1.5">{comment.replyCount}</span>}
                            Balas
                        </Button>
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
                        <div className="flex items-start gap-3 pl-14 pt-4">
                            <CornerDownRight className="h-4 w-4 text-muted-foreground mt-2" />
                            <Avatar className="h-8 w-8 ring-2 ring-background">
                                <AvatarImage src={currentUser.photoURL ?? ''} alt={currentUser.displayName ?? ''} />
                                <AvatarFallback>{currentUser.displayName?.charAt(0) ?? 'U'}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 relative">
                                <Textarea 
                                    placeholder={`Balas ${comment.userName}... (Gunakan Markdown jika perlu)`}
                                    className="w-full pr-12 min-h-[80px] bg-muted/20 border-none shadow-none focus-visible:ring-primary/20 text-sm rounded-xl py-3"
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    disabled={isSubmittingReply}
                                />
                                <Button 
                                    size="icon" 
                                    className="absolute bottom-2 right-2 h-8 w-8 rounded-lg shadow-lg" 
                                    onClick={handleReplySubmit} 
                                    disabled={isSubmittingReply || !replyText.trim()}
                                >
                                    {isSubmittingReply ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {replies && replies.length > 0 && (
                <div className="pl-14 pt-6 space-y-6 relative border-l-2 border-border/30 ml-5 mt-2">
                    {replies.map(reply => (
                        <div key={reply.id} className="flex items-start gap-3">
                             <Link href={reply.username ? `/profile/${reply.username}` : '#'} className="shrink-0">
                                <Avatar className="h-8 w-8 ring-2 ring-background shadow-sm">
                                    <AvatarImage src={reply.userAvatarUrl} alt={reply.userName} />
                                    <AvatarFallback>{reply.userName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </Link>
                            <div className="flex-1">
                                <div className="bg-muted/30 p-3.5 rounded-2xl rounded-tl-none border border-border/20">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <Link href={reply.username ? `/profile/${reply.username}` : '#'} className="font-bold text-xs hover:text-primary transition-colors">
                                            {reply.userName}
                                        </Link>
                                        <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground opacity-50">
                                            {isMounted && reply.createdAt ? formatDistanceToNow(reply.createdAt.toDate(), { locale: id, addSuffix: true }) : '...'}
                                        </span>
                                    </div>
                                    <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-blockquote:border-l-2 prose-blockquote:pl-3 prose-p:m-0 max-w-none">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {reply.text}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}