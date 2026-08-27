/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  signInAsGuest,
  signOutUser,
  formatUserProfile,
  getLocalGuestProfile,
  saveJournalEntry,
  deleteJournalEntry,
  subscribeToUserJournals,
} from './lib/firebase';
import { UserProfile, JournalEntry } from './types';
import { Navbar } from './components/Navbar';
import { LandingHero } from './components/LandingHero';
import { JournalEditor } from './components/JournalEditor';
import { JournalHistory } from './components/JournalHistory';
import { ThreatModelModal } from './components/ThreatModelModal';
import { WalkthroughGuide } from './components/WalkthroughGuide';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // App Navigation Tabs
  const [activeTab, setActiveTab] = useState<'editor' | 'history' | 'security' | 'walkthrough'>('editor');

  // Firestore Journal State
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [activeEntry, setActiveEntry] = useState<JournalEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isFirestoreSyncing, setIsFirestoreSyncing] = useState(false);

  // Initialize a fresh new entry template
  const createNewEntryTemplate = useCallback((userId: string): JournalEntry => {
    return {
      id: 'entry-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      userId,
      title: 'Untitled Reflection',
      content: '',
      messages: [],
      tags: ['reflection'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }, []);

  // 1. Firebase Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        const formatted = formatUserProfile(user);
        setCurrentUser(formatted);
        setIsAuthChecking(false);

        if (formatted && !activeEntry) {
          setActiveEntry(createNewEntryTemplate(formatted.uid));
        }
      } else {
        // Check for local guest session
        const localGuest = getLocalGuestProfile();
        if (localGuest) {
          setCurrentUser(localGuest);
          if (!activeEntry) {
            setActiveEntry(createNewEntryTemplate(localGuest.uid));
          }
        } else {
          setCurrentUser(null);
        }
        setIsAuthChecking(false);
      }
    });

    return () => unsubscribe();
  }, [createNewEntryTemplate]);

  // 2. Real-time Cloud Firestore Subscription for Authenticated User
  useEffect(() => {
    if (!currentUser?.uid) {
      setEntries([]);
      return;
    }

    setIsFirestoreSyncing(true);
    const unsubscribe = subscribeToUserJournals(
      currentUser.uid,
      (fetchedEntries) => {
        setEntries(fetchedEntries);
        setIsFirestoreSyncing(false);

        // If there's an active entry that exists in fetched entries, keep it synchronized
        setActiveEntry((prev) => {
          if (!prev) {
            return fetchedEntries.length > 0 ? fetchedEntries[0] : createNewEntryTemplate(currentUser.uid);
          }
          const matching = fetchedEntries.find((e) => e.id === prev.id);
          return matching ? { ...prev, ...matching } : prev;
        });
      },
      (err) => {
        console.error('Real-time Firestore sync error:', err);
        setIsFirestoreSyncing(false);
        setSaveError('Cloud Firestore synchronization encountered a connection issue.');
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid, createNewEntryTemplate]);

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Sign in error:', err);
      setAuthError(err.message || 'Google Authentication was cancelled or blocked.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle Guest Sign-In
  const handleGuestSignIn = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const profile = await signInAsGuest();
      setCurrentUser(profile);
      setActiveEntry(createNewEntryTemplate(profile.uid));
    } catch (err: any) {
      console.error('Guest sign in error:', err);
      setAuthError(err.message || 'Guest session initialization failed.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    try {
      await signOutUser();
      setCurrentUser(null);
      setActiveEntry(null);
      setEntries([]);
      setActiveTab('editor');
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  // Handle New Entry Creation
  const handleCreateNewEntry = () => {
    if (!currentUser) return;
    const newEntry = createNewEntryTemplate(currentUser.uid);
    setActiveEntry(newEntry);
    setActiveTab('editor');
  };

  // Handle Save to Cloud Firestore
  const handleSaveEntry = async (entryToSave: JournalEntry) => {
    if (!currentUser?.uid) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      await saveJournalEntry(currentUser.uid, entryToSave);
      setActiveEntry(entryToSave);
    } catch (err: any) {
      console.error('Failed to save journal entry to Firestore:', err);
      setSaveError('Failed to persist to Cloud Firestore. Please verify network permissions and retry.');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete Entry
  const handleDeleteEntry = async (id: string) => {
    if (!currentUser?.uid) return;
    if (!window.confirm('Are you sure you want to permanently delete this reflection?')) return;

    try {
      await deleteJournalEntry(currentUser.uid, id);
      if (activeEntry?.id === id) {
        const remaining = entries.filter((e) => e.id !== id);
        setActiveEntry(remaining.length > 0 ? remaining[0] : createNewEntryTemplate(currentUser.uid));
      }
    } catch (err: any) {
      console.error('Failed to delete entry:', err);
    }
  };

  // Handle Favorite Toggle
  const handleToggleFavorite = async (entry: JournalEntry) => {
    if (!currentUser?.uid) return;
    const updated = { ...entry, isFavorite: !entry.isFavorite };
    await handleSaveEntry(updated);
  };

  // Handle Selecting an Entry from History
  const handleSelectEntry = (entry: JournalEntry) => {
    setActiveEntry(entry);
    setActiveTab('editor');
  };

  if (isAuthChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 text-neutral-700 antialiased">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-900 border-t-transparent" />
          <p className="text-xs font-medium tracking-wider uppercase text-neutral-400">
            Initializing Session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans antialiased selection:bg-neutral-200 selection:text-neutral-900">
      {/* Top Navbar */}
      <Navbar
        user={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewEntry={handleCreateNewEntry}
        onSignOut={handleSignOut}
        isSyncing={isFirestoreSyncing || isSaving}
      />

      {/* Main Content View Switcher */}
      <main>
        {!currentUser ? (
          <LandingHero
            onGoogleSignIn={handleGoogleSignIn}
            onGuestSignIn={handleGuestSignIn}
            isLoading={isAuthLoading}
            errorMessage={authError}
          />
        ) : (
          <>
            {activeTab === 'editor' && activeEntry && (
              <JournalEditor
                entry={activeEntry}
                onSave={handleSaveEntry}
                onDelete={handleDeleteEntry}
                isSaving={isSaving}
                saveError={saveError}
                onClearSaveError={() => setSaveError(null)}
              />
            )}

            {activeTab === 'history' && (
              <JournalHistory
                entries={entries}
                onSelectEntry={handleSelectEntry}
                onDeleteEntry={handleDeleteEntry}
                onToggleFavorite={handleToggleFavorite}
                onNewEntry={handleCreateNewEntry}
              />
            )}

            {activeTab === 'security' && <ThreatModelModal />}

            {activeTab === 'walkthrough' && <WalkthroughGuide />}
          </>
        )}
      </main>
    </div>
  );
}
