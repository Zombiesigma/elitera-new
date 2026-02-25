'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, doc, updateDoc, limit, orderBy, onSnapshot, getDoc } from 'firebase/firestore';
import type { VideoCallSession } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Zap, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function IncomingCallOverlay() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [activeCall, setActiveCall] = useState<VideoCallSession | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  const callsQuery = useMemo(() => (
    (firestore && currentUser)
      ? query(
          collection(firestore, 'calls'), 
          where('receiverId', '==', currentUser.uid),
          where('status', '==', 'calling'),
          orderBy('createdAt', 'desc'),
          limit(1)
        )
      : null
  ), [firestore, currentUser]);

  const { data: calls } = useCollection<VideoCallSession>(callsQuery);

  useEffect(() => {
    if (calls && calls.length > 0) {
        const call = calls[0];
        const now = Date.now();
        const callTime = call.createdAt?.toMillis() || 0;
        
        if (now - callTime < 60000) {
            setActiveCall(call);
        } else {
            setActiveCall(null);
        }
    } else {
        setActiveCall(null);
    }
  }, [calls]);

  useEffect(() => {
    if (!activeCall || !firestore) return;
    const unsubscribe = onSnapshot(doc(firestore, 'calls', activeCall.id), (sn) => {
        if (!sn.exists()) {
            setActiveCall(null);
            return;
        }
        const status = sn.data()?.status;
        if (status === 'ended' || status === 'rejected' || status === 'accepted') {
            setActiveCall(null);
        }
    });
    return () => unsubscribe();
  }, [activeCall, firestore]);

  useEffect(() => {
    if (activeCall) {
      if (!ringtoneRef.current) {
        ringtoneRef.current = new Audio('https://raw.githubusercontent.com/Zombiesigma/elitera-asset/main/freesound_community-phone-ringing-6805.mp3');
        ringtoneRef.current.loop = true;
      }
      ringtoneRef.current.play().catch(err => console.log("Audio play deferred:", err));
    } else {
      if (ringtoneRef.current) { 
        ringtoneRef.current.pause(); 
        ringtoneRef.current.currentTime = 0; 
      }
    }
    return () => ringtoneRef.current?.pause();
  }, [activeCall]);

  const handleAnswer = async () => {
    if (!activeCall || !firestore || !currentUser) return;
    
    try {
      await updateDoc(doc(firestore, 'calls', activeCall.id), { status: 'accepted' });
      router.push(`/messages?callId=${activeCall.id}`);
      setActiveCall(null);
    } catch (e) {
      console.error("Error answering call:", e);
    }
  };

  const handleReject = async () => {
    if (activeCall && firestore) {
      await updateDoc(doc(firestore, 'calls', activeCall.id), { status: 'rejected' });
      setActiveCall(null);
    }
  };

  return (
    <AnimatePresence>
      {activeCall && (
        <motion.div 
            initial={{ y: -120, opacity: 0, x: '-50%' }} 
            animate={{ y: 0, opacity: 1, x: '-50%' }} 
            exit={{ y: -120, opacity: 0, x: '-50%' }} 
            className="fixed top-6 left-1/2 z-[600] w-full max-w-[calc(100%-2.5rem)] md:max-w-md px-4 pointer-events-none"
        >
          <div className="bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-[0_20px_60px_rgba(0,0,0,0.3)] rounded-[3rem] p-5 flex items-center justify-between gap-4 w-full ring-1 ring-white/10 pointer-events-auto overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                <Zap className="h-20 w-20 text-primary" />
            </div>
            
            <div className="flex items-center gap-4 flex-1 min-w-0 relative z-10">
              <div className="relative">
                <Avatar className="h-16 w-16 border-2 border-primary/30 shadow-2xl transition-transform active:scale-95">
                    <AvatarImage src={activeCall.callerPhotoURL} className="object-cover" />
                    <AvatarFallback className="bg-primary/10 text-primary font-black text-xl">{activeCall.callerName[0]}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-green-500 border-4 border-background h-6 w-6 rounded-full shadow-lg animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Panggilan Masuk</p>
                    <Sparkles className="h-2.5 w-2.5 text-primary animate-bounce" />
                </div>
                <h4 className="font-black text-lg truncate tracking-tight">{activeCall.callerName}</h4>
              </div>
            </div>

            <div className="flex gap-2.5 relative z-10">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-14 w-14 rounded-[1.5rem] text-rose-500 bg-rose-500/5 border border-rose-100/50 hover:bg-rose-500 hover:text-white transition-all active:scale-90" 
                onClick={handleReject}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              <Button 
                size="icon" 
                className="h-14 w-14 rounded-[1.5rem] bg-primary animate-bounce shadow-[0_10px_30px_rgba(59,130,246,0.4)] transition-all active:scale-90" 
                onClick={handleAnswer}
              >
                <Phone className="text-white h-6 w-6" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
