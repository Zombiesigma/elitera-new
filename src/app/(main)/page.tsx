'use client';

import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc, type Query, type DocumentData } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import type { Book, Story, User as AppUser, Follow } from '@/lib/types';
import { BookCarousel } from '@/components/BookCarousel';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Sparkles, ArrowRight, BookOpen, PenTool, TrendingUp, Search, Star, Flame, ChevronRight, X as XIcon, Users, Trophy, Crown, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StoriesReel } from '@/components/stories/StoriesReel';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

const WELCOME_HERO_KEY = 'hasSeenWelcomeHero';

const CATEGORIES = [
  { name: 'Novel', slug: 'novel', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/5' },
  { name: 'Fiksi Ilmiah', slug: 'sci-fi', icon: Sparkles, color: 'text-purple-500', bg: 'bg-purple-500/5' },
  { name: 'Fantasi', slug: 'fantasy', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/5' },
  { name: 'Horor', slug: 'horror', icon: Search, color: 'text-rose-500', bg: 'bg-rose-500/5' },
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
  const { data: allAuthors, isLoading: areAuthorsLoading } = useCollection<AppUser>(usersQuery);

  const topAuthors = useMemo(() => {
    if (!allAuthors || !rawBooks) return [];
    
    return allAuthors.map(author => {
        const bookCount = rawBooks.filter(b => b.authorId === author.uid).length;
        return { ...author, bookCount };
    })
    .filter(a => a.bookCount > 0)
    .sort((a, b) => b.bookCount - a.bookCount)
    .slice(0, 10);
  }, [allAuthors, rawBooks]);

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
    <div className="relative pb-24 overflow-x-hidden w-full">
      <div className="absolute top-[-100px] left-[-100px] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] -z-10 pointer-events-none animate-pulse" />
      <div className="absolute top-[30%] right-[-100px] w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-[-100px] left-[20%] w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="space-y-16 w-full max-w-full overflow-x-hidden">
        <motion.section 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-20 w-full pt-2"
        >
          <div className="flex items-center gap-3 mb-6 px-1">
             <div className="relative">
                <div className="absolute inset-0 bg-primary/40 blur-md rounded-full animate-ping" />
                <div className="relative h-2 w-2 rounded-full bg-primary" />
             </div>
             <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60">Gema Inspirasi Terkini</h2>
          </div>
          <StoriesReel 
              stories={filteredStories} 
              isLoading={areStoriesLoading || isProfileLoading}
              currentUserProfile={userProfile}
          />
        </motion.section>

        <AnimatePresence mode="wait">
          {showHero && (
            <motion.section
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
              className="relative rounded-[2.5rem] md:rounded-[3.5rem] overflow-hidden shadow-[0_40px_100px_-15px_rgba(0,0,0,0.3)] bg-zinc-950 p-8 md:p-16 text-center flex flex-col items-center mx-1 border border-white/5"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-accent/20 to-indigo-900/40 opacity-90" />
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
              
              <div className="relative z-10 space-y-10 w-full max-w-2xl">
                <motion.div 
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-white/5 text-white text-[9px] font-black uppercase tracking-[0.3em] backdrop-blur-xl border border-white/10 shadow-2xl"
                >
                  <Cpu className="h-3.5 w-3.5 text-primary animate-pulse" /> Evolusi Sastra Digital
                </motion.div>
                
                <div className="space-y-4">
                    <h1 className="text-4xl md:text-7xl font-headline font-black text-white leading-[1.1] tracking-tighter">
                      Abadikan <span className="italic text-primary underline decoration-primary/20 underline-offset-8">Jejakmu</span> <br/> Dalam Aksara.
                    </h1>
                    <p className="text-sm md:text-lg text-white/60 font-medium leading-relaxed max-w-md mx-auto italic">
                      "Di mana setiap kata menemukan rumahnya, dan setiap imajinasi menjadi mahakarya abadi."
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center pt-6">
                  <Button className="rounded-full h-14 md:h-16 px-10 bg-white text-zinc-950 hover:bg-zinc-100 font-black text-xs md:text-sm uppercase tracking-[0.2em] shadow-[0_20px_50px_-10px_rgba(255,255,255,0.2)] transition-all hover:scale-105 active:scale-95" asChild>
                    <Link href="/search?q=">Mulai Eksplorasi</Link>
                  </Button>
                  <Button variant="ghost" onClick={handleDismissHero} className="text-white/40 hover:text-white hover:bg-white/5 h-14 md:h-16 rounded-full text-[10px] font-black uppercase tracking-[0.3em] transition-all">
                    Lewati Sambutan
                  </Button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <section className="space-y-8 w-full">
          <div className="flex items-center gap-4 px-1">
            <h2 className="text-xl md:text-2xl font-headline font-black tracking-tight flex items-center gap-3 whitespace-nowrap">
              <TrendingUp className="h-6 w-6 text-primary" /> Genre <span className="text-primary italic">Pilihan</span>
            </h2>
            <div className="h-px bg-border/50 flex-1" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.slug}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <Link href={`/search?q=${cat.slug}`} className="block group">
                  <div className="bg-card/40 backdrop-blur-md border border-border/50 rounded-[2rem] p-6 md:p-10 flex flex-col items-center gap-5 text-center transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-primary/5 group-hover:-translate-y-2 relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                    <div className={cn("p-4 md:p-6 rounded-2xl md:rounded-[1.75rem] shadow-inner transition-all duration-500 group-hover:bg-primary group-hover:text-white group-hover:rotate-6", cat.bg, cat.color)}>
                      <cat.icon className="h-6 w-6 md:h-8 md:w-8" />
                    </div>
                    <span className="font-black text-[10px] md:text-xs tracking-[0.2em] uppercase opacity-60 group-hover:opacity-100 transition-opacity">{cat.name}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="space-y-8">
            <div className="flex items-center justify-between px-1">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-headline font-black tracking-tight flex items-center gap-3">
                        <Trophy className="h-7 w-7 text-yellow-500" /> Pujangga <span className="text-primary italic">Terproduktif</span>
                    </h2>
                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.3em]">Kurasi Penulis Paling Berdedikasi</p>
                </div>
                <Button variant="outline" asChild className="rounded-full font-black text-[10px] uppercase tracking-[0.2em] border-2 h-10 px-6 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm">
                    <Link href="/join-author">Direktori <ChevronRight className="ml-2 h-3.5 w-3.5" /></Link>
                </Button>
            </div>

            <div className="flex items-stretch gap-5 md:gap-8 overflow-x-auto no-scrollbar px-1 pb-8 pt-2">
                {(areAuthorsLoading || areBooksLoading) ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="w-40 md:w-56 flex-shrink-0 space-y-6">
                            <Skeleton className="aspect-square w-full rounded-full bg-muted/50" />
                            <Skeleton className="h-4 w-2/3 bg-muted/50 rounded-full mx-auto" />
                        </div>
                    ))
                ) : topAuthors.map((author, idx) => (
                    <motion.div 
                        key={author.uid}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex-shrink-0"
                    >
                        <Link href={`/profile/${author.username.toLowerCase()}`}>
                            <div className={cn(
                                "w-40 md:w-56 p-6 md:p-8 rounded-[2.5rem] md:rounded-[3.5rem] bg-card/40 backdrop-blur-xl border border-border/50 hover:border-primary/30 transition-all duration-500 group flex flex-col items-center text-center gap-6 relative shadow-lg hover:shadow-2xl hover:-translate-y-2",
                                idx === 0 ? "ring-2 ring-yellow-500/20" : ""
                            )}>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-125 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                    <Avatar className="h-20 w-20 md:h-28 md:w-28 border-4 border-background shadow-2xl ring-1 ring-border/50 transition-transform duration-700 group-hover:scale-110">
                                        <AvatarImage src={author.photoURL} className="object-cover" />
                                        <AvatarFallback className="bg-primary/5 text-primary text-2xl font-black uppercase italic">{author.displayName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div className={cn(
                                        "absolute -top-2 -right-2 p-2 rounded-full shadow-2xl border-2 border-background flex items-center justify-center transition-all duration-500 group-hover:scale-110",
                                        idx === 0 ? "bg-yellow-500 text-white" : idx === 1 ? "bg-zinc-400 text-white" : idx === 2 ? "bg-orange-400 text-white" : "bg-muted text-muted-foreground"
                                    )}>
                                        {idx === 0 ? <Crown className="h-4 w-4" /> : <span className="text-[10px] font-black px-1">#{idx + 1}</span>}
                                    </div>
                                </div>
                                <div className="space-y-2 w-full">
                                    <p className="font-black text-sm md:text-base truncate group-hover:text-primary transition-colors tracking-tight">{author.displayName}</p>
                                    <div className="flex items-center justify-center gap-2 text-primary/60 bg-primary/5 px-3 py-1 rounded-full w-fit mx-auto border border-primary/10">
                                        <BookOpen className="h-3 w-3" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">{author.bookCount} Mahakarya</span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>
        </section>

        <div className="space-y-20 w-full">
          <section className="space-y-8">
            <div className="flex items-center justify-between px-1">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-headline font-black tracking-tight flex items-center gap-3">
                        <Flame className="h-7 w-7 text-orange-500" /> Sedang <span className="text-primary italic">Hangat</span>
                    </h2>
                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.3em]">Karya Paling Banyak Dinikmati</p>
                </div>
                <Button variant="ghost" asChild className="rounded-full font-black text-[9px] uppercase tracking-[0.2em] text-primary h-10 px-4 hover:bg-primary/5 transition-all">
                    <Link href="/search?q=">Eksplorasi Semua <ChevronRight className="ml-1 h-3 w-3" /></Link>
                </Button>
            </div>
            <BookCarousel title="" books={popularBooks} isLoading={areBooksLoading} />
          </section>

          <section className="space-y-8">
            <div className="flex items-center justify-between px-1">
                <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-headline font-black tracking-tight flex items-center gap-3">
                        <Star className="h-7 w-7 text-yellow-500" /> Rilisan <span className="text-primary italic">Baru</span>
                    </h2>
                    <p className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.3em]">Imajinasi Segar Para Pujangga</p>
                </div>
                <Button variant="ghost" asChild className="rounded-full font-black text-[9px] uppercase tracking-[0.2em] text-primary h-10 px-4 hover:bg-primary/5 transition-all">
                    <Link href="/search?q=">Eksplorasi Semua <ChevronRight className="ml-1 h-3 w-3" /></Link>
                </Button>
            </div>
            <BookCarousel title="" books={newBooks} isLoading={areBooksLoading} />
          </section>
        </div>

        {!isProfileLoading && userProfile?.role === 'pembaca' && (
          <motion.section 
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative bg-zinc-950 border border-white/5 rounded-[3rem] md:rounded-[4.5rem] p-12 md:p-24 text-center space-y-8 overflow-hidden shadow-2xl mx-1"
          >
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/20 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
            
            <div className="relative z-10 space-y-10 max-w-xl mx-auto">
                <div className="p-6 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] w-fit mx-auto shadow-2xl">
                    <PenTool className="h-12 w-12 text-primary animate-bounce" />
                </div>
                <div className="space-y-4">
                    <h2 className="text-3xl md:text-6xl font-headline font-black text-white leading-tight tracking-tight">
                        Ukir Sejarah <br/> <span className="text-primary italic underline decoration-primary/20 underline-offset-8">Sastramu.</span>
                    </h2>
                    <p className="text-white/40 text-sm md:text-lg font-medium leading-relaxed italic">
                        "Setiap karya besar dimulai dari satu keberanian untuk menulis. Elitera siap menjadi saksi bisu lahirnya mahakaryamu."
                    </p>
                </div>
                <Button size="lg" className="rounded-full w-full h-16 md:h-20 font-black text-sm md:text-base uppercase tracking-[0.3em] bg-primary text-white shadow-[0_25px_60px_-15px_rgba(var(--primary),0.4)] transition-all hover:scale-105 active:scale-95 group overflow-hidden relative" asChild>
                  <Link href="/join-author">
                    <span className="relative z-10 flex items-center gap-3">Ajukan Status Penulis <Sparkles className="h-5 w-5 group-hover:rotate-12 transition-transform" /></span>
                    <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-10 transition-opacity duration-700" />
                  </Link>
                </Button>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}
