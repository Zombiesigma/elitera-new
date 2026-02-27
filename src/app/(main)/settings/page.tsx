'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc, updateDoc, collection, query, where, getDocs, writeBatch, limit } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import type { User } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Upload, 
  User as UserIcon, 
  Palette, 
  Bell, 
  Shield, 
  Check, 
  Monitor, 
  Moon, 
  Sun, 
  Sparkles, 
  ChevronRight,
  Zap,
  Camera,
  AtSign,
  Fingerprint,
  Pencil,
  Volume2,
  Trash2
} from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { Skeleton } from '@/components/ui/skeleton';
import { uploadProfilePhoto } from '@/lib/uploader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const profileFormSchema = z.object({
  username: z.string()
    .min(3, { message: "Nama pengguna minimal 3 karakter." })
    .max(20, { message: "Nama pengguna maksimal 20 karakter." })
    .regex(/^[a-z0-9_]+$/, 'Hanya boleh berisi huruf kecil, angka, dan garis bawah.'),
  displayName: z.string().min(3, { message: "Nama lengkap minimal 3 karakter." }),
  photoURL: z.string().url({ message: "URL foto profil tidak valid." }).optional().or(z.literal('')),
  bio: z.string().max(160, { message: "Bio tidak boleh lebih dari 160 karakter." }).optional(),
});

const notificationFormSchema = z.object({
  onNewFollower: z.boolean().default(true),
  onBookComment: z.boolean().default(true),
  onBookFavorite: z.boolean().default(true),
  onStoryComment: z.boolean().default(true),
  onReelLike: z.boolean().default(true),
  onReelComment: z.boolean().default(true),
});

type SettingsTab = 'profile' | 'appearance' | 'notifications';

export default function SettingsPage() {
  const { user: currentUser, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [theme, setTheme] = useState('system');

  const userProfileRef = (firestore && currentUser) ? doc(firestore, 'users', currentUser.uid) : null;
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<User>(userProfileRef);

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: '',
      displayName: '',
      photoURL: '',
      bio: '',
    },
  });

  const notificationForm = useForm<z.infer<typeof notificationFormSchema>>({
    resolver: zodResolver(notificationFormSchema),
  });

  useEffect(() => {
    const localTheme = localStorage.getItem('theme') || 'system';
    setTheme(localTheme);
  }, []);
  
  const handleThemeChange = (value: string) => {
    setTheme(value);
    localStorage.setItem('theme', value);
    if (value === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (value === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', systemIsDark);
    }
    toast({ 
        title: "Tema Diubah", 
        description: `Tampilan aplikasi sekarang menggunakan mode ${value === 'system' ? 'sistem' : value === 'dark' ? 'gelap' : 'terang'}.`
    });
  };

  useEffect(() => {
    if (userProfile) {
      profileForm.reset({
        username: userProfile.username,
        displayName: userProfile.displayName,
        photoURL: userProfile.photoURL || '',
        bio: userProfile.bio || '',
      });
      notificationForm.reset({
        onNewFollower: userProfile.notificationPreferences?.onNewFollower ?? true,
        onBookComment: userProfile.notificationPreferences?.onBookComment ?? true,
        onBookFavorite: userProfile.notificationPreferences?.onBookFavorite ?? true,
        onStoryComment: userProfile.notificationPreferences?.onStoryComment ?? true,
        onReelLike: userProfile.notificationPreferences?.onReelLike ?? true,
        onReelComment: userProfile.notificationPreferences?.onReelComment ?? true,
      });
    }
  }, [userProfile, profileForm, notificationForm]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userProfile) return;

    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File Terlalu Besar',
        description: 'Maksimal ukuran foto adalah 2MB.',
      });
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadProfilePhoto(file, userProfile.displayName);
      profileForm.setValue('photoURL', url, { shouldDirty: true });
      toast({
        variant: 'success',
        title: "Foto Berhasil Diunggah",
        description: "Klik simpan untuk menerapkan perubahan profil Anda.",
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: "Upload Gagal",
        description: error.message || "Gagal mengunggah foto. Silakan coba lagi.",
      });
    } finally {
      setIsUploading(false);
    }
  };

  async function onProfileSubmit(values: z.infer<typeof profileFormSchema>) {
    if (!userProfileRef || !currentUser || !firestore || !userProfile) return;
    
    setIsSavingProfile(true);
    try {
      const normalizedUsername = values.username.toLowerCase();
      
      if (normalizedUsername !== userProfile.username) {
        const usernameQuery = query(
          collection(firestore, 'users'), 
          where('username', '==', normalizedUsername),
          limit(1)
        );
        const usernameSnap = await getDocs(usernameQuery);
        if (!usernameSnap.empty) {
          toast({
            variant: 'destructive',
            title: "Username Sudah Digunakan",
            description: "Silakan pilih username lain yang unik.",
          });
          setIsSavingProfile(false);
          return;
        }
      }

      await updateProfile(currentUser, {
        displayName: values.displayName,
        photoURL: values.photoURL || userProfile.photoURL,
      });

      const batch = writeBatch(firestore);

      batch.update(userProfileRef, {
        username: normalizedUsername,
        displayName: values.displayName,
        bio: values.bio || '',
        photoURL: values.photoURL || userProfile.photoURL,
      });

      const booksQuery = query(collection(firestore, 'books'), where('authorId', '==', currentUser.uid));
      const booksSnap = await getDocs(booksQuery);
      booksSnap.forEach((bookDoc) => {
        batch.update(bookDoc.ref, {
          authorName: values.displayName,
          authorUsername: normalizedUsername,
          authorAvatarUrl: values.photoURL || userProfile.photoURL,
        });
      });

      const storiesQuery = query(collection(firestore, 'stories'), where('authorId', '==', currentUser.uid));
      const storiesSnap = await getDocs(storiesQuery);
      storiesSnap.forEach((storyDoc) => {
        batch.update(storyDoc.ref, {
          authorName: values.displayName,
          authorUsername: normalizedUsername,
          authorAvatarUrl: values.photoURL || userProfile.photoURL,
        });
      });

      const reelsQuery = query(collection(firestore, 'reels'), where('authorId', '==', currentUser.uid));
      const reelsSnap = await getDocs(reelsQuery);
      reelsSnap.forEach((reelDoc) => {
        batch.update(reelDoc.ref, {
          authorName: values.displayName,
          authorUsername: normalizedUsername,
          authorAvatarUrl: values.photoURL || userProfile.photoURL,
        });
      });

      const chatsQuery = query(collection(firestore, 'chats'), where('participantUids', 'array-contains', currentUser.uid));
      const chatsSnap = await getDocs(chatsQuery);
      chatsSnap.forEach((chatDoc) => {
        const chatData = chatDoc.data();
        const updatedParticipants = chatData.participants.map((p: any) => {
          if (p.uid === currentUser.uid) {
            return { 
              ...p, 
              displayName: values.displayName, 
              photoURL: values.photoURL || userProfile.photoURL, 
              username: normalizedUsername 
            };
          }
          return p;
        });
        batch.update(chatDoc.ref, { participants: updatedParticipants });
      });

      await batch.commit();

      toast({
        variant: 'success',
        title: "Profil Diperbarui",
        description: "Semua perubahan identitas Anda telah disinkronkan ke seluruh sistem.",
      });
    } catch (error: any) {
      console.error("Error updating profile: ", error);
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: error.message || "Terjadi kesalahan saat menyinkronkan data profil Anda.",
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function onNotificationSubmit(values: z.infer<typeof notificationFormSchema>) {
    if (!userProfileRef) return;
    setIsSavingNotifications(true);
    try {
        await updateDoc(userProfileRef, { notificationPreferences: values });
        toast({ 
          variant: 'success',
          title: "Preferensi Diperbarui", 
          description: "Pengaturan notifikasi Anda telah disimpan secara aman." 
        });
    } catch (error) {
        toast({ variant: "destructive", title: "Gagal Menyimpan" });
    } finally {
        setIsSavingNotifications(false);
    }
  }

  const isLoading = isUserLoading || isProfileLoading;

  const NavItem = ({ tab, icon: Icon, label, description }: { tab: SettingsTab, icon: any, label: string, description?: string }) => (
    <button
        onClick={() => setActiveTab(tab)}
        className={cn(
            "flex items-center justify-between w-full p-5 rounded-[1.75rem] transition-all duration-500 group relative overflow-hidden",
            activeTab === tab 
                ? "bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]" 
                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
        )}
    >
        <div className="flex items-center gap-4 relative z-10">
            <div className={cn(
                "p-3 rounded-2xl transition-all duration-500 shadow-sm",
                activeTab === tab ? "bg-white/20 rotate-6" : "bg-muted group-hover:bg-primary/10 group-hover:text-primary"
            )}>
                <Icon className="h-5 w-5" />
            </div>
            <div className="text-left">
                <span className="font-black text-[13px] uppercase tracking-widest block">{label}</span>
                {description && <span className={cn("text-[9px] font-bold uppercase opacity-60", activeTab === tab ? "text-white" : "text-muted-foreground")}>{description}</span>}
            </div>
        </div>
        <ChevronRight className={cn("h-4 w-4 transition-transform relative z-10", activeTab === tab ? "translate-x-1" : "opacity-0 group-hover:opacity-100")} />
        
        {activeTab === tab && (
            <motion.div 
                layoutId="settings-nav-active" 
                className="absolute inset-0 bg-primary z-0" 
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
        )}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-32 relative overflow-x-hidden pt-6">
      {/* Decorative background blobs */}
      <div className="absolute top-0 right-[-10%] w-64 h-64 bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute bottom-1/2 left-[-10%] w-64 h-64 bg-accent/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="space-y-4 px-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[9px] font-black uppercase tracking-widest mb-3">
                <Shield className="h-3 w-3" /> Pusat Otoritas Profil
            </div>
            <h1 className="text-4xl md:text-6xl font-headline font-black tracking-tight leading-none italic">
                Pengaturan <span className="text-primary">Akun.</span>
            </h1>
            <p className="text-sm md:text-lg text-muted-foreground mt-4 font-medium italic max-w-2xl">
                "Harmonisasikan jati diri digital kawan dengan setiap bait karya yang tercipta di semesta Elitera."
            </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 px-4">
        <aside className="lg:col-span-4 space-y-6">
            <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-[2.5rem] p-3 space-y-2 shadow-2xl ring-1 ring-white/10">
                <NavItem tab="profile" icon={UserIcon} label="Profil Publik" description="Identitas & Narasi Diri" />
                <NavItem tab="appearance" icon={Palette} label="Tampilan" description="Estetika Antarmuka" />
                <NavItem tab="notifications" icon={Bell} label="Notifikasi" description="Frekuensi Kabar" />
            </div>
            
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-8 bg-indigo-950 text-white rounded-[2.5rem] border-none shadow-xl relative overflow-hidden group"
            >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform"><Shield className="h-24 w-24" /></div>
                <div className="flex items-center gap-3 mb-4 text-indigo-400 relative z-10">
                    <Zap className="h-5 w-5 fill-current" />
                    <span className="font-black text-[10px] uppercase tracking-[0.2em]">Integritas Data</span>
                </div>
                <p className="text-xs text-indigo-100/70 leading-relaxed font-medium relative z-10">
                    Setiap perubahan profil akan disinkronkan secara real-time ke seluruh jaringan Elitera. Kami menjaga privasi kawan dengan standar enkripsi industri.
                </p>
            </motion.div>
        </aside>

        <main className="lg:col-span-8">
            <AnimatePresence mode="wait">
                {activeTab === 'profile' && (
                    <motion.div
                        key="profile"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <Card className="border-none shadow-[0_30px_100px_-15px_rgba(0,0,0,0.1)] bg-card rounded-[3rem] overflow-hidden ring-1 ring-border/50">
                            <Form {...profileForm}>
                                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                                    <CardHeader className="bg-primary/5 p-8 md:p-12 border-b border-border/50">
                                        <div className="flex items-center gap-5">
                                            <div className="bg-white dark:bg-zinc-900 p-4 rounded-[1.5rem] shadow-xl text-primary ring-1 ring-primary/10">
                                                <Fingerprint className="h-7 w-7" />
                                            </div>
                                            <div>
                                                <CardTitle className="font-headline text-2xl md:text-3xl font-black tracking-tight">Profil Publik</CardTitle>
                                                <CardDescription className="font-medium text-muted-foreground/80 mt-1">Bagaimana dunia Elitera mengenali kawan.</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-8 md:p-12 space-y-12">
                                        {isLoading ? (
                                            <div className="space-y-10">
                                                <div className="flex items-center gap-8"><Skeleton className="h-32 w-32 rounded-full" /><div className="space-y-3 flex-1"><Skeleton className="h-4 w-1/3 rounded-full" /><Skeleton className="h-3 w-2/3 rounded-full" /></div></div>
                                                <div className="grid grid-cols-2 gap-8"><Skeleton className="h-14 w-full rounded-2xl" /><Skeleton className="h-14 w-full rounded-2xl" /></div>
                                                <Skeleton className="h-32 w-full rounded-[2rem]" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex flex-col md:flex-row items-center gap-10">
                                                    <div className="relative group">
                                                        <div className="absolute -inset-2 bg-gradient-to-tr from-primary via-accent to-primary rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-700" />
                                                        <Avatar className="h-36 w-36 md:h-44 md:w-44 border-4 border-background shadow-2xl relative z-10 transition-transform duration-700 group-hover:scale-105">
                                                            <AvatarImage src={profileForm.watch('photoURL')} className="object-cover" />
                                                            <AvatarFallback className="bg-primary/5 text-primary text-5xl font-black italic">
                                                                {profileForm.watch('displayName')?.charAt(0)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {isUploading && (
                                                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center z-[15] animate-in fade-in duration-300">
                                                                <Loader2 className="h-10 w-10 text-white animate-spin" />
                                                            </div>
                                                        )}
                                                        <button 
                                                            type="button"
                                                            onClick={() => document.getElementById('photo-upload')?.click()}
                                                            className="absolute bottom-2 right-2 z-20 bg-primary text-white p-3 rounded-2xl shadow-2xl ring-4 ring-background hover:scale-110 active:scale-90 transition-all group/btn"
                                                            disabled={isUploading}
                                                        >
                                                            <Camera className="h-5 w-5 group-hover/btn:rotate-12 transition-transform" />
                                                        </button>
                                                    </div>
                                                    <div className="flex-1 space-y-5 text-center md:text-left">
                                                        <div className="space-y-2">
                                                            <h4 className="font-black text-xl tracking-tight uppercase">Citra Visual kawan</h4>
                                                            <p className="text-sm text-muted-foreground leading-relaxed font-medium max-w-sm mx-auto md:mx-0">
                                                                Gunakan jati diri terbaik kawan. Citra ini akan mendampingi setiap bait narasi kawan di seluruh semesta Elitera.
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-wrap justify-center md:justify-start gap-3">
                                                            <Button 
                                                                type="button" 
                                                                variant="outline" 
                                                                className="rounded-full px-8 h-12 border-2 font-black uppercase text-[10px] tracking-widest hover:bg-primary/5 transition-all shadow-lg"
                                                                onClick={() => document.getElementById('photo-upload')?.click()}
                                                                disabled={isUploading}
                                                            >
                                                                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                                                Ganti Foto Profil
                                                            </Button>
                                                            {profileForm.watch('photoURL') && (
                                                                <Button 
                                                                    type="button" 
                                                                    variant="ghost" 
                                                                    className="rounded-full h-12 w-12 text-rose-500 hover:bg-rose-50 p-0"
                                                                    onClick={() => profileForm.setValue('photoURL', '', { shouldDirty: true })}
                                                                >
                                                                    <Trash2 className="h-5 w-5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                                    <FormField control={profileForm.control} name="username" render={({ field }) => (
                                                        <FormItem className="space-y-3">
                                                            <FormLabel className="font-black text-[10px] uppercase tracking-[0.2em] ml-1 text-primary/60">Username Khas</FormLabel>
                                                            <FormControl>
                                                                <div className="relative group">
                                                                    <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                                                                        <AtSign className="h-4 w-4 text-primary/40 group-focus-within:text-primary transition-colors" />
                                                                    </div>
                                                                    <Input placeholder="username" {...field} className="h-14 pl-12 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 font-bold shadow-inner text-lg transition-all" />
                                                                </div>
                                                            </FormControl>
                                                            <FormDescription className="text-[9px] ml-1 uppercase font-bold tracking-widest text-muted-foreground/50">Hanya huruf kecil, angka, dan garis bawah.</FormDescription>
                                                            <FormMessage className="text-[10px]" />
                                                        </FormItem>
                                                    )} />
                                                    
                                                    <FormField control={profileForm.control} name="displayName" render={({ field }) => (
                                                        <FormItem className="space-y-3">
                                                            <FormLabel className="font-black text-[10px] uppercase tracking-[0.2em] ml-1 text-primary/60">Nama Panggung</FormLabel>
                                                            <FormControl>
                                                                <div className="relative group">
                                                                    <Pencil className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/40 group-focus-within:text-primary transition-colors pointer-events-none" />
                                                                    <Input placeholder="Nama Anda" {...field} className="h-14 pl-12 rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 font-bold shadow-inner text-lg transition-all" />
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage className="text-[10px]" />
                                                        </FormItem>
                                                    )} />
                                                </div>

                                                <FormField control={profileForm.control} name="bio" render={({ field }) => (
                                                    <FormItem className="space-y-3">
                                                        <div className="flex items-center justify-between px-1">
                                                            <FormLabel className="font-black text-[10px] uppercase tracking-[0.2em] text-primary/60">Biografi Puitis</FormLabel>
                                                            <span className="text-[9px] font-black text-muted-foreground/40">{field.value?.length || 0}/160</span>
                                                        </div>
                                                        <FormControl>
                                                            <Textarea 
                                                                placeholder="Tuangkan esensi jiwa kawan di sini..." 
                                                                {...field} 
                                                                rows={5} 
                                                                className="rounded-[2rem] bg-muted/30 border-none focus-visible:ring-primary/20 font-medium resize-none py-6 px-8 text-base md:text-lg leading-relaxed shadow-inner no-scrollbar" 
                                                            />
                                                        </FormControl>
                                                        <FormMessage className="text-[10px]" />
                                                    </FormItem>
                                                )} />
                                            </>
                                        )}
                                    </CardContent>
                                    <CardFooter className="p-8 md:p-12 pt-0 flex justify-end">
                                        <Button 
                                            type="submit" 
                                            size="lg" 
                                            className="rounded-2xl px-12 h-16 font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden" 
                                            disabled={isSavingProfile || isLoading || isUploading || !profileForm.formState.isDirty}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-10 transition-opacity" />
                                            <div className="relative z-10 flex items-center gap-3">
                                                {isSavingProfile ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                                                Simpan Identitas
                                            </div>
                                        </Button>
                                    </CardFooter>
                                </form>
                            </Form>
                        </Card>
                    </motion.div>
                )}

                {activeTab === 'appearance' && (
                    <motion.div
                        key="appearance"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Card className="border-none shadow-2xl bg-card rounded-[3rem] overflow-hidden ring-1 ring-border/50">
                            <CardHeader className="bg-primary/5 p-8 md:p-12 border-b border-border/50">
                                <div className="flex items-center gap-5">
                                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-[1.5rem] shadow-xl text-primary ring-1 ring-primary/10">
                                        <Palette className="h-7 w-7" />
                                    </div>
                                    <div>
                                        <CardTitle className="font-headline text-2xl md:text-3xl font-black tracking-tight">Estetika Tampilan</CardTitle>
                                        <CardDescription className="font-medium text-muted-foreground/80 mt-1">Personalisasi atmosfer membaca kawan.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 md:p-12 space-y-10">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    {[
                                        { id: 'light', label: 'Terang', icon: Sun, color: 'bg-white border-zinc-200', desc: 'Fokus Cerah' },
                                        { id: 'dark', label: 'Gelap', icon: Moon, color: 'bg-zinc-950 border-zinc-800 text-white', desc: 'Nyaman Malam' },
                                        { id: 'system', label: 'Otomatis', icon: Monitor, color: 'bg-gradient-to-br from-white to-zinc-950 border-zinc-300', desc: 'Harmoni Sistem' }
                                    ].map((mode) => (
                                        <button
                                            key={mode.id}
                                            onClick={() => handleThemeChange(mode.id)}
                                            className={cn(
                                                "relative flex flex-col items-center gap-5 p-8 rounded-[2.5rem] border-2 transition-all duration-700 group",
                                                theme === mode.id ? "border-primary bg-primary/5 ring-8 ring-primary/5 scale-105 shadow-2xl" : "border-transparent bg-muted/20 hover:bg-muted/40"
                                            )}
                                        >
                                            <div className={cn("w-full aspect-video rounded-[1.5rem] border-2 mb-2 flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 duration-700", mode.color)}>
                                                <mode.icon className={cn("h-10 w-10 transition-colors", theme === mode.id ? "text-primary" : "text-muted-foreground/40")} />
                                            </div>
                                            <div className="text-center">
                                                <span className={cn("font-black text-sm uppercase tracking-widest block", theme === mode.id ? "text-primary" : "text-muted-foreground")}>{mode.label}</span>
                                                <span className="text-[9px] font-bold uppercase opacity-40 mt-1 block">{mode.desc}</span>
                                            </div>
                                            {theme === mode.id && (
                                                <motion.div 
                                                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                                                    className="absolute top-4 right-4 bg-primary text-white p-1.5 rounded-full shadow-lg ring-4 ring-background"
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                </motion.div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

                {activeTab === 'notifications' && (
                    <motion.div
                        key="notifications"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Card className="border-none shadow-2xl bg-card rounded-[3rem] overflow-hidden ring-1 ring-border/50">
                            <Form {...notificationForm}>
                                <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)}>
                                    <CardHeader className="bg-primary/5 p-8 md:p-12 border-b border-border/50">
                                        <div className="flex items-center gap-5">
                                            <div className="bg-white dark:bg-zinc-900 p-4 rounded-[1.5rem] shadow-xl text-primary ring-1 ring-primary/10">
                                                <Bell className="h-7 w-7" />
                                            </div>
                                            <div>
                                                <CardTitle className="font-headline text-2xl md:text-3xl font-black tracking-tight">Pusat Kabar</CardTitle>
                                                <CardDescription className="font-medium text-muted-foreground/80 mt-1">Tentukan frekuensi interaksi yang kawan terima.</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6 md:p-10 space-y-2">
                                        {[
                                            { name: 'onNewFollower', label: 'Pujangga Baru', desc: 'Dapatkan kabar saat seseorang mulai mengikuti jati diri kawan.', icon: UserIcon },
                                            { name: 'onBookComment', label: 'Ulasan Mahakarya', desc: 'Kabar seketika saat ada apresiasi baru pada naskah atau novel kawan.', icon: Pencil },
                                            { name: 'onBookFavorite', label: 'Koleksi Favorit', desc: 'Notifikasi saat karya kawan bertahta di hati pembaca.', icon: Heart },
                                            { name: 'onStoryComment', label: 'Respon Momen', desc: 'Kabar saat rekan pujangga membalas cerita singkat kawan.', icon: Sparkles },
                                            { name: 'onReelLike', label: 'Apresiasi Visual', desc: 'Saat video Reels kawan mendapatkan tanda suka.', icon: Zap },
                                            { name: 'onReelComment', label: 'Diskusi Video', desc: 'Notifikasi ulasan pada panggung Reels kawan.', icon: Volume2 }
                                        ].map((item) => (
                                            <FormField key={item.name} control={notificationForm.control} name={item.name as any} render={({ field }) => (
                                                <div 
                                                    className="flex items-center justify-between p-6 rounded-[2rem] transition-all duration-500 hover:bg-muted/30 group border border-transparent hover:border-border/50 cursor-pointer"
                                                    onClick={() => field.onChange(!field.value)}
                                                >
                                                    <div className="flex items-center gap-5">
                                                        <div className={cn(
                                                            "p-3 rounded-2xl transition-all duration-500",
                                                            field.value ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground/40"
                                                        )}>
                                                            <item.icon className="h-5 w-5" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="font-black text-sm md:text-base cursor-pointer transition-colors group-hover:text-primary uppercase tracking-tight">{item.label}</Label>
                                                            <p className="text-[11px] text-muted-foreground font-medium italic opacity-80">{item.desc}</p>
                                                        </div>
                                                    </div>
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-primary scale-110" />
                                                    </FormControl>
                                                </div>
                                            )} />
                                        ))}
                                    </CardContent>
                                    <CardFooter className="p-8 md:p-12 pt-0 flex justify-end">
                                        <Button 
                                            type="submit" 
                                            size="lg" 
                                            className="rounded-2xl px-12 h-16 font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden" 
                                            disabled={isSavingNotifications || isLoading || !notificationForm.formState.isDirty}
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-10 transition-opacity" />
                                            <div className="relative z-10 flex items-center gap-3">
                                                {isSavingNotifications ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                                                Simpan Preferensi
                                            </div>
                                        </Button>
                                    </CardFooter>
                                </form>
                            </Form>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
      </div>

      <div className="text-center opacity-20 select-none grayscale pb-16">
          <div className="flex items-center justify-center gap-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.5em]">Elitera Otoritas System v3.1</span>
          </div>
      </div>
    </div>
  );
}
