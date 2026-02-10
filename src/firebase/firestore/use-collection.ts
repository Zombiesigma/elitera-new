'use client';
import { useState, useEffect } from 'react';
import type { Query, DocumentData, FirestoreError } from 'firebase/firestore';
import { onSnapshot } from 'firebase/firestore';
import { useAuth } from '../provider';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function useCollection<T>(query: Query<DocumentData> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const auth = useAuth();

  useEffect(() => {
    if (!query) {
      setData([]);
      setIsLoading(false);
      return;
    }

    // The query object is now a dependency of useEffect.
    // The component using this hook should memoize the query
    // to prevent re-fetching on every render.
    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const result: T[] = [];
        snapshot.forEach((doc) => {
          result.push({ id: doc.id, ...doc.data() } as T);
        });
        setData(result);
        setIsLoading(false);
        setError(null);
      },
      async (err) => {
        const permissionError = new FirestorePermissionError({
            // The public Firebase JS SDK does not expose the path from a query object.
            // This is a known limitation. We'll use a placeholder.
            path: 'unknown/collection/path (from query)',
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query, auth]);

  return { data, isLoading, error };
}
