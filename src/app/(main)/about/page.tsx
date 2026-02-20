'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { Sparkles, BookOpen, Users, Heart, ArrowRight, Bot, Zap, ShieldCheck, Cpu, Globe, PenTool } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const devPortfolio = "https://www.gunturpadilah.web.id/";
const devImage = "https://www.gunturpadilah.web.id/pp.jpg";
const devName = "Guntur Padilah";
const devBio = "Seorang antusias literasi dan pengembang full-stack yang berdedikasi menciptakan ruang digital di mana kata-kata bertemu dengan kecerdasan masa depan.";

const technologies = [
    { title: "Next.js 15", desc: "Framework web mutakhir untuk performa ultra-cepat dan optimasi SEO kelas dunia.", icon: "https://svgl.app/library/nextjs_icon_dark.svg" },
    { title: "Firebase", desc: "Infrastruktur Cloud Google yang menjamin keamanan data dan sinkronisasi real-time.", icon: "https://svgl.app/library/firebase.svg" },
    { title: "Google Genkit", desc: "Mesin AI canggih (Gemini 2.5) yang menjadi otak di balik Elitera AI Intelligence.", icon: "https://avatars.githubusercontent.com/u/161543431?s=200&v=4" },
    { title: "Tailwind CSS", desc: "Sistem desain modern untuk antarmuka yang presisi, elegan, dan sepenuhnya responsif.", icon: "https://svgl.app/library/tailwindcss.svg" }
];

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-20 md:space-y-32 pb-32 relative overflow-x-hidden w-full px-1">
      <div className="absolute top-0 right-[-10%] w-64 md:w-96 h-64 md:h-96 bg-primary/10 rounded-full blur-[80px] md:blur-[120px] -z-10 pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/2 left-[-10%] w-64 md:w-96 h-64 md:h-96 bg-accent/5 rounded-full blur-[80px] md:blur-[120px] -z-10 pointer-events-none" />
      
      <motion.section 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-center space-y-8 py-12 md:py-20"
      >
        <div className="flex justify-center mb-8">
            <div className="relative p-4 md:p-6 rounded-[2.5rem] bg-white dark:bg-zinc-900 shadow-2xl shadow-primary/10 group overflow-hidden border border-border/50 ring-1 ring-primary/5">
                <Logo className="w-16 h-16 md:w-24 md:h-20 transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
        </div>
        <div className="space-y-6 max-w-4xl mx-auto px-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] border border-primary/20">
                <Cpu className="h-3.5 w-3.5 animate-pulse" /> Evolusi Literasi Digital
            </div>
            <h1 className="text-4xl md:text-7xl font-headline font-black text-foreground leading-[1.1] tracking-tight">
                Menghidupkan Jiwa <br/> Lewat <span className="text-primary italic underline decoration-primary/10">Teknologi.</span>
            </h1>
            <p className="text-sm md:text-xl text-muted-foreground leading-relaxed font-medium italic px-2 max-w-2xl mx-auto">
                "Elitera bukan sekadar platform, ia adalah rumah bagi imajinasi yang tidak mengenal batas antara pena manusia dan kecerdasan buatan."
            </p>
        </div>
      </motion.section>

      <section className="space-y-12">
        <div className="flex items-center gap-4 px-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60 flex items-center gap-3 whitespace-nowrap">
                <Globe className="h-4 w-4 text-primary" /> Fondasi Ekosistem
            </h2>
            <div className="h-px bg-border/50 flex-1" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-4">
            {[
                { icon: Bot, title: "Kecerdasan AI", desc: "Elitera AI membantu penulis menyusun plot, meriset diksi, dan memberikan kritik sastra secara instan melalui model bahasa tercanggih.", color: "text-primary" },
                { icon: Users, title: "Komunitas Sosial", desc: "Ruang interaksi real-time, Reels, dan Story yang dirancang untuk mempererat jalinan emosional antar penikmat sastra.", color: "text-emerald-500" },
                { icon: Zap, title: "Inspirasi Tanpa Batas", desc: "Kami membangun antarmuka yang bebas gangguan (distraction-free) agar kreativitas Anda dapat mengalir dengan murni.", color: "text-orange-500" }
            ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                    <Card className="border-none shadow-xl bg-card/50 backdrop-blur-md rounded-[2.5rem] p-8 h-full flex flex-col items-center text-center group hover:-translate-y-2 transition-all duration-500 border border-white/10 relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                        <div className={cn("p-5 rounded-2xl bg-muted/50 mb-8 transition-all group-hover:bg-primary group-hover:text-white shadow-inner relative z-10", item.color)}>
                            <item.icon className="h-8 w-8 md:h-10 md:w-10" />
                        </div>
                        <h3 className="text-xl font-black mb-3 uppercase tracking-tight">{item.title}</h3>
                        <p className="text-muted-foreground leading-relaxed text-xs md:text-sm font-medium">{item.desc}</p>
                    </Card>
                </motion.div>
            ))}
        </div>
      </section>

      <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="space-y-12 px-4">
        <div className="flex items-center gap-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/60 flex items-center gap-3 whitespace-nowrap">
                <PenTool className="h-4 w-4 text-primary" /> Sang Arsitek
            </h2>
            <div className="h-px bg-border/50 flex-1" />
        </div>

        <Card className="overflow-hidden border-none shadow-[0_30px_100px_-15px_rgba(0,0,0,0.4)] rounded-[3rem] bg-zinc-950 text-white group relative border border-white/5">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />
            <div className="flex flex-col lg:flex-row relative z-10">
                <div className="lg:w-2/5 relative h-[400px] lg:h-auto overflow-hidden">
                    <Image 
                        src={devImage} 
                        alt={devName} 
                        fill 
                        className="object-cover transition-transform duration-1000 group-hover:scale-105" 
                        sizes="(max-width: 768px) 100vw, 40vw" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent lg:hidden" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-zinc-950 hidden lg:block" />
                </div>
                <div className="lg:w-3/5 p-8 md:p-16 lg:p-24 space-y-8 flex flex-col justify-center">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
                            <div className="text-[9px] md:text-[11px] font-black uppercase tracking-[0.4em] text-primary">Full-stack Developer</div>
                        </div>
                        <h3 className="text-4xl md:text-6xl font-headline font-black tracking-tight">{devName}</h3>
                        <p className="text-base md:text-xl text-zinc-400 font-medium italic leading-relaxed border-l-2 border-primary/30 pl-6 py-2">
                            "{devBio}"
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-4 pt-4">
                        <Button asChild className="rounded-2xl px-10 h-14 font-black bg-white text-zinc-950 hover:bg-zinc-200 text-xs md:text-sm uppercase tracking-widest shadow-xl shadow-white/5 transition-all hover:scale-105 active:scale-95">
                            <a href={devPortfolio} target="_blank" rel="noopener noreferrer">Portofolio</a>
                        </Button>
                        <Button asChild variant="outline" className="rounded-2xl px-10 h-14 font-black border-zinc-700 hover:bg-white/5 text-xs md:text-sm uppercase tracking-widest text-white transition-all hover:border-white/20">
                            <a href="https://github.com/Zombiesigma" target="_blank" rel="noopener noreferrer">GitHub</a>
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
      </motion.section>

      <section className="space-y-16 px-4">
        <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-5xl font-headline font-black tracking-tight">Kekuatan di Balik <span className="text-primary italic underline decoration-primary/10">Sistem.</span></h2>
            <p className="text-muted-foreground text-sm md:text-lg max-w-2xl mx-auto font-medium leading-relaxed opacity-80">
                Elitera dibangun dengan tumpukan teknologi modern untuk memastikan setiap detik pengalaman sastra Anda terasa magis, cepat, dan aman.
            </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {technologies.map((tech, i) => (
                <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                    <Card className="border-none shadow-lg bg-card/50 backdrop-blur-sm rounded-[2rem] p-8 hover:shadow-2xl transition-all duration-500 text-center border border-white/5 group relative overflow-hidden h-full">
                        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
                        <div className="h-12 w-12 md:h-16 md:w-16 relative mb-8 mx-auto transition-all duration-700 group-hover:scale-110 drop-shadow-lg">
                            <Image src={tech.icon} alt={tech.title} fill className="object-contain" />
                        </div>
                        <h4 className="font-black text-xs md:text-sm mb-3 uppercase tracking-[0.1em] text-foreground">{tech.title}</h4>
                        <p className="text-[10px] md:text-xs text-muted-foreground leading-relaxed font-medium">{tech.desc}</p>
                    </Card>
                </motion.div>
            ))}
        </div>
      </section>

      <section className="px-4">
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            whileInView={{ opacity: 1, scale: 1 }} 
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
        >
            <Card className="bg-zinc-900 border-none rounded-[3rem] md:rounded-[4rem] p-10 md:p-24 text-center space-y-10 shadow-2xl relative overflow-hidden text-white">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
                
                <div className="relative z-10 space-y-8">
                    <div className="p-5 bg-primary/10 border border-primary/20 rounded-[2.5rem] w-fit mx-auto mb-8 shadow-inner ring-1 ring-primary/20">
                        <Bot className="h-12 w-12 md:h-16 md:w-16 text-primary animate-bounce" />
                    </div>
                    <h3 className="font-headline text-3xl md:text-6xl font-black leading-tight tracking-tight">
                        Mulai Dialogmu dengan <br/> <span className="text-primary italic underline decoration-primary/20">Elitera AI.</span>
                    </h3>
                    <p className="text-zinc-400 max-w-2xl mx-auto text-base md:text-xl font-medium leading-relaxed italic opacity-80">
                        "Bukan sekadar mesin, ia adalah rekan diskusi puitis yang memahami nuansa sastra Indonesia. Gunakan ia untuk mempertajam setiap kata yang Anda tulis."
                    </p>
                    <div className="pt-8">
                        <Button asChild size="lg" className="rounded-full px-12 h-16 font-black text-sm md:text-base uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 bg-primary hover:bg-primary/90">
                            <Link href="/ai">Coba Kecerdasan AI <ArrowRight className="ml-3 h-5 w-5" /></Link>
                        </Button>
                    </div>
                </div>
            </Card>
        </motion.div>
      </section>

      <div className="text-center space-y-6 opacity-40 select-none grayscale pb-16">
          <div className="flex items-center justify-center gap-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.5em]">Elitera Digital Literacy Ecosystem</span>
          </div>
          <p className="text-[9px] font-bold max-w-md mx-auto leading-relaxed">
            Dirancang dan dibangun dengan penuh rasa hormat terhadap keajaiban kata-kata manusia dan potensi teknologi masa depan yang tak terbatas.
          </p>
      </div>
    </div>
  );
}
