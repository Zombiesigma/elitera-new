'use client';

import { notFound, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { useFirestore, useUser, useCollection, useDoc } from '@/firebase';
import { collection, query, where, limit, addDoc, documentId, doc, writeBatch, increment, serverTimestamp, orderBy, getDoc, type Query, type DocumentData } from 'firebase/firestore';
import type { User, Book, Chat, Favorite, Follow, Story, Reel } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookCard } from '@/components/BookCard';
import { UserPlus, MessageCircle, Edit, Loader2, UserMinus, Sparkles, Users, BookOpen, Heart as HeartIcon, CheckCircle2, MessageSquare, Clapperboard, Play, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { StoryViewer } from '@/components/stories/StoryViewer';
import { cn } from '@/lib/utils';
import { FollowsSheet } from '@/components/profile/FollowsSheet';
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProfilePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followsBack, setFollowsBack] = useState(false);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  
  const [sheetState, setSheetState] = useState<{open: boolean; type: 'followers' | 'following'}>({ open: false, type: 'followers' });

  // Normalisasi username: Decode URI, lowercase, dan hapus spasi/karakter non-alphanumeric
  const normalizedUsername = useMemo(() => {
      if (!params.username) return '';
      try {
          const decoded = decodeURIComponent(params.username);
          return decoded.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');
      } catch (e) {
          return params.username.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9_]/g, '');
      }
  }, [params.username]);

  const userQuery = useMemo(() => (
    (firestore && normalizedUsername)
      ? query(collection(firestore, 'users'), where('username', '==', normalizedUsername), limit(1)) 
      : null
  ), [firestore, normalizedUsername]);
  
  const { data: users, isLoading: isUserLoading } = useCollection<User>(userQuery);
  const user = users?.[0];

  const { data: currentUserProfile, isLoading: isCurrentUserProfileLoading } = useDoc<User>(
    (currentUser && firestore) ? doc(firestore, 'users', currentUser.uid) : null
  );
  
  const isOwnProfile = user?.uid === currentUser?.uid;

  useEffect(() => {
    if (!user) return;
    const checkStatus = () => {
        if (!user.status || user.status === 'offline' || !user.lastSeen) {
            setIsOnline(false);
            return;
        }
        
        let lastSeenMillis = 0;
        if (typeof (user.lastSeen as any).toMillis === 'function') {
            lastSeenMillis = (user.lastSeen as any).toMillis();
        } else if (user.lastSeen instanceof Date) {
            lastSeenMillis = (user.lastSeen as any).getTime();
        }

        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        setIsOnline(lastSeenMillis > fiveMinutesAgo);
    }
    checkStatus();
    const interval = setInterval(checkStatus, 60000); 
    return () => clearInterval(interval);
  }, [user]);


  const followingRef = useMemo(() => (
    (firestore && currentUser && user && !isOwnProfile)
      ? doc(firestore, 'users', currentUser.uid, 'following', user.uid)
      : null
  ), [firestore, currentUser, user, isOwnProfile]);
  const { data: followingDoc, isLoading: isFollowingLoading } = useDoc<Follow>(followingRef);
  
  const followerRef = useMemo(() => (
    (firestore && currentUser && user && !isOwnProfile)
      ? doc(firestore, 'users', user.uid, 'following', currentUser.uid)
      : null
  ), [firestore, currentUser, user, isOwnProfile]);
  const { data: isFollowerDoc, isLoading: isFollowerLoading } = useDoc<Follow>(followerRef);

  useEffect(() => {
    setIsFollowing(!!followingDoc);
  }, [followingDoc]);
  
  useEffect(() => {
    setFollowsBack(!!isFollowerDoc);
  }, [isFollowerDoc]);
  
  const publishedBooksQuery = useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'books'), where('authorId', '==', user.uid), where('status', '==', 'published'));
  }, [firestore, user]);
  
  const { data: rawPublishedBooks, isLoading: arePublishedBooksLoading } = useCollection<Book>(publishedBooksQuery);

  const publishedBooks = useMemo(() => {
    if (!rawPublishedBooks) return [];
    let books = rawPublishedBooks;
    if (!isOwnProfile) {
        if (isFollowing) {
            books = books.filter(b => b.visibility === 'public' || b.visibility === 'followers_only');
        } else {
            books = books.filter(b => b.visibility === 'public');
        }
    }
    return books;
  }, [rawPublishedBooks, isOwnProfile, isFollowing]);

  const userReelsQuery = useMemo(() => (
    (firestore && user)
      ? query(collection(firestore, 'reels'), where('authorId', '==', user.uid))
      : null
  ), [firestore, user]);
  const { data: rawUserReels, isLoading: areUserReelsLoading } = useCollection<Reel>(userReelsQuery);

  const userReels = useMemo(() => {
      if (!rawUserReels) return [];
      return [...rawUserReels].sort((a, b) => {
          const timeA = a.createdAt?.toMillis() || 0;
          const timeB = b.createdAt?.toMillis() || 0;
          return timeB - timeA;
      });
  }, [rawUserReels]);

  const otherBooksQuery = useMemo(() => (
    (firestore && user && isOwnProfile)
      ? query(collection(firestore, 'books'), where('authorId', '==', user.uid), where('status', 'in', ['draft', 'pending_review', 'rejected']))
      : null
  ), [firestore, user, isOwnProfile]);
  const { data: otherBooks, isLoading: areOtherBooksLoading } = useCollection<Book>(otherBooksQuery);

  const areBooksLoading = arePublishedBooksLoading || (isOwnProfile && areOtherBooksLoading);

  const chatsByUserQuery = useMemo(() => (
      (firestore && currentUser) 
        ? query(collection(firestore, 'chats'), where('participantUids', 'array-contains', currentUser.uid)) 
        : null
    ), [firestore, currentUser]);
  const { data: userChats, isLoading: areChatsLoading } = useCollection<Chat>(chatsByUserQuery);

  const favoritesQuery = useMemo(() => (
    (firestore && user && isOwnProfile) ? query(collection(firestore, 'users', user.uid, 'favorites')) : null
  ), [firestore, user, isOwnProfile]);
  const { data: favorites, isLoading: areFavoritesLoading } = useCollection<Favorite>(favoritesQuery);

  const favoriteBookIds = useMemo(() => favorites?.map(f => f.id) || [], [favorites]);

  const favoriteBooksQuery = useMemo(() => {
      if (!firestore || favoriteBookIds.length === 0 || !isOwnProfile) return null;
      const chunks = favoriteBookIds.slice(0, 30);
      if (chunks.length === 0) return null;
      return query(collection(firestore, 'books'), where(documentId(), 'in', chunks));
  }, [firestore, favoriteBookIds, isOwnProfile]);
  const { data: favoriteBooks, isLoading: areFavoriteBooksLoading } = useCollection<Book>(favoriteBooksQuery);
  
  const [allActiveStoriesQuery, setAllActiveStoriesQuery] = useState<Query<DocumentData> | null>(null);

  useEffect(() => {
    if (firestore) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      setAllActiveStoriesQuery(
        query(
          collection(firestore, 'stories'),
          where('createdAt', '>', twentyFourHoursAgo),
          orderBy('createdAt', 'desc')
        )
      );
    }
  }, [firestore]);
  
  const { data: allActiveStories, isLoading: areStoriesLoading } = useCollection<Story>(allActiveStoriesQuery);
  const userHasActiveStory = useMemo(() => (
      allActiveStories?.some(story => story.authorId === user?.uid)
  ), [allActiveStories, user]);

  const openFollowsSheet = (type: 'followers' | 'following') => {
    if ((type === 'followers' && (user?.followers || 0) > 0) || (type === 'following' && (user?.following || 0) > 0)) {
        setSheetState({ open: true, type });
    }
  };


  const handleStartChat = async () => {
    if (!firestore || !currentUser || !user || !currentUserProfile) return;
    setIsCreatingChat(true);

    const existingChat = userChats?.find(chat => chat.participantUids.includes(user.uid));

    if (existingChat) {
        router.push(`/messages?chatId=${existingChat.id}`);
        return;
    }

    try {
        const newChatData = {
            participantUids: [currentUser.uid, user.uid],
            participants: [
                { uid: currentUser.uid, displayName: currentUser.displayName!, photoURL: currentUser.photoURL!, username: currentUserProfile.username },
                { uid: user.uid, displayName: user.displayName, photoURL: user.photoURL, username: user.username }
            ],
            unreadCounts: {
                [currentUser.uid]: 0,
                [user.uid]: 0,
            },
            lastMessage: {
                text: 'Percakapan dimulai.',
                senderId: 'system',
                timestamp: serverTimestamp()
            }
        };
        const chatsCollection = collection(firestore, 'chats');
        const docRef = await addDoc(chatsCollection, newChatData);
        router.push(`/messages?chatId=${docRef.id}`);
    } catch (error) {
        console.error("Error creating chat:", error);
        toast({
            variant: "destructive",
            title: "Gagal Memulai Obrolan",
            description: "Terjadi kesalahan. Silakan coba lagi.",
        });
    } finally {
        setIsCreatingChat(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!firestore || !currentUser || !user || isOwnProfile || !currentUserProfile) return;
    setIsTogglingFollow(true);

    const followingDocRef = doc(firestore, 'users', currentUser.uid, 'following', user.uid);
    const followerDocRef = doc(firestore, 'users', user.uid, 'followers', currentUser.uid);
    const currentUserProfileRef = doc(firestore, 'users', currentUser.uid);
    const targetUserProfileRef = doc(firestore, 'users', user.uid);

    try {
        const batch = writeBatch(firestore);
        if (isFollowing) {
            batch.delete(followingDocRef);
            batch.delete(followerDocRef);
            batch.update(currentUserProfileRef, { following: increment(-1) });
            batch.update(targetUserProfileRef, { followers: increment(-1) });
        } else {
            const followData = { userId: currentUser.uid, followedAt: serverTimestamp() };
            batch.set(followingDocRef, followData);
            batch.set(followerDocRef, followData);
            batch.update(currentUserProfileRef, { following: increment(1) });
            batch.update(targetUserProfileRef, { followers: increment(1) });
        }
        await batch.commit();

        if (!isFollowing) {
            const targetUserDoc = await getDoc(targetUserProfileRef);
            if (targetUserDoc.exists()) {
                const targetUserProfileData = targetUserDoc.data() as User;
                if (targetUserProfileData.notificationPreferences?.onNewFollower !== false) {
                    const notificationData = {
                        type: 'follow' as const,
                        text: `${currentUser.displayName} mulai mengikuti Anda.`,
                        link: `/profile/${currentUserProfile.username.toLowerCase()}`,
                        actor: {
                            uid: currentUser.uid,
                            displayName: currentUser.displayName!,
                            photoURL: currentUser.photoURL!,
                        },
                        read: false,
                        createdAt: serverTimestamp()
                    };
                    const notificationsCol = collection(firestore, 'users', user.uid, 'notifications');
                    await addDoc(notificationsCol, notificationData);
                }
            }
            toast({ title: `Anda sekarang mengikuti ${user.displayName}` });
        } else {
            toast({ title: `Anda berhenti mengikuti ${user.displayName}` });
        }
    } catch (error) {
        console.error("Error toggling follow:", error);
        toast({
            variant: "destructive",
            title: "Gagal Mengikuti",
            description: "Terjadi kesalahan. Silakan coba lagi.",
        });
    } finally {
        setIsTogglingFollow(false);
    }
  };

  if (isUserLoading || areStoriesLoading) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    notFound();
  }

  return (
    <>
      <AnimatePresence>
        {userHasActiveStory && allActiveStories && isStoryViewerOpen && (
            <StoryViewer
            stories={allActiveStories}
            initialAuthorId={user.uid}
            isOpen={isStoryViewerOpen}
            onClose={() => setIsStoryViewerOpen(false)}
            />
        )}
      </AnimatePresence>

      {user && <FollowsSheet 
        userId={user.id} 
        type={sheetState.type} 
        open={sheetState.open} 
        onOpenChange={(open) => setSheetState(s => ({...s, open}))} 
      />}

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8 md:space-y-10 pb-20 w-full"
      >
        <Card className="overflow-hidden border-none shadow-2xl bg-card/50 backdrop-blur-md rounded-[2rem] md:rounded-[2.5rem] relative">
          <div className="h-32 md:h-64 bg-gradient-to-br from-primary via-accent to-indigo-600 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>

          <CardContent className="p-5 md:p-10 relative">
              <div className="flex flex-col md:flex-row items-center md:items-end gap-5 md:gap-6 -mt-16 md:-mt-32">
                  <div className="relative group">
                    <button
                        disabled={!userHasActiveStory}
                        onClick={() => userHasActiveStory && setIsStoryViewerOpen(true)}
                        className={cn(
                            "relative rounded-full p-1 transition-transform active:scale-95",
                            userHasActiveStory && "bg-gradient-to-tr from-yellow-400 via-rose-500 to-primary animate-pulse"
                        )}
                    >
                        <div className="rounded-full bg-background p-0.5 md:p-1">
                            <Avatar className="w-24 h-24 md:w-40 md:h-40 border-2 md:border-4 border-background shadow-2xl">
                                <AvatarImage src={user.photoURL} alt={user.displayName} className="object-cover" />
                                <AvatarFallback className="text-4xl font-black bg-primary/5 text-primary">
                                    {user.displayName?.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                        </div>
                    </button>
                    {isOnline && (
                        <span className="absolute bottom-3 right-3 md:bottom-4 md:right-4 block h-4 w-4 md:h-6 md:w-6 rounded-full bg-green-500 border-2 md:border-4 border-card shadow-lg" title="Online" />
                    )}
                  </div>

                  <div className="flex-1 text-center md:text-left space-y-1 md:space-y-2 w-full min-w-0">
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 md:gap-3">
                          <h1 className="text-2xl md:text-4xl font-black font-headline text-foreground tracking-tight truncate">{user.displayName}</h1>
                          <Badge variant={user.role === 'penulis' ? 'default' : 'secondary'} className="rounded-full px-3 md:px-4 py-0.5 md:py-1 font-bold shadow-sm capitalize text-[10px] md:text-xs">
                            {user.role}
                          </Badge>
                          {user.role === 'admin' && (
                              <CheckCircle2 className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                          )}
                      </div>
                      <p className="text-muted-foreground font-bold tracking-widest uppercase text-[10px] md:text-xs">@{user.username}</p>
                  </div>

                  <div className="flex gap-2 w-full md:w-auto shrink-0 pt-2 md:pt-0">
                      {isOwnProfile ? (
                          <Button asChild className="rounded-full px-8 h-11 md:h-12 font-bold shadow-xl shadow-primary/20 w-full md:w-auto text-sm">
                            <Link href="/settings">
                                <Edit className="mr-2 h-4 w-4"/> Edit Profil
                            </Link>
                          </Button>
                      ) : (
                          <div className="flex gap-2 w-full">
                              <Button 
                                onClick={handleToggleFollow} 
                                disabled={isTogglingFollow || isFollowingLoading || isCurrentUserProfileLoading || isFollowerLoading} 
                                variant={isFollowing ? "outline" : "default"}
                                className={cn(
                                    "rounded-full px-6 h-11 md:h-12 font-bold flex-1 md:flex-none text-sm",
                                    !isFollowing && "shadow-xl shadow-primary/20"
                                )}
                              >
                                {(isTogglingFollow || isFollowingLoading || isCurrentUserProfileLoading || isFollowerLoading) ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                ) : (
                                  isFollowing ? <UserMinus className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4"/>
                                )}
                                {isFollowing ? 'Berhenti' : (followsBack ? 'Follback' : 'Ikuti')}
                              </Button>
                              <Button 
                                variant="outline" 
                                onClick={handleStartChat} 
                                disabled={isCreatingChat || areChatsLoading || isCurrentUserProfileLoading}
                                className="rounded-full h-11 md:h-12 md:w-auto md:px-6 border-2 font-bold"
                              >
                                  {(isCreatingChat || areChatsLoading || isCurrentUserProfileLoading) ? (
                                      <Loader2 className="h-4 w-4 animate-spin"/>
                                  ) : (
                                      <>
                                        <MessageSquare className="md:mr-2 h-4 w-4"/>
                                        <span className="hidden md:inline text-sm">Pesan</span>
                                      </>
                                  )}
                              </Button>
                          </div>
                      )}
                  </div>
              </div>

              <div className="mt-6 md:mt-8 flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center">
                  <div className="flex-1 w-full text-center md:text-left">
                    <p className="text-foreground/80 leading-relaxed max-w-2xl text-base md:text-lg italic font-serif">
                        {user.bio || "Pujangga inspiratif di komunitas Elitera yang berbagi cerita lewat kata."}
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 md:gap-12 w-full md:w-auto pt-6 md:pt-0 border-t md:border-t-0 md:border-l border-border/50 md:pl-12">
                      <div className="text-center space-y-1">
                          <p className="font-black text-xl md:text-2xl text-primary">{areBooksLoading ? '...' : (publishedBooks?.length ?? 0)}</p>
                          <div className="flex items-center justify-center gap-1 text-[8px] md:text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                              <BookOpen className="h-3 w-3" /> Karya
                          </div>
                      </div>
                      <button className="text-center space-y-1 group disabled:cursor-default" onClick={() => openFollowsSheet('followers')} disabled={!user.followers}>
                          <p className="font-black text-xl md:text-2xl text-foreground group-hover:text-primary transition-colors">{new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(user.followers || 0)}</p>
                          <div className="flex items-center justify-center gap-1 text-[8px] md:text-[10px] uppercase font-black tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                              <Users className="h-3 w-3" /> Pengikut
                          </div>
                      </button>
                      <button className="text-center space-y-1 group disabled:cursor-default" onClick={() => openFollowsSheet('following')} disabled={!user.following}>
                          <p className="font-black text-xl md:text-2xl text-foreground group-hover:text-primary transition-colors">{user.following || 0}</p>
                          <div className="flex items-center justify-center gap-1 text-[8px] md:text-[10px] uppercase font-black tracking-widest text-muted-foreground group-hover:text-primary transition-colors">
                              <Sparkles className="h-3 w-3" /> Mengikuti
                          </div>
                      </button>
                  </div>
              </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="published-books" className="space-y-6 md:space-y-8">
          <div className="flex items-center justify-center px-2">
            <TabsList className="bg-muted/50 p-1 rounded-full h-auto flex-wrap justify-center max-w-full">
                <TabsTrigger value="published-books" className="rounded-full px-4 md:px-6 py-2 text-xs md:text-sm font-bold transition-all">Karya</TabsTrigger>
                <TabsTrigger value="reels" className="rounded-full px-4 md:px-6 py-2 text-xs md:text-sm font-bold transition-all">Reels</TabsTrigger>
                {isOwnProfile && <TabsTrigger value="drafts" className="rounded-full px-4 md:px-6 py-2 text-xs md:text-sm font-bold transition-all">Draf</TabsTrigger>}
                {isOwnProfile && <TabsTrigger value="favorites" className="rounded-full px-4 md:px-6 py-2 text-xs md:text-sm font-bold transition-all">Favorit</TabsTrigger>}
            </TabsList>
          </div>

          <TabsContent value="published-books" className="mt-0 outline-none">
               {arePublishedBooksLoading && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 px-1">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="space-y-3">
                          <Skeleton className="aspect-[2/3] w-full rounded-2xl" />
                          <Skeleton className="h-5 w-3/4" />
                        </div>
                      ))}
                  </div>
              )}
              <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 px-1">
                  {publishedBooks?.map(book => (
                      <motion.div key={book.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                        <BookCard book={book} />
                      </motion.div>
                  ))}
              </motion.div>
              {!arePublishedBooksLoading && publishedBooks?.length === 0 && (
                  <div className="text-center py-16 md:py-20 bg-muted/20 rounded-[2rem] border-2 border-dashed mx-1">
                      <BookOpen className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/20 mx-auto mb-4" />
                      <p className="text-muted-foreground font-headline font-bold text-base md:text-lg">{isOwnProfile ? "Anda" : "Pengguna ini"} belum menerbitkan karya.</p>
                  </div>
              )}
          </TabsContent>

          <TabsContent value="reels" className="mt-0 outline-none">
                {areUserReelsLoading && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 px-1">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-[9/16] w-full rounded-2xl" />
                        ))}
                    </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 px-1">
                    {userReels?.map(reel => (
                        <motion.div key={reel.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                            <Link href={`/reels?id=${reel.id}`} className="group relative aspect-[9/16] block overflow-hidden rounded-2xl bg-zinc-900 border border-white/5 shadow-lg active:scale-95 transition-transform">
                                <video src={reel.videoUrl} className="h-full w-full object-cover opacity-80" muted playsInline />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                                <div className="absolute bottom-2 left-2 right-2 md:bottom-3 md:left-3 md:right-3 text-white pointer-events-none">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Play className="h-2 w-2 md:h-2.5 md:w-2.5 fill-current text-primary" />
                                        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">{new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(reel.viewCount || 0)}</span>
                                    </div>
                                    <p className="text-[8px] md:text-[9px] font-medium line-clamp-2 italic opacity-80 leading-tight">"{reel.caption || 'Video Elitera'}"</p>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>
                {!areUserReelsLoading && userReels?.length === 0 && (
                    <div className="text-center py-16 md:py-20 bg-muted/20 rounded-[2rem] border-2 border-dashed mx-1">
                        <Clapperboard className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/20 mx-auto mb-4" />
                        <p className="text-muted-foreground font-headline font-bold text-base md:text-lg">{isOwnProfile ? "Anda" : "Pengguna ini"} belum menerbitkan Reel.</p>
                    </div>
                )}
          </TabsContent>

          {isOwnProfile && (
            <TabsContent value="drafts" className="mt-0 outline-none">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 px-1">
                    {otherBooks?.map(book => <BookCard key={book.id} book={book} />)}
                </div>
                {!areOtherBooksLoading && otherBooks?.length === 0 && (
                    <div className="text-center py-16 md:py-20 bg-muted/20 rounded-[2rem] border-2 border-dashed mx-1">
                        <Edit className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/20 mx-auto mb-4" />
                        <p className="text-muted-foreground font-headline font-bold text-base md:text-lg">Anda tidak memiliki draf buku.</p>
                    </div>
                )}
            </TabsContent>
          )}

          {isOwnProfile && (
              <TabsContent value="favorites" className="mt-0 outline-none">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 px-1">
                      {favoriteBooks?.map(book => <BookCard key={book.id} book={book} />)}
                  </div>
                  {!(areFavoritesLoading || areFavoriteBooksLoading) && favoriteBooks?.length === 0 && (
                      <div className="text-center py-16 md:py-20 bg-muted/20 rounded-[2rem] border-2 border-dashed mx-1">
                        <HeartIcon className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground/20 mx-auto mb-4" />
                        <p className="text-muted-foreground font-headline font-bold text-base md:text-lg">Belum ada buku favorit.</p>
                    </div>
                  )}
              </TabsContent>
          )}
        </Tabs>
      </motion.div>
    </>
  )
}


function ProfileSkeleton() {
    return (
        <div className="space-y-10 animate-pulse pb-20 w-full overflow-hidden">
            <Card className="overflow-hidden border-none rounded-[2rem] md:rounded-[2.5rem]">
                <Skeleton className="h-32 md:h-64 w-full" />
                <CardContent className="p-5 md:p-10 -mt-16 md:-mt-32">
                     <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
                        <Skeleton className="w-24 h-24 md:w-40 md:h-40 rounded-full border-4 border-background" />
                        <div className="flex-1 text-center md:text-left space-y-3">
                             <Skeleton className="h-8 w-48 mx-auto md:mx-0" />
                             <Skeleton className="h-3 w-24 mx-auto md:mx-0" />
                        </div>
                    </div>
                     <Skeleton className="h-4 w-full max-w-lg mt-8 rounded-full" />
                     <div className="flex justify-center md:justify-start gap-8 mt-8 pt-8 border-t">
                        <Skeleton className="h-10 w-16" />
                        <Skeleton className="h-10 w-16" />
                        <Skeleton className="h-10 w-16" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}