
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, addDoc, serverTimestamp, deleteDoc, query, orderBy } from 'firebase/firestore';
import type { Music } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Plus, Music2, Trash2, Headphones, Play, Pause, Save } from 'lucide-react';
import { uploadMusic } from '@/lib/uploader';
import { motion, AnimatePresence } from 'framer-motion';

const musicSchema = z.object({
  title: z.string().min(2, "Judul minimal 2 karakter."),
  artist: z.string().min(2, "Artis minimal 2 karakter."),
});

export default function AdminMusicPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const musicQuery = useMemo(() => (
    firestore ? query(collection(firestore, 'music'), orderBy('createdAt', 'desc')) : null
  ), [firestore]);
  
  const { data: musicList, isLoading: isListLoading } = useCollection<Music>(musicQuery);

  const form = useForm<z.infer<typeof musicSchema>>({
    resolver: zodResolver(musicSchema),
    defaultValues: { title: '', artist: '' },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        toast({ variant: 'destructive', title: 'File Tidak Valid', description: 'Harap pilih berkas audio.' });
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'File Terlalu Besar', description: 'Maksimal ukuran musik adalah 15MB.' });
        return;
      }
      setMusicFile(file);
    }
  };

  async function onSubmit(values: z.infer<typeof musicSchema>) {
    if (!firestore || !musicFile) {
        toast({ variant: 'destructive', title: 'Berkas Kosong', description: 'Pilih file musik terlebih dahulu.' });
        return;
    }

    setIsUploading(true);
    try {
      toast({ title: 'Mengunggah Musik...', description: 'Mohon tunggu sejenak.' });
      const musicUrl = await uploadMusic(musicFile);

      await addDoc(collection(firestore, 'music'), {
        title: values.title,
        artist: values.artist,
        url: musicUrl,
        createdAt: serverTimestamp(),
      });

      toast({ variant: 'success', title: 'Musik Berhasil Ditambahkan' });
      form.reset();
      setMusicFile(null);
      const fileInput = document.getElementById('music-upload') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Gagal Mengunggah', description: error.message });
    } finally {
      setIsUploading(false);
    }
  }

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'music', id));
      toast({ variant: 'success', title: 'Musik Dihapus' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Gagal Menghapus' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 md:space-y-10 pb-20 px-1 overflow-x-hidden">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-2" asChild>
          <Link href="/admin"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-4xl font-headline font-black tracking-tight">Perpustakaan <span className="text-primary italic">Musik</span></h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">Kelola musik latar untuk pembaca Elitera.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5">
            <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-card/50 backdrop-blur-sm">
                <CardHeader className="bg-primary/5 p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-white text-primary shadow-sm"><Plus className="h-5 w-5" /></div>
                        <CardTitle className="text-xl font-headline font-black">Unggah Baru</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Judul Musik</FormLabel>
                                        <FormControl>
                                            <Input placeholder="cth: Alunan Senja" {...field} className="h-12 rounded-xl bg-muted/30 border-none px-5" />
                                        </FormControl>
                                        <FormMessage className="text-[10px]" />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="artist"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest ml-1">Artis / Komposer</FormLabel>
                                        <FormControl>
                                            <Input placeholder="cth: Elitera Symphony" {...field} className="h-12 rounded-xl bg-muted/30 border-none px-5" />
                                        </FormControl>
                                        <FormMessage className="text-[10px]" />
                                    </FormItem>
                                )}
                            />
                            
                            <div className="space-y-3">
                                <Label className="text-[10px] font-black uppercase tracking-widest ml-1">Berkas Audio (Maks 15MB)</Label>
                                <div 
                                    className="h-24 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center cursor-pointer hover:bg-primary/10 transition-all group"
                                    onClick={() => document.getElementById('music-upload')?.click()}
                                >
                                    <input id="music-upload" type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
                                    {musicFile ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <Music2 className="h-5 w-5 text-primary" />
                                            <p className="text-[10px] font-bold truncate max-w-[200px]">{musicFile.name}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <Headphones className="h-6 w-6 text-primary/40 group-hover:text-primary transition-colors" />
                                            <span className="text-[10px] font-black uppercase tracking-widest mt-2">Pilih File</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <Button type="submit" className="w-full h-12 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-primary/20" disabled={isUploading}>
                                {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengunggah...</> : <><Save className="mr-2 h-4 w-4" /> Simpan Trek</>}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-7 space-y-6">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60 flex items-center gap-3 ml-2">
                <Music2 className="h-4 w-4 text-primary" /> Daftar Koleksi Aktif
            </h2>

            <AnimatePresence mode="popLayout">
                {isListLoading ? (
                    <div className="flex flex-col items-center py-20 gap-4 opacity-40">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Sinkronisasi Audio...</p>
                    </div>
                ) : musicList?.length === 0 ? (
                    <div className="py-20 text-center bg-muted/20 rounded-[2rem] border-2 border-dashed opacity-30">
                        <Music2 className="h-12 w-12 mx-auto mb-4" />
                        <p className="font-bold text-sm">Belum ada alunan musik.</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {musicList?.map((music, idx) => (
                            <motion.div key={music.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}>
                                <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm rounded-2xl group overflow-hidden border border-white/10">
                                    <CardContent className="p-4 flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                                <Music2 className="h-6 w-6" />
                                            </div>
                                            <div className="min-0">
                                                <h4 className="font-black text-sm truncate">{music.title}</h4>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest truncate">{music.artist}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-10 w-10 rounded-full"
                                                onClick={() => setPlayingId(playingId === music.id ? null : music.id)}
                                            >
                                                {playingId === music.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-10 w-10 rounded-full text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                                onClick={() => handleDelete(music.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                    {playingId === music.id && (
                                        <div className="px-4 pb-4">
                                            <audio src={music.url} controls autoPlay className="h-8 w-full filter brightness-90 contrast-125" />
                                        </div>
                                    )}
                                </Card>
                            </motion.div>
                        ))}
                    </div>
                )}
            </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
