/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Sparkles,
  BookOpen,
  History,
  ShieldCheck,
  CheckSquare,
  LogOut,
  PlusCircle,
  Database,
  User as UserIcon,
} from 'lucide-react';
import { UserProfile } from '../types';

interface NavbarProps {
  user: UserProfile | null;
  activeTab: 'editor' | 'history' | 'security' | 'walkthrough';
  setActiveTab: (tab: 'editor' | 'history' | 'security' | 'walkthrough') => void;
  onNewEntry: () => void;
  onSignOut: () => void;
  isSyncing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onNewEntry,
  onSignOut,
  isSyncing = false,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Status */}
        <div className="flex items-center gap-3">
          <div
            id="brand-logo"
            onClick={() => setActiveTab('editor')}
            className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-80"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-neutral-900">Aura</span>
              <span className="ml-1 text-xs font-normal text-neutral-400">Reflections</span>
            </div>
          </div>

          {/* Sync indicator */}
          <div
            id="cloud-sync-status"
            className="hidden items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 text-xs font-normal text-neutral-600 sm:flex"
          >
            <Database className="h-3 w-3 text-neutral-500" />
            <span>{isSyncing ? 'Syncing...' : 'Firestore'}</span>
            <span className={`h-1.5 w-1.5 rounded-full ${isSyncing ? 'animate-pulse bg-neutral-400' : 'bg-emerald-500'}`} />
          </div>
        </div>

        {/* Navigation Tabs */}
        {user && (
          <nav className="flex items-center gap-1">
            <button
              id="nav-editor-tab"
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'editor'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Studio</span>
            </button>

            <button
              id="nav-history-tab"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>History</span>
            </button>

            <button
              id="nav-security-tab"
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'security'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Threat Model</span>
            </button>

            <button
              id="nav-walkthrough-tab"
              onClick={() => setActiveTab('walkthrough')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'walkthrough'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Walkthrough</span>
            </button>
          </nav>
        )}

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <button
                id="btn-new-entry"
                onClick={onNewEntry}
                className="hidden items-center gap-1.5 rounded-md bg-neutral-900 px-3 py-1.5 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-neutral-800 sm:inline-flex"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>New Entry</span>
              </button>

              {/* User profile dropdown info */}
              <div className="flex items-center gap-2 border-l border-neutral-200 pl-2 sm:pl-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="h-7 w-7 rounded-full border border-neutral-200 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 text-xs font-medium">
                    <UserIcon className="h-3.5 w-3.5" />
                  </div>
                )}

                <div className="hidden text-left lg:block">
                  <p className="max-w-[120px] truncate text-xs font-medium text-neutral-900">
                    {user.displayName || 'User'}
                  </p>
                  <p className="max-w-[120px] truncate text-[10px] text-neutral-400">
                    {user.email || (user.isAnonymous ? 'Guest' : 'Connected')}
                  </p>
                </div>

                <button
                  id="btn-sign-out"
                  onClick={onSignOut}
                  title="Sign Out"
                  className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="text-xs text-neutral-400">Protected Workspace</div>
          )}
        </div>
      </div>
    </header>
  );
};
