'use client';

import { useMemo, useEffect, useState } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { StoryView } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Eye, Clock, Trash2, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface StoryViewersSheetProps {
  storyId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onStoryDeleted?: () => void;
}

export function StoryViewersSheet({ storyId, isOpen, onOpenChange, onStoryDeleted }: StoryViewersSheetProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteStory = async () => {
    if (!firestore || !storyId) return;
    
    setIsDeleting(true);
    try {
      const storyRef = doc(firestore, 'stories', storyId);
      await deleteDoc(storyRef);
      
      toast({
        variant: "success",
        title: "Momen Dihapus",
        description: "Cerita Anda telah dihapus secara permanen dari semesta Elitera."
      });
      
      onOpenChange(false);
      if (onStoryDeleted) onStoryDeleted();
    } catch (error) {
      console.error("Error deleting story:", error);
      toast({
        variant: "destructive",
        title: "Gagal Menghapus",
        description: "Terjadi kesalahan sistem. Silakan coba lagi."
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[75vh] md:h-[65vh] flex flex-col rounded-t-[2.5rem] border-t-0 bg-background p-0 overflow-hidden z-[300] shadow-[0_-20px_50px_-15px_rgba(0,0,0,0.3)]"
        onCloseAutoFocus={(e) => {
            e.preventDefault();
            document.body.style.pointerEvents = '';
        }}
      >
        <div className="mx-auto w-12 h-1.5 bg-muted rounded-full mt-3 shrink-0" />
        
        <SheetHeader className="px-6 pt-6 pb-4 text-left shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="h-5 w-5 text-primary" />
                <SheetTitle className="text-xl font-headline font-black tracking-tight">Penonton Cerita</SheetTitle>
              </div>
              <SheetDescription className="text-xs font-bold uppercase tracking-tighter text-muted-foreground truncate">
                {isLoading ? 'Memperbarui daftar...' : `${viewers?.length || 0} orang telah melihat momen ini.`}
              </SheetDescription>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="rounded-xl h-10 px-4 text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-black text-[10px] uppercase tracking-widest shrink-0 border border-rose-100"
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Trash2 className="h-3.5 w-3.5 mr-2" />}
                  Hapus Momen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl p-8 max-w-[90vw] md:max-w-md z-[350]">
                <AlertDialogHeader>
                  <div className="mx-auto bg-rose-50 p-4 rounded-2xl w-fit mb-4">
                    <AlertTriangle className="h-8 w-8 text-rose-500" />
                  </div>
                  <AlertDialogTitle className="font-headline text-2xl font-black text-center">Hapus Momen Ini?</AlertDialogTitle>
                  <AlertDialogDescription className="text-center font-medium leading-relaxed">
                    Tindakan ini permanen. Jejak puitismu akan hilang dari pandangan pembaca dan tidak dapat dipulihkan kembali.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-8 flex flex-col sm:flex-row gap-2">
                  <AlertDialogCancel className="rounded-full border-2 h-12 flex-1">Batal</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteStory}
                    className="bg-rose-500 hover:bg-rose-600 rounded-full h-12 px-8 font-black text-white shadow-xl shadow-rose-500/20 flex-1"
                  >
                    Ya, Hapus Permanen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
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
                    <AvatarImage src={viewer.userAvatarUrl} className="object-cover" />
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
