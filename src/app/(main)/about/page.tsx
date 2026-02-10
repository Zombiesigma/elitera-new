'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { Sparkles, BookOpen, Users, Heart, ArrowRight, Bot, Zap, ShieldCheck, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const devPortfolio = "https://www.gunturpadilah.web.id/";
const devImage = "https://raw.githubusercontent.com/Zombiesigma/elitera-asset/refs/heads/main/IMG-20251221-WA0058.jpg";
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
    <div className="max-w-5xl mx-auto space-y-16 md:space-y-24 pb-32 relative overflow-x-hidden w-full px-1 md:px-0">
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-48 md:w-96 h-48 md:h-96 bg-primary/10 rounded-full blur-[80px] md:blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-1/2 left-0 w-48 md:w-96 h-48 md:h-96 bg-accent/5 rounded-full blur-[80px] md:blur-[120px] -z-10 pointer-events-none" />
      
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center space-y-6 md:space-y-8 py-8 md:py-12"
      >
        <div className="flex justify-center mb-4 md:mb-6">
            <div className="relative p-3 md:p-4 rounded-[1.75rem] md:rounded-[2rem] bg-white dark:bg-zinc-900 shadow-2xl shadow-primary/10 group overflow-hidden border border-border/50">
                <Logo className="w-14 h-14 md:w-20 md:h-20 transition-transform duration-500 group-hover:scale-110" />
            </div>
        </div>
        <div className="space-y-4 max-w-3xl mx-auto px-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-[8px] md:text-[9px] font-black uppercase tracking-widest border border-primary/20">
                <Cpu className="h-3 w-3 animate-pulse" /> Sinergi Manusia & AI
            </div>
            <h1 className="text-3xl md:text-7xl font-headline font-black text-foreground leading-[1.1] tracking-tight">
                Masa Depan Literasi Ada di <span className="text-primary italic underline decoration-primary/10">Sini.</span>
            </h1>
            <p className="text-sm md:text-xl text-muted-foreground leading-relaxed font-medium italic px-2">
                "Elitera menggabungkan jiwa puitis manusia dengan kecerdasan buatan untuk menciptakan ekosistem cerita yang tak terbatas."
            </p>
        </div>
      </motion.section>

      {/* Philosophy Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 px-4">
        {[
            { icon: Bot, title: "Kecerdasan AI", desc: "Elitera AI membantu penulis menyusun plot, meriset diksi, dan memberikan kritik sastra secara instan.", color: "text-primary" },
            { icon: Users, title: "Komunitas Sosial", desc: "Ruang interaksi real-time, Reels, dan Story yang mempererat jalinan antar penikmat sastra.", color: "text-emerald-500" },
            { icon: Zap, title: "Inspirasi Tanpa Batas", desc: "Teknologi kami dirancang untuk memicu kreativitas Anda setiap hari melalui medium yang imersif.", color: "text-orange-500" }
        ].map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm rounded-[2rem] p-6 md:p-8 h-full flex flex-col items-center text-center group hover:-translate-y-1 transition-all border border-white/10 overflow-hidden relative">
                    <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
                    <div className={cn("p-4 rounded-2xl bg-muted/50 mb-6 transition-all group-hover:bg-primary group-hover:text-white shadow-inner relative z-10", item.color)}>
                        <item.icon className="h-7 w-7 md:h-8 md:w-8" />
                    </div>
                    <h3 className="text-lg font-black mb-2 uppercase tracking-tight">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed text-xs md:text-sm font-medium">{item.desc}</p>
                </Card>
            </motion.div>
        ))}
      </section>

      {/* Developer Section */}
      <motion.section initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="space-y-8 md:space-y-10 px-4">
        <div className="flex items-center gap-4">
            <h2 className="text-lg md:text-3xl font-headline font-black tracking-tight whitespace-nowrap">Development <span className="text-primary">apaan</span></h2>
            <div className="h-px bg-border flex-1" />
        </div>

        <Card className="overflow-hidden border-none shadow-2xl rounded-[2.25rem] md:rounded-[2.5rem] bg-zinc-950 text-white group border border-white/5">
            <div className="flex flex-col md:flex-row">
                <div className="md:w-1/3 relative h-[320px] md:h-auto overflow-hidden">
                    <Image src={devImage} alt={devName} fill className="object-cover transition-transform duration-700 group-hover:scale-105" sizes="(max-width: 768px) 100vw, 33vw" />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent md:hidden" />
                </div>
                <div className="md:w-2/3 p-8 md:p-16 space-y-6 flex flex-col justify-center">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="h-1 w-1 rounded-full bg-primary animate-ping" />
                            <div className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-primary">Full-stack Developer</div>
                        </div>
                        <h3 className="text-3xl md:text-5xl font-headline font-black tracking-tight">{devName}</h3>
                        <p className="text-sm md:text-xl text-zinc-400 font-medium italic leading-relaxed">"{devBio}"</p>
                    </div>
                    <div className="flex flex-wrap gap-3 pt-4">
                        <a href={devPortfolio} target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none">
                            <Button className="w-full rounded-xl px-8 h-12 font-black bg-white text-zinc-900 hover:bg-zinc-200 text-xs uppercase tracking-widest shadow-xl">Portofolio</Button>
                        </a>
                        <a href="https://github.com/Zombiesigma" target="_blank" rel="noopener noreferrer" className="flex-1 sm:flex-none">
                            <Button variant="outline" className="w-full rounded-xl px-8 h-12 font-black border-zinc-700 hover:bg-white/5 text-xs uppercase tracking-widest text-white">GitHub</Button>
                        </a>
                    </div>
                </div>
            </div>
        </Card>
      </motion.section>

      {/* Technology Section */}
      <section className="space-y-10 md:space-y-12 px-4">
        <div className="text-center space-y-3">
            <h2 className="text-2xl md:text-4xl font-headline font-black tracking-tight">Kekuatan di Balik <span className="text-primary italic underline decoration-primary/10">Sistem</span></h2>
            <p className="text-muted-foreground text-xs md:text-base max-w-xl mx-auto font-medium leading-relaxed">
                Elitera dibangun dengan tumpukan teknologi modern untuk memastikan setiap detik pengalaman Anda terasa magis.
            </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {technologies.map((tech, i) => (
                <Card key={i} className="border-none shadow-lg bg-card/50 backdrop-blur-sm rounded-[1.5rem] md:rounded-[2rem] p-6 md:p-8 hover:shadow-2xl transition-all text-center border border-white/5 group relative overflow-hidden">
                    <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
                    <div className="h-10 w-10 md:h-14 md:w-14 relative mb-6 mx-auto transition-all duration-500 group-hover:scale-110">
                        <Image src={tech.icon} alt={tech.title} fill className="object-contain" />
                    </div>
                    <h4 className="font-black text-xs md:text-sm mb-2 uppercase tracking-tight text-foreground">{tech.title}</h4>
                    <p className="text-[10px] md:text-xs text-muted-foreground leading-relaxed font-medium">{tech.desc}</p>
                </Card>
            ))}
        </div>
      </section>

      {/* AI Intelligence Section */}
      <section className="px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}>
            <Card className="bg-zinc-900 border-none rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-16 text-center space-y-8 shadow-2xl relative overflow-hidden text-white">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
                
                <div className="relative z-10 space-y-6">
                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-[2rem] w-fit mx-auto mb-6">
                        <Bot className="h-10 w-10 md:h-14 md:w-14 text-primary animate-bounce" />
                    </div>
                    <h3 className="font-headline text-2xl md:text-5xl font-black leading-tight tracking-tight">
                        Bertemu dengan <br/> <span className="text-primary italic">Elitera AI.</span>
                    </h3>
                    <p className="text-zinc-400 max-w-xl mx-auto text-sm md:text-lg font-medium leading-relaxed italic">
                        "Bukan sekadar robot, ia adalah rekan diskusi puitis yang memahami nuansa sastra Indonesia. Gunakan ia untuk mempertajam setiap kata yang Anda tulis."
                    </p>
                    <div className="pt-6">
                        <Button asChild size="lg" className="rounded-full px-10 h-14 font-black text-xs md:text-sm uppercase tracking-widest shadow-xl shadow-primary/30 transition-all hover:scale-105 active:scale-95">
                            <Link href="/ai">Coba Kecerdasan AI <ArrowRight className="ml-2 h-4 w-4" /></Link>
                        </Button>
                    </div>
                </div>
            </Card>
        </motion.div>
      </section>

      {/* Trust Badge / Footer Tagline */}
      <div className="text-center space-y-4 opacity-40 select-none grayscale pb-10">
          <div className="flex items-center justify-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[9px] font-black uppercase tracking-[0.4em]">Elitera Digital Literacy Ecosystem</span>
          </div>
          <p className="text-[8px] font-bold max-w-xs mx-auto">Dirancang dan dibangun dengan penuh rasa hormat terhadap keajaiban kata-kata dan potensi teknologi masa depan.</p>
      </div>
    </div>
  );
}
