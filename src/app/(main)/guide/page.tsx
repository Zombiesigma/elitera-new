'use client';

import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  PenTool, 
  Users, 
  Sparkles, 
  Bot, 
  ShieldCheck, 
  HelpCircle,
  MessageCircle,
  Clapperboard,
  Heart,
  Share2,
  Zap,
  Bell,
  Video
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function GuidePage() {
  const sections = [
    {
      id: "reader",
      icon: BookOpen,
      title: "Panduan Untuk Pembaca",
      description: "Jelajahi ribuan imajinasi dengan kenyamanan maksimal.",
      color: "text-blue-500",
      bg: "bg-blue-500/5",
      content: [
        { 
          q: "Bagaimana cara menemukan karya yang tepat?", 
          a: "Gunakan fitur 'Eksplorasi' di Beranda untuk melihat tren mingguan, atau gunakan bilah pencarian cerdas di bagian atas. Anda bisa mencari berdasarkan judul, genre (seperti Fantasi, Novel, atau Pengembangan Diri), atau langsung mencari nama pujangga favorit Anda." 
        },
        { 
          q: "Personalisasi pengalaman membaca", 
          a: "Saat berada di dalam halaman baca, klik ikon 'Settings' di header. Anda dapat menyesuaikan ukuran huruf (14px - 32px) agar nyaman di mata dan beralih antara Mode Terang atau Mode Gelap untuk pengalaman membaca yang lebih imersif." 
        },
        { 
          q: "Sistem Favorit & Koleksi", 
          a: "Menekan ikon 'Hati' pada detail buku akan menyimpan karya tersebut ke dalam tab 'Favorit' di profil Anda. Ini memudahkan Anda untuk melanjutkan bacaan kapan saja tanpa harus mencari ulang dari awal." 
        },
        { 
          q: "Berinteraksi dengan Markdown", 
          a: "Elitera mendukung format Markdown di komentar. Gunakan **teks tebal** untuk penekanan, > untuk kutipan, atau `kode` untuk referensi teknis. Pastikan ulasan Anda membangun dan menghargai jerih payah sang pujangga." 
        }
      ]
    },
    {
      id: "reels",
      icon: Clapperboard,
      title: "Ekosistem Elitera Reels",
      description: "Momen puitis dalam format video pendek yang dinamis.",
      color: "text-rose-500",
      bg: "bg-rose-500/5",
      content: [
        { 
          q: "Interaksi Cepat: Double-Tap to Like", 
          a: "Saat menonton Reels, Anda dapat memberikan 'Like' secara instan dengan mengetuk layar video dua kali secara cepat. Animasi jantung akan muncul sebagai tanda apresiasi Anda telah terkirim." 
        },
        { 
          q: "Diskusi & Balasan Bertingkat", 
          a: "Kolom komentar Reels mendukung balasan bertingkat (nested replies). Anda bisa membalas komentar pengguna lain untuk membangun diskusi literasi yang lebih hidup. Setiap balasan akan memberikan notifikasi kepada pemilik komentar asli." 
        },
        { 
          q: "Berbagi ke Luar Platform (Rich Cards)", 
          a: "Gunakan tombol bagikan untuk mengirimkan video ke WhatsApp, Instagram, atau Twitter. Tautan yang Anda bagikan akan otomatis menampilkan 'Rich Card' premium berisi nama penulis dan caption video, sehingga terlihat menarik bagi teman Anda." 
        },
        { 
          q: "Navigasi Snap Scrolling", 
          a: "Halaman Reels menggunakan sistem 'Snap Scrolling'. Cukup geser ke atas atau bawah, dan layar akan otomatis mengunci pada video berikutnya untuk memastikan fokus penuh pada setiap mahakarya video." 
        }
      ]
    },
    {
      id: "author",
      icon: PenTool,
      title: "Karir Sebagai Penulis",
      description: "Dari draf pertama hingga menjadi pujangga ternama.",
      color: "text-orange-500",
      bg: "bg-orange-500/5",
      content: [
        { 
          q: "Langkah menjadi Penulis Terverifikasi", 
          a: "Lengkapi formulir di halaman 'Daftar Penulis' dengan menyertakan motivasi dan tautan portofolio karya Anda. Tim kurasi kami akan meninjau kualitas narasi Anda dalam 1-3 hari kerja sebelum memberikan lencana penulis resmi." 
        },
        { 
          q: "Manajemen Draf & Auto-save", 
          a: "Setiap bab yang Anda tulis akan disimpan secara otomatis setiap 15 detik ke Cloud. Anda tidak perlu khawatir kehilangan progres tulisan meskipun koneksi internet terputus secara tiba-tiba." 
        },
        { 
          q: "Visibilitas: Publik vs Hanya Pengikut", 
          a: "Anda dapat mengatur karya Anda sebagai 'Hanya Pengikut'. Jika dipilih, hanya pembaca yang mengikuti Anda yang dapat mengakses bab tersebut. Ini adalah cara terbaik untuk memberikan konten eksklusif kepada pendukung setia Anda." 
        },
        { 
          q: "Notifikasi Otomatis untuk Pengikut", 
          a: "Saat buku dengan status 'Hanya Pengikut' diterbitkan, sistem Elitera akan secara otomatis mengirimkan notifikasi khusus ke seluruh pengikut Anda. Mereka akan mendapatkan akses prioritas melalui tautan langsung di pusat notifikasi." 
        }
      ]
    },
    {
      id: "social",
      icon: Users,
      title: "Interaksi Sosial & Momen",
      description: "Membangun jalinan antar penikmat sastra.",
      color: "text-emerald-500",
      bg: "bg-emerald-500/5",
      content: [
        { 
          q: "Fitur Story (Momen 24 Jam)", 
          a: "Story adalah tempat untuk membagikan pemikiran singkat, progres menulis, atau foto suasana meja kerja Anda. Momen ini hanya bertahan selama 24 jam. Penulis aktif akan memiliki lingkaran cahaya puitis pada avatar profil mereka." 
        },
        { 
          q: "Pesan Langsung & Berbagi Karya", 
          a: "Anda dapat membagikan 'Kartu Buku' atau 'Kartu Reels' langsung ke dalam obrolan pribadi. Ini memudahkan Anda untuk merekomendasikan bacaan kepada rekan obrolan tanpa harus keluar dari jendela pesan." 
        },
        { 
          q: "Status Online & Last Seen", 
          a: "Anda dapat melihat apakah seorang pujangga sedang aktif atau kapan terakhir kali mereka melihat naskah melalui indikator titik hijau di foto profil mereka." 
        }
      ]
    },
    {
      id: "ai",
      icon: Bot,
      title: "Elitera AI Intelligence v1.5",
      description: "Rekan kreatif puitis di ujung jari Anda.",
      color: "text-primary",
      bg: "bg-primary/5",
      content: [
        { 
          q: "Apa yang bisa dilakukan Elitera AI?", 
          a: "AI kami dirancang untuk memahami konteks sastra Indonesia. Ia dapat membantu menyusun kerangka plot (outline), memberikan saran sinonim puitis, hingga merangkum bab yang panjang menjadi sinopsis yang memikat." 
        },
        { 
          q: "Privasi & Etika Penggunaan AI", 
          a: "Gunakan AI sebagai mitra diskusi, bukan pengganti suara asli Anda. Elitera menghargai keaslian ide. AI membantu Anda memperluas imajinasi, sementara emosi dan jiwa tulisan tetap berasal dari hati Anda sendiri." 
        }
      ]
    }
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-12 md:space-y-16 pb-32 overflow-x-hidden">
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-6 pt-6 px-4"
      >
        <div className="mx-auto relative mb-6">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse pointer-events-none" />
            <div className="relative bg-white dark:bg-zinc-900 p-5 md:p-6 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl text-primary w-fit mx-auto ring-1 ring-primary/10">
                <HelpCircle className="h-10 w-10 md:h-12 md:w-12" />
            </div>
        </div>
        <div className="space-y-3">
            <h1 className="text-3xl md:text-6xl font-headline font-black tracking-tight leading-tight">
                Pusat <span className="text-primary italic underline decoration-primary/20">Bantuan</span> Elitera
            </h1>
            <p className="text-muted-foreground font-medium max-w-2xl mx-auto text-sm md:text-lg leading-relaxed px-2">
                Panduan lengkap untuk menavigasi ekosistem literasi digital modern—dari teks puitis hingga Reels yang imersif.
            </p>
        </div>
      </motion.section>

      {/* Quick Access Icons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 px-4">
        {[
            { icon: Video, label: "Reels Pro", color: "text-rose-500", bg: "bg-rose-500/5" },
            { icon: Bell, label: "Notif Cerdas", color: "text-blue-500", bg: "bg-blue-500/5" },
            { icon: Sparkles, label: "Momen Aktif", color: "text-emerald-500", bg: "bg-emerald-500/5" },
            { icon: ShieldCheck, label: "Moderasi", color: "text-orange-500", bg: "bg-orange-500/5" }
        ].map((item, i) => (
            <Card key={i} className="border-none shadow-xl bg-card/50 backdrop-blur-sm rounded-[1.5rem] md:rounded-3xl p-4 md:p-6 flex flex-col items-center gap-3 group hover:scale-[1.02] transition-all">
                <div className={cn("p-3 rounded-xl md:rounded-2xl", item.bg, item.color)}>
                    <item.icon className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest opacity-60 text-center">{item.label}</p>
            </Card>
        ))}
      </div>

      {/* Main Accordion Guide */}
      <section className="space-y-8 md:space-y-10">
        <div className="flex items-center gap-4 px-6">
            <h2 className="text-lg md:text-2xl font-headline font-black tracking-tight whitespace-nowrap">Kategori <span className="text-primary">Eksplorasi</span></h2>
            <div className="h-px bg-border flex-1" />
        </div>

        <div className="grid gap-6 px-4">
            {sections.map((section, idx) => (
            <motion.div 
                key={section.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
            >
                <Card className="border-none shadow-2xl overflow-hidden rounded-[2rem] md:rounded-[2.5rem] bg-card/50 backdrop-blur-md border border-white/10">
                    <CardHeader className="p-5 md:p-8 bg-muted/20 border-b">
                        <div className="flex items-center gap-4 md:gap-5">
                            <div className={cn("p-3.5 md:p-4 rounded-[1.25rem] md:rounded-[1.5rem] shadow-xl shrink-0", section.bg, section.color)}>
                                <section.icon className="h-6 w-6 md:h-7 md:w-7" />
                            </div>
                            <div>
                                <CardTitle className="font-headline text-lg md:text-2xl font-black">{section.title}</CardTitle>
                                <CardDescription className="font-medium text-[11px] md:text-sm mt-0.5 md:mt-1">{section.description}</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 md:p-10">
                        <Accordion type="single" collapsible className="w-full">
                            {section.content.map((item, i) => (
                                <AccordionItem key={i} value={`item-${i}`} className="border-b-border/30 last:border-0">
                                    <AccordionTrigger className="text-left font-black text-sm md:text-lg hover:no-underline group py-4 px-2">
                                        <span className="group-hover:text-primary transition-colors flex items-center gap-2.5">
                                            <div className="h-1 w-1 md:h-1.5 md:w-1.5 rounded-full bg-primary/30 group-hover:bg-primary transition-colors shrink-0" />
                                            {item.q}
                                        </span>
                                    </AccordionTrigger>
                                    <AccordionContent className="text-muted-foreground leading-relaxed text-[13px] md:text-base font-medium pt-2 pb-6 pl-5 md:pl-6 border-l-2 border-primary/10 ml-2 italic">
                                        {item.a}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
            </motion.div>
            ))}
        </div>
      </section>

      {/* Advanced Features Spotlight */}
      <section className="space-y-8 md:space-y-10">
        <div className="flex items-center gap-4 px-6">
            <h2 className="text-lg md:text-2xl font-headline font-black tracking-tight whitespace-nowrap">Fitur <span className="text-primary">Lanjutan</span></h2>
            <div className="h-px bg-border flex-1" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 px-4">
            <Card className="bg-indigo-950 text-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 border-none shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 md:p-10 opacity-5 group-hover:scale-110 transition-transform pointer-events-none"><Share2 className="h-32 w-32 md:h-40 md:w-40" /></div>
                <h4 className="text-lg md:text-xl font-headline font-black mb-3 md:mb-4 flex items-center gap-3">
                    <Share2 className="h-5 w-5 md:h-6 md:w-6 text-indigo-400" /> Smart Share Link
                </h4>
                <p className="text-indigo-200/70 text-[13px] md:text-sm leading-relaxed mb-6 font-medium">
                    Tautan yang dibagikan secara eksternal telah dioptimalkan dengan Metadata OpenGraph. Hal ini memungkinkan platform media sosial populer untuk menampilkan karya Anda dengan pratinjau kartu yang elegan dan profesional.
                </p>
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-indigo-400">Teknologi SEO Aktif</span>
                </div>
            </Card>

            <Card className="bg-zinc-900 text-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 border-none shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 md:p-10 opacity-5 group-hover:scale-110 transition-transform pointer-events-none"><Zap className="h-32 w-32 md:h-40 md:w-40" /></div>
                <h4 className="text-lg md:text-xl font-headline font-black mb-3 md:mb-4 flex items-center gap-3">
                    <Zap className="h-5 w-5 md:h-6 md:w-6 text-yellow-400" /> Real-time Sync
                </h4>
                <p className="text-zinc-400 text-[13px] md:text-sm leading-relaxed mb-6 font-medium">
                    Elitera dibangun di atas infrastruktur real-time. Setiap 'Like', 'Komentar', atau 'Update Bab' akan tersinkronisasi dalam hitungan milidetik ke seluruh pengguna tanpa perlu memuat ulang halaman.
                </p>
                <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-yellow-400">Infrastruktur Elitera v2.0</span>
                </div>
            </Card>
        </div>
      </section>

      {/* Help Footer */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="px-4"
      >
        <Card className="bg-background border-2 border-primary/10 rounded-[2.5rem] md:rounded-[3rem] p-8 md:p-16 text-center space-y-8 md:space-y-10 overflow-hidden relative shadow-2xl">
            <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-primary/5 rounded-full blur-[80px] md:blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 md:w-64 h-48 md:h-64 bg-accent/5 rounded-full blur-[80px] md:blur-[100px] pointer-events-none" />
            
            <div className="relative z-10 space-y-4">
                <div className="bg-primary/10 p-4 rounded-2xl w-fit mx-auto mb-4 md:mb-6">
                    <MessageCircle className="h-7 w-7 md:h-8 md:w-8 text-primary" />
                </div>
                <h3 className="font-headline text-2xl md:text-4xl font-black leading-tight">Masih Punya Pertanyaan?</h3>
                <p className="text-muted-foreground max-w-xl mx-auto text-sm md:text-lg font-medium px-2">Tim moderasi dan asisten AI kami selalu siap sedia membantu perjalanan sastra Anda setiap harinya.</p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center">
                <Button asChild size="lg" variant="outline" className="rounded-full px-8 md:px-10 h-12 md:h-14 font-black text-[11px] md:text-sm uppercase tracking-widest border-2 hover:bg-primary/5 w-full sm:w-auto">
                    <Link href="/about"><Users className="mr-2 h-4 w-4 md:h-5 md:w-5" /> Hubungi Tim</Link>
                </Button>
                <Button asChild size="lg" className="rounded-full px-8 md:px-10 h-12 md:h-14 font-black text-[11px] md:text-sm uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all w-full sm:w-auto">
                    <Link href="/ai"><Bot className="mr-2 h-4 w-4 md:h-5 md:w-5" /> Tanya Elitera AI</Link>
                </Button>
            </div>
        </Card>
      </motion.div>
    </div>
  );
}
