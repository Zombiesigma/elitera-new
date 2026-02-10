'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Send, Megaphone, Info, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const broadcastSchema = z.object({
  message: z.string().min(10, { message: "Pesan minimal 10 karakter." }).max(500, { message: "Pesan maksimal 500 karakter." }),
  link: z.string().url({ message: "URL harus valid (cth: /about)." }).optional().or(z.literal('')),
  target: z.enum(['all', 'penulis', 'pembaca'], {
    required_error: "Anda harus memilih target audiens.",
  }),
});

export default function BroadcastPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const usersQuery = useMemo(() => (
    (firestore && currentUser) ? collection(firestore, 'users') : null
  ), [firestore, currentUser]);
  const { data: allUsers, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  const form = useForm<z.infer<typeof broadcastSchema>>({
    resolver: zodResolver(broadcastSchema),
    defaultValues: {
      message: '',
      link: '',
      target: 'all',
    },
  });

  async function onSubmit(values: z.infer<typeof broadcastSchema>) {
    if (!firestore || !currentUser || !allUsers) return;
    setIsSending(true);

    try {
      const targetUsers = allUsers.filter(user => {
        if (values.target === 'all') return true;
        return user.role === values.target;
      });

      if (targetUsers.length === 0) {
        toast({
          variant: "destructive",
          title: "Target Tidak Ditemukan",
          description: `Tidak ada pengguna dengan peran '${values.target}'.`,
        });
        setIsSending(false);
        return;
      }
      
      const batch = writeBatch(firestore);
      const notificationData = {
        type: 'broadcast' as const,
        text: values.message,
        link: values.link || '/',
        actor: {
          uid: currentUser.uid,
          displayName: 'Sistem Elitera',
          photoURL: 'https://raw.githubusercontent.com/Zombiesigma/elitera-asset/main/uploads/1770617037724-WhatsApp_Image_2026-02-07_at_13.45.35.jpeg',
        },
        read: false,
        createdAt: serverTimestamp(),
      };

      targetUsers.forEach(user => {
        const notificationRef = doc(collection(firestore, `users/${user.id}/notifications`));
        batch.set(notificationRef, notificationData);
      });

      await batch.commit();

      toast({
        variant: 'success',
        title: "Pengumuman Disiarkan",
        description: `Notifikasi telah terkirim ke ${targetUsers.length} pengguna.`,
      });
      form.reset();

    } catch (error) {
      console.error("Error sending broadcast:", error);
      toast({
        variant: "destructive",
        title: "Gagal Menyiarkan",
        description: "Terjadi gangguan pada sistem.",
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 md:space-y-10 pb-20 px-1 overflow-x-hidden">
      <div className="flex items-center gap-4 md:gap-6">
        <Button variant="outline" size="icon" className="rounded-full border-2 h-10 w-10 md:h-12 md:w-12 shadow-sm shrink-0" asChild>
          <Link href="/admin"><ArrowLeft className="h-4 w-4 md:h-5 md:w-5" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-4xl font-headline font-black tracking-tight">Kirim <span className="text-primary italic">Siaran</span></h1>
          <p className="text-xs md:text-sm text-muted-foreground font-medium">Buat pengumuman resmi komunitas Elitera.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10">
        <div className="lg:col-span-7">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-none shadow-xl rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-card/50 backdrop-blur-sm">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)}>
                            <CardHeader className="bg-primary/5 p-6 md:p-8 border-b border-primary/10">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 md:p-3 rounded-xl md:rounded-2xl bg-white text-primary shadow-sm">
                                        <Megaphone className="h-5 w-5 md:h-6 md:w-6" />
                                    </div>
                                    <CardTitle className="text-xl md:text-2xl font-headline font-black">Editor Pengumuman</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 md:p-8 space-y-6 md:space-y-8">
                                <FormField
                                    control={form.control}
                                    name="target"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-black text-[10px] uppercase tracking-widest ml-1">Penerima Siaran</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="h-11 md:h-12 rounded-xl focus:ring-primary/20 bg-muted/30 border-none px-4 md:px-5 text-sm">
                                                <SelectValue placeholder="Pilih target" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="all">Semua Pengguna</SelectItem>
                                            <SelectItem value="penulis">Seluruh Penulis</SelectItem>
                                            <SelectItem value="pembaca">Seluruh Pembaca</SelectItem>
                                        </SelectContent>
                                        </Select>
                                        <FormMessage className="text-[10px]" />
                                    </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="message"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-black text-[10px] uppercase tracking-widest ml-1">Isi Pesan Notifikasi</FormLabel>
                                        <FormControl>
                                            <Textarea 
                                                placeholder="Contoh: Kami telah memperbarui fitur Elitera AI!" 
                                                {...field} 
                                                rows={5} 
                                                className="rounded-xl md:rounded-2xl bg-muted/30 border-none focus-visible:ring-primary/20 py-4 px-4 md:px-5 font-medium resize-none text-sm leading-relaxed"
                                            />
                                        </FormControl>
                                        <FormMessage className="text-[10px]" />
                                    </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="link"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="font-black text-[10px] uppercase tracking-widest ml-1">Tautan Navigasi (Opsional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="/about" {...field} className="h-11 md:h-12 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 px-4 md:px-5 font-medium text-sm" />
                                        </FormControl>
                                        <FormDescription className="text-[9px] ml-1 uppercase font-bold text-muted-foreground/60">Target navigasi saat notifikasi diklik.</FormDescription>
                                        <FormMessage className="text-[10px]" />
                                    </FormItem>
                                    )}
                                />
                            </CardContent>
                            <CardFooter className="p-6 md:p-8 pt-0">
                                <Button type="submit" size="lg" className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl font-black text-sm md:text-base shadow-xl shadow-primary/20 transition-all active:scale-95" disabled={isSending || areUsersLoading}>
                                    {isSending ? (
                                        <><Loader2 className="mr-3 h-5 w-5 animate-spin" /> Mengirim...</>
                                    ) : (
                                        <><Send className="mr-2 md:mr-3 h-4 w-4 md:h-5 md:w-5" /> Siarkan Sekarang</>
                                    )}
                                </Button>
                            </CardFooter>
                        </form>
                    </Form>
                </Card>
            </motion.div>
        </div>

        <div className="lg:col-span-5 space-y-6">
            <Card className="border-none shadow-lg rounded-[2rem] bg-indigo-950 text-white p-6 md:p-8 space-y-6">
                <div className="flex items-center gap-3 text-indigo-400">
                    <Sparkles className="h-5 w-5" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">Tips Siaran</span>
                </div>
                <div className="space-y-4">
                    <div className="flex gap-3">
                        <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center shrink-0 font-black text-[9px]">1</div>
                        <p className="text-xs text-indigo-100/80 leading-relaxed font-medium">Gunakan pesan yang padat agar mudah dibaca di layar HP.</p>
                    </div>
                    <div className="flex gap-3">
                        <div className="h-5 w-5 rounded-full bg-white/10 flex items-center justify-center shrink-0 font-black text-[9px]">2</div>
                        <p className="text-xs text-indigo-100/80 leading-relaxed font-medium">Pastikan tautan internal valid (cth: /books/id).</p>
                    </div>
                </div>
            </Card>

            <Card className="border-none shadow-lg rounded-[2rem] bg-card/50 backdrop-blur-sm p-6 md:p-8 space-y-4">
                <div className="flex items-center gap-3">
                    <Info className="h-5 w-5 text-primary" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status Jangkauan</span>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between items-baseline">
                        <p className="text-xs font-bold">Potensi Jangkauan</p>
                        <p className="text-xl md:text-2xl font-black text-primary">{areUsersLoading ? '...' : allUsers?.length}</p>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-relaxed">Pesan akan muncul instan di pusat notifikasi seluruh target terpilih.</p>
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
}
