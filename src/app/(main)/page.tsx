'use client';

import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc, type Query, type DocumentData } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import type { Book, Story, User as AppUser, Follow } from '@/lib/types';
import { BookCarousel } from '@/components/BookCarousel';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Sparkles, BookOpen, PenTool, TrendingUp, Search, Star, Flame, Trophy, Crown, Cpu, ArrowRight, ChevronRight, Clapperboard, Feather, Book as BookIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StoriesReel } from '@/components/stories/StoriesReel';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

const WELCOME_HERO_KEY = 'hasSeenWelcomeHero';

const CATEGORIES = [
  { name: 'Novel', slug: 'novel', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { name: 'Fiksi Ilmiah', slug: 'sci-fi', icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  { name: 'Fantasi', slug: 'fantasy', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  { name: 'Horor', slug: 'horror', icon: Search, color: 'text-rose-500', bg: 'bg-rose-500/10' },
];

export default function HomePage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const [showHero, setShowHero] = useState(false);
  const [storiesQuery, setStoriesQuery] = useState<Query<DocumentData> | null>(null);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<AppUser>(
    (firestore && currentUser) ? doc(firestore, 'users', currentUser.uid) : null
  );

  useEffect(() => {
    const hasSeenHero = localStorage.getItem(WELCOME_HERO_KEY);
    if (!hasSeenHero) {
      setShowHero(true);
    }
  }, []);

  const handleDismissHero = () => {
    setShowHero(false);
    localStorage.setItem(WELCOME_HERO_KEY, 'true');
  };
  
  useEffect(() => {
    if (firestore && currentUser) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      setStoriesQuery(
        query(
          collection(firestore, 'stories'),
          where('createdAt', '>', twentyFourHoursAgo),
          orderBy('createdAt', 'desc')
        )
      );
    }
  }, [firestore, currentUser]);

  const booksQuery = useMemo(() => (
    (firestore && currentUser)
    ? query(
        collection(firestore, 'books'), 
        where('status', '==', 'published')
      )
    : null
  ), [firestore, currentUser]);
  
  const { data: rawBooks, isLoading: areBooksLoading } = useCollection<Book>(booksQuery);

  const usersQuery = useMemo(() => (
    (firestore && currentUser) ? query(collection(firestore, 'users'), where('role', 'in', ['penulis', 'admin'])) : null
  ), [firestore, currentUser]);
  const { data: areAuthors, isLoading: areAuthorsLoading } = useCollection<AppUser>(usersQuery);

  const topAuthors = useMemo(() => {
    if (!areAuthors || !rawBooks) return [];
    
    return areAuthors.map(author => {
        const bookCount = rawBooks.filter(b => b.authorId === author.uid).length;
        return { ...author, bookCount };
    })
    .filter(a => a.bookCount > 0)
    .sort((a, b) => b.bookCount - a.bookCount)
    .slice(0, 10);
  }, [areAuthors, rawBooks]);

  // CATEGORIZED COLLECTIONS
  const popularBooks = useMemo(() => {
    if (!rawBooks) return null;
    return [...rawBooks]
      .filter(b => b.visibility === 'public')
      .sort((a, b) => (b.favoriteCount + b.viewCount) - (a.favoriteCount + a.viewCount))
      .slice(0, 12);
  }, [rawBooks]);
  
  const newBooks = useMemo(() => {
    if (!rawBooks) return null;
    return [...rawBooks]
      .filter(b => b.visibility === 'public')
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
      .slice(0, 12);
  }, [rawBooks]);

  const novelBooks = useMemo(() => {
    if (!rawBooks) return null;
    return rawBooks.filter(b => b.type === 'book' && b.visibility === 'public').slice(0, 12);
  }, [rawBooks]);

  const screenplayBooks = useMemo(() => {
    if (!rawBooks) return null;
    return rawBooks.filter(b => b.type === 'screenplay' && b.visibility === 'public').slice(0, 12);
  }, [rawBooks]);

  const poetryBooks = useMemo(() => {
    if (!rawBooks) return null;
    return rawBooks.filter(b => b.type === 'poem' && b.visibility === 'public').slice(0, 12);
  }, [rawBooks]);

  const { data: allStories, isLoading: areStoriesLoading } = useCollection<Story>(storiesQuery);

  const followingQuery = useMemo(() => (
    (firestore && currentUser) ? collection(firestore, 'users', currentUser.uid, 'following') : null
  ), [firestore, currentUser]);
  const { data: followingList } = useCollection<Follow>(followingQuery);
  const followingIds = useMemo(() => new Set(followingList?.map(f => f.id) || []), [followingList]);

  const filteredStories = useMemo(() => {
    if (!allStories) return [];
    if (!currentUser) return allStories.filter(s => s.authorRole === 'penulis' || s.authorRole === 'admin');
    
    return allStories.filter(story => {
      if (story.authorRole === 'penulis' || story.authorRole === 'admin') return true;
      if (story.authorId === currentUser.uid) return true;
      if (followingIds.has(story.authorId)) return true;
      return false;
    });
  }, [allStories, followingIds, currentUser]);

  return (
    <div className="relative pb-32 overflow-x-hidden w-full max-w-lg mx-auto bg-background/50">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-primary/10 via-background to-transparent -z-10" />

      <div className="space-y-12 w-full pt-4">
        {/* Stories Section */}
        <section className="relative z-20 w-full px-4">
          <div className="flex items-center gap-2 mb-5 px-1">
             <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
             <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/40">Momen Puitis</h2>
          </div>
          <StoriesReel 
              stories={filteredStories} 
              isLoading={areStoriesLoading || isProfileLoading}
              currentUserProfile={userProfile}
          />
        </section>

        {/* Hero Section */}
        <AnimatePresence mode="wait">
          {showHero && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative rounded-[2.5rem] overflow-hidden shadow-2xl bg-zinc-950 mx-4 border border-white/5"
            >
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20 grayscale" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-black/60 to-black/95" />
              
              <div className="relative z-10 p-10 text-center space-y-8">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-white text-[9px] font-black uppercase tracking-widest">
                  <Cpu className="h-3 w-3 text-primary animate-pulse" /> Future of Literacy
                </div>
                
                <div className="space-y-4">
                    <h1 className="text-4xl font-headline font-black text-white leading-tight tracking-tight text-balance">
                      Rumah Bagi <br/> <span className="text-primary italic underline decoration-primary/20">Imajinasi.</span>
                    </h1>
                    <p className="text-sm text-white/60 font-medium italic max-w-[220px] mx-auto leading-relaxed">
                      "Tempat di mana setiap jejak aksaramu abadi dalam semesta Elitera."
                    </p>
                </div>

                <div className="flex flex-col gap-3 w-full pt-4">
                  <Button className="rounded-2xl h-14 bg-white text-zinc-950 hover:bg-zinc-100 font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 group" asChild>
                    <Link href="/search?q=">Jelajahi Karya <ChevronRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" /></Link>
                  </Button>
                  <button onClick={handleDismissHero} className="text-white/30 text-[9px] font-black uppercase tracking-widest hover:text-white/60 transition-colors">
                    Mungkin Nanti
                  </button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Categories Grid */}
        <section className="space-y-6 px-4">
          <div className="flex items-center gap-3 px-1">
            <h2 className="text-lg font-headline font-black tracking-tight">
              Kategori <span className="text-primary italic">Utama</span>
            </h2>
            <div className="h-px bg-border/50 flex-1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {CATEGORIES.map((cat, i) => (
              <motion.div key={cat.slug} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/search?q=${cat.slug}`} className="block group">
                  <div className="bg-card/50 backdrop-blur-md border border-border/50 rounded-3xl p-6 flex flex-col items-center gap-4 text-center transition-all group-hover:shadow-xl group-hover:-translate-y-1 active:scale-95 ring-1 ring-white/10">
                    <div className={cn("p-4 rounded-2xl shadow-inner transition-all group-hover:scale-110", cat.bg, cat.color)}>
                      <cat.icon className="h-6 w-6" />
                    </div>
                    <span className="font-black text-[9px] tracking-[0.25em] uppercase text-foreground/60">{cat.name}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Top Authors */}
        <section className="space-y-6">
            <div className="flex items-center justify-between px-5">
                <h2 className="text-lg font-headline font-black tracking-tight">
                    Pujangga <span className="text-primary italic">Pilihan</span>
                </h2>
                <Link href="/join-author" className="text-[9px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-1 hover:gap-2 transition-all">
                    Lihat Semua <ChevronRight className="h-3 w-3" />
                </Link>
            </div>

            <div className="flex items-stretch gap-4 overflow-x-auto no-scrollbar px-5 pb-2">
                {(areAuthorsLoading || areBooksLoading) ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-44 w-32 rounded-[2.5rem] flex-shrink-0" />
                    ))
                ) : topAuthors.map((author, idx) => (
                    <motion.div key={author.uid} className="flex-shrink-0">
                        <Link href={`/profile/${author.username.toLowerCase()}`}>
                            <div className="w-32 p-6 rounded-[2.5rem] bg-card border border-border/50 flex flex-col items-center text-center gap-4 shadow-sm hover:shadow-xl transition-all relative overflow-hidden group">
                                <div className={cn(
                                    "absolute top-0 left-0 right-0 h-1 opacity-20",
                                    idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-zinc-400" : idx === 2 ? "bg-orange-400" : "bg-primary"
                                )} />
                                <div className="relative">
                                    <Avatar className="h-16 w-16 border-2 border-background shadow-xl ring-1 ring-border/50 transition-transform group-hover:scale-105">
                                        <AvatarImage src={author.photoURL} className="object-cover" />
                                        <AvatarFallback className="text-xl font-black bg-primary/5 text-primary italic">{author.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className={cn(
                                        "absolute -top-1 -right-1 p-1 rounded-full border-2 border-background shadow-lg",
                                        idx === 0 ? "bg-yellow-500 text-white" : idx === 1 ? "bg-zinc-400 text-white" : idx === 2 ? "bg-orange-400 text-white" : "bg-muted text-muted-foreground"
                                    )}>
                                        {idx === 0 ? <Crown className="h-3 w-3" /> : <span className="text-[8px] font-black px-1">#{idx + 1}</span>}
                                    </div>
                                </div>
                                <div className="space-y-1 w-full">
                                    <p className="font-black text-[10px] uppercase tracking-tighter truncate w-full group-hover:text-primary transition-colors">{author.displayName}</p>
                                    <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest">{author.bookCount} Karya</p>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </section>

        {/* Content Sections */}
        <div className="space-y-12 px-4">
          <section className="space-y-6">
            <h2 className="text-lg font-headline font-black tracking-tight flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" /> Paling <span className="text-primary italic">Dicari</span>
            </h2>
            <BookCarousel title="" books={popularBooks} isLoading={areBooksLoading} />
          </section>

          <section className="space-y-6">
            <h2 className="text-lg font-headline font-black tracking-tight flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" /> Terbitan <span className="text-primary italic">Terbaru</span>
            </h2>
            <BookCarousel title="" books={newBooks} isLoading={areBooksLoading} />
          </section>

          <section className="space-y-6">
            <h2 className="text-lg font-headline font-black tracking-tight flex items-center gap-2">
                <Clapperboard className="h-5 w-5 text-indigo-500" /> Naskah <span className="text-primary italic">Film</span>
            </h2>
            <BookCarousel title="" books={screenplayBooks} isLoading={areBooksLoading} />
          </section>

          <section className="space-y-6">
            <h2 className="text-lg font-headline font-black tracking-tight flex items-center gap-2">
                <Feather className="h-5 w-5 text-rose-500" /> Koleksi <span className="text-primary italic">Puisi</span>
            </h2>
            <BookCarousel title="" books={poetryBooks} isLoading={areBooksLoading} />
          </section>

          <section className="space-y-6">
            <h2 className="text-lg font-headline font-black tracking-tight flex items-center gap-2">
                <BookIcon className="h-5 w-5 text-emerald-500" /> Novel & <span className="text-primary italic">Buku</span>
            </h2>
            <BookCarousel title="" books={novelBooks} isLoading={areBooksLoading} />
          </section>
        </div>

        {/* Footer CTA */}
        {!isProfileLoading && userProfile?.role === 'pembaca' && (
          <motion.section 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mx-4 mb-10"
          >
            <div className="bg-zinc-950 rounded-[2.5rem] p-12 text-center space-y-8 overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative border border-white/5">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/20 rounded-full blur-[80px]" />
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent/10 rounded-full blur-[80px]" />
                
                <div className="relative z-10 space-y-4">
                    <div className="p-4 rounded-3xl bg-primary/10 w-fit mx-auto border border-primary/20 mb-4">
                        <PenTool className="h-8 w-8 text-primary animate-bounce" />
                    </div>
                    <h2 className="text-2xl font-headline font-black text-white">Jadi Arsitek Narasi.</h2>
                    <p className="text-white/40 text-xs font-medium italic max-w-[220px] mx-auto">
                        "Setiap ide besar bermula dari satu kata. Bagikan duniamu sekarang."
                    </p>
                </div>
                <Button size="lg" className="rounded-2xl w-full h-16 font-black text-xs uppercase tracking-[0.2em] bg-primary shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 group" asChild>
                  <Link href="/join-author">Daftar Penulis <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></Link>
                </Button>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
