'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc, increment, writeBatch, serverTimestamp, onSnapshot, addDoc, setDoc } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Loader2, 
  Send, 
  Search, 
  ArrowLeft, 
  Sparkles, 
  Zap, 
  MoreVertical,
  ChevronRight,
  CheckCheck,
  Image as ImageIcon,
  X,
  Trash2,
  Play,
  Pause,
  Reply,
  User as UserIcon,
  Video,
  Mic,
  VideoOff,
  PhoneCall,
  VideoIcon,
  PhoneOff,
  Phone,
  PhoneForwarded,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Chat, ChatMessage, User as AppUser, VideoCallSession } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { uploadFile, uploadAudio } from '@/lib/uploader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { VideoCall } from '@/components/chat/VideoCall';

function VoiceNotePlayer({ audioUrl, isMe }: { audioUrl: string; isMe: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(p || 0);
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-4 min-w-[220px] py-1">
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={togglePlay}
        className={cn(
          "h-11 w-11 rounded-full flex items-center justify-center shadow-inner shrink-0 transition-all active:scale-90",
          isMe ? "bg-white/20 hover:bg-white/30 text-white" : "bg-primary/10 text-primary hover:bg-primary/20"
        )}
      >
        {isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
      </Button>
      
      <div className="flex-1 space-y-1.5">
        <div className="flex gap-0.5 items-end h-7">
          {Array.from({length: 22}).map((_, j) => {
            const height = 25 + (Math.sin(j * 0.6) * 35 + 35) * 0.5;
            const isActive = progress > (j / 22) * 100;
            return (
              <div 
                key={j} 
                className={cn(
                  "w-1 rounded-full transition-all duration-300",
                  isMe 
                    ? (isActive ? "bg-white shadow-[0_0_8px_white]" : "bg-white/20") 
                    : (isActive ? "bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" : "bg-primary/10")
                )} 
                style={{ height: `${height}%` }} 
              />
            );
          })}
        </div>
        <div className="flex justify-between items-center px-0.5">
            <p className={cn("text-[8px] font-black uppercase tracking-[0.2em]", isMe ? "text-white/50" : "text-muted-foreground/50")}>
                Pesan Suara
            </p>
            <p className={cn("text-[9px] font-mono font-bold", isMe ? "text-white/70" : "text-primary")}>
                {formatTime(currentTime)} / {formatTime(duration)}
            </p>
        </div>
      </div>
      <audio 
        ref={audioRef} 
        src={audioUrl} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className="hidden" 
      />
    </div>
  );
}

export default function MessagesPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [viewportHeight, setViewportHeight] = useState('100dvh');
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [fullPreviewUrl, setFullPreviewUrl] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [isCaller, setIsCaller] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatIdFromUrl = searchParams.get('chatId');
  const callIdFromUrl = searchParams.get('callId');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const vv = window.visualViewport;
    const updateViewport = () => {
      setViewportHeight(`${vv.height}px`);
      setViewportOffsetTop(vv.offsetTop);
      setIsKeyboardVisible(vv.height < window.innerHeight - 150);

      if (selectedChatId) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
      }
    };

    vv.addEventListener('resize', updateViewport);
    vv.addEventListener('scroll', updateViewport);
    updateViewport();
    
    return () => {
      vv.removeEventListener('resize', updateViewport);
      vv.removeEventListener('scroll', updateViewport);
    };
  }, [selectedChatId]);

  useEffect(() => {
    if (chatIdFromUrl) setSelectedChatId(chatIdFromUrl);
    if (callIdFromUrl) {
        setActiveCallId(callIdFromUrl);
        setIsCaller(false);
    }
  }, [chatIdFromUrl, callIdFromUrl]);

  const chatThreadsQuery = useMemo(() => (
    (firestore && currentUser)
      ? query(collection(firestore, 'chats'), where('participantUids', 'array-contains', currentUser.uid))
      : null
  ), [firestore, currentUser]);
  const { data: chatThreads, isLoading: isLoadingThreads } = useCollection<Chat>(chatThreadsQuery);

  const messagesQuery = useMemo(() => (
    (firestore && currentUser && selectedChatId)
      ? query(collection(firestore, 'chats', selectedChatId, 'messages'), orderBy('createdAt', 'asc'))
      : null
  ), [firestore, currentUser, selectedChatId]);
  const { data: messages, isLoading: isLoadingMessages } = useCollection<ChatMessage>(messagesQuery);
  
  const selectedChat = useMemo(() => chatThreads?.find(c => c.id === selectedChatId), [chatThreads, selectedChatId]);
  const otherParticipant = useMemo(() => selectedChat?.participants.find(p => p.uid !== currentUser?.uid), [selectedChat, currentUser]);

  useEffect(() => {
    if (firestore && currentUser && selectedChatId && selectedChat) {
        const unreadCount = selectedChat.unreadCounts?.[currentUser.uid] || 0;
        if (unreadCount > 0) {
            updateDoc(doc(firestore, 'chats', selectedChatId), {
                [`unreadCounts.${currentUser.uid}`]: 0
            }).catch(console.error);
        }
    }
  }, [firestore, currentUser, selectedChatId, selectedChat]);

  useEffect(() => {
    if (messages && messages.length > 0) {
        const timer = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        return () => clearTimeout(timer);
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage && !audioBlob) || !currentUser || !selectedChatId || !firestore || !otherParticipant) return;
    
    setIsSending(true);
    try {
      const batch = writeBatch(firestore);
      const msgRef = doc(collection(firestore, 'chats', selectedChatId, 'messages'));
      
      let messageData: any = {
        senderId: currentUser.uid,
        createdAt: serverTimestamp(),
      };

      if (replyingTo) {
        const replySender = selectedChat?.participants.find(p => p.uid === replyingTo.senderId);
        messageData.replyTo = {
          text: replyingTo.type === 'text' ? replyingTo.text : 
                replyingTo.type === 'image' ? '📷 Foto' : 
                replyingTo.type === 'voice_note' ? '🎤 Pesan Suara' : 'Karya',
          senderName: replySender?.displayName || 'Pujangga',
          type: replyingTo.type
        };
      }

      let lastText = "";

      if (selectedImage) {
        const imageUrl = await uploadFile(selectedImage);
        messageData = { ...messageData, type: 'image', imageUrl };
        lastText = "📷 Foto";
      } 
      else if (audioBlob) {
        const audioFile = new File([audioBlob], `vn-${Date.now()}.mp3`, { type: 'audio/mpeg' });
        const audioUrl = await uploadAudio(audioFile);
        messageData = { ...messageData, type: 'voice_note', audioUrl };
        lastText = "🎤 Pesan Suara";
      }
      else {
        messageData = { ...messageData, type: 'text', text: newMessage.trim() };
        lastText = newMessage.trim();
      }
      
      batch.set(msgRef, messageData);
      batch.update(doc(firestore, 'chats', selectedChatId), {
        lastMessage: { 
            text: lastText, 
            senderId: currentUser.uid, 
            timestamp: serverTimestamp() 
        },
        [`unreadCounts.${otherParticipant.uid}`]: increment(1)
      });
      
      await batch.commit();
      
      setNewMessage("");
      setSelectedImage(null);
      setImagePreview(null);
      setAudioBlob(null);
      setReplyingTo(null);
    } catch (e) {
        toast({ variant: 'destructive', title: "Gagal Mengirim" });
    } finally { setIsSending(false); }
  };

  const handleInitiateCall = async () => {
    if (!firestore || !currentUser || !otherParticipant || !selectedChatId) return;
    
    setIsSending(true);
    try {
        const callDoc = doc(collection(firestore, 'calls'));
        const msgRef = doc(collection(firestore, 'chats', selectedChatId, 'messages'));
        
        // 1. Create Call Session
        await setDoc(callDoc, {
            callerId: currentUser.uid,
            receiverId: otherParticipant.uid,
            callerName: currentUser.displayName || 'Pujangga Elitera',
            callerPhotoURL: currentUser.photoURL || '',
            status: 'calling',
            chatId: selectedChatId,
            messageId: msgRef.id,
            createdAt: serverTimestamp()
        });

        // 2. Create Message Log in Chat
        const batch = writeBatch(firestore);
        batch.set(msgRef, {
            type: 'video_call',
            senderId: currentUser.uid,
            callId: callDoc.id,
            status: 'calling',
            createdAt: serverTimestamp(),
        });

        batch.update(doc(firestore, 'chats', selectedChatId), {
            lastMessage: {
                text: `🎥 Panggilan Video Keluar`,
                senderId: currentUser.uid,
                timestamp: serverTimestamp(),
            },
            [`unreadCounts.${otherParticipant.uid}`]: increment(1)
        });

        await batch.commit();

        setActiveCallId(callDoc.id);
        setIsCaller(true);
    } catch (error) {
        console.error("Initiate call error:", error);
        toast({ variant: 'destructive', title: "Gagal Menghubungi" });
    } finally {
        setIsSending(false);
    }
  };

  const handleAnswerCall = async (callId: string) => {
    if (!firestore || !callId) return;
    try {
        await updateDoc(doc(firestore, 'calls', callId), { status: 'accepted' });
        setActiveCallId(callId);
        setIsCaller(false);
    } catch (e) {
        toast({ variant: 'destructive', title: "Gagal Menjawab" });
    }
  };

  const handleRejectCall = async (callId: string) => {
    if (!firestore || !callId) return;
    try {
        await updateDoc(doc(firestore, 'calls', callId), { status: 'rejected' });
    } catch (e) {
        toast({ variant: 'destructive', title: "Gagal Menolak" });
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'Terlalu Besar', description: 'Maks 5MB kawan.' });
        return;
      }
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/mpeg' });
        setAudioBlob(blob);
      };
      
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      toast({ variant: 'destructive', title: "Mikrofon Ditolak" });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const filteredThreads = useMemo(() => {
    if (!chatThreads) return [];
    if (!searchTerm.trim()) return [...chatThreads].sort((a, b) => (b.lastMessage?.timestamp?.toMillis() || 0) - (a.lastMessage?.timestamp?.toMillis() || 0));
    
    return chatThreads.filter(chat => {
        const other = chat.participants.find(p => p.uid !== currentUser?.uid);
        return other?.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
               other?.username.toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a, b) => (b.lastMessage?.timestamp?.toMillis() || 0) - (a.lastMessage?.timestamp?.toMillis() || 0));
  }, [chatThreads, searchTerm, currentUser]);

  const handleGoBack = () => {
    router.push('/messages');
    setSelectedChatId(null);
    setReplyingTo(null);
  };

  const handleDeleteChat = async () => {
    if (!selectedChatId || !firestore) return;
    if (confirm("Hapus arsip ini permanen kawan?")) {
        try {
            await updateDoc(doc(firestore, 'chats', selectedChatId), {
                lastMessage: { text: "Arsip dibersihkan kawan.", timestamp: serverTimestamp(), senderId: 'system' }
            });
            toast({ title: "Arsip Dibersihkan" });
        } catch (e) {
            toast({ variant: 'destructive', title: "Gagal Menghapus" });
        }
    }
  };

  if (!currentUser) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 flex flex-col bg-background overflow-hidden z-[50]" 
      style={{ 
        height: viewportHeight,
        transform: `translateY(${viewportOffsetTop}px)`
      }}
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

      {activeCallId && (
        <VideoCall 
            callId={activeCallId} 
            isCaller={isCaller} 
            onClose={() => {
                setActiveCallId(null);
                const newParams = new URLSearchParams(searchParams.toString());
                newParams.delete('callId');
                router.replace(`/messages?${newParams.toString()}`);
            }} 
        />
      )}

      <AnimatePresence mode="wait">
        {!selectedChatId ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full w-full max-w-2xl mx-auto z-10 pt-6"
          >
            <div className="p-6 md:p-10 space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest mb-3">
                            <MessageSquare className="h-3 w-3" /> Jaringan Sastra
                        </div>
                        <h1 className="text-3xl md:text-5xl font-headline font-black tracking-tight">Kotak <span className="text-primary italic">Pesan</span></h1>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-2xl shadow-inner">
                        <Zap className="h-6 w-6 text-primary animate-pulse" />
                    </div>
                </div>

                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                    <Input 
                        placeholder="Cari percakapan puitis..." 
                        className="relative pl-11 h-12 md:h-14 rounded-2xl bg-card border-none ring-1 ring-border focus-visible:ring-2 focus-visible:ring-primary/20 shadow-inner font-medium text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 px-4 md:px-10">
                <div className="space-y-3 pb-32">
                    {isLoadingThreads ? (
                        <div className="flex flex-col items-center py-20 gap-4 opacity-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Sinkronisasi...</p>
                        </div>
                    ) : filteredThreads.length === 0 ? (
                        <div className="py-24 text-center opacity-20 flex flex-col items-center gap-4">
                            <MessageSquare className="h-16 w-16" />
                            <p className="font-black uppercase tracking-[0.3em] text-[10px]">Hening. Belum ada diskusi kawan.</p>
                        </div>
                    ) : (
                        filteredThreads.map((chat, idx) => {
                            const other = chat.participants.find(p => p.uid !== currentUser.uid);
                            if (!other) return null;
                            const unread = chat.unreadCounts?.[currentUser.uid] || 0;
                            const lastMsgDate = chat.lastMessage?.timestamp?.toDate();

                            return (
                                <motion.button 
                                    key={chat.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => router.push(`/messages?chatId=${chat.id}`)} 
                                    className={cn(
                                        "flex items-center gap-4 p-4 md:p-5 w-full rounded-[2rem] transition-all duration-300 group hover:-translate-y-0.5",
                                        unread > 0 ? "bg-primary/5 ring-1 ring-primary/20 shadow-lg shadow-primary/5" : "hover:bg-muted/50"
                                    )}
                                >
                                    <div className="relative shrink-0">
                                        <Avatar className="h-14 w-14 md:h-16 md:w-16 border-2 border-background shadow-md transition-transform group-hover:scale-105">
                                            <AvatarImage src={other.photoURL} className="object-cover" />
                                            <AvatarFallback className="bg-primary/5 text-primary font-black">{other.displayName[0]}</AvatarFallback>
                                        </Avatar>
                                        {unread > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white ring-4 ring-background animate-bounce shadow-lg">
                                                {unread > 99 ? '99+' : unread}
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <p className={cn("font-black text-sm md:text-base truncate group-hover:text-primary transition-colors", unread > 0 && "text-primary")}>
                                                {other.displayName}
                                            </p>
                                            {lastMsgDate && (
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest shrink-0">
                                                    {formatDistanceToNow(lastMsgDate, { locale: id, addSuffix: true })}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {chat.lastMessage?.senderId === currentUser.uid && (
                                                <CheckCheck className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                                            )}
                                            <p className={cn(
                                                "text-xs truncate max-w-[200px] md:max-w-[300px]",
                                                unread > 0 ? "text-foreground font-bold" : "text-muted-foreground font-medium italic opacity-60"
                                            )}>
                                                {chat.lastMessage?.text || "Mulai diskusi karyamu kawan..."}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-all group-hover:translate-x-1" />
                                </motion.button>
                            )
                        })
                    )}
                </div>
            </ScrollArea>
          </motion.div>
        ) : (
          <motion.div 
            key="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col h-full w-full max-w-3xl mx-auto bg-background md:border-x shadow-2xl relative z-20"
          >
            <header className="flex items-center h-20 md:h-24 px-4 md:px-10 border-b bg-background/80 backdrop-blur-2xl z-30 shrink-0 shadow-sm pt-[max(0.5rem,env(safe-area-inset-top))]">
                <Button variant="ghost" size="icon" onClick={handleGoBack} className="rounded-full mr-2 md:mr-6 hover:bg-primary/5 hover:text-primary transition-all active:scale-90 h-11 w-11">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                
                {otherParticipant ? (
                    <Link href={`/profile/${otherParticipant.username}`} className="flex items-center gap-4 flex-1 min-w-0 group">
                        <div className="relative">
                            <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-background shadow-2xl transition-transform group-hover:scale-110 ring-1 ring-primary/10">
                                <AvatarImage src={otherParticipant.photoURL} className="object-cover" />
                                <AvatarFallback className="bg-primary/10 text-primary font-black">{otherParticipant.displayName[0]}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 border-2 border-background rounded-full shadow-lg animate-pulse" />
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-black text-sm md:text-base truncate group-hover:text-primary transition-colors tracking-tight">{otherParticipant.displayName}</h4>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Pujangga Terhubung</p>
                            </div>
                        </div>
                    </Link>
                ) : (
                    <div className="flex-1 h-10 bg-muted animate-pulse rounded-full" />
                )}

                <div className="flex items-center gap-1.5 md:gap-3">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full h-11 w-11 text-muted-foreground hover:text-primary hover:bg-primary/5"
                        onClick={handleInitiateCall}
                        disabled={isSending}
                    >
                        {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="h-5.5 w-5.5"/>}
                    </Button>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full h-11 w-11 text-muted-foreground hover:text-primary hover:bg-primary/5">
                                <MoreVertical className="h-5 w-5"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-[1.5rem] p-2 border-none shadow-2xl">
                            <DropdownMenuItem className="rounded-xl h-11 gap-3 font-bold" asChild>
                                <Link href={`/profile/${otherParticipant?.username}`}>
                                    <UserIcon className="h-4 w-4 text-primary" /> Lihat Profil
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="my-1 opacity-50" />
                            <DropdownMenuItem className="rounded-xl h-11 gap-3 font-bold text-rose-500" onClick={handleDeleteChat}>
                                <Trash2 className="h-4 w-4" /> Bersihkan Arsip
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            <ScrollArea className="flex-1 bg-muted/[0.03] relative">
                <div className="p-6 md:p-12 space-y-10 pb-32">
                    {isLoadingMessages ? (
                        <div className="flex flex-col items-center py-20 gap-4 opacity-40">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Memuat Arus kawan...</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {messages?.map((msg, i) => {
                                const isMe = msg.senderId === currentUser.uid;
                                const prevMsg = messages[i-1];
                                const showTime = !prevMsg || (msg.createdAt?.toMillis() || 0) - (prevMsg.createdAt?.toMillis() || 0) > 300000;

                                return (
                                    <motion.div 
                                        key={msg.id} 
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-3"
                                    >
                                        {showTime && msg.createdAt && (
                                            <div className="text-center py-6">
                                                <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] px-5 py-1.5 rounded-full border border-border/10 bg-muted/10 backdrop-blur-sm">
                                                    {formatDistanceToNow(msg.createdAt.toDate(), { locale: id, addSuffix: true })}
                                                </span>
                                            </div>
                                        )}
                                        <div className={cn("flex group/msg relative", isMe ? "justify-end pl-12" : "justify-start pr-12")}>
                                            {!isMe && (
                                                <button 
                                                  onClick={() => setReplyingTo(msg)}
                                                  className={cn(
                                                    "absolute top-1/2 -translate-y-1/2 p-2 rounded-full bg-muted/50 text-muted-foreground opacity-0 group-hover/msg:opacity-100 transition-all hover:bg-primary hover:text-white active:scale-90 shadow-sm",
                                                    "-right-12"
                                                  )}
                                                >
                                                  <Reply className="h-4 w-4 -scale-x-100" />
                                                </button>
                                            )}
                                            {isMe && (
                                                <button 
                                                  onClick={() => setReplyingTo(msg)}
                                                  className={cn(
                                                    "absolute top-1/2 -translate-y-1/2 p-2 rounded-full bg-muted/50 text-muted-foreground opacity-0 group-hover/msg:opacity-100 transition-all hover:bg-primary hover:text-white active:scale-90 shadow-sm",
                                                    "-left-12"
                                                  )}
                                                >
                                                  <Reply className="h-4 w-4" />
                                                </button>
                                            )}

                                            <div className={cn(
                                                "max-w-full shadow-sm transition-all relative",
                                                isMe 
                                                    ? "bg-primary text-white rounded-[2rem] rounded-tr-none shadow-xl shadow-primary/10 ring-1 ring-white/10" 
                                                    : "bg-card border border-border/50 text-foreground rounded-[2rem] rounded-tl-none shadow-md",
                                                msg.type === 'image' ? "p-2" : "p-5 md:p-6"
                                            )}>
                                                {msg.replyTo && (
                                                  <div className={cn(
                                                    "mb-3 p-3 rounded-xl border-l-4 text-[11px] leading-relaxed",
                                                    isMe ? "bg-white/10 border-white/30" : "bg-muted/50 border-primary/30"
                                                  )}>
                                                    <div className="flex items-center gap-1.5 mb-1 opacity-60">
                                                        <Reply className="h-3 w-3" />
                                                        <p className="font-black uppercase tracking-widest">@{msg.replyTo.senderName}</p>
                                                    </div>
                                                    <p className="line-clamp-2 italic opacity-80">{msg.replyTo.text}</p>
                                                  </div>
                                                )}

                                                {msg.type === 'text' && <p className="text-sm md:text-base leading-relaxed font-medium">{msg.text}</p>}
                                                
                                                {msg.type === 'image' && (
                                                    <div 
                                                        className="relative rounded-[1.5rem] overflow-hidden group/image cursor-pointer active:scale-[0.98] transition-all shadow-inner"
                                                        onClick={() => setFullPreviewUrl(msg.imageUrl)}
                                                    >
                                                        <img src={msg.imageUrl} alt="Chat media" className="max-w-full h-auto max-h-[300px] object-cover" />
                                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                            <Search className="text-white h-6 w-6" />
                                                        </div>
                                                    </div>
                                                )}

                                                {msg.type === 'voice_note' && (
                                                    <VoiceNotePlayer audioUrl={msg.audioUrl} isMe={isMe} />
                                                )}

                                                {msg.type === 'video_call' && (
                                                    <div className="flex flex-col gap-4">
                                                        <div className="flex items-center gap-4 py-1 pr-4">
                                                            <div className={cn(
                                                                "h-12 w-12 rounded-full flex items-center justify-center shrink-0 shadow-inner",
                                                                isMe ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                                                            )}>
                                                                {(msg.status === 'missed' || msg.status === 'rejected') ? <PhoneOff className="h-6 w-6" /> : <VideoIcon className="h-6 w-6" />}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-black text-sm uppercase tracking-widest">
                                                                    {msg.status === 'missed' ? 'Panggilan Tak Terjawab' : 
                                                                     msg.status === 'rejected' ? 'Panggilan Ditolak' :
                                                                     msg.status === 'ended' ? 'Panggilan Berakhir' : 'Panggilan Video'}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    {msg.status === 'ended' && msg.duration && (
                                                                        <div className="flex items-center gap-1 text-[8px] font-black text-emerald-500 uppercase">
                                                                            <Clock className="h-2 w-2" /> {msg.duration}
                                                                        </div>
                                                                    )}
                                                                    <p className={cn("text-[9px] font-bold uppercase tracking-widest opacity-60", isMe ? "text-white" : "text-primary")}>
                                                                        {isMe ? 'Panggilan Keluar' : 'Panggilan Masuk'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {!isMe && msg.status === 'calling' && (
                                                            <div className="flex gap-2 pt-2 border-t border-border/10">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="flex-1 rounded-xl h-10 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white font-black uppercase text-[9px] tracking-widest"
                                                                    onClick={() => handleRejectCall(msg.callId)}
                                                                >
                                                                    <PhoneOff className="h-3 w-3 mr-1.5" /> Tolak
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    className="flex-1 rounded-xl h-10 bg-primary text-white font-black uppercase text-[9px] tracking-widest shadow-lg shadow-primary/20 animate-pulse"
                                                                    onClick={() => handleAnswerCall(msg.callId)}
                                                                >
                                                                    <Phone className="h-3 w-3 mr-1.5" /> Jawab
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                
                                                <div className={cn(
                                                    "flex items-center gap-2 mt-2.5 transition-opacity duration-300",
                                                    isMe ? "justify-end text-white/50" : "justify-start text-muted-foreground/50"
                                                )}>
                                                    {msg.createdAt && (
                                                        <span className="text-[8px] font-black uppercase tracking-widest font-mono">
                                                            {msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                    {isMe && <CheckCheck className="h-3 w-3" />}
                                                </div>

                                                <div className={cn(
                                                    "absolute top-0 w-5 h-5",
                                                    isMe 
                                                        ? "-right-1.5 bg-primary [clip-path:polygon(0_0,100%_0,0_100%)] shadow-xl" 
                                                        : "-left-1.5 bg-card border-l border-t border-border/50 [clip-path:polygon(0_0,100%_0,100%_100%)] shadow-md"
                                                )} />
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </div>
            </ScrollArea>

            <div className={cn(
                "p-3 md:p-10 border-t bg-background/95 backdrop-blur-2xl shrink-0 z-30 relative shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.15)] transition-all",
                isKeyboardVisible ? "pb-3" : "pb-[max(1rem,env(safe-area-inset-bottom))]"
            )}>
                <div className="max-w-4xl mx-auto relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 rounded-[2.25rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
                    
                    <div className="relative flex flex-col gap-4">
                        <AnimatePresence>
                            {replyingTo && (
                              <motion.div 
                                initial={{ opacity: 0, y: 10, height: 0 }} 
                                animate={{ opacity: 1, y: 0, height: 'auto' }} 
                                exit={{ opacity: 0, scale: 0.95, height: 0 }} 
                                className="p-4 bg-primary/5 rounded-[1.5rem] border border-primary/20 flex items-start gap-4 mb-1 relative overflow-hidden"
                              >
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Reply className="h-3 w-3 text-primary" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                                      @{selectedChat?.participants.find(p => p.uid === replyingTo.senderId)?.displayName || 'Pujangga'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate italic">
                                    {replyingTo.type === 'text' ? replyingTo.text : 
                                     replyingTo.type === 'image' ? '📷 Foto Terlampir' : 
                                     replyingTo.type === 'voice_note' ? '🎤 Pesan Suara' : 
                                     replyingTo.type === 'video_call' ? '🎥 Log Panggilan' : 'Media kawan'}
                                  </p>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => setReplyingTo(null)}
                                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-rose-500"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </motion.div>
                            )}

                            {imagePreview && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="p-2 bg-muted/50 rounded-[1.5rem] border border-primary/10 flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-xl overflow-hidden shadow-md">
                                        <img src={imagePreview} className="h-full w-full object-cover" alt="Preview" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Visi Sastra Terlampir kawan</p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => { setSelectedImage(null); setImagePreview(null); }} className="text-rose-500 rounded-full h-10 w-10">
                                        <X className="h-5 w-5" />
                                    </Button>
                                </motion.div>
                            )}

                            {audioBlob && !isRecording && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="p-4 bg-primary/5 rounded-[1.5rem] border border-primary/20 flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg"><Play className="h-4 w-4 fill-current" /></div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Rekaman Tersedia kawan</p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setAudioBlob(null)} className="text-rose-500 rounded-full h-10 w-10"><Trash2 className="h-5 w-5" /></Button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex items-end gap-4">
                            <div className="flex-1 relative flex items-center">
                                <div className="absolute left-2.5 bottom-2.5 md:bottom-3 z-10 flex items-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="h-11 w-11 rounded-full text-muted-foreground hover:text-primary active:scale-90 transition-all">
                                        <ImageIcon className="h-5.5 w-5.5" />
                                    </Button>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                                </div>

                                {isRecording ? (
                                    <div className="flex-1 h-16 md:h-20 bg-primary/5 rounded-[2.25rem] flex items-center px-6 gap-4 border border-primary/20">
                                        <div className="flex gap-1 items-center">
                                            <div className="h-3 w-3 rounded-full bg-rose-500 animate-pulse" />
                                            <span className="text-xs font-black font-mono text-primary">{Math.floor(recordingTime/60)}:{String(recordingTime%60).padStart(2, '0')}</span>
                                        </div>
                                        <div className="flex-1 flex gap-1 items-center justify-center">
                                            {Array.from({length: 24}).map((_, j) => (
                                                <motion.div 
                                                    key={j} 
                                                    animate={{ height: [4, Math.random() * 20 + 4, 4] }} 
                                                    transition={{ repeat: Infinity, duration: 0.5, delay: j * 0.05 }} 
                                                    className="w-1 bg-primary/40 rounded-full" 
                                                />
                                            ))}
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={stopRecording} className="text-rose-500 rounded-full h-10 w-10"><X className="h-5 w-5" /></Button>
                                    </div>
                                ) : (
                                    <Input 
                                        placeholder={audioBlob ? "Berikan keterangan suara..." : "Tuangkan narasi kawan..."} 
                                        value={newMessage} 
                                        onChange={(e)=>setNewMessage(e.target.value)} 
                                        onKeyDown={(e)=>e.key==='Enter'&& !e.shiftKey && handleSendMessage()} 
                                        className="h-16 md:h-20 pl-16 pr-16 rounded-[2.25rem] bg-muted/40 border-none focus-visible:ring-primary/30 focus-visible:bg-background transition-all shadow-inner text-base md:text-lg font-medium"
                                        disabled={isSending}
                                    />
                                )}

                                <div className="absolute right-2.5 bottom-2.5 md:bottom-3 z-10 flex items-center gap-2">
                                    {!newMessage && !selectedImage && !audioBlob && !isRecording ? (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={startRecording}
                                            className="h-11 w-11 rounded-full text-muted-foreground hover:text-primary active:scale-90"
                                        >
                                            <Mic className="h-6 w-6" />
                                        </Button>
                                    ) : isRecording ? (
                                        <Button 
                                            onClick={stopRecording} 
                                            className="h-11 w-11 md:h-14 md:w-14 rounded-full bg-rose-500 hover:bg-rose-600 shadow-xl"
                                        >
                                            <CheckCheck className="h-6 w-6 text-white" />
                                        </Button>
                                    ) : (
                                        <Button 
                                            size="icon" 
                                            onClick={handleSendMessage} 
                                            className="h-11 w-11 md:h-14 md:w-14 rounded-full md:rounded-[1.5rem] shadow-2xl shadow-primary/30 transition-all active:scale-[0.85] bg-primary hover:bg-primary/90" 
                                            disabled={isSending}
                                        >
                                            {isSending ? (
                                                <Loader2 className="h-6 w-6 animate-spin text-white" />
                                            ) : (
                                                <Send className="h-6 w-6 text-white" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="hidden md:flex items-center justify-center gap-6 mt-6 opacity-30 select-none grayscale">
                    <div className="flex items-center gap-3">
                        <Zap className="h-3 w-3 text-primary animate-pulse" />
                        <p className="text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground whitespace-nowrap">
                            Enkripsi Sastra Aktif kawan • Elitera System v12.0
                        </p>
                    </div>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={!!fullPreviewUrl} onOpenChange={() => setFullPreviewUrl(null)}>
        <DialogContent 
            className="max-w-none w-screen h-[100dvh] p-0 border-none bg-black/95 backdrop-blur-2xl z-[500] flex flex-col items-center justify-center rounded-none"
            onCloseAutoFocus={(e) => { e.preventDefault(); document.body.style.pointerEvents = 'auto'; }}
        >
            <DialogHeader className="sr-only">
                <DialogTitle>Pratinjau Gambar</DialogTitle>
                <DialogDescription>Melihat media dalam ukuran penuh kawan</DialogDescription>
            </DialogHeader>
            
            <div className="absolute top-6 left-0 right-0 px-6 flex items-center justify-between z-[510] pt-[max(1.5rem,env(safe-area-inset-top))]">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white hover:bg-white/10 rounded-full h-12 w-12 bg-black/20 backdrop-blur-md"
                    onClick={() => setFullPreviewUrl(null)}
                >
                    <X className="h-6 w-6" />
                </Button>
                
                <div className="flex gap-2">
                    <Button 
                        variant="ghost" 
                        className="text-white hover:bg-white/10 rounded-2xl h-12 px-6 font-black uppercase text-[10px] tracking-widest gap-2 bg-black/20 backdrop-blur-md border border-white/10"
                        onClick={() => fullPreviewUrl && (async () => {
                            try {
                                const response = await fetch(fullPreviewUrl);
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `elitera-media-${Date.now()}.jpg`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                window.URL.revokeObjectURL(url);
                                toast({ variant: 'success', title: "Gambar Disimpan" });
                            } catch (e) {
                                toast({ variant: 'destructive', title: "Gagal Mengunduh" });
                            }
                        })()}
                    >
                        <ImageIcon className="h-4 w-4" /> Simpan Gambar
                    </Button>
                </div>
            </div>

            <div className="relative w-full h-full flex items-center justify-center p-4">
                {fullPreviewUrl && (
                    <motion.img 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        src={fullPreviewUrl} 
                        className="max-w-full h-auto max-h-full object-contain shadow-2xl rounded-xl ring-1 ring-white/10" 
                        alt="Full preview" 
                    />
                )}
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
