/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Lock,
  Zap,
  ArrowRight,
  CheckCircle2,
  FileText,
  UserCheck,
  Layers,
  Flame,
} from 'lucide-react';

interface LandingHeroProps {
  onGoogleSignIn: () => Promise<void>;
  onGuestSignIn: () => Promise<void>;
  isLoading: boolean;
  errorMessage: string | null;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onGoogleSignIn,
  onGuestSignIn,
  isLoading,
  errorMessage,
}) => {
  const [authMethod, setAuthMethod] = useState<'google' | 'guest' | null>(null);

  const handleGoogle = async () => {
    setAuthMethod('google');
    try {
      await onGoogleSignIn();
    } finally {
      setAuthMethod(null);
    }
  };

  const handleGuest = async () => {
    setAuthMethod('guest');
    try {
      await onGuestSignIn();
    } finally {
      setAuthMethod(null);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] bg-neutral-50 text-neutral-900 overflow-hidden">
      <div className="relative mx-auto max-w-5xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        {/* Main Header */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600 mb-6">
            <Sparkles className="h-3.5 w-3.5 text-neutral-900" />
            <span>AI Reflections & Structured Extraction</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-neutral-950 leading-tight">
            Reflect clearly and synthesize action with Gemini.
          </h1>

          <p className="mt-4 text-sm sm:text-base text-neutral-600 leading-relaxed max-w-xl mx-auto font-normal">
            A quiet, owner-isolated workspace for multi-turn journal dialogues with Gemini 3.6 Flash, automatic action extraction, and secure Firestore persistence.
          </p>

          {/* Auth Action Box */}
          <div className="mt-8 max-w-sm mx-auto rounded-xl border border-neutral-200 bg-white p-6 shadow-xs text-left">
            <h2 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider text-center mb-1">
              Sign In
            </h2>
            <p className="text-xs text-neutral-500 text-center mb-5">
              Entries are strictly isolated to your authenticated account.
            </p>

            {errorMessage && (
              <div id="auth-error-banner" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                {errorMessage}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {/* Primary Google Login Button */}
              <button
                id="btn-google-sign-in"
                onClick={handleGoogle}
                disabled={isLoading}
                className="group relative flex w-full items-center justify-center gap-2.5 rounded-lg bg-neutral-900 px-4 py-2.5 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50"
              >
                {/* Google Logo SVG */}
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>
                  {authMethod === 'google' && isLoading ? 'Connecting...' : 'Sign in with Google'}
                </span>
                <ArrowRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
              </button>

              {/* Guest / Demo Sandbox Option */}
              <button
                id="btn-guest-sign-in"
                onClick={handleGuest}
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
              >
                <UserCheck className="h-3.5 w-3.5 text-neutral-400" />
                <span>{authMethod === 'guest' && isLoading ? 'Entering...' : 'Instant Preview as Guest'}</span>
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-neutral-400">
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-neutral-400" /> Owner-Bound
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-neutral-400" /> PII Scrubbed
              </span>
            </div>
          </div>
        </div>

        {/* Feature Pillars */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 mb-3">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">Multi-Turn Dialogue</h3>
            <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
              Explore your thoughts with contextual reflection. Aura helps unpack questions, identify patterns, and offer perspective.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 mb-3">
              <Layers className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">Structured Synthesis</h3>
            <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
              Generate structured JSON outputs with executive summaries, key takeaways, prioritized action items, and sentiment analysis.
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-800 mb-3">
              <Lock className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">Isolated Storage</h3>
            <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
              Every journal entry is stored securely under your private Firestore partition, protected by strict security rules.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
