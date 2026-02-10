
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, writeBatch } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Bell, 
  MessageCircle, 
  UserPlus, 
  Heart, 
  PenTool, 
  Megaphone, 
  CheckCheck,
  ChevronRight,
  MessageSquare,
  Clapperboard,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, isToday, isYesterday } from 'date-fns';
import { id } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationsPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const notificationsQuery = useMemo(() => (
    (firestore && currentUser)
      ? query(collection(firestore, `users/${currentUser.uid}/notifications`), orderBy('createdAt', 'desc'))
      : null
  ), [firestore, currentUser]);

  const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);

  const handleNotificationClick = async (notification: Notification) => {
    if (firestore && !notification.read && currentUser) {
      const notifRef = doc(firestore, `users/${currentUser.uid}/notifications`, notification.id);
      updateDoc(notifRef, { read: true }).catch(err => console.error(err));
    }
    router.push(notification.link);
  };
  
  const handleMarkAllAsRead = async () => {
      if (!firestore || !currentUser || !notifications) return;

      const unreadNotifications = notifications.filter(n => !n.read);
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(firestore);
      unreadNotifications.forEach(notif => {
          const notifRef = doc(firestore, `users/${currentUser.uid}/notifications`, notif.id);
          batch.update(notifRef, { read: true });
      });
      await batch.commit();
  }

  // Helper to group notifications
  const groupedNotifications = useMemo(() => {
    if (!notifications) return { today: [], yesterday: [], earlier: [] };
    
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const earlier: Notification[] = [];

    notifications.forEach(notif => {
      const date = notif.createdAt.toDate();
      if (isToday(date)) today.push(notif);
      else if (isYesterday(date)) yesterday.push(notif);
      else earlier.push(notif);
    });

    return { today, yesterday, earlier };
  }, [notifications]);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'comment': return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'follow': return <UserPlus className="h-4 w-4 text-green-500" />;
      case 'favorite': return <Heart className="h-4 w-4 text-rose-500" fill="currentColor" />;
      case 'author_request': return <PenTool className="h-4 w-4 text-orange-500" />;
      case 'story_comment': return <MessageSquare className="h-4 w-4 text-indigo-500" />;
      case 'broadcast': return <Megaphone className="h-4 w-4 text-primary" />;
      case 'reel_like': return <Heart className="h-4 w-4 text-rose-500" fill="currentColor" />;
      case 'reel_comment': return <Clapperboard className="h-4 w-4 text-indigo-500" />;
      default: return <Bell className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const unreadCount = notifications?.filter(n => !n.read).length ?? 0;

  if (!isMounted) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest mb-3">
            <Bell className="h-3 w-3" /> Pusat Notifikasi
          </div>
          <h1 className="text-4xl font-headline font-black tracking-tight">Kabar <span className="text-primary">Terbaru</span></h1>
          <p className="text-muted-foreground mt-2 font-medium">
            {unreadCount > 0 
              ? `Anda memiliki ${unreadCount} pesan baru yang menunggu.` 
              : 'Semua kabar sudah Anda baca. Kerja bagus!'}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          disabled={unreadCount === 0} 
          onClick={handleMarkAllAsRead}
          className="rounded-full px-6 font-bold border-2 hover:bg-primary/5 hover:text-primary hover:border-primary/20 transition-all"
        >
          <CheckCheck className="mr-2 h-4 w-4" /> Tandai Dibaca
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-bold uppercase tracking-widest">Sinkronisasi Kabar...</p>
        </div>
      ) : notifications?.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-24 bg-card/50 backdrop-blur-sm rounded-[2.5rem] border-2 border-dashed border-muted flex flex-col items-center gap-6"
        >
          <div className="p-8 bg-muted rounded-full">
            <Bell className="h-16 w-16 text-muted-foreground/20" />
          </div>
          <div className="space-y-2">
            <h3 className="font-headline text-2xl font-bold">Hening di Sini...</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">Notifikasi tentang aktivitas karya dan interaksi Anda akan muncul di sini.</p>
          </div>
          <Button asChild variant="secondary" className="rounded-full px-8 font-bold">
            <a href="/">Jelajahi Karya</a>
          </Button>
        </motion.div>
      ) : (
        <div className="space-y-12">
          {Object.entries(groupedNotifications).map(([key, list]) => {
            if (list.length === 0) return null;
            
            const title = key === 'today' ? 'Hari Ini' : key === 'yesterday' ? 'Kemarin' : 'Sebelumnya';
            
            return (
              <section key={key} className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/60 pl-2">
                  {title}
                </h2>
                <div className="grid gap-3">
                  <AnimatePresence mode="popLayout">
                    {list.map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card 
                          className={cn(
                            "group cursor-pointer overflow-hidden border-none shadow-sm transition-all duration-300 hover:shadow-md hover:translate-x-1",
                            notification.read ? "bg-card/40" : "bg-card shadow-indigo-500/5 ring-1 ring-primary/10"
                          )}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <CardContent className="p-0">
                            <div className="flex items-center gap-4 p-4 md:p-5">
                              {/* Avatar & Badge */}
                              <div className="relative shrink-0">
                                <Avatar className="h-12 w-12 border-2 border-background shadow-sm group-hover:scale-105 transition-transform">
                                  <AvatarImage src={notification.actor.photoURL} alt={notification.actor.displayName} />
                                  <AvatarFallback className="bg-primary/5 text-primary font-black">
                                    {notification.actor.displayName.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-1 -right-1 bg-background p-1 rounded-full shadow-sm ring-1 ring-border">
                                  {getIcon(notification.type)}
                                </div>
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0 space-y-1">
                                <p className={cn(
                                  "text-sm leading-relaxed",
                                  notification.read ? "text-muted-foreground" : "text-foreground font-medium"
                                )}>
                                  <span className="font-black text-foreground">{notification.actor.displayName}</span>
                                  {" "}{notification.text.replace(notification.actor.displayName, '').trim()}
                                </p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                  {formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true, locale: id })}
                                </p>
                              </div>

                              {/* Unread dot / Arrow */}
                              <div className="shrink-0 flex items-center gap-3">
                                {!notification.read && (
                                  <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-pulse" />
                                )}
                                <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-colors group-hover:translate-x-1" />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  )
}
