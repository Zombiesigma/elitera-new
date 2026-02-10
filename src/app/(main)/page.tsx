'use client';

import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc, type Query, type DocumentData } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import type { Book, Story, User as AppUser, Follow } from '@/lib/types';
import { BookCarousel } from '@/components/BookCarousel';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Sparkles, ArrowRight, BookOpen, PenTool, TrendingUp, Search, Star, Flame, ChevronRight, X as XIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StoriesReel } from '@/components/stories/StoriesReel';
import { cn } from '@/lib/utils';

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
        where('status', '==', 'published'),
        where('visibility', '==', 'public')
      )
    : null
  ), [firestore, currentUser]);
  
  const { data: rawBooks, isLoading } = useCollection<Book>(booksQuery);

  const popularBooks = useMemo(() => {
    if (!rawBooks) return null;
    return [...rawBooks].sort((a, b) => (b.favoriteCount + b.viewCount) - (a.favoriteCount + a.viewCount)).slice(0, 12);
  }, [rawBooks]);
  
  const newBooks = useMemo(() => {
    if (!rawBooks) return null;
    return [...rawBooks].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()).slice(0, 12);
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
    <div className="relative pb-10 overflow-x-hidden w-full">
      {/* Background Blobs - Properly Contained */}
      <div className="absolute top-[-100px] left-[-50px] w-full max-w-[500px] aspect-square bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute top-[40%] right-[-50px] w-full max-w-[400px] aspect-square bg-accent/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="space-y-12 w-full max-w-full overflow-x-hidden">
        {/* Stories Section */}
        <motion.section 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-20 w-full"
        >
          <div className="flex items-center gap-2 mb-4 px-1">
             <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
             <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Momen Hangat</h2>
          </div>
          <StoriesReel 
              stories={filteredStories} 
              isLoading={areStoriesLoading || isProfileLoading}
              currentUserProfile={userProfile}
          />
        </motion.section>

        {/* Hero Welcome Section */}
        <AnimatePresence mode="wait">
          {showHero && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              className="relative rounded-[2rem] md:rounded-[2.5rem] overflow-hidden shadow-2xl bg-zinc-950 p-6 md:p-8 pt-10 md:pt-12 text-center flex flex-col items-center mx-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/40 via-accent/30 to-indigo-900/40 opacity-80" />
              <div className="relative z-10 space-y-6 w-full">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white text-[9px] font-black uppercase tracking-widest backdrop-blur-md border border-white/10">
                  <Sparkles className="h-3 w-3 text-yellow-300" /> Literasi Modern
                </div>
                <h1 className="text-3xl md:text-4xl font-headline font-black text-white leading-tight">
                  Ukir <span className="italic text-primary-foreground">Jejakmu</span> <br/> Lewat Kata.
                </h1>
                <p className="text-sm text-white/70 font-medium leading-relaxed max-w-xs mx-auto">
                  Temukan ribuan mahakarya atau mulailah menulis sejarahmu sendiri hari ini.
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs mx-auto pt-4">
                  <Button className="rounded-full h-12 bg-white text-primary hover:bg-white/90 font-black text-xs uppercase tracking-widest shadow-xl" asChild>
                    <Link href="/search?q=">Eksplorasi Karya</Link>
                  </Button>
                  <Button variant="ghost" onClick={handleDismissHero} className="text-white/50 text-[10px] font-bold uppercase tracking-widest">
                    Lewati Sambutan
                  </Button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Categories Quick Access */}
        <section className="space-y-6 w-full">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-headline font-black tracking-tight flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Genre <span className="text-primary italic">Populer</span>
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {CATEGORIES.map((cat, i) => (
              <motion.div
                key={cat.slug}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/search?q=${cat.slug}`} className="block">
                  <div className="bg-card/40 backdrop-blur-sm border border-border/50 rounded-2xl md:rounded-3xl p-4 md:p-6 flex flex-col items-center gap-3 text-center transition-all active:scale-95 shadow-sm">
                    <div className={cn("p-3 md:p-4 rounded-xl md:rounded-2xl shadow-inner", cat.bg, cat.color)}>
                      <cat.icon className="h-5 w-5 md:h-6 md:w-6" />
                    </div>
                    <span className="font-black text-[9px] md:text-[10px] tracking-widest uppercase opacity-80">{cat.name}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Main Content: Carousels */}
        <div className="space-y-12 w-full">
          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <div className="space-y-0.5">
                    <h2 className="text-xl font-headline font-black tracking-tight flex items-center gap-2">
                        <Flame className="h-5 w-5 text-orange-500" /> Trending
                    </h2>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Paling banyak dibaca</p>
                </div>
                <Button variant="ghost" asChild className="rounded-full font-black text-[9px] uppercase tracking-widest text-primary h-8 px-3">
                    <Link href="/search?q=">Semua <ChevronRight className="ml-1 h-3 w-3" /></Link>
                </Button>
            </div>
            <BookCarousel title="" books={popularBooks} isLoading={isLoading} />
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <div className="space-y-0.5">
                    <h2 className="text-xl font-headline font-black tracking-tight flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-500" /> Rilisan Baru
                    </h2>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Imajinasi segar para pujangga</p>
                </div>
                <Button variant="ghost" asChild className="rounded-full font-black text-[9px] uppercase tracking-widest text-primary h-8 px-3">
                    <Link href="/search?q=">Semua <ChevronRight className="ml-1 h-3 w-3" /></Link>
                </Button>
            </div>
            <BookCarousel title="" books={newBooks} isLoading={isLoading} />
          </section>
        </div>

        {/* Footer CTA */}
        {!isProfileLoading && userProfile?.role === 'pembaca' && (
          <motion.section 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="relative bg-zinc-900 border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-8 text-center space-y-6 overflow-hidden shadow-xl mx-1"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[60px]" />
            <div className="relative z-10 space-y-6">
                <div className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl w-fit mx-auto">
                    <PenTool className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-headline font-black text-white leading-tight">
                    Mulai Mahakarya <br/> <span className="text-primary italic">Pertamamu.</span>
                </h2>
                <Button size="lg" className="rounded-full w-full h-14 font-black text-sm uppercase tracking-widest bg-primary text-white max-w-xs mx-auto flex" asChild>
                  <Link href="/join-author">Daftar Penulis <Sparkles className="ml-2 h-4 w-4" /></Link>
                </Button>
            </div>
          </motion.section>
        )}
      </div>
    </div>
  );
}