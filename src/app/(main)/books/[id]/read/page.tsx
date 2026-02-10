'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { notFound, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Sun, Moon, Text, Menu, Settings, ChevronsUp, BookOpen, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import type { Book, Chapter } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ReadPage() {
  const params = useParams<{ id: string }>();
  const firestore = useFirestore();
  const [isMounted, setIsMounted] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [isDark, setIsDark] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSheetOpen) {
        const timer = setTimeout(() => {
            document.body.style.pointerEvents = '';
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [isSheetOpen]);

  const bookRef = useMemo(() => (
    firestore ? doc(firestore, 'books', params.id) : null
  ), [firestore, params.id]);
  const { data: book, isLoading: isBookLoading } = useDoc<Book>(bookRef);

  const chaptersQuery = useMemo(() => (
    firestore 
      ? query(collection(firestore, 'books', params.id, 'chapters'), orderBy('order', 'asc')) 
      : null
  ), [firestore, params.id]);
  const { data: chapters, isLoading: areChaptersLoading } = useCollection<Chapter>(chaptersQuery);

  useEffect(() => {
    setIsMounted(true);
    const theme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (theme === 'dark' || (!theme && prefersDark)) {
        document.documentElement.classList.add('dark');
        setIsDark(true);
    } else {
        document.documentElement.classList.remove('dark');
        setIsDark(false);
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    if (newIsDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const totalScrollableHeight = scrollHeight - clientHeight;
      if (totalScrollableHeight > 0) {
          const progress = (scrollTop / totalScrollableHeight) * 100;
          setReadingProgress(progress);
          setShowScrollToTop(scrollTop > 500);
      } else {
          setReadingProgress(100);
          setShowScrollToTop(false);
      }
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [isMounted]);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const scrollToChapter = (chapterId: string) => {
    const chapterElement = document.getElementById(`chapter-${chapterId}`);
    if (chapterElement && scrollContainerRef.current) {
        const offset = 100;
        const bodyRect = scrollContainerRef.current.getBoundingClientRect().top;
        const elementRect = chapterElement.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition + scrollContainerRef.current.scrollTop - offset;

        scrollContainerRef.current.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
  };
  
  if (isBookLoading || !isMounted) {
    return <ReadPageSkeleton />;
  }
  
  if (!book) {
    notFound();
  }

  const ChapterItem = ({ chapter, ...props }: { chapter: Chapter } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button
        {...props}
        onClick={() => {
            scrollToChapter(chapter.id);
            if(props.onClick) props.onClick(null as any);
        }}
        className="w-full text-left px-6 py-4 hover:bg-primary/5 transition-all flex items-center gap-4 text-sm group"
      >
        <span className="font-mono text-[10px] font-black text-muted-foreground bg-muted group-hover:bg-primary group-hover:text-white px-2 py-1 rounded-md transition-all">
            {String(chapter.order).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-foreground font-bold group-hover:text-primary transition-colors truncate block">{chapter.title}</span>
        </div>
      </button>
  );

  const ChapterList = ({ inSheet = false }: { inSheet?: boolean }) => (
    <div className='flex flex-col h-full bg-card/30 backdrop-blur-sm'>
      {inSheet ? (
        <SheetHeader className="p-8 border-b shrink-0 text-left space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <BookOpen className="h-5 w-5" />
            <SheetTitle className="font-headline text-2xl font-black truncate">{book.title}</SheetTitle>
          </div>
          <SheetDescription className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground">Struktur Cerita</SheetDescription>
        </SheetHeader>
      ) : (
        <div className="p-8 border-b shrink-0 text-left space-y-2 bg-background/50">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" />
            <h2 className="font-headline text-xl font-black truncate leading-tight">{book.title}</h2>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-black text-muted-foreground">Daftar Isi</p>
        </div>
      )}
      <nav className="flex-1 overflow-y-auto custom-scrollbar pt-2">
        {areChaptersLoading && (
          <div className="p-6 space-y-4">
            {Array.from({length: 8}).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
          </div>
        )}
        {!areChaptersLoading && chapters?.map((chapter) =>
          inSheet ? (
            <SheetClose asChild key={chapter.id}>
              <ChapterItem chapter={chapter} />
            </SheetClose>
          ) : (
            <ChapterItem key={chapter.id} chapter={chapter} />
          )
        )}
        {!areChaptersLoading && (!chapters || chapters.length === 0) && (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-4 opacity-30">
              <BookOpen className="h-12 w-12 text-muted-foreground" />
              <p className='text-sm font-bold uppercase tracking-widest'>Belum Ada Bab</p>
          </div>
        )}
      </nav>
    </div>
  );

  return (
    <div className="flex h-screen -mt-14 -mx-4 md:-mx-6 bg-background selection:bg-primary/20">
      <aside className="hidden md:block md:w-72 lg:w-80 border-r flex-shrink-0 shadow-xl z-20">
          <ChapterList />
      </aside>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className="flex items-center justify-between px-4 h-16 border-b sticky top-14 bg-background/95 backdrop-blur-md z-30 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Link href={`/books/${book.id}`}>
              <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
             <div className="md:hidden">
              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted transition-colors">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent 
                    side="left" 
                    className="w-[85%] max-w-sm p-0 flex flex-col border-none shadow-2xl"
                    onCloseAutoFocus={(e) => {
                        e.preventDefault();
                        document.body.style.pointerEvents = '';
                    }}
                >
                  <ChapterList inSheet />
                </SheetContent>
              </Sheet>
            </div>
            <div className="flex flex-col min-w-0 ml-2">
                <h1 className="font-headline text-sm font-black truncate text-primary leading-none uppercase tracking-tight">{book.title}</h1>
                <p className="text-[9px] font-bold text-muted-foreground mt-1 truncate uppercase tracking-widest">Pujangga: {book.authorName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/5 group transition-all">
                    <Settings className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors"/>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-8 shadow-2xl rounded-[2rem] border-none bg-card/95 backdrop-blur-xl" align="end">
                <div className="space-y-8">
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-primary">
                        <Text className="h-4 w-4" />
                        <Label className="text-xs font-black uppercase tracking-[0.2em]">Preferensi Baca</Label>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-muted-foreground">Ukuran Huruf</span>
                            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-mono font-black">{fontSize}px</span>
                        </div>
                        <div className="flex items-center gap-4 py-2">
                            <Text className="h-3 w-3 text-muted-foreground opacity-50"/>
                            <Slider 
                                defaultValue={[fontSize]} 
                                max={32} 
                                min={14} 
                                step={1} 
                                className="w-full"
                                onValueChange={(value) => setFontSize(value[0])}
                            />
                            <Text className="h-6 w-6 text-muted-foreground"/>
                        </div>
                    </div>
                  </div>
                  
                  <div className="pt-6 border-t border-border/50 flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-black uppercase tracking-widest">Mode Gelap</span>
                        <span className="text-[10px] text-muted-foreground font-medium">Lindungi mata Anda</span>
                    </div>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className={cn(
                            "rounded-2xl h-12 w-12 transition-all duration-500 border-2", 
                            isDark ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "hover:border-primary hover:text-primary"
                        )} 
                        onClick={toggleTheme}
                    >
                        {isDark ? <Sun className="h-5 w-5 animate-spin-slow"/> : <Moon className="h-5 w-5"/>}
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <Progress value={readingProgress} className="w-full h-1 rounded-none bg-muted z-30" />
        
        <div 
            ref={scrollContainerRef} 
            className="flex-1 overflow-y-auto relative bg-background/50 custom-scrollbar scroll-smooth"
        >
          <div className="max-w-3xl mx-auto px-6 py-16 md:py-28">
            <header className="mb-24 text-center space-y-6">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-20 h-1 bg-primary/20 mx-auto rounded-full mb-10" 
                />
                <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="font-headline text-5xl md:text-7xl font-black text-foreground leading-[1.1] tracking-tight italic"
                >
                    {book.title}
                </motion.h1>
                <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-muted-foreground font-bold tracking-[0.4em] uppercase text-[10px]"
                >
                    Sebuah Karya dari {book.authorName}
                </motion.p>
            </header>

            <article 
                className="prose prose-zinc dark:prose-invert max-w-none transition-all duration-300 prose-p:leading-[1.8] prose-p:mb-8 prose-p:text-foreground/90 prose-headings:font-headline prose-headings:font-black prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:bg-primary/5 prose-blockquote:py-4 prose-blockquote:px-8 prose-blockquote:rounded-r-3xl prose-blockquote:italic"
                style={{ fontSize: `${fontSize}px` }}
            >
                {areChaptersLoading ? (
                    <div className="space-y-16">
                        {Array.from({length: 3}).map((_, i) => (
                            <div key={i} className="space-y-8">
                                <Skeleton className="h-14 w-2/3 rounded-2xl" />
                                <div className="space-y-4">
                                    <Skeleton className="h-4 w-full rounded-full" />
                                    <Skeleton className="h-4 w-full rounded-full" />
                                    <Skeleton className="h-4 w-11/12 rounded-full" />
                                    <Skeleton className="h-4 w-full rounded-full" />
                                    <Skeleton className="h-4 w-4/5 rounded-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : chapters && chapters.length > 0 ? (
                    chapters.map((chapter, chapterIndex) => (
                        <React.Fragment key={chapter.id}>
                            <section id={`chapter-${chapter.id}`} className="scroll-m-32 mb-32 md:mb-48 chapter-container">
                                <div className="flex items-center gap-6 mb-16 group">
                                    <span className="font-mono text-xs font-black text-primary/30 group-hover:text-primary transition-all tracking-widest">
                                        BAGIAN {String(chapter.order).padStart(2, '0')}
                                    </span>
                                    <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
                                </div>
                                
                                <h2 className="font-headline text-4xl md:text-5xl font-black mb-12 m-0 border-none leading-tight">{chapter.title}</h2>
                                
                                <div className="markdown-content font-serif">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {chapter.content}
                                    </ReactMarkdown>
                                </div>
                                
                                {chapterIndex < chapters.length - 1 ? (
                                    <div className="flex items-center justify-center py-32 opacity-20 select-none pointer-events-none">
                                        <div className="h-px w-full bg-gradient-to-r from-transparent via-foreground to-transparent flex-1" />
                                        <div className="px-8 flex gap-3">
                                            {[1,2,3].map(i => <div key={i} className="w-2 h-2 rounded-full bg-foreground rotate-45" />)}
                                        </div>
                                        <div className="h-px w-full bg-gradient-to-r from-transparent via-foreground to-transparent flex-1" />
                                    </div>
                                ) : (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 30 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        className="mt-40 p-16 rounded-[3rem] bg-card/50 border border-border/50 text-center space-y-8 shadow-2xl backdrop-blur-sm"
                                    >
                                        <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                            <BookOpen className="text-primary h-10 w-10" />
                                        </div>
                                        <div className="space-y-3">
                                            <h3 className="font-headline text-3xl font-black italic">Tamat</h3>
                                            <p className="text-muted-foreground max-w-sm mx-auto text-sm leading-relaxed font-medium">Anda telah menuntaskan seluruh petualangan dalam buku ini. Berikan apresiasi Anda kepada sang pujangga melalui kolom komentar!</p>
                                        </div>
                                        <Button asChild size="lg" className="rounded-full px-12 h-14 font-black shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                                            <Link href={`/books/${book.id}`}>Kembali ke Detail Karya</Link>
                                        </Button>
                                    </motion.div>
                                )}
                            </section>
                        </React.Fragment>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 text-center space-y-8">
                        <div className="bg-muted p-12 rounded-[2.5rem] animate-pulse">
                            <BookOpen className="h-20 w-20 text-muted-foreground/40" />
                        </div>
                        <div className="space-y-3">
                            <h2 className="font-headline text-4xl font-black">Sedang Disusun...</h2>
                            <p className="text-muted-foreground font-medium tracking-wide">Pujangga belum mempublikasikan bab cerita apa pun. Nantikan segera!</p>
                        </div>
                        <Button asChild variant="ghost" className="rounded-full font-bold">
                            <Link href={`/books/${book.id}`}><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link>
                        </Button>
                    </div>
                )}
            </article>
          </div>
        </div>

        <AnimatePresence>
            {showScrollToTop && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: 20 }}
                    className="absolute bottom-10 right-10 z-40"
                >
                    <Button 
                        size="icon" 
                        className="rounded-2xl h-14 w-14 bg-primary text-white shadow-[0_20px_50px_-12px_rgba(var(--primary),0.5)] hover:-translate-y-2 transition-all duration-300"
                        onClick={scrollToTop}
                    >
                        <ChevronsUp className="h-7 w-7"/>
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.08);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
        }
        
        /* Drop Cap Styling */
        .markdown-content p:first-of-type::first-letter {
            font-size: 4rem;
            line-height: 1;
            font-family: 'Playfair Display', serif;
            font-weight: 900;
            float: left;
            margin-right: 0.75rem;
            margin-top: 0.25rem;
            color: hsl(var(--primary));
            text-shadow: 2px 2px 0px hsla(var(--primary), 0.1);
        }

        .animate-spin-slow {
            animation: spin 8s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        .chapter-container {
            position: relative;
        }
      `}</style>
    </div>
  );
}

function ReadPageSkeleton() {
  return (
     <div className="flex h-screen -mt-14 -mx-4 md:-mx-6 bg-background animate-pulse">
        <aside className="hidden md:block w-72 lg:w-80 border-r flex-shrink-0 p-8 space-y-10">
            <div className="space-y-3">
              <Skeleton className="h-10 w-3/4 rounded-xl" />
              <Skeleton className="h-3 w-1/4 rounded-full" />
            </div>
            <div className="space-y-6 pt-10">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex gap-4 items-center">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <Skeleton className="h-4 w-full rounded-full" />
                    </div>
                ))}
            </div>
        </aside>

        <div className="flex-1 flex flex-col">
            <header className="flex items-center justify-between px-6 h-16 border-b">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-3 w-32 rounded-full" />
                        <Skeleton className="h-2 w-20 rounded-full" />
                    </div>
                </div>
                <Skeleton className="h-10 w-10 rounded-full" />
            </header>
             <Skeleton className="h-1 w-full" />
            <div className="flex-1 overflow-y-auto p-16 md:p-24">
                <div className="max-w-2xl mx-auto space-y-20">
                    <div className="text-center space-y-6">
                        <Skeleton className="h-20 w-3/4 mx-auto rounded-3xl" />
                        <Skeleton className="h-4 w-1/4 mx-auto rounded-full" />
                    </div>
                    <div className="space-y-8">
                        <Skeleton className="h-10 w-1/3 rounded-2xl" />
                        <div className="space-y-4">
                            <Skeleton className="h-4 w-full rounded-full" />
                            <Skeleton className="h-4 w-full rounded-full" />
                            <Skeleton className="h-4 w-full rounded-full" />
                            <Skeleton className="h-4 w-5/6 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  )
}
