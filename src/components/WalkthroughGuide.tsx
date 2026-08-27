/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CheckSquare,
  Sparkles,
  Lock,
  UserCheck,
  FileText,
  MessageSquare,
  ListTodo,
  Database,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface TestCase {
  id: string;
  category: string;
  title: string;
  instructions: string[];
  expectedResult: string;
  interactiveTrigger?: string;
}

const TEST_CASES: TestCase[] = [
  {
    id: 'TC-AUTH-01',
    category: '1. Authentication & Session Security',
    title: 'Google Sign-In & Guest Sandbox Auth',
    instructions: [
      'Navigate to the landing screen while unauthenticated.',
      'Click "Sign in with Google" or "Instant Preview as Guest".',
      'Verify the user profile avatar and email appear in the top-right navbar.',
      'Click "Sign Out" to verify session termination returns to the landing page.',
    ],
    expectedResult: 'Authentication state initializes Firebase Auth token without exposing password inputs.',
  },
  {
    id: 'TC-JOURNAL-02',
    category: '2. Journal Entry Composition',
    title: 'Writing Stream-of-Consciousness Reflections',
    instructions: [
      'Click "New Entry" or open the Studio tab.',
      'Click one of the prompt chips (e.g. "🌅 Morning Intention").',
      'Type custom reflection text into the main textarea.',
      'Observe real-time word count and reading time recalculation.',
      'Add a custom tag (e.g. "strategy", "energy") by typing into the "+ tag" input and pressing Enter.',
    ],
    expectedResult: 'Reflection content, tags, and word counters update reactively.',
  },
  {
    id: 'TC-GEMINI-03',
    category: '3. Multi-Turn AI Dialogue',
    title: 'Conversational Brainstorming with Aura (Gemini 3.6 Flash)',
    instructions: [
      'In the right panel under "Multi-Turn Dialogue", type a question or click a suggested prompt chip ("Challenge my assumptions gently").',
      'Click the Send button.',
      'Wait for Gemini to reflect back with structured paragraphs, probing questions, and insights.',
      'Reply with a follow-up message to verify conversational multi-turn context retention.',
    ],
    expectedResult: 'Gemini returns empathetic, structured reflections powered by the server fallback ladder.',
  },
  {
    id: 'TC-SYNTH-04',
    category: '4. Structured Synthesis & Action Extraction',
    title: 'JSON Schema Extraction (Summary, Takeaways, Prioritized Actions)',
    instructions: [
      'Click the golden "Synthesize with Gemini" button in the top action bar.',
      'Switch to or observe the "Structured Synthesis" tab.',
      'Verify that an Executive Summary, Key Insights, Prioritized Action Items (High/Medium/Low), Sentiment, and Tags are extracted.',
      'Click on any Action Item checkbox to mark it completed.',
    ],
    expectedResult: 'A typed JSON schema is generated adhering strictly to Directive 8 and rendered into interactive cards.',
  },
  {
    id: 'TC-STORE-05',
    category: '5. Cloud Firestore Persistence & User Isolation',
    title: 'Firestore State Storage & Archive Sync',
    instructions: [
      'Click "Save" or observe the automatic sync indicator in the navbar.',
      'Switch to the "History" tab in the navbar.',
      'Verify that the saved reflection appears in the grid with its timestamp, sentiment tag, and action completion progress bar.',
      'Toggle the Favorite star on an entry.',
      'Use the search bar and filter chips (e.g., Sentiment = Focused) to filter the entries.',
      'Click "Delete" on an entry to verify removal from Firestore.',
    ],
    expectedResult: 'All records are written exclusively to `/users/{userId}/journals/{journalId}` and isolated to the authenticated user.',
  },
  {
    id: 'TC-PII-06',
    category: '6. PII Masking & Data Sanitization',
    title: 'Sensitive Credential & PII Redaction',
    instructions: [
      'In the reflection textarea or chat input, type a test mock API key (e.g., AIzaSyFakeTestKey1234567890123456789).',
      'Send a query to Gemini.',
      'Verify via server logs and client sanitizer that PII patterns are replaced with `[REDACTED_API_KEY]` prior to model ingestion.',
    ],
    expectedResult: 'Sensitive credentials are scrubbed client and server-side before reaching LLM context.',
  },
];

export const WalkthroughGuide: React.FC = () => {
  const [completedTests, setCompletedTests] = useState<Record<string, boolean>>({});

  const toggleTest = (id: string) => {
    setCompletedTests((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalTests = TEST_CASES.length;
  const passedTests = Object.values(completedTests).filter(Boolean).length;
  const progressPercent = Math.round((passedTests / totalTests) * 100);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-3 py-0.5 text-xs font-medium text-neutral-700 mb-2">
            <CheckSquare className="h-3.5 w-3.5 text-neutral-900" />
            <span>Test Walkthrough Protocol</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900">
            End-to-End Verification
          </h2>
          <p className="mt-0.5 text-xs text-neutral-600 max-w-2xl">
            Verification checklist covering each user interaction, state persistence boundary, and Gemini AI flow.
          </p>
        </div>

        {/* Progress Card */}
        <div className="rounded-xl border border-neutral-200 bg-white p-3 shadow-xs min-w-[220px]">
          <div className="flex items-center justify-between text-xs font-medium text-neutral-700 mb-1.5">
            <span>Progress:</span>
            <span className="font-semibold text-neutral-900">
              {passedTests} / {totalTests} ({progressPercent}%)
            </span>
          </div>
          <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-neutral-900 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Test Cases List */}
      <div className="space-y-3">
        {TEST_CASES.map((tc) => {
          const isDone = !!completedTests[tc.id];

          return (
            <div
              key={tc.id}
              id={`test-case-${tc.id}`}
              className={`rounded-xl border transition-colors p-4 sm:p-5 ${
                isDone
                  ? 'border-neutral-300 bg-neutral-50/70'
                  : 'border-neutral-200 bg-white shadow-xs'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleTest(tc.id)}
                    className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                      isDone
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-300 bg-white hover:border-neutral-400'
                    }`}
                  >
                    {isDone && <CheckSquare className="h-3 w-3" />}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-neutral-400 uppercase">
                        {tc.id}
                      </span>
                      <span className="text-[11px] font-medium text-neutral-700 bg-neutral-100 px-1.5 py-0.2 rounded border border-neutral-200/60">
                        {tc.category}
                      </span>
                    </div>

                    <h3 className={`text-sm sm:text-base font-semibold mt-1 ${isDone ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
                      {tc.title}
                    </h3>
                  </div>
                </div>

                <span
                  className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                    isDone
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                  }`}
                >
                  {isDone ? 'Verified' : 'Pending'}
                </span>
              </div>

              {/* Instructions */}
              <div className="mt-3 pl-7">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Execution Steps:
                </h4>
                <ol className="list-decimal list-inside space-y-0.5 text-xs text-neutral-700">
                  {tc.instructions.map((step, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {step}
                    </li>
                  ))}
                </ol>

                <div className="mt-2.5 rounded-lg bg-neutral-50 border border-neutral-100 p-2.5 text-xs text-neutral-700">
                  <span className="font-semibold text-neutral-900">Expected Outcome: </span>
                  {tc.expectedResult}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
