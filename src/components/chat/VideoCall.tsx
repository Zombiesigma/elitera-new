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
  SwitchCamera
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

  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);

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
          video: { 
            width: { ideal: 1280 }, 
            height: { ideal: 720 },
            frameRate: { ideal: 30 } 
          }, 
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
        toast({ 
          variant: 'destructive', 
          title: 'Akses Media Ditolak', 
          description: 'Berikan izin kamera & mikrofon untuk kolaborasi visual kawan.' 
        });
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

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      await updateDoc(callDoc, { offer, status: 'calling' });

      const unsubscribe = onSnapshot(callDoc, (snapshot) => {
        if (!isComponentMounted) return;
        const data = snapshot.data();
        if (!pc.current?.currentRemoteDescription && data?.answer) {
          const answerDescription = new RTCSessionDescription(data.answer);
          pc.current.setRemoteDescription(answerDescription).then(() => {
              processIceQueue();
          }).catch(console.error);
        }
        if (data?.status === 'ended' || data?.status === 'rejected') {
            setStatus('ended');
            setTimeout(() => onClose(), 1500);
        }
      });

      const unsubscribeICE = onSnapshot(calleeCandidates, (snapshot) => {
        if (!isComponentMounted) return;
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            handleRemoteIceCandidate(change.doc.data() as RTCIceCandidateInit);
          }
        });
      });

      return () => {
          unsubscribe();
          unsubscribeICE();
      };
    };

    const setupCallee = async () => {
      if (!pc.current || !firestore) return;
      
      const callDoc = doc(firestore, 'calls', callId);
      const callerCandidates = collection(callDoc, 'callerCandidates');
      const calleeCandidates = collection(callDoc, 'calleeCandidates');

      pc.current.onicecandidate = (event) => {
        if (event.candidate && isComponentMounted) {
          addDoc(calleeCandidates, event.candidate.toJSON());
        }
      };

      const callSnap = await getDoc(callDoc);
      const callData = callSnap.data();
      
      if (!callData || !callData.offer) {
          toast({ variant: 'destructive', title: 'Sinyal Terputus' });
          onClose();
          return;
      }

      await pc.current.setRemoteDescription(new RTCSessionDescription(callData.offer));
      processIceQueue();

      const answerDescription = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answerDescription);

      await updateDoc(callDoc, { 
        answer: { type: answerDescription.type, sdp: answerDescription.sdp },
        status: 'accepted'
      });

      onSnapshot(callerCandidates, (snapshot) => {
        if (!isComponentMounted) return;
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            handleRemoteIceCandidate(change.doc.data() as RTCIceCandidateInit);
          }
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
      if (localStream.current) {
          localStream.current.getTracks().forEach(track => track.stop());
      }
      if (pc.current) {
          pc.current.close();
          pc.current = null;
      }
    };
  }, [callId, isCaller]);

  const hangUpCall = async () => {
    if (firestore && callId) {
        try {
            await updateDoc(doc(firestore, 'calls', callId), { status: 'ended' });
        } catch (e) {}
    }
    onClose();
  };

  const toggleMute = () => {
    if (localStream.current) {
      const track = localStream.current.getAudioTracks()[0];
      if (track) {
          track.enabled = isMuted;
          setIsMuted(!isMuted);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream.current) {
      const track = localStream.current.getVideoTracks()[0];
      if (track) {
          track.enabled = isVideoOff;
          setIsVideoOff(!isVideoOff);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80')] bg-cover bg-center grayscale blur-3xl scale-110" />
      
      <div className="relative w-full h-full flex items-center justify-center">
        <video 
          ref={remoteVideoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
        
        <AnimatePresence>
            {(status !== 'connected') && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-8 z-10 bg-black/60 backdrop-blur-xl"
                >
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full scale-150 animate-pulse" />
                        <div className="relative p-1 rounded-full bg-gradient-to-tr from-primary via-accent to-primary animate-[spin_3s_linear_infinite]">
                            <div className="bg-black rounded-full p-8">
                                {status === 'ended' ? (
                                    <PhoneOff className="h-16 w-16 text-rose-500" />
                                ) : (
                                    <Loader2 className="h-16 w-16 text-primary animate-spin" />
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="text-center space-y-3">
                        <h2 className="text-white font-black font-headline text-4xl tracking-tight leading-tight">
                            {status === 'connecting' ? 'Inisialisasi...' : 
                             status === 'calling' ? 'Memanggil Pujangga...' : 
                             status === 'ended' ? 'Panggilan Berakhir' : 'Menghubungkan...'}
                        </h2>
                        <div className="flex items-center justify-center gap-3">
                            <Zap className="h-3 w-3 text-primary animate-pulse" />
                            <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em]">Elitera Nexus System</p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        <motion.div 
            drag
            dragConstraints={{ left: -300, right: 300, top: -400, bottom: 400 }}
            className="absolute top-10 right-6 w-32 md:w-56 aspect-[9/16] bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl border-2 border-white/10 z-50 group cursor-move ring-1 ring-white/5"
        >
            <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className={cn("w-full h-full object-cover", isVideoOff && "hidden")}
            />
            {isVideoOff && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-white/20 gap-2">
                    <VideoOff className="h-8 w-8" />
                    <span className="text-[8px] font-black uppercase tracking-widest">Privasi</span>
                </div>
            )}
        </motion.div>
      </div>

      <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-8 z-[100] px-6">
        <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-4 bg-white/[0.03] backdrop-blur-3xl p-5 rounded-[3.5rem] border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.4)] ring-1 ring-white/5"
        >
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleMute}
                className={cn(
                    "h-16 w-16 rounded-full transition-all duration-500",
                    isMuted ? "bg-rose-500 text-white shadow-xl shadow-rose-500/20" : "text-white hover:bg-white/10"
                )}
            >
                {isMuted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
            </Button>
            
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={toggleVideo}
                className={cn(
                    "h-16 w-16 rounded-full transition-all duration-500",
                    isVideoOff ? "bg-rose-500 text-white shadow-xl shadow-rose-500/20" : "text-white hover:bg-white/10"
                )}
            >
                {isVideoOff ? <VideoOff className="h-7 w-7" /> : <Video className="h-7 w-7" />}
            </Button>

            <div className="w-px h-12 bg-white/10 mx-2" />

            <Button 
                onClick={hangUpCall} 
                className="h-20 w-20 rounded-[2rem] bg-rose-600 hover:bg-rose-700 shadow-[0_15px_40px_rgba(225,29,72,0.4)] text-white active:scale-95 transition-all group"
            >
                <PhoneOff className="h-9 w-9 group-hover:rotate-12 transition-transform" />
            </Button>
        </motion.div>
        
        <div className="flex items-center gap-3 opacity-20 select-none grayscale">
            <Sparkles className="h-3 w-3 text-primary" />
            <p className="text-[8px] font-black uppercase tracking-[0.5em] text-white">Sesi Visual Terenkripsi</p>
        </div>
      </div>

      <Button 
        variant="ghost" 
        size="icon" 
        onClick={hangUpCall} 
        className="absolute top-10 left-6 text-white/40 hover:text-white rounded-full bg-white/[0.02] border border-white/5 h-12 w-12 active:scale-90 transition-all"
      >
        <X className="h-6 w-6" />
      </Button>
    </div>
  );
}
