'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useFirestore, useCollection, useUser } from '@/firebase';
import { collection, query, where, limit, orderBy } from 'firebase/firestore';
import type { Book, User } from '@/lib/types';

import { Input } from '@/components/ui/input';
import { Loader2, Search, Book as BookIcon, User as UserIcon, X, Command, ArrowLeft, TrendingUp } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

export function GlobalSearch() {
  const [queryValue, setQueryValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(queryValue);
    }, 300);

    return () => clearTimeout(handler);
  }, [queryValue]);

  // Index-Free Search Logic: Fetch broadly and filter in JS to avoid index errors
  const searchQueries = useMemo(() => {
      if (!debouncedQuery.trim() || !firestore || !currentUser) return { books: null, users: null };
      
      return {
          books: query(
              collection(firestore, 'books'),
              where('status', '==', 'published'),
              limit(100)
          ),
          users: query(
              collection(firestore, 'users'),
              limit(100)
          )
      };
  }, [firestore, debouncedQuery, currentUser]);

  const { data: rawBooks, isLoading: areBooksLoading } = useCollection<Book>(searchQueries.books);
  const { data: rawUsers, isLoading: areUsersLoading } = useCollection<User>(searchQueries.users);

  const filteredResults = useMemo(() => {
      const term = debouncedQuery.trim().toLowerCase();
      if (!term) return { books: [], users: [] };

      const books = (rawBooks || []).filter(b => 
          b.title?.toLowerCase().includes(term) || 
          b.genre?.toLowerCase().includes(term)
      ).slice(0, 5);

      const users = (rawUsers || []).filter(u => 
          u.displayName?.toLowerCase().includes(term) || 
          u.username?.toLowerCase().includes(term)
      ).slice(0, 5);

      return { books, users };
  }, [rawBooks, rawUsers, debouncedQuery]);

  const isLoading = areBooksLoading || areUsersLoading;

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!queryValue.trim()) return;
    router.push(`/search?q=${encodeURIComponent(queryValue.trim())}`);
    setQueryValue('');
    setIsFocused(false);
    inputRef.current?.blur();
  };
  
  const clearSearch = () => {
    setQueryValue('');
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full min-w-0" ref={containerRef}>
      <form onSubmit={handleSearchSubmit} className="relative group w-full">
        <Search className={cn(
            "absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 transition-colors z-[120]",
            isFocused ? "text-primary" : "text-muted-foreground"
        )} />
        <Input
          ref={inputRef}
          type="search"
          placeholder="Cari pujangga atau karya..."
          className={cn(
            "w-full bg-muted/40 pl-9 md:pl-11 pr-8 md:pr-12 h-9 md:h-11 rounded-xl md:rounded-2xl border-none transition-all duration-300 text-xs md:text-sm z-[115]",
            "focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20",
            isFocused && "md:shadow-lg"
          )}
          value={queryValue}
          onChange={(e) => setQueryValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
        />
        <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-[120]">
            {queryValue ? (
                <button type="button" onClick={clearSearch} className="p-1.5 hover:bg-muted rounded-full transition-colors">
                    <X className="h-3 w-3 md:h-3.5 md:w-3.5 text-muted-foreground" />
                </button>
            ) : (
                <div className="hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg border border-border/50 bg-background/50 text-[9px] font-black text-muted-foreground/40 shadow-sm">
                    <Command className="h-2.5 w-2.5" /> K
                </div>
            )}
        </div>
      </form>

      <AnimatePresence>
        {isFocused && (
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={cn(
                    "fixed md:absolute inset-0 md:inset-auto md:top-full md:mt-3 w-full md:w-[400px] lg:w-[500px] md:left-0 bg-background md:bg-background/95 md:backdrop-blur-xl md:rounded-[2rem] md:border md:shadow-2xl z-[110] overflow-hidden flex flex-col",
                    "md:max-h-[60vh]"
                )}
            >
                {/* Mobile Header Search Overlay */}
                <div className="flex items-center gap-4 p-4 md:hidden border-b shrink-0 pt-[max(1rem,env(safe-area-inset-top))]">
                    <Button variant="ghost" size="icon" onClick={() => setIsFocused(false)} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                        <Input 
                            autoFocus={true}
                            value={queryValue} 
                            onChange={(e) => setQueryValue(e.target.value)}
                            placeholder="Ketik untuk mencari..." 
                            className="h-11 pl-10 rounded-xl bg-muted/30 border-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar p-2">
                    {queryValue.trim().length === 0 ? (
                        <div className="p-6 space-y-6">
                            <div className="space-y-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-2 flex items-center gap-2">
                                    <TrendingUp className="h-3 w-3" /> Rekomendasi Eksplorasi
                                </p>
                                <div className="flex wrap gap-2">
                                    {['Novel', 'Fantasi', 'Romansa', 'Pengembangan Diri'].map(tag => (
                                        <Button 
                                            key={tag} 
                                            variant="secondary" 
                                            size="sm" 
                                            className="rounded-full text-[10px] font-bold px-4"
                                            onClick={() => { setQueryValue(tag); handleSearchSubmit(); }}
                                        >
                                            {tag}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 p-1">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center p-12 gap-3 opacity-40">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">Menelusuri Semesta...</p>
                                </div>
                            ) : (
                                <>
                                    {!filteredResults.books.length && !filteredResults.users.length ? (
                                        <div className="p-12 text-center space-y-3 opacity-30">
                                            <Search className="h-10 w-10 mx-auto" />
                                            <p className="text-xs font-bold uppercase tracking-widest">Tidak ada jejak ditemukan</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {filteredResults.users.length > 0 && (
                                                <div className="space-y-1">
                                                    <p className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.3em] text-primary/60">Pujangga</p>
                                                    {filteredResults.users.map(user => (
                                                        <Link key={user.id} href={`/profile/${user.username}`} onClick={() => setIsFocused(false)} className="flex items-center gap-4 p-3 rounded-2xl transition-all hover:bg-primary/5 group active:scale-[0.98]">
                                                            <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                                                                <AvatarImage src={user.photoURL} className="object-cover" />
                                                                <AvatarFallback className="bg-primary/5 text-primary font-black text-xs">
                                                                    {user.displayName?.charAt(0) || 'U'}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="min-w-0">
                                                                <p className="font-black text-sm truncate group-hover:text-primary transition-colors">{user.displayName}</p>
                                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">@{user.username}</p>
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}

                                            {filteredResults.users.length > 0 && filteredResults.books.length > 0 && <Separator className="opacity-50" />}

                                            {filteredResults.books.length > 0 && (
                                                <div className="space-y-1">
                                                    <p className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.3em] text-primary/60">Karya Sastra</p>
                                                    {filteredResults.books.map(book => (
                                                        <Link key={book.id} href={`/books/${book.id}`} onClick={() => setIsFocused(false)} className="flex items-center gap-4 p-3 rounded-2xl transition-all hover:bg-primary/5 group active:scale-[0.98]">
                                                            <div className="w-10 h-14 relative shrink-0 overflow-hidden rounded-lg shadow-md border border-white/10">
                                                                <img src={book.coverUrl} className="object-cover h-full w-full" alt="" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-black text-sm truncate group-hover:text-primary transition-colors leading-tight italic">"{book.title}"</p>
                                                                <p className="text-[10px] font-bold text-muted-foreground truncate uppercase mt-1 tracking-tighter">{book.authorName}</p>
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {!isLoading && queryValue.trim().length > 0 && (
                    <div className="p-4 bg-muted/20 border-t shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
                        <Button onClick={handleSearchSubmit} className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-primary/20">
                            Lihat Semua Hasil <Search className="ml-2 h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
