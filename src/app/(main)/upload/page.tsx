'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, AlertTriangle, BookUser, Upload, FileImage, Globe, Users, ArrowRight, PenTool } from "lucide-react";
import type { User as AppUser } from '@/lib/types';
import Link from 'next/link';
import { uploadFile } from '@/lib/uploader';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  title: z.string().min(3, { message: "Judul minimal 3 karakter." }).max(100, { message: "Judul maksimal 100 karakter."}),
  genre: z.string({ required_error: "Genre harus dipilih."}),
  synopsis: z.string().min(10, { message: "Sinopsis minimal 10 karakter." }).max(1000, { message: "Sinopsis maksimal 1000 karakter."}),
  visibility: z.enum(['public', 'followers_only'], { required_error: "Pilih visibilitas karya Anda." }),
});

export default function CreateBookPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user: currentUser, isLoading: isUserAuthLoading } = useUser();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const userProfileRef = (firestore && currentUser) ? doc(firestore, 'users', currentUser.uid) : null;
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<AppUser>(userProfileRef);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      synopsis: "",
      visibility: "public",
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File Terlalu Besar',
          description: 'Maksimal ukuran sampul buku adalah 5MB.',
        });
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !currentUser || !userProfile) {
        toast({ variant: "destructive", title: "Gagal", description: "Otoritas profil tidak valid." });
        return;
    }
    
    setIsSubmitting(true);
    let coverUrl = `https://picsum.photos/seed/${Date.now()}/400/600`;

    try {
      // Handle file upload first if selected
      if (selectedFile) {
        setIsUploading(true);
        try {
          coverUrl = await uploadFile(selectedFile);
        } catch (uploadError: any) {
          console.error("Upload failed", uploadError);
          toast({
            variant: "destructive",
            title: "Gagal Mengunggah Sampul",
            description: uploadError.message || "Menggunakan sampul placeholder untuk sementara.",
          });
        } finally {
          setIsUploading(false);
        }
      }

      const bookData = {
        ...values,
        authorId: currentUser.uid,
        authorName: userProfile.displayName,
        authorUsername: userProfile.username,
        authorAvatarUrl: userProfile.photoURL,
        status: 'draft' as const,
        viewCount: 0,
        favoriteCount: 0,
        chapterCount: 0,
        coverUrl: coverUrl,
        createdAt: serverTimestamp(),
      };
      
      const booksCollection = collection(firestore, 'books');
      const docRef = await addDoc(booksCollection, bookData);
      
      toast({
        variant: 'success',
        title: "Karya Berhasil Dibuat",
        description: "Draf Anda tersimpan. Silakan mulai menyusun bab cerita!",
      });

      router.push(`/books/${docRef.id}/edit`);

    } catch (error: any) {
      console.error("Error creating book:", error);
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: error.message || "Terjadi kesalahan sistem.",
      });
      setIsSubmitting(false);
    }
  }

  const isLoading = isUserAuthLoading || isProfileLoading;
  const canUpload = userProfile?.role === 'penulis' || userProfile?.role === 'admin';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary/40" />
        <p className="text-muted-foreground font-black uppercase tracking-widest text-[10px]">Memverifikasi Lisensi...</p>
      </div>
    );
  }

  if (!canUpload) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="text-center rounded-[3rem] border-none shadow-2xl bg-card/50 backdrop-blur-md overflow-hidden">
                <CardHeader className="pt-12">
                    <div className="mx-auto bg-destructive/10 p-6 rounded-[2rem] w-fit mb-6">
                        <AlertTriangle className="h-12 w-12 text-destructive" />
                    </div>
                    <CardTitle className="font-headline text-3xl font-black">Akses Ditolak</CardTitle>
                    <CardDescription className="text-base font-medium mt-2">
                        Hanya akun terverifikasi yang dapat menerbitkan karya.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-10 pb-10">
                    <p className="text-muted-foreground leading-relaxed">
                        Peran Anda saat ini adalah <span className="font-black text-primary uppercase tracking-tighter">{userProfile?.role || 'pembaca'}</span>. 
                        Untuk mulai membagikan imajinasi Anda, silakan ajukan permohonan menjadi penulis resmi.
                    </p>
                    <div className="mt-10 flex flex-col gap-3">
                        <Button asChild size="lg" className="rounded-2xl h-14 font-black shadow-xl shadow-primary/20">
                            <Link href="/join-author">
                                <BookUser className="mr-2 h-5 w-5" /> Bergabung Sebagai Penulis
                            </Link>
                        </Button>
                        <Button variant="ghost" asChild className="rounded-2xl font-bold">
                            <Link href="/">Kembali ke Beranda</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="flex items-center gap-4 mb-10 px-2">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <PenTool className="h-6 w-6" />
          </div>
          <div>
              <h1 className="text-4xl font-headline font-black tracking-tight">Karya <span className="text-primary italic">Baru</span></h1>
              <p className="text-muted-foreground font-medium">Lengkapi identitas mahakarya Anda.</p>
          </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid md:grid-cols-12 gap-10">
            {/* Left: Metadata */}
            <div className="md:col-span-7 space-y-8">
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b border-primary/10">
                        <CardTitle className="text-lg font-headline font-bold">Informasi Dasar</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold ml-1">Judul Buku</FormLabel>
                                <FormControl>
                                    <Input placeholder="Contoh: Sang Pencari Cahaya" {...field} className="h-12 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 font-bold px-5" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="genre"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel className="font-bold ml-1">Genre Utama</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none focus:ring-primary/20 px-5 font-bold">
                                        <SelectValue placeholder="Pilih genre cerita" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="self-improvement">Pengembangan Diri</SelectItem>
                                        <SelectItem value="novel">Novel</SelectItem>
                                        <SelectItem value="mental-health">Kesehatan Mental</SelectItem>
                                        <SelectItem value="sci-fi">Fiksi Ilmiah</SelectItem>
                                        <SelectItem value="fantasy">Fantasi</SelectItem>
                                        <SelectItem value="mystery">Misteri</SelectItem>
                                        <SelectItem value="romance">Romansa</SelectItem>
                                        <SelectItem value="horror">Horor</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b border-primary/10">
                        <CardTitle className="text-lg font-headline font-bold">Privasi Karya</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <FormField
                            control={form.control}
                            name="visibility"
                            render={({ field }) => (
                            <FormItem className="space-y-3">
                                <FormControl>
                                <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="grid grid-cols-1 gap-3"
                                >
                                    <FormItem className={cn(
                                        "flex items-center space-x-3 space-y-0 p-4 rounded-2xl border-2 transition-all cursor-pointer",
                                        field.value === 'public' ? "border-primary bg-primary/5" : "border-transparent bg-muted/20"
                                    )}>
                                        <FormControl><RadioGroupItem value="public" className="sr-only" /></FormControl>
                                        <Label className="flex items-center gap-4 cursor-pointer w-full font-normal" onClick={() => field.onChange('public')}>
                                            <div className={cn("p-2.5 rounded-xl", field.value === 'public' ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                                <Globe className="h-5 w-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black text-sm">Publik</span>
                                                <span className="text-[10px] text-muted-foreground">Karya Anda dapat dinikmati oleh semua orang.</span>
                                            </div>
                                        </Label>
                                    </FormItem>
                                    
                                    <FormItem className={cn(
                                        "flex items-center space-x-3 space-y-0 p-4 rounded-2xl border-2 transition-all cursor-pointer",
                                        field.value === 'followers_only' ? "border-primary bg-primary/5" : "border-transparent bg-muted/20"
                                    )}>
                                        <FormControl><RadioGroupItem value="followers_only" className="sr-only" /></FormControl>
                                        <Label className="flex items-center gap-4 cursor-pointer w-full font-normal" onClick={() => field.onChange('followers_only')}>
                                            <div className={cn("p-2.5 rounded-xl", field.value === 'followers_only' ? "bg-primary text-white" : "bg-muted text-muted-foreground")}>
                                                <Users className="h-5 w-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black text-sm">Hanya Pengikut</span>
                                                <span className="text-[10px] text-muted-foreground">Eksklusif hanya untuk pembaca setia Anda.</span>
                                            </div>
                                        </Label>
                                    </FormItem>
                                </RadioGroup>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>
            </div>

            {/* Right: Cover & Synopsis */}
            <div className="md:col-span-5 space-y-8">
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b border-primary/10">
                        <CardTitle className="text-lg font-headline font-bold">Wajah Karya</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div 
                            className="aspect-[2/3] bg-muted rounded-2xl border-2 border-dashed border-primary/20 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-primary/50 transition-all shadow-lg"
                            onClick={() => document.getElementById('cover-upload')?.click()}
                        >
                            {previewUrl ? (
                                <Image src={previewUrl} alt="Preview" fill className="object-cover transition-transform group-hover:scale-105 duration-500" />
                            ) : (
                                <>
                                    <FileImage className="h-12 w-12 text-muted-foreground/40 mb-3" />
                                    <span className="text-xs font-black uppercase tracking-widest text-muted-foreground text-center px-6">Pilih Sampul Buku</span>
                                </>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                                <Upload className="h-8 w-8 text-white" />
                            </div>
                            {isUploading && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                                    <Loader2 className="h-10 w-10 text-white animate-spin" />
                                </div>
                            )}
                        </div>
                        <input id="cover-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        <p className="text-[9px] text-center text-muted-foreground mt-4 font-bold uppercase tracking-widest">Rekomendasi rasio 2:3 (Maks 5MB)</p>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b border-primary/10">
                        <CardTitle className="text-lg font-headline font-bold">Sinopsis</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <FormField
                            control={form.control}
                            name="synopsis"
                            render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Textarea placeholder="Berikan ringkasan yang memikat hati pembaca..." rows={8} {...field} className="rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 font-medium py-4 px-5 resize-none leading-relaxed" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </CardContent>
                </Card>
            </div>
          </div>

          <div className="flex justify-end pt-6 pb-20">
            <Button type="submit" size="lg" className="rounded-2xl px-12 h-16 font-black text-lg shadow-2xl shadow-primary/30 group relative overflow-hidden" disabled={isSubmitting || isUploading}>
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-10 transition-opacity" />
                {isSubmitting ? (
                    <><Loader2 className="mr-3 h-6 w-6 animate-spin" /> Menyimpan...</>
                ) : (
                    <><Sparkles className="mr-3 h-6 w-6" /> Buat & Mulai Menulis <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" /></>
                )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
