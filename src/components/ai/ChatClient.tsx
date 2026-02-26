"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import type { FormEvent } from 'react';
import { Bot, Send, Loader2, Sparkles, Lightbulb, HelpCircle, BookOpen, Clock, Zap, Cpu, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { chatWithEliteraAI } from "@/ai/flows/chat-with-litera-ai";
import type { AiChatMessage } from '@/lib/types';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SUGGESTIONS = [
    { label: "Bantu ide plot fantasi kawan", icon: Sparkles, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Cara terbitkan naskah di Elitera", icon: BookOpen, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Teknik Show Don't Tell", icon: Lightbulb, color: "text-yellow-500", bg: "bg-yellow-500/10" },
    { label: "Panduan format naskah film", icon: HelpCircle, color: "text-emerald-500", bg: "bg-emerald-500/10" },
];

export function ChatClient({ history }: { history: AiChatMessage[] }) {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [viewportHeight, setViewportHeight] = useState('100%');
  const [viewportOffsetTop, setViewportOffsetTop] = useState(0);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const aiMessagesQuery = useMemo(() => (
    (firestore && currentUser) 
      ? query(collection(firestore, `users/${currentUser.uid}/aiMessages`), orderBy('createdAt', 'asc'))
      : null
  ), [firestore, currentUser]);

  const { data: dbMessages, isLoading: isHistoryLoading } = useCollection<AiChatMessage>(aiMessagesQuery);

  const allMessages = useMemo(() => {
      if (!dbMessages && isHistoryLoading) return []; 
      if (dbMessages && dbMessages.length > 0) return dbMessages;
      return history;
  }, [dbMessages, history, isHistoryLoading]);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTo({
                top: viewport.scrollHeight,
                behavior
            });
        }
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const vv = window.visualViewport;
    const handleViewportChange = () => {
      // Use visualViewport height to ensure the input is above the software keyboard
      setViewportHeight(`${vv.height}px`);
      setViewportOffsetTop(vv.offsetTop);
      scrollToBottom('auto');
    };

    vv.addEventListener('resize', handleViewportChange);
    vv.addEventListener('scroll', handleViewportChange);
    handleViewportChange();
    
    return () => {
      vv.removeEventListener('resize', handleViewportChange);
      vv.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

  useEffect(() => {
    scrollToBottom(dbMessages?.length ? 'smooth' : 'auto');
  }, [allMessages, isProcessing, isHistoryLoading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isProcessing || !firestore || !currentUser) return;

    const userMessageContent = text.trim();
    setInput("");
    setIsProcessing(true);

    try {
      const aiMessagesCol = collection(firestore, `users/${currentUser.uid}/aiMessages`);
      await addDoc(aiMessagesCol, {
        role: "user",
        content: userMessageContent,
        createdAt: serverTimestamp(),
      });

      const chatHistory = allMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const result = await chatWithEliteraAI({ 
        message: userMessageContent, 
        chatHistory,
        userName: currentUser?.displayName || 'Pujangga Elitera',
      });
      
      await addDoc(aiMessagesCol, {
        role: "model",
        content: result.response,
        createdAt: serverTimestamp(),
      });

    } catch (error) {
      console.error("Error with Elitera AI:", error);
      const aiMessagesCol = collection(firestore, `users/${currentUser.uid}/aiMessages`);
      await addDoc(aiMessagesCol, {
        role: "model",
        content: "Maaf kawan, frekuensi inspirasi saya sedang mengalami sedikit interferensi. Bisakah kawan mencoba mengirim pesan lagi?",
        createdAt: serverTimestamp(),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSend(input);
  };

  useEffect(() => {
      if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
      }
  }, [input]);

  return (
    <div 
      className="flex flex-col bg-background/50 overflow-hidden relative w-full" 
      style={{ 
        height: viewportHeight,
        transform: `translateY(${viewportOffsetTop}px)`
      }}
    >
      <ScrollArea className="flex-1 min-h-0 relative z-10" ref={scrollAreaRef}>
        <div className="max-w-3xl mx-auto p-4 md:p-10 space-y-8 md:space-y-12 pb-32 md:pb-20">
          {isHistoryLoading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-6 opacity-40">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                    <Loader2 className="h-12 w-12 animate-spin text-primary relative z-10" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em]">Memulihkan Ingatan kawan...</p>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest italic">Neural Sync in Progress</p>
                  </div>
              </div>
          ) : (
            <>
                {allMessages.length <= 1 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="py-12 md:py-20 text-center space-y-12"
                    >
                        <div className="relative inline-flex">
                            <div className="absolute inset-0 bg-primary/20 blur-[80px] rounded-full scale-150 animate-pulse" />
                            <div className="relative p-8 rounded-[3rem] bg-white dark:bg-zinc-950 border border-primary/10 shadow-2xl shadow-primary/10 ring-1 ring-white/5">
                                <Bot className="h-20 w-20 text-primary" />
                            </div>
                        </div>
                        
                        <div className="space-y-4 px-6">
                            <h2 className="text-4xl md:text-5xl font-headline font-black tracking-tight leading-tight italic">
                                Selamat Datang, <span className="text-primary underline decoration-primary/20">{currentUser?.displayName?.split(' ')[0]}</span>
                            </h2>
                            <p className="text-muted-foreground max-w-md mx-auto text-base md:text-lg leading-relaxed font-medium italic opacity-80">
                                "Saya adalah rekan dialog kawan. Mari kita tumpahkan segala imajinasi ke dalam panggung narasi Elitera."
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto px-4">
                            {SUGGESTIONS.map((item, i) => (
                                <motion.button 
                                    key={i}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 * i, type: 'spring' }}
                                    onClick={() => handleSend(item.label)}
                                    className="flex items-center gap-4 p-5 rounded-[2rem] bg-card border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all shadow-lg hover:shadow-2xl group text-left relative overflow-hidden"
                                >
                                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all">
                                        <ArrowRight className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className={cn("p-3 rounded-2xl transition-all group-hover:scale-110 shadow-inner", item.bg, item.color)}>
                                        <item.icon className="h-6 w-6" />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-widest opacity-70 group-hover:opacity-100 group-hover:text-primary transition-colors">{item.label}</span>
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}

                <AnimatePresence initial={false}>
                    {allMessages.map((m, i) => (
                    <motion.div
                        key={m.id || i}
                        initial={{ opacity: 0, y: 25, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        className={cn(
                        "flex items-start gap-4 md:gap-6",
                        m.role === "user" ? "flex-row-reverse" : "flex-row"
                        )}
                    >
                        <div className="shrink-0 mt-2">
                            {m.role === "model" ? (
                                <div className="h-10 w-10 md:h-12 md:w-12 rounded-[1.25rem] bg-primary flex items-center justify-center shadow-xl shadow-primary/20 ring-4 ring-primary/10 transition-transform hover:rotate-12">
                                    <Bot className="h-6 w-6 md:h-7 md:w-7 text-white" />
                                </div>
                            ) : (
                                <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-background shadow-2xl ring-4 ring-muted/30">
                                    <AvatarImage src={currentUser?.photoURL ?? ''} className="object-cover" />
                                    <AvatarFallback className="bg-primary/5 text-primary font-black text-xl italic">{currentUser?.displayName?.charAt(0) ?? 'U'}</AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                        
                        <div
                        className={cn(
                            "max-w-[85%] md:max-w-[80%] p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-xl leading-relaxed relative border group transition-all",
                            m.role === "user"
                            ? "bg-primary text-white rounded-tr-none shadow-primary/20 border-white/10 ring-1 ring-white/5"
                            : "bg-card border-border/50 rounded-tl-none font-medium text-foreground/90 backdrop-blur-md"
                        )}
                        >
                        <div className={cn(
                            "prose prose-sm md:prose-base max-w-none break-words dark:prose-invert prose-p:leading-[1.8] prose-headings:font-headline prose-headings:font-black prose-headings:mb-4 prose-headings:mt-6 first:prose-headings:mt-0 prose-pre:bg-muted/50 prose-pre:text-muted-foreground prose-blockquote:border-l-4 prose-blockquote:border-primary/40 prose-blockquote:bg-primary/5 prose-blockquote:py-4 prose-blockquote:px-6 prose-blockquote:rounded-r-3xl prose-blockquote:italic",
                            m.role === "user" ? "prose-invert text-white prose-p:font-bold" : "text-foreground/90"
                        )}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {m.content}
                            </ReactMarkdown>
                        </div>
                        
                        <div className={cn(
                            "absolute top-0 w-6 h-6",
                            m.role === "user" 
                                ? "-right-2 bg-primary [clip-path:polygon(0_0,100%_0,0_100%)] shadow-xl" 
                                : "-left-2 bg-card border-l border-t border-border/50 [clip-path:polygon(0_0,100%_0,100%_100%)] shadow-md"
                        )} />
                        
                        <div className={cn(
                            "mt-4 flex items-center gap-2 opacity-0 group-hover:opacity-40 transition-opacity duration-500",
                            m.role === "user" ? "justify-end" : "justify-start"
                        )}>
                            <Clock className="h-3 w-3" />
                            <span className="text-[8px] font-black uppercase tracking-widest">Inspirasi Tercatat</span>
                        </div>
                        </div>
                    </motion.div>
                    ))}
                    
                    {isProcessing && (
                    <motion.div 
                        initial={{ opacity: 0, x: -15 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-4 md:gap-6"
                    >
                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-[1.25rem] bg-primary/10 flex items-center justify-center border border-primary/20 animate-pulse">
                            <Cpu className="h-6 w-6 text-primary" />
                        </div>
                        <div className="bg-card border border-border/50 p-6 rounded-[2rem] rounded-tl-none shadow-xl relative">
                            <div className="flex gap-2.5">
                                <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2 }} className="h-2 w-2 rounded-full bg-primary" />
                                <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="h-2 w-2 rounded-full bg-primary" />
                            </div>
                            <div className="absolute -left-2 top-0 w-6 h-6 bg-card border-l border-t border-border/50 [clip-path:polygon(0_0,100%_0,100%_100%)]" />
                        </div>
                    </motion.div>
                    )}
                </AnimatePresence>
            </>
          )}
        </div>
      </ScrollArea>

      <div className={cn(
        "p-4 md:p-10 border-t border-border/40 bg-background/95 backdrop-blur-3xl shrink-0 z-[60] relative transition-all shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.15)]",
        "pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      )}>
        <div className="max-w-3xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-accent/20 to-primary/30 rounded-[2.5rem] blur-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-700 pointer-events-none" />
            
            <form onSubmit={handleSubmit} className="relative flex items-end gap-4">
                <div className="relative flex-1">
                    <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onFocus={() => setTimeout(() => scrollToBottom('smooth'), 300)}
                        placeholder="Tuangkan pertanyaan kawan di sini..."
                        className="relative w-full resize-none rounded-[2.25rem] border-none bg-muted/40 px-8 py-5 pr-16 min-h-[70px] max-h-48 focus-visible:ring-primary/20 focus-visible:bg-background transition-all shadow-inner text-base md:text-lg font-medium leading-relaxed no-scrollbar"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(input);
                            }
                        }}
                        rows={1}
                        disabled={isProcessing || isHistoryLoading}
                    />
                    <div className="absolute right-3 bottom-3">
                        <Button 
                            type="submit" 
                            size="icon" 
                            className="h-12 w-12 md:h-14 md:w-14 rounded-[1.5rem] shadow-2xl shadow-primary/30 transition-all active:scale-[0.85] bg-primary hover:bg-primary/90" 
                            disabled={isProcessing || !input.trim() || isHistoryLoading}
                        >
                            {isProcessing ? <Loader2 className="h-6 w-6 animate-spin text-white" /> : <Send className="h-6 w-6 text-white ml-0.5" />}
                        </Button>
                    </div>
                </div>
            </form>
            
            <div className="hidden md:flex items-center justify-center gap-6 mt-6 opacity-30 select-none">
                <div className="h-px bg-gradient-to-r from-transparent to-border flex-1" />
                <div className="flex items-center gap-3">
                    <div className="p-1 rounded-full bg-primary/20"><Sparkles className="h-3 w-3 text-primary animate-pulse" /></div>
                    <p className="text-[9px] font-black uppercase tracking-[0.5em] text-muted-foreground whitespace-nowrap">
                        Elitera Intelligence Neural Sync Active
                    </p>
                </div>
                <div className="h-px bg-gradient-to-l from-transparent to-border flex-1" />
            </div>
        </div>
      </div>
    </div>
  );
}
