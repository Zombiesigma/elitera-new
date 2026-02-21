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
  Video,
  Maximize2
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
      id: "screenplay",
      icon: Clapperboard,
      title: "Penulisan Naskah Film",
      description: "Alat profesional untuk penulis skenario masa depan.",
      color: "text-orange-500",
      bg: "bg-orange-500/5",
      content: [
        {
          q: "Apa itu Industrial Screenplay Editor?",
          a: "Ini adalah editor khusus yang mematuhi standar industri film. Gunakan Toolbar di bagian atas untuk memasukkan elemen seperti SLUGLINE, ACTION, CHARACTER, dan DIALOGUE secara otomatis dengan format yang presisi."
        },
        {
          q: "Shortcut Cerdas: Tombol Tab",
          a: "Saat menulis naskah, tekan tombol **Tab** pada keyboard Anda untuk berpindah secara otomatis ke posisi penulisan Nama Karakter. Ini dirancang untuk mempercepat alur kreatif Anda."
        },
        {
          q: "Zen Mode: Fokus Tanpa Gangguan",
          a: "Klik ikon 'Maximize' di pojok kanan atas editor untuk mengaktifkan Zen Mode. Seluruh elemen antarmuka akan disembunyikan, menyisakan hanya Anda dan naskah Anda."
        },
        {
          q: "Estimasi Durasi Film",
          a: "Sistem kami secara otomatis menghitung jumlah kata dan memberikan estimasi durasi layar berdasarkan standar 1 halaman naskah ≈ 1 menit tayangan."
        }
      ]
    },
    {
      id: "reels",
      icon: Video,
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
          a: "Kolom komentar Reels mendukung balasan bertingkat (nested replies). Anda bisa membalas komentar pengguna lain untuk membangun diskusi literasi yang lebih hidup." 
        },
        { 
          q: "Navigasi Snap Scrolling", 
          a: "Halaman Reels menggunakan sistem 'Snap Scrolling'. Cukup geser ke atas atau bawah, dan layar akan otomatis mengunci pada video berikutnya untuk memastikan fokus penuh pada setiap mahakarya video." 
        }
      ]
    },
    {
      id: "ai",
      icon: Bot,
      title: "Elitera AI Intelligence v2.0",
      description: "Rekan kreatif puitis bertenaga Google Genkit.",
      color: "text-primary",
      bg: "bg-primary/5",
      content: [
        { 
          q: "Fitur AI Screenplay Assistant", 
          a: "AI kami kini memiliki spesialisasi naskah film. Ia dapat: 1. **Summarize Scene** (merangkum adegan), 2. **Naturalize Dialogue** (mengevaluasi kealamian dialog), dan 3. **Suggest Plot** (memberikan ide konflik berikutnya)." 
        },
        { 
          q: "Obrolan Pintar & Riwayat", 
          a: "Di Ruang Inspirasi AI, Anda bisa berdiskusi tentang apa saja—dari writer's block hingga riset genre. Riwayat percakapan Anda tersinkronisasi secara otomatis di seluruh perangkat." 
        },
        { 
          q: "Privasi & Etika Penggunaan AI", 
          a: "Gunakan AI sebagai mitra diskusi, bukan pengganti suara asli Anda. Elitera menghargai keaslian ide. AI membantu Anda memperluas imajinasi, sementara jiwa tulisan tetap berasal dari hati Anda sendiri." 
        }
      ]
    },
    {
      id: "author",
      icon: PenTool,
      title: "Karir Sebagai Penulis",
      description: "Dari draf pertama hingga menjadi pujangga ternama.",
      color: "text-emerald-500",
      bg: "bg-emerald-500/5",
      content: [
        { 
          q: "Manajemen Draf & Auto-save", 
          a: "Setiap bab yang Anda tulis akan disimpan secara otomatis setiap 15 detik ke Cloud. Anda tidak perlu khawatir kehilangan progres tulisan meskipun koneksi internet terputus." 
        },
        { 
          q: "Export ke PDF Profesional", 
          a: "Setelah karya Anda disetujui untuk terbit, sistem Elitera akan menghasilkan file PDF dengan format premium (tipografi serif, penomoran halaman, dan sampul berbingkai) yang siap dibagikan ke khalayak luas." 
        },
        { 
          q: "Status Tamat & Penguncian", 
          a: "Anda dapat menandai karya Anda sebagai 'Tamat'. Setelah ditandai tamat, naskah akan mendapatkan lencana visual khusus dan dikunci untuk menjaga integritas mahakarya yang telah selesai." 
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
                Panduan lengkap untuk menavigasi ekosistem literasi digital modern—dari teks puitis, naskah film industri, hingga Reels yang imersif.
            </p>
        </div>
      </motion.section>

      {/* Quick Access Icons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 px-4">
        {[
            { icon: Clapperboard, label: "Naskah Pro", color: "text-orange-500", bg: "bg-orange-500/5" },
            { icon: Bot, label: "Asisten AI", color: "text-primary", bg: "bg-primary/5" },
            { icon: Maximize2, label: "Zen Mode", color: "text-indigo-500", bg: "bg-indigo-500/5" },
            { icon: ShieldCheck, label: "Eksport PDF", color: "text-emerald-500", bg: "bg-emerald-500/5" }
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
