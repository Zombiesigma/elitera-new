'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, AlertTriangle, BookUser, Upload, FileImage, Globe, Users, ArrowRight, PenTool, FileText, Type, File as FileIcon, Feather } from "lucide-react";
import type { User as AppUser } from '@/lib/types';
import { uploadFile, uploadBookFile } from '@/lib/uploader';
import { extractBookContent } from '../../actions/book-processor';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  title: z.string().min(3, { message: "Judul minimal 3 karakter." }).max(100, { message: "Judul maksimal 100 karakter."}),
  genre: z.string({ required_error: "Genre harus dipilih."}),
  type: z.enum(['book', 'screenplay', 'poem'], { required_error: "Pilih tipe karya." }),
  synopsis: z.string().min(10, { message: "Sinopsis minimal 10 karakter." }).max(1000, { message: "Sinopsis maksimal 1000 karakter."}),
  visibility: z.enum(['public', 'followers_only'], { required_error: "Pilih visibilitas karya Anda." }),
});

export default function CreateBookPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user: currentUser, isLoading: isUserAuthLoading } = useUser();
  const { toast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [selectedCover, setSelectedCover] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [creationMethod, setCreationMethod] = useState<'manual' | 'upload'>('manual');
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const userProfileRef = (firestore && currentUser) ? doc(firestore, 'users', currentUser.uid) : null;
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<AppUser>(userProfileRef);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      synopsis: "",
      type: "book",
      visibility: "public",
    },
  });

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'File Terlalu Besar', description: 'Maksimal 5MB untuk sampul.' });
        return;
      }
      setSelectedCover(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleBookFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'File Terlalu Besar', description: 'Maksimal 20MB untuk naskah.' });
        return;
      }
      setBookFile(file);
      if (!form.getValues('title')) {
          const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
          form.setValue('title', cleanName);
      }
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !currentUser || !userProfile) {
        toast({ variant: "destructive", title: "Gagal", description: "Otoritas profil tidak valid." });
        return;
    }
    
    if (creationMethod === 'upload' && !bookFile) {
        toast({ variant: "destructive", title: "Berkas Dibutuhkan", description: "Silakan pilih naskah buku yang akan diunggah." });
        return;
    }

    setIsSubmitting(true);
    let coverUrl = `https://picsum.photos/seed/${Date.now()}/400/600`;
    let fileUrl = "";
    let extractedText = "";

    try {
      if (selectedCover) {
        setIsUploadingCover(true);
        try {
          coverUrl = await uploadFile(selectedCover);
        } catch (uploadError: any) {
          console.warn("Cover upload failed, using fallback:", uploadError.message);
        } finally {
          setIsUploadingCover(false);
        }
      }

      if (creationMethod === 'upload' && bookFile) {
        setIsExtracting(true);
        try {
          fileUrl = await uploadBookFile(bookFile);
          
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                if (!base64) reject(new Error("Format berkas tidak valid."));
                resolve(base64);
            };
            reader.onerror = () => reject(new Error("Gagal membaca berkas lokal."));
            reader.readAsDataURL(bookFile);
          });
          
          extractedText = await extractBookContent(base64Data, bookFile.name, bookFile.type);
          
          if (!extractedText || extractedText.trim().length < 5) {
              throw new Error("Isi berkas tidak dapat diekstrak atau dokumen tidak mengandung teks yang dapat dibaca.");
          }
        } catch (extractError: any) {
          toast({ 
              variant: "destructive", 
              title: "Impor Gagal", 
              description: extractError.message || "Isi naskah tidak dapat terbaca secara otomatis." 
          });
          setIsSubmitting(false);
          setIsExtracting(false);
          return;
        } finally {
          setIsExtracting(false);
        }
      }

      const batch = writeBatch(firestore);
      const booksCollection = collection(firestore, 'books');
      const bookDocRef = doc(booksCollection);

      const bookData = {
        authorId: currentUser.uid,
        authorName: userProfile.displayName,
        authorUsername: userProfile.username,
        authorAvatarUrl: userProfile.photoURL,
        title: values.title,
        genre: values.genre,
        type: values.type,
        synopsis: values.synopsis,
        visibility: values.visibility,
        status: 'draft' as const,
        viewCount: 0,
        favoriteCount: 0,
        chapterCount: extractedText ? 1 : 0,
        coverUrl: coverUrl,
        fileUrl: fileUrl || null,
        createdAt: serverTimestamp(),
      };
      
      batch.set(bookDocRef, bookData);

      if (extractedText) {
        const chaptersCol = collection(firestore, 'books', bookDocRef.id, 'chapters');
        batch.set(doc(chaptersCol), {
            title: values.type === 'screenplay' ? "BAGIAN 1" : values.type === 'poem' ? "BAIT 1" : "Bab 1",
            content: extractedText,
            order: 1,
            createdAt: serverTimestamp()
        });
      }

      await batch.commit();
      
      toast({
        variant: 'success',
        title: "Karya Berhasil Dibuat",
        description: creationMethod === 'upload' ? "Naskah telah diekstrak menjadi draf awal." : "Draf tersimpan. Silakan mulai menyusun karya Anda!",
      });

      router.push(`/books/${bookDocRef.id}/edit`);

    } catch (error: any) {
      console.error("Submit Error:", error);
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: error.message || "Terjadi kesalahan sistem saat membuat buku.",
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
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 px-2">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                <PenTool className="h-6 w-6" />
            </div>
            <div>
                <h1 className="text-4xl font-headline font-black tracking-tight">Karya <span className="text-primary italic">Baru</span></h1>
                <p className="text-muted-foreground font-medium">Lengkapi identitas mahakarya Anda.</p>
            </div>
          </div>
          
          <div className="bg-muted/50 p-1 rounded-2xl flex">
              <button 
                type="button"
                onClick={() => setCreationMethod('manual')}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    creationMethod === 'manual' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                  <Type className="h-3.5 w-3.5" /> Tulis Manual
              </button>
              <button 
                type="button"
                onClick={() => setCreationMethod('upload')}
                className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                    creationMethod === 'upload' ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                  <FileText className="h-3.5 w-3.5" /> Impor Berkas
              </button>
          </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid md:grid-cols-12 gap-10">
            <div className="md:col-span-7 space-y-8">
                {creationMethod === 'upload' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <Card className="rounded-[2.5rem] border-none shadow-xl bg-primary/5 border-2 border-dashed border-primary/20 overflow-hidden">
                            <CardHeader>
                                <CardTitle className="text-lg font-headline font-bold flex items-center gap-2">
                                    <FileIcon className="h-5 w-5 text-primary" /> Pilih Naskah
                                </CardTitle>
                                <CardDescription>Mendukung .docx, .txt, dan .pdf. Maks 20MB.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 pt-0">
                                <div 
                                    className="relative h-32 rounded-2xl bg-background border border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/20 transition-all group"
                                    onClick={() => document.getElementById('book-file-upload')?.click()}
                                >
                                    <input id="book-file-upload" type="file" className="hidden" accept=".docx,.txt,.pdf" onChange={handleBookFileChange} />
                                    {bookFile ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                <FileIcon className="h-6 w-6" />
                                            </div>
                                            <p className="font-bold text-sm truncate max-w-[200px]">{bookFile.name}</p>
                                            <span className="text-[10px] font-black text-muted-foreground">Klik untuk ganti naskah</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="h-8 w-8 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                                            <p className="text-xs font-bold text-muted-foreground">Klik untuk memilih berkas naskah</p>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}

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
                                <FormLabel className="font-bold ml-1">Judul Karya</FormLabel>
                                <FormControl>
                                    <Input placeholder="Contoh: Sang Pencari Cahaya" {...field} className="h-12 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 font-bold px-5" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="genre"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-bold ml-1">Genre Utama</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none focus:ring-primary/20 px-5 font-bold">
                                            <SelectValue placeholder="Pilih genre" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="novel">Novel</SelectItem>
                                            <SelectItem value="fantasy">Fantasi</SelectItem>
                                            <SelectItem value="sci-fi">Fiksi Ilmiah</SelectItem>
                                            <SelectItem value="horror">Horor</SelectItem>
                                            <SelectItem value="romance">Romansa</SelectItem>
                                            <SelectItem value="self-improvement">Self-Improvement</SelectItem>
                                            <SelectItem value="poetry">Puisi / Sajak</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="font-bold ml-1">Jenis Karya</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none focus:ring-primary/20 px-5 font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="book">Novel / Buku</SelectItem>
                                            <SelectItem value="screenplay">Naskah Film</SelectItem>
                                            <SelectItem value="poem">Koleksi Puisi</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b border-primary/10">
                        <CardTitle className="text-lg font-headline font-bold">Visibilitas</CardTitle>
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
                                                <span className="text-[10px] text-muted-foreground">Karya dapat dinikmati oleh semua pembaca.</span>
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
                                                <span className="text-[10px] text-muted-foreground">Hanya pujangga yang mengikuti Anda yang dapat membaca.</span>
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

            <div className="md:col-span-5 space-y-8">
                <Card className="rounded-[2.5rem] border-none shadow-xl bg-card overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b border-primary/10">
                        <CardTitle className="text-lg font-headline font-bold">Sampul Karya</CardTitle>
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
                            {isUploadingCover && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                                    <Loader2 className="h-10 w-10 text-white animate-spin" />
                                </div>
                            )}
                        </div>
                        <input id="cover-upload" type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
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
            <Button type="submit" size="lg" className="rounded-2xl px-12 h-16 font-black text-lg shadow-2xl shadow-primary/30 group relative overflow-hidden" disabled={isSubmitting || isUploadingCover || isExtracting}>
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-accent to-primary opacity-0 group-hover:opacity-10 transition-opacity" />
                {isSubmitting ? (
                    <><Loader2 className="mr-3 h-6 w-6 animate-spin" /> {isExtracting ? 'Mengekstrak Konten...' : 'Menyimpan...'}</>
                ) : (
                    <><Sparkles className="mr-3 h-6 w-6" /> {creationMethod === 'upload' ? 'Impor & Lanjutkan' : 'Buat & Mulai Menulis'} <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" /></>
                )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
