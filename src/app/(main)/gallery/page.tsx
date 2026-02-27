'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useFirestore, useUser, useCollection, useDoc } from '@/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  doc, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  increment, 
  deleteDoc, 
  writeBatch, 
  setDoc, 
  getDocs, 
  limit 
} from 'firebase/firestore';
import type { ArtWork, User as AppUser, ArtLike, ArtComment, Chat, ArtShareMessage } from '@/lib/types';
import { 
  Sparkles, 
  Plus, 
  Image as ImageIcon, 
  Film, 
  Quote, 
  Heart, 
  Loader2, 
  X, 
  Send as SendIcon, 
  Search, 
  LayoutGrid, 
  Trash2,
  MessageCircle,
  MoreVertical,
  Bookmark,
  Camera,
  ChevronRight,
  Zap,
  Layers,
  ArrowLeft,
  MessageSquare,
  Maximize2,
  Minimize2,
  Type,
  Video,
  Check,
  Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { uploadFile, uploadVideo } from '@/lib/uploader';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { ArtCommentItem } from '@/components/comments/ArtCommentItem';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * Panggung Galeri Seni v17.1 - Final Synchronization Edition.
 * Memastikan stabilitas visual dan fungsional dengan rasio media asli
 * dan fitur autoplay audio-visual kawan.
 */
export default function GalleryPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeType, setActiveType] = useState<'all' | 'image' | 'video' | 'quote'>('all');
  const [selectedArtConfig, setSelectedArtConfig] = useState<{ id: string; focus: 'full' | 'comments' } | null>(null);

  const { data: currentUserProfile } = useDoc<AppUser>(
    (firestore && currentUser) ? doc(firestore, 'users', currentUser.uid) : null
  );

  const artworksQuery = useMemo(() => (
    firestore ? query(collection(firestore, 'artworks'), orderBy('createdAt', 'desc')) : null
  ), [firestore]);

  const { data: rawArtworks, isLoading } = useCollection<ArtWork>(artworksQuery);

  const filteredArtworks = useMemo(() => {
    if (!rawArtworks) return [];
    let results = rawArtworks;
    
    if (activeType !== 'all') {
      results = results.filter(art => art.type === activeType);
    }
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      results = results.filter(art => 
        art.title.toLowerCase().includes(term) || 
        art.authorName.toLowerCase().includes(term) ||
        art.content?.toLowerCase().includes(term)
      );
    }
    
    return results;
  }, [rawArtworks, activeType, searchTerm]);

  return (
    <div className="max-w-xl mx-auto pb-32 space-y-10 px-1 overflow-x-hidden pt-6">
      <div className="flex items-center justify-between px-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest mb-2">
            <Zap className="h-3 w-3 fill-current" /> Elitera Seni
          </div>
          <h1 className="text-3xl font-headline font-black tracking-tight italic">Panggung <span className="text-primary">Seni.</span></h1>
        </motion.div>
        
        <button 
            onClick={() => setIsUploadOpen(true)}
            className="rounded-[1.25rem] bg-primary text-white hover:bg-primary/90 h-12 w-12 shadow-xl shadow-primary/20 transition-all active:scale-90 flex items-center justify-center"
        >
            <Plus className="h-6 w-6" />
        </button>
      </div>

      <div className="px-4 space-y-6">
        <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
            <Input 
                placeholder="Cari mahakarya atau pujangga..." 
                className="relative h-12 pl-11 rounded-2xl bg-card border-none ring-1 ring-border focus-visible:ring-2 focus-visible:ring-primary/20 shadow-inner font-medium text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {[
                { id: 'all', label: 'Semua', icon: LayoutGrid },
                { id: 'image', label: 'Citra', icon: ImageIcon },
                { id: 'video', label: 'Video', icon: Film },
                { id: 'quote', label: 'Bait', icon: Quote },
            ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveType(tab.id as any)}
                    className={cn(
                        "flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border shadow-sm",
                        activeType === tab.id 
                            ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105" 
                            : "bg-background text-muted-foreground border-border/50 hover:bg-muted/50"
                    )}
                >
                    <tab.icon className="h-3.5 w-3.5" /> {tab.label}
                </button>
            ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6 opacity-40">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                    <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                </div>
                <p className="font-black uppercase text-[10px] tracking-[0.4em] animate-pulse">Mengharmonisasi Panggung...</p>
            </div>
        ) : filteredArtworks.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-32 text-center space-y-8 opacity-30">
                <div className="p-10 bg-muted rounded-[3rem] w-fit mx-auto shadow-inner">
                    <ImageIcon className="h-20 w-20" />
                </div>
                <div className="space-y-2">
                    <p className="font-headline text-2xl font-black italic">Galeri Masih Hening kawan.</p>
                    <p className="text-xs font-bold uppercase tracking-widest px-10">Jadilah yang pertama memajang mahakarya di sini.</p>
                </div>
            </motion.div>
        ) : (
            <div className="flex flex-col gap-10">
                {filteredArtworks.map((art, idx) => (
                    <ArtCard 
                        key={art.id} 
                        art={art} 
                        onOpenDetails={(focus) => setSelectedArtConfig({ id: art.id, focus })} 
                        delay={idx * 0.05}
                    />
                ))}
            </div>
        )}
      </AnimatePresence>

      <CreateArtModal 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)} 
        currentUserProfile={currentUserProfile || null}
      />

      {selectedArtConfig && (
        <ArtDetailsModal 
            artId={selectedArtConfig.id} 
            initialFocus={selectedArtConfig.focus}
            isOpen={!!selectedArtConfig} 
            onClose={() => setSelectedArtConfig(null)}
            currentUser={currentUser}
            currentUserProfile={currentUserProfile}
        />
      )}
    </div>
  );
}

function ArtCard({ art, onOpenDetails, delay }: { art: ArtWork; onOpenDetails: (focus: 'full' | 'comments') => void; delay: number }) {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { toast } = useToast();
    const [isLiking, setIsLiking] = useState(false);
    const [isBookmarking, setIsBookmarking] = useState(false);
    const [showHeartAnim, setShowHeartAnim] = useState(false);
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const lastClickTime = useRef(0);
    const videoRef = useRef<HTMLVideoElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    
    const likeRef = useMemo(() => (
        (firestore && currentUser) ? doc(firestore, 'artworks', art.id, 'likes', currentUser.uid) : null
    ), [firestore, currentUser, art.id]);
    const { data: likeDoc } = useDoc<ArtLike>(likeRef);
    const isLiked = !!likeDoc;

    const bookmarkRef = useMemo(() => (
        (firestore && currentUser) ? doc(firestore, 'users', currentUser.uid, 'favoriteArtworks', art.id) : null
    ), [firestore, currentUser, art.id]);
    const { data: bookmarkDoc } = useDoc<any>(bookmarkRef);
    const isBookmarked = !!bookmarkDoc;

    useEffect(() => {
        if (art.type !== 'video') return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (videoRef.current) {
                    if (entry.isIntersecting) {
                        videoRef.current.play().catch(error => {
                            console.warn("Autoplay unmuted blocked:", error);
                            if (videoRef.current) {
                                videoRef.current.muted = true;
                                videoRef.current.play().catch(e => console.error("Still blocked:", e));
                            }
                        });
                    } else {
                        videoRef.current.pause();
                    }
                }
            },
            { threshold: 0.6 }
        );

        if (cardRef.current) observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, [art.type]);

    const handleToggleLike = useCallback(async (e?: React.MouseEvent, forcedState?: boolean) => {
        if (e) e.stopPropagation();
        if (!firestore || !currentUser || !likeRef || isLiking) return;
        
        if (forcedState === true && isLiked) {
            setShowHeartAnim(true);
            setTimeout(() => setShowHeartAnim(false), 1000);
            return;
        }

        setIsLiking(true);
        if (forcedState === true) {
            setShowHeartAnim(true);
            setTimeout(() => setShowHeartAnim(false), 1000);
        }

        const artRef = doc(firestore, 'artworks', art.id);
        const batch = writeBatch(firestore);
        
        try {
            const willBeLiked = forcedState !== undefined ? forcedState : !isLiked;
            if (isLiked && !willBeLiked) {
                batch.delete(likeRef);
                batch.update(artRef, { likes: increment(-1) });
            } else if (!isLiked && willBeLiked) {
                batch.set(likeRef, { userId: currentUser.uid, likedAt: serverTimestamp() });
                batch.update(artRef, { likes: increment(1) });
            }
            await batch.commit();
        } catch (e) {
            console.error("Like error:", e);
        } finally {
            setIsLiking(false);
        }
    }, [firestore, currentUser, likeRef, isLiked, isLiking, art.id]);

    const handleMediaClick = (e: React.MouseEvent) => {
        const now = Date.now();
        if (now - lastClickTime.current < 300) {
            handleToggleLike(undefined, true);
        } else {
            if (videoRef.current) {
                if (videoRef.current.paused) videoRef.current.play();
                else videoRef.current.pause();
            }
        }
        lastClickTime.current = now;
    };

    const handleToggleBookmark = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!firestore || !currentUser || !bookmarkRef || isBookmarking) return;
        
        setIsBookmarking(true);
        try {
            if (isBookmarked) {
                await deleteDoc(bookmarkRef);
                toast({ title: "Dihapus dari Koleksi" });
            } else {
                await setDoc(bookmarkRef, { 
                    artId: art.id, 
                    bookmarkedAt: serverTimestamp() 
                });
                toast({ variant: 'success', title: "Tersimpan di Koleksi" });
            }
        } catch (e) {
            toast({ variant: 'destructive', title: "Gagal Menyimpan" });
        } finally {
            setIsBookmarking(false);
        }
    };

    const handleDelete = async () => {
        if (!firestore || !confirm("Lenyapkan mahakarya ini kawan?")) return;
        try {
            await deleteDoc(doc(firestore, 'artworks', art.id));
            toast({ variant: 'success', title: "Karya Dilenyapkan" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Gagal Menghapus" });
        }
    };

    return (
        <motion.div 
            ref={cardRef}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.6 }}
            className="w-full"
        >
            <Card className="border-none shadow-2xl bg-card rounded-[2.5rem] overflow-hidden group/card relative ring-1 ring-border/50">
                <div className="flex items-center justify-between p-5 md:p-6">
                    <Link href={`/profile/${art.authorUsername}`} className="flex items-center gap-4 group" onClick={(e) => e.stopPropagation()}>
                        <div className="relative">
                            <Avatar className="h-11 w-11 border-2 border-background ring-2 ring-primary/10 shadow-lg transition-transform group-hover:scale-110">
                                <AvatarImage src={art.authorAvatarUrl} className="object-cover" />
                                <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">{art.authorName[0]}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-0.5 -right-0.5 bg-green-500 h-3 w-3 rounded-full border-2 border-background shadow-sm" />
                        </div>
                        <div className="flex flex-col">
                            <p className="font-black text-[14px] leading-none group-hover:text-primary transition-colors tracking-tight uppercase">{art.authorName}</p>
                            <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-1.5 opacity-60">Pujangga Terverifikasi</p>
                        </div>
                    </Link>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl hover:bg-primary/5">
                                <MoreVertical className="h-5 w-5 text-muted-foreground/40" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-2xl border-none shadow-2xl p-2 w-56">
                            <DropdownMenuItem className="rounded-xl h-11 text-xs font-bold gap-3" onClick={(e) => { e.stopPropagation(); setIsShareDialogOpen(true); }}>
                                <SendIcon className="h-4 w-4 text-primary" /> Bagikan Mahakarya
                            </DropdownMenuItem>
                            {currentUser?.uid === art.authorId && (
                                <DropdownMenuItem className="rounded-xl h-11 text-xs font-bold gap-3 text-rose-500" onClick={handleDelete}>
                                    <Trash2 className="h-4 w-4" /> Lenyapkan Karya
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div 
                    className="relative bg-muted/5 overflow-hidden cursor-pointer group/media flex items-center justify-center min-h-[200px]"
                    onClick={handleMediaClick}
                >
                    <AnimatePresence>
                        {showHeartAnim && (
                            <motion.div 
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: [0, 1.2, 1], opacity: [0, 1, 0] }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
                            >
                                <Heart className="w-32 h-32 text-white fill-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {art.type === 'quote' ? (
                        <div className="w-full aspect-square md:aspect-[4/5] p-12 flex flex-col items-center justify-center text-center bg-gradient-to-br from-primary/[0.03] via-accent/[0.03] to-transparent relative">
                            <Quote className="absolute top-10 left-10 h-16 w-16 text-primary/5 -rotate-12" />
                            <p className="font-headline text-2xl md:text-3xl font-black italic leading-tight drop-shadow-sm text-foreground/90 px-6">"{art.content}"</p>
                            <Quote className="absolute bottom-10 right-10 h-16 w-16 text-primary/5 rotate-180" />
                        </div>
                    ) : art.type === 'video' ? (
                        <video 
                            ref={videoRef}
                            src={art.mediaUrl} 
                            className="w-full h-auto max-h-[80vh] object-contain bg-zinc-950" 
                            loop 
                            playsInline 
                        />
                    ) : (
                        <img 
                            src={art.mediaUrl} 
                            className="w-full h-auto max-h-[80vh] object-contain bg-zinc-950 transition-transform duration-[2s] group-hover/media:scale-105" 
                            alt={art.title} 
                        />
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    
                    <div className="absolute top-4 right-4 z-10 flex gap-2">
                        {art.type === 'video' && (
                            <div className="bg-black/40 backdrop-blur-md p-2.5 rounded-2xl border border-white/10 shadow-xl">
                                <Film className="h-4 w-4 text-white" />
                            </div>
                        )}
                        <button 
                            className="bg-black/40 backdrop-blur-md p-2.5 rounded-2xl border border-white/10 shadow-xl text-white active:scale-90 transition-all pointer-events-auto"
                            onClick={(e) => { e.stopPropagation(); onOpenDetails('full'); }}
                        >
                            <Layers className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="p-6 md:p-8 space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <button 
                                onClick={handleToggleLike}
                                disabled={isLiking}
                                className={cn(
                                    "transition-all active:scale-75 outline-none flex items-center gap-2 group",
                                    isLiked ? "text-rose-500" : "text-foreground hover:text-rose-500"
                                )}
                            >
                                <Heart className={cn("h-7 w-7 transition-transform group-hover:scale-110", isLiked && "fill-current")} />
                                <span className="text-sm font-black tracking-tight">{new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(art.likes || 0)}</span>
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onOpenDetails('comments'); }} 
                                className="text-foreground hover:text-primary transition-all active:scale-75 outline-none flex items-center gap-2 group"
                            >
                                <MessageCircle className="h-7 w-7 transition-transform group-hover:scale-110" />
                                <span className="text-sm font-black tracking-tight">{new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(art.commentCount || 0)}</span>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setIsShareDialogOpen(true); }} className="text-foreground hover:text-primary transition-all active:scale-75 outline-none group">
                                <SendIcon className="h-6.5 w-6.5 -rotate-12 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                            </button>
                        </div>
                        <button 
                            onClick={handleToggleBookmark}
                            disabled={isBookmarking}
                            className={cn(
                                "transition-all active:scale-75 outline-none p-2.5 rounded-2xl",
                                isBookmarked ? "bg-primary/10 text-primary shadow-inner" : "text-foreground opacity-40 hover:opacity-100"
                            )}
                        >
                            <Bookmark className={cn("h-6 w-6", isBookmarked && "fill-current")} />
                        </button>
                    </div>

                    <div className="space-y-3 px-1">
                        <div className="flex flex-wrap items-baseline gap-2.5">
                            <span className="font-black text-sm tracking-tight text-primary uppercase">{art.authorName}</span>
                            <span className="text-sm font-bold text-foreground/80 leading-relaxed italic">"{art.title}"</span>
                        </div>
                        {art.type !== 'quote' && art.content && (
                            <p className="text-[13px] text-muted-foreground line-clamp-2 leading-relaxed font-medium italic opacity-80">
                                {art.content}
                            </p>
                        )}
                        
                        {art.commentCount > 0 && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onOpenDetails('comments'); }} 
                                className="text-[11px] font-black text-primary/60 hover:text-primary block pt-2 transition-colors uppercase tracking-widest"
                            >
                                Lihat semua {art.commentCount} ulasan kawan...
                            </button>
                        )}

                        <div className="flex items-center gap-3 pt-4 border-t border-border/30">
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                                {art.createdAt ? formatDistanceToNow(art.createdAt.toDate(), { locale: id, addSuffix: true }) : 'Baru saja'}
                            </span>
                            <div className="h-1 w-1 rounded-full bg-border" />
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Elitera Gallery</span>
                        </div>
                    </div>
                </div>
            </Card>

            <ShareArtDialog 
                art={art} 
                open={isShareDialogOpen} 
                onOpenChange={setIsShareDialogOpen} 
            />
        </motion.div>
    );
}

function CreateArtModal({ isOpen, onClose, currentUserProfile }: { isOpen: boolean; onClose: () => void; currentUserProfile: AppUser | null }) {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { toast } = useToast();
    
    const [type, setType] = useState<'image' | 'video' | 'quote'>('image');
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > (type === 'video' ? 25 : 5) * 1024 * 1024) {
                toast({ variant: 'destructive', title: 'File Terlalu Besar' });
                return;
            }
            setMediaFile(file);
            setMediaPreview(URL.createObjectURL(file));
        }
    };

    const handlePublish = async () => {
        if (!firestore || !currentUser || !currentUserProfile || !title.trim()) return;
        if (type !== 'quote' && !mediaFile) return;
        if (type === 'quote' && !content.trim()) return;

        setIsSubmitting(true);
        try {
            let mediaUrl = "";
            if (mediaFile) {
                mediaUrl = type === 'video' ? await uploadVideo(mediaFile) : await uploadFile(mediaFile);
            }

            await addDoc(collection(firestore, 'artworks'), {
                type,
                title: title.trim(),
                content: content.trim(),
                mediaUrl,
                authorId: currentUser.uid,
                authorName: currentUserProfile.displayName,
                authorUsername: currentUserProfile.username,
                authorAvatarUrl: currentUserProfile.photoURL,
                likes: 0,
                commentCount: 0,
                createdAt: serverTimestamp(),
            });

            toast({ variant: 'success', title: "Karya Terpajang" });
            onClose();
            reset();
        } catch (e) {
            toast({ variant: 'destructive', title: "Gagal Menayangkan" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const reset = () => {
        setType('image');
        setTitle("");
        setContent("");
        setMediaFile(null);
        setMediaPreview(null);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
            <DialogContent className="max-w-xl w-screen h-[100dvh] md:h-auto md:max-w-xl md:w-[95vw] md:rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl bg-background flex flex-col rounded-none">
                <div className="p-6 md:p-8 bg-gradient-to-br from-primary/10 via-indigo-500/5 to-transparent border-b shrink-0 relative overflow-hidden pt-[max(1.5rem,env(safe-area-inset-top))]">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl animate-pulse" />
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 md:p-4 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl text-primary ring-1 ring-primary/20 shrink-0">
                                <Sparkles className="h-6 w-6 md:h-7 md:w-7" />
                            </div>
                            <div>
                                <DialogTitle className="font-headline text-xl md:text-2xl font-black uppercase tracking-tight">Studio Galeri</DialogTitle>
                                <DialogDescription className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-primary/60 mt-0.5">Kurasi Mahakarya Elitera</DialogDescription>
                            </div>
                        </div>
                        <button onClick={onClose} className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground md:hidden">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 no-scrollbar pb-32">
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 ml-1">Pilih Medium Seni</label>
                        <div className="flex gap-2 bg-muted/50 p-1.5 rounded-[1.5rem]">
                            {[
                                { id: 'image', label: 'Citra', icon: ImageIcon },
                                { id: 'video', label: 'Video', icon: Film },
                                { id: 'quote', label: 'Bait', icon: Quote },
                            ].map(t => (
                                <button 
                                    key={t.id} 
                                    onClick={() => { setType(t.id as any); setMediaFile(null); setMediaPreview(null); }}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                        type === t.id ? "bg-background text-primary shadow-md scale-105" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <t.icon className="h-4 w-4" /> {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 ml-1">Nama Pameran</label>
                            <Input 
                                placeholder="Judul puitis..." 
                                value={title} 
                                onChange={(e) => setTitle(e.target.value)} 
                                className="h-14 rounded-2xl bg-muted/30 border-none font-black text-lg md:text-xl px-6 shadow-inner focus-visible:ring-primary/20" 
                            />
                        </div>

                        {type === 'quote' ? (
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 ml-1">Untaian Kata</label>
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-tr from-primary/20 via-accent/10 to-primary/20 rounded-[2rem] blur opacity-40" />
                                    <textarea 
                                        placeholder="Tuangkan bait-bait indah kawan..." 
                                        rows={6}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        className="relative w-full rounded-[2rem] bg-white dark:bg-zinc-900 border-none p-8 md:p-10 font-headline text-xl md:text-2xl font-black italic text-center focus:ring-4 focus:ring-primary/10 transition-all resize-none shadow-2xl no-scrollbar leading-tight min-h-[200px]"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 ml-1">Media Visual {type === 'video' ? '(Maks 25MB)' : '(Maks 5MB)'}</label>
                                <div 
                                    className="relative min-h-[200px] rounded-[2.5rem] bg-muted/30 border-2 border-dashed border-primary/20 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/[0.03] transition-all overflow-hidden group shadow-inner"
                                    onClick={() => document.getElementById('gallery-file-input')?.click()}
                                >
                                    {mediaPreview ? (
                                        type === 'video' ? (
                                            <video src={mediaPreview} className="w-full h-auto max-h-[40vh] object-contain" />
                                        ) : (
                                            <img src={mediaPreview} className="w-full h-auto max-h-[40vh] object-contain" alt="Preview" />
                                        )
                                    ) : (
                                        <>
                                            <div className="p-5 rounded-[1.5rem] bg-background shadow-xl mb-4 group-hover:scale-110 transition-transform group-hover:rotate-6 shadow-primary/5 border border-border/50"><Plus className="h-8 w-8 md:h-10 md:w-10 text-primary" /></div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-60">Pilih berkas {type}</p>
                                        </>
                                    )}
                                    <input id="gallery-file-input" type="file" className="hidden" accept={type === 'video' ? 'video/*' : 'image/*'} onChange={handleFileChange} />
                                </div>
                                <div className="pt-2 px-1">
                                    <Input 
                                        placeholder="Keterangan singkat..." 
                                        value={content} 
                                        onChange={(e) => setContent(e.target.value)} 
                                        className="h-12 rounded-xl bg-muted/20 border-none font-bold text-[11px] px-5 italic shadow-sm" 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 md:p-8 bg-muted/20 border-t flex flex-col sm:flex-row gap-3 shrink-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
                    <Button variant="ghost" className="rounded-full font-bold h-14 px-10 hover:bg-background/50 transition-all hidden md:flex" onClick={onClose}>Batal</Button>
                    <Button 
                        className="rounded-full font-black h-14 md:h-16 px-12 shadow-2xl shadow-primary/20 flex-1 uppercase text-[11px] md:text-xs tracking-[0.2em] active:scale-[0.98] transition-all"
                        disabled={isSubmitting || !title.trim() || (type === 'quote' ? !content.trim() : !mediaFile)}
                        onClick={handlePublish}
                    >
                        {isSubmitting ? <><Loader2 className="mr-3 h-6 w-6 animate-spin" /> Menayangkan...</> : <><SendIcon className="mr-3 h-5 w-5" /> Publikasikan</>}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ArtDetailsModal({ artId, initialFocus, isOpen, onClose, currentUser, currentUserProfile }: { artId: string; initialFocus: 'full' | 'comments'; isOpen: boolean; onClose: () => void; currentUser: any; currentUserProfile: AppUser | null }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLiking, setIsLiking] = useState(false);
    const [isSendingComment, setIsSendingComment] = useState(false);
    const [commentText, setCommentText] = useState("");
    const [showMedia, setShowMedia] = useState(initialFocus === 'full');
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

    const artRef = useMemo(() => (firestore ? doc(firestore, 'artworks', artId) : null), [firestore, artId]);
    const { data: art, isLoading: isArtLoading } = useDoc<ArtWork>(artRef);

    const topLevelCommentsPath = `artworks/${artId}/comments`;

    const likeRef = useMemo(() => (
        (firestore && currentUser) ? doc(firestore, 'artworks', artId, 'likes', currentUser.uid) : null
    ), [firestore, currentUser, artId]);
    const { data: likeDoc } = useDoc<ArtLike>(likeRef);
    const isLiked = !!likeDoc;

    const commentsQuery = useMemo(() => (
        firestore ? query(collection(firestore, topLevelCommentsPath), orderBy('createdAt', 'asc')) : null
    ), [firestore, artId, topLevelCommentsPath]);
    const { data: comments, isLoading: areCommentsLoading } = useCollection<ArtComment>(commentsQuery);

    const handleToggleLike = async () => {
        if (!firestore || !currentUser || !likeRef || isLiking || !art) return;
        setIsLiking(true);
        const batch = writeBatch(firestore);
        try {
            if (isLiked) {
                batch.delete(likeRef);
                batch.update(artRef!, { likes: increment(-1) });
            } else {
                batch.set(likeRef, { userId: currentUser.uid, likedAt: serverTimestamp() });
                batch.update(artRef!, { likes: increment(1) });
            }
            await batch.commit();
        } catch (e) {
            console.error("Like error:", e);
        } finally {
            setIsLiking(false);
        }
    };

    const handleSendComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim() || !currentUser || !firestore || !currentUserProfile || isSendingComment) return;

        setIsSendingComment(true);
        const batch = writeBatch(firestore);
        const commentsCol = collection(firestore, topLevelCommentsPath);
        
        try {
            batch.set(doc(commentsCol), {
                text: commentText.trim(),
                userId: currentUser.uid,
                userName: currentUserProfile.displayName,
                username: currentUserProfile.username,
                userAvatarUrl: currentUserProfile.photoURL,
                likeCount: 0,
                replyCount: 0,
                createdAt: serverTimestamp(),
            });
            batch.update(artRef!, { commentCount: increment(1) });
            await batch.commit();
            setCommentText("");
        } catch (e) {
            toast({ variant: 'destructive', title: "Gagal Mengirim" });
        } finally {
            setIsSendingComment(false);
        }
    };

    if (isArtLoading || !art) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl w-[95vw] md:h-[85vh] rounded-[2.5rem] md:rounded-[3rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col md:flex-row bg-background">
                <DialogHeader className="sr-only">
                    <DialogTitle>Detail Karya: {art.title}</DialogTitle>
                    <DialogDescription>Diskusi mahakarya pujangga kawan.</DialogDescription>
                </DialogHeader>

                <AnimatePresence>
                    {showMedia && (
                        <motion.div 
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 'auto', opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className="md:flex-1 bg-black relative flex items-center justify-center group/viewer overflow-hidden border-r border-border/10 shrink-0"
                        >
                            <button 
                                onClick={onClose}
                                className="absolute top-6 left-6 z-20 h-12 w-12 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-white md:hidden"
                            >
                                <ArrowLeft className="h-6 w-6" />
                            </button>

                            {art.type === 'quote' ? (
                                <div className="w-full h-full p-12 flex flex-col items-center justify-center text-center bg-gradient-to-br from-indigo-900 via-zinc-950 to-black relative">
                                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                                    <Quote className="h-20 w-20 text-white/10 mb-8 animate-pulse" />
                                    <p className="font-headline text-3xl md:text-5xl font-black text-white leading-tight italic drop-shadow-2xl px-10 relative z-10">"{art.content}"</p>
                                </div>
                            ) : (
                                <>
                                    {art.type === 'video' ? (
                                        <video 
                                            src={art.mediaUrl} 
                                            className="w-full h-full object-contain" 
                                            autoPlay 
                                            loop 
                                            controls 
                                        />
                                    ) : (
                                        <img 
                                            src={art.mediaUrl} 
                                            className="w-full h-full object-contain" 
                                            alt={art.title} 
                                        />
                                    )}
                                </>
                            )}

                            <button 
                                onClick={() => setShowMedia(false)}
                                className="absolute top-6 right-6 z-20 bg-black/40 backdrop-blur-xl text-white p-3 rounded-2xl border border-white/10 opacity-0 group-hover/viewer:opacity-100 transition-opacity hidden md:flex items-center gap-2 hover:bg-black/60 shadow-2xl"
                            >
                                <Minimize2 className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Fokus Ulasan</span>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className={cn(
                    "flex flex-col bg-card overflow-hidden transition-all duration-500",
                    showMedia ? "w-full md:w-[420px]" : "w-full"
                )}>
                    <div className="p-5 md:p-6 border-b border-border/50 flex items-center justify-between shrink-0 bg-muted/5 pt-[max(1rem,env(safe-area-inset-top))] md:pt-6">
                        <div className="flex items-center gap-4">
                            {!showMedia && (
                                <button 
                                    onClick={() => setShowMedia(true)}
                                    className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-all active:scale-90 shadow-inner"
                                >
                                    <Maximize2 className="h-5 w-5" />
                                </button>
                            )}
                            <Link href={`/profile/${art.authorUsername}`} onClick={onClose} className="group flex items-center gap-4">
                                <div className="relative">
                                    <Avatar className="h-11 w-11 border-2 border-primary/20 shadow-xl group-hover:scale-105 transition-transform">
                                        <AvatarImage src={art.authorAvatarUrl} className="object-cover" />
                                        <AvatarFallback className="bg-primary/10 text-primary font-black">{art.authorName[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 border-2 border-background rounded-full" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-black text-[14px] group-hover:text-primary transition-colors tracking-tight uppercase leading-none">{art.authorName}</p>
                                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1.5 opacity-60">Pujangga Elitera</p>
                                </div>
                            </Link>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl"><MoreVertical className="h-5 w-5 text-muted-foreground/40"/></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl p-2 border-none shadow-2xl">
                                <DropdownMenuItem className="rounded-xl h-11 font-bold text-xs gap-3" onClick={() => setIsShareDialogOpen(true)}><SendIcon className="h-4 w-4" /> Bagikan</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 no-scrollbar bg-gradient-to-b from-muted/5 to-transparent">
                        <div className="flex items-start gap-4">
                            <Avatar className="h-9 w-9 border shrink-0 shadow-sm">
                                <AvatarImage src={art.authorAvatarUrl} className="object-cover" />
                                <AvatarFallback>{art.authorName[0]}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-2 pt-1">
                                <div className="flex flex-wrap items-baseline gap-2">
                                    <span className="font-black text-sm tracking-tight text-primary uppercase">{art.authorName}</span>
                                    <span className="text-sm font-bold text-foreground italic">"{art.title}"</span>
                                </div>
                                {art.type !== 'quote' && art.content && (
                                    <p className="text-sm text-foreground/70 leading-relaxed font-medium italic opacity-90 border-l-2 border-primary/10 pl-4 py-1">
                                        {art.content}
                                    </p>
                                )}
                                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mt-3">
                                    {formatDistanceToNow(art.createdAt.toDate(), { locale: id, addSuffix: true })}
                                </p>
                            </div>
                        </div>

                        <Separator className="opacity-50" />

                        <div className="space-y-8 pb-10">
                            {areCommentsLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-20">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                    <p className="text-[9px] font-black uppercase tracking-widest">Memuat Suara...</p>
                                </div>
                            ) : comments?.length === 0 ? (
                                <div className="text-center py-16 opacity-20 flex flex-col items-center gap-4">
                                    <div className="p-6 bg-muted rounded-[2rem]"><MessageSquare className="h-10 w-10" /></div>
                                    <p className="italic text-[11px] font-black uppercase tracking-[0.3em]">Hening Tanpa Ulasan</p>
                                </div>
                            ) : (
                                comments?.map(c => (
                                    <ArtCommentItem 
                                        key={c.id} 
                                        artId={artId} 
                                        comment={c} 
                                        parentPath={topLevelCommentsPath}
                                        depth={0}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    <div className="shrink-0 border-t border-border/50 bg-background/95 backdrop-blur-xl shadow-[0_-15px_40px_rgba(0,0,0,0.05)]">
                        <div className="p-5 flex items-center justify-between pb-3">
                            <div className="flex items-center gap-6">
                                <button 
                                    onClick={handleToggleLike} 
                                    disabled={isLiking}
                                    className={cn("transition-all active:scale-75 flex items-center gap-2", isLiked ? "text-rose-500" : "text-foreground hover:text-rose-500")}
                                >
                                    <Heart className={cn("h-7 w-7", isLiked && "fill-current")} />
                                    <span className="font-black text-sm">{art.likes || 0}</span>
                                </button>
                                <button 
                                    onClick={() => setShowMedia(!showMedia)}
                                    className={cn(
                                        "flex items-center gap-2 transition-all active:scale-75",
                                        !showMedia ? "text-primary" : "text-foreground hover:text-primary"
                                    )}
                                >
                                    <MessageCircle className="h-7 w-7" />
                                    <span className="font-black text-sm">{art.commentCount || 0}</span>
                                </button>
                                <button onClick={() => setIsShareDialogOpen(true)} className="text-foreground hover:text-primary transition-all active:scale-75 -rotate-12">
                                    <SendIcon className="h-6.5 w-6.5" />
                                </button>
                            </div>
                            <Bookmark className="h-7 w-7 text-muted-foreground/30 hover:text-primary transition-colors cursor-pointer" />
                        </div>

                        <form onSubmit={handleSendComment} className="p-5 pt-0 border-t border-border/20 flex items-center gap-3 group relative pb-[max(1.25rem,env(safe-area-inset-bottom))] mt-3">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
                            <Input 
                                value={commentText} 
                                onChange={(e) => setCommentText(e.target.value)} 
                                placeholder="Tulis apresiasi kawan..." 
                                className="relative flex-1 bg-muted/30 border-none shadow-inner h-14 rounded-[1.5rem] text-[13px] font-medium focus-visible:ring-primary/20 px-6 transition-all" 
                                disabled={isSendingComment}
                            />
                            <Button 
                                type="submit" 
                                size="icon"
                                className="relative bg-primary h-14 w-14 rounded-2xl shadow-xl shadow-primary/20 active:scale-90 transition-all shrink-0 group/send"
                                disabled={!commentText.trim() || isSendingComment}
                            >
                                {isSendingComment ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendIcon className="h-5 w-5 group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5 transition-transform" />}
                            </Button>
                        </form>
                    </div>
                </div>
            </DialogContent>

            <ShareArtDialog 
                art={art} 
                open={isShareDialogOpen} 
                onOpenChange={setIsShareDialogOpen} 
            />
        </Dialog>
    );
}

function ShareArtDialog({ art, open, onOpenChange }: { art: ArtWork; open: boolean; onOpenChange: (open: boolean) => void }) {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const chatThreadsQuery = useMemo(() => (
        (firestore && currentUser)
          ? query(collection(firestore, 'chats'), where('participantUids', 'array-contains', currentUser.uid))
          : null
      ), [firestore, currentUser]);
    const { data: chatThreads, isLoading: isLoadingThreads } = useCollection<Chat>(chatThreadsQuery);

    const filteredChats = useMemo(() => {
        if (!chatThreads) return [];
        return chatThreads.filter(chat => {
            if (chat.isGroup) return chat.groupName?.toLowerCase().includes(searchTerm.toLowerCase());
            const other = chat.participants.find(p => p.uid !== currentUser?.uid);
            return other?.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                   other?.username.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [chatThreads, currentUser, searchTerm]);

    const handleExternalShare = async () => {
        const shareUrl = `${window.location.origin}/gallery?id=${art.id}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Mahakarya: ${art.title} oleh ${art.authorName}`,
                    text: art.content || art.title,
                    url: shareUrl,
                });
            } catch (err) {}
        } else {
            await navigator.clipboard.writeText(shareUrl);
            toast({ variant: 'success', title: "Tautan Disalin" });
        }
    };

    const handleSendToChat = async () => {
        if (!selectedChatId || !firestore || !currentUser) return;
        
        const selectedChat = chatThreads?.find(c => c.id === selectedChatId);
        setIsSending(true);

        const messageData: Omit<ArtShareMessage, 'id' | 'createdAt'> & { createdAt: any } = {
            type: 'art_share',
            senderId: currentUser.uid,
            createdAt: serverTimestamp(),
            art: {
                id: art.id,
                title: art.title,
                type: art.type,
                mediaUrl: art.mediaUrl,
                authorName: art.authorName,
                content: art.content,
            },
        };

        try {
            const batch = writeBatch(firestore);
            const messagesCol = collection(firestore, 'chats', selectedChatId, 'messages');
            batch.set(doc(messagesCol), messageData);

            const chatDocRef = doc(firestore, 'chats', selectedChatId);
            const updateData: any = {
                lastMessage: {
                    text: `🎨 Membagikan mahakarya: ${art.title}`,
                    senderId: currentUser.uid,
                    timestamp: serverTimestamp(),
                }
            };

            selectedChat?.participants.forEach(p => {
                if (p.uid !== currentUser.uid) {
                    updateData[`unreadCounts.${p.uid}`] = increment(1);
                }
            });

            batch.update(chatDocRef, updateData);
            await batch.commit();
            
            onOpenChange(false);
            toast({ variant: 'success', title: "Karya Terkirim" });
        } catch (error) {
            toast({ variant: 'destructive', title: "Gagal Membagikan" });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[95vw] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden flex flex-col max-h-[85dvh] bg-background/95 backdrop-blur-xl">
                <div className="p-8 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border-b shrink-0 relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
                    <DialogHeader className="relative z-10">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl text-primary ring-1 ring-primary/20">
                                <SendIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="font-headline text-2xl font-black">Bagikan Karya</DialogTitle>
                                <DialogDescription className="text-[10px] font-black uppercase tracking-widest text-primary/60 mt-1">Jalin Koneksi Literasi Visual</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="rounded-2xl h-14 font-black text-[10px] uppercase tracking-widest gap-2 border-2 hover:bg-primary/5" onClick={handleExternalShare}>
                            <Layers className="h-4 w-4 text-primary" /> Platform Lain
                        </Button>
                        <Button variant="outline" className="rounded-2xl h-14 font-black text-[10px] uppercase tracking-widest gap-2 border-2 hover:bg-emerald-500/5" onClick={() => {
                            const shareUrl = `${window.location.origin}/gallery?id=${art.id}`;
                            navigator.clipboard.writeText(shareUrl);
                            toast({ variant: 'success', title: "Tautan Disalin" });
                        }}>
                            <ImageIcon className="h-4 w-4 text-emerald-500" /> Salin Tautan
                        </Button>
                    </div>

                    <Separator className="opacity-50" />

                    <div className="relative group shrink-0">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                         <Input 
                            placeholder="Cari pujangga..." 
                            className="relative h-12 pl-11 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 transition-all shadow-inner font-medium" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                         />
                    </div>

                    <ScrollArea className="flex-1 px-1">
                        {isLoadingThreads ? (
                            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>
                        ) : (
                            <div className="flex flex-col gap-2 pb-10">
                                {filteredChats.map((chat) => {
                                    const otherP = chat.participants.find(p => p.uid !== currentUser?.uid);
                                    const isSelected = selectedChatId === chat.id;

                                    return (
                                        <button 
                                            key={chat.id}
                                            onClick={() => setSelectedChatId(isSelected ? null : chat.id)} 
                                            className={cn(
                                                "flex items-center gap-4 p-4 text-left rounded-[1.75rem] transition-all group relative border-2",
                                                isSelected ? "bg-primary text-white border-primary shadow-xl" : "bg-card/50 border-transparent hover:bg-card hover:border-primary/10"
                                            )}
                                        >
                                            <div className="relative">
                                                {chat.isGroup ? (
                                                    <div className="h-12 w-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center border border-indigo-200">
                                                        <Users className="h-6 w-6 text-indigo-600" />
                                                    </div>
                                                ) : (
                                                    <Avatar className="h-12 w-12 border-2 border-background">
                                                        <AvatarImage src={otherP?.photoURL} />
                                                        <AvatarFallback>{otherP?.displayName[0]}</AvatarFallback>
                                                    </Avatar>
                                                )}
                                                {isSelected && <div className="absolute -bottom-1 -right-1 bg-white text-primary p-1 rounded-full shadow-lg ring-2 ring-primary"><Check className="h-3 w-3" /></div>}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-sm truncate">{chat.isGroup ? chat.groupName : otherP?.displayName}</p>
                                                <p className={cn("text-[10px] font-bold uppercase tracking-widest", isSelected ? "text-white/60" : "text-muted-foreground")}>
                                                    {chat.isGroup ? `${chat.participants.length} Pujangga` : `@${otherP?.username}`}
                                                </p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter className="p-6 bg-muted/20 border-t flex gap-3">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full font-bold h-12 flex-1">Batal</Button>
                    <Button onClick={handleSendToChat} disabled={!selectedChatId || isSending} className="rounded-full px-10 font-black h-12 flex-1 shadow-xl shadow-primary/20">
                        {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><SendIcon className="mr-2 h-4 w-4" /> Kirim Sekarang</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
