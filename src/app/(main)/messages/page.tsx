'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, orderBy, doc, updateDoc, increment, writeBatch, serverTimestamp, onSnapshot } from 'firebase/firestore';
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
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Chat, ChatMessage, User as AppUser } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [searchTerm, setSearchTerm] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatIdFromUrl = searchParams.get('chatId');

  useEffect(() => {
    setSelectedChatId(chatIdFromUrl || null);
  }, [chatIdFromUrl]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedChatId]);

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

  // Mark messages as read when opening a chat
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

  const filteredThreads = useMemo(() => {
    if (!chatThreads) return [];
    if (!searchTerm.trim()) return [...chatThreads].sort((a, b) => (b.lastMessage?.timestamp?.toMillis() || 0) - (a.lastMessage?.timestamp?.toMillis() || 0));
    
    return chatThreads.filter(chat => {
        const other = chat.participants.find(p => p.uid !== currentUser?.uid);
        return other?.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
               other?.username.toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a, b) => (b.lastMessage?.timestamp?.toMillis() || 0) - (a.lastMessage?.timestamp?.toMillis() || 0));
  }, [chatThreads, searchTerm, currentUser]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !selectedChatId || !firestore || !otherParticipant) return;
    const text = newMessage.trim();
    setNewMessage("");
    setIsSending(true);
    try {
      const batch = writeBatch(firestore);
      const msgRef = doc(collection(firestore, 'chats', selectedChatId, 'messages'));
      
      batch.set(msgRef, {
        type: 'text', 
        text, 
        senderId: currentUser.uid, 
        createdAt: serverTimestamp(),
      });
      
      batch.update(doc(firestore, 'chats', selectedChatId), {
        lastMessage: { 
            text, 
            senderId: currentUser.uid, 
            timestamp: serverTimestamp() 
        },
        [`unreadCounts.${otherParticipant.uid}`]: increment(1)
      });
      
      await batch.commit();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) {
        toast({ variant: 'destructive', title: "Gagal Mengirim" });
    } finally { setIsSending(false); }
  };

  const handleGoBack = () => router.push('/messages');

  if (!currentUser) return null;

  return (
    <div className="h-[calc(100dvh-64px)] -mt-6 -mx-4 md:-mx-6 flex flex-col bg-background relative overflow-hidden">
      <AnimatePresence mode="wait">
        {!selectedChatId ? (
          // --- LIST VIEW ---
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col h-full w-full max-w-2xl mx-auto"
          >
            <div className="p-6 md:p-10 space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest mb-3">
                            <MessageSquare className="h-3 w-3" /> Jaringan Sastra
                        </div>
                        <h1 className="text-3xl md:text-5xl font-headline font-black tracking-tight">Kotak <span className="text-primary italic">Pesan</span></h1>
                    </div>
                    <div className="p-3 bg-muted/50 rounded-2xl">
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
          // --- CHAT VIEW ---
          <motion.div 
            key="chat"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col h-full w-full max-w-3xl mx-auto bg-background md:border-x"
          >
            <header className="flex items-center h-20 md:h-24 px-4 md:px-8 border-b bg-background/80 backdrop-blur-xl z-30 shrink-0 shadow-sm pt-[max(0rem,env(safe-area-inset-top))]">
                <Button variant="ghost" size="icon" onClick={handleGoBack} className="rounded-full mr-2 md:mr-4 hover:bg-primary/5 hover:text-primary">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                
                {otherParticipant ? (
                    <Link href={`/profile/${otherParticipant.username}`} className="flex items-center gap-4 flex-1 min-w-0 group">
                        <div className="relative">
                            <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-background shadow-md group-hover:scale-105 transition-transform">
                                <AvatarImage src={otherParticipant.photoURL} className="object-cover" />
                                <AvatarFallback className="bg-primary/10 text-primary font-black">{otherParticipant.displayName[0]}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 border-2 border-background rounded-full shadow-sm animate-pulse" />
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-black text-sm md:text-base truncate group-hover:text-primary transition-colors">{otherParticipant.displayName}</h4>
                            <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                <Sparkles className="h-2.5 w-2.5 text-primary" /> Pujangga Terhubung
                            </p>
                        </div>
                    </Link>
                ) : (
                    <div className="flex-1 h-10 bg-muted animate-pulse rounded-full" />
                )}

                <div className="flex items-center gap-1 md:gap-2">
                    <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 hidden sm:flex"><Phone className="h-4 w-4"/></Button>
                    <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5"><MoreVertical className="h-4 w-4"/></Button>
                </div>
            </header>

            <ScrollArea className="flex-1 bg-muted/10">
                <div className="p-6 md:p-10 space-y-8 pb-20">
                    <div className="text-center py-10 opacity-30 select-none">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted border border-border shadow-inner">
                            <Clock className="h-3 w-3" />
                            <span className="text-[8px] font-black uppercase tracking-[0.3em]">Awal Diskusi Mahakarya</span>
                        </div>
                    </div>

                    {isLoadingMessages ? (
                        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary/40" /></div>
                    ) : (
                        messages?.map((msg, i) => {
                            const isMe = msg.senderId === currentUser.uid;
                            const prevMsg = messages[i-1];
                            const showTime = !prevMsg || (msg.createdAt?.toMillis() || 0) - (prevMsg.createdAt?.toMillis() || 0) > 300000;

                            return (
                                <div key={msg.id} className="space-y-4">
                                    {showTime && msg.createdAt && (
                                        <div className="text-center">
                                            <span className="text-[8px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                                                {formatDistanceToNow(msg.createdAt.toDate(), { locale: id, addSuffix: true })}
                                            </span>
                                        </div>
                                    )}
                                    <div className={cn("flex group", isMe ? "justify-end" : "justify-start")}>
                                        <div className={cn(
                                            "max-w-[85%] md:max-w-[70%] p-4 md:p-5 shadow-sm transition-all relative",
                                            isMe 
                                                ? "bg-primary text-white rounded-[1.75rem] rounded-tr-none shadow-primary/10" 
                                                : "bg-card border border-border/50 text-foreground rounded-[1.75rem] rounded-tl-none"
                                        )}>
                                            {msg.type === 'text' && <p className="text-sm md:text-base leading-relaxed font-medium">{msg.text}</p>}
                                            <div className={cn(
                                                "flex items-center gap-1 mt-2 opacity-40",
                                                isMe ? "justify-end" : "justify-start"
                                            )}>
                                                {msg.createdAt && (
                                                    <span className="text-[8px] font-black uppercase tracking-tighter">
                                                        {msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                                {isMe && <CheckCheck className="h-2.5 w-2.5" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </div>
            </ScrollArea>

            <div className="p-4 md:p-8 border-t bg-background/95 backdrop-blur-xl shrink-0 z-30 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.05)]">
                <div className="max-w-3xl mx-auto relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 rounded-[2rem] blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                    <div className="relative flex items-end gap-3 md:gap-4">
                        <div className="flex-1 relative">
                            <Input 
                                placeholder="Tuangkan inspirasimu..." 
                                value={newMessage} 
                                onChange={(e)=>setNewMessage(e.target.value)} 
                                onKeyDown={(e)=>e.key==='Enter'&& !e.shiftKey && handleSendMessage()} 
                                className="h-14 md:h-16 pl-6 pr-14 rounded-2xl md:rounded-[1.5rem] bg-muted/40 border-none focus-visible:ring-primary/20 focus-visible:bg-background transition-all shadow-inner text-base font-medium"
                                disabled={isSending}
                            />
                            <div className="absolute right-3 bottom-1/2 translate-y-1/2">
                                <Button 
                                    size="icon" 
                                    onClick={handleSendMessage} 
                                    className="h-10 w-10 md:h-12 md:w-12 rounded-xl md:rounded-2xl shadow-xl shadow-primary/30 transition-all active:scale-90" 
                                    disabled={isSending || !newMessage.trim()}
                                >
                                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
