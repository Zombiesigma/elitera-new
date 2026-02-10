'use client';

import { useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, documentId, orderBy } from 'firebase/firestore';
import type { User, Follow } from '@/lib/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Users, UserPlus, ChevronRight, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface FollowsSheetProps {
  userId: string;
  type: 'followers' | 'following';
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function FollowsSheet({ userId, type, open, onOpenChange }: FollowsSheetProps) {
  const firestore = useFirestore();

  useEffect(() => {
    if (!open) {
        const timer = setTimeout(() => {
            document.body.style.pointerEvents = '';
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [open]);

  const title = type === 'followers' ? 'Pengikut' : 'Mengikuti';

  const followsQuery = useMemo(() => (
    firestore ? query(collection(firestore, 'users', userId, type), orderBy('followedAt', 'desc')) : null
  ), [firestore, userId, type]);

  const { data: follows, isLoading: areFollowsLoading } = useCollection<Follow>(followsQuery);

  const userIds = useMemo(() => {
    if (!follows) return [];
    return follows.map(f => f.id).slice(0, 30);
  }, [follows]);

  const usersQuery = useMemo(() => {
    if (!firestore || userIds.length === 0) return null;
    return query(collection(firestore, 'users'), where(documentId(), 'in', userIds));
  }, [firestore, userIds]);

  const { data: users, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  const isLoading = areFollowsLoading || areUsersLoading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right"
        className="flex flex-col p-0 bg-background sm:max-w-md w-full border-l shadow-2xl"
        onCloseAutoFocus={(e) => {
            e.preventDefault();
            document.body.style.pointerEvents = '';
        }}
      >
        <SheetHeader className="px-6 py-8 border-b bg-muted/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                {type === 'followers' ? <Users className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
            <div>
                <SheetTitle className="text-2xl font-headline font-black tracking-tight">{title}</SheetTitle>
                <SheetDescription className="text-xs font-bold uppercase tracking-[0.1em] text-primary/60">
                    {isLoading ? 'Sinkronisasi data...' : `${users?.length || 0} pengguna ditemukan`}
                </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 py-6 px-6"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-14 w-14 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3 rounded-full" />
                      <Skeleton className="h-3 w-1/2 rounded-full" />
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : !users || users.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center h-full text-center p-10 opacity-40"
              >
                <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                    <Users className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="font-headline text-xl font-bold">Belum Ada Daftar</h3>
                <p className="text-sm max-w-[240px] mx-auto mt-2">Daftar {title.toLowerCase()} akan muncul di sini setelah aktivitas interaksi dilakukan.</p>
              </motion.div>
            ) : (
              <motion.div 
                key="list"
                initial="hidden"
                animate="show"
                variants={{
                    show: { transition: { staggerChildren: 0.05 } }
                }}
                className="py-4"
              >
                {users.map((user) => (
                  <motion.div
                    key={user.id}
                    variants={{
                        hidden: { opacity: 0, x: 20 },
                        show: { opacity: 1, x: 0 }
                    }}
                  >
                    <Link
                        href={`/profile/${user.username}`}
                        onClick={() => {
                            onOpenChange(false);
                            document.body.style.pointerEvents = '';
                        }}
                        className="flex items-center gap-4 px-6 py-4 transition-all hover:bg-muted/50 group relative"
                    >
                        <div className="relative">
                            <Avatar className="h-14 w-14 border-2 border-background shadow-md transition-transform group-hover:scale-105 group-active:scale-95">
                                <AvatarImage src={user.photoURL} alt={user.displayName} className="object-cover" />
                                <AvatarFallback className="bg-primary/5 text-primary font-black text-lg">
                                    {user.displayName.charAt(0)}
                                </AvatarFallback>
                            </Avatar>
                            {user.status === 'online' && (
                                <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background shadow-sm" />
                            )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <p className="font-black text-sm truncate group-hover:text-primary transition-colors">{user.displayName}</p>
                                {user.role === 'penulis' && (
                                    <Badge variant="secondary" className="h-4 px-1.5 text-[8px] font-black uppercase tracking-tighter bg-primary/5 text-primary border-none">Penulis</Badge>
                                )}
                            </div>
                            <p className="text-xs font-bold text-muted-foreground tracking-widest uppercase opacity-60">@{user.username}</p>
                        </div>

                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-1 group-hover:text-primary/50" />
                        
                        {/* Interactive border on hover */}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-0 bg-primary rounded-r-full transition-all duration-300 group-hover:h-8" />
                    </Link>
                  </motion.div>
                ))}
                
                {/* Extra space at the bottom */}
                <div className="h-20" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SheetContent>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </Sheet>
  );
}
