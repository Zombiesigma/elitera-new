'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import type { Book, User } from '@/lib/types';

import { Input } from '@/components/ui/input';
import { Loader2, Search, Book as BookIcon, User as UserIcon, X, Command } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function GlobalSearch() {
  const [queryValue, setQueryValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();
  const firestore = useFirestore();
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

  const capitalizedQuery = useMemo(() => {
      if (!debouncedQuery.trim()) return '';
      return debouncedQuery.charAt(0).toUpperCase() + debouncedQuery.slice(1);
  }, [debouncedQuery]);

  const booksQuery = useMemo(() => {
    if (!firestore || !capitalizedQuery) return null;
    return query(
      collection(firestore, 'books'),
      where('status', '==', 'published'),
      where('title', '>=', capitalizedQuery),
      where('title', '<=', capitalizedQuery + '\uf8ff'),
      limit(5)
    );
  }, [firestore, capitalizedQuery]);

  const usersQuery = useMemo(() => {
    if (!firestore || !capitalizedQuery) return null;
    return query(
      collection(firestore, 'users'),
      where('displayName', '>=', capitalizedQuery),
      where('displayName', '<=', capitalizedQuery + '\uf8ff'),
      limit(5)
    );
  }, [firestore, capitalizedQuery]);

  const { data: books, isLoading: areBooksLoading } = useCollection<Book>(booksQuery);
  const { data: users, isLoading: areUsersLoading } = useCollection<User>(usersQuery);

  const isLoading = areBooksLoading || areUsersLoading;

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

  const showResults = isFocused && queryValue.trim().length > 0;

  return (
    <div className="relative w-full min-w-0" ref={containerRef}>
      <form onSubmit={handleSearchSubmit} className="relative group w-full">
        <Search className={cn(
            "absolute left-3 md:left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 md:h-4 md:w-4 transition-colors z-10",
            isFocused ? "text-primary" : "text-muted-foreground"
        )} />
        <Input
          ref={inputRef}
          type="search"
          placeholder="Cari..."
          className={cn(
            "w-full bg-muted/40 pl-9 md:pl-11 pr-8 md:pr-12 h-9 md:h-11 rounded-xl md:rounded-2xl border-none transition-all duration-300 text-xs md:text-sm",
            "focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20"
          )}
          value={queryValue}
          onChange={(e) => setQueryValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
        />
        <div className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
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
        {showResults && (
            <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 5, scale: 0.98 }}
                className="absolute top-full mt-2 md:mt-3 w-[calc(100vw-2rem)] xs:w-[350px] md:w-full left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 rounded-[1.5rem] md:rounded-[2rem] border bg-background/95 backdrop-blur-xl shadow-2xl z-[110] overflow-hidden"
            >
                <div className="p-2">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center p-8 gap-3">
                            <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Menjelajah...</p>
                        </div>
                    )}
                    
                    {!isLoading && !books?.length && !users?.length && (
                        <div className="p-8 text-center space-y-2">
                            <Search className="h-5 w-5 text-muted-foreground/30 mx-auto" />
                            <p className="text-xs font-medium text-muted-foreground">Tidak ada hasil ditemukan.</p>
                        </div>
                    )}

                    <div className="max-h-[60vh] overflow-y-auto no-scrollbar space-y-4 p-1">
                        {users && users.length > 0 && (
                            <div className="space-y-1">
                                <p className="px-3 py-1 text-[8px] font-black uppercase tracking-widest text-primary/60">Pujangga</p>
                                {users.map(user => (
                                    <Link key={user.id} href={`/profile/${user.username}`} onClick={() => { setIsFocused(false); setQueryValue(''); }} className="flex items-center gap-3 p-2 rounded-xl transition-all hover:bg-primary/5 group">
                                        <Avatar className="h-8 w-8 border-2 border-background">
                                            <AvatarImage src={user.photoURL} className="object-cover" />
                                            <AvatarFallback className="bg-primary/5 text-primary text-[10px] font-black">{user.displayName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                            <p className="font-bold text-xs truncate group-hover:text-primary transition-colors">{user.displayName}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase">@{user.username}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}

                        {users && users.length > 0 && books && books.length > 0 && <Separator className="opacity-50" />}

                        {books && books.length > 0 && (
                            <div className="space-y-1">
                                <p className="px-3 py-1 text-[8px] font-black uppercase tracking-widest text-primary/60">Karya</p>
                                {books.map(book => (
                                    <Link key={book.id} href={`/books/${book.id}`} onClick={() => { setIsFocused(false); setQueryValue(''); }} className="flex items-center gap-3 p-2 rounded-xl transition-all hover:bg-primary/5 group">
                                        <div className="w-8 h-11 relative shrink-0 overflow-hidden rounded shadow-sm">
                                            <AvatarImage src={book.coverUrl} className="object-cover h-full w-full" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-xs truncate group-hover:text-primary transition-colors leading-tight">{book.title}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground truncate">{book.authorName}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {!isLoading && queryValue.trim().length > 0 && (
                        <div className="p-1 pt-0 mt-1">
                            <button onClick={() => { router.push(`/search?q=${encodeURIComponent(queryValue.trim())}`); setIsFocused(false); }} className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest">
                                Semua Hasil <Search className="h-3 w-3" />
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}