'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc, increment, writeBatch, serverTimestamp, onSnapshot, addDoc } from 'firebase/firestore';
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
  Phone,
  Video,
  ChevronRight,
  Clock,
  CheckCheck,
  Check,
  Paperclip,
  Smile,
  Mic,
  Image as ImageIcon,
  X,
  Trash2,
  Play,
  Pause,
  Volume2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Chat, ChatMessage, User as AppUser } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { uploadFile, uploadAudio } from '@/lib/uploader';

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
  
  // Media States
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatIdFromUrl = searchParams.get('chatId');

  useEffect(() => {
    setSelectedChatId(chatIdFromUrl || null);
  }, [chatIdFromUrl]);

  const chatThreadsQuery = useMemo(() => (
    (firestore && currentUser)
      ? query(collection(firestore, 'chats'), where('participantUids', 'array-contains', currentUser.uid))
      : null
  ), [firestore, currentUser]);
  const { data: chatThreads, isLoading: isLoadingThreads } = useCollection<Chat>(chatThreadsQuery);

  const messagesQuery = useMemo(() => (
    (firestore && selectedChatId)
      ? query(collection(firestore, 'chats', selectedChatId, 'messages'), orderBy('createdAt', 'asc'))
      : null
  ), [firestore, selectedChatId]);
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

      let lastText = "";

      // Handle Image
      if (selectedImage) {
        const imageUrl = await uploadFile(selectedImage);
        messageData = { ...messageData, type: 'image', imageUrl };
        lastText = "📷 Mengirim foto";
      } 
      // Handle Voice Note
      else if (audioBlob) {
        const audioFile = new File([audioBlob], `vn-${Date.now()}.mp3`, { type: 'audio/mpeg' });
        const audioUrl = await uploadAudio(audioFile);
        messageData = { ...messageData, type: 'voice_note', audioUrl };
        lastText = "🎤 Pesan suara";
      }
      // Handle Text
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
      
      // Reset States
      setNewMessage("");
      setSelectedImage(null);
      setImagePreview(null);
      setAudioBlob(null);
    } catch (e) {
        toast({ variant: 'destructive', title: "Gagal Mengirim", description: "Terjadi kendala pada jaringan imajinasi kawan." });
    } finally { setIsSending(false); }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'File Terlalu Besar', description: 'Maksimal ukuran foto adalah 5MB kawan.' });
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
      toast({ variant: 'destructive', title: "Mikrofon Ditolak", description: "Berikan akses suara untuk mengirim VN kawan." });
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

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
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
  };

  if (!currentUser) return null;

  return (
    <div className="h-[calc(100dvh-64px)] -mt-6 -mx-4 md:-mx-6 flex flex-col bg-background relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

      <AnimatePresence mode="wait">
        {!selectedChatId ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full w-full max-w-2xl mx-auto z-10"
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
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Menyinkronkan Frekuensi...</p>
                        </div>
                    ) : filteredThreads.length === 0 ? (
                        <div className="py-24 text-center opacity-20 flex flex-col items-center gap-4">
                            <MessageSquare className="h-16 w-16" />
                            <p className="font-black uppercase tracking-[0.3em] text-[10px]">Hening. Belum ada diskusi.</p>
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
                                                {chat.lastMessage?.text || "Mulai diskusi karyamu..."}
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
            className="flex flex-col h-full w-full max-w-3xl mx-auto bg-background md:border-x shadow-[0_0_80px_rgba(0,0,0,0.15)] relative z-20"
          >
            <header className="flex items-center h-24 md:h-28 px-4 md:px-10 border-b bg-background/80 backdrop-blur-2xl z-30 shrink-0 shadow-[inset_0_-1px_0_rgba(0,0,0,0.05),0_10px_30px_-10px_rgba(0,0,0,0.05)] pt-[max(1.5rem,env(safe-area-inset-top))]">
                <Button variant="ghost" size="icon" onClick={handleGoBack} className="rounded-full mr-2 md:mr-6 hover:bg-primary/5 hover:text-primary transition-all active:scale-90 h-11 w-11 shadow-inner">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                
                {otherParticipant ? (
                    <Link href={`/profile/${otherParticipant.username}`} className="flex items-center gap-4 flex-1 min-w-0 group">
                        <div className="relative">
                            <Avatar className="h-11 w-11 md:h-14 md:w-14 border-2 border-background shadow-2xl transition-transform group-hover:scale-105 ring-1 ring-primary/10">
                                <AvatarImage src={otherParticipant.photoURL} className="object-cover" />
                                <AvatarFallback className="bg-primary/10 text-primary font-black">{otherParticipant.displayName[0]}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-green-500 border-2 border-background rounded-full shadow-lg animate-pulse" />
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-black text-sm md:text-lg truncate group-hover:text-primary transition-colors tracking-tight">{otherParticipant.displayName}</h4>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Aktif Sekarang</p>
                            </div>
                        </div>
                    </Link>
                ) : (
                    <div className="flex-1 h-12 bg-muted animate-pulse rounded-full" />
                )}

                <div className="flex items-center gap-1.5 md:gap-3">
                    <Button variant="ghost" size="icon" className="rounded-2xl h-11 w-11 text-muted-foreground hover:text-primary hover:bg-primary/5 hidden sm:flex shadow-sm border border-transparent hover:border-primary/10"><Phone className="h-4.5 w-4.5"/></Button>
                    <Button variant="ghost" size="icon" className="rounded-2xl h-11 w-11 text-muted-foreground hover:text-primary hover:bg-primary/5 shadow-sm border border-transparent hover:border-primary/10"><MoreVertical className="h-4.5 w-4.5"/></Button>
                </div>
            </header>

            <ScrollArea className="flex-1 bg-muted/[0.03] relative">
                <div className="p-6 md:p-12 space-y-10 pb-32">
                    {isLoadingMessages ? (
                        <div className="flex flex-col items-center py-20 gap-4 opacity-40">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Memuat Rekaman Arus...</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {messages?.map((msg, i) => {
                                const isMe = msg.senderId === currentUser.uid;
                                const prevMsg = messages[i-1];
                                const nextMsg = messages[i+1];
                                
                                const isGroupedWithNext = nextMsg && nextMsg.senderId === msg.senderId && 
                                    (nextMsg.createdAt?.toMillis() || 0) - (msg.createdAt?.toMillis() || 0) < 60000;
                                
                                const showTime = !prevMsg || (msg.createdAt?.toMillis() || 0) - (prevMsg.createdAt?.toMillis() || 0) > 300000;

                                return (
                                    <motion.div 
                                        key={msg.id} 
                                        initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                        className={cn("space-y-3", isGroupedWithNext ? "mb-[-1.5rem]" : "mb-0")}
                                    >
                                        {showTime && msg.createdAt && (
                                            <div className="text-center py-6">
                                                <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.3em] px-5 py-1.5 rounded-full border border-border/10 bg-muted/10 backdrop-blur-sm">
                                                    {formatDistanceToNow(msg.createdAt.toDate(), { locale: id, addSuffix: true })}
                                                </span>
                                            </div>
                                        )}
                                        <div className={cn("flex group/msg relative", isMe ? "justify-end pl-12" : "justify-start pr-12")}>
                                            <div className={cn(
                                                "max-w-full shadow-sm transition-all relative group/bubble",
                                                isMe 
                                                    ? "bg-primary text-white rounded-[2rem] rounded-tr-none shadow-xl shadow-primary/10 ring-1 ring-white/10" 
                                                    : "bg-card border border-border/50 text-foreground rounded-[2rem] rounded-tl-none shadow-md",
                                                msg.type === 'image' ? "p-2" : "p-5 md:p-6"
                                            )}>
                                                {msg.type === 'text' && <p className="text-sm md:text-base leading-relaxed font-medium selection:bg-white/20">{msg.text}</p>}
                                                
                                                {msg.type === 'image' && (
                                                    <div className="relative rounded-[1.5rem] overflow-hidden group/image">
                                                        <img src={msg.imageUrl} alt="Chat media" className="max-w-full h-auto max-h-[300px] object-cover" />
                                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/image:opacity-100 transition-opacity" />
                                                    </div>
                                                )}

                                                {msg.type === 'voice_note' && (
                                                    <div className="flex items-center gap-4 min-w-[200px]">
                                                        <div className={cn(
                                                            "h-10 w-10 rounded-full flex items-center justify-center shadow-inner",
                                                            isMe ? "bg-white/20" : "bg-primary/10 text-primary"
                                                        )}>
                                                            <Play className="h-4 w-4 fill-current" />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex gap-0.5 items-end h-4">
                                                                {Array.from({length: 12}).map((_, j) => (
                                                                    <div key={j} className={cn("w-1 rounded-full", isMe ? "bg-white/40" : "bg-primary/20")} style={{ height: `${Math.random() * 100}%` }} />
                                                                ))}
                                                            </div>
                                                            <p className={cn("text-[8px] font-black uppercase tracking-widest opacity-60", isMe ? "text-white" : "text-muted-foreground")}>Voice Note • Recording</p>
                                                        </div>
                                                        <audio src={msg.audioUrl} className="hidden" />
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
                    <div ref={messagesEndRef} className="h-12" />
                </div>
            </ScrollArea>

            <div className="p-3 md:p-10 border-t bg-background/95 backdrop-blur-2xl shrink-0 z-30 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.15)] relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                
                <div className="max-w-4xl mx-auto relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 rounded-[2.5rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 animate-pulse" />
                    
                    <div className="relative flex flex-col gap-4">
                        {/* Pre-send Previews */}
                        <AnimatePresence>
                            {imagePreview && (
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="p-2 bg-muted/50 rounded-[1.5rem] border border-primary/10 flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-xl overflow-hidden shadow-md">
                                        <img src={imagePreview} className="h-full w-full object-cover" alt="Preview" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Visi Sastra Terlampir</p>
                                        <p className="text-xs font-medium text-muted-foreground">Siap dipublikasikan dalam diskusi kawan.</p>
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
                                        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Rekaman Gema Tersedia</p>
                                        <p className="text-xs font-medium text-muted-foreground">Suara kawan tersimpan di memori kawan.</p>
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setAudioBlob(null)} className="text-rose-500 rounded-full h-10 w-10">
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="flex items-end gap-4">
                            <div className="flex-1 relative flex items-center">
                                {/* Accessory Console: Left */}
                                <div className="absolute left-2.5 bottom-2.5 md:bottom-3 z-10 flex items-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="h-11 w-11 rounded-2xl text-muted-foreground hover:text-primary hover:bg-primary/5 active:scale-90 transition-all border border-transparent hover:border-primary/10">
                                        <ImageIcon className="h-5 w-5" />
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
                                        <Button variant="ghost" size="icon" onClick={cancelRecording} className="text-rose-500 rounded-full h-10 w-10"><X className="h-5 w-5" /></Button>
                                    </div>
                                ) : (
                                    <Input 
                                        placeholder={audioBlob ? "Berikan keterangan suara..." : "Tuangkan narasi kawan..."} 
                                        value={newMessage} 
                                        onChange={(e)=>setNewMessage(e.target.value)} 
                                        onKeyDown={(e)=>e.key==='Enter'&& !e.shiftKey && handleSendMessage()} 
                                        className="h-16 md:h-20 pl-16 pr-16 rounded-[2.25rem] bg-muted/40 border-none focus-visible:ring-primary/30 focus-visible:bg-background transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] text-base md:text-lg font-medium"
                                        disabled={isSending}
                                    />
                                )}

                                {/* Accessory Console: Right */}
                                <div className="absolute right-2.5 bottom-2.5 md:bottom-3 z-10 flex items-center gap-2">
                                    {!newMessage && !selectedImage && !audioBlob && !isRecording ? (
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={startRecording}
                                            className="h-11 w-11 rounded-2xl text-muted-foreground hover:text-primary active:scale-90"
                                        >
                                            <Mic className="h-5.5 w-5.5" />
                                        </Button>
                                    ) : isRecording ? (
                                        <Button 
                                            onClick={stopRecording} 
                                            className="h-11 w-11 md:h-14 md:w-14 rounded-2xl bg-rose-500 hover:bg-rose-600 shadow-xl"
                                        >
                                            <Check className="h-6 w-6 text-white" />
                                        </Button>
                                    ) : (
                                        <Button 
                                            size="icon" 
                                            onClick={handleSendMessage} 
                                            className="h-11 w-11 md:h-14 md:w-14 rounded-2xl md:rounded-[1.5rem] shadow-2xl shadow-primary/30 transition-all active:scale-[0.85] bg-primary hover:bg-primary/90 group/send" 
                                            disabled={isSending}
                                        >
                                            {isSending ? (
                                                <Loader2 className="h-6 w-6 animate-spin text-white" />
                                            ) : (
                                                <Send className="h-6 w-6 text-white group-hover/send:translate-x-1 group-hover/send:-translate-y-1 transition-transform" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="hidden md:flex items-center justify-center gap-6 mt-6 opacity-30 select-none grayscale">
                    <div className="h-[1px] bg-gradient-to-r from-transparent to-border flex-1" />
                    <div className="flex items-center gap-3">
                        <Zap className="h-3 w-3 text-primary animate-pulse" />
                        <p className="text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground whitespace-nowrap">
                            Enkripsi Sastra Aktif • Elitera System v5.5
                        </p>
                    </div>
                    <div className="h-[1px] bg-gradient-to-l from-transparent to-border flex-1" />
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
