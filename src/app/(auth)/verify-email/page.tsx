'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MailCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { resendVerificationEmail } from '@/firebase/auth/service';
import { useToast } from '@/hooks/use-toast';

export default function VerifyEmailPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    // If user is verified, or they are a Google user, redirect them.
    if (user && (user.emailVerified || user.providerData.some(p => p.providerId === 'google.com'))) {
      router.push('/');
      return;
    }
    
    // If not logged in after loading, send to login
    if (!isLoading && !user) {
        router.push('/login');
        return;
    }

    // Set up an interval to check for verification status.
    const interval = setInterval(async () => {
      if (user) {
        await user.reload();
        if (user.emailVerified) {
          clearInterval(interval);
          toast({
              title: "Verifikasi Berhasil!",
              description: "Email Anda telah diverifikasi. Selamat datang di Elitera!"
          });
          router.push('/');
        }
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [user, isLoading, router, toast]);

  const handleResend = async () => {
    setIsResending(true);
    const { success, error } = await resendVerificationEmail();
    if (success) {
      toast({
        title: 'Email Terkirim',
        description: 'Tautan verifikasi baru telah dikirimkan ke email Anda.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Gagal Mengirim Ulang',
        description: 'Terlalu banyak permintaan. Coba lagi nanti.',
      });
    }
    setIsResending(false);
  };

  if (isLoading || !user) {
      return (
          <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-muted-foreground">Memuat status verifikasi...</p>
          </div>
      )
  }

  return (
    <Card className="mx-auto max-w-sm w-full text-center">
      <CardHeader className="space-y-4">
        <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
            <MailCheck className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-2xl font-headline">Verifikasi Email Anda</CardTitle>
        <CardDescription>
          Kami telah mengirim tautan verifikasi ke <strong>{user.email}</strong>. Silakan periksa kotak masuk (dan folder spam) Anda untuk melanjutkan. Halaman ini akan diperbarui secara otomatis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleResend} className="w-full" disabled={isResending}>
          {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Kirim Ulang Email Verifikasi
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Kembali ke Halaman Login</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
