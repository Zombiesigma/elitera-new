'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { useFirestore, useUser, useCollection, useDoc } from '@/firebase';
import { collection, query, where, limit, doc, writeBatch, increment, serverTimestamp, orderBy, type Query, type DocumentData } from 'firebase/firestore';
import type { User, Book, Follow, Story, Reel, ArtWork } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookCard } from '@/components/BookCard';
import { 
  UserPlus, 
  MessageCircle, 
  Edit, 
  Loader2, 
  UserMinus, 
  Sparkles, 
  Users, 
  BookOpen, 
  Heart, 
  CheckCircle2, 
  MessageSquare, 
  Clapperboard, 
  Play, 
  ChevronRight, 
  Zap, 
  Globe, 
  ImageIcon, 
  Quote, 
  Film, 
  X 
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { cn } from '@/lib/utils';
import { FollowsSheet } from '@/components/profile/FollowsSheet';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('books');
  const [sheetState, setSheetState] = useState<{open: boolean; type: 'followers' | 'following'}>({ open: false, type: 'followers' });

  const normalizedUsername = useMemo(() => params.username?.toLowerCase().replace(/[^a-z0-9_]/g, ''), [params.username]);

  const userQuery = useMemo(() => (
    (firestore && normalizedUsername)
      ? query(collection(firestore, 'users'), where('username', '==', normalizedUsername), limit(1)) 
      : null
  ), [firestore, normalizedUsername]);
  
  const { data: users, isLoading: isUserLoading } = useCollection<User>(userQuery);
  const user = users?.[0];
  const isOwnProfile = user?.uid === currentUser?.uid;

  const followingRef = useMemo(() => (firestore && currentUser && user && !isOwnProfile) ? doc(firestore, 'users', currentUser.uid, 'following', user.uid) : null, [firestore, currentUser, user, isOwnProfile]);
  const { data: followingDoc } = useDoc<Follow>(followingRef);

  useEffect(() => { setIsFollowing(!!followingDoc); }, [followingDoc]);

  const publishedBooksQuery = useMemo(() => (firestore && user) ? query(collection(firestore, 'books'), where('authorId', '==', user.uid), where('status', '==', 'published')) : null, [firestore, user]);
  const { data: publishedBooks, isLoading: areBooksLoading } = useCollection<Book>(publishedBooksQuery);

  const artworksQuery = useMemo(() => (firestore && user) ? query(collection(firestore, 'artworks'), where('authorId', '==', user.uid), orderBy('createdAt', 'desc')) : null, [firestore, user]);
  const { data: userArtworks, isLoading: areArtworksLoading } = useCollection<ArtWork>(artworksQuery);

  const reelsQuery = useMemo(() => (firestore && user) ? query(collection(firestore, 'reels'), where('authorId', '==', user.uid), orderBy('createdAt', 'desc')) : null, [firestore, user]);
  const { data: userReels, isLoading: areReelsLoading } = useCollection<Reel>(reelsQuery);

  const [activeStoriesQuery, setActiveStoriesQuery] = useState<Query<DocumentData> | null>(null);
  useEffect(() => {
    if (firestore) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      setActiveStoriesQuery(query(collection(firestore, 'stories'), where('createdAt', '>', dayAgo), orderBy('createdAt', 'desc')));
    }
  }, [firestore]);
  const { data: allActiveStories } = useCollection<Story>(activeStoriesQuery);
  const hasStory = useMemo(() => allActiveStories?.some(s => s.authorId === user?.uid), [allActiveStories, user]);

  const handleStartChat = async () => {
    if (!firestore || !currentUser || !user) return;
    setIsCreatingChat(true);
    try {
        const chatsCol = collection(firestore, 'chats');
        const newChatRef = doc(chatsCol);
        
        await writeBatch(firestore).set(newChatRef, {
            participantUids: [currentUser.uid, user.uid],
            participants: [
                {uid: currentUser.uid, displayName: currentUser.displayName!, photoURL: currentUser.photoURL!, username: 'me'}, 
                {uid: user.uid, displayName: user.displayName, photoURL: user.photoURL, username: user.username}
            ],
            unreadCounts: {[currentUser.uid]: 0, [user.uid]: 0},
            lastMessage: { text: 'Inspirasi dimulai.', senderId: 'system', timestamp: serverTimestamp() }
        }).commit();
        
        router.push(`/messages?chatId=${newChatRef.id}`);
    } catch(e) {
        toast({ variant: 'destructive', title: "Gagal memulai obrolan" });
    } finally { setIsCreatingChat(false); }
  };

  const handleFollow = async () => {
    if (!firestore || !currentUser || !user || isOwnProfile) return;
    setIsTogglingFollow(true);
    try {
        const batch = writeBatch(firestore);
        const followRef = doc(firestore, 'users', currentUser.uid, 'following', user.uid);
        const followerRef = doc(firestore, 'users', user.uid, 'followers', currentUser.uid);
        
        if (isFollowing) {
            batch.delete(followRef);
            batch.delete(followerRef);
            batch.update(doc(firestore, 'users', currentUser.uid), { following: increment(-1) });
            batch.update(doc(firestore, 'users', user.uid), { followers: increment(-1) });
        } else {
            batch.set(followRef, { userId: currentUser.uid, followedAt: serverTimestamp() });
            batch.set(followerRef, { userId: user.uid, followedAt: serverTimestamp() });
            batch.update(doc(firestore, 'users', currentUser.uid), { following: increment(1) });
            batch.update(doc(firestore, 'users', user.uid), { followers: increment(1) });
            
            const notifRef = doc(collection(firestore, `users/${user.uid}/notifications`));
            batch.set(notifRef, {
                type: 'follow',
                text: `${currentUser.displayName} mulai mengikuti Anda.`,
                link: `/profile/${currentUser.displayName?.toLowerCase().replace(/\s+/g, '')}`,
                actor: {
                    uid: currentUser.uid,
                    displayName: currentUser.displayName!,
                    photoURL: currentUser.photoURL!,
                },
                read: false,
                createdAt: serverTimestamp()
            });
        }
        await batch.commit();
        toast({ title: isFollowing ? "Berhenti mengikuti" : "Mulai mengikuti" });
    } catch(e) {
        toast({ variant: 'destructive', title: "Gagal mengubah status ikuti" });
    } finally { setIsTogglingFollow(false); }
  };

  if (isUserLoading) return <ProfileSkeleton />;
  if (!user) notFound();

  return (
    <div className="max-w-xl mx-auto pb-32 space-y-8 px-1">
      {hasStory && allActiveStories && isStoryViewerOpen && (
        <StoryViewer 
            stories={allActiveStories} 
            initialAuthorId={user.uid} 
            isOpen={isStoryViewerOpen} 
            onClose={() => setIsStoryViewerOpen(false)} 
        />
      )}
      
      <FollowsSheet 
        userId={user.uid} 
        type={sheetState.type} 
        open={sheetState.open} 
        onOpenChange={(o) => setSheetState(prev => ({...prev, open: o}))} 
      />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <Card className="border-none shadow-2xl bg-card overflow-hidden rounded-[2.5rem] md:rounded-[3rem] ring-1 ring-border/50">
            <div className="h-40 md:h-48 bg-gradient-to-br from-primary/30 via-accent/10 to-indigo-500/20 relative">
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-card to-transparent" />
            </div>
            
            <CardContent className="p-6 md:p-10 -mt-20 flex flex-col items-center text-center relative z-10">
                <div className="relative mb-6">
                    <div className={cn(
                        "p-1.5 rounded-full transition-all duration-700",
                        hasStory ? "bg-gradient-to-tr from-primary via-accent to-indigo-500 animate-pulse scale-105 cursor-pointer" : "bg-transparent"
                    )}
                    onClick={() => hasStory && setIsStoryViewerOpen(true)}
                    >
                        <div 
                            className="p-1 rounded-full bg-card cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsPhotoPreviewOpen(true);
                            }}
                        >
                            <Avatar className="h-28 w-28 md:h-36 md:w-36 border-4 border-background shadow-2xl transition-transform active:scale-95">
                                <AvatarImage src={user.photoURL} className="object-cover" />
                                <AvatarFallback className="bg-primary/10 text-primary text-3xl font-black italic">{user.displayName[0]}</AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                    {(user.role === 'penulis' || user.role === 'admin') && (
                        <div className="absolute -bottom-1 -right-1 bg-primary text-white p-2 rounded-full shadow-xl ring-4 ring-background z-20">
                            <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6" />
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                        <h1 className="text-3xl md:text-4xl font-headline font-black tracking-tight">{user.displayName}</h1>
                        {user.status === 'online' && (
                            <span className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse" />
                        )}
                    </div>
                    <div className="flex items-center justify-center gap-3">
                        <p className="text-[10px] md:text-xs font-black text-primary uppercase tracking-[0.2em]">@{user.username}</p>
                        <div className="h-1 w-1 rounded-full bg-border" />
                        <Badge variant="outline" className="rounded-full px-3 py-0.5 text-[8px] font-black uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
                            {user.role}
                        </Badge>
                    </div>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-4 text-muted-foreground/60 text-[10px] font-bold uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" /> Elitera Network</span>
                    <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Indonesia</span>
                </div>

                <p className="mt-8 text-sm md:text-base font-medium italic text-muted-foreground/80 px-4 md:px-10 leading-relaxed max-w-md mx-auto border-l-2 border-primary/10">
                    "{user.bio || "Seorang penjelajah imajinasi di semesta Elitera yang percaya bahwa setiap aksara memiliki jiwanya sendiri kawan."}"
                </p>

                <div className="grid grid-cols-3 gap-2 w-full mt-10 border-t border-border/30 pt-10">
                    <div className="flex flex-col items-center gap-1">
                        <p className="font-black text-xl md:text-2xl tracking-tighter">{publishedBooks?.length || 0}</p>
                        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Karya</p>
                    </div>
                    <button 
                        onClick={() => setSheetState({ open: true, type: 'followers' })}
                        className="flex flex-col items-center gap-1 hover:bg-muted/20 rounded-2xl py-2 transition-colors"
                    >
                        <p className="font-black text-xl md:text-2xl tracking-tighter">{new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(user.followers || 0)}</p>
                        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Pengikut</p>
                    </button>
                    <button 
                        onClick={() => setSheetState({ open: true, type: 'following' })}
                        className="flex flex-col items-center gap-1 hover:bg-muted/20 rounded-2xl py-2 transition-colors"
                    >
                        <p className="font-black text-xl md:text-2xl tracking-tighter">{user.following || 0}</p>
                        <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-50">Mengikuti</p>
                    </button>
                </div>

                <div className="flex gap-3 w-full mt-8">
                    {isOwnProfile ? (
                        <Button className="flex-1 rounded-2xl h-14 font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-primary/20 active:scale-95 transition-all" asChild>
                            <Link href="/settings"><Edit className="mr-2 h-4 w-4" /> Edit Profil</Link>
                        </Button>
                    ) : (
                        <>
                            <Button 
                                className={cn(
                                    "flex-1 rounded-2xl h-14 font-black uppercase text-[10px] tracking-[0.2em] transition-all active:scale-95 shadow-xl",
                                    isFollowing ? "bg-muted text-foreground shadow-none" : "bg-primary text-white shadow-primary/20"
                                )} 
                                onClick={handleFollow} 
                                disabled={isTogglingFollow}
                            >
                                {isTogglingFollow ? <Loader2 className="h-4 w-4 animate-spin" /> : isFollowing ? <><UserMinus className="mr-2 h-4 w-4" /> Batal Ikuti</> : <><UserPlus className="mr-2 h-4 w-4" /> Ikuti</>}
                            </Button>
                            <Button 
                                variant="outline" 
                                className="flex-1 rounded-2xl h-14 border-2 font-black uppercase text-[10px] tracking-[0.2em] active:scale-95 transition-all shadow-lg" 
                                onClick={handleStartChat} 
                                disabled={isCreatingChat}
                            >
                                {isCreatingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <><MessageCircle className="mr-2 h-4 w-4" /> Kirim Pesan</>}
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
      </motion.div>

      <Tabs defaultValue="books" className="w-full" onValueChange={setActiveTab}>
        <div className="flex items-center justify-center">
            <TabsList className="bg-muted/30 rounded-[1.5rem] h-14 p-1.5 w-full max-w-sm ring-1 ring-border/50">
                <TabsTrigger value="books" className="flex-1 rounded-xl font-black uppercase text-[9px] tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all">
                    <BookOpen className="mr-1.5 h-3.5 w-3.5" /> Karya
                </TabsTrigger>
                <TabsTrigger value="gallery" className="flex-1 rounded-xl font-black uppercase text-[9px] tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all">
                    <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> Galeri
                </TabsTrigger>
                <TabsTrigger value="reels" className="flex-1 rounded-xl font-black uppercase text-[9px] tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-lg transition-all">
                    <Clapperboard className="mr-1.5 h-3.5 w-3.5" /> Reels
                </TabsTrigger>
            </TabsList>
        </div>

        <AnimatePresence mode="wait">
            <TabsContent key="books" value="books" className="pt-8 mt-0 focus-visible:ring-0">
                {areBooksLoading ? (
                    <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] w-full rounded-[2rem]" />)}
                    </div>
                ) : publishedBooks?.length === 0 ? (
                    <div className="py-24 text-center space-y-6 opacity-30">
                        <div className="bg-muted p-10 rounded-[2.5rem] w-fit mx-auto shadow-inner"><BookOpen className="h-16 w-16" /></div>
                        <p className="font-headline text-2xl font-black italic">Hening Tanpa Narasi.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 md:gap-6">
                        {publishedBooks?.map(b => (
                            <motion.div key={b.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                                <BookCard book={b} />
                            </motion.div>
                        ))}
                    </div>
                )}
            </TabsContent>

            <TabsContent key="gallery" value="gallery" className="pt-8 mt-0 focus-visible:ring-0">
                {areArtworksLoading ? (
                    <div className="grid grid-cols-2 gap-4">
                        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square w-full rounded-[2rem]" />)}
                    </div>
                ) : userArtworks?.length === 0 ? (
                    <div className="py-24 text-center space-y-6 opacity-30">
                        <div className="bg-muted p-10 rounded-[2.5rem] w-fit mx-auto shadow-inner"><ImageIcon className="h-16 w-16" /></div>
                        <p className="font-headline text-2xl font-black italic">Hening Tanpa Visual.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 md:gap-6">
                        {userArtworks?.map(art => (
                            <Link href={`/gallery?id=${art.id}`} key={art.id}>
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }} 
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="aspect-square relative rounded-[2rem] overflow-hidden group shadow-lg border border-white/10"
                                >
                                    {art.type === 'quote' ? (
                                        <div className="w-full h-full p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-primary/10 via-accent/5 to-transparent relative">
                                            <Quote className="h-8 w-8 text-primary/10 absolute top-4 left-4" />
                                            <p className="text-[10px] md:text-xs font-black italic leading-tight line-clamp-4 px-2">"{art.content}"</p>
                                        </div>
                                    ) : art.type === 'video' ? (
                                        <div className="w-full h-full bg-zinc-950">
                                            <video src={art.mediaUrl} className="w-full h-full object-cover opacity-80" muted />
                                            <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10">
                                                <Film className="h-3 w-3 text-indigo-400" />
                                            </div>
                                        </div>
                                    ) : (
                                        <img src={art.mediaUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={art.title} />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-white text-[9px] font-black uppercase tracking-widest truncate">{art.title}</p>
                                    </div>
                                </motion.div>
                            </Link>
                        ))}
                    </div>
                )}
            </TabsContent>

            <TabsContent key="reels" value="reels" className="pt-8 mt-0 focus-visible:ring-0">
                {areReelsLoading ? (
                    <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[9/16] w-full rounded-2xl" />)}
                    </div>
                ) : userReels?.length === 0 ? (
                    <div className="py-24 text-center space-y-6 opacity-30">
                        <div className="bg-muted p-10 rounded-[2.5rem] w-fit mx-auto shadow-inner"><Clapperboard className="h-16 w-16" /></div>
                        <p className="font-headline text-2xl font-black italic">Belum Ada Momen Video.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-2">
                        {userReels?.map(reel => (
                            <Link href={`/reels?id=${reel.id}`} key={reel.id} className="relative aspect-[9/16] rounded-2xl overflow-hidden bg-black group shadow-lg">
                                <video src={reel.videoUrl} className="w-full h-full object-cover opacity-80" muted />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-3">
                                    <div className="flex items-center gap-1.5 text-white/90">
                                        <Play className="h-3 w-3 fill-current" />
                                        <span className="text-[10px] font-black">{new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(reel.viewCount || 0)}</span>
                                    </div>
                                </div>
                                <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                        ))}
                    </div>
                )}
            </TabsContent>
        </AnimatePresence>
      </Tabs>

      {/* Profile Photo Preview Dialog */}
      <Dialog open={isPhotoPreviewOpen} onOpenChange={setIsPhotoPreviewOpen}>
        <DialogContent className="max-w-none w-screen h-[100dvh] p-0 border-none bg-black/95 backdrop-blur-2xl z-[500] flex flex-col items-center justify-center rounded-none">
            <DialogHeader className="sr-only">
                <DialogTitle>Pratinjau Foto Profil</DialogTitle>
                <DialogDescription>Melihat foto profil {user.displayName} dalam ukuran penuh kawan.</DialogDescription>
            </DialogHeader>
            
            <div className="absolute top-6 right-6 z-[510] pt-[max(1.5rem,env(safe-area-inset-top))]">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white hover:bg-white/10 rounded-full h-12 w-12 bg-black/20 backdrop-blur-md border border-white/10"
                    onClick={() => setIsPhotoPreviewOpen(false)}
                >
                    <X className="h-6 w-6" />
                </Button>
            </div>

            <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative w-full h-full flex items-center justify-center p-4"
            >
                <img 
                    src={user.photoURL} 
                    className="max-w-[90vw] max-h-[80vh] object-contain shadow-2xl rounded-2xl ring-1 ring-white/10" 
                    alt={user.displayName} 
                />
            </motion.div>
        </DialogContent>
      </Dialog>

      <div className="text-center opacity-20 select-none grayscale py-10">
          <div className="flex items-center justify-center gap-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.5em]">Elitera Otoritas Profil v2.2</span>
          </div>
      </div>
    </div>
  )
}

function ProfileSkeleton() { 
    return (
        <div className="max-w-lg mx-auto p-6 space-y-10 animate-pulse">
            <Skeleton className="h-64 w-full rounded-[2.5rem] md:rounded-[3rem]" />
            <div className="flex justify-center gap-4">
                <Skeleton className="h-12 w-1/3 rounded-xl" />
                <Skeleton className="h-12 w-1/3 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-64 rounded-[2rem]" />
                <Skeleton className="h-64 rounded-[2rem]" />
            </div>
        </div>
    );
}
