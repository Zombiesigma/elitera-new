'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { collection, serverTimestamp, doc, writeBatch, getDocs, query, where, orderBy } from 'firebase/firestore';
import type { AuthorRequest, User as AppUser, Book } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { BookUser, Loader2, Send, Info, Users, BookOpen, Star, Sparkles, ChevronRight, PenTool, CheckCircle2, Clock, Trophy, Crown, Medal, ArrowRight } from "lucide-react";
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  name: z.string().min(3, { message: "Nama lengkap minimal 3 karakter." }),
  email: z.string().email({ message: "Email tidak valid." }),
  portfolio: z.string().url({ message: "URL portofolio tidak valid." }).optional().or(z.literal('')),
  motivation: z.string().min(20, { message: "Motivasi minimal 20 karakter." }),
});

export default function JoinAuthorPage() {
    const { user, isLoading: isUserLoading } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [applicationStatus, setApplicationStatus] = useState<'loading' | 'not_applied' | 'pending' | 'author'>('loading');

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            email: "",
            portfolio: "",
            motivation: "",
        },
    });

    const { data: userProfile, isLoading: isProfileLoading } = useDoc<AppUser>(
      (firestore && user) ? doc(firestore, 'users', user.uid) : null
    );

    const authorRequestsQuery = useMemo(() => (
      (firestore && user) ? query(collection(firestore, 'authorRequests'), where('userId', '==', user.uid)) : null
    ), [firestore, user]);
    const { data: pendingRequests, isLoading: areRequestsLoading } = useCollection<AuthorRequest>(authorRequestsQuery);
    
    const usersQuery = useMemo(() => (
        (firestore && user) ? query(collection(firestore, 'users'), orderBy('displayName', 'asc')) : null
    ), [firestore, user]);
    const { data: allUsers, isLoading: areUsersLoading } = useCollection<AppUser>(usersQuery);

    const booksQuery = useMemo(() => (
        (firestore) ? query(collection(firestore, 'books'), where('status', '==', 'published')) : null
    ), [firestore]);
    const { data: allPublishedBooks, isLoading: areBooksLoading } = useCollection<Book>(booksQuery);
    
    const authorsWithStats = useMemo(() => {
      if (!allUsers || !allPublishedBooks) return [];
      
      const authors = allUsers.filter(u => u.role === 'penulis' || u.role === 'admin');
      
      return authors.map(author => {
          const bookCount = allPublishedBooks.filter(b => b.authorId === author.uid).length;
          return { ...author, bookCount };
      }).sort((a, b) => b.bookCount - a.bookCount || b.followers - a.followers);
    }, [allUsers, allPublishedBooks]);

    const topAuthors = useMemo(() => authorsWithStats.slice(0, 10), [authorsWithStats]);

    useEffect(() => {
      if (isUserLoading || isProfileLoading || areRequestsLoading) {
          setApplicationStatus('loading');
          return;
      }

      if (user && userProfile) {
          form.reset({
              name: user.displayName || '',
              email: user.email || '',
          });

          if (userProfile.role === 'penulis' || userProfile.role === 'admin') {
              setApplicationStatus('author');
          } else if (pendingRequests && pendingRequests.find(r => r.status === 'pending')) {
              setApplicationStatus('pending');
          } else {
              setApplicationStatus('not_applied');
          }
      } else if (!isUserLoading) {
          setApplicationStatus('not_applied');
      }
    }, [user, isUserLoading, userProfile, isProfileLoading, pendingRequests, areRequestsLoading, form]);


    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!firestore || !user) return;
        setIsSubmitting(true);
        try {
            const batch = writeBatch(firestore);

            const requestRef = doc(collection(firestore, 'authorRequests'));
            const requestData = {
                ...values,
                portfolio: values.portfolio || '',
                userId: user.uid,
                status: 'pending' as const,
                requestedAt: serverTimestamp(),
            };
            batch.set(requestRef, requestData);

            const adminsQuery = query(collection(firestore, 'users'), where('role', '==', 'admin'));
            const adminSnapshot = await getDocs(adminsQuery);

            if (!adminSnapshot.empty) {
                const notificationData = {
                    type: 'author_request' as const,
                    text: `${values.name} telah meminta untuk menjadi penulis.`,
                    link: `/admin`,
                    actor: {
                        uid: user.uid,
                        displayName: user.displayName!,
                        photoURL: user.photoURL!,
                    },
                    read: false,
                    createdAt: serverTimestamp(),
                };
                
                adminSnapshot.forEach(adminDoc => {
                    const adminId = adminDoc.id;
                    const notificationRef = doc(collection(firestore, `users/${adminId}/notifications`));
                    batch.set(notificationRef, notificationData);
                });
            }
            
            await batch.commit();

            toast({
                variant: 'success',
                title: "Lamaran Terkirim",
                description: "Terima kasih! Kami akan meninjau lamaran Anda segera.",
            });
            setApplicationStatus('pending');
        } catch (error) {
            console.error("Error submitting application:", error);
            toast({
                variant: "destructive",
                title: "Gagal Mengirim Lamaran",
                description: "Terjadi kesalahan. Silakan coba lagi.",
            });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    if (applicationStatus === 'loading') {
        return (
             <div className="max-w-4xl mx-auto space-y-8 py-12 px-4">
                <div className="text-center space-y-4">
                    <Skeleton className="h-10 md:h-12 w-48 md:w-64 mx-auto rounded-full" />
                    <Skeleton className="h-4 w-full max-w-md mx-auto rounded-full" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i} className="h-72 md:h-80 flex flex-col items-center justify-center space-y-6 rounded-[2rem] md:rounded-[2.5rem] border-none shadow-xl">
                            <Skeleton className="h-20 w-20 md:h-24 md:w-24 rounded-full" />
                            <div className="space-y-2 w-full px-8 md:px-10 text-center">
                                <Skeleton className="h-4 w-full rounded-full" />
                                <Skeleton className="h-3 w-2/3 mx-auto rounded-full" />
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    if (applicationStatus === 'author') {
         return (
            <div className="space-y-12 md:space-y-20 pb-20 relative overflow-x-hidden w-full">
                <div className="absolute top-[-50px] left-[-50px] w-64 md:w-96 h-64 md:h-96 bg-primary/5 rounded-full blur-[80px] md:blur-[120px] -z-10 pointer-events-none" />
                <div className="absolute bottom-20 right-[-30px] w-64 md:w-80 h-64 md:h-80 bg-accent/5 rounded-full blur-[80px] md:blur-[100px] -z-10 pointer-events-none" />

                <div className="text-center space-y-6 max-w-3xl mx-auto pt-4 px-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-4 md:mb-6">
                            <Sparkles className="h-3 w-3 md:h-3.5 md:w-3.5" /> Jajaran Penulis Elitera
                        </div>
                        <h1 className="text-3xl md:text-6xl font-headline font-black text-foreground tracking-tight leading-tight">
                            Temui Para <span className="text-primary italic underline decoration-primary/20 underline-offset-8">Penulis</span> Kalcer
                        </h1>
                        <p className="mt-4 md:mt-6 text-sm md:text-lg text-muted-foreground leading-relaxed font-medium italic">
                            "Mereka adalah arsitek imajinasi yang membangun dunia lewat kata-kata. Jelajahi, ikuti, dan biarkan inspirasi mereka mengalir ke dalam harimu."
                        </p>
                    </motion.div>
                </div>

                <section className="space-y-8">
                    <div className="flex items-center justify-between px-4 md:px-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-yellow-500/10 text-yellow-600">
                                <Trophy className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-lg md:text-xl font-headline font-black tracking-tight">Pujangga Terproduktif</h2>
                                <p className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Berdasarkan jumlah mahakarya terbit</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-stretch gap-4 md:gap-6 overflow-x-auto no-scrollbar px-4 md:px-6 pb-4">
                        {(areUsersLoading || areBooksLoading) ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-48 w-40 md:w-48 rounded-[2rem] flex-shrink-0" />
                            ))
                        ) : topAuthors.map((author, idx) => (
                            <motion.div 
                                key={author.id} 
                                initial={{ opacity: 0, scale: 0.9 }} 
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                className="flex-shrink-0"
                            >
                                <Link href={`/profile/${author.username.toLowerCase()}`}>
                                    <Card className={cn(
                                        "w-40 md:w-48 h-full border-none shadow-lg rounded-[2rem] md:rounded-[2.5rem] relative overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-1 group bg-card/50 backdrop-blur-xl",
                                        idx === 0 ? "ring-2 ring-yellow-500/30" : idx === 1 ? "ring-2 ring-zinc-400/30" : idx === 2 ? "ring-2 ring-orange-400/30" : ""
                                    )}>
                                        <div className={cn(
                                            "absolute top-0 left-0 right-0 h-16 md:h-20 opacity-20 group-hover:h-20 md:group-hover:h-24 transition-all duration-500",
                                            idx === 0 ? "bg-yellow-500" : idx === 1 ? "bg-zinc-400" : idx === 2 ? "bg-orange-400" : "bg-primary"
                                        )} />
                                        
                                        <CardContent className="pt-8 md:pt-10 p-4 md:p-6 text-center flex flex-col items-center relative z-10">
                                            <div className="relative mb-4">
                                                <Avatar className="h-16 w-16 md:h-20 md:w-20 border-4 border-background shadow-xl">
                                                    <AvatarImage src={author.photoURL} className="object-cover" />
                                                    <AvatarFallback className="bg-primary/5 text-primary font-black">{author.displayName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div className={cn(
                                                    "absolute -top-2 -right-2 p-1.5 rounded-full shadow-lg border-2 border-background flex items-center justify-center",
                                                    idx === 0 ? "bg-yellow-500 text-white" : idx === 1 ? "bg-zinc-400 text-white" : idx === 2 ? "bg-orange-400 text-white" : "bg-muted text-muted-foreground"
                                                )}>
                                                    {idx === 0 ? <Crown className="h-3 w-3 md:h-4 md:w-4" /> : <span className="text-[8px] md:text-[10px] font-black px-1">#{idx + 1}</span>}
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-0.5">
                                                <p className="font-black text-xs md:text-sm truncate max-w-[120px] group-hover:text-primary transition-colors">{author.displayName}</p>
                                                <p className="text-[8px] md:text-[9px] font-bold text-muted-foreground uppercase tracking-widest">@{author.username}</p>
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-border/50 w-full">
                                                <div className="flex items-center justify-center gap-1.5 text-primary">
                                                    <BookOpen className="h-3 w-3" />
                                                    <span className="font-black text-sm md:text-base tracking-tighter">{author.bookCount}</span>
                                                    <span className="text-[8px] font-bold uppercase tracking-widest opacity-60">Karya</span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </section>

                <div className="px-4 md:px-6">
                    <div className="flex items-center gap-4 mb-10">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60 flex items-center gap-3 whitespace-nowrap">
                            <Users className="h-4 w-4 text-primary" /> Direktori Pujangga
                        </h2>
                        <div className="h-px bg-border/50 flex-1" />
                    </div>

                    {areUsersLoading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                            {Array.from({length: 6}).map((_, i) => (
                                <Skeleton key={i} className="h-80 w-full rounded-[2.5rem]" />
                            ))}
                        </div>
                    ) : (
                        <motion.div 
                            initial="hidden"
                            animate="show"
                            variants={{
                                show: { transition: { staggerChildren: 0.1 } }
                            }}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8"
                        >
                            {authorsWithStats.map((author) => (
                                <motion.div
                                    key={author.id}
                                    variants={{
                                        hidden: { opacity: 0, y: 20 },
                                        show: { opacity: 1, y: 0 }
                                    }}
                                >
                                    <Link href={`/profile/${author.username.toLowerCase()}`} className="block group h-full">
                                        <Card className={cn(
                                            "relative overflow-hidden rounded-[2.5rem] md:rounded-[3rem] border-none transition-all duration-500 h-full shadow-lg hover:shadow-2xl group-hover:-translate-y-1 bg-card/50 backdrop-blur-xl border border-white/10",
                                            author.uid === user?.uid && "ring-2 ring-primary/20"
                                        )}>
                                            <div className="absolute top-0 left-0 w-full h-28 md:h-36 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent group-hover:h-32 md:group-hover:h-44 transition-all duration-700" />
                                            
                                            <CardContent className="relative z-10 p-6 md:p-8 pt-10 md:pt-12 text-center flex flex-col items-center h-full">
                                                <div className="relative mb-6 md:mb-8">
                                                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl scale-125 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                                    
                                                    <Avatar className="w-24 h-24 md:w-36 md:h-36 border-4 border-background shadow-2xl transition-all duration-700 group-hover:scale-105 group-active:scale-95 ring-1 ring-border/50">
                                                        <AvatarImage src={author.photoURL} alt={author.displayName} className="object-cover" />
                                                        <AvatarFallback className="text-2xl md:text-4xl font-black bg-primary/5 text-primary italic">
                                                            {author.displayName.charAt(0)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    
                                                    <div className="absolute -bottom-1 -right-1 bg-primary text-white p-1.5 md:p-2.5 rounded-full shadow-xl ring-2 md:ring-4 ring-background z-20">
                                                        <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5" />
                                                    </div>
                                                    
                                                    {author.status === 'online' && (
                                                        <span className="absolute top-1 right-1 md:top-2 md:right-2 block h-3 w-3 md:h-5 md:w-5 rounded-full bg-green-500 border-2 md:border-4 border-background shadow-lg z-20 animate-pulse" />
                                                    )}
                                                </div>

                                                <div className="space-y-1">
                                                    <h3 className="font-headline text-2xl md:text-3xl font-black text-foreground group-hover:text-primary transition-colors duration-300 tracking-tight">{author.displayName}</h3>
                                                    <div className="flex items-center justify-center gap-2">
                                                        <p className="text-[9px] md:text-[10px] font-black text-muted-foreground/60 tracking-widest uppercase">@{author.username}</p>
                                                        {author.uid === user?.uid && (
                                                            <span className="bg-primary/10 text-primary text-[7px] md:text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase">Anda</span>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                <div className="my-6 md:my-8 w-12 h-1 bg-primary/10 rounded-full group-hover:w-24 transition-all duration-700 ease-out" />

                                                <p className="text-xs md:text-base text-muted-foreground/80 leading-relaxed italic line-clamp-3 mb-8 px-2 md:px-4 font-medium min-h-[3rem] md:min-h-[4.5rem]">
                                                    {author.bio || `Seorang penjelajah kata di Elitera yang percaya bahwa setiap cerita memiliki keajaibannya sendiri.`}
                                                </p>
                                                
                                                <div className="mt-auto pt-6 md:pt-8 border-t border-border/50 grid grid-cols-3 gap-4 w-full relative">
                                                    <div className="text-center space-y-1">
                                                        <p className="font-black text-base md:text-xl text-primary tracking-tighter">{author.bookCount}</p>
                                                        <div className="flex items-center justify-center gap-1 text-[7px] md:text-[8px] uppercase font-black tracking-widest text-muted-foreground opacity-50">
                                                            Karya
                                                        </div>
                                                    </div>
                                                    <div className="text-center space-y-1">
                                                        <p className="font-black text-base md:text-xl text-foreground tracking-tighter">{new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(author.followers)}</p>
                                                        <div className="flex items-center justify-center gap-1 text-[7px] md:text-[8px] uppercase font-black tracking-widest text-muted-foreground opacity-50">
                                                            Pengikut
                                                        </div>
                                                    </div>
                                                    <div className="text-center space-y-1">
                                                        <p className="font-black text-base md:text-xl text-accent tracking-tighter">{author.following}</p>
                                                        <div className="flex items-center justify-center gap-1 text-[7px] md:text-[8px] uppercase font-black tracking-widest text-muted-foreground opacity-50">
                                                            Mengikuti
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </div>
                
                {!isProfileLoading && userProfile?.role === 'pembaca' && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="mt-16 md:mt-24 pt-12 md:pt-16 border-t border-border/50 text-center space-y-6 md:space-y-8 px-4"
                    >
                        <div className="p-8 md:p-12 rounded-[2.5rem] md:rounded-[3rem] bg-primary/5 border border-primary/10 max-w-2xl mx-auto shadow-inner">
                            <h4 className="text-2xl md:text-3xl font-headline font-black mb-2 md:mb-3">Siap Menjadi Bagian Dari Mereka?</h4>
                            <p className="text-muted-foreground font-medium text-sm md:text-base leading-relaxed mb-8 md:mb-10">
                                Bergabunglah bersama para pujangga di atas dan mulai bangun duniamu sendiri. Jadilah inspirasi bagi ribuan pembaca Elitera.
                            </p>
                            <Button 
                                onClick={() => setApplicationStatus('not_applied')}
                                size="lg" 
                                className="w-full sm:w-auto rounded-[1.25rem] px-12 h-16 font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
                            >
                                Mulai Perjalanan Sekarang <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </motion.div>
                )}
            </div>
        )
    }

     if (applicationStatus === 'pending') {
        return (
            <div className="max-w-4xl mx-auto py-10 md:py-20 relative px-4 overflow-x-hidden w-full">
                <div className="absolute top-0 right-[-30px] w-64 md:w-96 h-64 md:h-96 bg-accent/5 rounded-full blur-[80px] md:blur-[120px] -z-10 pointer-events-none" />
                <div className="absolute bottom-0 left-[-30px] w-48 md:w-72 h-48 md:h-72 bg-primary/5 rounded-full blur-[80px] md:blur-[100px] -z-10 pointer-events-none" />

                <motion.div 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Card className="text-center rounded-[2.5rem] md:rounded-[3rem] border-none shadow-2xl bg-card/50 backdrop-blur-xl overflow-hidden relative border border-white/20">
                        <CardHeader className="pt-12 md:pt-16 pb-8 md:pb-10 px-6 md:px-10 relative z-10">
                            <div className="mx-auto relative mb-8 md:mb-10">
                                <div className="absolute inset-0 bg-accent/20 blur-3xl rounded-full scale-150 animate-pulse" />
                                <div className="relative bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl text-accent w-fit mx-auto border border-accent/10">
                                    <Clock className="h-12 w-12 md:h-16 md:w-16 animate-[spin_10s_linear_infinite]" />
                                </div>
                            </div>
                            <CardTitle className="font-headline text-3xl md:text-5xl font-black mb-3 md:mb-4 leading-tight tracking-tight">
                                Permohonan Sedang <br/> <span className="text-accent italic underline decoration-accent/20">Ditinjau.</span>
                            </CardTitle>
                            <CardDescription className="text-base md:text-xl leading-relaxed text-muted-foreground font-medium max-w-2xl mx-auto italic">
                                "Sabar adalah kunci dari setiap karya agung. Tim kurasi kami sedang menelaah gairah sastra yang Anda kirimkan."
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="px-6 md:px-10 pb-12 md:pb-16 relative z-10">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 max-w-3xl mx-auto mt-2">
                                {[
                                    { icon: ShieldCheck, label: "Verifikasi", status: "Selesai", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                                    { icon: Medal, label: "Kurasi", status: "Berlangsung", color: "text-accent", bg: "bg-accent/10", active: true },
                                    { icon: Star, label: "Keputusan", status: "Menunggu", color: "text-muted-foreground", bg: "bg-muted" },
                                ].map((step, i) => (
                                    <div key={i} className={cn(
                                        "p-5 md:p-6 rounded-[2rem] border border-border/50 flex flex-col items-center gap-3 transition-all duration-500",
                                        step.active ? "bg-white dark:bg-zinc-800 shadow-xl scale-[1.02] md:scale-105 border-accent/20" : "bg-muted/30 opacity-60"
                                    )}>
                                        <div className={cn("p-2.5 md:p-3 rounded-2xl", step.bg, step.color)}>
                                            <step.icon className="h-5 w-5 md:h-6 md:w-6" />
                                        </div>
                                        <div className="text-center">
                                            <p className="font-black text-[10px] md:text-xs uppercase tracking-widest mb-0.5">{step.label}</p>
                                            <p className={cn("text-[8px] md:text-[10px] font-bold uppercase", step.color)}>{step.status}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-10 md:mt-12 p-5 md:p-6 rounded-[1.5rem] md:rounded-3xl bg-primary/5 border border-primary/10 max-w-2xl mx-auto flex items-start gap-3 md:gap-4 text-left">
                                <Info className="h-4 w-4 md:h-5 md:w-5 text-primary shrink-0 mt-0.5" />
                                <p className="text-[11px] md:text-sm text-muted-foreground leading-relaxed">
                                    Kami biasanya membutuhkan waktu <strong>1-3 hari kerja</strong> untuk memberikan keputusan. Anda akan menerima notifikasi instan segera setelah tim kami memberikan persetujuan.
                                </p>
                            </div>
                        </CardContent>

                        <CardFooter className="flex flex-col sm:flex-row justify-center items-center gap-3 md:gap-4 relative z-10 px-6 md:px-10 pb-12 md:pb-16">
                            <Button asChild size="lg" className="w-full sm:w-auto rounded-full px-8 md:px-10 h-14 font-black shadow-xl shadow-primary/20 transition-all active:scale-95 text-xs md:text-sm">
                                <Link href="/"><BookOpen className="mr-2 h-4 w-4" /> Jelajahi Buku Lain</Link>
                            </Button>
                            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto rounded-full px-8 md:px-10 h-14 font-black border-2 transition-all hover:bg-muted/50 text-xs md:text-sm">
                                <Link href="/ai"><Sparkles className="mr-2 h-4 w-4 text-primary" /> Tanya Elitera AI</Link>
                            </Button>
                        </CardFooter>
                    </Card>
                </motion.div>
            </div>
        )
    }

  return (
    <div className="max-w-5xl mx-auto py-8 md:py-12 px-4 overflow-x-hidden w-full">
      <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
        <div className="lg:col-span-5 space-y-8 md:space-y-10">
            <div className="space-y-4 md:space-y-6">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-3 md:mb-4">
                        <PenTool className="h-3 w-3" /> Karir Penulis
                    </div>
                    <h1 className="text-3xl md:text-5xl font-headline font-black leading-tight tracking-tight text-foreground">
                        Mulai Perjalanan <br/> <span className="text-primary italic underline decoration-primary/20 underline-offset-8">Sastramu</span> Anda
                    </h1>
                    <p className="mt-4 md:mt-6 text-base md:text-lg text-muted-foreground leading-relaxed font-medium">
                        Bergabunglah dengan komunitas pujangga modern dan mulai bagikan dunia imajinasi Anda kepada pembaca global di Elitera.
                    </p>
                </motion.div>
            </div>

            <div className="space-y-6 md:space-y-8">
                {[
                    { icon: BookOpen, title: "Publikasi Tanpa Batas", desc: "Unggah karya Anda tanpa biaya sepeser pun dan jangkau audiens yang tepat.", color: "text-blue-500" },
                    { icon: Users, title: "Bangun Komunitas", desc: "Terhubung langsung dengan pembaca setia melalui pesan dan cerita singkat.", color: "text-green-500" },
                    { icon: Star, title: "Reputasi & Verifikasi", desc: "Dapatkan lencana penulis resmi dan tingkatkan otoritas Anda di dunia literasi.", color: "text-orange-500" }
                ].map((item, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + (i * 0.1) }}
                        className="flex gap-4 md:gap-5 items-start group"
                    >
                        <div className={cn("p-3 md:p-3.5 rounded-xl md:rounded-2xl shrink-0 bg-white shadow-xl shadow-primary/5 transition-transform group-hover:scale-110 duration-300", item.color)}>
                            <item.icon className="h-5 w-5 md:h-6 md:w-6" />
                        </div>
                        <div className="space-y-0.5 md:space-y-1">
                            <h4 className="font-black text-base md:text-lg group-hover:text-primary transition-colors">{item.title}</h4>
                            <p className="text-xs md:text-sm text-muted-foreground leading-relaxed font-medium">{item.desc}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>

        <div className="lg:col-span-7">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, type: 'spring' }}
            >
                <Card className="rounded-[2.5rem] md:rounded-[3rem] border-none shadow-2xl bg-card overflow-hidden">
                    <CardHeader className="bg-primary/5 p-6 md:p-10 border-b border-primary/10">
                        <div className="flex items-center gap-4 md:gap-5">
                            <div className="bg-white p-3 md:p-4 rounded-[1.25rem] md:rounded-[1.5rem] shadow-xl text-primary">
                                <BookUser className="h-6 w-6 md:h-8 md:w-8" />
                            </div>
                            <div>
                                <CardTitle className="text-xl md:text-2xl font-headline font-black">Formulir Pujangga</CardTitle>
                                <CardDescription className="font-bold uppercase tracking-[0.2em] text-[8px] md:text-[10px] text-primary/60 mt-0.5">Lengkapi data diri untuk kurasi</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <CardContent className="p-6 md:p-10 space-y-6 md:space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-black text-[10px] md:text-xs uppercase tracking-widest ml-1">Nama Lengkap</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="Guntur Padilah" {...field} className="h-12 md:h-14 rounded-xl md:rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 font-bold px-4 md:px-5 text-sm" />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-black text-[10px] md:text-xs uppercase tracking-widest ml-1">Email Resmi</FormLabel>
                                                <FormControl>
                                                    <Input type="email" {...field} readOnly className="h-12 md:h-14 rounded-xl md:rounded-2xl bg-muted/50 border-none cursor-not-allowed opacity-70 px-4 md:px-5 font-bold text-sm" />
                                                </FormControl>
                                                <FormMessage className="text-[10px]" />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="portfolio"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-black text-[10px] md:text-xs uppercase tracking-widest ml-1">Portofolio / Tautan Karya (Opsional)</FormLabel>
                                            <FormControl>
                                                <Input placeholder="https://karyasaya.com" {...field} className="h-12 md:h-14 rounded-xl md:rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 font-bold px-4 md:px-5 text-sm" />
                                            </FormControl>
                                            <FormDescription className="text-[9px] md:text-[10px] font-bold text-muted-foreground/60 ml-1 uppercase tracking-tighter">Tautkan tulisan atau blog yang pernah Anda publikasikan.</FormDescription>
                                            <FormMessage className="text-[10px]" />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="motivation"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-black text-[10px] md:text-xs uppercase tracking-widest ml-1">Apa visi Anda bergabung di Elitera?</FormLabel>
                                            <FormControl>
                                                <Textarea 
                                                    placeholder="Ceritakan gairah menulis Anda dan apa yang ingin Anda capai..." 
                                                    rows={5} 
                                                    {...field} 
                                                    className="rounded-[1.5rem] md:rounded-[2rem] bg-muted/30 border-none focus-visible:ring-primary/20 resize-none py-4 px-5 md:py-5 md:px-6 font-medium text-sm md:text-base leading-relaxed"
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[10px]" />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                            <CardFooter className="p-6 md:p-10 pt-0">
                                <Button type="submit" className="w-full h-14 md:h-16 rounded-[1.25rem] md:rounded-[1.5rem] font-black text-sm md:text-base shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 group overflow-hidden relative" disabled={isSubmitting}>
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-10 transition-opacity" />
                                    {isSubmitting ? (
                                        <><Loader2 className="mr-2 md:mr-3 h-5 w-5 md:h-6 md:w-6 animate-spin"/> Sedang Mengirim...</>
                                    ) : (
                                        <><Send className="mr-2 md:mr-3 h-4 w-4 md:h-5 md:w-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"/> Ajukan Lamaran Penulis</>
                                    )}
                                </Button>
                            </CardFooter>
                        </form>
                    </Form>
                </Card>
            </motion.div>
        </div>
      </div>
    </div>
  )
}
