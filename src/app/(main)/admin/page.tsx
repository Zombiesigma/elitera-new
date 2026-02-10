'use client';

import { useMemo, useState } from "react";
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, doc, writeBatch, updateDoc, where, deleteDoc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  Users, 
  ShieldCheck, 
  BookCopy, 
  Megaphone, 
  CheckCircle2, 
  Trash2, 
  Flame, 
  ChevronRight,
  PenTool,
  Activity,
  ShieldAlert
} from "lucide-react";
import type { AuthorRequest, Book, User as AppUser, Story } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function AdminPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: adminProfile, isLoading: isAdminChecking } = useDoc<AppUser>(
    (firestore && currentUser) ? doc(firestore, 'users', currentUser.uid) : null
  );

  const isAdmin = adminProfile?.role === 'admin';

  // Permintaan Penulis
  const authorRequestsQuery = useMemo(() => (
    (firestore && currentUser) ? collection(firestore, 'authorRequests') : null
  ), [firestore, currentUser]);
  const { data: rawAuthorRequests, isLoading: areAuthorRequestsLoading } = useCollection<AuthorRequest>(authorRequestsQuery);
  
  const authorRequests = useMemo(() => (
    rawAuthorRequests?.filter(r => r.status === 'pending') || []
  ), [rawAuthorRequests]);

  const pendingBooksQuery = useMemo(() => (
    (firestore && currentUser) ? query(collection(firestore, 'books'), where('status', '==', 'pending_review')) : null
  ), [firestore, currentUser]);
  const { data: pendingBooks, isLoading: areBooksLoading } = useCollection<Book>(pendingBooksQuery);
  
  const usersQuery = useMemo(() => (
    (firestore && currentUser) ? collection(firestore, 'users') : null
  ), [firestore, currentUser]);
  const { data: users, isLoading: areUsersLoading } = useCollection<AppUser>(usersQuery);

  const storiesQuery = useMemo(() => (
    (firestore && currentUser) ? collection(firestore, 'stories') : null
  ), [firestore, currentUser]);
  const { data: activeStories, isLoading: areStoriesLoading } = useCollection<Story>(storiesQuery);

  const stats = useMemo(() => {
    if (!users) return { total: 0, admins: 0, penulis: 0, pembaca: 0 };
    return {
      total: users.length,
      admins: users.filter(u => u.role === 'admin').length,
      penulis: users.filter(u => u.role === 'penulis').length,
      pembaca: users.filter(u => u.role === 'pembaca').length,
    }
  }, [users]);

  const handleApproveAuthor = async (request: AuthorRequest) => {
    if (!firestore) return;
    setProcessingId(request.id);
    try {
      const batch = writeBatch(firestore);
      const requestRef = doc(firestore, 'authorRequests', request.id);
      batch.update(requestRef, { status: 'approved' });
      const userRef = doc(firestore, 'users', request.userId);
      batch.update(userRef, { role: 'penulis' });
      await batch.commit();
      toast({ variant: 'success', title: "Penulis Disetujui", description: `${request.name} sekarang adalah seorang penulis resmi.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal Menyetujui" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveBook = async (bookId: string, bookTitle: string) => {
    if (!firestore) return;
    setProcessingId(bookId);
    try {
      const bookRef = doc(firestore, 'books', bookId);
      const bookSnap = await getDoc(bookRef);
      
      if (!bookSnap.exists()) {
          toast({ variant: 'destructive', title: "Buku tidak ditemukan" });
          return;
      }
      
      const bookData = bookSnap.data() as Book;
      const batch = writeBatch(firestore);
      
      batch.update(bookRef, { status: 'published' });

      if (bookData.visibility === 'followers_only') {
          const followersRef = collection(firestore, 'users', bookData.authorId, 'followers');
          const followersSnap = await getDocs(followersRef);
          
          followersSnap.forEach((followerDoc) => {
              const followerId = followerDoc.id;
              const notificationRef = doc(collection(firestore, `users/${followerId}/notifications`));
              batch.set(notificationRef, {
                  type: 'broadcast',
                  text: `${bookData.authorName} telah menerbitkan karya eksklusif: ${bookData.title}`,
                  link: `/books/${bookId}`,
                  actor: {
                      uid: bookData.authorId,
                      displayName: bookData.authorName,
                      photoURL: bookData.authorAvatarUrl,
                  },
                  read: false,
                  createdAt: serverTimestamp(),
              });
          });
      }

      await batch.commit();
      toast({ 
        variant: 'success', 
        title: "Buku Disetujui", 
        description: `"${bookTitle}" telah berhasil diterbitkan.` 
      });
    } catch (error) {
      console.error("Error approving book:", error);
      toast({ variant: "destructive", title: "Gagal Menyetujui" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (!firestore) return;
    setProcessingId(storyId);
    try {
      await deleteDoc(doc(firestore, 'stories', storyId));
      toast({ variant: 'success', title: "Cerita Dihapus" });
    } catch (error) {
      toast({ variant: "destructive", title: "Gagal Menghapus" });
    } finally {
      setProcessingId(null);
    }
  };

  if (isAdminChecking) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Verifikasi Otoritas...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4 space-y-6">
        <div className="p-6 bg-destructive/10 rounded-full w-fit mx-auto">
          <ShieldAlert className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-3xl font-headline font-black">Akses Terbatas</h1>
        <p className="text-muted-foreground">Anda tidak memiliki izin untuk mengakses area kontrol pusat.</p>
        <Button asChild className="rounded-full w-full">
          <Link href="/">Kembali ke Beranda</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-10 pb-20 w-full overflow-x-hidden px-1">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest mb-3">
            <ShieldCheck className="h-3 w-3" /> Dashboard Otoritas Elitera
          </div>
          <h1 className="text-3xl md:text-5xl font-headline font-black tracking-tight leading-none">
            Pusat <span className="text-primary italic">Kendali</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 font-medium">Monitoring ekosistem dan moderasi karya.</p>
        </motion.div>
        
        <div className="grid grid-cols-2 md:flex gap-2">
            <Button variant="outline" className="rounded-full font-bold shadow-sm h-11 md:h-12 px-4 md:px-6 text-xs md:text-sm" asChild>
                <Link href="/admin/broadcast">
                    <Megaphone className="mr-2 h-4 w-4 text-orange-500" /> Siaran
                </Link>
            </Button>
            <Button className="rounded-full font-bold shadow-lg shadow-primary/20 h-11 md:h-12 px-4 md:px-6 text-xs md:text-sm" asChild>
                <Link href="/admin/users">
                    <Users className="mr-2 h-4 w-4" /> Anggota
                </Link>
            </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <Card className="md:col-span-8 border-none shadow-xl rounded-[2rem] md:rounded-[2.5rem] bg-indigo-950 text-white overflow-hidden relative group">
            <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-700" />
            <CardHeader className="p-6 md:p-8 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-xl md:text-2xl font-headline font-black flex items-center gap-3">
                            <Activity className="h-5 w-5 md:h-6 md:w-6 text-indigo-400" /> Statistik Anggota
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-2 bg-white/10 px-2.5 py-1 rounded-full border border-white/10">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Live</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6 md:p-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                    <div className="space-y-1">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-300/50">Total</p>
                        <p className="text-2xl md:text-4xl font-black">{areUsersLoading ? '...' : stats.total}</p>
                        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} className="h-full bg-white" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-300/50">Pujangga</p>
                        <p className="text-2xl md:text-4xl font-black">{areUsersLoading ? '...' : stats.penulis}</p>
                        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(stats.penulis/Math.max(stats.total, 1))*100}%` }} className="h-full bg-emerald-400" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-300/50">Pembaca</p>
                        <p className="text-2xl md:text-4xl font-black">{areUsersLoading ? '...' : stats.pembaca}</p>
                        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(stats.pembaca/Math.max(stats.total, 1))*100}%` }} className="h-full bg-blue-400" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-300/50">Admin</p>
                        <p className="text-2xl md:text-4xl font-black">{areUsersLoading ? '...' : stats.admins}</p>
                        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${(stats.admins/Math.max(stats.total, 1))*100}%` }} className="h-full bg-rose-400" />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="md:col-span-4 border-none shadow-xl rounded-[2rem] bg-card p-6 md:p-8 flex flex-col justify-between group overflow-hidden relative">
            <div className="absolute bottom-[-20%] right-[-10%] p-10 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-32 w-32 md:h-40 md:w-40 text-primary" />
            </div>
            <div className="space-y-4 relative z-10">
                <div className="p-3 rounded-2xl bg-primary/5 text-primary w-fit">
                    <ShieldCheck className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <h3 className="text-lg font-bold font-headline">Status Sistem</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] md:text-xs font-bold">
                        <span className="text-muted-foreground">Database Core</span>
                        <span className="text-emerald-600">Terhubung</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] md:text-xs font-bold">
                        <span className="text-muted-foreground">Auth Security</span>
                        <span className="text-emerald-600">Optimal</span>
                    </div>
                </div>
            </div>
            <Button variant="ghost" className="w-full mt-6 rounded-xl font-bold bg-muted/50 group-hover:bg-primary group-hover:text-white transition-all text-xs">
                Cek Log Sistem <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
        </Card>
      </div>

      <Tabs defaultValue="authors" className="space-y-6">
        <div className="flex items-center overflow-x-auto no-scrollbar pb-2">
            <TabsList className="bg-muted/50 p-1 rounded-full h-auto">
                <TabsTrigger value="authors" className="rounded-full px-4 md:px-6 py-2 text-xs font-bold transition-all">
                    Penulis {authorRequests && authorRequests.length > 0 && <span className="ml-1.5 bg-rose-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{authorRequests.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="books" className="rounded-full px-4 md:px-6 py-2 text-xs font-bold transition-all">
                    Buku {pendingBooks && pendingBooks.length > 0 && <span className="ml-1.5 bg-rose-500 text-white text-[8px] px-1.5 py-0.5 rounded-full">{pendingBooks.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="stories" className="rounded-full px-4 md:px-6 py-2 text-xs font-bold transition-all">
                    Story
                </TabsTrigger>
            </TabsList>
        </div>

        <AnimatePresence mode="wait">
            <TabsContent value="authors" key="tab-authors" className="mt-0">
                <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b p-6 md:p-8">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-white text-primary rounded-xl shadow-sm">
                                <PenTool className="h-5 w-5 md:h-6 md:w-6" />
                            </div>
                            <CardTitle className="text-lg md:text-2xl font-headline font-black">Permintaan Penulis</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow>
                                        <TableHead className="px-6 font-black uppercase text-[9px] tracking-widest whitespace-nowrap">Kandidat</TableHead>
                                        <TableHead className="font-black uppercase text-[9px] tracking-widest whitespace-nowrap">Kontak</TableHead>
                                        <TableHead className="text-right px-6 font-black uppercase text-[9px] tracking-widest whitespace-nowrap">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {areAuthorRequestsLoading ? (
                                        <TableRow><TableCell colSpan={3} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                    ) : authorRequests.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-48 text-center">
                                                <div className="opacity-30">
                                                    <CheckCircle2 className="h-10 w-10 mx-auto mb-2" />
                                                    <p className="font-bold text-sm">Antrean Kosong</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : authorRequests.map(request => (
                                        <TableRow key={request.id}>
                                            <TableCell className="px-6 py-4 font-bold text-sm">{request.name}</TableCell>
                                            <TableCell className="text-xs">
                                                <p className="truncate max-w-[120px]">{request.email}</p>
                                                {request.portfolio && <a href={request.portfolio} target="_blank" className="text-[10px] text-primary font-black hover:underline">Link Portofolio</a>}
                                            </TableCell>
                                            <TableCell className="text-right px-6 space-x-1.5 whitespace-nowrap">
                                                <Button size="sm" onClick={() => handleApproveAuthor(request)} disabled={!!processingId} className="rounded-full h-8 px-3 text-[10px] bg-emerald-600">Setuju</Button>
                                                <Button variant="outline" size="sm" className="rounded-full h-8 px-3 text-[10px] border-rose-100 text-rose-600">Tolak</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="books" key="tab-books" className="mt-0">
                <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b p-6 md:p-8">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-white text-primary rounded-xl shadow-sm">
                                <BookCopy className="h-5 w-5 md:h-6 md:w-6" />
                            </div>
                            <CardTitle className="text-lg md:text-2xl font-headline font-black">Moderasi Buku</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow>
                                        <TableHead className="px-6 font-black uppercase text-[9px] tracking-widest whitespace-nowrap">Karya</TableHead>
                                        <TableHead className="font-black uppercase text-[9px] tracking-widest whitespace-nowrap">Penulis</TableHead>
                                        <TableHead className="text-right px-6 font-black uppercase text-[9px] tracking-widest whitespace-nowrap">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {areBooksLoading ? (
                                        <TableRow><TableCell colSpan={3} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                    ) : pendingBooks?.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="h-48 text-center opacity-30 font-bold text-sm">Tidak ada antrean.</TableCell></TableRow>
                                    ) : pendingBooks?.map(book => (
                                        <TableRow key={book.id}>
                                            <TableCell className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-7 bg-muted rounded shadow-sm overflow-hidden shrink-0 relative">
                                                        <img src={book.coverUrl} alt="" className="object-cover h-full w-full" />
                                                    </div>
                                                    <p className="font-black text-xs truncate max-w-[100px]">{book.title}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold text-[10px] truncate max-w-[80px]">{book.authorName}</TableCell>
                                            <TableCell className="text-right px-6 space-x-1.5 whitespace-nowrap">
                                                <Button size="sm" onClick={() => handleApproveBook(book.id, book.title)} disabled={!!processingId} className="rounded-full h-8 px-3 text-[10px]">Terbit</Button>
                                                <Button variant="outline" size="sm" className="rounded-full h-8 px-3 text-[10px]" asChild><Link href={`/books/${book.id}`}>Cek</Link></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="stories" key="tab-stories" className="mt-0">
                <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b p-6 md:p-8">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 bg-white text-primary rounded-xl shadow-sm">
                                <Flame className="h-5 w-5 md:h-6 md:w-6" />
                            </div>
                            <CardTitle className="text-lg md:text-2xl font-headline font-black">Story Aktif</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/10">
                                    <TableRow>
                                        <TableHead className="px-6 font-black uppercase text-[9px] tracking-widest whitespace-nowrap">User</TableHead>
                                        <TableHead className="font-black uppercase text-[9px] tracking-widest whitespace-nowrap">Konten</TableHead>
                                        <TableHead className="text-right px-6 font-black uppercase text-[9px] tracking-widest whitespace-nowrap">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {areStoriesLoading ? (
                                        <TableRow><TableCell colSpan={3} className="h-32 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></TableCell></TableRow>
                                    ) : activeStories?.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="h-48 text-center opacity-30 font-bold text-sm">Hening...</TableCell></TableRow>
                                    ) : activeStories?.map(story => (
                                        <TableRow key={story.id}>
                                            <TableCell className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-7 w-7">
                                                        <AvatarImage src={story.authorAvatarUrl} />
                                                        <AvatarFallback>{story.authorName.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <p className="font-bold text-[10px] truncate max-w-[80px]">{story.authorName}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-[10px] italic truncate max-w-[120px]">"{story.content || 'Konten Media'}"</TableCell>
                                            <TableCell className="text-right px-6">
                                                <Button variant="ghost" size="icon" onClick={() => handleDeleteStory(story.id)} className="text-rose-500 rounded-full h-8 w-8"><Trash2 className="h-4 w-4"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
        </AnimatePresence>
      </Tabs>
    </div>
  );
}
