'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc, collection, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import type { Story, StoryLike } from '@/lib/types';
import { X, Heart, MessageSquare, Send as SendIcon, ChevronLeft, ChevronRight, Loader2, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { StoryViewersSheet } from './StoryViewersSheet';
import { StoryCommentsSheet } from './StoryCommentsSheet';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface StoryViewerProps {
  stories: Story[];
  initialAuthorId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function StoryViewer({ stories, initialAuthorId, isOpen, onClose }: StoryViewerProps) {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [authorIndex, setAuthorIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showViews, setShowViews] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const viewedStoriesInSession = useRef(new Set<string>());
  const videoRef = useRef<HTMLVideoElement>(null);

  // Group stories by author
  const storyGroups = useMemo(() => {
    const groups: { [key: string]: { authorId: string; authorName: string; authorAvatarUrl: string; authorRole: string; stories: Story[] } } = {};
    stories.forEach(story => {
      if (!groups[story.authorId]) {
        groups[story.authorId] = {
          authorId: story.authorId,
          authorName: story.authorName,
          authorAvatarUrl: story.authorAvatarUrl,
          authorRole: story.authorRole,
          stories: [],
        };
      }
      groups[story.authorId].stories.push(story);
    });
    return Object.values(groups).sort((a,b) => b.stories[0].createdAt.toMillis() - a.stories[0].createdAt.toMillis());
  }, [stories]);
  
  useEffect(() => {
    if (isOpen) {
      const initialIndex = storyGroups.findIndex(g => g.authorId === initialAuthorId);
      if (initialIndex !== -1) {
        setAuthorIndex(initialIndex);
        setStoryIndex(0);
      }
    }
  }, [initialAuthorId, storyGroups, isOpen]);

  const currentGroup = storyGroups[authorIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  const nextStory = useCallback(() => {
    if (!currentGroup) return;
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(s => s + 1);
    } else if (authorIndex < storyGroups.length - 1) {
      setAuthorIndex(a => a + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }, [storyIndex, authorIndex, currentGroup, storyGroups.length, onClose]);

  const prevStory = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(s => s - 1);
    } else if (authorIndex > 0) {
      const prevGroup = storyGroups[authorIndex - 1];
      setAuthorIndex(a => a - 1);
      setStoryIndex(prevGroup.stories.length - 1);
    }
  }, [storyIndex, authorIndex, storyGroups]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('form') || target.closest('input')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    if (x < width * 0.3) {
      prevStory();
    } else {
      nextStory();
    }
  };
  
  useEffect(() => {
    if (!isOpen || isPaused || showViews || showComments) return;
    if (currentStory?.type === 'video') return;

    const timer = setTimeout(() => {
      nextStory();
    }, 7000); 

    return () => clearTimeout(timer);
  }, [storyIndex, authorIndex, isOpen, isPaused, showViews, showComments, nextStory, currentStory?.type]);
  
  useEffect(() => {
    if (!currentStory || !currentUser || !firestore || !isOpen) return;

    const isAuthor = currentStory.authorId === currentUser.uid;
    const hasBeenViewed = viewedStoriesInSession.current.has(currentStory.id);

    if (!isAuthor && !hasBeenViewed) {
      const storyRef = doc(firestore, 'stories', currentStory.id);
      const viewRef = doc(firestore, 'stories', currentStory.id, 'views', currentUser.uid);
      
      const batch = writeBatch(firestore);
      batch.update(storyRef, { viewCount: increment(1) });
      batch.set(viewRef, {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Pujangga Elitera',
        userAvatarUrl: currentUser.photoURL || `https://api.dicebear.com/8.x/identicon/svg?seed=${currentUser.uid}`,
        viewedAt: serverTimestamp()
      });

      batch.commit().then(() => {
        viewedStoriesInSession.current.add(currentStory.id);
      }).catch(err => console.warn("Failed to increment views", err));
    }
  }, [currentStory, currentUser, firestore, isOpen]);

  // Video Playback Logic
  useEffect(() => {
    if (currentStory?.type === 'video' && videoRef.current) {
        const video = videoRef.current;
        
        // Load and Play
        if (!isPaused && !showViews && !showComments) {
            video.play().catch(err => console.log("Playback interaction required:", err));
        } else {
            video.pause();
        }

        const handleEnded = () => {
            if (!isPaused && !showViews && !showComments) {
                nextStory();
            }
        };
        video.addEventListener('ended', handleEnded);
        return () => video.removeEventListener('ended', handleEnded);
    }
  }, [currentStory, nextStory, isPaused, showViews, showComments]);

  const likeRef = useMemo(() => (
    firestore && currentUser && currentStory ? doc(firestore, 'stories', currentStory.id, 'likes', currentUser.uid) : null
  ), [firestore, currentUser, currentStory]);
  
  const { data: likeDoc } = useDoc<StoryLike>(likeRef);
  const isLiked = !!likeDoc;
  
  const handleToggleLike = async () => {
    if (!likeRef || !firestore || !currentStory || !currentUser) return;
    const storyRef = doc(firestore, 'stories', currentStory.id);
    const batch = writeBatch(firestore);

    if (isLiked) {
      batch.delete(likeRef);
      batch.update(storyRef, { likes: increment(-1) });
    } else {
      batch.set(likeRef, { userId: currentUser.uid, likedAt: serverTimestamp() });
      batch.update(storyRef, { likes: increment(1) });
    }
    
    try {
        await batch.commit();
    } catch (e) {
        console.error("Error toggling like", e);
    }
  }
  
  const [commentText, setCommentText] = useState("");
  const [isSendingComment, setIsSendingComment] = useState(false);
  const isAuthor = currentGroup?.authorId === currentUser?.uid;

  const handleComment = async () => {
    if(!commentText.trim() || !currentUser || !firestore || !currentStory) return;
    setIsSendingComment(true);

    const storyRef = doc(firestore, 'stories', currentStory.id);
    const commentsCol = collection(firestore, 'stories', currentStory.id, 'comments');
    const batch = writeBatch(firestore);

    batch.set(doc(commentsCol), {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Pujangga Elitera',
        userAvatarUrl: currentUser.photoURL || `https://api.dicebear.com/8.x/identicon/svg?seed=${currentUser.uid}`,
        text: commentText,
        createdAt: serverTimestamp()
    });
    batch.update(storyRef, { commentCount: increment(1) });

    try {
        await batch.commit();
        setCommentText("");
        toast({ title: "Terkirim" });
    } catch (e) {
        toast({variant: 'destructive', title: "Gagal"});
    } finally {
        setIsSendingComment(false);
    }
  }

  if (!isOpen || !currentGroup || !currentStory) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="bg-black text-white border-0 p-0 m-0 w-screen h-[100dvh] max-w-none rounded-none overflow-hidden flex flex-col items-center justify-center z-[250] focus:outline-none"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => {
            e.preventDefault();
            document.body.style.pointerEvents = '';
        }}
      >
        <DialogTitle className="sr-only">Melihat Cerita {currentGroup.authorName}</DialogTitle>
        <DialogDescription className="sr-only">Mode imersif untuk melihat momen puitis dalam bentuk teks, gambar, atau video.</DialogDescription>
        
        <div className="relative w-full h-full flex items-center justify-center">
            {/* Desktop Navigation Hints */}
            <div className="absolute inset-0 hidden md:flex items-center justify-between px-10 pointer-events-none z-[270]">
                <button onClick={prevStory} className="h-14 w-14 rounded-full bg-white/10 text-white pointer-events-auto backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all">
                    <ChevronLeft className="h-8 w-8" />
                </button>
                <button onClick={nextStory} className="h-14 w-14 rounded-full bg-white/10 text-white pointer-events-auto backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all">
                    <ChevronRight className="h-8 w-8" />
                </button>
            </div>

            {/* Exit Button */}
            <button onClick={onClose} className="absolute top-10 right-6 z-[280] text-white/60 hover:text-white rounded-full h-12 w-12 flex items-center justify-center transition-colors bg-black/20 backdrop-blur-md border border-white/10">
                <X className="h-7 w-7" />
            </button>
            
            {/* Story Container */}
            <div 
                className="relative w-full md:w-[420px] h-full md:h-[90vh] md:max-h-[850px] md:rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl bg-zinc-950"
                onClick={handleContainerClick}
                onTouchStart={() => setIsPaused(true)}
                onTouchEnd={() => setIsPaused(false)}
                onMouseDown={() => setIsPaused(true)}
                onMouseUp={() => setIsPaused(false)}
            >
                {/* Progress Bars */}
                <div className="absolute top-6 left-4 right-4 flex items-center gap-1 z-[260] pt-[max(0rem,env(safe-area-inset-top))]">
                    {currentGroup.stories.map((s, i) => (
                        <div key={i} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                            {i < storyIndex ? (
                                <div className="h-full w-full bg-white"/>
                            ) : i === storyIndex ? (
                                <motion.div 
                                    className="h-full bg-white origin-left"
                                    initial={{ scaleX: 0 }}
                                    animate={(isPaused || showViews || showComments) ? { scaleX: 1 } : { scaleX: 1 }}
                                    transition={{ 
                                        duration: s.type === 'video' ? 15 : 7, 
                                        ease: 'linear' 
                                    }}
                                    key={`${authorIndex}-${i}`}
                                />
                            ) : (
                                <div className="h-full w-0 bg-white"/>
                            )}
                        </div>
                    ))}
                </div>
                
                {/* Header Profile Info */}
                <div className="absolute top-12 left-0 right-0 px-4 z-[260] flex items-center pointer-events-none">
                    <motion.div 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 bg-black/30 backdrop-blur-xl p-1.5 pr-5 rounded-full border border-white/10 pointer-events-auto shadow-xl"
                    >
                        <Avatar className="h-9 w-9 ring-2 ring-primary/30">
                            <AvatarImage src={currentGroup.authorAvatarUrl} className="object-cover" />
                            <AvatarFallback className="bg-primary text-white font-black">{currentGroup.authorName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-black text-sm text-white truncate max-w-[120px]">{currentGroup.authorName}</p>
                            <p className="text-[8px] uppercase font-black text-white/60 tracking-widest">
                                {formatDistanceToNow(currentStory.createdAt.toDate(), { locale: id, addSuffix: true })}
                            </p>
                        </div>
                    </motion.div>
                </div>

                {/* Main Content Render */}
                <div className={cn(
                    "flex-1 relative flex items-center justify-center",
                    currentStory.type === 'text' 
                        ? (currentStory.background?.includes('from-') && !currentStory.background.includes('bg-gradient')
                            ? `bg-gradient-to-br ${currentStory.background}`
                            : (currentStory.background || "bg-gradient-to-br from-indigo-600 to-rose-500"))
                        : "bg-black"
                )}>
                  {currentStory.type === 'text' && <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />}
                  
                  <AnimatePresence mode="wait">
                    <motion.div
                        key={`${currentStory.id}`}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.3 }}
                        className="w-full h-full flex flex-col items-center justify-center text-center overflow-hidden"
                    >
                        {currentStory.type === 'image' || currentStory.type === 'video' ? (
                            <div className="w-full h-full relative">
                                {currentStory.type === 'video' ? (
                                    <video 
                                        ref={videoRef}
                                        src={currentStory.mediaUrl} 
                                        className="w-full h-full object-cover" 
                                        autoPlay 
                                        playsInline 
                                        muted={false}
                                    />
                                ) : (
                                    <img src={currentStory.mediaUrl} alt="Konten Cerita" className="w-full h-full object-cover" />
                                )}
                                
                                {currentStory.content && (
                                    <div className="absolute bottom-28 left-0 right-0 p-8 bg-gradient-to-t from-black via-black/40 to-transparent">
                                        <p className="text-white text-lg font-bold drop-shadow-lg leading-relaxed">{currentStory.content}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-10 max-h-full overflow-y-auto no-scrollbar">
                                <div className="prose prose-invert prose-p:text-3xl md:prose-p:text-4xl prose-p:font-headline prose-p:font-black prose-p:leading-tight prose-p:drop-shadow-2xl prose-blockquote:border-l-4 prose-blockquote:border-white/40 prose-blockquote:pl-4 prose-blockquote:italic prose-p:m-0 max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {currentStory.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Footer Interaction Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-6 z-[260] bg-gradient-to-t from-black/90 via-black/40 to-transparent pb-[max(1.5rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
                   <div className='flex items-center gap-6 mb-5 px-2'>
                     <button 
                        onClick={handleToggleLike} 
                        className={cn(
                            "flex flex-col items-center gap-1.5 transition-all active:scale-75", 
                            isLiked ? "text-rose-500 scale-110" : "text-white/80 hover:text-white"
                        )}
                     >
                        <Heart className={cn("h-7 w-7", isLiked && "fill-current")}/> 
                        <span className="text-[10px] font-black tracking-widest">{currentStory.likes}</span>
                     </button>
                     
                     <button 
                        onClick={() => setShowComments(true)} 
                        className="flex flex-col items-center gap-1.5 text-white/80 hover:text-white transition-all active:scale-75"
                     >
                        <MessageSquare className="h-7 w-7"/> 
                        <span className="text-[10px] font-black tracking-widest">{currentStory.commentCount}</span>
                     </button>
                     
                     {isAuthor && (
                        <button 
                            onClick={() => setShowViews(true)} 
                            className="flex items-center gap-2 bg-white/10 backdrop-blur-xl px-4 py-2.5 rounded-full border border-white/10 ml-auto text-white transition-all hover:bg-white/20 active:scale-90 shadow-lg"
                        >
                            <Eye className="h-4 w-4 text-primary"/>
                            <span className="text-xs font-black tracking-widest">{currentStory.viewCount}</span>
                        </button>
                      )}
                   </div>

                    <form 
                        onSubmit={(e) => { e.preventDefault(); handleComment(); }} 
                        className='flex items-center gap-2 relative group'
                    >
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                        <Input 
                            value={commentText} 
                            onChange={(e) => setCommentText(e.target.value)} 
                            placeholder='Apresiasi karya ini...' 
                            className='relative bg-white/10 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-primary/50 h-14 rounded-2xl px-6 font-medium text-sm transition-all focus-visible:bg-white/20' 
                        />
                        <Button 
                            size="icon" 
                            className="relative h-14 w-14 rounded-2xl bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/30 transition-all active:scale-90 shrink-0" 
                            disabled={isSendingComment || !commentText.trim()}
                        >
                           {isSendingComment ? <Loader2 className="animate-spin h-5 w-5" /> : <SendIcon className="h-5 w-5" />}
                        </Button>
                    </form>
                </div>
            </div>

            {isAuthor && (
              <StoryViewersSheet 
                storyId={currentStory.id} 
                isOpen={showViews} 
                onOpenChange={setShowViews} 
                onStoryDeleted={() => {
                  setShowViews(false);
                  onClose();
                }}
              />
            )}
            <StoryCommentsSheet storyId={currentStory.id} isOpen={showComments} onOpenChange={setShowComments} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
