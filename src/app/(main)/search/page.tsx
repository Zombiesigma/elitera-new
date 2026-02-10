
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import type { Book, User } from '@/lib/types';
import { BookCard } from '@/components/BookCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Loader2, Search, Users, BookOpen, Sparkles, Filter } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const q = searchParams.get('q') || '';
  const [activeTab, setActiveTab] = useState('all');
  
  const capitalizedQuery = useMemo(() => {
      if (!q.trim()) return '';
      return q.charAt(0).toUpperCase() + q.slice(1);
  }, [q]);

  const booksQuery = useMemo(() => {
    if (!firestore || !currentUser || !capitalizedQuery) return null;
    return query(
      collection(firestore, 'books'),
      where('status', '==', 'published'),
      where('visibility', '==', 'public'),
      where('title', '>=', capitalizedQuery),
      where('title', '<=', capitalizedQuery + '\uf8ff'),
      limit(24)
    );
  }, [firestore, currentUser, capitalizedQuery]);

  const usersQuery = useMemo(() => {
    if (!firestore || !currentUser || !capitalizedQuery) return null;
    return query(
      collection(firestore, 'users'),
      where('displayName', '>=', capitalizedQuery),
      where('displayName', '<=', capitalizedQuery + '\uf8ff'),
      limit(24)
    );
  }, [firestore, currentUser, capitalizedQuery]);
  
  const { data: books, isLoading: areBooksLoading } = useCollection<Book>(booksQuery);
  const { data: users, isLoading: areUsersLoading } = useCollection<User>(usersQuery);
  
  const isLoading = areBooksLoading || areUsersLoading;
  
  if (!q) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-20 text-center space-y-6"
      >
        <div className="p-8 bg-muted rounded-[2.5rem] shadow-inner">
            <Search className="h-16 w-16 text-muted-foreground/30" />
        </div>
        <div className="space-y-2">
            <h1 className="text-3xl font-headline font-black">Mulai Pencarian</h1>
            <p className="text-muted-foreground max-w-sm mx-auto">Masukkan kata kunci di bilah pencarian atas untuk menemukan karya agung atau pujangga berbakat.</p>
        </div>
      </motion.div>
    );
  }

  const resultCount = (books?.length || 0) + (users?.length || 0);

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="space-y-4"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
            <Sparkles className="h-3 w-3" /> Eksplorasi Elitera
        </div>
        <h1 className="text-4xl md:text-5xl font-headline font-black tracking-tight">
            Hasil untuk "<span className="text-primary italic">{q}</span>"
        </h1>
        <p className="text-muted-foreground font-medium flex items-center gap-2">
            Ditemukan {isLoading ? '...' : resultCount} hasil pencarian yang relevan.
        </p>
      </motion.div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="flex items-center justify-between border-b pb-4">
            <TabsList className="bg-muted/50 p-1.5 rounded-full h-auto">
                <TabsTrigger value="all" className="rounded-full px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold transition-all">Semua</TabsTrigger>
                <TabsTrigger value="books" className="rounded-full px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold transition-all flex gap-2">
                    Buku {books && books.length > 0 && <span className="text-[10px] bg-white/20 px-1.5 rounded-full">{books.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="users" className="rounded-full px-6 py-2 data-[state=active]:bg-primary data-[state=active]:text-white font-bold transition-all flex gap-2">
                    Pujangga {users && users.length > 0 && <span className="text-[10px] bg-white/20 px-1.5 rounded-full">{users.length}</span>}
                </TabsTrigger>
            </TabsList>
            
            <Button variant="outline" size="sm" className="rounded-full px-4 font-bold border-2 hidden sm:flex">
                <Filter className="mr-2 h-4 w-4" /> Filter Lanjut
            </Button>
        </div>
      
        {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-bold uppercase tracking-widest animate-pulse">Menyaring Semesta...</p>
            </div>
        ) : (
            <AnimatePresence mode="wait">
                <TabsContent value="all" key="all" className="space-y-12 mt-0">
                    {/* Integrated View */}
                    {users && users.length > 0 && (
                        <section className="space-y-6">
                            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground/60 pl-2 flex items-center gap-3">
                                <Users className="h-4 w-4" /> Pujangga Terpilih
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {users.map(user => (
                                    <Link href={`/profile/${user.username}`} key={user.id} className="group">
                                        <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm rounded-[1.5rem] hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden relative">
                                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Badge variant="secondary" className="rounded-full">Lihat Profil</Badge>
                                            </div>
                                            <CardContent className="p-5 flex items-center gap-4">
                                                <Avatar className="h-14 w-14 border-2 border-background shadow-md">
                                                    <AvatarImage src={user.photoURL} alt={user.displayName} />
                                                    <AvatarFallback className="bg-primary/5 text-primary font-black">{user.displayName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-base truncate group-hover:text-primary transition-colors">{user.displayName}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">@{user.username}</p>
                                                    <div className="flex items-center gap-3 mt-2 text-[10px] font-black text-muted-foreground/60 uppercase">
                                                        <span>{user.followers} Pengikut</span>
                                                        <span>•</span>
                                                        <span className="capitalize">{user.role}</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {users && users.length > 0 && books && books.length > 0 && <Separator className="opacity-50" />}

                    {books && books.length > 0 && (
                        <section className="space-y-6">
                            <h2 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground/60 pl-2 flex items-center gap-3">
                                <BookOpen className="h-4 w-4" /> Mahakarya Sastra
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                                {books.map(book => (
                                    <BookCard key={book.id} book={book} />
                                ))}
                            </div>
                        </section>
                    )}

                    {(!users?.length && !books?.length) && (
                        <div className="text-center py-20 bg-muted/20 rounded-[3rem] border-2 border-dashed flex flex-col items-center gap-6">
                            <div className="p-8 bg-background rounded-full shadow-inner">
                                <Search className="h-12 w-12 text-muted-foreground/20" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-2xl font-bold">Hening di Sini...</h2>
                                <p className="text-muted-foreground max-w-xs mx-auto">Kami tidak menemukan karya atau pujangga yang cocok dengan "<span className="font-bold text-foreground">{q}</span>".</p>
                            </div>
                            <Button variant="secondary" className="rounded-full px-8 font-bold" onClick={() => window.history.back()}>Kembali</Button>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="books" key="books" className="mt-0">
                    {books && books.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                            {books.map(book => <BookCard key={book.id} book={book} />)}
                        </div>
                    ) : (
                        <div className="text-center py-32 opacity-40">
                            <BookOpen className="h-16 w-16 mx-auto mb-4" />
                            <p className="font-bold">Tidak ada buku ditemukan.</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="users" key="users" className="mt-0">
                    {users && users.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {users.map(user => (
                                <Link href={`/profile/${user.username}`} key={user.id}>
                                    <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm rounded-[2rem] hover:shadow-2xl transition-all overflow-hidden">
                                        <CardContent className="p-6 flex items-center gap-5">
                                            <Avatar className="h-16 w-16 border-2 border-background shadow-xl">
                                                <AvatarImage src={user.photoURL} alt={user.displayName} />
                                                <AvatarFallback className="bg-primary/5 text-primary text-xl font-black">{user.displayName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="font-bold text-lg truncate group-hover:text-primary transition-colors">{user.displayName}</p>
                                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">@{user.username}</p>
                                                <div className="mt-3 flex items-center gap-2">
                                                    <Badge variant="outline" className="rounded-full text-[9px] uppercase font-black tracking-tighter px-2 border-primary/20 text-primary">{user.role}</Badge>
                                                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">{user.followers} Pengikut</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-32 opacity-40">
                            <Users className="h-16 w-16 mx-auto mb-4" />
                            <p className="font-bold">Tidak ada pujangga ditemukan.</p>
                        </div>
                    )}
                </TabsContent>
            </AnimatePresence>
        )}
      </Tabs>
    </div>
  );
}

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-32 gap-6">
                <Loader2 className="h-12 w-12 animate-spin text-primary/40" />
                <p className="font-black uppercase text-xs tracking-[0.3em] text-muted-foreground/60 animate-pulse">Menghubungkan Otoritas...</p>
            </div>
        }>
            <SearchPageContent />
        </Suspense>
    )
}
