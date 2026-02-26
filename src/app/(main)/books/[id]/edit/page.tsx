'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { notFound, useParams } from 'next/navigation';
import { useFirestore, useUser, useDoc, useCollection } from '@/firebase';
import { doc, updateDoc, collection, serverTimestamp, query, orderBy, writeBatch, increment, deleteDoc } from 'firebase/firestore';
import type { Book, Chapter, User as AppUser, ScreenplayBlock } from '@/lib/types';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  PlusCircle, 
  BookUp, 
  GripVertical, 
  Settings, 
  Sparkles, 
  ChevronLeft, 
  Menu, 
  Maximize2, 
  Minimize2,
  Headset,
  ArrowLeft,
  CheckCircle2,
  Clapperboard,
  FileText,
  ImageIcon,
  Megaphone,
  User,
  MessageCircle,
  ArrowLeftRight,
  Video,
  Wand2,
  Bot,
  ListChecks,
  Users,
  Bold,
  Italic,
  Quote,
  Heading1,
  Hash,
  Clock,
  Trash2,
  AlertTriangle,
  Eye,
  Type,
  Feather,
  Music
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { uploadFile } from '@/lib/uploader';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MusicSidebar } from '@/components/MusicSidebar';
import { ScreenplayEditor, type ScreenplayEditorHandle } from '@/components/editor/ScreenplayEditor';
import { ShotListEditor } from '@/components/editor/ShotListEditor';
import { CollaboratorManager } from '@/components/editor/CollaboratorManager';
import { v4 as uuidv4 } from 'uuid';
import { screenplayHelper } from '@/ai/flows/screenplay-helper-flow';
import { novelHelper } from '@/ai/flows/novel-helper-flow';
import { poetryHelper } from '@/ai/flows/poetry-helper-flow';

const chapterSchema = z.object({
  title: z.string().min(1, "Judul diperlukan."),
  content: z.string().min(1, "Konten diperlukan."),
});

const bookSettingsSchema = z.object({
  title: z.string().min(3).max(100),
  genre: z.string(),
  type: z.enum(['book', 'screenplay', 'poem']),
  synopsis: z.string().min(10).max(1000),
  visibility: z.enum(['public', 'followers_only']),
});

type EditorTab = 'editor' | 'settings' | 'music' | 'shotlist' | 'collaborators';

export default function EditBookPage() {
  const params = useParams<{ id: string }>();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<EditorTab>('editor');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [activeBlockType, setActiveBlockType] = useState<ScreenplayBlock['type'] | null>(null);
  const [isAiRunning, setIsAiRunning] = useState(false);
  const [isDeletingChapter, setIsDeletingChapter] = useState<string | null>(null);
  
  const screenplayEditorRef = useRef<ScreenplayEditorHandle>(null);
  const novelTextareaRef = useRef<HTMLTextAreaElement>(null);
  const prevChapterIdRef = useRef<string | null>(null);

  const bookRef = useMemo(() => (firestore ? doc(firestore, 'books', params.id) : null), [firestore, params.id]);
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
  });
  
  const isAuthor = currentUser?.uid === book?.authorId;
  const isCollaborator = book?.collaboratorUids?.includes(currentUser?.uid || '');
  const canEdit = isAuthor || isCollaborator || userProfile?.role === 'admin';
  const isReviewing = book?.status === 'pending_review' && userProfile?.role !== 'admin';
  const isCompleted = book?.isCompleted === true;

  useEffect(() => {
    if (book) {
      settingsForm.reset({
        title: book.title,
        synopsis: book.synopsis,
        genre: book.genre,
        type: book.type || "book",
        visibility: book.visibility || "public",
      });
    }
  }, [book, settingsForm]);

  useEffect(() => {
    if (!chapters) return;
    if (chapters.length > 0 && !activeChapterId && activeTab === 'editor') {
      setActiveChapterId(chapters[0].id);
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
    if (!firestore || !activeChapterId || !chapterForm.formState.isDirty || isReviewing || isCompleted || !canEdit) return;
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
        if (activeTab === 'editor' && chapterForm.formState.isDirty && !isReviewing && !isCompleted && canEdit) saveCurrentChapter();
    }, 15000);
    return () => clearInterval(interval);
  }, [activeTab, chapterForm.formState.isDirty, isReviewing, isCompleted, activeChapterId, canEdit]);

  const handleTabSwitch = async (tab: EditorTab) => {
    if (tab === activeTab) return;
    if (activeTab === 'editor' && chapterForm.formState.isDirty) await saveCurrentChapter();
    setActiveTab(tab);
    if (tab !== 'editor') { setActiveChapterId(null); prevChapterIdRef.current = null; }
    setIsMobileSidebarOpen(false);
  };

  const handleChapterSelection = async (chapterId: string) => {
    if (chapterId === activeChapterId) { setIsMobileSidebarOpen(false); return; }
    if (chapterForm.formState.isDirty) await saveCurrentChapter();
    setActiveTab('editor');
    setActiveChapterId(chapterId);
    setIsMobileSidebarOpen(false);
  };

  const onSettingsSubmit = async (values: z.infer<typeof bookSettingsSchema>) => {
    if (!firestore || !bookRef || !canEdit) return;
    setIsSavingSettings(true);
    try {
      let coverUrl = book?.coverUrl || '';
      if (selectedFile) coverUrl = await uploadFile(selectedFile);
      await updateDoc(bookRef, { ...values, coverUrl });
      settingsForm.reset(values);
      setSelectedFile(null);
      toast({ variant: "success", title: "Identitas Diperbarui" });
    } catch (error: any) { toast({ variant: "destructive", title: "Gagal Menyimpan" }); } finally { setIsSavingSettings(false); }
  };

  const handleSubmitForReview = async () => {
    if (!firestore || !bookRef || !isAuthor) return;
    setIsSubmittingReview(true);
    try {
      if (activeTab === 'editor' && chapterForm.formState.isDirty) await saveCurrentChapter();
      await updateDoc(bookRef, { status: 'pending_review' });
      toast({ variant: "success", title: "Karya Terkirim untuk Moderasi" });
      setIsReviewDialogOpen(false);
    } catch (error) { toast({ variant: "destructive", title: "Gagal Mengirim" }); } finally { setIsSubmittingReview(false); }
  };

  const handleMarkAsCompleted = async () => {
    if (!firestore || !bookRef || !isAuthor) return;
    setIsCompleting(true);
    try {
      await updateDoc(bookRef, { isCompleted: true });
      toast({ variant: "success", title: "Mahakarya Selesai!" });
    } catch (error) { toast({ variant: "destructive", title: "Gagal Menamatkan" }); } finally { setIsCompleting(false); }
  };

  const handleAddChapter = async () => {
    if (!firestore || !bookRef || isReviewing || isCompleted || !canEdit) return;
    if (chapterForm.formState.isDirty) await saveCurrentChapter();
    const newOrder = chapters ? chapters.length + 1 : 1;
    const batch = writeBatch(firestore);
    const newChapterDoc = doc(collection(firestore, 'books', params.id, 'chapters'));
    
    const initialContent = book?.type === 'screenplay' 
      ? JSON.stringify([{ id: uuidv4(), type: 'slugline', text: 'INT. LOKASI - WAKTU' }])
      : "Mulai tulis...";

    batch.set(newChapterDoc, {
        title: book?.type === 'screenplay' ? `SCENE ${newOrder}` : book?.type === 'poem' ? `BAIT ${newOrder}` : `Bab ${newOrder}`,
        content: initialContent,
        order: newOrder,
        createdAt: serverTimestamp()
    });
    batch.update(bookRef, { chapterCount: increment(1) });
    await batch.commit();
    setActiveChapterId(newChapterDoc.id);
    setActiveTab('editor');
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (!firestore || !bookRef || isReviewing || isCompleted || !canEdit || (chapters && chapters.length <= 1)) return;
    
    setIsDeletingChapter(null);
    try {
        const batch = writeBatch(firestore);
        batch.delete(doc(firestore, 'books', params.id, 'chapters', chapterId));
        batch.update(bookRef, { chapterCount: increment(-1) });
        await batch.commit();
        
        if (activeChapterId === chapterId && chapters) {
            const remaining = chapters.filter(c => c.id !== chapterId);
            if (remaining.length > 0) setActiveChapterId(remaining[0].id);
            else setActiveChapterId(null);
        }
        
        toast({ title: "Bab Dihapus" });
    } catch (e) {
        toast({ variant: 'destructive', title: "Gagal Menghapus" });
    }
  };

  const handleEditorChange = useCallback((val: string) => {
    chapterForm.setValue('content', val, { shouldDirty: true });
  }, [chapterForm]);

  const handleBlockFocus = useCallback((type: ScreenplayBlock['type']) => {
    setActiveBlockType(type);
  }, []);

  const runAiNovelAssistant = async (task: 'tone_polish' | 'describe_scene' | 'show_dont_tell') => {
    const currentContent = chapterForm.getValues('content');
    if (!currentContent || currentContent.length < 10) {
        toast({ title: "Konten terlalu pendek", description: "Tuliskan setidaknya satu paragraf kawan." });
        return;
    }

    setIsAiRunning(true);
    try {
        const { result } = await novelHelper({ context: currentContent, task });
        toast({
            title: task === 'tone_polish' ? "Tone Polish AI" : task === 'describe_scene' ? "Visual Describe AI" : "Show, Don't Tell Doctor",
            description: result,
            duration: 12000,
        });
    } catch (e) {
        toast({ variant: 'destructive', title: "AI sedang sibuk kawan." });
    } finally {
        setIsAiRunning(false);
    }
  };

  const runAiPoetryAssistant = async (task: 'rhyme_polish' | 'deepen_metaphor' | 'emotional_boost') => {
    const currentContent = chapterForm.getValues('content');
    if (!currentContent || currentContent.length < 10) {
        toast({ title: "Konten terlalu pendek", description: "Tuliskan setidaknya beberapa bait kawan." });
        return;
    }

    setIsAiRunning(true);
    try {
        const { result } = await poetryHelper({ context: currentContent, task });
        toast({
            title: task === 'rhyme_polish' ? "Rhyme Polish AI" : task === 'deepen_metaphor' ? "Metaphor Enlarger" : "Emotional Booster",
            description: result,
            duration: 12000,
        });
    } catch (e) {
        toast({ variant: 'destructive', title: "AI sedang sibuk kawan." });
    } finally {
        setIsAiRunning(false);
    }
  };

  const runAiScreenplayDoctor = async (task: 'summarize' | 'naturalize_dialogue' | 'suggest_plot') => {
    if (!screenplayEditorRef.current) return;
    const currentBlocks = screenplayEditorRef.current.getBlocks();
    if (currentBlocks.length === 0) return;

    setIsAiRunning(true);
    try {
        const context = currentBlocks.map(b => b.text).join('\n');
        const { result } = await screenplayHelper({ context, task });
        
        toast({
            title: task === 'summarize' ? "AI Logline Summary" : task === 'naturalize_dialogue' ? "AI Dialogue Doctor" : "AI Plot Suggestions",
            description: result,
            duration: 10000,
        });
    } catch (e) {
        toast({ variant: 'destructive', title: "AI sedang sibuk kawan." });
    } finally {
        setIsAiRunning(false);
    }
  };

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const textarea = novelTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selection = text.substring(start, end);
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newContent = `${before}${prefix}${selection}${suffix}${after}`;
    chapterForm.setValue('content', newContent, { shouldDirty: true });
    
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const novelStats = useMemo(() => {
    const content = chapterForm.watch('content') || "";
    const words = content.split(/\s+/).filter(Boolean).length;
    const minutes = Math.ceil(words / 200);
    return { words, minutes };
  }, [chapterForm.watch('content')]);

  if (isBookLoading || areChaptersLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  if (!book) notFound();

  const isScreenplay = book.type === 'screenplay';
  const isPoem = book.type === 'poem';
  const activeChapter = chapters?.find(c => c.id === activeChapterId);

  const SidebarContentBody = () => (
    <div className="flex flex-col h-full bg-background">
        <div className="p-6 border-b">
            <Link href={`/books/${book.id}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary mb-4 group">
                <ChevronLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" /> Kembali
            </Link>
            <div className="flex items-center gap-2 mb-1">
                <div className={cn("p-1.5 rounded-lg", isScreenplay ? "bg-orange-500/10 text-orange-600" : isPoem ? "bg-rose-500/10 text-rose-600" : "bg-primary/10 text-primary")}>
                    {isScreenplay ? <Clapperboard className="h-3.5 w-3.5" /> : isPoem ? <Feather className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                </div>
                <p className="text-[10px] uppercase font-black tracking-widest opacity-60">{isScreenplay ? 'Script Studio' : isPoem ? 'Poetry Studio' : 'Novel Studio'}</p>
            </div>
            <h2 className="font-headline text-xl font-bold truncate italic">"{book.title}"</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
            <div className="grid grid-cols-2 gap-2">
                <Button variant={activeTab === 'settings' ? "secondary" : "ghost"} className="w-full justify-start h-11 px-3 rounded-xl gap-2" onClick={() => handleTabSwitch('settings')}><Settings className="h-4 w-4" /><span className="text-xs font-bold">Identitas</span></Button>
                <Button variant={activeTab === 'music' ? "secondary" : "ghost"} className="w-full justify-start h-11 px-3 rounded-xl gap-2" onClick={() => handleTabSwitch('music')}><Headset className="h-4 w-4" /><span className="text-xs font-bold">Musik</span></Button>
                {isScreenplay && (
                    <Button variant={activeTab === 'shotlist' ? "secondary" : "ghost"} className="w-full justify-start h-11 px-3 rounded-xl gap-2 mt-1" onClick={() => handleTabSwitch('shotlist')}><ListChecks className="h-4 w-4" /><span className="text-xs font-bold">Shot List</span></Button>
                )}
                <Button variant={activeTab === 'collaborators' ? "secondary" : "ghost"} className={cn("w-full justify-start h-11 px-3 rounded-xl gap-2 mt-1", !isScreenplay && "col-span-2")} onClick={() => handleTabSwitch('collaborators')}><Users className="h-4 w-4" /><span className="text-xs font-bold">Kolaborator</span></Button>
            </div>
            
            {activeTab === 'editor' && (
                <div className="space-y-1">
                    <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 px-2 mb-2 flex justify-between items-center">
                        <span>{isScreenplay ? 'Daftar Scene' : isPoem ? 'Daftar Bait' : 'Daftar Bagian'}</span>
                        <Badge variant="outline" className="text-[8px] h-4 px-1.5">{chapters?.length || 0}</Badge>
                    </div>
                    {chapters?.map(chapter => (
                        <div key={chapter.id} className="group/item relative">
                            <Button 
                                variant={activeChapterId === chapter.id ? "secondary" : "ghost"} 
                                className={cn(
                                    "w-full justify-start h-11 px-4 rounded-xl group transition-all",
                                    activeChapterId === chapter.id ? "pr-10" : "hover:pr-10"
                                )} 
                                onClick={() => handleChapterSelection(chapter.id)}
                            >
                                <GripVertical className="h-4 w-4 opacity-30 shrink-0" />
                                <span className="truncate text-sm ml-2 font-medium">{chapter.title}</span>
                            </Button>
                            {!isReviewing && !isCompleted && canEdit && chapters.length > 1 && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setIsDeletingChapter(chapter.id); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-rose-500 opacity-0 group-hover/item:opacity-100 transition-opacity hover:bg-rose-50 rounded-lg"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
        <div className="p-4 border-t space-y-2">
            <Button variant="outline" className="w-full h-11 rounded-xl border-dashed border-2 font-bold hover:bg-primary/5 hover:text-primary transition-all" onClick={handleAddChapter} disabled={isReviewing || isCompleted || !canEdit}>
                <PlusCircle className="mr-2 h-4 w-4" /> {isScreenplay ? 'Tambah Scene' : isPoem ? 'Tambah Bait' : 'Tambah Bab'}
            </Button>
            {isAuthor && !isCompleted && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="secondary" className="w-full h-11 rounded-xl text-emerald-600 bg-emerald-50 hover:bg-emerald-100 font-black uppercase text-[10px] tracking-widest" disabled={isReviewing || isCompleting}>
                            {isCompleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                            Tandai Tamat
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
                        <AlertDialogHeader>
                            <div className="mx-auto bg-emerald-50 p-4 rounded-2xl w-fit mb-4"><CheckCircle2 className="h-8 w-8 text-emerald-600" /></div>
                            <AlertDialogTitle className="font-headline text-2xl font-black text-center">Selesaikan Karya?</AlertDialogTitle>
                            <AlertDialogDescription className="text-center font-medium">Karya Anda akan mendapatkan lencana "Tamat" dan terkunci dari perubahan di masa mendatang kawan.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="mt-8 flex gap-3"><AlertDialogCancel className="rounded-full h-12 flex-1 border-2 font-bold">Batal</AlertDialogCancel><AlertDialogAction onClick={handleMarkAsCompleted} className="rounded-full h-12 flex-1 bg-emerald-600 font-black shadow-lg shadow-emerald-500/20">Ya, Tamatkan</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    </div>
  );

  return (
    <div className={cn("flex h-[calc(100vh-theme(spacing.14))] -m-6 overflow-hidden bg-muted/30", isZenMode && "h-screen m-0 z-[300] fixed inset-0")}>
      {!isZenMode && (
        <aside className="hidden md:flex flex-col w-72 lg:w-80 border-r shrink-0 shadow-sm relative z-[150]">
            <SidebarContentBody />
        </aside>
      )}
      
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
         {!isZenMode && (
            <header className="h-auto min-h-[5rem] md:min-h-[4rem] border-b flex items-center justify-between px-4 md:px-6 bg-background/95 backdrop-blur-md z-[110] shrink-0 shadow-sm pt-[max(1.5rem,env(safe-area-inset-top))] md:pt-0">
                <div className="flex items-center gap-4">
                    <div className="md:hidden">
                      <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
                        <SheetTrigger asChild><Button variant="ghost" size="icon" className="rounded-xl"><Menu className="h-5 w-5"/></Button></SheetTrigger>
                        <SheetContent side="left" className="p-0 w-80">
                          <SheetHeader className="sr-only">
                            <SheetTitle>Navigasi Editor</SheetTitle>
                          </SheetHeader>
                          <SidebarContentBody />
                        </SheetContent>
                      </Sheet>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Link href={`/books/${book.id}`} className="hidden md:flex items-center justify-center h-9 w-9 rounded-xl bg-muted hover:bg-primary/10 hover:text-primary transition-all">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                        <div className="flex flex-col">
                            <h3 className="font-black text-xs md:text-sm truncate max-w-[150px] md:max-w-[300px] italic">
                                {book.title}
                            </h3>
                            <p className="text-[9px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                                {activeTab === 'settings' ? 'Pengaturan' : activeTab === 'music' ? 'Musik' : activeTab === 'shotlist' ? 'Shot List' : activeTab === 'collaborators' ? 'Kolaborator' : (activeChapter?.title || "Editor")}
                                {chapterForm.formState.isDirty && <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4">
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 transition-all">
                        <motion.div animate={{ scale: lastSaved ? [1, 1.2, 1] : 1 }} className={cn("h-1.5 w-1.5 rounded-full transition-colors", lastSaved ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-orange-500")} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                            {lastSaved ? `Tersimpan ${lastSaved.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : 'Menyimpan draf...'}
                        </span>
                    </div>
                    
                    <div className="h-8 w-px bg-border/50 hidden md:block" />

                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-muted-foreground hover:text-primary" onClick={() => setIsZenMode(true)}>
                            <Maximize2 className="h-4 w-4" />
                        </Button>
                        {isAuthor && (
                            <Button 
                                size="sm" 
                                className="rounded-full px-6 font-black text-[10px] uppercase tracking-widest h-9 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95" 
                                disabled={isSubmittingReview} 
                                onClick={() => setIsReviewDialogOpen(true)}
                            >
                                <BookUp className="mr-2 h-3.5 w-3.5" /> Terbitkan
                            </Button>
                        )}
                    </div>
                </div>
            </header>
         )}

         {isZenMode && <Button variant="ghost" size="icon" className="fixed top-[calc(1.5rem+env(safe-area-inset-top))] right-6 z-[310] rounded-full bg-background/50 backdrop-blur" onClick={() => setIsZenMode(false)}><Minimize2 className="h-5 w-5" /></Button>}

        <div className={cn("flex-1 overflow-y-auto scrollbar-hide", activeTab === 'editor' && !isZenMode && "bg-muted/20")}>
            <AnimatePresence mode="wait">
                {activeTab === 'settings' ? (
                    <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto py-12 px-6">
                        <Form {...settingsForm}><form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-10">
                            <FormField control={settingsForm.control} name="title" render={({ field }) => ( <FormItem><FormLabel className="font-bold">Judul Karya</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl" /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={settingsForm.control} name="synopsis" render={({ field }) => ( <FormItem><FormLabel className="font-bold">Sinopsis</FormLabel><FormControl><Textarea rows={8} {...field} className="rounded-2xl" /></FormControl><FormMessage /></FormItem>)} />
                            <div className="flex justify-end"><Button type="submit" size="lg" className="rounded-full px-10 h-14 font-black shadow-xl" disabled={isSavingSettings || !canEdit}><Sparkles className="mr-2 h-5 w-5" /> Simpan Perubahan</Button></div>
                        </form></Form>
                    </motion.div>
                ) : activeTab === 'music' ? (
                    <div key="music" className="max-w-2xl mx-auto py-12 px-6 h-full"><MusicSidebar bookId={params.id} /></div>
                ) : activeTab === 'shotlist' ? (
                    <motion.div key="shotlist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto py-12 px-6">
                        <ShotListEditor bookId={params.id} />
                    </motion.div>
                ) : activeTab === 'collaborators' ? (
                    <motion.div key="collaborators" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 px-6">
                        <CollaboratorManager book={book} />
                    </motion.div>
                ) : activeChapter ? (
                    <motion.div key={activeChapterId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn("min-h-full py-12 px-4 md:px-12 flex flex-col items-center")}>
                        {/* Toolbar Area */}
                        {!isZenMode && (
                            <div className="w-full max-w-[850px] flex items-center justify-start md:justify-center gap-1 mb-10 p-2 px-4 bg-background/80 backdrop-blur-xl border border-primary/10 rounded-[2.5rem] shadow-[0_15px_40px_-15px_rgba(59,130,246,0.2)] sticky top-4 z-[120] overflow-x-auto no-scrollbar ring-1 ring-white/20">
                                {isScreenplay ? (
                                    <>
                                        {[
                                            { type: 'slugline', label: 'Scene', icon: ImageIcon },
                                            { type: 'action', label: 'Action', icon: Megaphone },
                                            { type: 'character', label: 'Character', icon: User },
                                            { type: 'parenthetical', label: 'Parens', icon: () => <span className="font-black text-sm h-5 flex items-center">( )</span> },
                                            { type: 'dialogue', label: 'Dialogue', icon: MessageCircle },
                                            { type: 'transition', label: 'Transition', icon: ArrowLeftRight },
                                        ].map((btn) => {
                                            const isActive = activeBlockType === btn.type;
                                            return (
                                                <Button 
                                                    key={btn.type}
                                                    variant="ghost" 
                                                    onClick={() => screenplayEditorRef.current?.setBlockType(btn.type as any)} 
                                                    className={cn(
                                                        "flex items-center gap-1.5 h-auto py-2.5 px-4 rounded-[1.25rem] transition-all group shrink-0 active:scale-95",
                                                        isActive ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-primary/5 hover:text-primary"
                                                    )}
                                                >
                                                    <btn.icon className={cn("h-5 w-5 transition-colors", isActive ? "text-white" : "text-muted-foreground group-hover:text-primary")} />
                                                    <span className={cn("text-[9px] font-black uppercase tracking-widest", isActive ? "text-white" : "opacity-40 group-hover:opacity-100")}>{btn.label}</span>
                                                </Button>
                                            )
                                        })}
                                        <div className="w-px h-10 bg-primary/10 mx-2 shrink-0" />
                                        <Button 
                                            variant="ghost" 
                                            onClick={() => handleTabSwitch('shotlist')} 
                                            className="flex items-center gap-1.5 h-auto py-2.5 px-4 rounded-[1.25rem] hover:bg-orange-500/5 hover:text-orange-600 transition-all group shrink-0 active:scale-95"
                                        >
                                            <Video className="h-5 w-5 text-muted-foreground group-hover:text-orange-600" />
                                            <span className="text-[9px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100">Shot</span>
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Button variant="ghost" onClick={() => insertMarkdown('**', '**')} className="h-10 w-10 p-0 rounded-xl hover:bg-primary/10 hover:text-primary"><Bold className="h-4 w-4"/></Button>
                                        <Button variant="ghost" onClick={() => insertMarkdown('*', '*')} className="h-10 w-10 p-0 rounded-xl hover:bg-primary/10 hover:text-primary"><Italic className="h-4 w-4"/></Button>
                                        <Button variant="ghost" onClick={() => insertMarkdown('> ')} className="h-10 w-10 p-0 rounded-xl hover:bg-primary/10 hover:text-primary"><Quote className="h-4 w-4"/></Button>
                                        <Button variant="ghost" onClick={() => insertMarkdown('### ')} className="h-10 w-10 p-0 rounded-xl hover:bg-primary/10 hover:text-primary"><Heading1 className="h-4 w-4"/></Button>
                                        <div className="w-px h-10 bg-primary/10 mx-2 shrink-0" />
                                        <p className="text-[9px] font-black uppercase tracking-widest text-primary/40 px-2">{isPoem ? 'Industrial Poetry Mode' : 'Industrial Novel Mode'}</p>
                                    </>
                                )}

                                <div className="w-px h-10 bg-primary/10 mx-2 shrink-0" />
                                
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button 
                                            variant="ghost" 
                                            className="flex items-center gap-1.5 h-auto py-2.5 px-4 rounded-[1.25rem] hover:bg-indigo-500/5 hover:text-indigo-600 transition-all group shrink-0 active:scale-95"
                                        >
                                            <Wand2 className={cn("h-5 w-5 text-muted-foreground group-hover:text-indigo-600", isAiRunning && "animate-spin")} />
                                            <span className={cn("text-[9px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100")}>AI Assistant</span>
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-2 rounded-[1.5rem] border-none shadow-2xl z-[130]">
                                        <div className="p-3 border-b bg-indigo-500/5 rounded-t-[1.25rem] mb-1">
                                            <div className="flex items-center gap-2 text-indigo-600">
                                                <Bot className="h-4 w-4" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Kecerdasan Elitera</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {isScreenplay ? (
                                                <>
                                                    <Button variant="ghost" className="justify-start gap-3 h-11 rounded-xl text-xs font-bold" onClick={() => runAiScreenplayDoctor('naturalize_dialogue')}>
                                                        <MessageCircle className="h-4 w-4 text-primary" /> Naturalize Dialogue
                                                    </Button>
                                                    <Button variant="ghost" className="justify-start gap-3 h-11 rounded-xl text-xs font-bold" onClick={() => runAiScreenplayDoctor('summarize')}>
                                                        <FileText className="h-4 w-4 text-emerald-500" /> Summarize Logline
                                                    </Button>
                                                    <Button variant="ghost" className="justify-start gap-3 h-11 rounded-xl text-xs font-bold" onClick={() => runAiScreenplayDoctor('suggest_plot')}>
                                                        <Sparkles className="h-4 w-4 text-orange-500" /> Suggest Plot Conflict
                                                    </Button>
                                                </>
                                            ) : isPoem ? (
                                                <>
                                                    <Button variant="ghost" className="justify-start gap-3 h-11 rounded-xl text-xs font-bold" onClick={() => runAiPoetryAssistant('rhyme_polish')}>
                                                        <Sparkles className="h-4 w-4 text-rose-500" /> Rhyme Polish Bait
                                                    </Button>
                                                    <Button variant="ghost" className="justify-start gap-3 h-11 rounded-xl text-xs font-bold" onClick={() => runAiPoetryAssistant('deepen_metaphor')}>
                                                        <Feather className="h-4 w-4 text-primary" /> Deepen Metaphor
                                                    </Button>
                                                    <Button variant="ghost" className="justify-start gap-3 h-11 rounded-xl text-xs font-bold" onClick={() => runAiPoetryAssistant('emotional_boost')}>
                                                        <Bot className="h-4 w-4 text-orange-500" /> Emotional Booster
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button variant="ghost" className="justify-start gap-3 h-11 rounded-xl text-xs font-bold" onClick={() => runAiNovelAssistant('tone_polish')}>
                                                        <Sparkles className="h-4 w-4 text-primary" /> Tone Polish Narasi
                                                    </Button>
                                                    <Button variant="ghost" className="justify-start gap-3 h-11 rounded-xl text-xs font-bold" onClick={() => runAiNovelAssistant('describe_scene')}>
                                                        <Eye className="h-4 w-4 text-emerald-500" /> Describe Scene Visual
                                                    </Button>
                                                    <Button variant="ghost" className="justify-start gap-3 h-11 rounded-xl text-xs font-bold" onClick={() => runAiNovelAssistant('show_dont_tell')}>
                                                        <Bot className="h-4 w-4 text-orange-500" /> Show, Don't Tell Doctor
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        <div className={cn(
                            "w-full mx-auto",
                            isScreenplay ? "max-w-[8.5in]" : "max-w-3xl"
                        )}>
                            <Form {...chapterForm}><form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
                                <FormField control={chapterForm.control} name="title" render={({ field }) => (
                                    <FormItem className="mb-10">
                                        <FormControl>
                                            <Input 
                                                placeholder={isScreenplay ? "SCENE HEADING..." : isPoem ? "Judul Bait..." : "Judul Bab..."} 
                                                {...field} 
                                                className={cn(
                                                    "border-none shadow-none focus-visible:ring-0 h-auto p-0 transition-colors text-center",
                                                    isScreenplay ? "text-xl font-mono font-black uppercase tracking-widest text-zinc-400 focus:text-zinc-900" : "text-3xl md:text-5xl font-headline font-black"
                                                )} 
                                            />
                                        </FormControl>
                                    </FormItem>
                                )} />
                                
                                {isScreenplay ? (
                                    <ScreenplayEditor 
                                        key={activeChapterId || 'screenplay'}
                                        ref={screenplayEditorRef}
                                        initialContent={activeChapter.content} 
                                        onBlockFocus={handleBlockFocus}
                                        onChange={handleEditorChange}
                                        isReadOnly={!canEdit}
                                    />
                                ) : (
                                    <div className="bg-white rounded-[2.5rem] shadow-[0_20px_80px_-20px_rgba(0,0,0,0.1)] p-8 md:p-16 border border-zinc-100 min-h-[80vh] relative group/paper">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
                                        <FormField control={chapterForm.control} name="content" render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Textarea 
                                                        ref={novelTextareaRef}
                                                        placeholder={isPoem ? "Tuangkan bait-bait indahmu kawan..." : "Mulai tuangkan narasimu kawan..."}
                                                        className={cn(
                                                            "min-h-[70vh] border-none shadow-none px-0 focus-visible:ring-0 resize-none no-scrollbar text-lg md:text-2xl font-serif leading-[1.8] text-zinc-800",
                                                            isPoem && "text-center italic"
                                                        )}
                                                        {...field} 
                                                        readOnly={!canEdit}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )} />
                                        
                                        {!isZenMode && (
                                            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] hidden md:flex items-center gap-6 px-8 py-3 bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl text-white/60">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-3 w-3 text-primary" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">{novelStats.words} Kata</span>
                                                </div>
                                                <div className="w-px h-4 bg-white/10" />
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-3 w-3 text-emerald-400" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Est. {novelStats.minutes} Menit Baca</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </form></Form>
                        </div>
                    </motion.div>
                ) : (
                    <div key="empty" className="flex flex-col items-center justify-center h-full opacity-30 p-12 text-center">
                        <Clapperboard className="h-16 w-16 mb-6" />
                        <h4 className="text-2xl font-headline font-bold">
                            {isScreenplay ? 'Pilih atau Buat Scene Baru' : isPoem ? 'Pilih atau Buat Bait Baru' : 'Pilih atau Buat Bab Baru'}
                        </h4>
                        {canEdit && <Button onClick={handleAddChapter} className="mt-6 rounded-full px-8">Buat Sekarang</Button>}
                    </div>
                )}
            </AnimatePresence>
        </div>
      </main>

      {/* Chapter Deletion Dialog */}
      <AlertDialog open={!!isDeletingChapter} onOpenChange={(open) => !open && setIsDeletingChapter(null)}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
            <AlertDialogHeader>
                <div className="mx-auto bg-rose-50 p-4 rounded-2xl w-fit mb-4"><AlertTriangle className="h-8 w-8 text-rose-500" /></div>
                <AlertDialogTitle className="font-headline text-2xl font-black text-center">Hapus Bagian?</AlertDialogTitle>
                <AlertDialogDescription className="text-center font-medium">Tindakan ini permanen. Seluruh bait atau paragraf di bagian ini akan hilang dari sejarah naskah kawan.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 flex gap-3">
                <AlertDialogCancel className="rounded-full h-12 flex-1 border-2 font-bold">Batal</AlertDialogCancel>
                <AlertDialogAction onClick={() => isDeletingChapter && handleDeleteChapter(isDeletingChapter)} className="rounded-full h-12 flex-1 bg-rose-500 font-black shadow-lg shadow-rose-500/20">Ya, Hapus</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8">
            <AlertDialogHeader>
                <div className="mx-auto bg-primary/10 p-4 rounded-2xl w-fit mb-4"><BookUp className="h-8 w-8 text-primary" /></div>
                <AlertDialogTitle className="font-headline text-2xl font-black text-center">Terbitkan Karya?</AlertDialogTitle>
                <AlertDialogDescription className="text-center font-medium">Karya Anda akan dikirim ke tim kurasi Elitera sebelum tampil secara resmi di hadapan seluruh pembaca kawan.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 flex flex-col sm:flex-row gap-2">
                <AlertDialogCancel className="rounded-full h-12 border-2 flex-1 font-bold">Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleSubmitForReview} className="rounded-full h-12 flex-1 font-black bg-primary shadow-xl shadow-primary/20">Kirim Sekarang</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
