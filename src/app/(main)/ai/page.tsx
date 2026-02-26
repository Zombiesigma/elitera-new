import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { MessageSquarePlus, History, Info, Zap, Star, PenTool, Cpu, Sparkles } from 'lucide-react';
import { ChatClient } from '@/components/ai/ChatClient';
import type { AiChatMessage } from '@/lib/types';

const initialHistory: AiChatMessage[] = [
    { role: 'model', content: 'Halo kawan! Saya **Elitera AI**. Senang melihat Anda di ruang inspirasi hari ini. Ada bait puisi yang ingin dipoles atau plot novel yang ingin kita susun bersama?' }
];

export default function AiPage() {
  return (
    <div className="h-dvh w-full overflow-hidden bg-background flex flex-col shadow-2xl relative">
        <SidebarProvider className="h-full overflow-hidden">
            <Sidebar collapsible="icon" className="border-r border-border/40 bg-muted/30">
                <SidebarHeader className="p-6 border-b border-border/40 bg-background/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                             <div className="relative group">
                                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                <Logo className="w-10 h-10 rounded-2xl shadow-xl shadow-primary/10 ring-1 ring-primary/20 relative z-10" />
                             </div>
                             <div className="group-data-[collapsible=icon]:hidden">
                                <h2 className="text-sm font-black font-headline text-primary leading-none tracking-tight">Elitera AI</h2>
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mt-1.5">Intelligence v3.0</p>
                             </div>
                        </div>
                        <Button variant="ghost" size="icon" className="group-data-[collapsible=icon]:hidden hover:bg-primary/5 rounded-xl h-9 w-9 text-primary">
                            <MessageSquarePlus className="w-4 h-4" />
                        </Button>
                    </div>
                </SidebarHeader>
                <SidebarContent className="p-3">
                    <SidebarMenu className="gap-2">
                        <SidebarMenuItem>
                            <SidebarMenuButton className="h-12 rounded-2xl bg-primary/5 text-primary border border-primary/10 shadow-sm transition-all hover:bg-primary/10">
                                <History className="h-4 w-4 mr-2" />
                                <span className="font-black text-[10px] uppercase tracking-widest">Riwayat Obrolan</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        
                        <div className="px-3 py-6 group-data-[collapsible=icon]:hidden space-y-8">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/40 mb-6 px-1">Spesialisasi</p>
                                <div className="space-y-6">
                                    <div className="flex gap-4 group cursor-default">
                                        <div className="h-11 w-11 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
                                            <Zap className="h-5 w-5 text-orange-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-foreground/80 tracking-tight">Ide Plot Cepat</p>
                                            <p className="text-[10px] text-muted-foreground leading-relaxed mt-1 font-medium">Susun kerangka cerita kawan secara instan.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 group cursor-default">
                                        <div className="h-11 w-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110">
                                            <PenTool className="h-5 w-5 text-blue-500" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-foreground/80 tracking-tight">Kritik Sastra</p>
                                            <p className="text-[10px] text-muted-foreground leading-relaxed mt-1 font-medium">Analisis mendalam bait demi bait karya kawan.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </SidebarMenu>
                </SidebarContent>
                 <SidebarFooter className="mt-auto border-t border-border/40 p-6 bg-muted/20">
                    <div className="flex items-start gap-3 p-4 rounded-[1.5rem] bg-background/50 border border-border/50 group-data-[collapsible=icon]:hidden shadow-inner ring-1 ring-white/10">
                        <Info className="h-4 w-4 text-primary/40 shrink-0 mt-0.5" />
                        <p className="text-[10px] leading-relaxed text-muted-foreground font-semibold italic">
                            Kecerdasan Elitera dapat melakukan kesalahan. Harap verifikasi setiap inspirasi kawan.
                        </p>
                    </div>
                </SidebarFooter>
            </Sidebar>
            <SidebarInset className="p-0 m-0 bg-background overflow-hidden h-full flex flex-col min-h-0">
                 <div className="flex items-center justify-between px-6 h-16 md:h-20 border-b border-border/40 bg-background/95 backdrop-blur-md z-30 shrink-0 shadow-sm">
                    <div className="flex items-center gap-4">
                        <SidebarTrigger className="md:hidden text-primary"/>
                        <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse" />
                            <div className="flex flex-col">
                                <h3 className="font-black text-xs md:text-sm tracking-[0.1em] uppercase">Ruang Inspirasi Elitera</h3>
                                <p className="text-[8px] font-black text-primary/60 uppercase tracking-widest hidden md:block">Real-time Neural Sync</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 shadow-sm">
                        <Star className="h-3 w-3 fill-current" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Elite Access</span>
                    </div>
                </div>
                <div className="flex-1 overflow-hidden relative min-h-0 flex flex-col bg-muted/5">
                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-accent/5 pointer-events-none" />
                    <ChatClient history={initialHistory} />
                </div>
            </SidebarInset>
        </SidebarProvider>
    </div>
  );
}
