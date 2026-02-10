'use client';

import { useMemo, useEffect } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { StoryView } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Eye, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';

interface StoryViewersSheetProps {
  storyId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function StoryViewersSheet({ storyId, isOpen, onOpenChange }: StoryViewersSheetProps) {
  const firestore = useFirestore();

  useEffect(() => {
    if (!isOpen) {
        const timer = setTimeout(() => {
            document.body.style.pointerEvents = '';
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const viewersQuery = useMemo(() => (
    firestore ? query(collection(firestore, 'stories', storyId, 'views'), orderBy('viewedAt', 'desc')) : null
  ), [firestore, storyId]);

  const { data: viewers, isLoading } = useCollection<StoryView>(viewersQuery);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[70vh] md:h-[60vh] flex flex-col rounded-t-[2.5rem] border-t-0 bg-background p-0 overflow-hidden z-[300]"
        onCloseAutoFocus={(e) => {
            e.preventDefault();
            document.body.style.pointerEvents = '';
        }}
      >
        <div className="mx-auto w-12 h-1.5 bg-muted rounded-full mt-3 shrink-0" />
        
        <SheetHeader className="px-6 pt-6 pb-4 text-left shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <Eye className="h-5 w-5 text-primary" />
            <SheetTitle className="text-xl font-headline font-bold">Penonton Cerita</SheetTitle>
          </div>
          <SheetDescription className="text-sm font-medium text-muted-foreground">
            {isLoading ? 'Memperbarui daftar...' : `${viewers?.length || 0} orang telah melihat momen ini.`}
          </SheetDescription>
        </SheetHeader>

        <Separator className="opacity-50" />

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-[10px] font-black uppercase tracking-widest">Sinkronisasi Daftar...</p>
            </div>
          ) : !viewers || viewers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-10 opacity-40">
              <div className="bg-muted p-6 rounded-full mb-4">
                <Eye className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-lg">Belum Ada Penonton</h3>
              <p className="text-sm max-w-[200px] mx-auto mt-1">Cerita Anda baru saja lahir. Tunggu sebentar lagi!</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {viewers.map((viewer) => (
                <div key={viewer.id} className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/30">
                  <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
                    <AvatarImage src={viewer.userAvatarUrl} />
                    <AvatarFallback className="bg-primary/5 text-primary font-bold">
                        {viewer.userName?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{viewer.userName}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                        <Clock className="h-3 w-3" />
                        {viewer.viewedAt ? formatDistanceToNow(viewer.viewedAt.toDate(), { locale: id, addSuffix: true }) : 'Baru saja'}
                    </div>
                  </div>
                </div>
              ))}
              <div className="h-24" />
            </div>
          )}
        </div>
      </SheetContent>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </Sheet>
  );
}