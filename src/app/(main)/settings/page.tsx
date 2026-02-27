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
import { Loader2, Upload, User as UserIcon, Palette, Bell, Shield, Check, Monitor, Moon, Sun, Sparkles, ChevronRight } from 'lucide-react';
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
      // Simpan dengan struktur: foto profile/{nama user}/{filename} kawan
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

  const NavItem = ({ tab, icon: Icon, label }: { tab: SettingsTab, icon: any, label: string }) => (
    <button
        onClick={() => setActiveTab(tab)}
        className={cn(
            "flex items-center justify-between w-full p-4 rounded-2xl transition-all duration-300 group",
            activeTab === tab 
                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
        )}
    >
        <div className="flex items-center gap-3">
            <div className={cn(
                "p-2 rounded-xl transition-colors",
                activeTab === tab ? "bg-white/20" : "bg-muted group-hover:bg-muted-foreground/10"
            )}>
                <Icon className="h-5 w-5" />
            </div>
            <span className="font-bold text-sm">{label}</span>
        </div>
        <ChevronRight className={cn("h-4 w-4 transition-transform", activeTab === tab ? "translate-x-1" : "opacity-0 group-hover:opacity-100")} />
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20">
      <div className="space-y-2 px-2">
        <h1 className="text-4xl font-headline font-black tracking-tight italic">Pengaturan <span className="text-primary underline decoration-primary/20">Akun</span></h1>
        <p className="text-muted-foreground font-medium">Kelola identitas digital dan preferensi Elitera Anda.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <aside className="lg:col-span-4 space-y-4 px-2">
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-[2.5rem] p-3 space-y-1 shadow-xl">
                <NavItem tab="profile" icon={UserIcon} label="Profil Publik" />
                <NavItem tab="appearance" icon={Palette} label="Tampilan" />
                <NavItem tab="notifications" icon={Bell} label="Notifikasi" />
            </div>
            
            <div className="p-8 bg-primary/5 rounded-[2.5rem] border border-primary/10">
                <div className="flex items-center gap-3 mb-3 text-primary">
                    <Shield className="h-5 w-5" />
                    <span className="font-black text-xs uppercase tracking-widest">Keamanan Data</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">Informasi Anda dienkripsi secara aman. Pastikan Anda tidak membagikan kredensial login kepada siapa pun.</p>
            </div>
        </aside>

        <main className="lg:col-span-8 px-2">
            <AnimatePresence mode="wait">
                {activeTab === 'profile' && (
                    <motion.div
                        key="profile"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                    >
                        <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-md rounded-[2.5rem] overflow-hidden">
                            <Form {...profileForm}>
                                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                                    <CardHeader className="bg-muted/30 p-8 border-b border-border/50">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-white p-3 rounded-2xl shadow-sm text-primary">
                                                <UserIcon className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <CardTitle className="font-headline text-2xl font-black">Profil Publik</CardTitle>
                                                <CardDescription className="font-medium">Identitas Anda di hadapan seluruh komunitas Elitera.</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-8 space-y-10">
                                        {isLoading ? (
                                            <div className="space-y-8">
                                                <div className="flex items-center gap-6"><Skeleton className="h-24 w-24 rounded-full" /><Skeleton className="h-10 w-48 rounded-full" /></div>
                                                <div className="space-y-4">
                                                    <Skeleton className="h-12 w-full rounded-xl" />
                                                    <Skeleton className="h-12 w-full rounded-xl" />
                                                    <Skeleton className="h-24 w-full rounded-xl" />
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex flex-col sm:flex-row items-center gap-8">
                                                    <div className="relative group">
                                                        <Avatar className="h-32 w-32 border-4 border-background shadow-2xl transition-transform group-hover:scale-105 duration-500">
                                                            <AvatarImage src={profileForm.watch('photoURL')} className="object-cover" />
                                                            <AvatarFallback className="bg-primary/5 text-primary text-4xl font-black italic">
                                                                {profileForm.watch('displayName')?.charAt(0)}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        {isUploading && (
                                                            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center z-10">
                                                                <Loader2 className="h-8 w-8 text-white animate-spin" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 space-y-4 text-center sm:text-left">
                                                        <div className="space-y-1">
                                                            <h4 className="font-bold text-lg">Foto Identitas</h4>
                                                            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto sm:mx-0">Gunakan foto wajah yang jelas agar mudah dikenali oleh pembaca. Maks 2MB.</p>
                                                        </div>
                                                        <Button 
                                                            type="button" 
                                                            variant="outline" 
                                                            size="sm" 
                                                            className="rounded-full px-6 border-2 font-bold hover:bg-primary/5 transition-all"
                                                            onClick={() => document.getElementById('photo-upload')?.click()}
                                                            disabled={isUploading}
                                                        >
                                                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                                            Ganti Foto Profil
                                                        </Button>
                                                        <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <FormField control={profileForm.control} name="username" render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="font-bold ml-1">Username</FormLabel>
                                                            <FormControl>
                                                                <div className="relative group">
                                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 font-bold">@</span>
                                                                    <Input placeholder="username" {...field} className="h-12 pl-8 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 font-medium" />
                                                                </div>
                                                            </FormControl>
                                                            <FormDescription className="text-[10px] ml-1 uppercase font-bold tracking-tighter opacity-60">Hanya huruf kecil, angka, dan underscore.</FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                    
                                                    <FormField control={profileForm.control} name="displayName" render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="font-bold ml-1">Nama Lengkap</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Nama Anda" {...field} className="h-12 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 font-medium" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                </div>

                                                <FormField control={profileForm.control} name="bio" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-bold ml-1">Biografi Pujangga</FormLabel>
                                                        <FormControl>
                                                            <Textarea placeholder="Bagikan sedikit tentang diri Anda..." {...field} rows={4} className="rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 font-medium resize-none py-4" />
                                                        </FormControl>
                                                        <FormDescription className="text-[10px] ml-1">Maksimal 160 karakter untuk deskripsi singkat profil.</FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </>
                                        )}
                                    </CardContent>
                                    <CardFooter className="p-8 pt-0 flex justify-end">
                                        <Button type="submit" size="lg" className="rounded-full px-10 h-14 font-black shadow-xl shadow-primary/20" disabled={isSavingProfile || isLoading || isUploading || !profileForm.formState.isDirty}>
                                            {isSavingProfile ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                                            Terapkan Perubahan
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
                    >
                        <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-md rounded-[2.5rem]">
                            <CardHeader className="bg-muted/30 p-8 border-b border-border/50">
                                <div className="flex items-center gap-4">
                                    <div className="bg-white p-3 rounded-2xl shadow-sm text-primary">
                                        <Palette className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <CardTitle className="font-headline text-2xl font-black">Mode Tampilan</CardTitle>
                                        <CardDescription className="font-medium">Pilih gaya visual yang paling nyaman untuk Anda.</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-10">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                    {[
                                        { id: 'light', label: 'Terang', icon: Sun, color: 'bg-white border-zinc-200' },
                                        { id: 'dark', label: 'Gelap', icon: Moon, color: 'bg-zinc-900 border-zinc-800 text-white' },
                                        { id: 'system', label: 'Otomatis', icon: Monitor, color: 'bg-gradient-to-br from-white to-zinc-900 border-zinc-300' }
                                    ].map((mode) => (
                                        <button
                                            key={mode.id}
                                            onClick={() => handleThemeChange(mode.id)}
                                            className={cn(
                                                "relative flex flex-col items-center gap-4 p-6 rounded-3xl border-2 transition-all duration-500 group",
                                                theme === mode.id ? "border-primary bg-primary/5 ring-4 ring-primary/10 scale-105 shadow-xl" : "border-transparent bg-muted/20 hover:bg-muted/40"
                                            )}
                                        >
                                            <div className={cn("w-full aspect-video rounded-xl border mb-2 flex items-center justify-center", mode.color)}>
                                                <mode.icon className={cn("h-8 w-8", theme === mode.id ? "text-primary" : "text-muted-foreground")} />
                                            </div>
                                            <span className={cn("font-bold text-sm", theme === mode.id ? "text-primary" : "text-muted-foreground")}>{mode.label}</span>
                                            {theme === mode.id && (
                                                <div className="absolute top-3 right-3 bg-primary text-white p-1 rounded-full shadow-lg">
                                                    <Check className="h-3 w-3" />
                                                </div>
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
                    >
                        <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-md rounded-[2.5rem]">
                            <Form {...notificationForm}>
                                <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)}>
                                    <CardHeader className="bg-muted/30 p-8 border-b border-border/50">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-white p-3 rounded-2xl shadow-sm text-primary">
                                                <Bell className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <CardTitle className="font-headline text-2xl font-black">Notifikasi</CardTitle>
                                                <CardDescription className="font-medium">Atur informasi apa saja yang ingin Anda terima.</CardDescription>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-8 space-y-2">
                                        {[
                                            { name: 'onNewFollower', label: 'Pengikut Baru', desc: 'Saat seseorang mulai mengikuti profil Anda.' },
                                            { name: 'onBookComment', label: 'Komentar Buku', desc: 'Saat ada ulasan baru pada karya-karya Anda.' },
                                            { name: 'onBookFavorite', label: 'Karya Favorit', desc: 'Saat buku Anda ditambahkan ke koleksi favorit pembaca.' },
                                            { name: 'onStoryComment', label: 'Respon Momen', desc: 'Saat seseorang membalas cerita singkat Anda.' },
                                            { name: 'onReelLike', label: 'Suka Video Reels', desc: 'Saat seseorang menyukai postingan video Anda.' },
                                            { name: 'onReelComment', label: 'Komentar Video Reels', desc: 'Saat ada ulasan baru pada video Reels Anda.' }
                                        ].map((item) => (
                                            <FormField key={item.name} control={notificationForm.control} name={item.name as any} render={({ field }) => (
                                                <div className="flex items-center justify-between p-6 rounded-3xl transition-colors hover:bg-muted/30 group border border-transparent hover:border-border/50">
                                                    <div className="space-y-1">
                                                        <Label className="font-black text-base transition-colors group-hover:text-primary cursor-pointer" onClick={() => field.onChange(!field.value)}>{item.label}</Label>
                                                        <p className="text-xs text-muted-foreground font-medium">{item.desc}</p>
                                                    </div>
                                                    <FormControl>
                                                        <Switch checked={field.value} onCheckedChange={field.onChange} className="data-[state=checked]:bg-primary" />
                                                    </FormControl>
                                                </div>
                                            )} />
                                        ))}
                                    </CardContent>
                                    <CardFooter className="p-8 pt-0 flex justify-end">
                                        <Button type="submit" size="lg" className="rounded-full px-10 h-14 font-black shadow-xl shadow-primary/20" disabled={isSavingNotifications || isLoading || !notificationForm.formState.isDirty}>
                                            {isSavingNotifications ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
                                            Simpan Notifikasi
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
    </div>
  );
}
