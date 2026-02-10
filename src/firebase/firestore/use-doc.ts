'use client';
import { useState, useEffect, useMemo } from 'react';
import type { DocumentReference, DocumentData, FirestoreError } from 'firebase/firestore';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '../provider';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


export function useDoc<T>(ref: DocumentReference<DocumentData> | null) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const auth = useAuth();
  
  const memoizedRef = useMemo(() => ref, [ref?.path]);

  useEffect(() => {
    if (!memoizedRef) {
      setData(null);
      setIsLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      memoizedRef,
      (doc) => {
        if (doc.exists()) {
          setData({ id: doc.id, ...doc.data() } as T);
        } else {
          setData(null);
        }
        setIsLoading(false);
        setError(null);
      },
      async (err) => {
        const permissionError = new FirestorePermissionError({
          path: memoizedRef.path,
          operation: 'get',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [memoizedRef, auth]);

  return { data, isLoading, error };
}
