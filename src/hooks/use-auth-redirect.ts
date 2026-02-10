'use client';

import { useUser } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Redirects the user to a specified path if they are authenticated.
 * @param path The path to redirect to. Defaults to '/'.
 */
export function useAuthRedirect(path = '/') {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push(path);
    }
  }, [user, isLoading, router, path]);
}
