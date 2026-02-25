
'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, doc, updateDoc, arrayUnion, arrayRemove, query, where, limit, getDocs, serverTimestamp, setDoc, addDoc } from 'firebase/firestore';
import type { User, Book } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, Trash2, Search, Loader2, Users, ShieldCheck, Plus, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface CollaboratorManagerProps {
  book: Book;
}

export function CollaboratorManager({ book }: CollaboratorManagerProps) {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const isOwner = currentUser?.uid === book.authorId;

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length < 2 || !firestore) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const term = searchTerm.trim();
        const capitalized = term.charAt(0).toUpperCase() + term.slice(1);
        const usersRef = collection(firestore, 'users');
        const q = query(
          usersRef, 
          where('displayName', '>=', capitalized), 
          where('displayName', '<=', capitalized + '\uf8ff'),
          limit(5)
        );
        const snap = await getDocs(q);
        const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
        
        setSearchResults(results.filter(u => 
            u.uid !== book.authorId && 
            !(book.collaboratorUids || []).includes(u.uid)
        ));
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, firestore, book.authorId, book.collaboratorUids]);

  const handleInviteCollaborator = async (user: User) => {
    if (!firestore || !isOwner || !currentUser) return;
    setIsProcessing(user.uid);
    try {
      // 1. Check if invitation already exists
      // Filter by ownerId to satisfy Firestore Security Rules
      const invitesRef = collection(firestore, 'collaborationInvitations');
      const q = query(
        invitesRef, 
        where('bookId', '==', book.id), 
        where('collaboratorId', '==', user.uid),
        where('ownerId', '==', currentUser.uid),
        where('status', '==', 'pending')
      );
      const existing = await getDocs(q);
      
      if (!existing.empty) {
        toast({ title: "Undangan Sudah Ada", description: "Pujangga ini sudah memiliki undangan pending." });
        return;
      }

      // 2. Create official invitation
      await addDoc(invitesRef, {
        bookId: book.id,
        bookTitle: book.title,
        ownerId: currentUser.uid,
        ownerName: currentUser.displayName,
        collaboratorId: user.uid,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // 3. Send Notification
      const notificationRef = doc(collection(firestore, `users/${user.uid}/notifications`));
      await setDoc(notificationRef, {
          type: 'follow', 
          text: `${currentUser.displayName} mengundang Anda berkolaborasi pada karya: "${book.title}"`,
          link: `/studio`,
          actor: {
              uid: currentUser.uid,
              displayName: currentUser.displayName!,
              photoURL: currentUser.photoURL!,
          },
          read: false,
          createdAt: serverTimestamp(),
      });

      toast({ variant: 'success', title: "Undangan Terkirim", description: `Menunggu persetujuan dari ${user.displayName}.` });
      setSearchTerm("");
      setSearchResults([]);
    } catch (e) {
      console.error("Error inviting collaborator:", e);
      toast({ variant: 'destructive', title: "Gagal Mengirim Undangan" });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRemoveCollaborator = async (collab: any) => {
    if (!firestore || !isOwner) return;
    setIsProcessing(collab.uid);
    try {
      const bookRef = doc(firestore, 'books', book.id);
      await updateDoc(bookRef, {
        collaboratorUids: arrayRemove(collab.uid),
        collaborators: arrayRemove(collab)
      });
      toast({ title: "Kolaborator Dihapus" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Gagal Menghapus" });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-10 pb-20 max-w-4xl mx-auto px-4 md:px-0">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-sm ring-1 ring-primary/20">
            <Users className="h-6 w-6" />
        </div>
        <div>
            <h2 className="text-2xl font-headline font-black tracking-tight">Manajemen <span className="text-primary italic">Kolaborasi</span></h2>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">Tulis Mahakarya Bersama Rekan Pujangga</p>
        </div>
      </div>

      <div className="grid md:grid-cols-12 gap-10">
        <div className="md:col-span-7 space-y-8">
            <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                <CardHeader className="bg-primary/5 p-8 border-b border-primary/10">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="text-xl font-headline font-bold flex items-center gap-2">
                                <Users className="h-5 w-5 text-primary" /> Tim Penulis
                            </CardTitle>
                            <CardDescription className="text-xs">Pengguna yang memiliki hak akses penuh ke editor.</CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-white/50 text-[10px] font-black uppercase tracking-tighter">
                            {1 + (book.collaboratorUids?.length || 0)} Orang
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-border/30">
                        <div className="flex items-center justify-between p-6 bg-primary/5">
                            <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12 border-2 border-primary shadow-sm">
                                    <AvatarImage src={book.authorAvatarUrl} className="object-cover" />
                                    <AvatarFallback className="bg-primary/10 text-primary font-black">{book.authorName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-black text-sm">{book.authorName}</p>
                                    <div className="flex items-center gap-1 text-[9px] font-black uppercase text-primary tracking-widest mt-0.5">
                                        <ShieldCheck className="h-3 w-3" /> Arsitek Narasi (Pemilik)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {book.collaborators?.map((collab) => (
                            <div key={collab.uid} className="flex items-center justify-between p-6 transition-colors hover:bg-muted/30 group">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                                        <AvatarImage src={collab.photoURL} className="object-cover" />
                                        <AvatarFallback className="bg-muted text-muted-foreground font-black">{collab.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-bold text-sm">{collab.displayName}</p>
                                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">@{collab.username}</p>
                                    </div>
                                </div>
                                {isOwner && (
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-10 w-10 text-rose-500 hover:bg-rose-50 rounded-xl opacity-0 group-hover:opacity-100 transition-all" 
                                        onClick={() => handleRemoveCollaborator(collab)}
                                        disabled={!!isProcessing}
                                    >
                                        {isProcessing === collab.uid ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </Button>
                                )}
                            </div>
                        ))}

                        {(!book.collaborators || book.collaborators.length === 0) && (
                            <div className="p-12 text-center opacity-30 italic font-medium text-sm">Belum ada rekan kolaborasi.</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="md:col-span-5 space-y-8">
            {isOwner ? (
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-indigo-950 text-white overflow-hidden relative group">
                    <div className="absolute -top-1 -right-1 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                    <CardHeader className="p-8 pb-4">
                        <CardTitle className="text-xl font-headline font-black flex items-center gap-3">
                            <Mail className="h-6 w-6 text-indigo-400" /> Undang Rekan
                        </CardTitle>
                        <CardDescription className="text-indigo-200/60 font-medium">Kirim undangan kolaborasi resmi.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 space-y-6">
                        <div className="relative">
                            <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors", isSearching ? "text-primary animate-pulse" : "text-indigo-300/40")} />
                            <Input 
                                placeholder="Cari nama pujangga..." 
                                className="h-12 pl-11 rounded-2xl bg-white/10 border-none text-white placeholder:text-indigo-200/30 focus-visible:ring-primary/50 font-medium shadow-inner"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <AnimatePresence mode="popLayout">
                                {searchResults.map((user) => (
                                    <motion.div 
                                        key={user.id} 
                                        initial={{ opacity: 0, y: 10 }} 
                                        animate={{ opacity: 1, y: 0 }} 
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9 border border-white/20">
                                                <AvatarImage src={user.photoURL} />
                                                <AvatarFallback className="bg-white/10 text-white font-black text-xs">{user.displayName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="font-bold text-xs truncate max-w-[120px]">{user.displayName}</p>
                                                <p className="text-[9px] text-indigo-300/50 uppercase tracking-widest truncate">@{user.username}</p>
                                            </div>
                                        </div>
                                        <Button 
                                            size="sm" 
                                            className="h-8 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest bg-white text-indigo-950 hover:bg-indigo-50 shadow-lg active:scale-95" 
                                            onClick={() => handleInviteCollaborator(user)}
                                            disabled={!!isProcessing}
                                        >
                                            {isProcessing === user.uid ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Plus className="h-3 w-3 mr-1" /> Undang</>}
                                        </Button>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-card p-8 space-y-6 text-center">
                    <div className="p-4 bg-muted rounded-2xl w-fit mx-auto">
                        <Users className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="font-headline text-xl font-black">Mode Kolaborasi Aktif</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed italic">"Anda sedang berkolaborasi membangun mahakarya ini."</p>
                    </div>
                </Card>
            )}
        </div>
      </div>
    </div>
  );
}
