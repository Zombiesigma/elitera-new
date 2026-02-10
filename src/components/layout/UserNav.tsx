'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import {
  Settings,
  LogOut,
  BookUser,
  Info,
  ChevronRight,
  Moon,
  Sun,
  Shield,
  User as UserIcon,
  HelpCircle,
  Sparkles,
  LayoutGrid,
  Heart,
  MessageSquare,
  Bot,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { signOut } from '@/firebase/auth/service';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export function UserNav() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLogoutAlertOpen, setIsLogoutAlertOpen] = useState(false);

  // Fix for pointer events sticking after sheet close
  useEffect(() => {
    if (!isSheetOpen && !isLogoutAlertOpen) {
        const timer = setTimeout(() => {
            document.body.style.pointerEvents = '';
        }, 300);
        return () => clearTimeout(timer);
    }
  }, [isSheetOpen, isLogoutAlertOpen]);

  const userProfileRef = (firestore && user) ? doc(firestore, 'users', user.uid) : null;
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<AppUser>(userProfileRef);
  
  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  const handleSignOut = async () => {
    setIsLogoutAlertOpen(false);
    setIsSheetOpen(false);
    
    // Smooth delay for transitions
    setTimeout(async () => {
        await signOut();
        document.body.style.pointerEvents = '';
        router.push('/login');
    }, 200);
  };
  
  if (isLoading || !user) return null;

  const userInitial = user.displayName ? user.displayName.charAt(0) : (user.email ? user.email.charAt(0) : 'U');

  const NavLink = ({ href, icon: Icon, label, description, className }: any) => (
    <SheetClose asChild>
        <Link 
            href={href} 
            className={cn(
                "flex items-center justify-between p-4 rounded-[1.25rem] transition-all duration-300 group hover:bg-primary/5 active:scale-[0.98]",
                className
            )}
        >
            <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-muted group-hover:bg-primary group-hover:text-white transition-all duration-300 shadow-sm">
                    <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col">
                    <span className="font-bold text-sm group-hover:text-primary transition-colors">{label}</span>
                    {description && <span className="text-[10px] text-muted-foreground font-medium">{description}</span>}
                </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/20 transition-transform group-hover:translate-x-1 group-hover:text-primary/50" />
        </Link>
    </SheetClose>
  );

  return (
    <>
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetTrigger asChild>
          <button className="relative rounded-full p-0.5 transition-all active:scale-90 group focus:outline-none">
            <div className="rounded-full bg-gradient-to-tr from-primary/20 via-accent/20 to-primary/20 p-0.5 group-hover:from-primary group-hover:to-accent transition-all duration-500 shadow-lg">
                <Avatar className="h-9 w-9 border-2 border-background">
                    <AvatarImage src={user.photoURL ?? ''} alt={user.displayName ?? 'User'} className="object-cover" />
                    <AvatarFallback className="bg-primary/5 text-primary font-black">{userInitial}</AvatarFallback>
                </Avatar>
            </div>
          </button>
        </SheetTrigger>
        <SheetContent 
            side="right" 
            className="w-[85vw] max-w-sm flex flex-col p-0 border-l bg-background/95 backdrop-blur-2xl z-[150] shadow-2xl"
            onCloseAutoFocus={(e) => {
                e.preventDefault();
                document.body.style.pointerEvents = '';
            }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Menu Navigasi Profil</SheetTitle>
          </SheetHeader>

          {/* Header Profile Section */}
          <div className="p-6 pb-8 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent border-b border-primary/5">
            <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative group">
                    <Avatar className="h-20 w-20 border-4 border-background shadow-2xl transition-transform group-hover:scale-105">
                        <AvatarImage src={user.photoURL ?? ''} className="object-cover" />
                        <AvatarFallback className="bg-primary/10 text-primary text-2xl font-black italic">{userInitial}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-500 border-4 border-background rounded-full shadow-lg animate-pulse" />
                </div>
                <div className="space-y-1">
                    <h3 className="font-headline text-xl font-black truncate max-w-[200px]">{user.displayName || 'Pujangga Elitera'}</h3>
                    <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em]">@{userProfile?.username || 'user'}</p>
                </div>
                {userProfile && (
                    <Badge variant={isAdmin ? "default" : "secondary"} className={cn(
                        "rounded-full px-4 py-0.5 font-bold shadow-sm border-none uppercase text-[9px] tracking-widest",
                        isAdmin ? "bg-rose-500 text-white" : "bg-primary/10 text-primary"
                    )}>
                        {userProfile.role}
                    </Badge>
                )}
            </div>
          </div>
          
          {/* Menu Body */}
          <div className="flex-grow overflow-y-auto custom-scrollbar">
            <nav className="flex flex-col gap-1.5 p-4">
              {isAdmin && (
                 <NavLink 
                    href="/admin" 
                    icon={Shield} 
                    label="Pusat Kendali" 
                    description="Otoritas dan moderasi sistem"
                    className="bg-rose-500/5 border border-rose-500/10 mb-4" 
                 />
              )}
              
              <div className="space-y-1 mb-6">
                <p className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Akses Cepat</p>
                <NavLink href={`/profile/${userProfile?.username?.toLowerCase()}`} icon={UserIcon} label="Profil Utama" description="Lihat jejak karyamu" />
                <NavLink href="/ai" icon={Bot} label="Elitera AI" description="Asisten kreatif puitis" />
                <NavLink href="/messages" icon={MessageSquare} label="Kotak Pesan" description="Diskusi pribadi antar pujangga" />
                <NavLink href="/notifications" icon={Sparkles} label="Kabar Terbaru" description="Aktivitas dan interaksi" />
              </div>

              <div className="space-y-1 mb-6">
                <p className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Pengaturan</p>
                <NavLink href="/settings" icon={Settings} label="Edit Profil" description="Identitas dan privasi" />
                <div
                    onClick={toggleTheme}
                    className="flex items-center justify-between p-4 rounded-[1.25rem] transition-all duration-300 group hover:bg-primary/5 cursor-pointer active:scale-[0.98]"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-muted group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                            <Sun className="h-4.5 w-4.5 dark:hidden" />
                            <Moon className="h-4.5 w-4.5 hidden dark:block" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm group-hover:text-primary transition-colors">Tema Aplikasi</span>
                            <span className="text-[10px] text-muted-foreground font-medium">Terang / Gelap</span>
                        </div>
                    </div>
                </div>
              </div>

              <div className="space-y-1">
                <p className="px-4 py-2 text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">Informasi</p>
                <NavLink href="/guide" icon={HelpCircle} label="Panduan Elitera" />
                <NavLink href="/about" icon={Info} label="Tentang Kami" />
              </div>
            </nav>

            <div className="p-6 mt-4">
              <Button 
                variant="ghost" 
                className="w-full justify-start gap-4 h-14 rounded-2xl text-destructive hover:text-destructive hover:bg-destructive/5 font-black border border-transparent hover:border-destructive/10 transition-all duration-300"
                onClick={() => setIsLogoutAlertOpen(true)}
              >
                <div className="p-2.5 rounded-xl bg-destructive/10">
                    <LogOut className="h-4.5 w-4.5" />
                </div>
                <div className="flex flex-col items-start">
                    <span className="text-sm">Akhiri Sesi</span>
                    <span className="text-[9px] opacity-60 uppercase tracking-widest">Sign Out</span>
                </div>
              </Button>
            </div>
          </div>

          <SheetFooter className="p-6 border-t bg-muted/5 flex flex-col items-center gap-2 mt-auto">
            <div className="flex items-center gap-2 opacity-20 select-none grayscale">
                <Sparkles className="h-3 w-3" />
                <span className="text-[8px] font-black uppercase tracking-[0.4em]">Elitera Ecosystem v1.0</span>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={isLogoutAlertOpen} onOpenChange={setIsLogoutAlertOpen}>
        <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-8 max-w-[90vw] md:max-w-md">
          <AlertDialogHeader>
            <div className="mx-auto bg-destructive/10 p-4 rounded-[1.5rem] w-fit mb-4">
                <LogOut className="h-8 w-8 text-destructive" />
            </div>
            <AlertDialogTitle className="font-headline text-2xl font-black text-center leading-tight">Beristirahat dari <br/><span className="text-primary italic">Inspirasi?</span></AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-center text-muted-foreground leading-relaxed pt-2">
              Anda akan keluar dari sesi Elitera. Tenang, setiap draf dan sejarah karyamu tetap tersimpan abadi di sini. Kami menanti kembalinya inspirasimu segera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 flex flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="rounded-full border-2 font-bold h-12 flex-1">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} className="bg-destructive hover:bg-destructive/90 rounded-full font-black h-12 px-8 shadow-xl shadow-destructive/20 text-white flex-1">Ya, Keluar Sekarang</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
        }
      `}</style>
    </>
  );
}
