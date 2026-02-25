'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useMemo, useState, useEffect } from 'react';
import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import type { Book, User } from '@/lib/types';
import { BookCard } from '@/components/BookCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { Loader2, Search, Users, BookOpen, Sparkles, Filter, TrendingUp, ArrowLeft, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const q = searchParams.get('q') || '';
  const [activeTab, setActiveTab] = useState('all');
  
  // Use broad queries to avoid missing index errors
  const baseQueries = useMemo(() => {
    if (!firestore || !currentUser) return { books: null, users: null };
    
    return {
        books: query(
            collection(firestore, 'books'),
            where('status', '==', 'published'),
            where('visibility', '==', 'public'),
            limit(200)
        ),
        users: query(
            collection(firestore, 'users'),
            limit(200)
        )
    };
  }, [firestore, currentUser]);

  const { data: rawBooks, isLoading: areBooksLoading } = useCollection<Book>(baseQueries.books);
  const { data: rawUsers, isLoading: areUsersLoading } = useCollection<User>(baseQueries.users);
  
  const filteredData = useMemo(() => {
      const term = q.trim().toLowerCase();
      if (!term) return { books: [], users: [] };

      const books = (rawBooks || []).filter(b => 
          b.title?.toLowerCase().includes(term) || 
          b.genre?.toLowerCase().includes(term) ||
          b.authorName?.toLowerCase().includes(term)
      );

      const users = (rawUsers || []).filter(u => 
          u.displayName?.toLowerCase().includes(term) || 
          u.username?.toLowerCase().includes(term)
      );

      return { books, users };
  }, [rawBooks, rawUsers, q]);

  const isLoading = areBooksLoading || areUsersLoading;
  const resultCount = filteredData.books.length + filteredData.users.length;

  if (!q) {
    return (
      <div className="max-w-4xl mx-auto py-12 md:py-20 px-4">
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-10"
        >
            <div className="relative inline-flex mb-4">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                <div className="relative p-10 rounded-[3rem] bg-muted shadow-inner border border-white/50 dark:border-white/10">
                    <Search className="h-20 w-20 text-muted-foreground/30" />
                </div>
            </div>
            
            <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-headline font-black tracking-tight uppercase">Jelajahi <span className="text-primary italic">Semesta.</span></h1>
                <p className="text-muted-foreground max-w-sm mx-auto text-base font-medium leading-relaxed">Masukkan kata kunci di bilah pencarian atas untuk menemukan inspirasi dari para pujangga Elitera.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto pt-6">
                {[
                    { label: 'Novel Terpopuler', color: 'text-blue-500', q: 'novel' },
                    { label: 'Fantasi Epik', color: 'text-emerald-500', q: 'fantasy' },
                    { label: 'Pujangga Baru', color: 'text-orange-500', q: 'admin' },
                    { label: 'Momen Puitis', color: 'text-rose-500', q: 'cerita' }
                ].map((item, i) => (
                    <Card 
                        key={i} 
                        className="border-none bg-card/50 backdrop-blur-md p-4 rounded-2xl shadow-sm hover:shadow-xl transition-all cursor-pointer active:scale-95 border border-white/10 group"
                        onClick={() => router.push(`/search?q=${item.q}`)}
                    >
                        <p className={cn("text-[9px] font-black uppercase tracking-[0.2em] group-hover:text-primary transition-colors", item.color)}>{item.label}</p>
                    </Card>
                ))}
            </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-24 px-1">
      {/* Header Results Info */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4">
        <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
        >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.2em] border border-primary/20">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" /> Hasil Eksplorasi
            </div>
            <h1 className="text-4xl md:text-6xl font-headline font-black tracking-tight leading-none">
                Jejak untuk "<span className="text-primary italic">{q}</span>"
            </h1>
            <p className="text-muted-foreground font-bold flex items-center gap-2 text-xs md:text-sm uppercase tracking-widest opacity-60">
                Ditemukan {isLoading ? '...' : resultCount} korespondensi yang relevan.
            </p>
        </motion.div>

        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full px-6 font-black uppercase text-[10px] tracking-widest border-2 hover:bg-primary hover:text-white transition-all h-11" onClick={() => router.push('/search')}>
                <X className="mr-2 h-4 w-4" /> Bersihkan
            </Button>
        </div>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="space-y-10">
        <div className="flex items-center overflow-x-auto no-scrollbar pb-2 border-b border-border/40">
            <TabsList className="bg-muted/50 p-1 rounded-full h-auto flex-shrink-0">
                <TabsTrigger value="all" className="rounded-full px-8 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all">Semua</TabsTrigger>
                <TabsTrigger value="books" className="rounded-full px-8 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all gap-2">
                    Karya {filteredData.books.length > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-full text-[8px]">{filteredData.books.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="users" className="rounded-full px-8 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase text-[10px] tracking-widest transition-all gap-2">
                    Pujangga {filteredData.users.length > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-full text-[8px]">{filteredData.users.length}</span>}
                </TabsTrigger>
            </TabsList>
        </div>
      
        {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6 opacity-40">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                    <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Menghubungkan Otoritas Sastra...</p>
            </div>
        ) : (
            <AnimatePresence mode="wait">
                <TabsContent value="all" key="all" className="space-y-16 mt-0">
                    {/* Integrated View: Users First */}
                    {filteredData.users.length > 0 && (
                        <section className="space-y-8">
                            <div className="flex items-center gap-4">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60 flex items-center gap-3 whitespace-nowrap">
                                    <Users className="h-4 w-4 text-primary" /> Profil Pujangga
                                </h2>
                                <div className="h-px bg-border/50 flex-1" />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredData.users.map(user => (
                                    <Link href={`/profile/${user.username}`} key={user.id} className="group">
                                        <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm rounded-[2rem] hover:shadow-2xl hover:-translate-y-1 transition-all overflow-hidden relative border border-white/10">
                                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all">
                                                <Badge variant="secondary" className="rounded-full text-[8px] font-black uppercase">Profil</Badge>
                                            </div>
                                            <CardContent className="p-6 flex items-center gap-5">
                                                <div className="relative">
                                                    <Avatar className="h-16 w-16 border-2 border-background shadow-xl ring-1 ring-border group-hover:scale-105 transition-transform duration-500">
                                                        <AvatarImage src={user.photoURL} alt={user.displayName} />
                                                        <AvatarFallback className="bg-primary/5 text-primary font-black text-xl italic">
                                                            {user.displayName?.charAt(0) || 'U'}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {user.status === 'online' && <span className="absolute bottom-0 right-0 h-4 w-4 bg-green-500 border-2 border-card rounded-full shadow-lg" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-lg truncate group-hover:text-primary transition-colors tracking-tight">{user.displayName}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-0.5">@{user.username}</p>
                                                    <div className="flex items-center gap-3 mt-3 text-[9px] font-black text-primary/60 uppercase tracking-widest">
                                                        <span className="flex items-center gap-1"><Users className="h-2.5 w-2.5" /> {new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(user.followers)} Pengikut</span>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Integrated View: Books */}
                    {filteredData.books.length > 0 && (
                        <section className="space-y-8">
                            <div className="flex items-center gap-4">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60 flex items-center gap-3 whitespace-nowrap">
                                    <BookOpen className="h-4 w-4 text-primary" /> Rak Mahakarya
                                </h2>
                                <div className="h-px bg-border/50 flex-1" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8">
                                {filteredData.books.map(book => (
                                    <motion.div key={book.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                                        <BookCard book={book} />
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Results Not Found */}
                    {(!filteredData.users.length && !filteredData.books.length) && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-32 bg-muted/20 rounded-[3rem] border-2 border-dashed flex flex-col items-center gap-8 shadow-inner max-w-2xl mx-auto"
                        >
                            <div className="p-10 bg-background rounded-[2.5rem] shadow-2xl relative">
                                <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full" />
                                <Search className="h-16 w-16 text-muted-foreground/20 relative z-10" />
                            </div>
                            <div className="space-y-3 px-6">
                                <h2 className="text-3xl font-headline font-black tracking-tight">Hening Tanpa <span className="text-primary italic">Jejak.</span></h2>
                                <p className="text-muted-foreground max-w-sm mx-auto text-sm font-medium leading-relaxed">Kami tidak menemukan frekuensi yang cocok dengan "<span className="font-bold text-foreground">{q}</span>". Mari coba kata kunci lain.</p>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="secondary" className="rounded-full px-8 font-black uppercase text-[10px] tracking-widest h-12" onClick={() => router.back()}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
                                </Button>
                                <Button className="rounded-full px-8 font-black uppercase text-[10px] tracking-widest h-12 shadow-xl shadow-primary/20" onClick={() => router.push('/')}>
                                    Beranda Utama
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </TabsContent>

                <TabsContent value="books" key="books" className="mt-0">
                    {filteredData.books.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8">
                            {filteredData.books.map(book => <BookCard key={book.id} book={book} />)}
                        </div>
                    ) : (
                        <div className="text-center py-40 opacity-30 flex flex-col items-center gap-4">
                            <BookOpen className="h-16 w-16 mx-auto mb-2" />
                            <p className="font-black uppercase tracking-widest text-[10px]">Tidak ada karya ditemukan</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="users" key="users" className="mt-0">
                    {filteredData.users.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                            {filteredData.users.map(user => (
                                <Link href={`/profile/${user.username}`} key={user.id}>
                                    <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm rounded-[2.5rem] hover:shadow-2xl hover:-translate-y-1 transition-all border border-white/10">
                                        <CardContent className="p-8 flex items-center gap-6">
                                            <Avatar className="h-20 w-20 border-2 border-background shadow-2xl ring-1 ring-border">
                                                <AvatarImage src={user.photoURL} alt={user.displayName} />
                                                <AvatarFallback className="bg-primary/5 text-primary text-2xl font-black italic">
                                                    {user.displayName?.charAt(0) || 'U'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="font-black text-xl truncate group-hover:text-primary transition-colors tracking-tight">{user.displayName}</p>
                                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1">@{user.username}</p>
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    <Badge variant="outline" className="rounded-full text-[8px] uppercase font-black tracking-widest px-2 border-primary/20 text-primary bg-primary/5">{user.role}</Badge>
                                                    <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-tighter">{new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(user.followers)} Pengikut</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-40 opacity-30 flex flex-col items-center gap-4">
                            <Users className="h-16 w-16 mx-auto mb-2" />
                            <p className="font-black uppercase tracking-widest text-[10px]">Tidak ada pujangga ditemukan</p>
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
            <div className="flex flex-col items-center justify-center py-40 gap-8">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-150 animate-pulse" />
                    <Loader2 className="h-14 w-14 animate-spin text-primary/40 relative z-10" />
                </div>
                <p className="font-black uppercase text-[10px] tracking-[0.4em] text-muted-foreground/60 animate-pulse">Menghubungkan Otoritas...</p>
            </div>
        }>
            <SearchPageContent />
        </Suspense>
    )
}
