'use client';

import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Logo } from '@/components/Logo';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ProtectedLayout handles authentication guarding and provides a premium
 * splash screen experience during initial session loading.
 */
export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [showChildren, setShowChildren] = useState(false);

  useEffect(() => {
    // Auth Guard: Redirect to login if not authenticated after loading is done
    if (!isLoading && !user) {
      // Force unfreeze body on logout to prevent pointer-events issues
      if (typeof document !== 'undefined') {
        document.body.style.pointerEvents = 'auto';
        document.body.style.overflow = 'auto';
      }
      router.replace('/login');
    }
    
    // Smooth transition to app content once user is ready
    if (!isLoading && user) {
        const timer = setTimeout(() => setShowChildren(true), 1200); 
        return () => clearTimeout(timer);
    }
  }, [user, isLoading, router]);
  
  // Real-time status update system
  useEffect(() => {
    if (!firestore || !user) return;

    const userStatusRef = doc(firestore, 'users', user.uid);

    // Initial check-in
    updateDoc(userStatusRef, {
      status: 'online',
      lastSeen: serverTimestamp(),
    }).catch(err => console.warn("Failed to set initial status:", err));

    // Maintain session heartbeat
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
          updateDoc(userStatusRef, {
            lastSeen: serverTimestamp(),
          }).catch(err => console.warn("Periodic heartbeat failed:", err));
      }
    }, 2 * 60 * 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [firestore, user]);


  // Splash Screen State
  if (isLoading || !user || !showChildren) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background overflow-hidden">
        {/* Decorative Background Blur Elements */}
        <div className="absolute top-[-15%] left-[-15%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[50%] h-[50%] bg-accent/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative flex flex-col items-center">
            {/* Animated Logo with Glow */}
            <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ 
                    duration: 1,
                    ease: [0.16, 1, 0.3, 1] 
                }}
                className="relative mb-10"
            >
                {/* Outer Glow Effect */}
                <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full scale-150 animate-pulse" />
                
                {/* Logo Frame */}
                <div className="relative z-10 p-1 rounded-[2.5rem] bg-gradient-to-tr from-primary via-accent to-primary shadow-2xl shadow-primary/20">
                    <Logo className="w-28 h-28 md:w-32 md:h-32 rounded-[2.3rem] ring-4 ring-background" />
                </div>
            </motion.div>

            {/* App Branding & Loading Progress */}
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="space-y-6 text-center"
            >
                <div className="space-y-1">
                    <h1 className="text-5xl md:text-6xl font-headline font-black tracking-tight text-foreground">
                        Elitera
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/60">
                        Jembatan Pujangga Modern
                    </p>
                </div>
                
                {/* Modern Loading Indicator (Dots) */}
                <div className="flex items-center justify-center gap-4 pt-4">
                    <div className="flex gap-1.5">
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                animate={{ 
                                    scale: [1, 1.6, 1],
                                    opacity: [0.3, 1, 0.3]
                                }}
                                transition={{ 
                                    repeat: Infinity, 
                                    duration: 1.2, 
                                    delay: i * 0.2,
                                    ease: "easeInOut"
                                }}
                                className="w-2 h-2 rounded-full bg-primary"
                            />
                        ))}
                    </div>
                </div>
            </motion.div>
            
            {/* Footer Tagline */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="absolute bottom-16 flex items-center gap-2 text-muted-foreground/30 select-none"
            >
                <Sparkles className="w-3 h-3" />
                <span className="text-[9px] font-black uppercase tracking-[0.2em]">Digital Literacy Ecosystem</span>
            </motion.div>
        </div>
      </div>
    );
  }

  // Final content render
  return (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
    >
        {children}
    </motion.div>
  );
}
