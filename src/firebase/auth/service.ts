'use client';

import { initializeFirebase } from '@/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
  sendEmailVerification,
  type User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const { auth, firestore } = initializeFirebase();
const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: 'select_account'
});

async function createUserProfile(user: User, customPhotoURL?: string) {
  const userDocRef = doc(firestore, 'users', user.uid);
  const userDoc = await getDoc(userDocRef);

  if (!userDoc.exists()) {
    // Selalu simpan username dalam format lowercase untuk mencegah error 404 pada profil
    const baseUsername = user.email?.split('@')[0] || user.uid;
    const normalizedUsername = baseUsername.toLowerCase().replace(/[^a-z0-9_]/g, '');

    await setDoc(userDocRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: customPhotoURL || user.photoURL || `https://api.dicebear.com/8.x/identicon/svg?seed=${user.uid}`,
      role: 'pembaca',
      username: normalizedUsername,
      bio: 'Pengguna baru Elitera',
      followers: 0,
      following: 0,
      status: 'online',
      lastSeen: serverTimestamp(),
    });
  } else {
     await updateDoc(userDocRef, {
        status: 'online',
        lastSeen: serverTimestamp(),
    });
  }
}

export async function signUpWithEmail(email: string, password: string, displayName: string, photoURL?: string) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await sendEmailVerification(user);

    const finalPhotoURL = photoURL || `https://api.dicebear.com/8.x/identicon/svg?seed=${user.uid}`;
    await updateProfile(user, { displayName, photoURL: finalPhotoURL });
    
    const userWithProfile = {
      ...user,
      displayName: displayName,
      photoURL: finalPhotoURL
    };

    await createUserProfile(userWithProfile, finalPhotoURL);
    return { user: userWithProfile };
  } catch (error) {
    return { error };
  }
}

export async function signInWithEmail(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await createUserProfile(userCredential.user);
    return { user: userCredential.user };
  } catch (error) {
    return { error };
  }
}

export async function resendVerificationEmail() {
    if (auth.currentUser) {
        try {
            await sendEmailVerification(auth.currentUser);
            return { success: true };
        } catch (error) {
            return { error };
        }
    }
    return { error: new Error("No user is currently signed in.") };
}

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    await createUserProfile(user);
    return { user };
  } catch (error) {
    return { error };
  }
}

export async function signOut() {
  try {
    if (auth.currentUser) {
        const userStatusRef = doc(firestore, 'users', auth.currentUser.uid);
        await updateDoc(userStatusRef, {
            status: 'offline',
            lastSeen: serverTimestamp(),
        });
    }
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out: ", error);
  }
}