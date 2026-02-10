'use client';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { BookCard } from "@/components/BookCard";
import type { Book } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

interface BookCarouselProps {
  title: string;
  books: Book[] | null;
  isLoading: boolean;
}

export function BookCarousel({ title, books, isLoading }: BookCarouselProps) {
  return (
    <section className="group">
      {title && <h2 className="text-2xl font-headline font-bold mb-6 tracking-tight">{title}</h2>}
      
      {isLoading && (
        <div className="flex space-x-6 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-4 w-[180px] flex-shrink-0">
              <Skeleton className="aspect-[2/3] w-full rounded-[1.5rem]" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-3 w-2/3 rounded-full opacity-60" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && books && books.length > 0 && (
        <div className="relative">
          <Carousel
            opts={{
              align: "start",
              dragFree: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-4 md:-ml-6">
              {books.map((book) => (
                <CarouselItem key={book.id} className="basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5 xl:basis-1/6 pl-4 md:pl-6">
                  <BookCard book={book} />
                </CarouselItem>
              ))}
            </CarouselContent>
            
            <div className="hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <CarouselPrevious className="-left-12 h-12 w-12 border-2 shadow-xl hover:bg-primary hover:text-white transition-all" />
              <CarouselNext className="-right-12 h-12 w-12 border-2 shadow-xl hover:bg-primary hover:text-white transition-all" />
            </div>
          </Carousel>
        </div>
      )}

      {!isLoading && (!books || books.length === 0) && (
        <div className="text-center py-16 bg-muted/20 rounded-[2rem] border-2 border-dashed">
          <p className="text-muted-foreground font-medium">Belum ada karya untuk ditampilkan di bagian ini.</p>
        </div>
      )}
    </section>
  );
}
