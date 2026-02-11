'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, doc, updateDoc, writeBatch } from 'firebase/firestore';
import type { Chat } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * IncomingCallOverlay handles real-time global notification for incoming video calls.
 * Optimized for exact mobile centering and real-time auto-dismissal.
 * Includes a looping ringtone from the provided GitHub asset.
 */
export function IncomingCallOverlay() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [activeCall, setActiveCall] = useState<{ chat: Chat; caller: any } | null>(null);

  const chatsQuery = useMemo(() => (
    (firestore && currentUser)
      ? query(collection(firestore, 'chats'), where('participantUids', 'array-contains', currentUser.uid))
      : null
  ), [firestore, currentUser]);

  const { data: chats } = useCollection<Chat>(chatsQuery);

  // Ringtone Logic
  useEffect(() => {
    let audio: HTMLAudioElement | null = null;

    if (activeCall) {
      // Use the raw URL for direct mp3 access from GitHub
      audio = new Audio('https://raw.githubusercontent.com/Zombiesigma/elitera-asset/main/freesound_community-phone-ringing-6805.mp3');
      audio.loop = true;
      audio.play().catch(err => {
        // Most browsers block autoplay without a previous user interaction on the page
        console.warn("Ringtone playback blocked by browser policy. Please click anywhere on the app to enable sound.", err);
      });
    }

    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        audio = null;
      }
    };
  }, [activeCall]);

  useEffect(() => {
    if (!chats || !currentUser) return;

    const incomingCallChat = chats.find(chat => {
      const lastMsg = chat.lastMessage;
      if (!lastMsg) return false;

      const isCall = lastMsg.type === 'video_call';
      const isFromOther = lastMsg.senderId !== currentUser.uid;
      const isActive = lastMsg.status === 'active';
      
      const now = Date.now();
      const msgTime = (lastMsg.timestamp as any)?.toMillis() || 0;
      const isRecent = (now - msgTime) < 120000; // 2 minutes timeout

      return isCall && isFromOther && isActive && isRecent;
    });

    if (incomingCallChat) {
      const caller = incomingCallChat.participants.find(p => p.uid !== currentUser.uid);
      setActiveCall({ chat: incomingCallChat, caller });
    } else {
      setActiveCall(null);
    }
  }, [chats, currentUser]);

  const handleAnswer = () => {
    if (activeCall) {
      // Redirect to messages with autoCall param to trigger modal automatically
      router.push(`/messages?chatId=${activeCall.chat.id}&autoCall=true`);
      setActiveCall(null);
    }
  };

  const handleReject = async () => {
    if (activeCall && firestore && activeCall.chat.lastMessage?.messageId) {
      try {
        const batch = writeBatch(firestore);
        const msgRef = doc(firestore, 'chats', activeCall.chat.id, 'messages', activeCall.chat.lastMessage.messageId);
        batch.update(msgRef, { status: 'ended' });
        
        const chatRef = doc(firestore, 'chats', activeCall.chat.id);
        batch.update(chatRef, {
            'lastMessage.status': 'ended',
            'lastMessage.text': '📞 Video Call Selesai'
        });

        await batch.commit();
        setActiveCall(null);
      } catch (e) {
        console.error("Failed to reject call", e);
      }
    }
  };

  return (
    <AnimatePresence>
      {activeCall && (
        <motion.div
          initial={{ y: -100, opacity: 0, x: '-50%' }}
          animate={{ y: 0, opacity: 1, x: '-50%' }}
          exit={{ y: -100, opacity: 0, x: '-50%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="fixed top-4 left-1/2 z-[500] w-full max-w-[calc(100%-2rem)] md:max-w-md pointer-events-none px-4"
        >
          <div className="bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] rounded-[2.5rem] p-4 flex items-center justify-between gap-4 w-full pointer-events-auto ring-1 ring-white/10">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping scale-125" />
                <Avatar className="h-14 w-14 border-2 border-primary/20 shadow-xl relative z-10">
                  <AvatarImage src={activeCall.caller.photoURL} className="object-cover" />
                  <AvatarFallback className="bg-primary/5 text-primary font-black">
                    {activeCall.caller.displayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-green-500 p-1.5 rounded-full shadow-lg ring-2 ring-background z-20">
                  <Video className="h-3 w-3 text-white" />
                </div>
              </div>
              
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-0.5">Panggilan Masuk</p>
                <h4 className="font-black text-sm truncate">{activeCall.caller.displayName}</h4>
                <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1.5 mt-0.5">
                  <Sparkles className="h-2.5 w-2.5 text-primary animate-pulse" />
                  Ingin berdiskusi video
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-12 w-12 rounded-full border-rose-100 text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-90 shadow-sm"
                onClick={handleReject}
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
              <Button 
                size="icon" 
                className="h-12 w-12 rounded-full bg-primary shadow-xl shadow-primary/20 transition-all animate-bounce active:scale-90"
                onClick={handleAnswer}
              >
                <Phone className="h-5 w-5 text-white" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
