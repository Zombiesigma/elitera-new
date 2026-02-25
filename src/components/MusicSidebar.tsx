'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Music, Loader2, Play, Pause, ListMusic, Sparkles, PlusCircle, Trash2, Disc, Volume2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchYouTube, getPreviewAudioUrl, type MusicTrack } from '@/app/actions/music';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { Music as InternalMusic, Book } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';

interface MusicSidebarProps {
  bookId?: string;
}

export function MusicSidebar({ bookId }: MusicSidebarProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'search' | 'playlist' | 'library'>('search');
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);

  const bookRef = useMemo(() => (firestore && bookId) ? doc(firestore, 'books', bookId) : null, [firestore, bookId]);
  const { data: book } = useDoc<Book>(bookRef);

  const musicQuery = useMemo(() => (
    firestore ? query(collection(firestore, 'music'), orderBy('createdAt', 'desc')) : null
  ), [firestore]);
  const { data: internalMusic, isLoading: isLibraryLoading } = useCollection<InternalMusic>(musicQuery);

  // Preview State
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!previewAudioRef.current && typeof window !== 'undefined') {
      previewAudioRef.current = new Audio();
      previewAudioRef.current.onended = () => setPreviewPlayingId(null);
    }
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const handleTogglePreview = async (track: MusicTrack) => {
    if (!previewAudioRef.current || !track.id) return;
    
    if (previewPlayingId === track.id) {
      previewAudioRef.current.pause();
      setPreviewPlayingId(null);
      return;
    }

    setIsPreviewLoading(track.id);
    try {
      const streamUrl = await getPreviewAudioUrl(track.id);
      if (streamUrl) {
        previewAudioRef.current.src = streamUrl;
        await previewAudioRef.current.play();
        setPreviewPlayingId(track.id);
      } else {
        toast({ variant: 'destructive', title: "Pratinjau Gagal", description: "Tidak dapat menjangkau server musik kawan." });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsPreviewLoading(null);
    }
  };

  const handleAddToPlaylist = async (track: MusicTrack) => {
    if (!bookRef || !book) return;
    
    const trackId = track.id || track.name;
    setIsAdding(trackId);

    try {
      // Simpan metadata lagu ke Firestore. URL akan dijemput on-demand saat diputar.
      await updateDoc(bookRef, {
        playlist: arrayUnion({
            ...track,
            url: "", // Kita kosongkan karena akan di-generate real-time saat membaca
        })
      });
      
      toast({ 
          variant: 'success',
          title: "Lagu Ditambahkan", 
          description: `"${track.name}" telah masuk ke playlist naskah kawan.` 
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Gagal Menambahkan" });
    } finally {
      setIsAdding(null);
    }
  };

  const handleRemoveFromPlaylist = async (track: any) => {
    if (!bookRef) return;
    try {
      await updateDoc(bookRef, {
        playlist: arrayRemove(track)
      });
      toast({ title: "Dihapus dari Playlist" });
    } catch (e) {
      toast({ variant: 'destructive', title: "Gagal Menghapus" });
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchYouTube(searchQuery);
        setSearchResults(results);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  return (
    <div className="flex flex-col h-full bg-card/30 backdrop-blur-sm overflow-hidden">
      <Tabs defaultValue="search" className="flex flex-col h-full" value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="p-6 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20">
                <Disc className="h-5 w-5 animate-[spin_4s_linear_infinite]" />
              </div>
              <div>
                <h3 className="font-headline text-lg font-black tracking-tight uppercase">Harmoni Naskah</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Cari & Putar Soundtrack</p>
              </div>
            </div>
          </div>

          <TabsList className="w-full h-11 bg-muted/30 rounded-xl p-1 grid grid-cols-3">
            <TabsTrigger value="search" className="rounded-lg text-[10px] font-black uppercase tracking-widest">Cari</TabsTrigger>
            <TabsTrigger value="playlist" className="rounded-lg text-[10px] font-black uppercase tracking-widest">Playlist</TabsTrigger>
            <TabsTrigger value="library" className="rounded-lg text-[10px] font-black uppercase tracking-widest">Koleksi</TabsTrigger>
          </TabsList>

          {activeTab === 'search' && (
            <div className="mt-6 relative group">
                <Search className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-all duration-300",
                    isSearching ? "text-primary animate-pulse" : "text-muted-foreground group-focus-within:text-primary"
                )} />
                <Input
                    placeholder="Judul lagu atau artis..."
                    className="pl-10 h-11 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 transition-all font-bold text-sm shadow-inner"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="search" className="h-full m-0">
            <div className="h-full overflow-y-auto no-scrollbar p-4 pb-20">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-[9px] font-black uppercase tracking-widest">Menelusuri...</p>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map((track, i) => (
                    <motion.div
                      key={track.id || i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="group flex items-center gap-4 p-3 rounded-2xl bg-card/50 border border-transparent hover:border-primary/20 transition-all shadow-sm"
                    >
                      <div className="relative h-12 w-12 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-md">
                        <img src={track.image} className="h-full w-full object-cover" alt="" />
                        <button 
                            onClick={() => handleTogglePreview(track)}
                            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            {isPreviewLoading === track.id ? (
                                <Loader2 className="h-5 w-5 text-white animate-spin" />
                            ) : previewPlayingId === track.id ? (
                                <Pause className="h-5 w-5 text-white fill-current" />
                            ) : (
                                <Play className="h-5 w-5 text-white fill-current" />
                            )}
                        </button>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <p className="font-black text-xs truncate leading-tight italic">"{track.name}"</p>
                            {previewPlayingId === track.id && (
                                <span className="flex gap-0.5 items-end h-2 shrink-0">
                                    <motion.div animate={{ height: [2, 8, 4] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-0.5 bg-primary rounded-full" />
                                    <motion.div animate={{ height: [4, 2, 8] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-0.5 bg-primary rounded-full" />
                                    <motion.div animate={{ height: [8, 4, 2] }} transition={{ repeat: Infinity, duration: 0.4 }} className="w-0.5 bg-primary rounded-full" />
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 truncate">{track.artist}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                            className={cn(
                                "h-10 w-10 flex items-center justify-center rounded-xl hover:bg-primary hover:text-white shrink-0 transition-colors",
                                previewPlayingId === track.id && "text-primary bg-primary/10"
                            )} 
                            onClick={() => handleTogglePreview(track)}
                        >
                            {isPreviewLoading === track.id ? <Loader2 className="h-4 w-4 animate-spin" /> : previewPlayingId === track.id ? <Pause className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </button>
                        <button 
                            className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-primary hover:text-white shrink-0 transition-colors" 
                            disabled={isAdding === track.id}
                            onClick={() => handleAddToPlaylist(track)}
                        >
                            {isAdding === track.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-5 w-5" />}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center space-y-4 opacity-30">
                    <div className="p-6 bg-muted rounded-full w-fit mx-auto"><Music className="h-10 w-10" /></div>
                    <p className="text-[10px] font-black uppercase tracking-widest px-10">Ketik judul untuk mencari lagu puitis kawan.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="playlist" className="h-full m-0">
            <div className="h-full overflow-y-auto no-scrollbar p-4 pb-20">
              {book?.playlist && book.playlist.length > 0 ? (
                <div className="space-y-3">
                  {book.playlist.map((track, i) => (
                    <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-4 p-3 rounded-2xl bg-primary/5 border border-primary/10 group relative">
                      <div className="relative shrink-0">
                        <img src={track.image} className="h-10 w-10 rounded-xl object-cover shadow-sm" alt="" />
                        <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5 border border-white/10 shadow-lg">
                            <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <p className="font-black text-xs truncate italic">"{track.name}"</p>
                        </div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">{track.artist}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveFromPlaylist(track)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 opacity-30">
                  <Sparkles className="h-10 w-10 mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Playlist Belum Ada</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="library" className="h-full m-0">
            <div className="h-full overflow-y-auto no-scrollbar p-4 pb-20">
              {isLibraryLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : internalMusic && internalMusic.length > 0 ? (
                <div className="space-y-3">
                  {internalMusic.map((music) => (
                    <div key={music.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-card/50 border border-transparent hover:border-primary/20 transition-all shadow-sm">
                      <div className="h-10 w-10 rounded-xl bg-zinc-900 flex items-center justify-center border border-white/5 shadow-inner">
                        <Play className="h-4 w-4 text-white/40" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-xs truncate italic">"{music.title}"</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase truncate mt-0.5">{music.artist}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 rounded-xl hover:bg-primary hover:text-white" 
                        onClick={() => handleAddToPlaylist({
                            name: music.title,
                            artist: music.artist,
                            image: 'https://placehold.co/64x64?text=Music',
                            id: music.id,
                            source: 'youtube'
                        })}
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 opacity-30">
                  <ListMusic className="h-10 w-10 mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Perpustakaan Kosong</p>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
