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
import { Eye, BookOpen, Send, MessageCircle, Loader2, Edit, Layers, Heart, Share2, Users, Globe, Lock } from 'lucide-react';
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
                        text: `${currentUser.displayName} mengomentari buku Anda: ${book.title}`,
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
                        text: `${currentUser.displayName} menyukai buku Anda: ${book.title}`,
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

  const handleExternalShare = async () => {
    if (!book) return;
    const shareData = {
      title: book.title,
      text: `Lihat buku "${book.title}" oleh ${book.authorName} di Elitera!`,
      url: window.location.href,
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
          description: "Tautan buku telah disalin ke clipboard Anda.",
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

  if (isBookLoading || isAuthorLoading) {
    return <BookDetailsSkeleton />;
  }

  if (!book) {
    notFound();
  }

  return (
    <div className="relative">
      {/* Background Decorative Element */}
      <div className="absolute top-0 left-0 w-full h-[400px] -z-10 overflow-hidden opacity-20 blur-3xl pointer-events-none">
          <Image src={book.coverUrl} alt="" fill className="object-cover" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-12"
      >
        <div className="grid md:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Cover */}
          <div className="md:col-span-4 lg:col-span-3">
            <Card className="overflow-hidden shadow-2xl border-none ring-1 ring-border/50 sticky top-24">
              <div className="aspect-[2/3] relative group">
                <Image
                  src={book.coverUrl}
                  alt={`Sampul ${book.title}`}
                  fill
                  className="object-cover bg-muted transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 25vw"
                  priority
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500" />
              </div>
              <CardContent className="p-6 grid grid-cols-3 gap-2 text-center bg-card/50 backdrop-blur-sm border-t">
                  <div className="flex flex-col items-center gap-1">
                      <Eye className="h-4 w-4 text-primary" />
                      <span className="font-bold text-sm">{isMounted ? new Intl.NumberFormat('id-ID').format(book.viewCount) : '...'}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Dilihat</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 border-x border-border/50">
                      <Heart className="h-4 w-4 text-red-500" />
                      <span className="font-bold text-sm">{isMounted ? new Intl.NumberFormat('id-ID').format(book.favoriteCount) : '...'}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Suka</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                      <Layers className="h-4 w-4 text-accent" />
                      <span className="font-bold text-sm">{isMounted ? book.chapterCount ?? 0 : '...'}</span>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Bab</span>
                  </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Details */}
          <div className="md:col-span-8 lg:col-span-9 space-y-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary" className="px-3 py-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                    {book.genre}
                </Badge>
                {book.visibility === 'followers_only' ? (
                    <Badge variant="outline" className="px-3 py-1 gap-1.5 border-accent/30 text-accent bg-accent/5">
                        <Users className="h-3 w-3" /> Hanya Pengikut
                    </Badge>
                ) : (
                    <Badge variant="outline" className="px-3 py-1 gap-1.5 border-muted-foreground/30 text-muted-foreground">
                        <Globe className="h-3 w-3" /> Publik
                    </Badge>
                )}
              </div>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-headline font-black text-foreground leading-tight tracking-tight">
                {book.title}
              </h1>

              <div className="flex items-center gap-4 pt-2">
                <Link href={author ? `/profile/${author.username}` : '#'} className="flex items-center gap-3 group bg-muted/30 hover:bg-muted/50 p-1.5 pr-4 rounded-full transition-all border border-transparent hover:border-primary/20">
                    <Avatar className="h-10 w-10 ring-2 ring-background">
                        <AvatarImage src={book.authorAvatarUrl} alt={book.authorName} />
                        <AvatarFallback>{book.authorName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold leading-none">Penulis</p>
                        <span className="font-bold text-sm group-hover:text-primary transition-colors">{book.authorName}</span>
                    </div>
                </Link>
                <div className="h-8 w-px bg-border/50 hidden sm:block" />
                <div className="hidden sm:block">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold leading-none">Diterbitkan</p>
                    <p className="text-sm font-medium mt-1">{book.createdAt?.toDate().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
            </div>

            <div className="bg-card/30 backdrop-blur-sm rounded-2xl p-6 md:p-8 border border-border/50 space-y-4">
                <h2 className="text-lg font-headline font-bold flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary"/> Sinopsis
                </h2>
                <p className="text-muted-foreground leading-relaxed text-lg italic font-serif">
                    {book.synopsis}
                </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="flex-1 h-14 text-base font-bold shadow-xl shadow-primary/20 rounded-xl" asChild>
                <Link href={`/books/${book.id}/read`}>
                    <BookOpen className="mr-2 h-5 w-5" /> Mulai Membaca
                </Link>
              </Button>
              
              <div className="flex gap-2">
                <Button 
                    size="lg" 
                    variant="outline" 
                    className={cn(
                        "h-14 w-14 sm:w-auto sm:px-6 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm transition-all",
                        isFavorite && "border-red-500/30 bg-red-500/5 text-red-500"
                    )}
                    onClick={handleToggleFavorite} 
                    disabled={isTogglingFavorite || isFavoriteLoading}
                >
                    {isTogglingFavorite ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                        <Heart className={cn("h-5 w-5 transition-transform", isFavorite && "fill-current scale-110")}/>
                    )}
                    <span className="ml-2 hidden sm:inline">{isFavorite ? 'Disukai' : 'Suka'}</span>
                </Button>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="lg" variant="outline" className="h-14 w-14 sm:w-auto sm:px-6 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm">
                            <Share2 className="h-5 w-5" />
                            <span className="ml-2 hidden sm:inline">Bagikan</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl p-2">
                        <DropdownMenuItem className="rounded-lg gap-3 py-3" onSelect={handleExternalShare}>
                            <Share2 className="h-4 w-4 text-primary" />
                            <span className="font-medium">Salin Tautan</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                            className="rounded-lg gap-3 py-3"
                            onSelect={(e) => {
                                e.preventDefault();
                                setIsShareDialogOpen(true);
                            }}
                        >
                            <Send className="h-4 w-4 text-primary" />
                            <span className="font-medium">Kirim ke Obrolan</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {isAuthor && (
                    <Button size="lg" variant="outline" className="h-14 w-14 sm:w-auto sm:px-6 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm" asChild>
                        <Link href={`/books/${book.id}/edit`}>
                            <Edit className="h-5 w-5 text-accent" />
                            <span className="ml-2 hidden sm:inline">Edit</span>
                        </Link>
                    </Button>
                )}
              </div>
            </div>

            <Separator className="my-12 opacity-50" />

            <div className="space-y-8 pb-20">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-headline font-black flex items-center gap-3">
                    <MessageCircle className="h-6 w-6 text-primary"/> 
                    Komentar 
                    <span className="bg-muted text-muted-foreground text-sm font-bold px-3 py-1 rounded-full">{comments?.length || 0}</span>
                </h2>
              </div>

              {currentUser && (
                <div className="flex items-start gap-4 bg-muted/20 p-6 rounded-2xl border border-border/50">
                  <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background">
                    <AvatarImage src={currentUser.photoURL ?? ''} alt={currentUser.displayName ?? ''} />
                    <AvatarFallback>{currentUser.displayName?.charAt(0) ?? 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="w-full relative">
                    <Textarea 
                      placeholder="Bagikan pemikiran Anda tentang buku ini..." 
                      className="w-full min-h-[100px] bg-background/50 border-none shadow-none focus-visible:ring-primary/20 resize-none rounded-xl"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <div className="flex justify-end mt-3">
                        <Button 
                            className="rounded-lg px-6 font-bold" 
                            onClick={handleCommentSubmit} 
                            disabled={isSubmitting || !newComment.trim()}
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Send className="h-4 w-4 mr-2"/>}
                            Kirim Komentar
                        </Button>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-6">
                  {areCommentsLoading && (
                    <div className="flex flex-col items-center py-12 gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
                        <p className="text-sm text-muted-foreground font-medium animate-pulse">Memuat diskusi...</p>
                    </div>
                  )}
                  <div className="grid gap-6">
                    {comments?.map(comment => (
                        <BookCommentItem key={comment.id} bookId={params.id} comment={comment} currentUserProfile={currentUserProfile} />
                    ))}
                  </div>
                  {!areCommentsLoading && comments?.length === 0 && (
                      <div className="text-center py-20 border-2 border-dashed border-muted rounded-3xl">
                          <MessageCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                          <p className="text-lg font-headline font-bold text-muted-foreground/60">Belum Ada Diskusi</p>
                          <p className="text-sm text-muted-foreground max-w-[240px] mx-auto mt-2">Jadilah pembaca pertama yang memberikan ulasan!</p>
                      </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      
      {book && <ShareBookDialog book={book} open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen} />}
    </div>
  );
}

function BookDetailsSkeleton() {
    return (
        <div className="space-y-12 animate-pulse">
            <div className="grid md:grid-cols-12 gap-8 lg:gap-12">
                <div className="md:col-span-4 lg:col-span-3">
                    <Card className="overflow-hidden rounded-2xl border-none">
                        <Skeleton className="aspect-[2/3] w-full" />
                        <CardContent className="p-6 grid grid-cols-3 gap-4">
                            <Skeleton className="h-10 w-full rounded-lg" />
                            <Skeleton className="h-10 w-full rounded-lg" />
                            <Skeleton className="h-10 w-full rounded-lg" />
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-8 lg:col-span-9 space-y-8">
                    <div className="space-y-4">
                        <div className="flex gap-2">
                            <Skeleton className="h-6 w-24 rounded-full" />
                            <Skeleton className="h-6 w-32 rounded-full" />
                        </div>
                        <Skeleton className="h-16 w-3/4 rounded-xl" />
                        <div className="flex items-center gap-4">
                            <Skeleton className="h-12 w-12 rounded-full" />
                            <Skeleton className="h-6 w-48 rounded-md" />
                        </div>
                    </div>
                    <Skeleton className="h-40 w-full rounded-2xl" />
                    <div className="flex gap-4">
                        <Skeleton className="h-14 flex-1 rounded-xl" />
                        <Skeleton className="h-14 w-32 rounded-xl" />
                        <Skeleton className="h-14 w-32 rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    )
}
