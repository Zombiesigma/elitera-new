
'use client';

import { useMemo, useState } from 'react';
import { useFirestore, useUser, useCollection, useDoc } from '@/firebase';
import { collection, query, where, doc, deleteDoc, updateDoc, arrayUnion, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { Book, Reel, User as AppUser, CollaborationInvitation } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  BookOpen, 
  Clapperboard, 
  Users, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Sparkles, 
  LayoutGrid, 
  Film,
  ArrowRight,
  Eye,
  Heart,
  MessageSquare,
  AlertCircle,
  Briefcase,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function StudioPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: userProfile } = useDoc<AppUser>(
    (firestore && currentUser) ? doc(firestore, 'users', currentUser.uid) : null
  );

  // Queries - My own books
  const booksQuery = useMemo(() => (
    (firestore && currentUser) ? query(collection(firestore, 'books'), where('authorId', '==', currentUser.uid)) : null
  ), [firestore, currentUser]);
  const { data: rawBooks, isLoading: isBooksLoading, error: booksError } = useCollection<Book>(booksQuery);

  // Queries - Books where I am a collaborator
  const collabBooksQuery = useMemo(() => (
    (firestore && currentUser) ? query(collection(firestore, 'books'), where('collaboratorUids', 'array-contains', currentUser.uid)) : null
  ), [firestore, currentUser]);
  const { data: rawCollabBooks, isLoading: isCollabLoading } = useCollection<Book>(collabBooksQuery);

  const reelsQuery = useMemo(() => (
    (firestore && currentUser) ? query(collection(firestore, 'reels'), where('authorId', '==', currentUser.uid)) : null
  ), [firestore, currentUser]);
  const { data: rawReels, isLoading: isReelsLoading, error: reelsError } = useCollection<Reel>(reelsQuery);

  const invitationsQuery = useMemo(() => (
    (firestore && currentUser) ? query(collection(firestore, 'collaborationInvitations'), where('collaboratorId', '==', currentUser.uid), where('status', '==', 'pending')) : null
  ), [firestore, currentUser]);
  const { data: invitations, isLoading: isInvitesLoading } = useCollection<CollaborationInvitation>(invitationsQuery);

  // Client-side sorting
  const myBooks = useMemo(() => {
    if (!rawBooks) return [];
    return [...rawBooks].sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  }, [rawBooks]);

  const teamProjects = useMemo(() => {
    if (!rawCollabBooks) return [];
    return [...rawCollabBooks].sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  }, [rawCollabBooks]);

  const myReels = useMemo(() => {
    if (!rawReels) return [];
    return [...rawReels].sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  }, [rawReels]);

  const handleAcceptInvite = async (invite: CollaborationInvitation) => {
    if (!firestore || !userProfile) return;
    setProcessingId(invite.id);
    try {
      const batch = writeBatch(firestore);
      
      // 1. Update book
      const bookRef = doc(firestore, 'books', invite.bookId);
      const collaboratorData = {
        uid: userProfile.uid,
        displayName: userProfile.displayName,
        photoURL: userProfile.photoURL,
        username: userProfile.username
      };
      
      batch.update(bookRef, {
        collaboratorUids: arrayUnion(userProfile.uid),
        collaborators: arrayUnion(collaboratorData)
      });

      // 2. Update invitation status
      const inviteRef = doc(firestore, 'collaborationInvitations', invite.id);
      batch.update(inviteRef, { status: 'accepted' });

      // 3. Send Notification to owner
      const notificationRef = doc(collection(firestore, `users/${invite.ownerId}/notifications`));
      batch.set(notificationRef, {
          type: 'follow', 
          text: `${userProfile.displayName} telah menyetujui undangan kolaborasi pada: "${invite.bookTitle}"`,
          link: `/books/${invite.bookId}/edit`,
          actor: {
              uid: userProfile.uid,
              displayName: userProfile.displayName,
              photoURL: userProfile.photoURL,
          },
          read: false,
          createdAt: serverTimestamp(),
      });

      await batch.commit();
      toast({ variant: 'success', title: "Kolaborasi Dimulai!", description: `Anda sekarang adalah rekan penulis untuk "${invite.bookTitle}".` });
    } catch (e) {
      toast({ variant: 'destructive', title: "Gagal Menyetujui" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectInvite = async (inviteId: string) => {
    if (!firestore) return;
    setProcessingId(inviteId);
    try {
      await updateDoc(doc(firestore, 'collaborationInvitations', inviteId), { status: 'rejected' });
      toast({ title: "Undangan Ditolak" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Gagal Menolak" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteReel = async (reelId: string) => {
    if (!firestore) return;
    if (!confirm("Hapus video ini selamanya?")) return;
    setProcessingId(reelId);
    try {
      await deleteDoc(doc(firestore, 'reels', reelId));
      toast({ variant: 'success', title: "Reel Dihapus" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Gagal Menghapus" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!firestore) return;
    setProcessingId(bookId);
    try {
      await deleteDoc(doc(firestore, 'books', bookId));
      toast({ variant: 'success', title: "Karya Dilenyapkan", description: "Jejak narasi tersebut telah dihapus selamanya kawan." });
    } catch (e) {
      toast({ variant: 'destructive', title: "Gagal Melenyapkan" });
    } finally {
      setProcessingId(null);
      setDeleteConfirmId(null);
    }
  };

  if (booksError || reelsError) {
      return (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
              <div className="p-4 bg-destructive/10 rounded-full text-destructive"><AlertCircle className="h-8 w-8" /></div>
              <h2 className="text-xl font-headline font-black">Gangguan Koneksi Arsip</h2>
              <p className="text-sm text-muted-foreground max-w-xs">Terjadi kesalahan saat memuat data. Silakan muat ulang halaman atau hubungi dukungan teknis.</p>
              <Button variant="outline" onClick={() => window.location.reload()} className="rounded-full">Muat Ulang Halaman</Button>
          </div>
      )
  }

  return (
    <div className="max-w-5xl mx-auto pb-32 space-y-10 px-1 overflow-x-hidden">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest mb-3">
            <LayoutGrid className="h-3 w-3" /> Workspace Penulis
          </div>
          <h1 className="text-4xl md:text-6xl font-headline font-black tracking-tight leading-none">
            Studio <span className="text-primary italic">Elitera</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-3 font-medium">Kelola mahakarya dan jaringan kolaborasi Anda.</p>
        </motion.div>
        
        <Button className="rounded-full font-black shadow-xl shadow-primary/20 h-12 md:h-14 px-8 text-xs md:text-sm uppercase tracking-widest" asChild>
            <Link href="/upload">
                <LayoutGrid className="mr-2 h-4 w-4" /> Karya Baru
            </Link>
        </Button>
      </div>

      <Tabs defaultValue="books" className="space-y-10">
        <div className="flex items-center overflow-x-auto no-scrollbar pb-2 border-b border-border/40">
            <TabsList className="bg-muted/50 p-1 rounded-full h-auto flex-shrink-0">
                <TabsTrigger value="books" className="rounded-full px-8 py-3 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all">Karya Saya</TabsTrigger>
                <TabsTrigger value="team-projects" className="rounded-full px-8 py-3 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all gap-2">
                    Proyek Tim {teamProjects.length > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-full text-[8px]">{teamProjects.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="reels" className="rounded-full px-8 py-3 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all">Reels</TabsTrigger>
                <TabsTrigger value="collabs" className="rounded-full px-8 py-3 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all gap-2">
                    Undangan {invitations && invitations.length > 0 && <span className="bg-rose-500 text-white px-2 py-0.5 rounded-full text-[8px]">{invitations.length}</span>}
                </TabsTrigger>
            </TabsList>
        </div>

        <AnimatePresence mode="wait">
            <TabsContent value="books" key="books" className="mt-0">
                {isBooksLoading ? (
                    <div className="flex flex-col items-center py-20 gap-4 opacity-40">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="font-black uppercase text-[10px] tracking-widest">Sinkronisasi Arsip...</p>
                    </div>
                ) : myBooks?.length === 0 ? (
                    <div className="py-24 text-center bg-card/50 backdrop-blur-sm rounded-[3rem] border-2 border-dashed flex flex-col items-center gap-6">
                        <div className="p-8 bg-muted rounded-[2rem]"><BookOpen className="h-12 w-12 text-muted-foreground/30" /></div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-headline font-black">Mulai Narasi Anda</h3>
                            <p className="text-muted-foreground max-w-xs mx-auto">Anda belum memiliki draf karya. Mari ciptakan sesuatu yang luar biasa hari ini.</p>
                        </div>
                        <Button asChild className="rounded-full px-10 h-12 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
                            <Link href="/upload">Buat Karya Pertama</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {myBooks?.map((book, idx) => (
                            <motion.div key={book.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                                <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden group hover:-translate-y-1 transition-all duration-500 bg-card">
                                    <div className="aspect-[16/9] relative overflow-hidden">
                                        <img src={book.coverUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                                            <Badge className={cn(
                                                "rounded-full px-3 py-1 font-black text-[8px] uppercase tracking-widest",
                                                book.status === 'published' ? "bg-emerald-500" : book.status === 'pending_review' ? "bg-orange-500" : "bg-primary"
                                            )}>
                                                {book.status === 'published' ? 'Terbit' : book.status === 'pending_review' ? 'Moderasi' : 'Draf'}
                                            </Badge>
                                            <div className="flex gap-3 text-white">
                                                <div className="flex items-center gap-1"><Eye className="h-3 w-3" /><span className="text-[10px] font-black">{book.viewCount}</span></div>
                                                <div className="flex items-center gap-1"><Heart className="h-3 w-3" /><span className="text-[10px] font-black">{book.favoriteCount}</span></div>
                                            </div>
                                        </div>
                                    </div>
                                    <CardContent className="p-6 space-y-4">
                                        <div>
                                            <h3 className="font-headline text-lg font-black truncate italic">"{book.title}"</h3>
                                            <p className="text-[10px] font-black uppercase text-primary tracking-widest mt-1">{book.genre} • {book.type === 'screenplay' ? 'Naskah Film' : book.type === 'poem' ? 'Puisi' : 'Buku'}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Button className="w-full rounded-2xl h-12 font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-primary/20 transition-all active:scale-95" asChild>
                                                <Link href={`/books/${book.id}/edit`}>
                                                    <Edit className="mr-2 h-3.5 w-3.5" /> Buka Editor
                                                </Link>
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                className="w-full rounded-2xl h-12 font-black uppercase text-[10px] tracking-[0.2em] text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                                onClick={() => setDeleteConfirmId(book.id)}
                                            >
                                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Hapus Karya
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}
            </TabsContent>

            <TabsContent value="team-projects" key="team-projects" className="mt-0">
                {isCollabLoading ? (
                    <div className="flex flex-col items-center py-20 gap-4 opacity-40">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="font-black uppercase text-[10px] tracking-widest">Sinkronisasi Proyek Tim...</p>
                    </div>
                ) : teamProjects.length === 0 ? (
                    <div className="py-24 text-center bg-muted/20 rounded-[3rem] border-2 border-dashed flex flex-col items-center gap-6">
                        <div className="p-8 bg-background rounded-[2rem] shadow-sm"><Users className="h-12 w-12 text-muted-foreground/30" /></div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-headline font-black">Kolaborasi Aktif</h3>
                            <p className="text-muted-foreground max-w-xs mx-auto">Anda belum memiliki proyek bersama penulis lain. Terima undangan kolaborasi untuk tampil di sini.</p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {teamProjects.map((book, idx) => (
                            <motion.div key={book.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
                                <Card className="border-none shadow-xl rounded-[2.5rem] overflow-hidden group hover:-translate-y-1 transition-all duration-500 bg-card border border-primary/10">
                                    <div className="aspect-[16/9] relative overflow-hidden">
                                        <img src={book.coverUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                        <div className="absolute top-4 left-4">
                                            <Badge className="bg-indigo-600 text-white border-none rounded-full px-3 py-1 font-black text-[8px] uppercase tracking-widest">
                                                <Briefcase className="h-2 w-2 mr-1.5" /> Kolaborator
                                            </Badge>
                                        </div>
                                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                                            <Badge className={cn(
                                                "rounded-full px-3 py-1 font-black text-[8px] uppercase tracking-widest",
                                                book.status === 'published' ? "bg-emerald-500" : "bg-orange-500"
                                            )}>
                                                {book.status === 'published' ? 'Terbit' : 'Dalam Proses'}
                                            </Badge>
                                            <p className="text-[9px] font-black text-white/60">Arsitek: {book.authorName}</p>
                                        </div>
                                    </div>
                                    <CardContent className="p-6 space-y-4">
                                        <div>
                                            <h3 className="font-headline text-lg font-black truncate italic">"{book.title}"</h3>
                                            <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mt-1">Tim Kolaborasi • {book.type === 'screenplay' ? 'Naskah' : book.type === 'poem' ? 'Puisi' : 'Buku'}</p>
                                        </div>
                                        <Button className="w-full rounded-2xl h-12 font-black uppercase text-[10px] tracking-[0.2em] shadow-lg shadow-indigo-500/20 bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-95" asChild>
                                            <Link href={`/books/${book.id}/edit`}>
                                                <Edit className="mr-2 h-3.5 w-3.5" /> Bantu Menulis
                                            </Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}
            </TabsContent>

            <TabsContent value="reels" key="reels" className="mt-0">
                {isReelsLoading ? (
                    <div className="flex flex-col items-center py-20 gap-4 opacity-40">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : myReels?.length === 0 ? (
                    <div className="py-24 text-center opacity-30 flex flex-col items-center gap-4">
                        <Film className="h-16 w-16" />
                        <p className="font-black uppercase tracking-widest text-sm">Belum ada video Reels.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {myReels?.map((reel) => (
                            <motion.div key={reel.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative group aspect-[9/16] rounded-[2rem] overflow-hidden bg-black shadow-xl">
                                <video src={reel.videoUrl} className="w-full h-full object-cover opacity-60" muted />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/60 flex flex-col justify-end p-4">
                                    <p className="text-white text-[10px] font-medium line-clamp-2 italic mb-3 opacity-80">"{reel.caption}"</p>
                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-2">
                                            <div className="flex items-center gap-1 text-white/60 text-[8px] font-black"><Heart className="h-2.5 w-2.5" /> {reel.likes}</div>
                                            <div className="flex items-center gap-1 text-white/60 text-[8px] font-black"><MessageSquare className="h-2.5 w-2.5" /> {reel.commentCount}</div>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 rounded-full text-rose-500 hover:bg-rose-500 hover:text-white transition-all" 
                                            onClick={() => handleDeleteReel(reel.id)}
                                            disabled={processingId === reel.id}
                                        >
                                            {processingId === reel.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                        </Button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </TabsContent>

            <TabsContent value="collabs" key="collabs" className="mt-0">
                <div className="max-w-2xl mx-auto space-y-6">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-2xl"><Users className="h-6 w-6" /></div>
                        <div>
                            <h2 className="text-2xl font-headline font-black">Undangan <span className="text-indigo-600 italic">Kolaborasi</span></h2>
                            <p className="text-xs text-muted-foreground font-medium">Permintaan untuk menulis bersama rekan pujangga.</p>
                        </div>
                    </div>

                    {isInvitesLoading ? (
                        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : invitations?.length === 0 ? (
                        <div className="py-20 text-center bg-indigo-50/50 rounded-[2.5rem] border-2 border-dashed border-indigo-100 opacity-40">
                            <Sparkles className="h-12 w-12 mx-auto mb-4 text-indigo-300" />
                            <p className="font-bold text-sm text-indigo-900">Hening. Tidak ada undangan baru.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {invitations?.map((invite) => (
                                <motion.div key={invite.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                                    <Card className="border-none shadow-lg rounded-[2rem] overflow-hidden bg-white group hover:shadow-2xl transition-all">
                                        <CardContent className="p-6 flex items-center justify-between gap-6">
                                            <div className="flex items-center gap-5 min-w-0">
                                                <div className="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                                                    <BookOpen className="h-7 w-7" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-1">Undangan Penulis</p>
                                                    <h4 className="font-headline text-lg font-black truncate">"{invite.bookTitle}"</h4>
                                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-tighter mt-0.5">Dari Arsitek: {invite.ownerName}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-12 w-12 rounded-full text-rose-500 hover:bg-rose-50 transition-all border border-transparent hover:border-rose-100"
                                                    onClick={() => handleRejectInvite(invite.id)}
                                                    disabled={!!processingId}
                                                >
                                                    <X className="h-5 w-5" />
                                                </Button>
                                                <Button 
                                                    className="h-12 px-6 rounded-full font-black text-[10px] uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-500/20"
                                                    onClick={() => handleAcceptInvite(invite)}
                                                    disabled={!!processingId}
                                                >
                                                    {processingId === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="mr-2 h-4 w-4" /> Setujui</>}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </TabsContent>
        </AnimatePresence>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
            <AlertDialogHeader>
                <div className="mx-auto bg-rose-50 p-4 rounded-2xl w-fit mb-4"><AlertTriangle className="h-8 w-8 text-rose-500" /></div>
                <AlertDialogTitle className="font-headline text-2xl font-black text-center">Lenyapkan Karya?</AlertDialogTitle>
                <AlertDialogDescription className="text-center font-medium leading-relaxed">
                    Tindakan ini permanen kawan. Seluruh bab, apresiasi, dan sejarah narasi dari karya ini akan hilang selamanya dari semesta Elitera.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 flex flex-col sm:flex-row gap-3">
                <AlertDialogCancel className="rounded-full h-12 flex-1 border-2 font-bold">Batal</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={() => deleteConfirmId && handleDeleteBook(deleteConfirmId)} 
                    className="rounded-full h-12 flex-1 bg-rose-500 font-black shadow-lg shadow-rose-500/20"
                    disabled={!!processingId}
                >
                    {processingId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ya, Lenyapkan"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
