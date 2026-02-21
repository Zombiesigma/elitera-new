'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { doc, updateDoc, collection, serverTimestamp, query, orderBy, writeBatch, increment, deleteDoc } from 'firebase/firestore';
import type { Book, Chapter, User as AppUser } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  PlusCircle, 
  BookUp, 
  GripVertical, 
  FileEdit, 
  Info, 
  Trash2, 
  Settings, 
  FileImage, 
  Upload, 
  Sparkles, 
  Globe, 
  Users, 
  CheckCircle2, 
  ChevronLeft, 
  Menu, 
  X, 
  Check, 
  Clapperboard, 
  Type, 
  User as UserIcon, 
  MessageCircle, 
  ArrowRight, 
  Zap,
  Maximize2,
  Minimize2,
  Clock,
  Layout,
  Headset,
  ArrowLeft
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { uploadFile } from '@/lib/uploader';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { screenplayHelper } from '../../../../../ai/flows/screenplay-helper-flow';
import { MusicSidebar } from '@/components/MusicSidebar';

const chapterSchema = z.object({
  title: z.string().min(3, "Judul bab minimal 3 karakter."),
  content: z.string().min(10, "Konten bab minimal 10 karakter."),
});

const bookSettingsSchema = z.object({
  title: z.string().min(3, { message: "Judul minimal 3 karakter." }).max(100, { message: "Judul maksimal 100 karakter."}),
  genre: z.string({ required_error: "Genre harus dipilih."}),
  type: z.enum(['book', 'screenplay']).default('book'),
  synopsis: z.string().min(10, { message: "Sinopsis minimal 10 karakter." }).max(1000, { message: "Sinopsis maksimal 1000 karakter."}),
  visibility: z.enum(['public', 'followers_only'], { required_error: "Pilih visibilitas buku." }),
});

export default function EditBookPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'editor' | 'settings' | 'music'>('editor');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevChapterIdRef = useRef<string | null>(null);

  const bookRef = useMemo(() => (
    firestore ? doc(firestore, 'books', params.id) : null
  ), [firestore, params.id]);
  const { data: book, isLoading: isBookLoading } = useDoc<Book>(bookRef);
  
  const { data: userProfile } = useDoc<AppUser>(
    (firestore && currentUser) ? doc(firestore, 'users', currentUser.uid) : null
  );

  const chaptersQuery = useMemo(() => (
    firestore ? query(collection(firestore, 'books', params.id, 'chapters'), orderBy('order', 'asc')) : null
  ), [firestore, params.id]);
  const { data: chapters, isLoading: areChaptersLoading } = useCollection<Chapter>(chaptersQuery);

  const chapterForm = useForm<z.infer<typeof chapterSchema>>({
    resolver: zodResolver(chapterSchema),
    defaultValues: { title: '', content: '' },
  });

  const settingsForm = useForm<z.infer<typeof bookSettingsSchema>>({
    resolver: zodResolver(bookSettingsSchema),
    defaultValues: {
      title: "",
      synopsis: "",
      genre: "",
      type: "book",
      visibility: "public",
    },
  });
  
  const isAdmin = userProfile?.role === 'admin';
  const isReviewing = book?.status === 'pending_review' && !isAdmin;
  const isCompleted = book?.isCompleted === true;

  useEffect(() => {
    if (book && !settingsForm.formState.isDirty) {
      settingsForm.reset({
        title: book.title,
        synopsis: book.synopsis,
        genre: book.genre,
        type: book.type || "book",
        visibility: book.visibility || "public",
      });
      if (!selectedFile) setPreviewUrl(book.coverUrl);
    }
  }, [book, settingsForm, selectedFile]);

  useEffect(() => {
    if (!chapters) return;
    if (chapters.length > 0 && !activeChapterId && activeTab === 'editor') {
      setActiveChapterId(chapters[0].id);
      return;
    }
    if (activeChapterId && activeChapterId !== prevChapterIdRef.current) {
        const activeChapter = chapters.find(c => c.id === activeChapterId);
        if (activeChapter) {
            chapterForm.reset({ title: activeChapter.title, content: activeChapter.content });
            prevChapterIdRef.current = activeChapterId;
        }
    }
  }, [chapters, activeChapterId, activeTab, chapterForm]);

  const saveCurrentChapter = async () => {
    if (!firestore || !activeChapterId || !chapterForm.formState.isDirty || isReviewing || isCompleted) return;
    try {
        const chapterRef = doc(firestore, 'books', params.id, 'chapters', activeChapterId);
        const values = chapterForm.getValues();
        await updateDoc(chapterRef, values);
        chapterForm.reset(values);
        setLastSaved(new Date());
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    const interval = setInterval(() => {
        if (activeTab === 'editor' && chapterForm.formState.isDirty && !isReviewing && !isCompleted) saveCurrentChapter();
    }, 15000);
    return () => clearInterval(interval);
  }, [activeTab, chapterForm.formState.isDirty, isReviewing, isCompleted, activeChapterId]);

  const handleTabSwitch = async (tab: 'editor' | 'settings' | 'music') => {
    if (tab === activeTab) return;
    if (activeTab === 'editor' && chapterForm.formState.isDirty) await saveCurrentChapter();
    setActiveTab(tab);
    if (tab !== 'editor') { setActiveChapterId(null); prevChapterIdRef.current = null; }
    setIsMobileSidebarOpen(false);
  };

  const handleChapterSelection = async (chapterId: string) => {
    if (chapterId === activeChapterId) { setIsMobileSidebarOpen(false); return; }
    try {
      if (chapterForm.formState.isDirty) await saveCurrentChapter();
      setActiveTab('editor');
      setActiveChapterId(chapterId);
      setIsMobileSidebarOpen(false);
    } catch (e) { toast({ variant: 'destructive', title: 'Gagal Pindah Bab' }); }
  };

  const onSettingsSubmit = async (values: z.infer<typeof bookSettingsSchema>) => {
    if (!firestore || !bookRef) return;
    setIsSavingSettings(true);
    try {
      let coverUrl = book?.coverUrl || '';
      if (selectedFile) coverUrl = await uploadFile(selectedFile);
      await updateDoc(bookRef, { ...values, coverUrl });
      settingsForm.reset(values);
      setSelectedFile(null);
      toast({ variant: "success", title: "Perubahan Disimpan" });
    } catch (error: any) { toast({ variant: "destructive", title: "Gagal Menyimpan" }); } finally { setIsSavingSettings(false); }
  };

  const handleSubmitForReview = async () => {
    if (!firestore || !bookRef) return;
    setIsSubmittingReview(true);
    try {
      if (activeTab === 'editor' && chapterForm.formState.isDirty) await saveCurrentChapter();
      if (settingsForm.formState.isDirty) await onSettingsSubmit(settingsForm.getValues());
      await updateDoc(bookRef, { status: 'pending_review' });
      setIsReviewDialogOpen(false);
      toast({ variant: "success", title: "Karya Terkirim" });
    } catch (error) { toast({ variant: "destructive", title: "Gagal Mengirim" }); } finally { setIsSubmittingReview(false); }
  };

  const handleAddChapter = async () => {
    if (!firestore || !bookRef || isReviewing || isCompleted) return;
    try {
      if (chapterForm.formState.isDirty) await saveCurrentChapter();
      const newOrder = chapters ? chapters.length + 1 : 1;
      const batch = writeBatch(firestore);
      const newChapterDoc = doc(collection(firestore, 'books', params.id, 'chapters'));
      batch.set(newChapterDoc, {
          title: book?.type === 'screenplay' ? `BAGIAN ${newOrder}` : `Bab ${newOrder}`,
          content: book?.type === 'screenplay' ? "INT. LOKASI - WAKTU\n\n" : "Mulai tulis di sini...",
          order: newOrder,
          createdAt: serverTimestamp()
      });
      batch.update(bookRef, { chapterCount: increment(1) });
      await batch.commit();
      setActiveTab('editor');
      setActiveChapterId(newChapterDoc.id);
      setIsMobileSidebarOpen(false);
    } catch (e) { toast({ variant: 'destructive', title: 'Gagal Menambah' }); }
  };

  // Screenplay Formatting
  const insertFormatting = (type: 'slugline' | 'action' | 'character' | 'dialogue' | 'parenthetical' | 'transition') => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;
    let insertion = "";
    switch(type) {
        case 'slugline': insertion = "\nINT. LOKASI - WAKTU\n\n"; break;
        case 'action': insertion = "\nKarakter melakukan sesuatu...\n\n"; break;
        case 'character': insertion = "\n          NAMA KARAKTER\n"; break;
        case 'dialogue': insertion = "     (Dialog karakter di sini...)\n\n"; break;
        case 'parenthetical': insertion = "     (dengan ekspresi)\n"; break;
        case 'transition': insertion = "\n                                     FADE OUT.\n\n"; break;
    }
    const newText = text.substring(0, start) + insertion + text.substring(end);
    chapterForm.setValue('content', newText, { shouldDirty: true });
    setTimeout(() => { el.focus(); el.setSelectionRange(start + insertion.length, start + insertion.length); }, 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (book?.type !== 'screenplay') return;
    if (e.key === 'Tab') { e.preventDefault(); insertFormatting('character'); }
  };

  if (isBookLoading || areChaptersLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!book) notFound();

  const activeChapter = chapters?.find(c => c.id === activeChapterId);
  const isScreenplay = book.type === 'screenplay';

  const SidebarContentBody = () => (
    <div className="flex flex-col h-full">
        <div className="p-6 border-b bg-background/50 backdrop-blur">
            <Link href={`/books/${book.id}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors mb-4 group">
                <ChevronLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" /> Kembali
            </Link>
            <p className="text-[10px] uppercase tracking-[0.2em] font-black text-primary/60 mb-1">{isScreenplay ? 'Industrial Script Editor' : 'Editor Novel Premium'}</p>
            <h2 className="font-headline text-xl font-bold truncate">{book.title}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="grid grid-cols-2 gap-2">
                <Button variant={activeTab === 'settings' ? "secondary" : "ghost"} className="w-full justify-start gap-2 h-11 px-3 rounded-xl" onClick={() => handleTabSwitch('settings')}><Settings className="h-4 w-4" /><span className="font-bold text-xs">Identitas</span></Button>
                <Button variant={activeTab === 'music' ? "secondary" : "ghost"} className="w-full justify-start gap-2 h-11 px-3 rounded-xl" onClick={() => handleTabSwitch('music')}><Headset className="h-4 w-4" /><span className="font-bold text-xs">Musik</span></Button>
            </div>
            <div className="space-y-1">
                {chapters?.map(chapter => (
                    <Button key={chapter.id} variant={activeTab === 'editor' && activeChapterId === chapter.id ? "secondary" : "ghost"} className="w-full justify-start gap-3 h-11 px-4 rounded-xl group truncate" onClick={() => handleChapterSelection(chapter.id)}><GripVertical className="h-4 w-4 opacity-40 shrink-0" /><span className="truncate text-sm font-medium">{chapter.title}</span></Button>
                ))}
            </div>
        </div>
        <div className="p-4 border-t bg-background/50">
            <Button variant="outline" className="w-full h-11 rounded-xl border-dashed border-2" onClick={handleAddChapter} disabled={isReviewing || isCompleted}><PlusCircle className="mr-2 h-4 w-4" /> Tambah Bagian</Button>
        </div>
    </div>
  );

  return (
    <div className={cn("flex h-[calc(100vh-theme(spacing.14))] -m-6 overflow-hidden bg-background", isZenMode && "h-screen m-0")}>
      {!isZenMode && <aside className="hidden md:flex flex-col w-72 lg:w-80 border-r bg-muted/20 shrink-0">{activeTab === 'music' ? <div className="flex flex-col h-full"><div className="p-4 border-b"><Button variant="ghost" size="sm" className="gap-2 text-[10px] font-black uppercase" onClick={() => setActiveTab('editor')}><ArrowLeft className="h-3 w-3" /> Kembali</Button></div><MusicSidebar /></div> : <SidebarContentBody />}</aside>}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
         {!isZenMode && (
            <header className="h-16 border-b flex items-center justify-between px-4 md:px-6 bg-background/95 backdrop-blur-md z-30 sticky top-0 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="md:hidden"><Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}><SheetTrigger asChild><Button variant="ghost" size="icon"><Menu /></Button></SheetTrigger><SheetContent side="left" className="p-0 w-80">{activeTab === 'music' ? <div className="flex flex-col h-full"><div className="p-4 border-b"><Button variant="ghost" size="sm" className="gap-2" onClick={() => setActiveTab('editor')}><ArrowLeft className="h-3 w-3" /> Kembali</Button></div><MusicSidebar /></div> : <SidebarContentBody />}</SheetContent></Sheet></div>
                    <h3 className="font-bold text-sm md:text-base truncate">{activeTab === 'settings' ? 'Pengaturan' : activeTab === 'music' ? 'Musik' : (activeChapter?.title || "Pilih Bab")}</h3>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsZenMode(true)}><Maximize2 className="h-4 w-4" /></Button>
                    <Button size="sm" className="rounded-full px-5 font-bold" disabled={isSubmittingReview} onClick={() => setIsReviewDialogOpen(true)}><BookUp className="mr-2 h-4 w-4" /> Publikasi</Button>
                </div>
            </header>
         )}
        <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
                {activeTab === 'settings' ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto py-12 px-6">
                        <Form {...settingsForm}><form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-10">
                            <FormField control={settingsForm.control} name="title" render={({ field }) => (<FormItem><FormLabel className="font-bold">Judul</FormLabel><FormControl><Input {...field} className="h-12 text-lg rounded-xl" /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={settingsForm.control} name="synopsis" render={({ field }) => (<FormItem><FormLabel className="font-bold">Sinopsis</FormLabel><FormControl><Textarea rows={8} {...field} className="rounded-2xl text-base font-serif" /></FormControl><FormMessage /></FormItem>)} />
                            <div className="flex justify-end"><Button type="submit" size="lg" className="rounded-full px-10 h-14 font-black shadow-xl" disabled={isSavingSettings}><Sparkles className="mr-2 h-5 w-5" /> Simpan</Button></div>
                        </form></Form>
                    </motion.div>
                ) : activeTab === 'music' ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full"><div className="max-w-2xl mx-auto py-12 px-6"><MusicSidebar /></div></motion.div>
                ) : activeChapter ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto py-12 px-6 lg:px-12">
                        {isScreenplay && (
                            <div className="flex flex-wrap items-center gap-2 mb-8 p-3 bg-muted/20 rounded-2xl border border-primary/10 backdrop-blur sticky top-0 z-20">
                                <Button variant="ghost" size="sm" className="text-[10px] font-black h-8" onClick={() => insertFormatting('slugline')}>SLUGLINE</Button>
                                <Button variant="ghost" size="sm" className="text-[10px] font-black h-8" onClick={() => insertFormatting('character')}>CHARACTER</Button>
                                <Button variant="ghost" size="sm" className="text-[10px] font-black h-8" onClick={() => insertFormatting('dialogue')}>DIALOGUE</Button>
                            </div>
                        )}
                        <Form {...chapterForm}><form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                            <FormField control={chapterForm.control} name="title" render={({ field }) => (<FormItem><FormControl><Input placeholder="Judul..." {...field} className="border-none shadow-none text-3xl md:text-5xl font-headline font-black h-auto focus-visible:ring-0" /></FormControl></FormItem>)} />
                            <FormField control={chapterForm.control} name="content" render={({ field }) => (<FormItem><FormControl><Textarea ref={textareaRef} onKeyDown={handleKeyDown} className={cn("min-h-[70vh] border-none shadow-none px-0 focus-visible:ring-0 leading-[1.8] resize-none", isScreenplay ? "font-mono text-base" : "text-lg md:text-2xl font-serif")} {...field} /></FormControl></FormItem>)} />
                        </form></Form>
                    </motion.div>
                ) : <div className="flex flex-col items-center justify-center h-full text-center p-12 opacity-40"><PlusCircle className="h-16 w-16 mb-6" /><h4 className="text-2xl font-headline font-bold">Mulai Bagian Baru</h4><Button onClick={handleAddChapter} className="mt-6 rounded-full px-8">Buat Sekarang</Button></div>}
            </AnimatePresence>
        </div>
      </main>
      <AlertDialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Kirim untuk Peninjauan?</AlertDialogTitle><AlertDialogDescription>Karya Anda akan diperiksa oleh tim moderasi sebelum diterbitkan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={handleSubmitForReview}>Kirim Sekarang</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
