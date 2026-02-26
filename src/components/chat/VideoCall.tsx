'use client';

import { useState, useRef, useEffect } from 'react';
import { useFirestore } from '@/firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Loader2, 
  X,
  Minimize2,
  Sparkles,
  Zap,
  SwitchCamera,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

interface VideoCallProps {
  callId: string;
  isCaller: boolean;
  onClose: () => void;
}

export function VideoCall({ callId, isCaller, onClose }: VideoCallProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState<'connecting' | 'calling' | 'connected' | 'ended'>('connecting');
  const [duration, setDuration] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handleRemoteIceCandidate = (candidateData: RTCIceCandidateInit) => {
    if (pc.current?.remoteDescription) {
      pc.current.addIceCandidate(new RTCIceCandidate(candidateData)).catch(console.warn);
    } else {
      iceCandidatesQueue.current.push(candidateData);
    }
  };

  const processIceQueue = () => {
    while (iceCandidatesQueue.current.length > 0 && pc.current?.remoteDescription) {
      const candidate = iceCandidatesQueue.current.shift();
      if (candidate) {
        pc.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.warn);
      }
    }
  };

  useEffect(() => {
    if (!firestore || !callId) return;

    let isComponentMounted = true;

    const startSession = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }, 
          audio: true 
        });

        if (!isComponentMounted) {
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        localStream.current = stream;
        remoteStream.current = new MediaStream();

        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream.current;

        pc.current = new RTCPeerConnection(servers);

        stream.getTracks().forEach((track) => {
          if (pc.current && localStream.current) {
            pc.current.addTrack(track, localStream.current);
          }
        });

        pc.current.ontrack = (event) => {
          event.streams[0].getTracks().forEach((track) => {
            if (remoteStream.current) {
                remoteStream.current.addTrack(track);
                setStatus('connected');
            }
          });
        };

        if (isCaller) {
          await setupCaller();
        } else {
          await setupCallee();
        }
      } catch (err: any) {
        console.error("WebRTC Industrial Error:", err);
        toast({ variant: 'destructive', title: 'Media Access Error' });
        onClose();
      }
    };

    const setupCaller = async () => {
      if (!pc.current || !firestore) return;
      setStatus('calling');

      const callDoc = doc(firestore, 'calls', callId);
      const callerCandidates = collection(callDoc, 'callerCandidates');
      const calleeCandidates = collection(callDoc, 'calleeCandidates');

      pc.current.onicecandidate = (event) => {
        if (event.candidate && isComponentMounted) {
          addDoc(callerCandidates, event.candidate.toJSON());
        }
      };

      const offerDescription = await pc.current.createOffer();
      await pc.current.setLocalDescription(offerDescription);

      await updateDoc(callDoc, { offer: { sdp: offerDescription.sdp, type: offerDescription.type }, status: 'calling' });

      const unsubscribe = onSnapshot(callDoc, (snapshot) => {
        if (!isComponentMounted) return;
        const data = snapshot.data();
        if (!pc.current?.currentRemoteDescription && data?.answer) {
          pc.current.setRemoteDescription(new RTCSessionDescription(data.answer)).then(processIceQueue).catch(console.error);
        }
        if (data?.status === 'ended' || data?.status === 'rejected') {
            setStatus('ended');
            setTimeout(() => onClose(), 1500);
        }
      });

      const unsubscribeICE = onSnapshot(calleeCandidates, (snapshot) => {
        if (!isComponentMounted) return;
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') handleRemoteIceCandidate(change.doc.data() as RTCIceCandidateInit);
        });
      });

      return () => { unsubscribe(); unsubscribeICE(); };
    };

    const setupCallee = async () => {
      if (!pc.current || !firestore) return;
      
      const callDoc = doc(firestore, 'calls', callId);
      const callerCandidates = collection(callDoc, 'callerCandidates');
      const calleeCandidates = collection(callDoc, 'calleeCandidates');

      pc.current.onicecandidate = (event) => {
        if (event.candidate && isComponentMounted) addDoc(calleeCandidates, event.candidate.toJSON());
      };

      const callSnap = await getDoc(callDoc);
      const callData = callSnap.data();
      
      if (!callData?.offer) { onClose(); return; }

      await pc.current.setRemoteDescription(new RTCSessionDescription(callData.offer));
      processIceQueue();

      const answerDescription = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answerDescription);

      await updateDoc(callDoc, { answer: { type: answerDescription.type, sdp: answerDescription.sdp }, status: 'accepted' });

      onSnapshot(callerCandidates, (snapshot) => {
        if (!isComponentMounted) return;
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') handleRemoteIceCandidate(change.doc.data() as RTCIceCandidateInit);
        });
      });

      onSnapshot(callDoc, (sn) => {
          if (!isComponentMounted) return;
          const s = sn.data()?.status;
          if (s === 'ended' || s === 'rejected') {
              setStatus('ended');
              setTimeout(() => onClose(), 1500);
          }
      });
    };

    startSession();

    return () => {
      isComponentMounted = false;
      if (localStream.current) localStream.current.getTracks().forEach(track => track.stop());
      if (pc.current) { pc.current.close(); pc.current = null; }
    };
  }, [callId, isCaller]);

  useEffect(() => {
    if (status === 'connected') {
        timerIntervalRef.current = setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);
    } else {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [status]);

  const hangUpCall = async () => {
    if (firestore && callId) {
        try {
            const callRef = doc(firestore, 'calls', callId);
            const callSnap = await getDoc(callRef);
            const callData = callSnap.data();
            
            await updateDoc(callRef, { status: 'ended' });

            if (callData?.chatId && callData?.messageId) {
                const msgRef = doc(firestore, `chats/${callData.chatId}/messages`, callData.messageId);
                await updateDoc(msgRef, { 
                    status: 'ended', 
                    duration: duration > 0 ? formatDuration(duration) : null 
                });
            }
        } catch (e) {}
    }
    onClose();
  };

  const switchCamera = async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    
    if (localStream.current) {
        localStream.current.getTracks().forEach(t => t.stop());
        const newStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: newMode, width: { ideal: 1280 }, height: { ideal: 720 } }, 
            audio: !isMuted 
        });
        localStream.current = newStream;
        if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
        
        const videoTrack = newStream.getVideoTracks()[0];
        const sender = pc.current?.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) sender.replaceTrack(videoTrack);
    }
  };

  const toggleMute = () => {
    if (localStream.current) {
      const track = localStream.current.getAudioTracks()[0];
      if (track) { track.enabled = isMuted; setIsMuted(!isMuted); }
    }
  };

  const toggleVideo = () => {
    if (localStream.current) {
      const track = localStream.current.getVideoTracks()[0];
      if (track) { track.enabled = isVideoOff; setIsVideoOff(!isVideoOff); }
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80')] bg-cover bg-center grayscale blur-3xl scale-110" />
      
      <div className="relative w-full h-full flex items-center justify-center">
        <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
        
        <AnimatePresence>
            {(status !== 'connected') && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10 bg-black/60 backdrop-blur-xl">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full scale-150 animate-pulse" />
                        <div className="relative p-1 rounded-full bg-gradient-to-tr from-primary via-accent to-primary animate-[spin_3s_linear_infinite]">
                            <div className="bg-black rounded-full p-8">
                                {status === 'ended' ? <PhoneOff className="h-16 w-16 text-rose-500" /> : <Loader2 className="h-16 w-16 text-primary animate-spin" />}
                            </div>
                        </div>
                    </div>
                    <div className="text-center space-y-3">
                        <h2 className="text-white font-black font-headline text-4xl tracking-tight leading-tight uppercase">
                            {status === 'connecting' ? 'Inisialisasi...' : 
                             status === 'calling' ? (isCaller ? 'Dering...' : 'Menghubungkan...') : 
                             status === 'ended' ? 'Panggilan Berakhir' : 'Negosiasi Jaringan...'}
                        </h2>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {status === 'connected' && (
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-[110] bg-black/40 backdrop-blur-md px-5 py-2 rounded-full border border-white/10 flex items-center gap-3 shadow-2xl">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-white font-mono font-black text-sm tracking-widest">{formatDuration(duration)}</span>
            </div>
        )}

        <motion.div drag dragConstraints={{ left: -300, right: 300, top: -400, bottom: 400 }} className="absolute top-10 right-6 w-32 md:w-56 aspect-[9/16] bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl border-2 border-white/10 z-50 group cursor-move ring-1 ring-white/5">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className={cn(
                "w-full h-full object-cover", 
                isVideoOff && "hidden",
                facingMode === 'user' && "-scale-x-100"
              )} 
            />
            {isVideoOff && <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-white/20 gap-2"><VideoOff className="h-8 w-8" /><span className="text-[8px] font-black uppercase tracking-widest">Off</span></div>}
        </motion.div>
      </div>

      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-8 z-[100] px-6">
        <motion.div 
            initial={{ y: 50, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="flex items-center gap-4 bg-zinc-900/80 backdrop-blur-3xl p-4 md:p-6 rounded-[3.5rem] border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/5"
        >
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleMute} 
                className={cn(
                    "h-14 w-14 md:h-16 md:w-16 rounded-full transition-all active:scale-90", 
                    isMuted ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "text-white hover:bg-white/10"
                )}
            >
                {isMuted ? <MicOff className="h-6 w-6 md:h-7 md:w-7" /> : <Mic className="h-6 w-6 md:h-7 md:w-7" />}
            </Button>
            
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleVideo} 
                className={cn(
                    "h-14 w-14 md:h-16 md:w-16 rounded-full transition-all active:scale-90", 
                    isVideoOff ? "bg-rose-500 text-white shadow-lg shadow-rose-500/20" : "text-white hover:bg-white/10"
                )}
            >
                {isVideoOff ? <VideoOff className="h-6 w-6 md:h-7 md:w-7" /> : <Video className="h-6 w-6 md:h-7 md:w-7" />}
            </Button>
            
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={switchCamera} 
                className="h-14 w-14 md:h-16 md:w-16 rounded-full text-white hover:bg-white/10 transition-all active:scale-90"
            >
                <SwitchCamera className="h-6 w-6 md:h-7 md:w-7" />
            </Button>
            
            <div className="w-px h-10 bg-white/10 mx-1 md:mx-2" />
            
            <Button 
                onClick={hangUpCall} 
                className="h-16 w-16 md:h-20 md:w-20 rounded-[2rem] bg-rose-600 hover:bg-rose-700 text-white active:scale-95 transition-all group shadow-2xl shadow-rose-600/30"
            >
                <PhoneOff className="h-8 w-8 md:h-9 md:w-9 group-hover:rotate-12 transition-transform" />
            </Button>
        </motion.div>
      </div>
    </div>
  );
}
