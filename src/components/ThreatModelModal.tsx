/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ShieldCheck,
  Lock,
  FileCode,
  Key,
  Server,
  Database,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

export const ThreatModelModal: React.FC = () => {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-3 py-0.5 text-xs font-medium text-neutral-700 mb-2">
          <ShieldCheck className="h-3.5 w-3.5 text-neutral-900" />
          <span>Security & Threat Model Matrix</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900">
          Security Architecture
        </h2>
        <p className="mt-0.5 text-xs text-neutral-600 max-w-3xl">
          Threat analysis mapping risks across the 5 Threat Zones, verified against OWASP Top 10 for LLM Applications and Cloud Firestore Owner-Bound rules.
        </p>
      </div>

      {/* 5 Threat Zones Table */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-xs">
        <div className="border-b border-neutral-100 bg-neutral-50/70 px-5 py-3">
          <h3 className="text-xs sm:text-sm font-semibold text-neutral-900">
            Threat Modeling Matrix (5 Scope Lenses)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-neutral-700">
            <thead className="bg-neutral-100/70 text-neutral-900 font-semibold border-b border-neutral-200">
              <tr>
                <th className="px-4 py-2.5">Threat Zone</th>
                <th className="px-4 py-2.5">Identified Risks & Attack Vectors</th>
                <th className="px-4 py-2.5">Countermeasures & Mitigation Architecture</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
                    <span>1. Input Surfaces</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  Untrusted journal text, malicious prompt injection, accidental pasting of API keys, card numbers, or SSNs.
                </td>
                <td className="px-4 py-3 text-neutral-800">
                  Client & server-side regex PII scrubbing (<code className="bg-neutral-100 px-1 py-0.5 rounded text-[11px]">maskPII</code>), plain data boundary delimiting in system instructions, defensive request deserialization with strict body limit.
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-neutral-900 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-[11px] font-medium">
                    <CheckCircle2 className="h-3 w-3 text-neutral-700" /> Enforced
                  </span>
                </td>
              </tr>

              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
                    <span>2. Planning & Reasoning</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  Jailbreak instructions trying to alter assistant persona or bypass output schemas.
                </td>
                <td className="px-4 py-3 text-neutral-800">
                  System instructions strictly binding the model to contemplative thought partnership; strict JSON schema enforcement via <code className="bg-neutral-100 px-1 py-0.5 rounded text-[11px]">responseMimeType: "application/json"</code>.
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-neutral-900 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-[11px] font-medium">
                    <CheckCircle2 className="h-3 w-3 text-neutral-700" /> Enforced
                  </span>
                </td>
              </tr>

              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
                    <span>3. Tool & Backend Execution</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  API Key leakage to browser client, single-model outage / 503 / 429 quota exhaustion, SSRF or command injection.
                </td>
                <td className="px-4 py-3 text-neutral-800">
                  Server-side proxy (<code className="bg-neutral-100 px-1 py-0.5 rounded text-[11px]">/api/gemini/*</code>) keeping <code className="bg-neutral-100 px-1 py-0.5 rounded text-[11px]">GEMINI_API_KEY</code> hidden; Resilient Fallback Ladder (<code className="text-[11px]">gemini-3.6-flash &rarr; 3.1-flash-lite &rarr; flash-latest &rarr; 3.7-flash</code>).
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-neutral-900 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-[11px] font-medium">
                    <CheckCircle2 className="h-3 w-3 text-neutral-700" /> Enforced
                  </span>
                </td>
              </tr>

              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
                    <span>4. Memory & State Persistence</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  Cross-user reflection leaks, unauthorized Firestore reads/writes, malformed undefined values crashing writes.
                </td>
                <td className="px-4 py-3 text-neutral-800">
                  Strict Firestore security rules (<code className="bg-neutral-100 px-1 py-0.5 rounded text-[11px]">request.auth.uid == userId</code>); Subcollection path isolation (<code className="text-[11px]">/users/&#123;uid&#125;/journals/*</code>); Deep undefined-stripping before persistence.
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-neutral-900 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-[11px] font-medium">
                    <CheckCircle2 className="h-3 w-3 text-neutral-700" /> Enforced
                  </span>
                </td>
              </tr>

              <tr>
                <td className="px-4 py-3 font-semibold text-neutral-900">
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
                    <span>5. Inter-System Communication</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-600">
                  Token eavesdropping, hardcoded service credentials in source code, unauthenticated webhooks.
                </td>
                <td className="px-4 py-3 text-neutral-800">
                  Zero hardcoded credentials in codebase; environment variable injection; TLS encrypted communication with Google GenAI and Firebase servers.
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-neutral-900 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded text-[11px] font-medium">
                    <CheckCircle2 className="h-3 w-3 text-neutral-700" /> Enforced
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Deployed Security Rules Verification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-neutral-900" />
            <h4 className="text-xs sm:text-sm font-semibold text-neutral-900">Deployed Firestore Rules</h4>
          </div>
          <p className="text-xs text-neutral-600 mb-3">
            Zero insecure default access. Only authenticated users can read or write documents situated under their own UID directory.
          </p>
          <pre className="rounded-lg bg-neutral-900 p-3 text-xs text-neutral-200 font-mono overflow-x-auto leading-relaxed">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null 
                         && request.auth.uid == userId;

      match /journals/{journalId} {
        allow read, write: if request.auth != null 
                           && request.auth.uid == userId;
      }

      match /interactions/{interactionId} {
        allow read, write: if request.auth != null 
                           && request.auth.uid == userId;
      }
    }
  }
}`}
          </pre>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <Server className="h-4 w-4 text-neutral-900" />
            <h4 className="text-xs sm:text-sm font-semibold text-neutral-900">Gemini Fallback Ladder</h4>
          </div>
          <p className="text-xs text-neutral-600 mb-3">
            Automated failover protocol catching 503 Unavailable, 429 Rate Limits, or model quota spikes:
          </p>

          <ol className="space-y-2 text-xs text-neutral-700">
            <li className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-200">
              <span className="font-semibold text-neutral-900">1. Primary Tier:</span>
              <code className="font-mono text-neutral-900 bg-neutral-200 px-1.5 py-0.5 rounded text-[11px]">gemini-3.6-flash</code>
            </li>
            <li className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-200">
              <span className="font-medium text-neutral-800">2. High-Availability:</span>
              <code className="font-mono text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded text-[11px]">gemini-3.1-flash-lite</code>
            </li>
            <li className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-200">
              <span className="font-medium text-neutral-800">3. Dynamic Alias:</span>
              <code className="font-mono text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded text-[11px]">gemini-flash-latest</code>
            </li>
            <li className="flex items-center justify-between p-2 rounded-lg bg-neutral-50 border border-neutral-200">
              <span className="font-medium text-neutral-800">4. Reasoning Fallback:</span>
              <code className="font-mono text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded text-[11px]">gemini-3.7-flash</code>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
