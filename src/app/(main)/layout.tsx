'use client';

import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { ProtectedLayout } from '@/components/auth/ProtectedLayout';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { IncomingCallOverlay } from '@/components/layout/IncomingCallOverlay';

export default function MainAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  const isImmersiveRoute = pathname?.startsWith('/messages') || 
                           pathname?.startsWith('/ai') || 
                           pathname?.startsWith('/reels') ||
                           pathname?.includes('/read') ||
                           pathname?.includes('/edit');

  return (
    <ProtectedLayout>
      <div className={cn(
        "relative flex flex-col bg-background w-full transition-all duration-500",
        isImmersiveRoute ? "h-dvh overflow-hidden" : "min-h-screen"
      )}>
        {!isImmersiveRoute && <Header />}
        
        <main className={cn(
          "flex-1 flex flex-col relative w-full",
          isImmersiveRoute ? "overflow-hidden" : "overflow-y-auto"
        )}>
          <div className={cn(
            "flex-1 relative mx-auto w-full",
            isImmersiveRoute ? "h-full" : "container px-4 py-6 md:px-6"
          )}>
            {children}
          </div>
        </main>
        
        {!isImmersiveRoute && (
          <>
            <div className="h-12 md:hidden shrink-0" /> 
            <MobileNav />
          </>
        )}

        <IncomingCallOverlay />
      </div>
    </ProtectedLayout>
  );
}
