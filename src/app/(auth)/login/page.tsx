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
import { signInWithEmail, signInWithGoogle } from '@/firebase/auth/service';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2, Mail, Lock, Sparkles, Chrome, Eye, EyeOff, ChevronLeft } from 'lucide-react';
import { useAuthRedirect } from '@/hooks/use-auth-redirect';
import { motion } from 'framer-motion';

const formSchema = z.object({
  email: z.string().email({ message: 'Email tidak valid.' }),
  password: z.string().min(1, { message: 'Kata sandi tidak boleh kosong.' }),
});

export default function LoginPage() {
  useAuthRedirect();
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    const { user, error } = await signInWithEmail(values.email, values.password);
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal Masuk',
        description: 'Email atau kata sandi salah. Silakan coba lagi.',
      });
      setIsLoading(false);
    } else if (user) {
      if (!user.emailVerified && user.providerData.some(p => p.providerId === 'password')) {
        router.push('/verify-email');
      } else {
        toast({
          variant: 'success',
          title: 'Selamat Datang Kembali',
          description: 'Mari lanjutkan petualangan sastra Anda.',
        });
        router.push('/');
      }
    }
  }

  async function handleGoogleSignIn() {
    setIsLoading(true);
    const { error } = await signInWithGoogle();
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Gagal Masuk',
        description: (error as Error).message || 'Terjadi kesalahan saat masuk dengan Google.',
      });
      setIsLoading(false);
    } else {
      toast({
        variant: 'success',
        title: 'Berhasil Masuk',
        description: 'Selamat menjelajahi semesta Elitera!',
      });
      router.push('/');
    }
  }

  return (
    <div className="w-full max-w-[400px] flex flex-col items-center justify-center min-h-[100dvh] py-8 relative">
      {/* Background Decorative Blobs */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* Back Button for Mobile Convenience */}
      <div className="absolute top-6 left-0 px-4 md:px-0">
        <Button variant="ghost" size="sm" asChild className="rounded-full text-muted-foreground hover:text-primary">
          <Link href="/"><ChevronLeft className="mr-1 h-4 w-4" /> Beranda</Link>
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full px-4"
      >
        <div className="flex flex-col items-center text-center space-y-4 mb-10">
          <div className="p-4 rounded-[2rem] bg-background shadow-2xl shadow-primary/10 ring-1 ring-border/50">
            <Logo className="h-10 w-10 sm:h-12 sm:w-12" />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-headline font-black tracking-tight">Selamat <span className="text-primary italic">Datang.</span></h1>
            <p className="text-muted-foreground font-medium text-xs sm:text-sm">Masuk untuk melanjutkan jejak imajinasimu.</p>
          </div>
        </div>

        <Card className="border-none shadow-2xl bg-card/50 backdrop-blur-xl rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden">
          <CardHeader className="sr-only">
            <CardTitle>Masuk ke Akun</CardTitle>
            <CardDescription>Masukkan kredensial Anda</CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 pt-8 sm:pt-10">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold ml-1 text-[10px] uppercase tracking-widest opacity-70">Email</FormLabel>
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
                      <div className="flex items-center justify-between ml-1">
                        <FormLabel className="font-bold text-[10px] uppercase tracking-widest opacity-70">Kata Sandi</FormLabel>
                        <Link href="#" className="text-[10px] font-black uppercase text-primary hover:underline">Lupa?</Link>
                      </div>
                      <FormControl>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                          <Input 
                            type={showPassword ? 'text' : 'password'} 
                            placeholder="••••••••" 
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
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengakses...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4 transition-transform group-hover:rotate-12" /> Masuk Sekarang</>
                  )}
                </Button>
              </form>
            </Form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
                <span className="bg-background px-4 text-muted-foreground/60">Atau Gunakan</span>
              </div>
            </div>

            <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-2 hover:bg-primary/5 hover:border-primary/20 transition-all active:scale-95 text-xs" onClick={handleGoogleSignIn} disabled={isLoading}>
              <Chrome className="mr-2 h-4 w-4 text-primary" /> Lanjutkan dengan Google
            </Button>

            <div className="mt-8 text-center">
              <p className="text-xs text-muted-foreground font-medium">
                Belum punya akun?{' '}
                <Link href="/register" className="text-primary font-black hover:underline underline-offset-4">
                  Daftar Gratis
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
