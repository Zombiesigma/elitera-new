import Link from 'next/link';
import Image from 'next/image';
import type { Book } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Eye, Layers, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';

type BookCardProps = {
  book: Book;
};

export function BookCard({ book }: BookCardProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <Link href={`/books/${book.id}`} className="group block h-full">
      <Card className="overflow-hidden transition-all duration-300 active:scale-95 border-none shadow-sm hover:shadow-xl rounded-[1.5rem] h-full flex flex-col bg-card/50 backdrop-blur-sm">
        <div className="aspect-[2/3] relative overflow-hidden">
          <Image
            src={book.coverUrl}
            alt={`Sampul ${book.title}`}
            fill
            className="object-cover bg-muted transition-transform duration-500 group-hover:scale-110"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
          <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1.5 border border-white/10">
             <Heart className="h-2.5 w-2.5 text-red-500 fill-current" />
             <span className="text-[8px] font-black text-white">{isMounted ? new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(book.favoriteCount) : '...'}</span>
          </div>
        </div>
        <CardContent className="p-4 flex flex-col flex-grow space-y-3">
          <h3 className="font-headline text-sm font-black leading-tight group-hover:text-primary transition-colors line-clamp-2">
            {book.title}
          </h3>
          <div className="flex items-center gap-2">
            <Avatar className="h-5 w-5 ring-1 ring-border">
              <AvatarImage src={book.authorAvatarUrl} alt={book.authorName} className="object-cover" />
              <AvatarFallback className="text-[10px] font-black">{book.authorName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <p className="text-[10px] font-bold text-muted-foreground truncate uppercase tracking-tighter">{book.authorName}</p>
          </div>
          
          <div className="flex items-center gap-3 text-[10px] font-black text-muted-foreground/60 mt-auto pt-2 border-t border-border/30 uppercase tracking-widest">
            <div className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>{isMounted ? new Intl.NumberFormat('id-ID', { notation: 'compact' }).format(book.viewCount) : '...'}</span>
            </div>
            <div className="flex items-center gap-1">
              <Layers className="h-3 w-3" />
              <span>{isMounted ? book.chapterCount ?? 0 : '...'}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}