'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Music, Loader2, Disc, Headset, X, Play, Pause, ListMusic, Sparkles, Youtube } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchMusic, searchYouTube, type MusicTrack } from '@/app/actions/music';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Music as InternalMusic } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function MusicSidebar() {
  const firestore = useFirestore();
  const [activeTab, setActiveTab] = useState<'library' | 'youtube' | 'lastfm'>('library');
  
  const [searchQuery, setSearchQuery] = useState("");
  const [lastfmResults, setLastfmResults] = useState<MusicTrack[]>([]);
  const [youtubeResults, setYoutubeResults] = useState<MusicTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const musicQuery = useMemo(() => (
    firestore ? query(collection(firestore, 'music'), orderBy('createdAt', 'desc')) : null
  ), [firestore]);
  const { data: internalMusic, isLoading: isLibraryLoading } = useCollection<InternalMusic>(musicQuery);

  const filteredLibrary = useMemo(() => {
    if (!internalMusic) return [];
    if (!searchQuery.trim()) return internalMusic;
    return internalMusic.filter(m => 
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        m.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [internalMusic, searchQuery]);

  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current && typeof window !== 'undefined') {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingId(null);
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlayInternal = (music: InternalMusic) => {
    if (!audioRef.current) return;
    if (playingId === music.id) {
      audioRef.current.pause();
      setPlayingId(null);
    } else {
      audioRef.current.src = music.url;
      audioRef.current.play().catch(() => {});
      setPlayingId(music.id);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setLastfmResults([]);
        setYoutubeResults([]);
        return;
      }

      setIsSearching(true);
      try {
        if (activeTab === 'lastfm') {
          const results = await searchMusic(searchQuery);
          setLastfmResults(results);
        } else if (activeTab === 'youtube') {
          const results = await searchYouTube(searchQuery);
          setYoutubeResults(results);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, activeTab]);

  return (
    <div className="flex flex-col h-full bg-card/30 backdrop-blur-sm overflow-hidden">
      <Tabs defaultValue="library" className="flex flex-col h-full" value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <div className="p-6 border-b border-border/40 shrink-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Headset className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-headline text-lg font-black tracking-tight">Soundtrack</h3>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Audio Studio</p>
              </div>
            </div>
          </div>

          <TabsList className="w-full h-11 bg-muted/30 rounded-xl p-1 grid grid-cols-3">
            <TabsTrigger value="library" className="rounded-lg text-[9px] font-black uppercase tracking-tighter gap-1">
              <ListMusic className="h-3 w-3" /> Library
            </TabsTrigger>
            <TabsTrigger value="youtube" className="rounded-lg text-[9px] font-black uppercase tracking-tighter gap-1">
              <Youtube className="h-3 w-3" /> YouTube
            </TabsTrigger>
            <TabsTrigger value="lastfm" className="rounded-lg text-[9px] font-black uppercase tracking-tighter gap-1">
              <Disc className="h-3 w-3" /> Last.fm
            </TabsTrigger>
          </TabsList>

          <div className="relative group mt-6">
            <Search className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors",
              isSearching ? "text-primary animate-pulse" : "text-muted-foreground"
            )} />
            <Input
              placeholder={activeTab === 'library' ? "Cari di koleksi..." : activeTab === 'youtube' ? "Cari di YouTube..." : "Cari di Last.fm..."}
              className="pl-10 h-11 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 transition-all font-medium text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="library" className="h-full m-0">
            <div className="h-full overflow-y-auto no-scrollbar p-4 pb-20">
              {isLibraryLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-[9px] font-black uppercase tracking-widest">Sinkronisasi Studio...</p>
                </div>
              ) : filteredLibrary.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[8px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 px-2 py-2">Musik Siap Putar</p>
                  {filteredLibrary.map((music, i) => (
                    <motion.div
                      key={music.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        "group flex items-center gap-4 p-3 rounded-2xl border transition-all cursor-pointer relative overflow-hidden",
                        playingId === music.id ? "bg-primary/10 border-primary/20 shadow-md" : "bg-card/50 border-transparent hover:bg-primary/5"
                      )}
                      onClick={() => togglePlayInternal(music)}
                    >
                      <div className="relative shrink-0">
                        <div className={cn("h-12 w-12 rounded-xl bg-zinc-900 flex items-center justify-center border border-white/10 shadow-lg")}>
                          {playingId === music.id ? <Pause className="h-5 w-5 text-primary fill-current" /> : <Play className="h-5 w-5 text-white fill-current opacity-40 group-hover:opacity-100" />}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className={cn("font-black text-sm truncate leading-tight transition-colors italic", playingId === music.id ? "text-primary" : "")}>"{music.title}"</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 truncate">{music.artist}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 opacity-30">
                  <Music className="h-10 w-10 mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Tidak ada musik ditemukan</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="youtube" className="h-full m-0">
            <div className="h-full overflow-y-auto no-scrollbar p-4 pb-20">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-[9px] font-black uppercase tracking-widest">Menelusuri YouTube...</p>
                </div>
              ) : youtubeResults.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[8px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 px-2 py-2">Konten YouTube (Ready)</p>
                  {youtubeResults.map((track, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="group flex items-center gap-4 p-3 rounded-2xl bg-card/50 border border-transparent hover:border-primary/20 transition-all cursor-default">
                      <img src={track.image} className="h-12 w-12 rounded-xl object-cover shadow-md" alt="" />
                      <div className="min-w-0">
                        <p className="font-black text-sm truncate leading-tight italic">"{track.name}"</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1 truncate">{track.artist}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center opacity-30">
                  <Youtube className="h-10 w-10 mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Cari di YouTube</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="lastfm" className="h-full m-0">
            <div className="h-full overflow-y-auto no-scrollbar p-4 pb-20">
              {isSearching ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 opacity-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-[9px] font-black uppercase tracking-widest">Menelusuri Last.fm...</p>
                </div>
              ) : lastfmResults.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[8px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 px-2 py-2">Referensi (Last.fm)</p>
                  {lastfmResults.map((track, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 p-3 rounded-2xl opacity-60">
                      <img src={track.image} className="h-12 w-12 rounded-xl object-cover grayscale" alt="" />
                      <div className="min-w-0">
                        <p className="font-black text-sm truncate italic">"{track.name}"</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{track.artist}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center opacity-30">
                  <Disc className="h-10 w-10 mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest">Cari di Last.fm</p>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
