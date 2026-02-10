'use client';

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuth } from '@/firebase/provider';

type UserState = {
  isLoading: boolean;
  user: User | null;
};

export function useUser(): UserState {
  const auth = useAuth();
  const [userState, setUserState] = useState<UserState>({
    user: auth?.currentUser ?? null,
    isLoading: !auth?.currentUser,
  });

  useEffect(() => {
    if (!auth) {
       setUserState({ user: null, isLoading: false });
       return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserState({ user, isLoading: false });
    });

    return () => unsubscribe();
  }, [auth]);

  return userState;
}
