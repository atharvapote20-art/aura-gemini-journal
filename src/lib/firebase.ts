/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { JournalEntry, UserProfile } from '../types';
import { sanitizePayload } from './sanitizer';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Auth Instance
export const auth = getAuth(app);

// Firestore Instance targeting the specific database ID provisioned
export const db: Firestore = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Sign in with Google (Popup method with Redirect fallback)
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.warn('Popup sign in failed, trying redirect or fallback:', error);
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user') {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (redirectErr) {
        console.error('Redirect sign in failed:', redirectErr);
        throw redirectErr;
      }
    }
    throw error;
  }
}

/**
 * Guest/Anonymous Sign In for instant sandbox exploration without popups
 */
export async function signInAsGuest(): Promise<User> {
  const result = await signInAnonymously(auth);
  return result.user;
}

/**
 * Sign Out
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Convert Firebase User to UserProfile
 */
export function formatUserProfile(user: User | null): UserProfile | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || (user.isAnonymous ? 'Guest Reflective User' : 'Authenticated Journaler'),
    photoURL: user.photoURL,
    isAnonymous: user.isAnonymous,
  };
}

/**
 * Path helper to ensure strict user isolation in Firestore:
 * Collection: /users/{userId}/journals/{journalId}
 */
export function getUserJournalsCollection(userId: string) {
  return collection(db, 'users', userId, 'journals');
}

/**
 * Path helper for interaction logs:
 * Collection: /users/{userId}/interactions/{interactionId}
 */
export function getUserInteractionsCollection(userId: string) {
  return collection(db, 'users', userId, 'interactions');
}

/**
 * Save or update a Journal Entry in the isolated user subcollection
 */
export async function saveJournalEntry(userId: string, entry: JournalEntry): Promise<void> {
  if (!userId) throw new Error('User ID is required to save journal entry');
  
  const entryRef = doc(db, 'users', userId, 'journals', entry.id);
  const cleanData = sanitizePayload({
    ...entry,
    userId,
    updatedAt: Date.now(),
  });

  await setDoc(entryRef, cleanData, { merge: true });

  // Also log the latest interaction record for audit and interaction indexing
  try {
    const interactionRef = doc(db, 'users', userId, 'interactions', entry.id);
    await setDoc(
      interactionRef,
      sanitizePayload({
        journalId: entry.id,
        title: entry.title,
        messageCount: entry.messages?.length || 0,
        lastUpdated: Date.now(),
        sentiment: entry.sentiment || 'reflective',
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Optional interaction record write caught:', err);
  }
}

/**
 * Delete a journal entry
 */
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) return;
  const entryRef = doc(db, 'users', userId, 'journals', entryId);
  await deleteDoc(entryRef);
}

/**
 * Subscribe to the authenticated user's real-time journal entries
 */
export function subscribeToUserJournals(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError?: (error: Error) => void
) {
  if (!userId) return () => {};

  const colRef = getUserJournalsCollection(userId);
  const q = query(colRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data() as JournalEntry);
      });
      onUpdate(items);
    },
    (err) => {
      console.error('Firestore subscription error:', err);
      if (onError) onError(err);
    }
  );
}
