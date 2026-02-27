'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { notFound, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  Settings, 
  ChevronsUp, 
  Music2, 
  Headphones, 
  Search, 
  Youtube, 
  Download, 
  ListChecks, 
  ScrollText,
  ChevronRight,
  List,
  Play,
  Pause,
  Sparkles,
  Clapperboard,
  FileText,
  Bookmark,
  Video,
  Layers,
  Loader2,
  Feather,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import type { Book, Chapter, Music, ScreenplayBlock, Shot, MusicTrack } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { searchYouTube, getPreviewAudioUrl } from '@/app/actions/music';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

type ReadingTheme = 'light' | 'dark' | 'sepia' | 'paper';
type FontFamily = 'font-serif' | 'font-sans' | 'font-mono';

const PAPER_TEXTURE_URL = "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&q=80&w=1600";

export default function ReadPage() {
  const params = useParams<{ id: string }>();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [fontFamily, setFontFamily] = useState<FontFamily>('font-serif');
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>('paper');
  
  const [readingProgress, setReadingProgress] = useState(0);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const [activeTrack, setActiveTrack] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [musicSearchQuery, setMusicSearchQuery] = useState("");
  const [ytResults, setYtResults] = useState<MusicTrack[]>([]);
  const [isSearchingYt, setIsSearchingYt] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const bookRef = useMemo(() => (firestore ? doc(firestore, 'books', params.id) : null), [firestore, params.id]);
  const { data: book, isLoading: isBookLoading } = useDoc<Book>(bookRef);

  const chaptersQuery = useMemo(() => (
    (firestore && currentUser) ? query(collection(firestore, 'books', params.id, 'chapters'), orderBy('order', 'asc')) : null
  ), [firestore, currentUser, params.id]);
  const { data: chapters } = useCollection<Chapter>(chaptersQuery);

  const shotsQuery = useMemo(() => (
    (firestore && currentUser && book?.type === 'screenplay') ? query(collection(firestore, 'books', params.id, 'shotList'), orderBy('number', 'asc')) : null
  ), [firestore, currentUser, params.id, book?.type]);
  const { data: shotList } = useCollection<Shot>(shotsQuery);

  const musicQuery = useMemo(() => (
    (firestore && currentUser) ? query(collection(firestore, 'music'), orderBy('createdAt', 'desc')) : null
  ), [firestore, currentUser]);
  const { data: musicList } = useCollection<Music>(musicQuery);

  const filteredInternalMusic = useMemo(() => {
    if (!musicList) return [];
    if (!musicSearchQuery.trim()) return musicList;
    return musicList.filter(m => 
      m.title.toLowerCase().includes(musicSearchQuery.toLowerCase()) ||
      m.artist.toLowerCase().includes(musicSearchQuery.toLowerCase())
    );
  }, [musicList, musicSearchQuery]);

  const playTrack = async (track: MusicTrack) => {
    if (!audioRef.current || !track.id) return;
    
    setIsAudioLoading(true);
    setActiveTrack(track);
    setIsPlaying(false);
    
    try {
        const streamUrl = await getPreviewAudioUrl(track.id);
        if (streamUrl) {
            audioRef.current.src = streamUrl;
            await audioRef.current.play();
            setIsPlaying(true);
        } else {
            toast({ variant: 'destructive', title: "Musik Gagal Dimuat", description: "Tidak dapat menjangkau aliran suara kawan." });
        }
    } catch (err) {
        console.warn("Playback error:", err);
        setIsPlaying(false);
    } finally {
        setIsAudioLoading(false);
    }
  };

  const handlePlayNext = useCallback(() => {
    if (!book?.playlist || book.playlist.length === 0) return;
    const currentIdx = book.playlist.findIndex(t => t.id === activeTrack?.id);
    if (currentIdx !== -1 && currentIdx < book.playlist.length - 1) {
        playTrack(book.playlist[currentIdx + 1]);
    }
  }, [book?.playlist, activeTrack]);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    const h = setTimeout(async () => {
        if (musicSearchQuery.trim().length >= 2) {
            setIsSearchingYt(true);
            try { const r = await searchYouTube(musicSearchQuery); setYtResults(r); } catch(e){} finally { setIsSearchingYt(false); }
        }
    }, 600);
    return () => clearTimeout(h);
  }, [musicSearchQuery]);

  const applyTheme = (t: ReadingTheme) => {
    setReadingTheme(t);
    localStorage.setItem('reading-theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  };

  useEffect(() => {
    setIsMounted(true);
    const savedTheme = (localStorage.getItem('reading-theme') as ReadingTheme) || 'paper';
    applyTheme(savedTheme);
  }, []);

  const handleScroll = () => {
    const c = scrollContainerRef.current;
    if (c) { 
      setReadingProgress((c.scrollTop / (c.scrollHeight - c.clientHeight)) * 100); 
      setShowScrollToTop(c.scrollTop > 500); 
    }
  };

  if (isBookLoading || !isMounted) return <ReadPageSkeleton />;
  if (!book) return notFound();

  const isScreenplay = book.type === 'screenplay';
  const isPoem = book.type === 'poem';

  const paperStyles = readingTheme === 'paper' ? {
    backgroundImage: `url("${PAPER_TEXTURE_URL}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    color: '#3e2723'
  } : {};

  return (
    <div 
      className={cn(
        "flex h-full w-full transition-all duration-500 mx-auto overflow-hidden relative", 
        readingTheme === 'sepia' ? "bg-[#f4ecd8] text-[#5b4636]" : 
        readingTheme === 'dark' ? "bg-background" : 
        readingTheme === 'light' ? "bg-background" : ""
      )}
      style={paperStyles}
    >
      <audio 
        ref={audioRef} 
        onEnded={handlePlayNext} 
        onError={() => {
            setIsPlaying(false);
            setIsAudioLoading(false);
        }}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className={cn(
            "flex items-center justify-between px-2 md:px-4 h-16 border-b sticky top-0 z-30 backdrop-blur-md",
            readingTheme === 'paper' ? "bg-white/40 border-black/10" : "bg-background/80"
        )}>
          <Link href={`/books/${book.id}`} className="shrink-0">
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 md:h-10 md:w-10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          
          <div className="flex flex-col items-center flex-1 min-w-0 mx-1 md:mx-4 text-center">
              <h2 className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] opacity-40 truncate w-full">
                Reading: {book.title}
              </h2>
              <div className="flex items-center justify-center gap-1.5 text-[7px] md:text-[8px] font-bold text-primary uppercase whitespace-nowrap">
                  {isScreenplay ? <Clapperboard className="h-2 w-2 md:h-2.5 md:w-2.5" /> : isPoem ? <Feather className="h-2 w-2 md:h-2.5 md:w-2.5" /> : <ScrollText className="h-2 w-2 md:h-2.5 md:w-2.5" />}
                  {isScreenplay ? 'INDUSTRIAL SCRIPT PRO' : isPoem ? 'POETRY MODE' : 'NOVEL MODE'}
              </div>
          </div>

          <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
            <AnimatePresence>
                {activeTrack && (
                    <motion.button 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => {
                          if (!audioRef.current || isAudioLoading) return;
                          if (isPlaying) {
                              audioRef.current.pause();
                              setIsPlaying(false);
                          } else {
                              audioRef.current.play().catch(() => {});
                              setIsPlaying(true);
                          }
                      }} 
                      className="h-9 w-9 md:h-10 md:w-10 flex items-center justify-center relative"
                    >
                        <motion.div 
                          animate={{ rotate: isPlaying ? 360 : 0 }} 
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }} 
                          className={cn(
                            "h-7 w-7 md:h-8 md:w-8 rounded-full bg-zinc-900 border border-white/20 overflow-hidden shadow-lg",
                            isAudioLoading && "opacity-50 animate-pulse"
                          )}
                        >
                            <img src={activeTrack.image} className="w-full h-full object-cover" alt="" />
                        </motion.div>
                        {isAudioLoading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="h-4 w-4 text-white animate-spin" />
                            </div>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 md:h-10 md:w-10">
                  <Headphones className={cn("h-4.5 w-4.5 md:h-5 md:w-5", isPlaying && "text-primary animate-pulse")} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-6 rounded-[2rem] border-none shadow-2xl" align="end">
                <div className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex justify-between text-[10px] font-black uppercase"><span>Volume</span><span>{Math.round(volume*100)}%</span></div>
                        <Slider defaultValue={[volume*100]} max={100} onValueChange={(v)=>setVolume(v[0]/100)} />
                    </div>

                    {book.playlist && book.playlist.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-[9px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Sparkles className="h-3 w-3" /> Playlist Penulis
                            </p>
                            <div className="max-h-40 overflow-y-auto space-y-2 no-scrollbar">
                                {book.playlist.map((track, i) => (
                                    <button 
                                        key={i} 
                                        className={cn(
                                            "flex items-center gap-3 w-full p-2.5 rounded-xl transition-all text-left",
                                            activeTrack?.id === track.id ? "bg-primary/10 text-primary shadow-inner" : "hover:bg-muted/50"
                                        )}
                                        onClick={() => playTrack(track)}
                                    >
                                        <div className="relative">
                                            <img src={track.image} className="h-10 w-10 rounded-lg object-cover shadow-sm" alt="" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-black text-xs truncate italic">"{track.name}"</p>
                                            <p className="text-[8px] font-bold opacity-60 uppercase mt-0.5">{track.artist}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input placeholder="Cari musik lain..." className="pl-9 h-10 rounded-xl bg-muted/30 border-none" value={musicSearchQuery} onChange={(e)=>setMusicSearchQuery(e.target.value)} />
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-2 no-scrollbar">
                        {filteredInternalMusic.map(m => (
                            <Button key={m.id} variant="ghost" className="w-full justify-start h-12 rounded-xl text-xs" onClick={()=>playTrack({
                                name: m.title,
                                artist: m.artist,
                                image: 'https://placehold.co/64x64?text=Music',
                                id: m.id,
                                source: 'youtube'
                            })}>"{m.title}"</Button>
                        ))}
                        {ytResults.map((t, i) => (
                            <Button key={i} variant="ghost" className="w-full justify-start h-12 rounded-xl text-xs text-red-500" onClick={()=>playTrack(t)}><Youtube className="h-3 w-3 mr-2" /> {t.name}</Button>
                        ))}
                    </div>
                </div>
              </PopoverContent>
            </Popover>

            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 md:h-10 md:w-10">
                    <List className="h-4.5 w-4.5 md:h-5 md:w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-[3rem] h-[80vh] md:h-[70vh] p-0 overflow-hidden z-[300] border-none shadow-[0_-20px_50px_rgba(0,0,0,0.2)]">
                    <div className="mx-auto w-16 h-1.5 bg-muted rounded-full mt-4 mb-2 shrink-0 opacity-50" />
                    
                    <div className="flex flex-col h-full">
                        <SheetHeader className="px-8 pt-6 pb-6 text-left shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-primary/10 text-primary rounded-2xl shadow-sm ring-1 ring-primary/20">
                                    <Layers className="h-6 w-6" />
                                </div>
                                <div className="space-y-1">
                                    <SheetTitle className="font-headline text-3xl font-black tracking-tight leading-none">Daftar Isi</SheetTitle>
                                    <SheetDescription className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                                        Navigasi {isScreenplay ? 'Adegan & Scene' : isPoem ? 'Bait Puisi' : 'Struktur Cerita'}
                                    </SheetDescription>
                                </div>
                            </div>
                        </SheetHeader>

                        <div className="flex-1 overflow-y-auto px-4 pb-32 no-scrollbar">
                            <div className="grid gap-3">
                                {chapters?.map((c, idx) => (
                                    <button 
                                        key={c.id} 
                                        onClick={()=> {
                                            document.getElementById(`chapter-${c.id}`)?.scrollIntoView({behavior:'smooth'});
                                            setIsSheetOpen(false);
                                        }} 
                                        className="group w-full flex items-center gap-4 p-4 rounded-[1.75rem] transition-all hover:bg-primary/5 active:scale-[0.98] border border-transparent hover:border-primary/10 text-left relative overflow-hidden"
                                    >
                                        <div className="h-12 w-12 rounded-2xl bg-muted group-hover:bg-primary group-hover:text-white transition-all duration-300 flex items-center justify-center shrink-0 shadow-sm font-black text-xs">
                                            {String(idx + 1).padStart(2, '0')}
                                        </div>
                                        
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[8px] font-black uppercase tracking-widest text-primary opacity-60">
                                                    {isScreenplay ? 'Scene' : isPoem ? 'Poem' : 'Bagian'}
                                                </span>
                                                <div className="h-1 w-1 rounded-full bg-border" />
                                                <span className="text-[8px] font-bold text-muted-foreground uppercase">
                                                    ID: {c.id.substring(0, 4)}
                                                </span>
                                            </div>
                                            <p className="font-bold text-sm md:text-base truncate group-hover:text-primary transition-colors pr-4">
                                                {c.title}
                                            </p>
                                        </div>

                                        <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary/40 group-hover:translate-x-1 transition-all" />
                                        
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 bg-primary rounded-r-full transition-all group-hover:h-8" />
                                    </button>
                                ))}

                                {isScreenplay && shotList && shotList.length > 0 && (
                                    <button 
                                        onClick={()=> {
                                            document.getElementById('production-shot-list')?.scrollIntoView({behavior:'smooth'});
                                            setIsSheetOpen(false);
                                        }} 
                                        className="w-full flex items-center gap-4 p-5 rounded-[2rem] transition-all bg-orange-500/5 hover:bg-orange-500/10 border-2 border-dashed border-orange-500/20 mt-6 active:scale-[0.98] text-left"
                                    >
                                        <div className="h-12 w-12 rounded-2xl bg-orange-500 text-white shadow-lg flex items-center justify-center shrink-0">
                                            <Video className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-orange-600 mb-1">Industrial Document</p>
                                            <h4 className="font-black text-sm md:text-lg text-orange-600 italic tracking-tighter">PRODUCTION SHOT LIST</h4>
                                        </div>
                                        <ArrowLeft className="h-5 w-5 text-orange-500 rotate-180" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 md:h-10 md:w-10">
                  <Settings className="h-4.5 w-4.5 md:h-5 md:w-5"/>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-6 rounded-[2rem] border-none shadow-2xl" align="end">
                <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'light', label: 'Light', icon: null },
                          { id: 'sepia', label: 'Sepia', icon: null },
                          { id: 'dark', label: 'Dark', icon: null },
                          { id: 'paper', label: 'Paper', icon: <ScrollText className="h-3 w-3" /> }
                        ].map(t => (
                            <Button 
                                key={t.id} 
                                variant={readingTheme === t.id ? 'default' : 'outline'} 
                                onClick={() => applyTheme(t.id as any)} 
                                className="h-10 text-[10px] uppercase font-black gap-2"
                            >
                                {t.icon}
                                {t.label}
                            </Button>
                        ))}
                    </div>
                    <div className="space-y-4">
                        <p className="text-[10px] font-black uppercase text-muted-foreground/60">Ukuran Huruf: {fontSize}px</p>
                        <Slider defaultValue={[fontSize]} min={14} max={32} onValueChange={(v)=>setFontSize(v[0])} />
                    </div>
                    {!isScreenplay && (
                        <div className="grid grid-cols-3 gap-2">
                            {['font-serif','font-sans','font-mono'].map(f=>(<Button key={f} variant={fontFamily===f?'default':'outline'} onClick={()=>setFontFamily(f as any)} className={cn("h-10 text-xs", f)}>Aa</Button>))}
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-border/40">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 px-1">Aset Produksi</p>
                        <div className="grid grid-cols-1 gap-2">
                            {book.fileUrl && (
                                <Button variant="outline" className="w-full justify-start h-11 rounded-xl gap-3 font-bold border-2" asChild>
                                    <a href={book.fileUrl} target="_blank" rel="noopener noreferrer">
                                        <Download className="h-4 w-4 text-primary" /> Unduh Naskah PDF
                                    </a>
                                </Button>
                            )}
                            {book.shotListUrl && (
                                <Button variant="outline" className="w-full justify-start h-11 rounded-xl gap-3 font-bold border-2 border-orange-100 hover:bg-orange-50" asChild>
                                    <a href={book.shotListUrl} target="_blank" rel="noopener noreferrer">
                                        <ListChecks className="h-4 w-4 text-orange-500" /> Unduh Shot List PDF
                                    </a>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <Progress value={readingProgress} className="w-full h-1 rounded-none bg-muted/20" />
        
        <div 
          ref={scrollContainerRef} 
          onScroll={handleScroll} 
          className="flex-1 overflow-y-auto scroll-smooth no-scrollbar relative z-10"
        >
          <div className={cn(
              "w-full mx-auto",
              isScreenplay ? "max-w-none px-0 py-0" : "max-w-4xl px-6 py-12"
          )}>
            {!isScreenplay && (
                <header className="text-center space-y-6 mb-20">
                    <h1 className="text-4xl md:text-6xl font-headline font-black italic">{book.title}</h1>
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Mahakarya Narasi Oleh</p>
                        <p className="font-headline text-xl md:text-2xl font-black">{book.authorName}</p>
                    </div>
                </header>
            )}

            <article 
              className={cn(
                "transition-all duration-500 mx-auto", 
                isScreenplay ? "font-mono max-w-none" : cn(fontFamily, "prose dark:prose-invert max-w-lg"),
                isPoem && "text-center italic"
              )} 
              style={{ fontSize: `${fontSize}px`, lineHeight: isScreenplay ? '1.2' : lineHeight }}
            >
                <>
                    {chapters?.map((chapter, cIdx) => (
                        <section 
                            key={chapter.id} 
                            id={`chapter-${chapter.id}`} 
                            className={cn(
                                isScreenplay ? "mb-0" : "mb-32"
                            )}
                        >
                            {!isScreenplay && (
                                <h2 className="text-3xl font-black mb-14">
                                    {chapter.title}
                                </h2>
                            )}
                            
                            {isScreenplay ? (
                                <div className="bg-white text-zinc-900 px-6 py-12 md:p-[1in] shadow-2xl border-b border-zinc-100 relative overflow-hidden flex flex-col gap-0.5 mx-auto max-w-[8.5in] min-h-[11in]">
                                    {/* Page Numbering Simulation */}
                                    <div className="absolute top-10 right-10 text-sm font-bold opacity-30 select-none">
                                        {cIdx + 1}.
                                    </div>
                                    
                                    <h2 className="text-sm text-center italic uppercase tracking-[0.5em] opacity-20 mb-12 select-none">
                                        {chapter.title}
                                    </h2>

                                    {(() => {
                                        try {
                                            if (chapter.content.trim().startsWith('[') && chapter.content.trim().endsWith(']')) {
                                                const blocks: ScreenplayBlock[] = JSON.parse(chapter.content);
                                                let lastCharacterInScene: string | null = null;

                                                return (
                                                    <div className="flex flex-col">
                                                        {blocks.map(block => {
                                                            let displayText = block.text;
                                                            
                                                            if (block.type === 'slugline') {
                                                                lastCharacterInScene = null;
                                                            } else if (block.type === 'character') {
                                                                const cleanName = block.text.trim().toUpperCase();
                                                                if (lastCharacterInScene === cleanName && cleanName !== "") {
                                                                    displayText = `${cleanName} (CONT'D)`;
                                                                } else {
                                                                    lastCharacterInScene = cleanName;
                                                                }
                                                            }

                                                            return (
                                                                <div key={block.id} className={cn(
                                                                    "whitespace-pre-wrap transition-all duration-300",
                                                                    block.type === 'slugline' && "font-bold uppercase mt-10 mb-4 text-[1.1em] tracking-tighter",
                                                                    block.type === 'action' && "text-left mb-4 font-medium leading-relaxed",
                                                                    block.type === 'character' && "mt-8 mb-0.5 font-bold uppercase tracking-tight text-center w-fit mx-auto min-w-[2in]",
                                                                    block.type === 'parenthetical' && "mb-0.5 italic text-[0.9em] opacity-70 text-center w-fit mx-auto before:content-['('] after:content-[')']",
                                                                    block.type === 'dialogue' && "mb-6 leading-relaxed text-[1.05em] text-center px-[15%] w-[85%] mx-auto",
                                                                    block.type === 'transition' && "text-right font-bold uppercase mt-8 mb-8 tracking-[0.2em] text-[0.9em] opacity-50",
                                                                )}
                                                                >
                                                                    {displayText}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            } else {
                                                return <div className="whitespace-pre-wrap italic opacity-60 text-center py-20 border-2 border-dashed rounded-3xl">Format naskah tidak didukung untuk tampilan terstruktur.</div>;
                                            }
                                        } catch (e) {
                                            return <div className="whitespace-pre-wrap leading-relaxed">{chapter.content}</div>;
                                        }
                                    })()}
                                </div>
                            ) : (
                                <div className={cn("markdown-content", isPoem && "text-center italic")}>
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {chapter.content}
                                  </ReactMarkdown>
                                </div>
                            )}
                        </section>
                    ))}
                </>

                {isScreenplay && shotList && shotList.length > 0 && (
                    <section id="production-shot-list" className="mt-0 py-20 bg-zinc-50 border-t border-zinc-200">
                        <div className="max-w-4xl mx-auto px-6">
                            <div className="text-center space-y-4 mb-14">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 text-orange-600 text-[10px] font-black uppercase tracking-[0.3em]">
                                    <Sparkles className="h-3.5 w-3.5" /> Industrial Document
                                </div>
                                <h2 className="text-3xl font-black uppercase tracking-[0.5em] text-orange-600 italic">Production Shot List</h2>
                            </div>
                            
                            <div className="overflow-x-auto rounded-[2.5rem] border bg-white shadow-2xl overflow-hidden border-orange-500/10">
                                <table className="w-full text-[10px] md:text-xs font-mono">
                                    <thead className="bg-orange-500/5 border-b border-orange-500/10">
                                        <tr className="font-black uppercase tracking-tighter text-orange-600/60">
                                            <th className="p-5 text-left w-12">#</th>
                                            <th className="p-5 text-left w-12">SC</th>
                                            <th className="p-5 text-left w-20">TYPE</th>
                                            <th className="p-5 text-left">DESCRIPTION</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/20">
                                        {shotList.map(shot => (
                                            <tr key={shot.id} className="hover:bg-orange-500/5 transition-colors group">
                                                <td className="p-5 font-black opacity-40">{shot.number}</td>
                                                <td className="p-5 font-bold">{shot.scene}</td>
                                                <td className="p-5">
                                                    <span className="bg-orange-500/10 text-orange-600 px-2 py-1 rounded-lg font-black text-[9px] uppercase shadow-sm border border-orange-500/20">
                                                        {shot.type}
                                                    </span>
                                                </td>
                                                <td className="p-5 text-zinc-600 italic leading-relaxed group-hover:text-zinc-900 transition-colors">{shot.description}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-14 text-center">
                                <p className="text-[9px] font-black uppercase tracking-[0.6em] text-muted-foreground opacity-30">End of Production Document • Elitera System</p>
                            </div>
                        </div>
                    </section>
                )}
            </article>
          </div>
        </div>

        {showScrollToTop && (
            <Button size="icon" className="fixed bottom-8 right-6 rounded-full h-12 w-12 shadow-2xl z-50 bg-primary/90 backdrop-blur hover:bg-primary transition-all active:scale-90" onClick={() => scrollContainerRef.current?.scrollTo({top:0, behavior:'smooth'})}>
                <ChevronsUp className="h-6 w-6 text-white"/>
            </Button>
        )}
      </div>
      <style jsx global>{`
        .prose p { margin-bottom: 1.5em; text-indent: 1.5em; } 
        .prose p:first-of-type { text-indent: 0; }
        
        @media (max-width: 768px) {
            .font-mono article [class*="w-fit"] { min-width: 1.5in !important; }
            .font-mono article [class*="w-[85%]"] { width: 95% !important; padding-left: 5%; padding-right: 5%; }
        }
      `}</style>
    </div>
  );
}

function ReadPageSkeleton() {
  return <div className="max-w-lg mx-auto h-screen p-6 animate-pulse"><Skeleton className="h-12 w-full rounded-2xl mb-10" /><Skeleton className="h-64 w-full rounded-3xl" /></div>
}
