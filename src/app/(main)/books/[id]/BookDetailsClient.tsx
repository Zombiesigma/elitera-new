'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
import { notFound, useParams } from 'next/navigation';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { doc, collection, addDoc, serverTimestamp, query, orderBy, updateDoc, increment, writeBatch, getDoc } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Eye, BookOpen, Send, MessageCircle, Loader2, Edit, Layers, Heart, Share2, Users, Globe, Download, Clapperboard, CheckCircle2, Clock, Star, Sparkles } from "lucide-react";
import type { Book, Comment, User, Favorite } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { BookCommentItem } from '@/components/comments/BookCommentItem';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShareBookDialog } from '@/components/ShareBookDialog';
import { motion } from 'framer-motion';

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
  const { data: favoriteDoc, isLoading: isFavoriteLoading } = useDoc<Favorite>(favoriteRef);

  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const viewIncremented = useRef(false);

  useEffect(() => {
    setIsMounted(true);
    if (book && bookRef && !viewIncremented.current) {
        updateDoc(bookRef, { viewCount: increment(1) })
            .catch(err => console.warn("Failed to increment view count", err));
        viewIncremented.current = true;
    }
  }, [book, bookRef]);

  useEffect(() => {
    setIsFavorite(!!favoriteDoc);
  }, [favoriteDoc]);

  const isAuthor = currentUser?.uid === book?.authorId;

  const handleToggleFavorite = async () => {
    if (!firestore || !currentUser || !bookRef || !book) {
        toast({
            variant: "destructive",
            title: "Harap masuk",
            description: "Anda harus masuk untuk menambahkan ke favorit.",
        });
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
            batch.set(favoriteDocRef, {
                userId: currentUser.uid,
                addedAt: serverTimestamp()
            });
            batch.update(bookRef, { favoriteCount: increment(1) });
        }
        await batch.commit();

        if (!isFavorite && currentUser.uid !== book.authorId) {
            const authorDoc = await getDoc(doc(firestore, 'users', book.authorId));
             if (authorDoc.exists()) {
                const authorProfile = authorDoc.data() as User;
                if (authorProfile.notificationPreferences?.onBookFavorite !== false) {
                    const notificationsCol = collection(firestore, 'users', book.authorId, 'notifications');
                    addDoc(notificationsCol, {
                        type: 'favorite' as const,
                        text: `${currentUser.displayName} menyukai karya Anda: ${book.title}`,
                        link: `/books/${params.id}`,
                        actor: {
                            uid: currentUser.uid,
                            displayName: currentUser.displayName!,
                            photoURL: currentUser.photoURL!,
                        },
                        read: false,
                        createdAt: serverTimestamp()
                    });
                }
             }
        }

        toast({
            title: isFavorite ? "Dihapus dari Favorit" : "Ditambahkan ke Favorit",
        });
    } catch (error) {
        console.error("Error toggling favorite: ", error);
        toast({
            variant: "destructive",
            title: "Gagal",
            description: "Terjadi kesalahan. Silakan coba lagi.",
        });
    } finally {
        setIsTogglingFavorite(false);
    }
  };

  function handleCommentSubmit() {
    if (!newComment.trim() || !currentUser || !firestore || !book || !currentUserProfile) return;

    setIsSubmitting(true);
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

    addDoc(commentsCol, commentData)
      .then(async () => {
        setNewComment('');
        if (currentUser.uid !== book.authorId) {
            const authorDoc = await getDoc(doc(firestore, 'users', book.authorId));
            if (authorDoc.exists()) {
                const authorProfile = authorDoc.data() as User;
                if (authorProfile.notificationPreferences?.onBookComment !== false) {
                    const notificationsCol = collection(firestore, 'users', book.authorId, 'notifications');
                    addDoc(notificationsCol, {
                        type: 'comment' as const,
                        text: `${currentUser.displayName} mengomentari karya Anda: ${book.title}`,
                        link: `/books/${params.id}`,
                        actor: {
                            uid: currentUser.uid,
                            displayName: currentUser.displayName!,
                            photoURL: currentUser.photoURL!,
                        },
                        read: false,
                        createdAt: serverTimestamp(),
                    });
                }
            }
        }
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: commentsCol.path,
          operation: 'create',
          requestResourceData: commentData,
        });
        errorEmitter.emit('permission-error', permissionError);
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleExternalShare = async () => {
    if (!book) return;
    const shareData = {
      title: book.title,
      text: `Lihat ${book.type === 'screenplay' ? 'naskah' : 'buku'} "${book.title}" oleh ${book.authorName} di Elitera!`,
      url: typeof window !== 'undefined' ? window.location.href : '',
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.log('Share cancelled or failed', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
        toast({
          title: "Tautan Disalin",
          description: "Tautan karya telah disalin ke clipboard Anda.",
        });
      } catch (error) {
        console.error('Failed to copy link:', error);
        toast({
          variant: "destructive",
          title: "Gagal Menyalin",
          description: "Tidak dapat menyalin tautan ke clipboard.",
        });
      }
    }
  };

  const handleDownload = () => {
    if (!book?.fileUrl) return;
    window.open(book.fileUrl, '_blank');
    toast({
        title: "Mengunduh Berkas",
        description: "Naskah asli sedang dibuka di jendela baru.",
    });
  };

  if (isBookLoading || isAuthorLoading) {
    return <BookDetailsSkeleton />;
  }

  if (!book) {
    notFound();
  }

  const isScreenplay = book.type === 'screenplay';

  return (
    <div className="relative max-w-md mx-auto px-0">
      {/* Immersive Background */}
      <div className="fixed top-0 left-0 w-full h-[500px] -z-10 overflow-hidden opacity-30 blur-[100px] pointer-events-none">
          <Image src={book.coverUrl} alt="" fill className="object-cover" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="pb-32 space-y-8"
      >
        {/* Cover Hero Section */}
        <section className="relative px-6 pt-10">
            <div className="relative aspect-[2/3] w-full max-w-[260px] mx-auto group shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] rounded-[2.5rem] overflow-hidden border-2 border-white/10 ring-1 ring-black/5">
                <Image
                  src={book.coverUrl}
                  alt={`Sampul ${book.title}`}
                  fill
                  className="object-cover bg-muted transition-transform duration-1000 group-hover:scale-110"
                  sizes="(max-width: 768px) 100vw, 400px"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60" />
                
                {book.isCompleted && (
                    <div className="absolute top-4 left-4 bg-emerald-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-1.5 backdrop-blur-md">
                        <CheckCircle2 className="h-3 w-3" /> Tamat
                    </div>
                )}
            </div>
        </section>

        {/* Info Header */}
        <section className="px-6 text-center space-y-4">
            <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge variant="secondary" className="px-3 py-1 bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase tracking-widest">
                    {book.genre}
                </Badge>
                {isScreenplay && (
                    <Badge variant="outline" className="px-3 py-1 gap-1.5 border-orange-500/30 text-orange-500 bg-orange-500/5 font-black uppercase text-[10px]">
                        <Clapperboard className="h-3 w-3" /> Skenario
                    </Badge>
                )}
            </div>

            <h1 className="text-3xl font-headline font-black text-foreground leading-tight tracking-tight italic">
                {book.title}
            </h1>

            <Link href={author ? `/profile/${author.username}` : '#'} className="inline-flex items-center gap-3 group bg-muted/30 hover:bg-primary/5 p-1 pr-4 rounded-full transition-all border border-transparent hover:border-primary/20 mx-auto">
                <Avatar className="h-8 w-8 ring-2 ring-background">
                    <AvatarImage src={book.authorAvatarUrl} alt={book.authorName} />
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">{book.authorName?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="text-left">
                    <p className="text-[8px] uppercase tracking-[0.2em] text-muted-foreground font-black leading-none">Pujangga</p>
                    <span className="font-bold text-xs group-hover:text-primary transition-colors">{book.authorName}</span>
                </div>
            </Link>
        </section>

        {/* Stats Grid */}
        <section className="px-6">
            <Card className="border-none bg-card/40 backdrop-blur-md shadow-xl rounded-[2rem] overflow-hidden border border-white/5 shadow-primary/5">
                <CardContent className="p-6 grid grid-cols-3 divide-x divide-border/50 text-center">
                    <div className="flex flex-col items-center gap-1">
                        <Eye className="h-4 w-4 text-primary opacity-60" />
                        <span className="font-black text-sm">{isMounted ? new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(book.viewCount) : '...'}</span>
                        <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Dilihat</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <Heart className="h-4 w-4 text-rose-500 opacity-60" />
                        <span className="font-black text-sm">{isMounted ? new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(book.favoriteCount) : '...'}</span>
                        <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Suka</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <Layers className="h-4 w-4 text-accent opacity-60" />
                        <span className="font-black text-sm">{isMounted ? book.chapterCount ?? 0 : '...'}</span>
                        <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">{isScreenplay ? 'Bagian' : 'Bab'}</span>
                    </div>
                </CardContent>
            </Card>
        </section>

        {/* Primary Actions */}
        <section className="px-6 flex flex-col gap-3">
            <Button size="lg" className="w-full h-16 text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 rounded-2xl group overflow-hidden relative" asChild>
                <Link href={`/books/${book.id}/read`}>
                    <span className="relative z-10 flex items-center gap-2">
                        {isScreenplay ? <Clapperboard className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                        {isScreenplay ? 'Mulai Naskah' : 'Mulai Membaca'}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-10 transition-opacity" />
                </Link>
            </Button>
            
            <div className="flex gap-3">
                <Button 
                    variant="outline" 
                    className={cn(
                        "flex-1 h-14 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all active:scale-95",
                        isFavorite ? "bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20" : "bg-card/50 hover:bg-rose-500/5 hover:border-rose-500/20 hover:text-rose-500"
                    )}
                    onClick={handleToggleFavorite} 
                    disabled={isTogglingFavorite || isFavoriteLoading}
                >
                    {isTogglingFavorite ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Heart className={cn("h-4 w-4 mr-2", isFavorite && "fill-current scale-110")}/>
                    )}
                    {isFavorite ? 'Disukai' : 'Sukai Karya'}
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-14 w-14 rounded-2xl border-2 bg-card/50 hover:bg-primary/5 transition-all shadow-lg active:scale-95">
                            <Share2 className="h-5 w-5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 border-none shadow-2xl bg-background/95 backdrop-blur-xl">
                        <DropdownMenuItem className="rounded-xl gap-3 py-3 font-bold" onSelect={handleExternalShare}>
                            <Share2 className="h-4 w-4 text-primary" /> Salin Tautan
                        </DropdownMenuItem>
                        <DropdownMenuItem className="rounded-xl gap-3 py-3 font-bold" onSelect={() => setIsShareDialogOpen(true)}>
                            <Send className="h-4 w-4 text-primary" /> Kirim Pesan
                        </DropdownMenuItem>
                        {book.fileUrl && (
                            <DropdownMenuItem className="rounded-xl gap-3 py-3 font-bold" onSelect={handleDownload}>
                                <Download className="h-4 w-4 text-primary" /> Unduh PDF
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                {isAuthor && (
                    <Button variant="outline" className="h-14 w-14 rounded-2xl border-2 bg-card/50 hover:bg-accent/10 transition-all shadow-lg active:scale-95" asChild>
                        <Link href={`/books/${book.id}/edit`}>
                            <Edit className="h-5 w-5 text-accent" />
                        </Link>
                    </Button>
                )}
            </div>
        </section>

        {/* Synopsis Area */}
        <section className="px-6">
            <div className="bg-card/30 backdrop-blur-sm rounded-[2rem] p-8 border border-white/5 space-y-4 shadow-inner">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] text-primary/60 flex items-center gap-2">
                    <Sparkles className="h-3 w-3" /> Intisari Cerita
                </h2>
                <p className="text-foreground/80 leading-relaxed text-base italic font-serif">
                    "{book.synopsis}"
                </p>
            </div>
        </section>

        <Separator className="mx-6 opacity-30" />

        {/* Discussion Section */}
        <section className="px-6 space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-headline font-black flex items-center gap-3">
                    <MessageCircle className="h-5 w-5 text-primary"/> 
                    Diskusi 
                    <span className="bg-primary/10 text-primary text-[10px] font-black px-3 py-1 rounded-full shadow-sm">{comments?.length || 0}</span>
                </h2>
            </div>

            {currentUser && (
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <Avatar className="h-9 w-9 shrink-0 ring-2 ring-background border border-border/50">
                            <AvatarImage src={currentUser.photoURL ?? ''} alt={currentUser.displayName ?? ''} />
                            <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">{currentUser.displayName?.charAt(0) ?? 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="relative flex-1 group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                            <Textarea 
                                placeholder="Tulis ulasan inspiratif Anda..." 
                                className="relative w-full min-h-[100px] bg-card/50 border-none shadow-inner focus-visible:ring-primary/20 resize-none rounded-2xl p-4 text-sm font-medium"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button 
                            className="rounded-full px-8 h-11 font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-90" 
                            onClick={handleCommentSubmit} 
                            disabled={isSubmitting || !newComment.trim()}
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Send className="h-4 w-4 mr-2"/>}
                            Kirim Ulasan
                        </Button>
                    </div>
                </div>
            )}
            
            <div className="space-y-6">
                {areCommentsLoading ? (
                    <div className="flex flex-col items-center py-12 gap-4 opacity-40">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Sinkronisasi Suara...</p>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {comments?.map(comment => (
                            <BookCommentItem key={comment.id} bookId={params.id} comment={comment} currentUserProfile={currentUserProfile} />
                        ))}
                    </div>
                )}
                
                {!areCommentsLoading && comments?.length === 0 && (
                    <div className="text-center py-20 border-2 border-dashed border-muted/30 rounded-[2.5rem] opacity-40">
                        <Star className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                        <p className="font-headline text-xl font-bold">Jadilah Yang Pertama</p>
                        <p className="text-[10px] uppercase font-black tracking-widest mt-2">Apresiasi puitis dimulai dari Anda</p>
                    </div>
                )}
            </div>
        </section>
      </motion.div>
      
      {book && <ShareBookDialog book={book} open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} />}
    </div>
  );
}

function BookDetailsSkeleton() {
    return (
        <div className="max-w-md mx-auto px-6 pt-10 space-y-8 animate-pulse">
            <Skeleton className="aspect-[2/3] w-full max-w-[260px] mx-auto rounded-[2rem]" />
            <div className="space-y-4 text-center">
                <Skeleton className="h-6 w-24 mx-auto rounded-full" />
                <Skeleton className="h-12 w-3/4 mx-auto rounded-xl" />
                <Skeleton className="h-10 w-48 mx-auto rounded-full" />
            </div>
            <Skeleton className="h-24 w-full rounded-[2rem]" />
            <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <div className="flex gap-3">
                    <Skeleton className="h-14 flex-1 rounded-2xl" />
                    <Skeleton className="h-14 w-14 rounded-2xl" />
                </div>
            </div>
        </div>
    )
}
