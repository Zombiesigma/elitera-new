'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  VideoIcon,
  PhoneOff,
  Phone,
  Clock,
  BookOpen,
  Film
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Chat, ChatMessage, User as AppUser, VideoCallSession, BookShareMessage, ReelShareMessage } from '@/lib/types';
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

  const scrollToMessage = useCallback((messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'duration-1000');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
      }, 2000);
    }
  }, []);

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
        let replyText = "";
        
        switch (replyingTo.type) {
            case 'text': replyText = replyingTo.text; break;
            case 'image': replyText = '📷 Foto'; break;
            case 'voice_note': replyText = '🎤 Pesan Suara'; break;
            case 'book_share': replyText = `📖 Karya: ${replyingTo.book.title}`; break;
            case 'reel_share': replyText = `🎥 Video: ${replyingTo.reel.caption}`; break;
            case 'video_call': replyText = '🎥 Panggilan'; break;
            default: replyText = 'Pesan'; break;
        }

        messageData.replyTo = {
          messageId: replyingTo.id,
          text: replyText,
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
      className="fixed inset-0 flex flex-col bg-background overflow-hidden z-[50]" 
      style={{ 
        height: viewportHeight,
        transform: `translateY(${viewportOffsetTop}px)`
      }}
    >
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(59,130,246,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }} />

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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex flex-col h-full w-full max-w-2xl mx-auto z-10 pt-6"
          >
            <div className="p-6 md:p-10 space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-3">
                            <MessageSquare className="h-3 w-3" /> Jaringan Sastra
                        </div>
                        <h1 className="text-3xl md:text-5xl font-headline font-black tracking-tight">Kotak <span className="text-primary italic">Pesan</span></h1>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-2xl shadow-inner">
                        <Zap className="h-6 w-6 text-primary animate-pulse" />
                    </div>
                </div>

                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                    <Input 
                        placeholder="Cari percakapan puitis..." 
                        className="relative pl-11 h-12 md:h-14 rounded-2xl bg-card border-none ring-1 ring-border focus-visible:ring-2 focus-visible:ring-primary/20 shadow-sm font-medium text-sm"
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
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    onClick={() => router.push(`/messages?chatId=${chat.id}`)} 
                                    className={cn(
                                        "flex items-center gap-4 p-4 md:p-5 w-full rounded-[2rem] transition-all hover:bg-muted/50 active:scale-[0.98]",
                                        unread > 0 && "bg-primary/5 ring-1 ring-primary/10"
                                    )}
                                >
                                    <div className="relative shrink-0">
                                        <Avatar className="h-14 w-14 md:h-16 md:w-16 border-2 border-background shadow-md">
                                            <AvatarImage src={other.photoURL} className="object-cover" />
                                            <AvatarFallback className="bg-primary/5 text-primary font-black">{other.displayName[0]}</AvatarFallback>
                                        </Avatar>
                                        {unread > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white ring-4 ring-background shadow-lg">
                                                {unread}
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <p className={cn("font-black text-sm md:text-base truncate", unread > 0 && "text-primary")}>
                                                {other.displayName}
                                            </p>
                                            {lastMsgDate && (
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                                    {formatDistanceToNow(lastMsgDate, { locale: id, addSuffix: true })}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs truncate text-muted-foreground opacity-70 italic">
                                            {chat.lastMessage?.text || "Mulai diskusi karyamu kawan..."}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground/20" />
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
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col h-full w-full max-w-3xl mx-auto bg-background md:border-x shadow-2xl relative z-20"
          >
            <header className="flex items-center h-20 md:h-24 px-4 md:px-10 border-b bg-background/80 backdrop-blur-2xl z-30 shrink-0 shadow-sm pt-[max(0.5rem,env(safe-area-inset-top))]">
                <Button variant="ghost" size="icon" onClick={handleGoBack} className="rounded-full mr-2 md:mr-6 active:scale-90 h-11 w-11">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                
                {otherParticipant ? (
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="relative">
                            <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-background shadow-lg ring-1 ring-primary/10">
                                <AvatarImage src={otherParticipant.photoURL} className="object-cover" />
                                <AvatarFallback className="bg-primary/10 text-primary font-black">{otherParticipant.displayName[0]}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 border-2 border-background rounded-full animate-pulse" />
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-black text-sm md:text-base truncate tracking-tight">{otherParticipant.displayName}</h4>
                            <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Pujangga Terhubung</p>
                        </div>
                    </div>
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

            <ScrollArea className="flex-1 bg-muted/5">
                <div className="p-6 md:p-12 space-y-6 pb-32">
                    {isLoadingMessages ? (
                        <div className="flex flex-col items-center py-20 gap-4 opacity-40">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        </div>
                    ) : (
                        messages?.map((msg, i) => {
                            const isMe = msg.senderId === currentUser.uid;
                            const prevMsg = messages[i-1];
                            const showTime = !prevMsg || (msg.createdAt?.toMillis() || 0) - (prevMsg.createdAt?.toMillis() || 0) > 300000;

                            return (
                                <div key={msg.id} id={`message-${msg.id}`} className="space-y-4">
                                    {showTime && msg.createdAt && (
                                        <div className="text-center py-8">
                                            <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] px-4 py-1 rounded-full border border-border/10 bg-muted/5">
                                                {formatDistanceToNow(msg.createdAt.toDate(), { locale: id, addSuffix: true })}
                                            </span>
                                        </div>
                                    )}
                                    <div className={cn("flex group items-center gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                                        <div className={cn(
                                            "max-w-[85%] md:max-w-[70%] shadow-sm transition-all relative overflow-hidden",
                                            isMe 
                                                ? "bg-primary text-white rounded-[1.75rem] rounded-tr-none shadow-primary/10" 
                                                : "bg-card border border-border/50 text-foreground rounded-[1.75rem] rounded-tl-none",
                                            msg.type === 'image' || msg.type === 'book_share' || msg.type === 'reel_share' ? "p-1.5" : "p-4 md:p-5"
                                        )}>
                                            {msg.replyTo && (
                                              <div 
                                                className={cn(
                                                  "mb-3 p-3 rounded-xl border-l-4 text-[11px] leading-relaxed cursor-pointer transition-colors",
                                                  isMe ? "bg-white/10 border-white/30 hover:bg-white/20" : "bg-muted/50 border-primary/30 hover:bg-muted/70"
                                                )}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (msg.replyTo?.messageId) scrollToMessage(msg.replyTo.messageId);
                                                }}
                                              >
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
                                                    className="relative rounded-[1.25rem] overflow-hidden group/image cursor-pointer active:scale-[0.98] transition-all shadow-inner"
                                                    onClick={() => setFullPreviewUrl(msg.imageUrl)}
                                                >
                                                    <img src={msg.imageUrl} alt="Media" className="max-w-full h-auto max-h-[300px] object-cover" />
                                                </div>
                                            )}

                                            {msg.type === 'book_share' && (
                                                <Link href={`/books/${msg.book.id}`} className="block group/share">
                                                    <div className={cn(
                                                        "flex gap-4 p-3 rounded-2xl border transition-all active:scale-[0.98] w-full min-w-[240px] max-w-[320px]",
                                                        isMe ? "bg-white/10 border-white/20 hover:bg-white/20" : "bg-muted/10 border-primary/10 hover:bg-muted/20"
                                                    )}>
                                                        <div className="relative h-24 w-16 rounded-lg overflow-hidden shadow-lg shrink-0 border border-white/10">
                                                            <img src={msg.book.coverUrl} className="h-full w-full object-cover transition-transform group-hover/share:scale-110" alt="" />
                                                        </div>
                                                        <div className="flex flex-col justify-center min-w-0">
                                                            <p className={cn("text-[9px] font-black uppercase tracking-widest mb-1", isMe ? "text-white/60" : "text-primary/60")}>Berbagi Mahakarya</p>
                                                            <h4 className="font-black text-sm truncate leading-tight mb-1 italic">"{msg.book.title}"</h4>
                                                            <p className="text-[10px] font-bold opacity-60 uppercase truncate">Oleh {msg.book.authorName}</p>
                                                            <div className={cn("mt-3 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest", isMe ? "text-white" : "text-primary")}>
                                                                <BookOpen className="h-3 w-3" />
                                                                <span>Baca Sekarang</span>
                                                                <ChevronRight className="h-2.5 w-2.5" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Link>
                                            )}

                                            {msg.type === 'reel_share' && (
                                                <Link href={`/reels?id=${msg.reel.id}`} className="block group/share">
                                                    <div className={cn(
                                                        "flex gap-4 p-3 rounded-2xl border transition-all active:scale-[0.98] w-full min-w-[240px] max-w-[320px]",
                                                        isMe ? "bg-white/10 border-white/20 hover:bg-white/20" : "bg-muted/10 border-primary/10 hover:bg-muted/20"
                                                    )}>
                                                        <div className="relative h-24 w-16 rounded-lg overflow-hidden shadow-lg shrink-0 border border-white/10 bg-black">
                                                            <video src={msg.reel.videoUrl} className="h-full w-full object-cover opacity-60" muted />
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <Play className="h-5 w-5 text-white/80 fill-white/20" />
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col justify-center min-w-0">
                                                            <p className={cn("text-[9px] font-black uppercase tracking-widest mb-1", isMe ? "text-white/60" : "text-indigo-500/60")}>Berbagi Momen</p>
                                                            <h4 className="font-bold text-sm truncate leading-tight mb-1 italic">"{msg.reel.caption || 'Video Elitera'}"</h4>
                                                            <p className="text-[10px] font-bold opacity-60 uppercase truncate">Oleh {msg.reel.authorName}</p>
                                                            <div className={cn("mt-3 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest", isMe ? "text-white" : "text-indigo-600")}>
                                                                <Film className="h-3 w-3" />
                                                                <span>Tonton Video</span>
                                                                <ChevronRight className="h-2.5 w-2.5" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Link>
                                            )}

                                            {msg.type === 'voice_note' && <VoiceNotePlayer audioUrl={msg.audioUrl} isMe={isMe} />}

                                            {msg.type === 'video_call' && (
                                                <div className="flex items-center gap-4 py-1 pr-2">
                                                    <div className={cn(
                                                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                                                        isMe ? "bg-white/20" : "bg-primary/10 text-primary"
                                                    )}>
                                                        {(msg.status === 'missed' || msg.status === 'rejected') ? <PhoneOff className="h-5 w-5" /> : <VideoIcon className="h-5 w-5" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-black text-[11px] uppercase tracking-widest">
                                                            {msg.status === 'missed' ? 'Tak Terjawab' : 
                                                             msg.status === 'rejected' ? 'Ditolak' :
                                                             msg.status === 'ended' ? 'Berakhir' : 'Video Call'}
                                                        </p>
                                                        {msg.status === 'ended' && msg.duration && (
                                                            <div className="flex items-center gap-1 text-[9px] font-bold opacity-60">
                                                                <Clock className="h-2.5 w-2.5" /> {msg.duration}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!isMe && msg.status === 'calling' && (
                                                        <Button 
                                                            size="sm" 
                                                            className="rounded-lg h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[9px] tracking-widest ml-4 shadow-lg animate-pulse"
                                                            onClick={() => handleAnswerCall(msg.callId)}
                                                        >
                                                            Jawab
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                            
                                            <div className={cn(
                                                "flex items-center gap-1.5 mt-2 transition-opacity duration-300",
                                                isMe ? "justify-end text-white/40" : "justify-start text-muted-foreground/40"
                                            )}>
                                                {msg.createdAt && (
                                                    <span className="text-[8px] font-black uppercase tracking-widest font-mono">
                                                        {msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                                {isMe && <CheckCheck className="h-3 w-3" />}
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={() => setReplyingTo(msg)}
                                            className="p-2 rounded-full bg-muted/30 text-muted-foreground opacity-40 hover:opacity-100 transition-all hover:bg-primary hover:text-white active:scale-90"
                                        >
                                            <Reply className={cn("h-4 w-4", !isMe && "-scale-x-100")} />
                                        </button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </div>
            </ScrollArea>

            <div className={cn(
                "p-3 md:p-8 border-t bg-background/95 backdrop-blur-2xl shrink-0 z-30 transition-all",
                isKeyboardVisible ? "pb-3" : "pb-[max(1rem,env(safe-area-inset-bottom))]"
            )}>
                <div className="max-w-4xl mx-auto">
                    <div className="relative flex flex-col gap-3">
                        <AnimatePresence>
                            {replyingTo && (
                              <motion.div 
                                initial={{ opacity: 0, y: 5 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                exit={{ opacity: 0, scale: 0.98 }} 
                                className="p-3 bg-muted/40 rounded-2xl border-l-4 border-primary flex items-start gap-3 mb-1"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-0.5">
                                    Balas @{selectedChat?.participants.find(p => p.uid === replyingTo.senderId)?.displayName || 'Pujangga'}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate italic">
                                    {replyingTo.type === 'text' ? (replyingTo as any).text : 
                                     replyingTo.type === 'image' ? '📷 Foto Terlampir' :
                                     replyingTo.type === 'voice_note' ? '🎤 Pesan Suara' :
                                     replyingTo.type === 'book_share' ? `📖 Karya: ${replyingTo.book.title}` :
                                     replyingTo.type === 'reel_share' ? `🎥 Video: ${replyingTo.reel.caption}` : 'Media Terlampir'}
                                  </p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setReplyingTo(null)} className="h-7 w-7 rounded-full text-muted-foreground hover:text-rose-500"><X className="h-4 w-4" /></Button>
                              </motion.div>
                            )}

                            {imagePreview && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-2 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-xl overflow-hidden shadow-md"><img src={imagePreview} className="h-full w-full object-cover" alt="Preview" /></div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-primary flex-1">Foto Sastra Terlampir kawan</p>
                                    <Button variant="ghost" size="icon" onClick={() => { setSelectedImage(null); setImagePreview(null); }} className="text-rose-500 rounded-full h-9 w-9"><X className="h-4 w-4" /></Button>
                                </motion.div>
                            )}

                            {audioBlob && !isRecording && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white shadow-lg"><Play className="h-4 w-4 fill-current" /></div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-primary flex-1">Rekaman Suara Siap kawan</p>
                                    <Button variant="ghost" size="icon" onClick={() => setAudioBlob(null)} className="text-rose-500 rounded-full h-9 w-9"><Trash2 className="h-4 w-4" /></Button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex items-end gap-3">
                            <div className="flex-1 relative flex items-center">
                                <div className="absolute left-2 bottom-2.5 z-10">
                                    <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="h-11 w-11 rounded-full text-muted-foreground hover:text-primary transition-all">
                                        <ImageIcon className="h-5.5 w-5.5" />
                                    </Button>
                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                                </div>

                                {isRecording ? (
                                    <div className="flex-1 h-16 bg-rose-500/5 rounded-3xl flex items-center px-6 gap-4 border border-rose-500/20">
                                        <div className="flex gap-2 items-center">
                                            <div className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                                            <span className="text-xs font-black font-mono text-rose-600">{Math.floor(recordingTime/60)}:{String(recordingTime%60).padStart(2, '0')}</span>
                                        </div>
                                        <div className="flex-1 flex gap-1 items-center justify-center opacity-40">
                                            {Array.from({length: 12}).map((_, j) => <motion.div key={j} animate={{ height: [4, 16, 4] }} transition={{ repeat: Infinity, duration: 0.5, delay: j * 0.1 }} className="w-1 bg-rose-500 rounded-full" />)}
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={stopRecording} className="text-rose-500 rounded-full h-10 w-10"><X className="h-5 w-5" /></Button>
                                    </div>
                                ) : (
                                    <Input 
                                        placeholder="Tuangkan narasi..." 
                                        value={newMessage} 
                                        onChange={(e)=>setNewMessage(e.target.value)} 
                                        onKeyDown={(e)=>e.key==='Enter'&& !e.shiftKey && handleSendMessage()} 
                                        className="h-16 pl-14 pr-14 rounded-3xl bg-muted/40 border-none focus-visible:ring-primary/20 focus-visible:bg-background transition-all shadow-inner text-base font-medium"
                                        disabled={isSending}
                                    />
                                )}

                                <div className="absolute right-2 bottom-2.5 z-10">
                                    {!newMessage && !selectedImage && !audioBlob && !isRecording ? (
                                        <Button variant="ghost" size="icon" onClick={startRecording} className="h-11 w-11 rounded-full text-muted-foreground hover:text-primary"><Mic className="h-6 w-6" /></Button>
                                    ) : isRecording ? (
                                        <Button onClick={stopRecording} className="h-11 w-11 rounded-full bg-rose-500 hover:bg-rose-600 shadow-xl"><Check className="h-6 w-6" /></Button>
                                    ) : (
                                        <Button size="icon" onClick={handleSendMessage} className="h-11 w-11 rounded-[1.25rem] shadow-xl shadow-primary/20 transition-all active:scale-[0.85] bg-primary" disabled={isSending}>
                                            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="hidden md:flex items-center justify-center gap-3 mt-6 opacity-20 select-none grayscale">
                    <Zap className="h-3 w-3 text-primary" />
                    <p className="text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground">
                        Enkripsi Sastra Aktif kawan • Elitera System v12.0
                    </p>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={!!fullPreviewUrl} onOpenChange={() => setFullPreviewUrl(null)}>
        <DialogContent className="max-w-none w-screen h-[100dvh] p-0 border-none bg-black/95 backdrop-blur-2xl z-[500] flex flex-col items-center justify-center rounded-none">
            <DialogHeader className="sr-only"><DialogTitle>Preview</DialogTitle></DialogHeader>
            <div className="absolute top-6 left-0 right-0 px-6 flex items-center justify-between z-[510] pt-[max(1.5rem,env(safe-area-inset-top))]">
                <Button variant="ghost" size="icon" className="text-white bg-black/20 rounded-full h-12 w-12" onClick={() => setFullPreviewUrl(null)}><X className="h-6 w-6" /></Button>
            </div>
            <div className="relative w-full h-full flex items-center justify-center p-4">
                {fullPreviewUrl && <motion.img initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} src={fullPreviewUrl} className="max-w-full h-auto max-h-full object-contain rounded-xl" alt="Full preview" />}
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
