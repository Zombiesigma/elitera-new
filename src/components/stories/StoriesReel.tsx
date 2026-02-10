'use client';

import { useState, useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Sparkles } from 'lucide-react';
import { CreateStoryModal } from './CreateStoryModal';
import { StoryViewer } from './StoryViewer';
import type { Story, User as AppUser } from '@/lib/types';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StoriesReelProps {
  stories: Story[];
  isLoading: boolean;
  currentUserProfile: AppUser | null;
}

type StoryGroup = {
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  authorRole: string;
  stories: Story[];
};

export function StoriesReel({ stories, isLoading, currentUserProfile }: StoriesReelProps) {
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [viewerState, setViewerState] = useState<{ isOpen: boolean; initialAuthorId: string | null }>({
    isOpen: false,
    initialAuthorId: null,
  });

  const storyGroups = useMemo(() => {
    const groups: { [key: string]: StoryGroup } = {};
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
    return Object.values(groups).sort((a, b) => b.stories[0].createdAt.toMillis() - a.stories[0].createdAt.toMillis());
  }, [stories]);

  const openViewer = (authorId: string) => {
    setViewerState({ isOpen: true, initialAuthorId: authorId });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-4 md:gap-5 pb-6 overflow-x-auto no-scrollbar px-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
            <Skeleton className="h-16 w-16 md:h-20 md:w-20 rounded-full" />
            <Skeleton className="h-2 w-12 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <CreateStoryModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setCreateModalOpen(false)}
        currentUserProfile={currentUserProfile}
      />
      
      {viewerState.isOpen && viewerState.initialAuthorId && (
        <StoryViewer 
            stories={stories}
            initialAuthorId={viewerState.initialAuthorId}
            isOpen={viewerState.isOpen}
            onClose={() => setViewerState({ isOpen: false, initialAuthorId: null })}
        />
      )}

      <div className="flex items-center gap-4 md:gap-5 pb-6 border-b border-border/50 overflow-x-auto no-scrollbar relative px-1">
        {currentUserProfile && (
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex flex-col items-center gap-2 flex-shrink-0"
          >
            <button
              onClick={() => setCreateModalOpen(true)}
              className="w-16 h-16 md:w-20 md:w-20 rounded-full bg-primary/5 border-2 border-dashed border-primary/30 flex items-center justify-center hover:bg-primary/10 transition-all group overflow-hidden shadow-inner"
            >
              <Plus className="h-7 w-7 text-primary group-hover:scale-110 transition-transform" />
            </button>
            <p className="text-[9px] font-black uppercase tracking-widest text-primary">Buat Momen</p>
          </motion.div>
        )}

        {storyGroups.map(group => {
          const isOfficial = group.authorRole === 'penulis' || group.authorRole === 'admin';
          return (
            <motion.div key={group.authorId} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col items-center gap-2 flex-shrink-0">
              <button 
                  onClick={() => openViewer(group.authorId)} 
                  className={cn(
                    "relative w-16 h-16 md:w-20 md:h-20 p-0.5 rounded-full transition-all active:scale-90 shadow-md",
                    isOfficial ? "bg-gradient-to-tr from-primary via-accent to-indigo-500" : "bg-muted-foreground/20"
                  )}
              >
                <div className="rounded-full bg-background p-0.5 h-full w-full">
                    <Avatar className="w-full h-full border border-border/50 shadow-inner">
                        <AvatarImage src={group.authorAvatarUrl} alt={group.authorName} className="object-cover" />
                        <AvatarFallback className="bg-primary/5 text-primary font-black uppercase">
                            {group.authorName.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                </div>
                {isOfficial && (
                    <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-lg ring-1 ring-border">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                )}
              </button>
              <p className="text-[9px] font-black w-16 md:w-20 truncate text-center text-muted-foreground uppercase tracking-tighter">
                {group.authorId === currentUserProfile?.uid ? "Anda" : group.authorName.split(' ')[0]}
              </p>
            </motion.div>
          )
        })}
      </div>
    </>
  );
}
