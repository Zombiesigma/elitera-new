'use client';

import { FirebaseProvider } from './provider';
import { initializeFirebase } from './init';

/**
 * FirebaseClientProvider membungkus aplikasi dengan konteks Firebase
 * yang diinisialisasi sekali di sisi klien.
 */
export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { firebaseApp, auth, firestore } = initializeFirebase();
  return (
    <FirebaseProvider value={{ firebaseApp, auth, firestore }}>
      {children}
    </FirebaseProvider>
  );
}
