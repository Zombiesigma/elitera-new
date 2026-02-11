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
import { Loader2, X, Sparkles, Heart, MessageSquare, Send as SendIcon, Music2, SwitchCamera, Image as ImageIcon, Trash2, ArrowLeft } from 'lucide-react';
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

type CreatorMode = 'camera' | 'preview';

export function CreateReelModal({ isOpen, onClose, currentUserProfile }: CreateReelModalProps) {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  
  const [mode, setMode] = useState<CreatorMode>('camera');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setMediaFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof reelSchema>>({
    resolver: zodResolver(reelSchema),
    defaultValues: { caption: "" },
  });

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    stopStream();
    setIsCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          aspectRatio: { ideal: 9/16 }
        },
        audio: true
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraReady(true);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Kamera Gagal',
        description: 'Harap berikan izin akses kamera dan mikrofon.',
      });
    }
  };

  useEffect(() => {
    if (isOpen && mode === 'camera') {
      startCamera();
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [isOpen, mode, facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = recorder;
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const file = new File([blob], `reel-${Date.now()}.mp4`, { type: 'video/mp4' });
      setVideoUrl(url);
      setMediaFile(file);
      setMode('preview');
    };
    
    recorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'Video Terlalu Besar', description: 'Maksimal 25MB.' });
        return;
      }
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setMediaFile(file);
      setMode('preview');
    }
  };

  const resetState = () => {
    setVideoUrl(null);
    setMediaFile(null);
    setIsSubmitting(false);
    setIsRecording(false);
    setMode('camera');
    form.reset();
  };

  useEffect(() => {
    if (!isOpen) resetState();
  }, [isOpen]);

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
        title: "Karya Diterbitkan", 
        description: "Reel Anda telah berhasil diunggah." 
      });
    } catch (error: any) {
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
        className="max-w-none w-screen h-[100dvh] p-0 border-0 m-0 bg-black overflow-hidden flex flex-col rounded-none z-[200] focus:outline-none"
        onCloseAutoFocus={(e) => { e.preventDefault(); document.body.style.pointerEvents = 'auto'; }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Editor Reels Elitera</DialogTitle>
          <DialogDescription>Review dan sesuaikan karya video Anda.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 relative overflow-hidden flex flex-col h-full">
            <AnimatePresence mode="wait">
                {mode === 'camera' && (
                    <motion.div 
                        key="camera"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        className="flex-1 bg-black relative flex flex-col h-full"
                    >
                        {/* Top Nav Camera */}
                        <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-[210] bg-gradient-to-b from-black/60 to-transparent pt-[max(1.5rem,env(safe-area-inset-top))]">
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full h-12 w-12" onClick={onClose}>
                                <X className="h-6 w-6" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full h-12 w-12" onClick={toggleCamera}>
                                <SwitchCamera className="h-6 w-6" />
                            </Button>
                        </div>

                        {!isCameraReady && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20 bg-black">
                            <Loader2 className="h-12 w-12 text-primary animate-spin" />
                            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Inisialisasi Lensa...</p>
                          </div>
                        )}
                        
                        <video 
                          ref={videoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className={cn(
                            "w-full h-full object-cover transition-transform duration-700",
                            facingMode === 'user' ? "-scale-x-100" : "scale-x-100"
                          )}
                        />
                        
                        <div className="absolute inset-0 p-8 flex flex-col justify-end pb-[max(3rem,env(safe-area-inset-bottom))] pointer-events-none">
                            <div className="flex items-center justify-between pointer-events-auto max-w-sm mx-auto w-full">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex flex-col items-center justify-center text-white active:scale-90 transition-all hover:bg-white/20"
                                >
                                    <ImageIcon className="h-6 w-6 mb-1" />
                                    <span className="text-[7px] font-black uppercase tracking-tighter">Galeri</span>
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileSelect} />

                                <button 
                                    onClick={isRecording ? stopRecording : startRecording}
                                    className={cn(
                                        "h-20 w-20 rounded-full border-4 flex items-center justify-center transition-all duration-500",
                                        isRecording ? "border-rose-500 bg-rose-500/20 scale-110 shadow-[0_0_30px_rgba(244,63,94,0.4)]" : "border-white bg-white/10 shadow-xl"
                                    )}
                                >
                                    <div className={cn(
                                        "transition-all duration-500",
                                        isRecording ? "h-8 w-8 rounded-lg bg-rose-500" : "h-14 w-14 rounded-full bg-white"
                                    )} />
                                </button>

                                <div className="w-14 h-14" /> {/* Spacer */}
                            </div>
                            
                            {isRecording && (
                                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-rose-500 text-white px-4 py-1.5 rounded-full text-xs font-black font-mono shadow-xl animate-pulse">
                                    {Math.floor(recordingTime / 60)}:{String(recordingTime % 60).padStart(2, '0')}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {mode === 'preview' && videoUrl && (
                    <motion.div 
                        key="preview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full h-full flex flex-col bg-zinc-950 overflow-hidden"
                    >
                        {/* TOP: VIDEO PREVIEW AREA */}
                        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden min-h-0">
                            <div className="relative aspect-[9/16] h-full overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
                                <video 
                                    src={videoUrl} 
                                    className="w-full h-full object-cover" 
                                    autoPlay 
                                    loop 
                                    muted 
                                    playsInline 
                                />
                                
                                {/* Live UI Overlay Simulation */}
                                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60 pointer-events-none" />
                                
                                <div className="absolute right-4 bottom-24 flex flex-col items-center gap-5 opacity-60">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"><Heart className="h-5 w-5" /></div>
                                        <span className="text-[8px] font-black text-white">0</span>
                                    </div>
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"><MessageSquare className="h-5 w-5" /></div>
                                        <span className="text-[8px] font-black text-white">0</span>
                                    </div>
                                    <div className="h-10 w-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white"><SendIcon className="h-4 w-4" /></div>
                                </div>

                                <div className="absolute bottom-6 left-6 right-16 space-y-2 pointer-events-none">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8 border border-white/30">
                                            <AvatarImage src={currentUserProfile?.photoURL} />
                                            <AvatarFallback className="bg-primary text-white text-[10px] font-black">{currentUserProfile?.displayName?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <p className="text-white font-black text-xs tracking-tight">{currentUserProfile?.displayName}</p>
                                    </div>
                                    <p className="text-white text-[10px] font-medium leading-relaxed italic drop-shadow-md line-clamp-1 opacity-80">
                                        {captionValue || "Keterangan puitis Anda..."}
                                    </p>
                                </div>
                            </div>

                            {/* Back Button Overlay */}
                            <button 
                                onClick={() => setMode('camera')}
                                className="absolute top-6 left-6 bg-black/40 hover:bg-rose-500/40 backdrop-blur-xl text-white p-3 rounded-full shadow-2xl transition-all border border-white/10 active:scale-90 z-[220]"
                                disabled={isSubmitting}
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                        </div>
                        
                        {/* BOTTOM: CAPTION & PUBLISH PANEL */}
                        <div className="w-full bg-zinc-900 border-t border-white/10 rounded-t-[2.5rem] p-6 md:p-8 space-y-6 shrink-0 relative z-[230] pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
                            <Form {...form}>
                                <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                                    <FormField 
                                        control={form.control} 
                                        name="caption" 
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <div className="flex items-center justify-between px-1">
                                                    <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Tulis Keterangan Karya</FormLabel>
                                                    <div className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/30">
                                                        {field.value.length}/500
                                                    </div>
                                                </div>
                                                <FormControl>
                                                    <textarea 
                                                        placeholder="Tuangkan jiwa karyamu di sini..." 
                                                        className="w-full min-h-[100px] md:min-h-[120px] bg-white/[0.03] border border-white/10 text-white placeholder:text-white/10 rounded-2xl p-5 text-sm font-medium focus:ring-2 focus:ring-primary/30 transition-all resize-none no-scrollbar shadow-inner leading-relaxed"
                                                        {...field}
                                                        disabled={isSubmitting}
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-[10px] font-bold text-rose-400" />
                                            </FormItem>
                                        )} 
                                    />
                                    
                                    <Button 
                                        className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20 transition-all active:scale-[0.98]" 
                                        onClick={form.handleSubmit(onSubmit)} 
                                        disabled={isSubmitting || !form.formState.isValid}
                                    >
                                        {isSubmitting ? (
                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menerbitkan...</>
                                        ) : (
                                            <><Sparkles className="mr-2 h-4 w-4" /> Terbitkan Reels</>
                                        )}
                                    </Button>
                                </form>
                            </Form>
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
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </Dialog>
  );
}
