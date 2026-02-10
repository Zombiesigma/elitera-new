'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Logo } from '@/components/Logo';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { signUpWithEmail, signInWithGoogle } from '@/firebase/auth/service';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Upload, User as UserIcon, Mail, Lock, Sparkles, Chrome, PenTool, Eye, EyeOff, ChevronLeft } from 'lucide-react';
import { useAuthRedirect } from '@/hooks/use-auth-redirect';
import { uploadFile } from '@/lib/uploader';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';

const formSchema = z.object({
  fullName: z.string().min(3, { message: 'Nama lengkap minimal 3 karakter.' }),
  email: z.string().email({ message: 'Email tidak valid.' }),
  password: z.string().min(6, { message: 'Kata sandi minimal 6 karakter.' }),
});

export default function RegisterPage() {
  useAuthRedirect();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File Terlalu Besar',
          description: 'Maksimal ukuran foto adalah 2MB.',
        });
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    let photoURL = '';

    try {
      if (selectedFile) {
        photoURL = await uploadFile(selectedFile);
      }

      const { error } = await signUpWithEmail(values.email, values.password, values.fullName, photoURL);
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Gagal Mendaftar',
          description: (error as Error).message || 'Email ini mungkin sudah digunakan.',
        });
      } else {
        toast({
          variant: 'success',
          title: 'Pendaftaran Berhasil',
          description: 'Silakan verifikasi email Anda untuk memulai.',
        });
        router.push('/verify-email');
      }
    } catch (uploadError) {
      toast({
        variant: 'destructive',
        title: 'Gagal Mengunggah Foto',
        description: 'Terjadi kesalahan saat memproses foto profil Anda.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal Mendaftar',
        description: (error as Error).message || 'Terjadi kesalahan saat masuk dengan Google.',
      });
       setIsLoading(false);
    } else {
      toast({
        variant: 'success',
        title: 'Selamat Datang',
        description: 'Anda telah berhasil bergabung dengan Elitera!',
      });
      router.push('/');
    }
  }

  return (
    <div className="w-full max-w-[400px] flex flex-col items-center justify-center min-h-[100dvh] py-12 relative">
      {/* Background Decorative Blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Back Button for Mobile Convenience */}
      <div className="absolute top-6 left-0 px-4 md:px-0">
        <Button variant="ghost" size="sm" asChild className="rounded-full text-muted-foreground hover:text-primary">
          <Link href="/login"><ChevronLeft className="mr-1 h-4 w-4" /> Masuk</Link>
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full px-4"
      >
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="p-4 rounded-[2rem] bg-background shadow-2xl shadow-primary/10 ring-1 ring-border/50">
            <Logo className="h-10 w-10 sm:h-12 sm:w-12" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-headline font-black tracking-tight">Buat <span className="text-primary italic">Karya.</span></h1>
            <p className="text-muted-foreground font-medium text-xs sm:text-sm">Bergabunglah dalam barisan pujangga modern.</p>
          </div>
        </div>

        <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-xl rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden">
          <CardHeader className="sr-only">
            <CardTitle>Buat Akun Elitera</CardTitle>
            <CardDescription>Lengkapi informasi diri Anda</CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 pt-8 sm:pt-10">
            <div className="flex flex-col items-center mb-8">
              <div 
                className="relative group cursor-pointer active:scale-95 transition-transform"
                onClick={() => document.getElementById('avatar-upload')?.click()}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-primary via-accent to-primary rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                <Avatar className="h-20 w-24 sm:h-24 sm:w-24 border-4 border-background shadow-2xl relative z-10">
                  <AvatarImage src={previewUrl || ''} className="object-cover" />
                  <AvatarFallback className="bg-primary/5 text-primary">
                    <UserIcon className="h-8 w-8 sm:h-10 sm:w-10 opacity-40" />
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-primary text-white p-2 rounded-full shadow-lg z-20 ring-4 ring-background group-hover:scale-110 transition-transform">
                  <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-4">Foto Profil (Opsional)</p>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold ml-1 text-[10px] uppercase tracking-widest opacity-70">Nama Lengkap</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <PenTool className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input placeholder="Guntur Padilah" {...field} className="h-12 pl-11 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 font-medium text-sm" />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold ml-1 text-[10px] uppercase tracking-widest opacity-70">Email Resmi</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input placeholder="anda@email.com" {...field} className="h-12 pl-11 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 font-medium text-sm" />
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold ml-1 text-[10px] uppercase tracking-widest opacity-70">Kata Sandi</FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input 
                            type={showPassword ? 'text' : 'password'} 
                            placeholder="Min. 6 Karakter" 
                            {...field} 
                            className="h-12 pl-11 pr-11 rounded-xl bg-muted/30 border-none focus-visible:ring-primary/20 font-medium text-sm" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95 group mt-2" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memproses...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4 transition-transform group-hover:rotate-12" /> Buat Akun Gratis</>
                  )}
                </Button>
              </form>
            </Form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
                <span className="bg-background px-4 text-muted-foreground/60">Atau Gabung Dengan</span>
              </div>
            </div>

            <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-2 hover:bg-primary/5 hover:border-primary/20 transition-all active:scale-95 text-xs" onClick={handleGoogleSignIn} disabled={isLoading}>
              <Chrome className="mr-2 h-4 w-4 text-primary" /> Daftar dengan Google
            </Button>

            <div className="mt-8 text-center">
              <p className="text-xs text-muted-foreground font-medium">
                Sudah menjadi pujangga?{' '}
                <Link href="/login" className="text-primary font-black hover:underline underline-offset-4">
                  Masuk Saja
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
