/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Mail,
  Code2,
  Calendar,
  ListOrdered,
  Copy,
  Check,
  Download,
  ExternalLink,
  RefreshCw,
  Clock,
  Send,
  Sliders,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import {
  JournalEntry,
  ArtifactsCollection,
  ArtifactToneType,
  EmailDraft,
  CodeTechSpec,
  CalendarBlock,
  DagTask,
  PriorityType,
} from '../types';
import { downloadIcsFile, getGoogleCalendarUrl } from '../lib/calendar';
import { maskPII } from '../lib/sanitizer';
import { DagVisualizer } from './DagVisualizer';
import { GitBranch, List } from 'lucide-react';

interface ActionWorkbenchDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entry: JournalEntry;
  onUpdateEntry: (updated: JournalEntry) => Promise<void>;
}

export const ActionWorkbenchDrawer: React.FC<ActionWorkbenchDrawerProps> = ({
  isOpen,
  onClose,
  entry,
  onUpdateEntry,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'emails' | 'code' | 'calendar' | 'dag'>('all');
  const [dagDisplayMode, setDagDisplayMode] = useState<'visual' | 'list'>('visual');
  const [selectedTone, setSelectedTone] = useState<ArtifactToneType>('diplomatic');
  const [customGuidance, setCustomGuidance] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const artifacts: ArtifactsCollection | undefined = entry.artifacts;

  const totalArtifactsCount =
    (artifacts?.email_drafts?.length || 0) +
    (artifacts?.code_or_tech_specs?.length || 0) +
    (artifacts?.calendar_blocks?.length || 0) +
    (artifacts?.action_dag?.length || 0);

  // Trigger Gemini Artifact Generation (Directive 10)
  const handleGenerateArtifacts = async (toneOverride?: ArtifactToneType) => {
    if (!entry.content.trim() && entry.messages.length === 0) {
      setError('Please write some reflection content or dialogue before synthesizing artifacts.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    const toneToUse = toneOverride || selectedTone;

    try {
      const response = await fetch('/api/gemini/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: entry.content,
          messages: entry.messages,
          preferredTone: toneToUse,
          customInstruction: customGuidance,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to synthesize action artifacts.');
      }

      const generatedArtifacts: ArtifactsCollection = data.artifacts;

      // PII Scrubbing on generated artifacts prior to local state and persistence
      const sanitizedArtifacts: ArtifactsCollection = {
        email_drafts: (generatedArtifacts.email_drafts || []).map((e) => ({
          ...e,
          subject: maskPII(e.subject),
          body: maskPII(e.body),
        })),
        code_or_tech_specs: (generatedArtifacts.code_or_tech_specs || []).map((c) => ({
          ...c,
          title: maskPII(c.title),
          snippet: maskPII(c.snippet),
          explanation: maskPII(c.explanation),
        })),
        calendar_blocks: (generatedArtifacts.calendar_blocks || []).map((b) => ({
          ...b,
          event_title: maskPII(b.event_title),
          agenda: maskPII(b.agenda),
        })),
        action_dag: (generatedArtifacts.action_dag || []).map((d) => ({
          ...d,
          task: maskPII(d.task),
        })),
      };

      const updatedEntry: JournalEntry = {
        ...entry,
        artifacts: sanitizedArtifacts,
        updatedAt: Date.now(),
      };

      await onUpdateEntry(updatedEntry);
      setFeedbackNotice('Artifacts synthesized & saved to Firestore!');
      setTimeout(() => setFeedbackNotice(null), 3000);
    } catch (err: any) {
      console.error('Artifact generation error:', err);
      setError(err.message || 'An error occurred while synthesizing artifacts.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, id: string, noticeText = 'Copied to clipboard!') => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setFeedbackNotice(noticeText);
    setTimeout(() => {
      setCopiedId(null);
      setFeedbackNotice(null);
    }, 2500);
  };

  // Toggle DAG task completion & sync
  const handleToggleDagTask = async (taskId: string) => {
    if (!artifacts?.action_dag) return;
    const updatedDag = artifacts.action_dag.map((task) =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    );

    const updatedEntry: JournalEntry = {
      ...entry,
      artifacts: {
        ...artifacts,
        action_dag: updatedDag,
      },
      updatedAt: Date.now(),
    };

    await onUpdateEntry(updatedEntry);
  };

  // Edit email draft locally & sync
  const handleEmailFieldChange = async (index: number, field: keyof EmailDraft, val: string) => {
    if (!artifacts?.email_drafts) return;
    const updatedEmails = [...artifacts.email_drafts];
    updatedEmails[index] = { ...updatedEmails[index], [field]: val };

    const updatedEntry: JournalEntry = {
      ...entry,
      artifacts: {
        ...artifacts,
        email_drafts: updatedEmails,
      },
      updatedAt: Date.now(),
    };
    await onUpdateEntry(updatedEntry);
  };

  // DAG Completion calculation
  const dagTasks = artifacts?.action_dag || [];
  const completedDagTasks = dagTasks.filter((t) => t.completed).length;
  const dagPercent = dagTasks.length > 0 ? Math.round((completedDagTasks / dagTasks.length) * 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        id="workbench-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-neutral-900/40 backdrop-blur-[1px] transition-opacity"
      />

      {/* Sliding Drawer Container */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-12">
        <div
          id="action-workbench-panel"
          className="w-screen max-w-2xl bg-white shadow-2xl border-l border-neutral-200 flex flex-col h-full overflow-hidden"
        >
          {/* Top Header */}
          <div className="border-b border-neutral-200 bg-neutral-50/70 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-900 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-semibold text-neutral-900">
                    Action Workbench & Execution Engine
                  </h3>
                  <span className="rounded bg-neutral-200 px-1.5 py-0.2 text-[11px] font-mono text-neutral-700">
                    {totalArtifactsCount} Artifacts
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Ready-to-execute emails, code specs, calendar blocks, and action DAGs.
                </p>
              </div>
            </div>

            <button
              id="btn-close-workbench"
              onClick={onClose}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-200/60 hover:text-neutral-700 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tone & Filter Controls */}
          <div className="border-b border-neutral-200 bg-white px-5 py-3 space-y-2.5">
            {/* Tone Selector & Regenerate */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                <span className="text-[11px] font-medium text-neutral-400 uppercase">Tone:</span>
                {(['diplomatic', 'assertive', 'direct'] as ArtifactToneType[]).map((tone) => (
                  <button
                    key={tone}
                    id={`btn-tone-${tone}`}
                    onClick={() => {
                      setSelectedTone(tone);
                      if (artifacts) handleGenerateArtifacts(tone);
                    }}
                    className={`rounded px-2 py-1 text-xs capitalize transition-colors ${
                      selectedTone === tone
                        ? 'bg-neutral-900 text-white font-medium'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>

              <button
                id="btn-regenerate-artifacts"
                onClick={() => handleGenerateArtifacts()}
                disabled={isGenerating}
                className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
                <span>{isGenerating ? 'Synthesizing...' : 'Regenerate Artifacts'}</span>
              </button>
            </div>

            {/* Custom guidance input for generation */}
            <div className="flex items-center gap-2">
              <input
                id="input-custom-artifact-guidance"
                type="text"
                value={customGuidance}
                onChange={(e) => setCustomGuidance(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateArtifacts()}
                placeholder="Optional direction (e.g. Focus on database migration & concise executive update)..."
                className="flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 text-xs">
              <button
                id="filter-artifacts-all"
                onClick={() => setSelectedCategory('all')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-neutral-200 text-neutral-900'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                All ({totalArtifactsCount})
              </button>
              <button
                id="filter-artifacts-emails"
                onClick={() => setSelectedCategory('emails')}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === 'emails'
                    ? 'bg-neutral-200 text-neutral-900'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Mail className="h-3 w-3" /> Emails ({artifacts?.email_drafts?.length || 0})
              </button>
              <button
                id="filter-artifacts-code"
                onClick={() => setSelectedCategory('code')}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === 'code'
                    ? 'bg-neutral-200 text-neutral-900'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Code2 className="h-3 w-3" /> Tech Specs ({artifacts?.code_or_tech_specs?.length || 0})
              </button>
              <button
                id="filter-artifacts-calendar"
                onClick={() => setSelectedCategory('calendar')}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === 'calendar'
                    ? 'bg-neutral-200 text-neutral-900'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <Calendar className="h-3 w-3" /> Calendar ({artifacts?.calendar_blocks?.length || 0})
              </button>
              <button
                id="filter-artifacts-dag"
                onClick={() => setSelectedCategory('dag')}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedCategory === 'dag'
                    ? 'bg-neutral-200 text-neutral-900'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                <ListOrdered className="h-3 w-3" /> DAG Tasks ({artifacts?.action_dag?.length || 0})
              </button>
            </div>
          </div>

          {/* Feedback & Error Notices */}
          {feedbackNotice && (
            <div id="notice-workbench-feedback" className="bg-emerald-50 border-b border-emerald-200 px-5 py-2 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>{feedbackNotice}</span>
            </div>
          )}

          {error && (
            <div id="notice-workbench-error" className="bg-rose-50 border-b border-rose-200 px-5 py-2 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {!artifacts || totalArtifactsCount === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 text-neutral-400">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500 mb-3">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-neutral-900">No Action Artifacts Generated Yet</h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm leading-relaxed">
                  Transform your reflections into ready-to-send emails, technical specs with syntax highlighting, downloadable .ics calendar blocks, and an interactive task DAG.
                </p>
                <button
                  id="btn-trigger-initial-artifacts"
                  onClick={() => handleGenerateArtifacts()}
                  disabled={isGenerating}
                  className="mt-4 flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-800 transition-colors"
                >
                  <Sparkles className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Synthesizing Artifacts...' : 'Synthesize Execution Artifacts'}</span>
                </button>
              </div>
            ) : (
              <>
                {/* 1. EMAIL DRAFTS */}
                {(selectedCategory === 'all' || selectedCategory === 'emails') &&
                  artifacts.email_drafts &&
                  artifacts.email_drafts.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-neutral-600" />
                          <span>Email Drafts ({artifacts.email_drafts.length})</span>
                        </h4>
                      </div>

                      <div className="space-y-3">
                        {artifacts.email_drafts.map((email, idx) => {
                          const emailKey = `email-${idx}`;
                          const isCopied = copiedId === emailKey;
                          const mailtoHref = `mailto:?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;

                          return (
                            <div
                              key={idx}
                              id={`email-draft-card-${idx}`}
                              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-neutral-900">
                                    To: <span className="font-normal text-neutral-600">{email.recipient_role}</span>
                                  </span>
                                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700 capitalize border border-neutral-200">
                                    {email.tone}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    id={`btn-copy-email-${idx}`}
                                    onClick={() => handleCopy(`Subject: ${email.subject}\n\n${email.body}`, emailKey, 'Email draft copied!')}
                                    className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
                                  >
                                    {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                                  </button>

                                  <a
                                    id={`btn-mailto-email-${idx}`}
                                    href={mailtoHref}
                                    className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
                                  >
                                    <Send className="h-3 w-3" />
                                    <span>Open Mail</span>
                                  </a>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                                  Subject
                                </label>
                                <input
                                  type="text"
                                  value={email.subject}
                                  onChange={(e) => handleEmailFieldChange(idx, 'subject', e.target.value)}
                                  className="w-full rounded-md border border-neutral-200 bg-neutral-50/60 px-2.5 py-1.5 text-xs text-neutral-900 font-medium focus:outline-none focus:border-neutral-400"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block mb-1">
                                  Body
                                </label>
                                <textarea
                                  rows={4}
                                  value={email.body}
                                  onChange={(e) => handleEmailFieldChange(idx, 'body', e.target.value)}
                                  className="w-full resize-y rounded-md border border-neutral-200 bg-neutral-50/60 px-2.5 py-2 text-xs text-neutral-800 leading-relaxed font-sans focus:outline-none focus:border-neutral-400"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                {/* 2. TECHNICAL SPECS & CODE */}
                {(selectedCategory === 'all' || selectedCategory === 'code') &&
                  artifacts.code_or_tech_specs &&
                  artifacts.code_or_tech_specs.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                          <Code2 className="h-3.5 w-3.5 text-neutral-600" />
                          <span>Code & Technical Specs ({artifacts.code_or_tech_specs.length})</span>
                        </h4>
                      </div>

                      <div className="space-y-3">
                        {artifacts.code_or_tech_specs.map((spec, idx) => {
                          const specKey = `spec-${idx}`;
                          const isCopied = copiedId === specKey;

                          return (
                            <div
                              key={idx}
                              id={`tech-spec-card-${idx}`}
                              className="rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-xs"
                            >
                              <div className="flex items-center justify-between bg-neutral-50/90 border-b border-neutral-200 px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <FileCode className="h-3.5 w-3.5 text-neutral-700" />
                                  <span className="text-xs font-semibold text-neutral-900">{spec.title}</span>
                                  <span className="rounded bg-neutral-200 px-1.5 py-0.2 text-[10px] font-mono text-neutral-700 uppercase">
                                    {spec.language}
                                  </span>
                                </div>

                                <button
                                  id={`btn-copy-code-${idx}`}
                                  onClick={() => handleCopy(spec.snippet, specKey, 'Code snippet copied!')}
                                  className="flex items-center gap-1 rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
                                >
                                  {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                  <span>{isCopied ? 'Copied' : 'Copy Code'}</span>
                                </button>
                              </div>

                              {/* Code Block */}
                              <div className="bg-neutral-900 p-3.5 overflow-x-auto text-xs font-mono text-neutral-100 leading-relaxed">
                                <pre>
                                  <code>{spec.snippet}</code>
                                </pre>
                              </div>

                              {/* Explanation */}
                              {spec.explanation && (
                                <div className="p-3 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-600 leading-relaxed">
                                  <span className="font-semibold text-neutral-800">Context: </span>
                                  {spec.explanation}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                {/* 3. CALENDAR TIME-BLOCKS */}
                {(selectedCategory === 'all' || selectedCategory === 'calendar') &&
                  artifacts.calendar_blocks &&
                  artifacts.calendar_blocks.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-neutral-600" />
                          <span>Calendar Time-Blocks ({artifacts.calendar_blocks.length})</span>
                        </h4>
                      </div>

                      <div className="space-y-2.5">
                        {artifacts.calendar_blocks.map((block, idx) => {
                          const gcalUrl = getGoogleCalendarUrl(block);

                          return (
                            <div
                              key={idx}
                              id={`calendar-block-card-${idx}`}
                              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="text-xs sm:text-sm font-semibold text-neutral-900">
                                    {block.event_title}
                                  </h5>
                                  <span className="flex items-center gap-1 rounded bg-neutral-100 border border-neutral-200 px-1.5 py-0.2 text-[11px] font-medium text-neutral-700">
                                    <Clock className="h-3 w-3 text-neutral-500" />
                                    {block.duration_minutes}m
                                  </span>
                                </div>
                                <p className="text-xs text-neutral-600 leading-relaxed">
                                  {block.agenda}
                                </p>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  id={`btn-download-ics-${idx}`}
                                  onClick={() => {
                                    downloadIcsFile(block);
                                    setFeedbackNotice('Downloaded .ics calendar file!');
                                    setTimeout(() => setFeedbackNotice(null), 2500);
                                  }}
                                  className="flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-100 transition-colors"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                  <span>.ics File</span>
                                </button>

                                <a
                                  id={`btn-gcal-link-${idx}`}
                                  href={gcalUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  <span>Google Cal</span>
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                {/* 4. ACTION DAG CHECKLIST & INTERACTIVE VISUALIZER */}
                {(selectedCategory === 'all' || selectedCategory === 'dag') &&
                  artifacts.action_dag &&
                  artifacts.action_dag.length > 0 && (
                    <section className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                            <ListOrdered className="h-3.5 w-3.5 text-neutral-600" />
                            <span>Action DAG Engine ({completedDagTasks}/{dagTasks.length})</span>
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Toggle View Mode */}
                          <div className="flex rounded-md border border-neutral-200 bg-neutral-100 p-0.5 text-xs">
                            <button
                              id="btn-switch-dag-visual"
                              onClick={() => setDagDisplayMode('visual')}
                              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                dagDisplayMode === 'visual'
                                  ? 'bg-white text-neutral-900 shadow-xs'
                                  : 'text-neutral-500 hover:text-neutral-900'
                              }`}
                            >
                              <GitBranch className="h-3 w-3" />
                              <span>Visual Flow</span>
                            </button>
                            <button
                              id="btn-switch-dag-list"
                              onClick={() => setDagDisplayMode('list')}
                              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                dagDisplayMode === 'list'
                                  ? 'bg-white text-neutral-900 shadow-xs'
                                  : 'text-neutral-500 hover:text-neutral-900'
                              }`}
                            >
                              <List className="h-3 w-3" />
                              <span>Checklist</span>
                            </button>
                          </div>

                          <span className="text-xs font-semibold text-neutral-900">
                            {dagPercent}% Done
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-neutral-900 transition-all duration-300"
                          style={{ width: `${dagPercent}%` }}
                        />
                      </div>

                      {/* VISUAL FLOW / TIMELINE MODE */}
                      {dagDisplayMode === 'visual' ? (
                        <DagVisualizer
                          tasks={artifacts.action_dag}
                          onToggleTask={handleToggleDagTask}
                        />
                      ) : (
                        /* STANDARD CHECKLIST MODE */
                        <div className="space-y-2">
                          {artifacts.action_dag.map((dagTask) => {
                            const priorityBadge: Record<PriorityType, string> = {
                              high: 'border-rose-200 bg-rose-50 text-rose-800 font-semibold',
                              medium: 'border-neutral-200 bg-neutral-50 text-neutral-700',
                              low: 'border-neutral-200 bg-neutral-50 text-neutral-500',
                            };

                            return (
                              <div
                                key={dagTask.id}
                                id={`dag-task-${dagTask.id}`}
                                onClick={() => handleToggleDagTask(dagTask.id)}
                                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                                  dagTask.completed
                                    ? 'border-neutral-200 bg-neutral-50/60 opacity-60'
                                    : 'border-neutral-200 bg-white hover:border-neutral-300 shadow-xs'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={dagTask.completed}
                                  onChange={() => {}} // Handled by card onClick
                                  className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-0"
                                />

                                <div className="flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-mono uppercase text-neutral-400">
                                      {dagTask.id}
                                    </span>
                                    <span
                                      className={`rounded px-1.5 py-0.2 text-[10px] uppercase tracking-wide border ${
                                        priorityBadge[dagTask.priority] || priorityBadge.medium
                                      }`}
                                    >
                                      {dagTask.priority}
                                    </span>
                                    <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                                      <Clock className="h-3 w-3" />
                                      {dagTask.estimated_minutes}m
                                    </span>
                                  </div>

                                  <p
                                    className={`text-xs sm:text-sm ${
                                      dagTask.completed ? 'line-through text-neutral-400' : 'text-neutral-900 font-medium'
                                    }`}
                                  >
                                    {dagTask.task}
                                  </p>

                                  {dagTask.depends_on && dagTask.depends_on.length > 0 && (
                                    <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                                      <span>Depends on:</span>
                                      {dagTask.depends_on.map((dep) => (
                                        <span key={dep} className="rounded bg-neutral-100 px-1 font-mono text-neutral-600">
                                          {dep}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
