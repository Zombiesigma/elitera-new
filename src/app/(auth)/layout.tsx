'use client';

import { useAuthRedirect } from '@/hooks/use-auth-redirect';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useAuthRedirect();

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}
