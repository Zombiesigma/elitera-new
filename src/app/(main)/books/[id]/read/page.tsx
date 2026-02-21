'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { notFound, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Sun, 
  Moon, 
  Text, 
  Settings, 
  ChevronsUp, 
  Music2, 
  Volume2, 
  Play, 
  Pause, 
  Headphones, 
  X,
  Search,
  Loader2,
  Youtube,
  Sparkles,
  Clapperboard,
  BookOpen
} from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import type { Book, Chapter, Music } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { searchYouTube, type MusicTrack } from '@/app/actions/music';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export default function ReadPage() {
  const params = useParams<{ id: string }>();
  const firestore = useFirestore();
  const [isMounted, setIsMounted] = useState(false);
  const [fontSize, setFontSize] = useState(18);
  const [isDark, setIsDark] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // Hybrid Audio System
  const [activeMusic, setActiveMusic] = useState<Music | null>(null);
  const [activeYoutube, setActiveYoutube] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const [isYtApiReady, setIsYtApiReady] = useState(false);
  const [queuedVideoId, setQueuedVideoId] = useState<string | null>(null);
  const [musicSearchQuery, setMusicSearchQuery] = useState("");
  const [ytResults, setYtResults] = useState<MusicTrack[]>([]);
  const [isSearchingYt, setIsSearchingYt] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isPlayerReady = (player: any) => player && typeof player.playVideo === 'function' && typeof player.loadVideoById === 'function' && typeof player.setVolume === 'function';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const setupAPI = () => {
      window.onYouTubeIframeAPIReady = () => {
        console.log("[Elitera Audio] YouTube Iframe API Ready");
        setIsYtApiReady(true);
      };
      if (window.YT && window.YT.Player) {
        setIsYtApiReady(true);
      } else {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }
    };
    setupAPI();
  }, []);

  useEffect(() => {
    if (isYtApiReady && !ytPlayerRef.current && typeof window !== 'undefined') {
        const playerDiv = document.getElementById('yt-bg-player');
        if (playerDiv) {
            try {
                ytPlayerRef.current = new window.YT.Player('yt-bg-player', {
                    height: '1',
                    width: '1',
                    videoId: '',
                    playerVars: { 'autoplay': 0, 'controls': 0, 'enablejsapi': 1, 'origin': window.location.origin },
                    events: {
                        'onReady': (event: any) => {
                            event.target.setVolume(volume * 100);
                            if (queuedVideoId) {
                                event.target.loadVideoById(queuedVideoId);
                                setQueuedVideoId(null);
                                setIsPlaying(true);
                            }
                        },
                        'onStateChange': (event: any) => {
                            if (event.data === window.YT?.PlayerState?.PLAYING) setIsPlaying(true);
                            if (event.data === window.YT?.PlayerState?.PAUSED) setIsPlaying(false);
                        }
                    }
                });
            } catch (err) { console.error("[Elitera Audio] YT Init Error:", err); }
        }
    }
  }, [isYtApiReady, volume, queuedVideoId]);

  const bookRef = useMemo(() => (firestore ? doc(firestore, 'books', params.id) : null), [firestore, params.id]);
  const { data: book, isLoading: isBookLoading } = useDoc<Book>(bookRef);

  const chaptersQuery = useMemo(() => (
    firestore ? query(collection(firestore, 'books', params.id, 'chapters'), orderBy('order', 'asc')) : null
  ), [firestore, params.id]);
  const { data: chapters } = useCollection<Chapter>(chaptersQuery);

  const musicQuery = useMemo(() => (
    firestore ? query(collection(firestore, 'music'), orderBy('createdAt', 'desc')) : null
  ), [firestore]);
  const { data: musicList } = useCollection<Music>(musicQuery);

  const filteredInternalMusic = useMemo(() => {
    if (!musicList) return [];
    if (!musicSearchQuery.trim()) return musicList;
    return musicList.filter(m => m.title.toLowerCase().includes(musicSearchQuery.toLowerCase()) || m.artist.toLowerCase().includes(musicSearchQuery.toLowerCase()));
  }, [musicList, musicSearchQuery]);

  useEffect(() => {
    const handler = setTimeout(async () => {
        if (musicSearchQuery.trim().length >= 2) {
            setIsSearchingYt(true);
            try {
                const results = await searchYouTube(musicSearchQuery);
                setYtResults(results);
            } catch (err) { console.error(err); } finally { setIsSearchingYt(false); }
        } else { setYtResults([]); }
    }, 600);
    return () => clearTimeout(handler);
  }, [musicSearchQuery]);

  useEffect(() => {
    setIsMounted(true);
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    document.documentElement.classList.toggle('dark', newIsDark);
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
  };

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (isPlayerReady(ytPlayerRef.current)) ytPlayerRef.current.setVolume(volume * 100);
  }, [volume]);

  const playInternal = (music: Music) => {
    if (isPlayerReady(ytPlayerRef.current)) ytPlayerRef.current.pauseVideo();
    setActiveYoutube(null);
    setQueuedVideoId(null);
    setActiveMusic(music);
    if (audioRef.current) {
        audioRef.current.src = music.url;
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  };

  const playYoutube = (track: MusicTrack) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    setActiveMusic(null);
    setActiveYoutube(track);
    if (isPlayerReady(ytPlayerRef.current)) {
        ytPlayerRef.current.loadVideoById(track.id);
        setIsPlaying(true);
    } else {
        console.warn("[Elitera Audio] YT Player not ready yet, queuing video...");
        setQueuedVideoId(track.id!);
        setIsPlaying(true);
    }
  };

  const stopAllMusic = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    if (isPlayerReady(ytPlayerRef.current)) ytPlayerRef.current.pauseVideo();
    setActiveMusic(null);
    setActiveYoutube(null);
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (activeMusic && audioRef.current) {
        if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
        else { audioRef.current.play().then(() => setIsPlaying(true)); }
    } else if (activeYoutube) {
        if (isPlayerReady(ytPlayerRef.current)) {
            if (isPlaying) ytPlayerRef.current.pauseVideo();
            else ytPlayerRef.current.playVideo();
        } else { setIsPlaying(!isPlaying); }
    }
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setReadingProgress((scrollTop / (scrollHeight - clientHeight)) * 100);
      setShowScrollToTop(scrollTop > 500);
    }
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [isMounted]);

  if (isBookLoading || !isMounted) return <ReadPageSkeleton />;
  if (!book) notFound();

  const isScreenplay = book.type === 'screenplay';

  return (
    <div className="flex h-screen -mt-14 -mx-4 md:-mx-6 bg-background selection:bg-primary/20">
      <audio ref={audioRef} loop preload="auto" />
      <div className="fixed bottom-0 right-0 w-1 h-1 opacity-0 pointer-events-none z-[-1] overflow-hidden">
        <div id="yt-bg-player" />
      </div>

      <aside className="hidden md:block md:w-72 lg:w-80 border-r flex-shrink-0 shadow-xl z-20 bg-card/30 backdrop-blur-sm">
          <div className="p-8 border-b space-y-2 bg-background/50">
            <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <h2 className="font-headline text-xl font-black truncate leading-tight">{book.title}</h2>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{isScreenplay ? 'Daftar Scene' : 'Daftar Isi'}</p>
          </div>
          <nav className="flex-1 overflow-y-auto pt-2">
            {chapters?.map((chapter) => (
                <button key={chapter.id} onClick={() => document.getElementById(`chapter-${chapter.id}`)?.scrollIntoView({ behavior: 'smooth' })} className="w-full text-left px-6 py-4 hover:bg-primary/5 transition-all flex items-center gap-4 text-sm group">
                    <span className="font-mono text-[10px] font-black text-muted-foreground bg-muted group-hover:bg-primary group-hover:text-white px-2 py-1 rounded-md transition-all">{String(chapter.order).padStart(2, '0')}</span>
                    <span className="text-foreground font-bold group-hover:text-primary transition-colors truncate">{chapter.title}</span>
                </button>
            ))}
          </nav>
      </aside>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className="flex items-center justify-between px-4 h-16 border-b sticky top-14 bg-background/95 backdrop-blur-md z-30 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Link href={`/books/${book.id}`}><Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button></Link>
            <div className="flex flex-col min-w-0 ml-2">
                <h1 className="font-headline text-sm font-black truncate text-primary uppercase tracking-tight">{book.title}</h1>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{isScreenplay ? 'Penulis Skenario' : 'Pujangga'}: {book.authorName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <AnimatePresence>
                {(activeMusic || activeYoutube) && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center gap-3 px-4 py-1.5 bg-primary/10 rounded-full border border-primary/20 mr-2">
                        <motion.div animate={{ rotate: isPlaying ? 360 : 0 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="h-6 w-6 rounded-full bg-zinc-900 flex items-center justify-center border border-white/20 shadow-lg">
                            {activeYoutube ? <Youtube className="h-3 w-3 text-red-500" /> : <Music2 className="h-3 w-3 text-primary" />}
                        </motion.div>
                        <button onClick={togglePlayback} className="text-primary hover:scale-110 active:scale-90 p-1">
                            {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            <Popover>
              <PopoverTrigger asChild><Button variant="ghost" size="icon" className="rounded-full group"><Settings className="h-5 w-5 text-muted-foreground group-hover:text-primary"/></Button></PopoverTrigger>
              <PopoverContent className="w-80 p-0 shadow-2xl rounded-[2.5rem] border-none bg-card/95 backdrop-blur-xl overflow-hidden" align="end">
                <Tabs defaultValue="visual" className="w-full">
                    <TabsList className="w-full h-12 bg-muted/30 rounded-none border-b">
                        <TabsTrigger value="visual" className="flex-1 text-[10px] font-black uppercase tracking-widest gap-2"><Text className="h-3 w-3" /> Tampilan</TabsTrigger>
                        <TabsTrigger value="audio" className="flex-1 text-[10px] font-black uppercase tracking-widest gap-2"><Headphones className="h-3 w-3" /> Suasana</TabsTrigger>
                    </TabsList>
                    <TabsContent value="visual" className="p-8 space-y-8 mt-0">
                        <div className="space-y-6">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Ukuran Huruf</span>
                                <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-mono font-black">{fontSize}px</span>
                            </div>
                            <Slider defaultValue={[fontSize]} max={32} min={14} step={1} className="w-full" onValueChange={(v) => setFontSize(v[0])} />
                        </div>
                        <div className="pt-6 border-t flex items-center justify-between">
                            <div className="flex flex-col gap-0.5"><span className="text-xs font-black uppercase tracking-widest">Mode Gelap</span></div>
                            <Button variant="outline" size="icon" className={cn("rounded-2xl h-12 w-12 transition-all border-2", isDark ? "bg-primary text-white border-primary shadow-lg" : "")} onClick={toggleTheme}>{isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5"/>}</Button>
                        </div>
                    </TabsContent>
                    <TabsContent value="audio" className="p-6 space-y-6 mt-0 flex flex-col h-[400px]">
                        <div className="space-y-4 shrink-0">
                            <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-muted-foreground uppercase tracking-widest text-[10px]">Volume</span>
                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-mono font-black">{Math.round(volume * 100)}%</span>
                            </div>
                            <Slider defaultValue={[volume * 100]} max={100} min={0} step={1} className="w-full" onValueChange={(v) => setVolume(v[0] / 100)} />
                        </div>
                        <Separator className="opacity-50" />
                        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                            <div className="relative group px-1">
                                <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5", isSearchingYt ? "text-primary animate-pulse" : "text-muted-foreground")} />
                                <Input placeholder="Cari musik..." className="h-10 pl-10 rounded-xl bg-muted/30 border-none text-xs font-medium" value={musicSearchQuery} onChange={(e) => setMusicSearchQuery(e.target.value)} />
                            </div>
                            <div className="grid gap-2 overflow-y-auto no-scrollbar pr-1 flex-1">
                                <Button variant="ghost" className="w-full justify-start h-12 rounded-xl bg-muted/10 hover:bg-rose-500/10 hover:text-rose-500" onClick={stopAllMusic}><X className="h-4 w-4 mr-3" /><span className="font-bold text-xs uppercase tracking-widest">Heningkan</span></Button>
                                <div className="space-y-1">
                                    <p className="text-[8px] font-black uppercase text-muted-foreground/60 px-2 py-2">Koleksi Elitera</p>
                                    {filteredInternalMusic.map((music) => (
                                        <Button key={music.id} variant="ghost" className={cn("w-full justify-start h-14 rounded-xl border-2 p-3", activeMusic?.id === music.id ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-muted/20")} onClick={() => playInternal(music)}>
                                            <div className="flex flex-col items-start min-w-0 text-left"><span className="font-black text-xs truncate w-full italic">"{music.title}"</span><span className="text-[8px] font-bold uppercase opacity-60 truncate">{music.artist}</span></div>
                                        </Button>
                                    ))}
                                </div>
                                {ytResults.length > 0 && (
                                    <div className="space-y-1 pt-2 border-t">
                                        <p className="text-[8px] font-black uppercase text-red-500/60 px-2 py-2">YouTube</p>
                                        {ytResults.map((track, i) => (
                                            <Button key={i} variant="ghost" className={cn("w-full justify-start h-14 rounded-xl border-2 p-3", activeYoutube?.id === track.id ? "border-red-500 bg-red-500/5 text-red-500" : "border-transparent bg-muted/20")} onClick={() => playYoutube(track)}>
                                                <div className="flex flex-col items-start min-w-0 text-left"><span className="font-black text-xs truncate w-full italic">"{track.name}"</span><span className="text-[8px] font-bold uppercase opacity-60 truncate">{track.artist}</span></div>
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <Progress value={readingProgress} className="w-full h-1 rounded-none bg-muted z-30" />
        
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto relative bg-background/50 scroll-smooth">
          <div className="max-w-3xl mx-auto px-6 py-16 md:py-28">
            <header className="mb-24 text-center space-y-6">
                <div className="flex justify-center mb-8">
                    <div className="p-4 rounded-[2rem] bg-primary/5 border border-primary/10">
                        {isScreenplay ? <Clapperboard className="h-8 w-8 text-primary" /> : <BookOpen className="h-8 w-8 text-primary" />}
                    </div>
                </div>
                <h1 className="font-headline text-5xl md:text-7xl font-black text-foreground leading-[1.1] tracking-tight italic">{book.title}</h1>
                <p className="text-muted-foreground font-bold tracking-[0.4em] uppercase text-[10px] pt-4">Sebuah {isScreenplay ? 'Naskah Film' : 'Karya'} dari {book.authorName}</p>
            </header>

            <article 
                className={cn(
                    "max-w-none transition-all duration-300", 
                    isScreenplay ? "font-mono screenplay-view text-foreground/90" : "prose prose-zinc dark:prose-invert prose-p:leading-[1.8] font-serif novel-view"
                )} 
                style={{ fontSize: `${fontSize}px` }}
            >
                {chapters?.map((chapter) => (
                    <section key={chapter.id} id={`chapter-${chapter.id}`} className="scroll-m-32 mb-32 md:mb-48">
                        {!isScreenplay && (
                            <div className="flex items-center gap-6 mb-16">
                                <span className="font-mono text-xs font-black text-primary/30 tracking-widest uppercase">BAGIAN {String(chapter.order).padStart(2, '0')}</span>
                                <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
                            </div>
                        )}
                        <h2 className={cn("font-black mb-12 m-0 border-none leading-tight", isScreenplay ? "text-2xl font-mono text-primary/40 uppercase text-center" : "font-headline text-4xl md:text-5xl")}>
                            {chapter.title}
                        </h2>
                        
                        <div className="content-render">
                            {isScreenplay ? (
                                <div className="space-y-1">
                                    {chapter.content.split('\n').map((line, idx) => {
                                        const trimmed = line.trim();
                                        if (!trimmed) return <div key={idx} className="h-4" />;
                                        
                                        // Industry Screenplay Rules
                                        const isSlugline = trimmed.startsWith('INT.') || trimmed.startsWith('EXT.');
                                        const isTransition = (trimmed === trimmed.toUpperCase() && (trimmed.startsWith('FADE ') || trimmed.endsWith('OUT.') || trimmed.endsWith('IN.')));
                                        const isCharacter = trimmed === trimmed.toUpperCase() && !isSlugline && !isTransition && trimmed.length > 1;
                                        const isParenthetical = trimmed.startsWith('(') && trimmed.endsWith(')');
                                        
                                        // Logic for Dialogue Detection
                                        const lines = chapter.content.split('\n');
                                        const prevLine = idx > 0 ? lines[idx-1].trim() : "";
                                        const isDialogue = !isSlugline && !isTransition && !isCharacter && !isParenthetical && 
                                                          (prevLine === prevLine.toUpperCase() && prevLine !== "" || (prevLine.startsWith('(') && prevLine.endsWith(')')));

                                        return (
                                            <div 
                                                key={idx} 
                                                className={cn(
                                                    "transition-colors",
                                                    isSlugline && "font-bold text-foreground mt-8 mb-4",
                                                    isCharacter && "text-center mt-6 mb-1 text-primary",
                                                    isDialogue && "max-w-[60%] mx-auto text-center md:max-w-[50%]",
                                                    isParenthetical && "max-w-[40%] mx-auto text-center italic opacity-70",
                                                    isTransition && "text-right mt-8 mb-8 font-bold opacity-60",
                                                    !isSlugline && !isCharacter && !isDialogue && !isParenthetical && !isTransition && "mb-4 leading-relaxed"
                                                )}
                                            >
                                                {trimmed}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="markdown-content">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{chapter.content}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </section>
                ))}
            </article>
          </div>
        </div>

        <AnimatePresence>
            {showScrollToTop && (
                <motion.div initial={{ opacity: 0, scale: 0.5, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.5, y: 20 }} className="absolute bottom-10 right-10 z-40">
                    <Button size="icon" className="rounded-2xl h-14 w-14 bg-primary text-white shadow-xl hover:-translate-y-2 transition-all" onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}><ChevronsUp className="h-7 w-7"/></Button>
                </motion.div>
            )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        .novel-view p {
            margin-bottom: 1.5em;
            text-indent: 2em;
        }
        .novel-view p:first-of-type {
            text-indent: 0;
        }
        .screenplay-view {
            line-height: 1.2;
            letter-spacing: -0.02em;
        }
      `}</style>
    </div>
  );
}

function ReadPageSkeleton() {
  return <div className="flex h-screen -mt-14 -mx-4 md:-mx-6 bg-background animate-pulse"><aside className="hidden md:block w-72 lg:w-80 border-r p-8 space-y-10"><Skeleton className="h-10 w-3/4" /></aside><div className="flex-1 flex flex-col"><header className="flex items-center justify-between px-6 h-16 border-b"><Skeleton className="h-10 w-48" /></header><div className="flex-1 p-16 md:p-24"><div className="max-w-2xl mx-auto space-y-20"><Skeleton className="h-20 w-3/4 mx-auto" /></div></div></div></div>
}
