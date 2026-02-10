'use client';

import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, serverTimestamp, doc, writeBatch, increment } from 'firebase/firestore';
import type { Book, Chat, BookShareMessage } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Check, Send, MessageSquare, Sparkles } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ShareBookDialogProps {
    book: Book;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ShareBookDialog({ book, open, onOpenChange }: ShareBookDialogProps) {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            const timer = setTimeout(() => {
                setSelectedChatId(null);
                setSearchTerm("");
                // Fix potential pointer-events lock
                document.body.style.pointerEvents = '';
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [open]);

    const chatThreadsQuery = useMemo(() => (
        (firestore && currentUser)
          ? query(collection(firestore, 'chats'), where('participantUids', 'array-contains', currentUser.uid))
          : null
      ), [firestore, currentUser]);
    const { data: chatThreads, isLoading: isLoadingThreads } = useCollection<Chat>(chatThreadsQuery);

    const filteredChats = useMemo(() => {
        if (!chatThreads) return [];
        return chatThreads.filter(chat => {
            const otherParticipant = chat.participants.find(p => p.uid !== currentUser?.uid);
            return otherParticipant?.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                   otherParticipant?.username.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [chatThreads, currentUser, searchTerm]);
    

    const handleSend = async () => {
        if (!selectedChatId || !firestore || !currentUser) return;
        
        const selectedChat = chatThreads?.find(c => c.id === selectedChatId);
        const otherParticipant = selectedChat?.participants.find(p => p.uid !== currentUser.uid);
        if(!otherParticipant) return;

        setIsSending(true);

        const messageData: Omit<BookShareMessage, 'id' | 'createdAt'> & { createdAt: any } = {
            type: 'book_share',
            senderId: currentUser.uid,
            createdAt: serverTimestamp(),
            book: {
                id: book.id,
                title: book.title,
                coverUrl: book.coverUrl,
                authorName: book.authorName,
            },
        };

        try {
            const batch = writeBatch(firestore);
            const messagesCol = collection(firestore, 'chats', selectedChatId, 'messages');
            const newMessageRef = doc(messagesCol);
            batch.set(newMessageRef, messageData);

            const chatDocRef = doc(firestore, 'chats', selectedChatId);
            batch.update(chatDocRef, {
                lastMessage: {
                    text: `📖 Membagikan karya: ${book.title}`,
                    senderId: currentUser.uid,
                    timestamp: serverTimestamp(),
                },
                [`unreadCounts.${otherParticipant.uid}`]: increment(1)
            });

            await batch.commit();
            
            onOpenChange(false);

            setTimeout(() => {
                toast({ 
                    variant: 'success',
                    title: "Karya Terkirim", 
                    description: `"${book.title}" telah dibagikan ke ${otherParticipant.displayName}.` 
                });
            }, 100);

        } catch (error) {
            console.error("Share error:", error);
            toast({ 
                variant: 'destructive', 
                title: "Gagal Membagikan",
                description: "Terjadi kesalahan sistem saat mengirim pesan."
            });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent 
                className="max-w-md w-[95vw] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden flex flex-col max-h-[85dvh] bg-background/95 backdrop-blur-xl"
                onCloseAutoFocus={(e) => {
                    e.preventDefault();
                    document.body.style.pointerEvents = '';
                }}
            >
                {/* Header Premium */}
                <div className="p-8 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border-b border-primary/10 shrink-0 relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
                    
                    <DialogHeader className="relative z-10">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl shadow-primary/10 text-primary ring-1 ring-primary/20">
                                <Send className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="font-headline text-2xl font-black tracking-tight uppercase">Bagikan Karya</DialogTitle>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Jalin Koneksi Literasi</span>
                                </div>
                            </div>
                        </div>
                        <DialogDescription className="text-sm font-medium leading-relaxed text-muted-foreground/80">
                            Pilih rekan pujangga untuk menerima <span className="font-black text-foreground italic">"{book.title}"</span>.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 space-y-6">
                    {/* Search Bar */}
                    <div className="relative group shrink-0">
                         <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                         <Input 
                            placeholder="Cari nama atau username..." 
                            className="relative h-12 pl-11 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 transition-all shadow-inner font-medium" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                         />
                    </div>

                    {/* Chat List */}
                    <ScrollArea className="flex-1 px-1">
                        {isLoadingThreads ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-[10px] font-black uppercase tracking-widest">Sinkronisasi Kontak...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 pb-10">
                                <AnimatePresence mode="popLayout">
                                    {filteredChats.map((chat, idx) => {
                                        const otherP = chat.participants.find(p => p.uid !== currentUser?.uid);
                                        if (!otherP) return null;
                                        const isSelected = selectedChatId === chat.id;

                                        return (
                                            <motion.button 
                                                key={chat.id}
                                                layout
                                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ delay: idx * 0.02 }}
                                                onClick={() => setSelectedChatId(isSelected ? null : chat.id)} 
                                                className={cn(
                                                    "flex items-center gap-4 p-4 text-left rounded-[1.75rem] transition-all group relative border-2",
                                                    isSelected 
                                                        ? "bg-primary text-white border-primary shadow-xl shadow-primary/20 scale-[1.02] z-10" 
                                                        : "bg-card/50 border-transparent hover:bg-card hover:border-primary/10 hover:shadow-md"
                                                )}
                                            >
                                                <div className="relative">
                                                    <Avatar className={cn(
                                                        "h-14 w-14 border-2 transition-transform duration-500 group-hover:scale-105",
                                                        isSelected ? "border-white/20" : "border-background"
                                                    )}>
                                                        <AvatarImage src={otherP.photoURL} alt={otherP.displayName} className="object-cover" />
                                                        <AvatarFallback className="bg-primary/5 text-primary font-black">
                                                            {otherP.displayName.charAt(0)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    {isSelected && (
                                                        <motion.div 
                                                            initial={{ scale: 0 }} 
                                                            animate={{ scale: 1 }}
                                                            className="absolute -bottom-1 -right-1 bg-white text-primary p-1 rounded-full shadow-lg ring-2 ring-primary"
                                                        >
                                                            <Check className="h-3 w-3" />
                                                        </motion.div>
                                                    )}
                                                </div>
                                                
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-sm truncate">{otherP.displayName}</p>
                                                    <p className={cn(
                                                        "text-[10px] font-bold uppercase tracking-widest mt-1",
                                                        isSelected ? "text-white/60" : "text-muted-foreground"
                                                    )}>@{otherP.username}</p>
                                                </div>

                                                {isSelected && (
                                                    <motion.div
                                                        initial={{ opacity: 0, x: 10 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        className="bg-white/20 px-3 py-1 rounded-full"
                                                    >
                                                        <span className="text-[10px] font-black uppercase">Terpilih</span>
                                                    </motion.div>
                                                )}
                                            </motion.button>
                                        )
                                    })}
                                </AnimatePresence>
                                
                                {!isLoadingThreads && filteredChats.length === 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="text-center py-20 opacity-30 flex flex-col items-center gap-4"
                                    >
                                        <div className="p-6 rounded-full bg-muted">
                                            <MessageSquare className="h-12 w-12" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-black uppercase tracking-widest">Obrolan Tidak Ditemukan</p>
                                            <p className="text-xs font-medium">Cari nama atau username lain.</p>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                {/* Footer Actions */}
                <DialogFooter className="p-6 bg-muted/20 border-t border-border/50 shrink-0 mt-auto flex flex-col sm:flex-row gap-3">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)} 
                        className="rounded-full font-bold h-12 px-8 hover:bg-background/50 transition-all"
                    >
                        Batal
                    </Button>
                    <Button 
                        onClick={handleSend} 
                        disabled={!selectedChatId || isSending}
                        className="rounded-full px-10 font-black text-sm uppercase tracking-widest shadow-2xl shadow-primary/20 h-12 transition-all active:scale-95 group"
                    >
                        {isSending ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Mengirim...</>
                        ) : (
                            <>
                                <Send className="mr-2 h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" /> 
                                Bagikan Sekarang
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
