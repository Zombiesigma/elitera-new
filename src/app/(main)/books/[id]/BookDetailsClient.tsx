'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
import { notFound, useParams } from 'next/navigation';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp, query, orderBy, updateDoc, increment, writeBatch } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
  Eye, 
  BookOpen, 
  Send, 
  MessageCircle, 
  Loader2, 
  PenTool, 
  Layers, 
  Heart, 
  Share2, 
  Sparkles, 
  Clapperboard, 
  CheckCircle2, 
  Music2, 
  Info,
  ChevronRight
} from "lucide-react";
import type { Book, Comment, User, Favorite } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { BookCommentItem } from '@/components/comments/BookCommentItem';
import { ShareBookDialog } from '@/components/ShareBookDialog';
import { motion, AnimatePresence } from 'framer-motion';

export default function BookDetailsClient() {
  const params = useParams<{ id: string }>();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const bookRef = useMemo(() => (
    firestore ? doc(firestore, 'books', params.id) : null
  ), [firestore, params.id]);
  const { data: book, isLoading: isBookLoading } = useDoc<Book>(bookRef);

  const authorRef = useMemo(() => (
    (firestore && book?.authorId) ? doc(firestore, 'users', book.authorId) : null
  ), [firestore, book]);
  const { data: author, isLoading: isAuthorLoading } = useDoc<User>(authorRef);

  const { data: currentUserProfile } = useDoc<User>(
    (firestore && currentUser) ? doc(firestore, 'users', currentUser.uid) : null
  );

  const commentsQuery = useMemo(() => (
    firestore 
      ? query(collection(firestore, 'books', params.id, 'comments'), orderBy('createdAt', 'desc')) 
      : null
  ), [firestore, params.id]);
  const { data: comments, isLoading: areCommentsLoading } = useCollection<Comment>(commentsQuery);
  
  const favoriteRef = useMemo(() => (
    (firestore && currentUser) ? doc(firestore, 'users', currentUser.uid, 'favorites', params.id) : null
  ), [firestore, currentUser, params.id]);
  const { data: favoriteDoc } = useDoc<Favorite>(favoriteRef);

  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const viewIncremented = useRef(false);

  const isFavorite = !!favoriteDoc;
  const isAuthor = currentUser?.uid === book?.authorId;

  useEffect(() => {
    setIsMounted(true);
    if (book && bookRef && !viewIncremented.current) {
        updateDoc(bookRef, { viewCount: increment(1) })
            .catch(err => console.warn("Failed to increment view count", err));
        viewIncremented.current = true;
    }
  }, [book, bookRef]);

  const handleToggleFavorite = async () => {
    if (!firestore || !currentUser || !bookRef || !book) {
        toast({ variant: "destructive", title: "Harap masuk" });
        return;
    };
    setIsTogglingFavorite(true);
    const favoriteDocRef = doc(firestore, 'users', currentUser.uid, 'favorites', params.id);
    const batch = writeBatch(firestore);
    try {
        if (isFavorite) {
            batch.delete(favoriteDocRef);
            batch.update(bookRef, { favoriteCount: increment(-1) });
        } else {
            batch.set(favoriteDocRef, { userId: currentUser.uid, addedAt: serverTimestamp() });
            batch.update(bookRef, { favoriteCount: increment(1) });
        }
        await batch.commit();
        toast({ title: isFavorite ? "Dihapus dari Favorit" : "Ditambahkan ke Favorit" });
    } catch (error) {
        toast({ variant: "destructive", title: "Gagal" });
    } finally {
        setIsTogglingFavorite(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (!newComment.trim() || !currentUser || !firestore || !book || !currentUserProfile) return;
    setIsSubmitting(true);
    try {
        const commentsCol = collection(firestore, 'books', params.id, 'comments');
        const commentData = {
          text: newComment,
          userId: currentUser.uid,
          userName: currentUser.displayName,
          userAvatarUrl: currentUser.photoURL,
          username: currentUserProfile.username,
          createdAt: serverTimestamp(),
          likeCount: 0,
          replyCount: 0,
        };
        await addDoc(commentsCol, commentData);
        setNewComment('');
        toast({ variant: 'success', title: "Ulasan Terkirim" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Gagal mengirim ulasan" });
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isBookLoading || isAuthorLoading) return <BookDetailsSkeleton />;
  if (!book) notFound();

  const hasSoundtrack = book.playlist && book.playlist.length > 0;

  return (
    <div className="relative max-w-lg mx-auto pb-32 px-4">
      {/* Decorative background blobs */}
      <div className="absolute top-0 right-[-10%] w-64 h-64 bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute bottom-1/2 left-[-10%] w-64 h-64 bg-accent/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-10 py-6"
      >
        {/* Cover Section */}
        <div className="relative aspect-[2/3] w-full shadow-[0_30px_80px_-15px_rgba(0,0,0,0.3)] rounded-[2.5rem] md:rounded-[3rem] overflow-hidden border border-white/10 group">
            <Image 
                src={book.coverUrl} 
                alt={book.title} 
                fill 
                className="object-cover transition-transform duration-700 group-hover:scale-105" 
                priority 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            
            <div className="absolute top-6 left-6 flex flex-col gap-2">
                <Badge className="bg-primary/90 backdrop-blur-md text-white border-none uppercase text-[9px] font-black px-4 py-1.5 rounded-full tracking-widest shadow-xl">
                    {book.genre}
                </Badge>
                {book.isCompleted && (
                    <Badge className="bg-emerald-500/90 backdrop-blur-md text-white border-none uppercase text-[9px] font-black px-4 py-1.5 rounded-full tracking-widest shadow-xl">
                        <CheckCircle2 className="h-3 w-3 mr-1.5" /> Tamat
                    </Badge>
                )}
            </div>

            {hasSoundtrack && (
                <div className="absolute top-6 right-6">
                    <div className="bg-indigo-600/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full flex items-center gap-2 border border-white/20 shadow-2xl animate-pulse">
                        <Music2 className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Soundtrack Aktif</span>
                    </div>
                </div>
            )}
        </div>

        {/* Info Section */}
        <div className="space-y-8 px-2">
            <div className="space-y-3">
                <h1 className="text-4xl md:text-5xl font-headline font-black leading-[1.1] tracking-tight italic">
                    {book.title}
                </h1>
                
                <div className="flex items-center gap-2">
                    <div className="h-1 w-12 bg-primary rounded-full" />
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60">Arsip Mahakarya Elitera</p>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-between gap-4">
                <Link href={`/profile/${book.authorUsername}`} className="flex items-center gap-4 bg-card/50 backdrop-blur-sm p-2.5 pr-8 rounded-full border shadow-xl hover:shadow-2xl hover:border-primary/20 transition-all group shrink-0">
                    <div className="relative">
                        <Avatar className="h-12 w-12 border-2 border-background shadow-md group-hover:scale-105 transition-transform">
                            <AvatarImage src={book.authorAvatarUrl} className="object-cover" />
                            <AvatarFallback className="bg-primary/5 text-primary font-black">{book.authorName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-0.5 -right-0.5 bg-primary p-1 rounded-full border-2 border-background">
                            <CheckCircle2 className="h-2 w-2 text-white" />
                        </div>
                    </div>
                    <div className="text-left">
                        <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">Arsitek Narasi</p>
                        <p className="font-black text-base">{book.authorName}</p>
                    </div>
                </Link>

                {isAuthor && (
                    <Button variant="outline" className="rounded-full border-2 h-14 px-8 font-black uppercase text-[10px] tracking-[0.2em] shadow-lg hover:bg-primary hover:text-white hover:border-primary transition-all active:scale-95" asChild>
                        <Link href={`/books/${book.id}/edit`}>
                            <PenTool className="mr-2.5 h-4 w-4" /> Edit Karya
                        </Link>
                    </Button>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Jejak Baca', value: book.viewCount, icon: Eye, color: 'text-primary' },
                    { label: 'Apresiasi', value: book.favoriteCount, icon: Heart, color: 'text-rose-500' },
                    { label: 'Total Bab', value: book.chapterCount, icon: Layers, color: 'text-indigo-500' }
                ].map((stat, i) => (
                    <div key={i} className="bg-muted/30 backdrop-blur-sm p-5 rounded-[2rem] border border-white/5 shadow-inner group">
                        <div className="flex flex-col items-center text-center gap-1">
                            <div className={cn("p-2 rounded-xl bg-white/50 mb-1 transition-transform group-hover:scale-110", stat.color)}>
                                <stat.icon className="h-4 w-4" />
                            </div>
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{stat.label}</p>
                            <p className="font-black text-xl tracking-tighter">
                                {isMounted ? new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(stat.value) : '...'}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Primary Actions */}
        <div className="space-y-4">
            <div className="grid grid-cols-5 gap-3">
                <Button className="col-span-4 h-16 rounded-[1.5rem] md:rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm shadow-2xl shadow-primary/30 active:scale-[0.98] transition-all" asChild>
                    <Link href={`/books/${book.id}/read`}>
                        {book.type === 'screenplay' ? <Clapperboard className="mr-3 h-5 w-5" /> : <BookOpen className="mr-3 h-5 w-5" />}
                        Mulai {book.type === 'screenplay' ? 'Naskah' : 'Membaca'}
                    </Link>
                </Button>
                <Button variant="outline" className="h-16 rounded-[1.5rem] md:rounded-[2rem] border-2 shadow-xl hover:bg-primary/5 hover:text-primary transition-all active:scale-[0.98]" onClick={() => setIsShareDialogOpen(true)}>
                    <Share2 className="h-6 w-6" />
                </Button>
            </div>

            <Button 
                variant="ghost" 
                className={cn(
                    "w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all duration-500",
                    isFavorite ? "text-rose-500 bg-rose-500/5 hover:bg-rose-500/10" : "bg-muted/50 hover:bg-muted/80 text-muted-foreground"
                )}
                onClick={handleToggleToggleFavorite}
                disabled={isTogglingFavorite}
            >
                <Heart className={cn("mr-2.5 h-4 w-4 transition-transform duration-500", isFavorite && "fill-current scale-110")} />
                {isFavorite ? 'Mahakarya Favorit' : 'Simpan ke Favorit'}
            </Button>
        </div>

        {/* Synopsis Section */}
        <section className="space-y-6">
            <div className="flex items-center gap-4 px-2">
                <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                    <Sparkles className="h-4 w-4" />
                </div>
                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60">Sinopsis Karya</h2>
                <div className="h-px bg-border/50 flex-1" />
            </div>
            <div className="bg-card/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/10 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/20 via-primary/5 to-transparent" />
                <p className="text-base md:text-lg leading-[1.8] italic font-serif text-foreground/80 first-letter:text-4xl first-letter:font-black first-letter:text-primary first-letter:mr-2 first-letter:float-left">
                    {book.synopsis}
                </p>
            </div>
        </section>

        {/* Comments Section */}
        <section className="space-y-10 pt-8">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600">
                        <MessageCircle className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-headline font-black tracking-tight">Suara Pembaca</h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Apresiasi & Diskusi</p>
                    </div>
                </div>
                <Badge className="rounded-full bg-primary/10 text-primary border-none px-4 py-1 font-black text-[10px]">{comments?.length || 0} Ulasan</Badge>
            </div>

            {currentUser && (
                <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="space-y-4 px-2">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                        <Textarea 
                            placeholder="Tuangkan ulasan puitismu di sini..." 
                            className="relative rounded-[1.75rem] bg-muted/30 border-none min-h-[140px] p-6 font-medium text-sm focus-visible:ring-primary/20 shadow-inner"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                        />
                    </div>
                    <Button 
                        className="w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all" 
                        onClick={handleCommentSubmit} 
                        disabled={isSubmitting || !newComment.trim()}
                    >
                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="mr-2 h-4 w-4" />}
                        Publikasikan Ulasan
                    </Button>
                </motion.div>
            )}

            <div className="space-y-8 px-2">
                <AnimatePresence mode="popLayout">
                    {comments?.map((comment, idx) => (
                        <BookCommentItem 
                            key={comment.id} 
                            bookId={params.id} 
                            comment={comment} 
                            currentUserProfile={currentUserProfile} 
                        />
                    ))}
                </AnimatePresence>
                
                {(!comments || comments.length === 0) && (
                    <div className="text-center py-20 opacity-20 flex flex-col items-center gap-4">
                        <MessageCircle className="h-16 w-16" />
                        <p className="font-black uppercase tracking-[0.3em] text-[10px]">Belum ada diskusi untuk karya ini.</p>
                    </div>
                )}
            </div>
        </section>
      </motion.div>

      {/* Share Dialog */}
      <ShareBookDialog book={book} open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} />
      
      {/* Footer Branding */}
      <div className="text-center opacity-20 select-none grayscale py-16">
          <div className="flex items-center justify-center gap-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.5em]">Elitera Digital Sastra</span>
          </div>
      </div>
    </div>
  );
}

function BookDetailsSkeleton() {
    return (
        <div className="max-w-lg mx-auto p-6 space-y-10 animate-pulse">
            <Skeleton className="aspect-[2/3] w-full rounded-[2.5rem]" />
            <div className="space-y-4">
                <Skeleton className="h-12 w-3/4 rounded-full" />
                <Skeleton className="h-6 w-1/2 rounded-full" />
            </div>
            <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-24 rounded-[2rem]" />
                <Skeleton className="h-24 rounded-[2rem]" />
                <Skeleton className="h-24 rounded-[2rem]" />
            </div>
            <Skeleton className="h-64 w-full rounded-[2.5rem]" />
        </div>
    );
}
