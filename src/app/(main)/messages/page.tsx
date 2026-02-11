'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc, increment, documentId, writeBatch, serverTimestamp, addDoc } from 'firebase/firestore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  MessageSquare, 
  Loader2, 
  Send, 
  Search, 
  ArrowLeft, 
  ChevronRight, 
  Sparkles, 
  Zap, 
  Plus, 
  Info, 
  Clapperboard, 
  Play, 
  Camera, 
  Mic, 
  Square, 
  Trash2, 
  Image as ImageIcon, 
  Reply, 
  X,
  MoreVertical,
  Download,
  Copy,
  ExternalLink
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import type { Chat, ChatMessage, User as AppUser } from '@/lib/types';
import { isSameDay, format, isToday, isYesterday } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { uploadFile, uploadAudio } from '@/lib/uploader';
import { useToast } from '@/hooks/use-toast';

export default function MessagesPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState('100%');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [onlineStatus, setOnlineStatus] = useState<{ [key: string]: boolean }>({});

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard awareness logic
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(`${window.visualViewport.height}px`);
        scrollToBottom();
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  const chatThreadsQuery = useMemo(() => (
    (firestore && currentUser)
      ? query(collection(firestore, 'chats'), where('participantUids', 'array-contains', currentUser.uid))
      : null
  ), [firestore, currentUser]);
  const { data: chatThreads, isLoading: isLoadingThreads } = useCollection<Chat>(chatThreadsQuery);

  const otherParticipantUids = useMemo(() => {
      if (!chatThreads || !currentUser) return [];
      const uids = new Set<string>();
      chatThreads.forEach(chat => {
          chat.participantUids.forEach(uid => {
              if (uid !== currentUser.uid) uids.add(uid);
          });
      });
      return Array.from(uids);
  }, [chatThreads, currentUser]);

  const usersQuery = useMemo(() => {
      if (!firestore || otherParticipantUids.length === 0) return null;
      return query(collection(firestore, 'users'), where(documentId(), 'in', otherParticipantUids.slice(0, 30)));
  }, [firestore, otherParticipantUids]);
  const { data: participantProfiles } = useCollection<AppUser>(usersQuery);

  const profilesMap = useMemo(() => {
      if (!participantProfiles) return new Map<string, AppUser>();
      return new Map(participantProfiles.map(p => [p.id, p]));
  }, [participantProfiles]);

  useEffect(() => {
    if (profilesMap.size === 0) return;
    const checkStatuses = () => {
        const newStatus: { [key: string]: boolean } = {};
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;
        profilesMap.forEach((profile, uid) => {
            let lastSeenMillis = 0;
            if (profile.lastSeen && typeof (profile.lastSeen as any).toMillis === 'function') {
                lastSeenMillis = (profile.lastSeen as any).toMillis();
            } else if (profile.lastSeen instanceof Date) {
                lastSeenMillis = profile.lastSeen.getTime();
            }
            newStatus[uid] = profile.status === 'online' && lastSeenMillis > fiveMinutesAgo;
        });
        setOnlineStatus(newStatus);
    };
    checkStatuses();
    const interval = setInterval(checkStatuses, 60000); 
    return () => clearInterval(interval);
  }, [profilesMap]);

  useEffect(() => {
    if (!firestore || !currentUser?.uid || !selectedChatId || !chatThreads) return;
    const selectedChatData = chatThreads.find(c => c.id === selectedChatId);
    if (selectedChatData?.unreadCounts?.[currentUser.uid] > 0) {
      updateDoc(doc(firestore, 'chats', selectedChatId), {
        [`unreadCounts.${currentUser.uid}`]: 0
      }).catch(err => console.warn(err));
    }
  }, [selectedChatId, currentUser?.uid, firestore, chatThreads]);

  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chatId');
    setSelectedChatId(chatIdFromUrl || null);
    setReplyingTo(null);
  }, [searchParams]);

  const messagesQuery = useMemo(() => (
    (firestore && selectedChatId)
      ? query(collection(firestore, 'chats', selectedChatId, 'messages'), orderBy('createdAt', 'asc'))
      : null
  ), [firestore, selectedChatId]);
  const { data: messages, isLoading: isLoadingMessages } = useCollection<ChatMessage>(messagesQuery);
  
  const messageGroups = useMemo(() => {
    if (!messages) return [];
    type MessageGroupItem = ChatMessage | { type: 'date_marker', id: string, date: Date };
    const grouped: MessageGroupItem[] = [];
    messages.forEach((msg, index) => {
        if (!msg.createdAt || typeof (msg.createdAt as any).toDate !== 'function') return; 
        const msgDate = (msg.createdAt as any).toDate();
        const prevMsgDate = index > 0 && messages[index - 1].createdAt && typeof (messages[index - 1].createdAt as any).toDate === 'function' 
            ? (messages[index - 1].createdAt as any).toDate() : null;
        if (index === 0 || (prevMsgDate && !isSameDay(prevMsgDate, msgDate))) {
            grouped.push({ type: 'date_marker', id: `date-${msgDate.toISOString()}`, date: msgDate });
        }
        grouped.push(msg);
    });
    return grouped;
  }, [messages]);

  const selectedChat = useMemo(() => chatThreads?.find(chat => chat.id === selectedChatId), [chatThreads, selectedChatId]);
  const otherParticipant = useMemo(() => selectedChat?.participants.find(p => p.uid !== currentUser?.uid), [selectedChat, currentUser]);
  const isOtherParticipantOnline = otherParticipant ? onlineStatus[otherParticipant.uid] : false;

  const scrollToBottom = () => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  useEffect(() => { scrollToBottom(); }, [messageGroups]);

  useEffect(() => {
      if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`; 
      }
  }, [newMessage]);
  
  const handleSelectChat = (chatId: string) => {
    router.push(`/messages?chatId=${chatId}`, { scroll: false });
  }
  
  const handleGoBack = () => {
    router.push('/messages', { scroll: false });
  };

  const handleSendMessage = async (e?: any) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !currentUser || !selectedChatId || !firestore || !otherParticipant) return;
    const textToSend = newMessage.trim();
    const replyData = replyingTo ? {
        text: replyingTo.type === 'text' ? replyingTo.text : replyingTo.type === 'image' ? '📷 Gambar' : replyingTo.type === 'voice_note' ? '🎤 Pesan Suara' : '📦 Konten Shared',
        senderName: replyingTo.senderId === currentUser.uid ? 'Anda' : otherParticipant.displayName,
        type: replyingTo.type
    } : null;

    setNewMessage(""); 
    setReplyingTo(null);
    setIsSending(true);
    try {
      const batch = writeBatch(firestore);
      batch.set(doc(collection(firestore, 'chats', selectedChatId, 'messages')), {
        type: 'text', 
        text: textToSend, 
        senderId: currentUser.uid, 
        createdAt: serverTimestamp(),
        ...(replyData && { replyTo: replyData })
      });
      batch.update(doc(firestore, 'chats', selectedChatId), {
        lastMessage: { text: textToSend, senderId: currentUser.uid, timestamp: serverTimestamp() },
        [`unreadCounts.${otherParticipant.uid}`]: increment(1)
      });
      await batch.commit();
    } catch (error) {
      setNewMessage(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser || !selectedChatId || !firestore || !otherParticipant) return;
    
    setIsSending(true);
    try {
      const imageUrl = await uploadFile(file);
      const batch = writeBatch(firestore);
      batch.set(doc(collection(firestore, 'chats', selectedChatId, 'messages')), {
        type: 'image', imageUrl, senderId: currentUser.uid, createdAt: serverTimestamp(),
      });
      batch.update(doc(firestore, 'chats', selectedChatId), {
        lastMessage: { text: "📷 Mengirim Gambar", senderId: currentUser.uid, timestamp: serverTimestamp() },
        [`unreadCounts.${otherParticipant.uid}`]: increment(1)
      });
      await batch.commit();
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Gagal Mengirim Gambar", description: error.message });
    } finally {
      setIsSending(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size < 1000) return;

        const audioFile = new File([audioBlob], `vn-${Date.now()}.webm`, { type: 'audio/webm' });
        
        setIsSending(true);
        try {
          const audioUrl = await uploadAudio(audioFile);
          const batch = writeBatch(firestore);
          batch.set(doc(collection(firestore, 'chats', selectedChatId!, 'messages')), {
            type: 'voice_note', audioUrl, senderId: currentUser!.uid, createdAt: serverTimestamp(),
          });
          batch.update(doc(firestore, 'chats', selectedChatId!), {
            lastMessage: { text: "🎤 Pesan Suara", senderId: currentUser!.uid, timestamp: serverTimestamp() },
            [`unreadCounts.${otherParticipant!.uid}`]: increment(1)
          });
          await batch.commit();
        } catch (err: any) {
          toast({ variant: 'destructive', title: 'Gagal Mengirim VN', description: err.message });
        } finally {
          setIsSending(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Izin Mikrofon Ditolak', description: 'Harap aktifkan mikrofon untuk merekam.' });
    }
  };

  const stopRecording = (cancel = false) => {
    if (mediaRecorderRef.current && isRecording) {
      if (cancel) audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    }
  };

  const sortedAndFilteredChatThreads = useMemo(() => {
    if (!chatThreads) return [];
    let threads = chatThreads.filter(chat => {
        if (!searchQuery.trim()) return true;
        const otherP = chat.participants.find(p => p.uid !== currentUser?.uid);
        return otherP?.displayName.toLowerCase().includes(searchQuery.toLowerCase());
    });
    return [...threads].sort((a, b) => {
        const timeA = (a.lastMessage?.timestamp as any)?.toMillis() || 0;
        const timeB = (b.lastMessage?.timestamp as any)?.toMillis() || 0;
        return timeB - timeA;
    });
  }, [chatThreads, searchQuery, currentUser?.uid]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ variant: 'success', title: "Tautan Disalin", description: "Tautan gambar telah disimpan ke clipboard Anda." });
  };

  return (
    <div className="h-[calc(100dvh-64px)] md:h-[calc(100vh-64px)] -mt-6 -mx-4 md:-mx-6 border-none overflow-hidden flex flex-col bg-background relative" style={{ height: viewportHeight }}>
      <div className="grid grid-cols-12 flex-1 h-full overflow-hidden">
        
        {/* Sidebar: Chat List */}
        <div className={cn(
          "col-span-12 md:col-span-4 lg:col-span-3 border-r h-full flex flex-col bg-muted/10 overflow-hidden relative transition-all duration-500",
          selectedChatId ? "hidden md:flex" : "flex"
        )}>
          {/* Header Sidebar */}
          <div className="p-6 border-b shrink-0 bg-background/50 backdrop-blur-md z-20">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20">
                        <MessageSquare className="h-5 w-5" />
                    </div>
                    <h1 className="text-2xl font-headline font-black tracking-tight uppercase italic">Pesan</h1>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/5 text-primary">
                    <Plus className="h-5 w-5" />
                </Button>
            </div>
            
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input 
                    placeholder="Cari teman..." 
                    className="pl-11 h-12 bg-muted/30 border-none rounded-2xl focus-visible:ring-primary/20 transition-all shadow-inner font-medium" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
          </div>

          {/* List Obrolan */}
          <div className="flex-1 overflow-hidden relative">
            <ScrollArea className="h-full">
                <div className="flex flex-col p-3 gap-2 pb-24">
                {isLoadingThreads ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Menyambungkan Sinyal...</p>
                    </div>
                ) : sortedAndFilteredChatThreads.length === 0 ? (
                    <div className="text-center py-20 px-6 opacity-30 flex flex-col items-center gap-4">
                        <div className="p-6 rounded-full bg-primary/5"><Zap className="h-12 w-12 text-primary" /></div>
                        <p className="text-sm font-bold leading-relaxed max-w-[180px]">Belum ada jejak percakapan puitis.</p>
                    </div>
                ) : sortedAndFilteredChatThreads.map((chat, idx) => {
                    const otherP = chat.participants.find(p => p.uid !== currentUser?.uid);
                    if (!otherP) return null;
                    const unreadCount = chat.unreadCounts?.[currentUser?.uid ?? ''] ?? 0;
                    const isOnline = onlineStatus[otherP.uid];
                    const isActive = selectedChatId === chat.id;
                    
                    return (
                    <motion.button
                        key={chat.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => handleSelectChat(chat.id)}
                        className={cn(
                        "flex items-start gap-4 p-4 text-left rounded-[1.75rem] transition-all duration-300 group relative w-full",
                        isActive 
                            ? "bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02] z-10" 
                            : "hover:bg-card hover:shadow-md"
                        )}
                    >
                        <div className="relative shrink-0">
                            <Avatar className={cn(
                                "h-14 w-14 border-2 transition-transform duration-500 group-hover:scale-105", 
                                isActive ? "border-white/20" : "border-background"
                            )}>
                                <AvatarImage src={otherP.photoURL} alt={otherP.displayName} className="object-cover" />
                                <AvatarFallback className="bg-primary/5 text-primary font-black">{otherP.displayName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            {isOnline && (
                                <span className="absolute bottom-0 right-0 block h-4 w-4 rounded-full bg-green-500 border-2 border-background shadow-lg ring-1 ring-green-400 animate-pulse" />
                            )}
                        </div>
                        
                        <div className="flex-1 min-w-0 py-1">
                            <div className="flex items-center justify-between gap-2">
                                <p className="font-black truncate text-sm tracking-tight">{otherP.displayName}</p>
                                {chat.lastMessage?.timestamp && (
                                    <p className={cn("text-[9px] font-bold uppercase", isActive ? "text-white/60" : "text-muted-foreground/60")}>
                                        {format(chat.lastMessage.timestamp.toDate(), 'HH:mm')}
                                    </p>
                                )}
                            </div>
                            <p className={cn(
                                "text-xs truncate mt-1 leading-relaxed font-medium", 
                                isActive ? "text-white/80" : "text-muted-foreground"
                            )}>
                                {chat.lastMessage?.text || "Kirim pesan inspirasi..."}
                            </p>
                        </div>

                        {unreadCount > 0 && !isActive && (
                            <div className="absolute right-4 bottom-4 h-6 min-w-[24px] px-2 flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-black shadow-lg shadow-primary/30 ring-2 ring-background">
                                {unreadCount}
                            </div>
                        )}
                    </motion.button>
                    )
                })}
                </div>
            </ScrollArea>
          </div>
        </div>

        {/* Chat Box: Messages Area */}
        <div className={cn(
            "col-span-12 md:col-span-8 lg:col-span-9 h-full flex flex-col overflow-hidden relative bg-background transition-all duration-500",
            selectedChatId ? 'flex' : 'hidden md:flex'
        )}>
          {!selectedChatId ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-12 bg-muted/5 relative">
                <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-64 h-64 bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
                
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-10 rounded-[3.5rem] bg-card shadow-2xl shadow-primary/5 flex flex-col items-center gap-8 relative z-10 ring-1 ring-border/50"
                >
                    <div className="p-8 rounded-[2.5rem] bg-primary/5 text-primary shadow-inner">
                        <MessageSquare className="h-20 w-16" />
                    </div>
                    <div className="space-y-3">
                        <h2 className="text-3xl font-headline font-black tracking-tight uppercase">Ruang Inspirasi</h2>
                        <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed font-medium italic">
                            "Pilih salah satu obrolan untuk mulai membagikan imajinasi, kritik sastra, dan semangat pujangga."
                        </p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/10">
                        <Sparkles className="h-3.5 w-3.5" /> Jalin Koneksi Baru
                    </div>
                </motion.div>
            </div>
          ) : (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header Chat Box */}
              <div className="flex items-center px-6 py-4 border-b bg-background/95 backdrop-blur-md shrink-0 z-30 shadow-sm relative overflow-hidden">
                <div className="absolute inset-0 bg-primary/5 opacity-20" />
                
                <Button variant="ghost" size="icon" className="md:hidden mr-4 rounded-full hover:bg-muted shrink-0" onClick={handleGoBack}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                
                {otherParticipant ? (
                   <Link href={`/profile/${otherParticipant.username}`} className="flex items-center gap-4 group min-w-0 flex-1">
                    <div className="relative shrink-0">
                      <Avatar className="h-12 w-12 border-2 border-primary/10 transition-all group-hover:scale-105 group-hover:border-primary/30 shadow-md">
                        <AvatarImage src={otherParticipant.photoURL} className="object-cover" />
                        <AvatarFallback className="font-black bg-primary/5 text-primary">{otherParticipant.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                       {isOtherParticipantOnline && (
                           <span className="absolute bottom-0 right-0 block h-4 w-4 rounded-full bg-green-500 border-2 border-background shadow-lg animate-pulse" />
                       )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-black text-lg group-hover:text-primary transition-colors truncate leading-none">{otherParticipant.displayName}</h2>
                        {isOtherParticipantOnline && (
                            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        )}
                      </div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5 flex items-center gap-2">
                          @{otherParticipant.username}
                          <span className="opacity-30">•</span>
                          <span className={cn(isOtherParticipantOnline ? "text-green-500 lowercase tracking-normal" : "lowercase tracking-normal")}>
                            {isOtherParticipantOnline ? 'aktif sekarang' : 'sedang istirahat'}
                          </span>
                      </p>
                    </div>
                   </Link>
                ) : (
                    <div className="flex-1 min-w-0 h-12 flex items-center">
                        <Skeleton className="h-10 w-48 rounded-full" />
                    </div>
                )}
                
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-primary">
                        <Info className="h-5 w-5" />
                    </Button>
                </div>
              </div>
              
              {/* Pesan-pesan */}
              <div className="flex-1 overflow-hidden relative bg-muted/5">
                <ScrollArea className="h-full">
                    <div className="py-10 px-6 space-y-10">
                    {isLoadingMessages ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Membuka Gulungan Surat...</p>
                        </div>
                    ) : messageGroups.length === 0 ? (
                        <div className="text-center py-32 opacity-20 flex flex-col items-center gap-6">
                            <div className="p-6 rounded-[2.5rem] bg-primary/5">
                                <Sparkles className="h-16 w-16 text-primary" />
                            </div>
                            <p className="font-headline text-2xl font-black italic max-w-xs mx-auto">Mulailah Percakapan Puitis Pertama Anda</p>
                        </div>
                    ) : (
                        <AnimatePresence initial={false}>
                            {messageGroups.map((item) => {
                            if ('type' in item && item.type === 'date_marker') {
                                return (
                                <div key={item.id} className="flex items-center justify-center my-12 select-none">
                                    <div className="h-[1px] bg-gradient-to-r from-transparent via-border to-transparent flex-1" />
                                    <span className="text-[9px] uppercase tracking-[0.4em] font-black text-muted-foreground/40 px-8 bg-background relative z-10">
                                        {isToday(item.date) ? 'Hari Ini' : isYesterday(item.date) ? 'Kemarin' : format(item.date, 'd MMM yyyy', { locale: id })}
                                    </span>
                                    <div className="h-[1px] bg-gradient-to-r from-transparent via-border to-transparent flex-1" />
                                </div>
                                );
                            }
                            const msg = item as ChatMessage;
                            const isSender = msg.senderId === currentUser?.uid;
                            
                            return (
                                <MessageBubble 
                                    key={msg.id} 
                                    msg={msg} 
                                    isSender={isSender} 
                                    otherParticipant={otherParticipant}
                                    onSwipe={() => setReplyingTo(msg)}
                                    onImageClick={(url) => setPreviewImage(url)}
                                />
                            );
                            })}
                        </AnimatePresence>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                    </div>
                </ScrollArea>
              </div>

              {/* Input Area */}
              <div className="p-3 md:p-6 border-t bg-background/95 backdrop-blur-md shrink-0 z-[60] pb-2 md:pb-6 shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.1)]">
                  <div className="max-w-5xl mx-auto flex flex-col gap-2 md:gap-3">
                      {/* Replying Context Bar */}
                      <AnimatePresence>
                        {replyingTo && (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="flex items-center gap-3 bg-muted/40 p-3 rounded-2xl border border-primary/10 relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />
                                <div className="flex-1 min-w-0 pl-2">
                                    <p className="text-[9px] font-black uppercase text-primary tracking-widest">
                                        Membalas {replyingTo.senderId === currentUser?.uid ? 'Anda' : otherParticipant?.displayName}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate italic mt-0.5">
                                        {replyingTo.type === 'text' ? replyingTo.text : 
                                         replyingTo.type === 'image' ? '📷 Gambar' : 
                                         replyingTo.type === 'voice_note' ? '🎤 Pesan Suara' : '📦 Konten Shared'}
                                    </p>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 rounded-full text-muted-foreground hover:text-rose-500"
                                    onClick={() => setReplyingTo(null)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </motion.div>
                        )}
                      </AnimatePresence>

                      {isRecording && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            className="bg-primary/5 border border-primary/20 rounded-[1.75rem] p-4 flex items-center justify-between shadow-inner"
                          >
                              <div className="flex items-center gap-3">
                                  <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                                  <span className="font-mono font-bold text-primary">{formatTime(recordingTime)}</span>
                                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Sedang Merekam...</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-rose-500 rounded-full" onClick={() => stopRecording(true)}>
                                      <Trash2 className="h-5 w-5" />
                                  </Button>
                                  <Button size="icon" className="rounded-full h-10 w-10 bg-primary shadow-lg shadow-primary/20" onClick={() => stopRecording(false)}>
                                      <Send className="h-5 w-5" />
                                  </Button>
                              </div>
                          </motion.div>
                      )}

                      {!isRecording && (
                        <form onSubmit={handleSendMessage} className="relative flex items-end gap-2 md:gap-4">
                            <div className="flex gap-1 md:gap-2 shrink-0 mb-1">
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon" 
                                    className="rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isSending}
                                >
                                    <ImageIcon className="h-5 w-5" />
                                </Button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageSelect} />
                                
                                <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="icon" 
                                    className="rounded-full text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                                    onClick={startRecording}
                                    disabled={isSending}
                                >
                                    <Mic className="h-5 w-5" />
                                </Button>
                            </div>

                            <div className="relative flex-1 group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-accent/10 rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                                <Textarea 
                                    ref={textareaRef}
                                    placeholder="Tuangkan inspirasi..." 
                                    onFocus={() => setTimeout(() => scrollToBottom(), 300)}
                                    className="relative w-full resize-none rounded-[1.75rem] border-none bg-muted/40 px-6 py-4 pr-12 min-h-[50px] max-h-40 focus-visible:ring-primary/20 focus-visible:bg-background transition-all shadow-inner text-sm leading-relaxed font-medium"
                                    rows={1}
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                    disabled={isSending}
                                />
                                <div className="absolute right-1 bottom-1">
                                    <Button 
                                        type="submit" 
                                        size="icon" 
                                        className="h-10 w-10 rounded-full shadow-lg transition-all active:scale-90 bg-primary" 
                                        disabled={isSending || !newMessage.trim()}
                                    >
                                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5"/>}
                                    </Button>
                                </div>
                            </div>
                        </form>
                      )}
                  </div>
                  <div className="mt-1.5 flex justify-center opacity-20 pointer-events-none select-none grayscale">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-2 w-3" />
                        <p className="text-[7px] font-black uppercase tracking-[0.4em]">Elitera Messenger</p>
                      </div>
                  </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-none w-screen h-screen p-0 border-0 m-0 bg-black/90 backdrop-blur-2xl overflow-hidden flex flex-col z-[300]">
            <DialogHeader className="sr-only">
                <DialogTitle>Pratinjau Gambar</DialogTitle>
                <DialogDescription>Melihat gambar dalam ukuran penuh.</DialogDescription>
            </DialogHeader>
            
            <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-[310] bg-gradient-to-b from-black/60 to-transparent">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-white hover:bg-white/10 rounded-full h-12 w-12"
                    onClick={() => setPreviewImage(null)}
                >
                    <X className="h-6 w-6" />
                </Button>

                <div className="flex items-center gap-3">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 rounded-full h-12 w-12">
                                <MoreVertical className="h-6 w-6" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 bg-background/95 backdrop-blur-xl border-border/50">
                            <DropdownMenuItem className="rounded-xl gap-3 py-3 font-bold" onSelect={() => window.open(previewImage!, '_blank')}>
                                <ExternalLink className="h-4 w-4 text-primary" />
                                Buka Asli
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-xl gap-3 py-3 font-bold" onSelect={() => handleCopyLink(previewImage!)}>
                                <Copy className="h-4 w-4 text-primary" />
                                Salin Tautan
                            </DropdownMenuItem>
                            <DropdownMenuItem className="rounded-xl gap-3 py-3 font-bold" asChild>
                                <a href={previewImage!} download={`elitera-image-${Date.now()}.jpg`}>
                                    <Download className="h-4 w-4 text-primary" />
                                    Simpan Gambar
                                </a>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <div className="flex-1 relative flex items-center justify-center p-4">
                <AnimatePresence mode="wait">
                    {previewImage && (
                        <motion.div 
                            key={previewImage}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="relative w-full h-full flex items-center justify-center"
                        >
                            <img 
                                src={previewImage} 
                                alt="Full Preview" 
                                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MessageBubble({ msg, isSender, otherParticipant, onSwipe, onImageClick }: { msg: ChatMessage, isSender: boolean, otherParticipant?: any, onSwipe: () => void, onImageClick: (url: string) => void }) {
    const x = useMotionValue(0);
    const opacity = useTransform(x, [0, 60], [0, 1]);
    const scale = useTransform(x, [0, 60], [0.5, 1]);

    const handleDragEnd = (_: any, info: any) => {
        if (info.offset.x > 60) {
            onSwipe();
        }
    };

    return (
        <motion.div 
            className="relative"
            initial={{ opacity: 0, y: 20, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
        >
            <motion.div 
                style={{ opacity, scale }}
                className="absolute left-[-40px] top-1/2 -translate-y-1/2 flex items-center justify-center h-10 w-10 bg-primary/10 rounded-full text-primary"
            >
                <Reply className="h-5 w-5" />
            </motion.div>

            <motion.div
                drag="x"
                dragConstraints={{ left: 0, right: 100 }}
                dragElastic={0.1}
                onDragEnd={handleDragEnd}
                className={cn("flex items-end gap-3", isSender ? "justify-end" : "justify-start")}
            >
                {!isSender && (
                    <Avatar className="h-9 w-9 mb-1 shrink-0 border-2 border-background shadow-md">
                        <AvatarImage src={otherParticipant?.photoURL} className="object-cover" />
                        <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-bold">{otherParticipant?.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                )}
                <div className={cn("flex flex-col gap-1.5 max-w-[85%] md:max-w-[70%]", isSender ? "items-end" : "items-start")}>
                    <div className={cn(
                        "rounded-[1.75rem] shadow-sm text-[15px] leading-relaxed relative overflow-hidden flex flex-col", 
                        isSender 
                            ? "bg-primary text-white rounded-br-none shadow-primary/20 ring-1 ring-white/10" 
                            : "bg-card border border-border/50 rounded-bl-none shadow-black/5"
                    )}>
                        {msg.replyTo && (
                            <div className={cn(
                                "mx-2 mt-2 p-2 px-3 rounded-2xl border-l-4 flex flex-col gap-0.5 opacity-80",
                                isSender ? "bg-white/10 border-white/40" : "bg-muted/50 border-primary/40"
                            )}>
                                <p className={cn("text-[9px] font-black uppercase tracking-widest", isSender ? "text-white/60" : "text-primary/60")}>
                                    {msg.replyTo.senderName}
                                </p>
                                <p className="text-[11px] truncate italic line-clamp-1">
                                    {msg.replyTo.text}
                                </p>
                            </div>
                        )}

                        {msg.type === 'text' && (
                            <p className="whitespace-pre-wrap font-medium px-6 py-4">{msg.text}</p>
                        )}
                        {msg.type === 'image' && (
                            <div className="relative aspect-auto max-w-full overflow-hidden rounded-[1.5rem] group p-1">
                                <img 
                                    src={msg.imageUrl} 
                                    alt="Chat Media" 
                                    className="w-full h-auto object-cover max-h-[300px] cursor-pointer rounded-[1.25rem] border border-white/5 shadow-inner transition-transform active:scale-[0.98]"
                                    onClick={() => onImageClick(msg.imageUrl)}
                                />
                            </div>
                        )}
                        {msg.type === 'voice_note' && (
                            <div className="flex items-center gap-3 px-4 py-3 min-w-[200px]">
                                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white">
                                    <Mic className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <audio 
                                        src={msg.audioUrl} 
                                        controls 
                                        className={cn(
                                            "h-10 w-full scale-90 origin-left",
                                            isSender ? "filter invert hue-rotate-180" : ""
                                        )} 
                                    />
                                </div>
                            </div>
                        )}
                        {msg.type === 'book_share' && (
                            <Link href={`/books/${msg.book.id}`} className="block group/shared">
                                <div className={cn(
                                    "flex flex-col gap-2 min-w-[180px] sm:min-w-[240px] overflow-hidden rounded-2xl transition-all",
                                    isSender ? "bg-white/5 hover:bg-white/10" : "bg-muted/20 hover:bg-muted/40"
                                )}>
                                    <div className="aspect-[2/3] relative w-full h-40 sm:h-56">
                                        <Image 
                                            src={msg.book.coverUrl} 
                                            alt={msg.book.title} 
                                            fill 
                                            className="object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/40" />
                                        <div className="absolute bottom-3 left-3 right-3 text-white">
                                            <p className="font-black text-xs sm:text-sm line-clamp-2 leading-tight uppercase tracking-tight italic">{msg.book.title}</p>
                                            <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mt-1 opacity-80">{msg.book.authorName}</p>
                                        </div>
                                    </div>
                                    <div className="px-4 py-2 text-center border-t border-white/10">
                                        <span className={cn(
                                            "text-[8px] sm:text-[10px] font-black uppercase tracking-widest",
                                            isSender ? "text-white/60" : "text-primary"
                                        )}>Buka Karya</span>
                                    </div>
                                </div>
                            </Link>
                        )}
                        {msg.type === 'reel_share' && (
                            <Link href={`/reels?id=${msg.reel.id}`} className="block group/shared">
                                <div className={cn(
                                    "flex flex-col gap-3 min-w-[200px] sm:min-w-[260px] p-4 overflow-hidden rounded-2xl transition-all",
                                    isSender ? "bg-white/5 hover:bg-white/10" : "bg-muted/20 hover:bg-muted/40"
                                )}>
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
                                            <Clapperboard className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={cn("text-[10px] font-black uppercase tracking-widest", isSender ? "text-white/60" : "text-primary")}>Video Reels</p>
                                            <p className="text-xs font-bold truncate opacity-80">@{msg.reel.authorName.toLowerCase()}</p>
                                        </div>
                                    </div>
                                    <div className="aspect-video relative rounded-xl overflow-hidden bg-black/20 flex items-center justify-center group-hover/shared:scale-[1.02] transition-transform">
                                        <Play className="h-8 w-8 text-white/40 group-hover/shared:scale-110 group-hover/shared:text-white transition-all" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                    </div>
                                    {msg.reel.caption && (
                                        <p className="text-xs line-clamp-2 italic opacity-70 font-medium">"{msg.reel.caption}"</p>
                                    )}
                                    <div className="text-center pt-1 border-t border-white/5 mt-1">
                                        <span className={cn(
                                            "text-[9px] font-black uppercase tracking-[0.2em]",
                                            isSender ? "text-white/40" : "text-muted-foreground"
                                        )}>Tonton Video</span>
                                    </div>
                                </div>
                            </Link>
                        )}
                    </div>
                    <p className={cn("text-[8px] font-black uppercase opacity-40 px-2 tracking-widest mt-0.5", isSender ? "text-right" : "text-left")}>
                        {format(msg.createdAt.toDate(), 'HH:mm')}
                    </p>
                </div>
            </motion.div>
        </motion.div>
    );
}
