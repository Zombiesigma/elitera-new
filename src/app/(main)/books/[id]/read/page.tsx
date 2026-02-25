
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
  FileText
} from 'lucide-react';
import Link from 'next/link';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import type { Book, Chapter, Music, ScreenplayBlock, Shot, MusicTrack } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { searchYouTube } from '@/app/actions/music';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

type ReadingTheme = 'light' | 'dark' | 'sepia' | 'paper';
type FontFamily = 'font-serif' | 'font-sans' | 'font-mono';

const PAPER_TEXTURE_URL = "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&q=80&w=1600";

export default function ReadPage() {
  const params = useParams<{ id: string }>();
  const firestore = useFirestore();
  const [isMounted, setIsMounted] = useState(false);
  
  // Reading Preferences - Paper is now DEFAULT
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [fontFamily, setFontFamily] = useState<FontFamily>('font-serif');
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>('paper');
  
  // States
  const [readingProgress, setReadingProgress] = useState(0);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // Audio System
  const [activeTrack, setActiveTrack] = useState<MusicTrack | null>(null);
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

  const isPlayerReady = (player: any) => player && typeof player.playVideo === 'function';

  const bookRef = useMemo(() => (firestore ? doc(firestore, 'books', params.id) : null), [firestore, params.id]);
  const { data: book, isLoading: isBookLoading } = useDoc<Book>(bookRef);

  const chaptersQuery = useMemo(() => (
    firestore ? query(collection(firestore, 'books', params.id, 'chapters'), orderBy('order', 'asc')) : null
  ), [firestore, params.id]);
  const { data: chapters } = useCollection<Chapter>(chaptersQuery);

  const shotsQuery = useMemo(() => (
    (firestore && book?.type === 'screenplay') ? query(collection(firestore, 'books', params.id, 'shotList'), orderBy('number', 'asc')) : null
  ), [firestore, params.id, book?.type]);
  const { data: shotList } = useCollection<Shot>(shotsQuery);

  const musicQuery = useMemo(() => (
    firestore ? query(collection(firestore, 'music'), orderBy('createdAt', 'desc')) : null
  ), [firestore]);
  const { data: musicList } = useCollection<Music>(musicQuery);

  const filteredInternalMusic = useMemo(() => {
    if (!musicList) return [];
    if (!musicSearchQuery.trim()) return musicList;
    return musicList.filter(m => 
      m.title.toLowerCase().includes(musicSearchQuery.toLowerCase()) ||
      m.artist.toLowerCase().includes(musicSearchQuery.toLowerCase())
    );
  }, [musicList, musicSearchQuery]);

  const playTrack = (track: MusicTrack) => {
    if (track.source === 'youtube') {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
        if (isPlayerReady(ytPlayerRef.current)) {
            ytPlayerRef.current.loadVideoById(track.id);
            setIsPlaying(true);
        } else {
            setQueuedVideoId(track.id!);
            setIsPlaying(true);
        }
    } else if (track.source === 'internal') {
        if (isPlayerReady(ytPlayerRef.current)) ytPlayerRef.current.pauseVideo();
        if (audioRef.current && track.url) {
            audioRef.current.src = track.url;
            audioRef.current.play().then(() => setIsPlaying(true));
        }
    }
    setActiveTrack(track);
  };

  const handlePlayNext = useCallback(() => {
    if (!book?.playlist || book.playlist.length === 0) return;
    const currentIdx = book.playlist.findIndex(t => t.id === activeTrack?.id || t.url === activeTrack?.url);
    if (currentIdx !== -1 && currentIdx < book.playlist.length - 1) {
        playTrack(book.playlist[currentIdx + 1]);
    }
  }, [book?.playlist, activeTrack]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.onYouTubeIframeAPIReady = () => setIsYtApiReady(true);
    if (!(window as any).YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
    } else { setIsYtApiReady(true); }
  }, []);

  useEffect(() => {
    if (isYtApiReady && !ytPlayerRef.current) {
        ytPlayerRef.current = new (window as any).YT.Player('yt-bg-player', {
            height: '1', width: '1', videoId: '',
            playerVars: { 'autoplay': 0, 'controls': 0 },
            events: {
                'onReady': (e: any) => {
                    e.target.setVolume(volume * 100);
                    if (queuedVideoId) { e.target.loadVideoById(queuedVideoId); setQueuedVideoId(null); }
                },
                'onStateChange': (e: any) => {
                    if (e.data === 0) handlePlayNext();
                    if (e.data === 1) setIsPlaying(true);
                    if (e.data === 2) setIsPlaying(false);
                }
            }
        });
    }
  }, [isYtApiReady, volume, queuedVideoId, handlePlayNext]);

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
  if (!book) notFound();

  const isScreenplay = book.type === 'screenplay';

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
      <audio ref={audioRef} onEnded={handlePlayNext} />
      <div id="yt-bg-player" className="hidden" />

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className={cn(
            "flex items-center justify-between px-4 h-16 border-b sticky top-0 z-30 backdrop-blur-md",
            readingTheme === 'paper' ? "bg-white/40 border-black/10" : "bg-background/80"
        )}>
          <Link href={`/books/${book.id}`}><Button variant="ghost" size="icon" className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button></Link>
          
          <div className="flex flex-col items-center flex-1 mx-4">
              <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 truncate w-full text-center">Reading: {book.title}</h2>
              {isScreenplay && (
                  <div className="flex items-center gap-1.5 text-[8px] font-bold text-primary uppercase">
                      <Clapperboard className="h-2.5 w-2.5" /> INDUSTRIAL SCRIPT MODE
                  </div>
              )}
          </div>

          <div className="flex items-center gap-1">
            <AnimatePresence>
                {activeTrack && (
                    <motion.button 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => {
                          if (activeTrack.source === 'youtube' && isPlayerReady(ytPlayerRef.current)) {
                              if (isPlaying) ytPlayerRef.current.pauseVideo();
                              else ytPlayerRef.current.playVideo();
                          } else if (activeTrack.source === 'internal' && audioRef.current) {
                              if (isPlaying) audioRef.current.pause();
                              else audioRef.current.play();
                          }
                          setIsPlaying(!isPlaying);
                      }} 
                      className="h-10 w-10 flex items-center justify-center relative"
                    >
                        <motion.div 
                          animate={{ rotate: isPlaying ? 360 : 0 }} 
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }} 
                          className="h-8 w-8 rounded-full bg-zinc-900 border border-white/20 overflow-hidden shadow-lg"
                        >
                            <img src={activeTrack.image} className="w-full h-full object-cover" alt="" />
                        </motion.div>
                    </motion.button>
                )}
            </AnimatePresence>

            <Popover>
              <PopoverTrigger asChild><Button variant="ghost" size="icon" className="rounded-full"><Headphones className={cn("h-5 w-5", isPlaying && "text-primary animate-pulse")} /></Button></PopoverTrigger>
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
                                            activeTrack?.name === track.name ? "bg-primary/10 text-primary shadow-inner" : "hover:bg-muted/50"
                                        )}
                                        onClick={() => playTrack(track)}
                                    >
                                        <img src={track.image} className="h-10 w-10 rounded-lg object-cover shadow-sm" alt="" />
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
                                url: m.url,
                                source: 'internal'
                            })}>"{m.title}"</Button>
                        ))}
                        {ytResults.map((t, i) => (
                            <Button key={i} variant="ghost" className="w-full justify-start h-12 rounded-xl text-xs text-red-500" onClick={()=>playTrack(t)}><Youtube className="h-3 w-3 mr-2" /> {t.name}</Button>
                        ))}
                    </div>
                </div>
              </PopoverContent>
            </Popover>

            <Sheet>
                <SheetTrigger asChild><Button variant="ghost" size="icon" className="rounded-full"><List className="h-5 w-5" /></Button></SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-[2.5rem] h-[60vh] z-[300]">
                    <div className="mx-auto w-12 h-1 bg-muted rounded-full mt-2 mb-6" />
                    <SheetHeader>
                        <SheetTitle className="font-headline text-2xl font-black px-4">Daftar Isi</SheetTitle>
                    </SheetHeader>
                    <div className="overflow-y-auto h-full pt-4 space-y-1 px-2 pb-20">
                        {chapters?.map(c => (
                            <button key={c.id} onClick={()=> {
                                document.getElementById(`chapter-${c.id}`)?.scrollIntoView({behavior:'smooth'});
                            }} className="w-full text-left p-4 hover:bg-primary/5 rounded-2xl text-sm font-bold transition-colors">{c.title}</button>
                        ))}
                        {isScreenplay && shotList && shotList.length > 0 && (
                            <button onClick={()=> {
                                document.getElementById('production-shot-list')?.scrollIntoView({behavior:'smooth'});
                            }} className="w-full text-left p-4 hover:bg-orange-500/5 text-orange-600 rounded-2xl text-sm font-black uppercase tracking-widest border border-dashed border-orange-500/20 mt-4">PRODUCTION SHOT LIST</button>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            <Popover>
              <PopoverTrigger asChild><Button variant="ghost" size="icon" className="rounded-full"><Settings className="h-5 w-5"/></Button></PopoverTrigger>
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
          <div className="max-w-4xl mx-auto px-6 py-12 space-y-20">
            <header className="text-center space-y-6">
                <h1 className="text-4xl md:text-6xl font-headline font-black italic">{book.title}</h1>
                <div className="flex flex-col items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Mahakarya Narasi Oleh</p>
                    <p className="font-headline text-xl md:text-2xl font-black">{book.authorName}</p>
                </div>
            </header>

            <article 
              className={cn("transition-all duration-500 mx-auto", isScreenplay ? "font-mono max-w-[8.5in]" : cn(fontFamily, "prose dark:prose-invert max-w-lg"))} 
              style={{ fontSize: `${fontSize}px`, lineHeight: isScreenplay ? '1.2' : lineHeight }}
            >
                {chapters?.map((chapter) => (
                    <section key={chapter.id} id={`chapter-${chapter.id}`} className="mb-32">
                        <h2 className={cn("font-black mb-14", isScreenplay ? "text-xl text-center italic uppercase tracking-[0.5em] opacity-30" : "text-3xl")}>
                            {chapter.title}
                        </h2>
                        
                        {isScreenplay ? (
                            <div className="bg-white text-zinc-900 p-8 md:p-[1in] rounded-[2.5rem] shadow-[inset_0_0_50px_rgba(0,0,0,0.02),0_20px_50px_-15px_rgba(0,0,0,0.1)] border border-black/5 relative overflow-hidden flex flex-col gap-0.5">
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                                {(() => {
                                    try {
                                        if (chapter.content.trim().startsWith('[') && chapter.content.trim().endsWith(']')) {
                                            const blocks: ScreenplayBlock[] = JSON.parse(chapter.content);
                                            let lastCharacterInScene: string | null = null;

                                            return (
                                                <div className="flex flex-col">
                                                    {blocks.map(block => {
                                                        let displayText = block.text;
                                                        
                                                        // Accurate (CONT'D) logic for Reader
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
                                                                block.type === 'slugline' && "font-bold uppercase mt-10 mb-4 text-[1.1em] border-b border-black/5 pb-1 tracking-tighter",
                                                                block.type === 'action' && "text-left mb-4 opacity-90 font-medium leading-relaxed",
                                                                block.type === 'character' && "mt-8 mb-0.5 font-bold uppercase tracking-tight text-center",
                                                                block.type === 'parenthetical' && "mb-0.5 italic text-[0.9em] opacity-70 text-center before:content-['('] after:content-[')']",
                                                                block.type === 'dialogue' && "mb-6 leading-relaxed text-[1.05em] text-center px-[10%]",
                                                                block.type === 'transition' && "text-right font-bold uppercase mt-8 mb-8 tracking-[0.2em] text-[0.9em] opacity-50",
                                                            )}
                                                            style={
                                                                block.type === 'character' ? { marginLeft: 'auto', marginRight: 'auto', width: 'fit-content', minWidth: '2in' } :
                                                                block.type === 'parenthetical' ? { marginLeft: 'auto', marginRight: 'auto', width: 'fit-content' } :
                                                                block.type === 'dialogue' ? { marginLeft: 'auto', marginRight: 'auto', width: '80%' } :
                                                                {}
                                                            }
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
                            <div className="markdown-content">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {chapter.content}
                              </ReactMarkdown>
                            </div>
                        )}
                    </section>
                ))}

                {isScreenplay && shotList && shotList.length > 0 && (
                    <section id="production-shot-list" className="mt-32 pt-20 border-t border-dashed border-border/40">
                        <div className="text-center space-y-4 mb-14">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 text-orange-600 text-[10px] font-black uppercase tracking-[0.3em]">
                                <Sparkles className="h-3.5 w-3.5" /> Industrial Document
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-[0.5em] text-orange-600 italic">Production Shot List</h2>
                        </div>
                        
                        <div className="overflow-x-auto rounded-[2.5rem] border bg-card/50 backdrop-blur-md shadow-2xl overflow-hidden border-orange-500/10">
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
                                            <td className="p-5 text-foreground/80 italic leading-relaxed group-hover:text-foreground transition-colors">{shot.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-14 text-center">
                            <p className="text-[9px] font-black uppercase tracking-[0.6em] text-muted-foreground opacity-30">End of Production Document • Elitera System</p>
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
        
        /* Professional Screenplay Formatting */
        @media (min-width: 768px) {
            .font-mono article { padding-left: 0; padding-right: 0; }
        }
        
        @media (max-width: 768px) {
            .font-mono article { font-size: 14px !important; }
            .font-mono > div { padding: 1.5rem !important; }
            .font-mono [style*="width: 80%"] { width: 95% !important; }
        }
      `}</style>
    </div>
  );
}

function ReadPageSkeleton() {
  return <div className="max-w-lg mx-auto h-screen p-6 animate-pulse"><Skeleton className="h-12 w-full rounded-2xl mb-10" /><Skeleton className="h-64 w-full rounded-3xl" /></div>
}
