'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X, Sparkles, Video, Film, Trash2, Heart, MessageSquare, Send as SendIcon, Music2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { User as AppUser } from '@/lib/types';
import { uploadVideo } from '@/lib/uploader';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const reelSchema = z.object({
  caption: z.string().max(500, "Caption maksimal 500 karakter.").min(1, "Berikan sedikit deskripsi pada karya Anda."),
});

interface CreateReelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: AppUser | null;
}

export function CreateReelModal({ isOpen, onClose, currentUserProfile }: CreateReelModalProps) {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const videoInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof reelSchema>>({
    resolver: zodResolver(reelSchema),
    defaultValues: { caption: "" },
  });

  const resetState = () => {
    setVideoUrl(null);
    setVideoFile(null);
    setIsSubmitting(false);
    form.reset();
  };

  useEffect(() => {
    if (!isOpen) resetState();
  }, [isOpen]);

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast({ 
          variant: 'destructive', 
          title: 'Video Terlalu Besar', 
          description: 'Maksimal ukuran video adalah 20MB untuk menjaga kualitas akses.' 
        });
        return;
      }
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setVideoFile(file);
    }
  };

  async function onSubmit(values: z.infer<typeof reelSchema>) {
    if (!firestore || !currentUser || !currentUserProfile || !videoFile) return;
    setIsSubmitting(true);
    
    try {
      const permanentVideoUrl = await uploadVideo(videoFile);

      await addDoc(collection(firestore, 'reels'), {
        authorId: currentUser.uid,
        authorName: currentUserProfile.displayName,
        authorUsername: currentUserProfile.username,
        authorAvatarUrl: currentUserProfile.photoURL,
        authorRole: currentUserProfile.role,
        caption: values.caption,
        videoUrl: permanentVideoUrl,
        likes: 0,
        commentCount: 0,
        viewCount: 0,
        createdAt: serverTimestamp(),
      });
      
      onClose();
      toast({ 
        variant: 'success', 
        title: "Reel Berhasil Diterbitkan", 
        description: "Karya video Anda kini dapat dinikmati oleh seluruh komunitas Elitera." 
      });
    } catch (error: any) {
      console.error("[Reel Upload Error]", error);
      toast({ 
        variant: 'destructive', 
        title: 'Gagal Menerbitkan', 
        description: error.message || 'Terjadi kendala saat mengunggah video.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const captionValue = form.watch('caption');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent 
        className="max-w-none w-screen h-screen p-0 border-0 m-0 bg-black overflow-hidden flex flex-col rounded-none z-[200] focus:outline-none"
        onCloseAutoFocus={(e) => { e.preventDefault(); document.body.style.pointerEvents = ''; }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Penyunting Reel</DialogTitle>
          <DialogDescription>Tambahkan caption dan lihat pratinjau live karya Anda.</DialogDescription>
        </DialogHeader>

        {/* Floating Top Nav */}
        <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-[210] bg-gradient-to-b from-black/80 to-transparent pt-[max(1.5rem,env(safe-area-inset-top))]">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/10 rounded-full h-12 w-12 transition-all" 
            onClick={onClose} 
            disabled={isSubmitting}
          >
            <X className="h-6 w-6" />
          </Button>
          
          <div className="flex items-center gap-3">
             {videoUrl && (
                <Button 
                    className="bg-primary text-white hover:bg-primary/90 rounded-full px-8 h-12 font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl transition-all active:scale-95 disabled:opacity-50" 
                    onClick={form.handleSubmit(onSubmit)} 
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menerbitkan...</>
                    ) : (
                        <><Sparkles className="mr-2 h-4 w-4" /> Terbitkan</>
                    )}
                </Button>
             )}
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
                {!videoUrl ? (
                    <motion.div 
                        key="choice"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        className="flex flex-col items-center gap-8 px-8"
                    >
                        <div className="p-10 rounded-[3.5rem] bg-white/5 border border-white/10 shadow-2xl relative">
                            <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full animate-pulse" />
                            <Film className="h-20 w-20 text-primary relative z-10" />
                        </div>
                        <div className="text-center space-y-3 mb-4">
                            <h2 className="text-white text-4xl font-headline font-black tracking-tight uppercase">Pilih <span className="text-primary italic">Karya.</span></h2>
                            <p className="text-white/40 text-sm font-medium max-w-xs mx-auto">Bagikan proses kreatif atau hasil akhir rekaman Anda di panggung Reels.</p>
                        </div>
                        <Button 
                            size="lg" 
                            className="h-16 rounded-2xl px-10 font-black text-lg gap-4 shadow-xl shadow-primary/20 transition-all active:scale-95"
                            onClick={() => videoInputRef.current?.click()}
                        >
                            <Video className="h-6 w-6" /> Pilih Video
                        </Button>
                        <input type="file" ref={videoInputRef} className="hidden" accept="video/*" onChange={handleVideoSelect} />
                    </motion.div>
                ) : (
                    <motion.div 
                        key="preview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full h-full flex flex-col md:flex-row bg-black"
                    >
                        {/* LEFT: LIVE PREVIEW SIMULATION */}
                        <div className="flex-1 relative bg-zinc-950 flex items-center justify-center overflow-hidden border-r border-white/5">
                            <div className="relative aspect-[9/16] h-full max-h-[85vh] shadow-[0_0_100px_rgba(0,0,0,0.5)] md:rounded-[2.5rem] overflow-hidden group/live">
                                <video 
                                    src={videoUrl} 
                                    className="w-full h-full object-cover" 
                                    autoPlay 
                                    loop 
                                    muted 
                                    playsInline 
                                />
                                
                                {/* UI OVERLAY SIMULATION */}
                                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80 pointer-events-none" />
                                
                                {/* Right Sidebar Dummy */}
                                <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6 z-10 opacity-60">
                                    <div className="flex flex-col items-center gap-1.5">
                                        <div className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"><Heart className="h-6 w-6" /></div>
                                        <span className="text-[10px] font-black text-white">0</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-1.5">
                                        <div className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"><MessageSquare className="h-6 w-6" /></div>
                                        <span className="text-[10px] font-black text-white">0</span>
                                    </div>
                                    <div className="h-12 w-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"><SendIcon className="h-5 w-5" /></div>
                                </div>

                                {/* Bottom Info Dummy */}
                                <div className="absolute bottom-0 left-0 right-0 p-6 pb-10 space-y-4 z-10">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border-2 border-white/30">
                                            <AvatarImage src={currentUserProfile?.photoURL} />
                                            <AvatarFallback className="bg-primary text-white font-black">{currentUserProfile?.displayName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <p className="text-white font-black text-sm">{currentUserProfile?.displayName}</p>
                                    </div>
                                    <p className="text-white text-xs font-medium leading-relaxed italic drop-shadow-md line-clamp-2 max-w-[85%]">
                                        {captionValue || "Tuliskan pesan puitis Anda..."}
                                    </p>
                                    <div className="flex items-center gap-2 text-white/40">
                                        <Music2 className="h-3 w-3" />
                                        <p className="text-[9px] font-black uppercase tracking-widest">Suara Asli - {currentUserProfile?.displayName}</p>
                                    </div>
                                </div>

                                {/* Live Badge */}
                                <div className="absolute top-6 left-6 z-20">
                                    <div className="bg-primary/80 backdrop-blur-md text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.2em] shadow-lg flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                        Pratinjau Langsung
                                    </div>
                                </div>
                            </div>
                            
                            {/* Re-select Button */}
                            <button 
                                onClick={() => setVideoUrl(null)}
                                className="absolute bottom-10 left-10 bg-rose-500/20 hover:bg-rose-500 backdrop-blur-xl text-white p-4 rounded-2xl shadow-xl transition-all border border-rose-500/30 group z-[220]"
                                disabled={isSubmitting}
                            >
                                <Trash2 className="h-5 w-5 transition-transform group-hover:scale-110" />
                            </button>
                        </div>
                        
                        {/* RIGHT: EDITOR PANEL */}
                        <div className="w-full md:w-[400px] lg:w-[450px] p-8 md:p-12 bg-zinc-900 border-l border-white/5 flex flex-col gap-10 pt-24 md:pt-32 shrink-0 overflow-y-auto custom-scrollbar">
                            <div className="space-y-2">
                                <h3 className="text-white text-2xl font-headline font-black tracking-tight">Sempurnakan <span className="text-primary italic">Narasimu.</span></h3>
                                <p className="text-white/40 text-sm font-medium">Caption ini akan menjadi jiwa dari video Anda.</p>
                            </div>

                            <Form {...form}>
                                <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
                                    <FormField 
                                        control={form.control} 
                                        name="caption" 
                                        render={({ field }) => (
                                            <FormItem className="space-y-4">
                                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Deskripsi Karya</FormLabel>
                                                <FormControl>
                                                    <div className="relative group">
                                                        <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-accent/30 rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition-all duration-500" />
                                                        <textarea 
                                                            placeholder="Tuangkan inspirasi Anda di sini..." 
                                                            className="relative w-full min-h-[200px] bg-white/[0.03] border-white/10 text-white placeholder:text-white/10 rounded-[2rem] p-8 text-base font-medium focus:ring-2 focus:ring-primary/30 focus:bg-white/[0.06] transition-all resize-none no-scrollbar shadow-inner leading-relaxed"
                                                            {...field}
                                                            disabled={isSubmitting}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <div className="flex justify-between items-center px-2">
                                                    <FormMessage className="text-[10px] font-bold text-rose-400" />
                                                    <div className={cn(
                                                        "text-[9px] font-black px-3 py-1 rounded-full border transition-all",
                                                        field.value.length > 450 
                                                            ? "bg-rose-500/10 border-rose-500/20 text-rose-400" 
                                                            : "bg-white/5 border-white/10 text-white/30"
                                                    )}>
                                                        {field.value.length} / 500
                                                    </div>
                                                </div>
                                            </FormItem>
                                        )} 
                                    />
                                </form>
                            </Form>
                            
                            <div className="mt-auto space-y-6">
                                <div className="p-6 rounded-[2rem] bg-white/[0.03] border border-white/10 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform"><Sparkles className="h-12 w-12 text-primary" /></div>
                                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3">Tips Pujangga</p>
                                    <p className="text-xs text-white/50 leading-relaxed font-medium italic">
                                        "Gunakan baris pertama untuk menarik perhatian, dan biarkan baris selanjutnya mengalirkan emosi karya Anda."
                                    </p>
                                </div>
                                
                                <div className="flex items-center gap-4 px-2 opacity-20 grayscale">
                                    <div className="h-px bg-white flex-1" />
                                    <span className="text-[8px] font-black uppercase tracking-[0.4em]">Elitera Reels v2.0</span>
                                    <div className="h-px bg-white flex-1" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
      </DialogContent>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </Dialog>
  );
}
