'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, doc, updateDoc, onSnapshot, limit } from 'firebase/firestore';
import type { VideoCallSession } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Zap, Sparkles, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * IncomingCallOverlay memantau sinyal panggilan masuk di seluruh aplikasi kawan.
 * Dilengkapi dengan nada dering dan popup interaktif untuk standar industri kawan.
 */
export function IncomingCallOverlay() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [activeCall, setActiveCall] = useState<VideoCallSession | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!firestore || !currentUser) return;

    // Monitor panggilan masuk dengan status 'calling' kawan
    const q = query(
      collection(firestore, 'calls'),
      where('receiverId', '==', currentUser.uid),
      where('status', '==', 'calling'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const callDoc = snapshot.docs[0];
        const callData = callDoc.data() as any;
        
        // Cek umur panggilan agar tidak memproses panggilan lama kawan
        const now = Date.now();
        const callTime = callData.createdAt?.toMillis() || now;
        
        if (now - callTime < 45000) { // Masa tunggu 45 detik kawan
          setActiveCall({ id: callDoc.id, ...callData });
        } else {
          setActiveCall(null);
        }
      } else {
        setActiveCall(null);
      }
    });

    return () => unsubscribe();
  }, [firestore, currentUser]);

  useEffect(() => {
    if (activeCall) {
      if (!ringtoneRef.current) {
        // Nada dering puitis untuk para pujangga kawan
        ringtoneRef.current = new Audio('https://raw.githubusercontent.com/Zombiesigma/elitera-asset/main/freesound_community-phone-ringing-6805.mp3');
        ringtoneRef.current.loop = true;
      }
      
      const playPromise = ringtoneRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          console.log("Nada dering ditunda kawan, menunggu interaksi pengguna.");
        });
      }
    } else {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
    }
    
    return () => {
      if (ringtoneRef.current) ringtoneRef.current.pause();
    };
  }, [activeCall]);

  const handleAnswer = async () => {
    if (!activeCall || !firestore) return;
    try {
      await updateDoc(doc(firestore, 'calls', activeCall.id), { status: 'accepted' });
      // Terbang ke ruang obrolan untuk memulai WebRTC kawan
      router.push(`/messages?chatId=${activeCall.chatId}&callId=${activeCall.id}`);
      setActiveCall(null);
    } catch (e) {
      console.error("Gagal menjawab kawan:", e);
    }
  };

  const handleReject = async () => {
    if (!activeCall || !firestore) return;
    try {
      await updateDoc(doc(firestore, 'calls', activeCall.id), { status: 'rejected' });
      setActiveCall(null);
    } catch (e) {
      console.error("Gagal menolak kawan:", e);
    }
  };

  return (
    <AnimatePresence>
      {activeCall && (
        <motion.div 
            initial={{ y: -150, opacity: 0, x: '-50%' }} 
            animate={{ y: 0, opacity: 1, x: '-50%' }} 
            exit={{ y: -150, opacity: 0, x: '-50%' }} 
            className="fixed top-6 left-1/2 z-[600] w-full max-w-[calc(100%-2rem)] md:max-w-md px-4 pointer-events-auto"
        >
          <div className="bg-background/95 backdrop-blur-2xl border border-primary/20 shadow-[0_30px_100px_rgba(0,0,0,0.4)] rounded-[3rem] p-6 flex items-center justify-between gap-4 w-full ring-1 ring-white/10 overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                <Video className="h-24 w-24 text-primary" />
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
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Inspirasi Visual kawan</p>
                    <Sparkles className="h-2.5 w-2.5 text-primary animate-bounce" />
                </div>
                <h4 className="font-black text-lg truncate tracking-tight">{activeCall.callerName}</h4>
              </div>
            </div>

            <div className="flex gap-2.5 relative z-10">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-14 w-14 rounded-full text-rose-500 bg-rose-500/5 border border-rose-100 hover:bg-rose-500 hover:text-white transition-all active:scale-90" 
                onClick={handleReject}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              <Button 
                size="icon" 
                className="h-14 w-14 rounded-full bg-primary animate-bounce shadow-[0_10px_30px_rgba(59,130,246,0.4)] transition-all active:scale-90" 
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
