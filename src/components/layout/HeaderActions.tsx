'use client';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MessageSquare, Bell } from 'lucide-react';
import { UserNav } from './UserNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';
import type { Chat, Notification, User as AppUser } from '@/lib/types';
import { collection, query, where, doc } from 'firebase/firestore';
import { useBrowserNotifier } from '@/hooks/use-browser-notifications';
import { cn } from '@/lib/utils';

export function HeaderActions() {
  const { user, isLoading } = useUser();
  const firestore = useFirestore();

  const chatThreadsQuery = useMemo(() => (
    (firestore && user)
      ? query(collection(firestore, 'chats'), where('participantUids', 'array-contains', user.uid))
      : null
  ), [firestore, user]);
  const { data: chatThreads } = useCollection<Chat>(chatThreadsQuery);

  const totalUnreadCount = useMemo(() => {
    if (!chatThreads || !user) return 0;
    return chatThreads.reduce((total, chat) => {
      return total + (chat.unreadCounts?.[user.uid] ?? 0);
    }, 0);
  }, [chatThreads, user]);

  const notificationsQuery = useMemo(() => (
    (firestore && user)
      ? query(collection(firestore, `users/${user.uid}/notifications`), where('read', '==', false))
      : null
  ), [firestore, user]);
  const { data: unreadNotifications } = useCollection<Notification>(notificationsQuery);

  const totalUnreadNotifCount = unreadNotifications?.length ?? 0;

  useBrowserNotifier(totalUnreadCount, totalUnreadNotifCount);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
    );
  }

  if (user) {
    return (
      <nav className="flex items-center gap-1.5">
        <Link href="/messages" className="relative group">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/5 hover:text-primary transition-all">
            <MessageSquare className="h-[1.1rem] w-[1.1rem]" />
            <span className="sr-only">Pesan</span>
          </Button>
          {totalUnreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white shadow-lg shadow-primary/20 ring-2 ring-background group-hover:scale-110 transition-transform">
                {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </span>
          )}
        </Link>
        
        <Link href="/notifications" className="relative group">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/5 hover:text-primary transition-all">
            <Bell className="h-[1.1rem] w-[1.1rem]" />
            <span className="sr-only">Notifikasi</span>
          </Button>
           {totalUnreadNotifCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white shadow-lg shadow-rose-500/20 ring-2 ring-background group-hover:scale-110 transition-transform">
                {totalUnreadNotifCount > 99 ? '99+' : totalUnreadNotifCount}
            </span>
          )}
        </Link>
        
        <div className="mx-1 h-6 w-px bg-border/50" />
        
        <UserNav />
      </nav>
    );
  }

  return (
    <nav className="flex items-center gap-3">
      <Link href="/login">
        <Button variant="ghost" className="rounded-full px-6 font-bold hover:bg-primary/5 hover:text-primary">Masuk</Button>
      </Link>
      <Link href="/register">
        <Button className="rounded-full px-6 font-bold shadow-lg shadow-primary/20">Daftar</Button>
      </Link>
    </nav>
  );
}
