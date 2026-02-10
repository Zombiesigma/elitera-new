'use client';

import { useUser, useDoc, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const userProfileRef = (firestore && user) ? doc(firestore, 'users', user.uid) : null;
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<AppUser>(userProfileRef);

  const isLoading = isUserLoading || isProfileLoading;
  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';

  useEffect(() => {
    // If loading is finished and user is not an admin, redirect
    if (!isLoading && !isAdmin) {
      router.replace('/');
    }
  }, [isLoading, isAdmin, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Memverifikasi izin admin...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="max-w-md w-full text-center">
            <CardHeader>
                <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit mb-4">
                    <ShieldAlert className="h-8 w-8 text-destructive" />
                </div>
                <CardTitle>Akses Ditolak</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground mb-4">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
                <Button onClick={() => router.push('/')}>Kembali ke Beranda</Button>
            </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
