
'use client';

import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, serverTimestamp, doc, writeBatch, increment } from 'firebase/firestore';
import type { Reel, Chat, ReelShareMessage } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Check, Send, Sparkles } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface ShareReelDialogProps {
    reel: Reel;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ShareReelDialog({ reel, open, onOpenChange }: ShareReelDialogProps) {
    const { user: currentUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (!open) {
            setSelectedChatId(null);
            setSearchTerm("");
            document.body.style.pointerEvents = '';
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

        const messageData: Omit<ReelShareMessage, 'id' | 'createdAt'> & { createdAt: any } = {
            type: 'reel_share',
            senderId: currentUser.uid,
            createdAt: serverTimestamp(),
            reel: {
                id: reel.id,
                authorName: reel.authorName,
                caption: reel.caption,
                videoUrl: reel.videoUrl,
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
                    text: `🎥 Membagikan video: ${reel.caption || 'Video Elitera'}`,
                    senderId: currentUser.uid,
                    timestamp: serverTimestamp(),
                },
                [`unreadCounts.${otherParticipant.uid}`]: increment(1)
            });

            await batch.commit();
            onOpenChange(false);
            toast({ variant: 'success', title: "Video Dikirim", description: `Berhasil dikirim ke ${otherParticipant.displayName}.` });
        } catch (error) {
            toast({ variant: 'destructive', title: "Gagal Mengirim" });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[95vw] rounded-[2.5rem] p-0 overflow-hidden flex flex-col max-h-[85dvh] bg-background/95 backdrop-blur-xl">
                <div className="p-8 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent border-b shrink-0">
                    <DialogHeader>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 shadow-xl text-primary ring-1 ring-primary/20">
                                <Send className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="font-headline text-2xl font-black">Bagikan Video</DialogTitle>
                                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Kirim ke Rekan Pujangga</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="flex-1 flex flex-col p-6 space-y-6 overflow-hidden">
                    <div className="relative group shrink-0">
                         <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                         <Input 
                            placeholder="Cari kontak obrolan..." 
                            className="h-12 pl-11 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 font-medium" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                         />
                    </div>

                    <ScrollArea className="flex-1 px-1">
                        {isLoadingThreads ? (
                            <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 pb-10">
                                {filteredChats.map((chat) => {
                                    const otherP = chat.participants.find(p => p.uid !== currentUser?.uid);
                                    if (!otherP) return null;
                                    const isSelected = selectedChatId === chat.id;

                                    return (
                                        <button 
                                            key={chat.id}
                                            onClick={() => setSelectedChatId(isSelected ? null : chat.id)} 
                                            className={cn(
                                                "flex items-center gap-4 p-4 text-left rounded-[1.75rem] transition-all group border-2",
                                                isSelected ? "bg-primary text-white border-primary shadow-xl scale-[1.02]" : "bg-card/50 border-transparent hover:bg-card"
                                            )}
                                        >
                                            <Avatar className="h-12 w-12 border-2 border-background shadow-md">
                                                <AvatarImage src={otherP.photoURL} className="object-cover" />
                                                <AvatarFallback className="bg-primary/5 text-primary font-black">{otherP.displayName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-black text-sm truncate">{otherP.displayName}</p>
                                                <p className={cn("text-[10px] font-bold uppercase tracking-widest", isSelected ? "text-white/60" : "text-muted-foreground")}>@{otherP.username}</p>
                                            </div>
                                            {isSelected && <Check className="h-5 w-5 text-white" />}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter className="p-6 bg-muted/20 border-t flex flex-col sm:flex-row gap-3">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full font-bold h-12 px-8">Batal</Button>
                    <Button 
                        onClick={handleSend} 
                        disabled={!selectedChatId || isSending}
                        className="rounded-full px-10 font-black h-12 shadow-xl shadow-primary/20"
                    >
                        {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><Send className="mr-2 h-4 w-4" /> Kirim Sekarang</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
