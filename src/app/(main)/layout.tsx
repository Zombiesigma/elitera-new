'use client';

import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { ProtectedLayout } from '@/components/auth/ProtectedLayout';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Deteksi rute yang memerlukan tata letak layar penuh tanpa gulir utama (Messenger & AI)
  const isImmersiveRoute = pathname?.startsWith('/messages') || pathname?.startsWith('/ai') || pathname?.startsWith('/reels');

  return (
    <ProtectedLayout>
      <div className={cn(
        "relative flex flex-col bg-background w-full",
        isImmersiveRoute ? "h-screen overflow-hidden" : "min-h-screen"
      )}>
        <Header />
        <main className={cn(
          "flex-1 flex flex-col relative w-full",
          isImmersiveRoute ? "overflow-hidden" : "overflow-y-auto"
        )}>
          <div className={cn(
            "flex-1 relative mx-auto w-full",
            isImmersiveRoute ? "container-none h-full" : "container px-4 py-6 md:px-6"
          )}>
            {children}
          </div>
        </main>
        
        {/* Spacer bawah hanya muncul jika bukan rute imersif */}
        {!isImmersiveRoute && <div className="h-12 md:hidden shrink-0" />} 
        <MobileNav />
      </div>
    </ProtectedLayout>
  );
}
