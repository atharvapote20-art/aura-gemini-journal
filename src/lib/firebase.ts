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

const GUEST_STORAGE_KEY = 'aura_guest_journals';

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
 * Guest/Anonymous Sign In for instant sandbox exploration.
 * Handles Firebase 'auth/admin-restricted-operation' gracefully by providing a local sandbox profile.
 */
export async function signInAsGuest(): Promise<UserProfile> {
  try {
    const result = await signInAnonymously(auth);
    return formatUserProfile(result.user)!;
  } catch (error: any) {
    // If anonymous sign-in is disabled in Firebase console (auth/admin-restricted-operation or auth/operation-not-allowed)
    if (
      error.code === 'auth/admin-restricted-operation' ||
      error.code === 'auth/operation-not-allowed' ||
      error.message?.includes('admin-restricted-operation')
    ) {
      console.info('Firebase anonymous auth is disabled in project console. Using local sandbox session.');
      let guestId = localStorage.getItem('aura_guest_uid');
      if (!guestId) {
        guestId = 'guest-sandbox-' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('aura_guest_uid', guestId);
      }
      const guestProfile: UserProfile = {
        uid: guestId,
        displayName: 'Guest Reflective User',
        email: null,
        photoURL: null,
        isAnonymous: true,
      };
      localStorage.setItem('aura_guest_active', 'true');
      return guestProfile;
    }
    throw error;
  }
}

/**
 * Sign Out
 */
export async function signOutUser(): Promise<void> {
  localStorage.removeItem('aura_guest_active');
  try {
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch (err) {
    console.warn('Sign out error:', err);
  }
}

/**
 * Check for existing guest session
 */
export function getLocalGuestProfile(): UserProfile | null {
  const isGuestActive = localStorage.getItem('aura_guest_active') === 'true';
  const guestId = localStorage.getItem('aura_guest_uid');
  if (isGuestActive && guestId) {
    return {
      uid: guestId,
      displayName: 'Guest Reflective User',
      email: null,
      photoURL: null,
      isAnonymous: true,
    };
  }
  return null;
}

/**
 * Helper to get local guest entries
 */
function getLocalGuestEntries(): JournalEntry[] {
  try {
    const data = localStorage.getItem(GUEST_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Helper to save local guest entries
 */
function setLocalGuestEntries(entries: JournalEntry[]): void {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
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

  const cleanData = sanitizePayload({
    ...entry,
    userId,
    updatedAt: Date.now(),
  });

  // If local guest sandbox user or no active firebase token
  if (userId.startsWith('guest-') || !auth.currentUser) {
    const existing = getLocalGuestEntries();
    const idx = existing.findIndex((e) => e.id === entry.id);
    if (idx >= 0) {
      existing[idx] = cleanData as JournalEntry;
    } else {
      existing.unshift(cleanData as JournalEntry);
    }
    setLocalGuestEntries(existing);
    return;
  }
  
  const entryRef = doc(db, 'users', userId, 'journals', entry.id);
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

  if (userId.startsWith('guest-') || !auth.currentUser) {
    const existing = getLocalGuestEntries();
    const filtered = existing.filter((e) => e.id !== entryId);
    setLocalGuestEntries(filtered);
    return;
  }

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

  if (userId.startsWith('guest-') || !auth.currentUser) {
    const local = getLocalGuestEntries();
    onUpdate(local);
    // Poll or event listener for local storage changes if needed
    const handler = () => {
      onUpdate(getLocalGuestEntries());
    };
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('storage', handler);
    };
  }

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
      // Fallback to local guest store if Firestore rejects due to permission
      const local = getLocalGuestEntries();
      if (local.length > 0) {
        onUpdate(local);
      } else if (onError) {
        onError(err);
      }
    }
  );
}
