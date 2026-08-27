/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  ListTodo,
  Tag,
  Lightbulb,
  Heart,
  Copy,
  Download,
  Share2,
  Trash2,
  RefreshCw,
  Zap,
  HelpCircle,
} from 'lucide-react';
import { JournalEntry, ChatMessage, ActionItem, SentimentType, PriorityType, JournalSynthesis } from '../types';
import { maskPII } from '../lib/sanitizer';
import { ActionWorkbenchDrawer } from './ActionWorkbenchDrawer';

interface JournalEditorProps {
  entry: JournalEntry;
  onSave: (entry: JournalEntry) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  isSaving: boolean;
  saveError: string | null;
  onClearSaveError: () => void;
}

const INSPIRATION_PROMPTS = [
  {
    title: '🌅 Morning Intention',
    text: 'What is the single most meaningful outcome I want to create today? How do I want to show up mentally?',
  },
  {
    title: '⚖️ Decision Matrix',
    text: 'I am evaluating a choice between... What are the second-order consequences of each option, and what is my biggest fear?',
  },
  {
    title: '🧠 Problem Solving',
    text: 'The persistent bottleneck I am facing is... What assumptions am I making that might not actually be true?',
  },
  {
    title: '🌱 Wins & Gratitude',
    text: 'What 3 moments this week gave me true energy? Who supported me, and how can I double down on what works?',
  },
];

const SUGGESTED_QUESTIONS = [
  'Help me identify blind spots in my thinking',
  'What are 3 practical action steps I can take next?',
  'Challenge my assumptions gently',
  'Summarize the core psychological themes here',
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  entry,
  onSave,
  onDelete,
  isSaving,
  saveError,
  onClearSaveError,
}) => {
  const [currentEntry, setCurrentEntry] = useState<JournalEntry>(entry);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dialogue' | 'synthesis'>('dialogue');
  const [newTagInput, setNewTagInput] = useState('');
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Sync state when incoming entry changes (e.g. switching entries from history)
  useEffect(() => {
    setCurrentEntry(entry);
    setAiError(null);
  }, [entry.id]);

  // Scroll chat to bottom when messages update
  useEffect(() => {
    if (activeTab === 'dialogue') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentEntry.messages, isAiThinking, activeTab]);

  // Word count & read time calculations
  const wordCount = currentEntry.content.trim() ? currentEntry.content.trim().split(/\s+/).length : 0;
  const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  // Handle local text edits
  const handleContentChange = (content: string) => {
    setCurrentEntry((prev) => ({ ...prev, content }));
  };

  const handleTitleChange = (title: string) => {
    setCurrentEntry((prev) => ({ ...prev, title }));
  };

  // Insert prompt template into content
  const handleInsertPrompt = (promptText: string) => {
    setCurrentEntry((prev) => ({
      ...prev,
      content: prev.content ? `${prev.content}\n\n${promptText}\n` : `${promptText}\n`,
    }));
  };

  // Manual Save Trigger
  const handleManualSave = async () => {
    onClearSaveError();
    try {
      await onSave(currentEntry);
      setSaveSuccessMessage('Saved to Cloud Firestore');
      setTimeout(() => setSaveSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed manual save:', err);
    }
  };

  // Send message to Gemini for multi-turn dialogue
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = customPrompt || chatInput;
    if (!textToSend.trim() || isAiThinking) return;

    setAiError(null);
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      role: 'user',
      content: textToSend.trim(),
      timestamp: Date.now(),
    };

    const updatedMessages = [...currentEntry.messages, userMsg];
    const updatedEntryWithUserMsg = { ...currentEntry, messages: updatedMessages };
    setCurrentEntry(updatedEntryWithUserMsg);
    setChatInput('');
    setIsAiThinking(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          contextPrompt: currentEntry.content,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to receive reflection from Gemini');
      }

      const aiMsg: ChatMessage = {
        id: 'msg-ai-' + Date.now(),
        role: 'assistant',
        content: data.reply,
        timestamp: Date.now(),
        modelUsed: data.modelUsed,
      };

      const finalEntry = {
        ...updatedEntryWithUserMsg,
        messages: [...updatedMessages, aiMsg],
      };

      setCurrentEntry(finalEntry);
      // Auto-save updated dialogue to Firestore
      await onSave(finalEntry);
    } catch (err: any) {
      console.error('Gemini chat error:', err);
      setAiError(err.message || 'Error communicating with Gemini.');
    } finally {
      setIsAiThinking(false);
    }
  };

  // Trigger Structured Synthesis with Gemini (Directive 8)
  const handleSynthesize = async () => {
    if (!currentEntry.content.trim() && currentEntry.messages.length === 0) {
      setAiError('Please write some journal content or chat before synthesizing.');
      return;
    }

    setIsSynthesizing(true);
    setAiError(null);

    try {
      const response = await fetch('/api/gemini/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: currentEntry.content,
          messages: currentEntry.messages,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to synthesize journal entry');
      }

      const synthesis: JournalSynthesis = data.synthesis;

      // Transform action items into state format with unique IDs and completion flags
      const formattedActionItems: ActionItem[] = (synthesis.action_items || []).map((item, idx) => ({
        id: 'act-' + Date.now() + '-' + idx,
        task: item.task,
        priority: item.priority || 'medium',
        completed: false,
      }));

      const updatedEntry: JournalEntry = {
        ...currentEntry,
        title: currentEntry.title === 'Untitled Reflection' || !currentEntry.title ? synthesis.title : currentEntry.title,
        summary: synthesis.summary,
        keyTakeaways: synthesis.key_takeaways,
        actionItems: formattedActionItems,
        sentiment: synthesis.sentiment,
        tags: Array.from(new Set([...(currentEntry.tags || []), ...(synthesis.tags || [])])),
      };

      setCurrentEntry(updatedEntry);
      setActiveTab('synthesis');
      await onSave(updatedEntry);

      setSaveSuccessMessage('Structured Synthesis extracted & synced!');
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    } catch (err: any) {
      console.error('Synthesis error:', err);
      setAiError(err.message || 'Failed to synthesize reflection.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Toggle Action Item completion
  const handleToggleActionItem = async (itemId: string) => {
    if (!currentEntry.actionItems) return;
    const updatedActionItems = currentEntry.actionItems.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    const updated = { ...currentEntry, actionItems: updatedActionItems };
    setCurrentEntry(updated);
    await onSave(updated);
  };

  // Add custom tag
  const handleAddTag = () => {
    if (!newTagInput.trim()) return;
    const cleanTag = newTagInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (cleanTag && !currentEntry.tags.includes(cleanTag)) {
      const updated = { ...currentEntry, tags: [...currentEntry.tags, cleanTag] };
      setCurrentEntry(updated);
      setNewTagInput('');
      onSave(updated);
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    const updated = {
      ...currentEntry,
      tags: currentEntry.tags.filter((t) => t !== tagToRemove),
    };
    setCurrentEntry(updated);
    onSave(updated);
  };

  // Copy Markdown format to clipboard
  const handleCopyMarkdown = () => {
    const md = `# ${currentEntry.title || 'Untitled Reflection'}
Date: ${new Date(currentEntry.createdAt).toLocaleDateString()}
Sentiment: ${currentEntry.sentiment || 'N/A'}
Tags: ${currentEntry.tags.join(', ')}

## Content
${currentEntry.content}

${
  currentEntry.summary
    ? `## Executive Summary
${currentEntry.summary}

## Key Takeaways
${currentEntry.keyTakeaways?.map((k) => `- ${k}`).join('\n')}

## Action Items
${currentEntry.actionItems?.map((a) => `- [${a.completed ? 'x' : ' '}] (${a.priority.toUpperCase()}) ${a.task}`).join('\n')}
`
    : ''
}
`;
    navigator.clipboard.writeText(md);
    setSaveSuccessMessage('Copied Markdown to clipboard!');
    setTimeout(() => setSaveSuccessMessage(null), 2500);
  };

  // Export JSON file
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentEntry, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `journal-entry-${currentEntry.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Sentiment visual badge mapping - Clean Minimalist style
  const sentimentBadgeColors: Record<SentimentType, { bg: string; text: string; border: string; icon: string }> = {
    energized: { bg: 'bg-neutral-100', text: 'text-neutral-800', border: 'border-neutral-200', icon: '⚡' },
    reflective: { bg: 'bg-neutral-100', text: 'text-neutral-800', border: 'border-neutral-200', icon: '🔮' },
    focused: { bg: 'bg-neutral-100', text: 'text-neutral-800', border: 'border-neutral-200', icon: '🎯' },
    stressed: { bg: 'bg-neutral-100', text: 'text-neutral-800', border: 'border-neutral-200', icon: '🌊' },
    calm: { bg: 'bg-neutral-100', text: 'text-neutral-800', border: 'border-neutral-200', icon: '🍃' },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Top Action Bar & Persistence Status */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <input
            id="journal-title-input"
            type="text"
            value={currentEntry.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Untitled Reflection..."
            className="w-full max-w-xl text-2xl sm:text-3xl font-semibold tracking-tight text-neutral-900 placeholder:text-neutral-300 focus:outline-none bg-transparent"
          />
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-neutral-400" />
              {new Date(currentEntry.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span>•</span>
            <span>{wordCount} words</span>
            <span>•</span>
            <span>{readTimeMinutes} min read</span>
            {currentEntry.sentiment && (
              <>
                <span>•</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-normal capitalize ${
                    sentimentBadgeColors[currentEntry.sentiment]?.bg || 'bg-neutral-100'
                  } ${sentimentBadgeColors[currentEntry.sentiment]?.text || 'text-neutral-800'} ${
                    sentimentBadgeColors[currentEntry.sentiment]?.border || 'border-neutral-200'
                  }`}
                >
                  <span>{sentimentBadgeColors[currentEntry.sentiment]?.icon}</span>
                  <span>{currentEntry.sentiment}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Action Workbench Trigger Button */}
          <button
            id="btn-open-action-workbench"
            onClick={() => setIsWorkbenchOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-900 bg-neutral-900 px-3.5 py-2 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-neutral-800"
          >
            <Zap className="h-3.5 w-3.5 text-amber-300" />
            <span>Open Action Workbench</span>
            {currentEntry.artifacts && (
              <span className="ml-1 rounded bg-neutral-700 px-1.5 py-0.2 text-[10px] font-mono text-neutral-200">
                {(currentEntry.artifacts.email_drafts?.length || 0) +
                  (currentEntry.artifacts.code_or_tech_specs?.length || 0) +
                  (currentEntry.artifacts.calendar_blocks?.length || 0) +
                  (currentEntry.artifacts.action_dag?.length || 0)}
              </span>
            )}
          </button>

          {/* Synthesize Button */}
          <button
            id="btn-synthesize-gemini"
            onClick={handleSynthesize}
            disabled={isSynthesizing || isSaving}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            <Sparkles className={`h-3.5 w-3.5 ${isSynthesizing ? 'animate-spin' : 'text-neutral-500'}`} />
            <span>{isSynthesizing ? 'Synthesizing...' : 'Synthesize with Gemini'}</span>
          </button>

          {/* Manual Save */}
          <button
            id="btn-save-firestore"
            onClick={handleManualSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
          >
            <Save className={`h-3.5 w-3.5 ${isSaving ? 'animate-pulse text-neutral-900' : 'text-neutral-500'}`} />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>

          {/* Markdown & Export */}
          <button
            id="btn-copy-markdown"
            onClick={handleCopyMarkdown}
            title="Copy as Markdown"
            className="rounded-lg border border-neutral-200 bg-white p-2 text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>

          <button
            id="btn-export-json"
            onClick={handleExportJSON}
            title="Download JSON"
            className="rounded-lg border border-neutral-200 bg-white p-2 text-neutral-600 transition-colors hover:bg-neutral-50"
          >
            <Download className="h-3.5 w-3.5" />
          </button>

          {onDelete && (
            <button
              id="btn-delete-entry"
              onClick={() => onDelete(currentEntry.id)}
              title="Delete Reflection"
              className="rounded-lg border border-neutral-200 bg-white p-2 text-neutral-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessMessage && (
        <div id="save-success-banner" className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Error & Retry Banner */}
      {(saveError || aiError) && (
        <div id="save-error-banner" className="mb-4 flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
            <span>{saveError || aiError}</span>
          </div>
          {saveError && (
            <button
              id="btn-retry-save"
              onClick={handleManualSave}
              className="flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-700"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Retry Save</span>
            </button>
          )}
        </div>
      )}

      {/* Main Grid: Left Canvas & Right AI Dialogue / Synthesis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Writing Canvas */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          {/* Inspiration Starters Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-neutral-400 font-medium whitespace-nowrap">Prompts:</span>
            {INSPIRATION_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                id={`btn-prompt-starter-${idx}`}
                onClick={() => handleInsertPrompt(p.text)}
                className="whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
              >
                {p.title}
              </button>
            ))}
          </div>

          {/* Main Journal Canvas Textarea */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-6 shadow-xs">
            <textarea
              id="journal-content-textarea"
              value={currentEntry.content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="What is on your mind today? Write your thoughts, decisions, or raw reflections..."
              rows={16}
              className="w-full resize-none font-sans text-neutral-800 placeholder:text-neutral-300 focus:outline-none text-sm sm:text-base leading-relaxed bg-transparent"
            />

            {/* Bottom Tag Manager inside Canvas */}
            <div className="mt-4 border-t border-neutral-100 pt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-neutral-400 flex items-center gap-1">
                <Tag className="h-3 w-3" /> Tags:
              </span>
              {currentEntry.tags?.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 font-normal border border-neutral-200/60"
                >
                  #{tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="text-neutral-400 hover:text-neutral-800 ml-0.5 text-xs"
                  >
                    ×
                  </button>
                </span>
              ))}
              <div className="inline-flex items-center gap-1">
                <input
                  id="input-add-tag"
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  placeholder="+ tag"
                  className="w-16 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-xs text-neutral-700 focus:outline-none focus:border-neutral-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Gemini Partner & Structured Synthesis */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          {/* Tab Selector */}
          <div className="flex rounded-lg bg-neutral-200/80 p-0.5">
            <button
              id="tab-btn-dialogue"
              onClick={() => setActiveTab('dialogue')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'dialogue'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Dialogue ({currentEntry.messages.length})
            </button>
            <button
              id="tab-btn-synthesis"
              onClick={() => setActiveTab('synthesis')}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
                activeTab === 'synthesis'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Synthesis {currentEntry.summary ? '✓' : ''}
            </button>
          </div>

          {/* TAB 1: Conversational Thought Partner */}
          {activeTab === 'dialogue' && (
            <div className="flex flex-col rounded-xl border border-neutral-200 bg-white shadow-xs overflow-hidden h-[580px]">
              {/* Chat Header */}
              <div className="border-b border-neutral-100 bg-neutral-50/70 px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-neutral-900 text-white">
                    <Sparkles className="h-3 w-3" />
                  </div>
                  <span className="text-xs font-medium text-neutral-900">Aura</span>
                  <span className="rounded bg-neutral-200/70 px-1.5 py-0.2 text-[10px] font-mono text-neutral-600">
                    gemini-3.6-flash
                  </span>
                </div>
                <span className="text-[11px] text-neutral-400">Context-Aware</span>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {currentEntry.messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6 text-neutral-400">
                    <Lightbulb className="h-6 w-6 text-neutral-400 mb-2" />
                    <p className="text-xs font-medium text-neutral-800">Conversational Reflection</p>
                    <p className="text-xs text-neutral-500 mt-1 max-w-xs leading-relaxed">
                      Ask Aura to challenge assumptions, explore alternatives, or reflect on themes in your writing.
                    </p>

                    <div className="mt-4 flex flex-col gap-1.5 w-full">
                      {SUGGESTED_QUESTIONS.map((q, idx) => (
                        <button
                          key={idx}
                          id={`btn-suggested-query-${idx}`}
                          onClick={() => handleSendMessage(q)}
                          className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 text-left transition-colors"
                        >
                          "{q}"
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  currentEntry.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[90%] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-neutral-900 text-white rounded-br-none'
                            : 'bg-neutral-50 text-neutral-900 border border-neutral-200 rounded-bl-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      <span className="mt-1 text-[10px] text-neutral-400 px-1">
                        {msg.role === 'user' ? 'You' : `Aura (${msg.modelUsed || 'Gemini'})`} •{' '}
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}

                {isAiThinking && (
                  <div className="flex items-center gap-2 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 p-2.5 rounded-lg w-fit">
                    <Sparkles className="h-3.5 w-3.5 text-neutral-600 animate-spin" />
                    <span>Aura is reflecting...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <div className="border-t border-neutral-100 p-2.5 bg-neutral-50/50">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    id="chat-query-input"
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask for perspective, questions, or ideas..."
                    disabled={isAiThinking}
                    className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 disabled:opacity-50"
                  />
                  <button
                    id="btn-send-chat"
                    type="submit"
                    disabled={!chatInput.trim() || isAiThinking}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: Structured Synthesis Card (Directive 8) */}
          {activeTab === 'synthesis' && (
            <div className="flex flex-col rounded-xl border border-neutral-200 bg-white shadow-xs p-4 sm:p-5 h-[580px] overflow-y-auto space-y-4">
              {!currentEntry.summary ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-neutral-400">
                  <Sparkles className="h-8 w-8 text-neutral-400 mb-2" />
                  <h4 className="text-xs font-semibold text-neutral-900">No Synthesis Generated</h4>
                  <p className="text-xs text-neutral-500 mt-1 max-w-xs leading-relaxed">
                    Generate an executive summary, key takeaways, prioritized action items, and sentiment analysis with Gemini.
                  </p>
                  <button
                    id="btn-trigger-synthesis-card"
                    onClick={handleSynthesize}
                    disabled={isSynthesizing}
                    className="mt-4 rounded-lg bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-800"
                  >
                    {isSynthesizing ? 'Synthesizing...' : 'Run Synthesis'}
                  </button>
                </div>
              ) : (
                <>
                  {/* Executive Summary */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-neutral-600" /> Executive Summary
                    </h4>
                    <p className="rounded-lg bg-neutral-50 border border-neutral-100 p-3 text-xs sm:text-sm text-neutral-800 leading-relaxed">
                      {currentEntry.summary}
                    </p>
                  </div>

                  {/* Key Takeaways */}
                  {currentEntry.keyTakeaways && currentEntry.keyTakeaways.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5 flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-neutral-600" /> Key Insights
                      </h4>
                      <ul className="space-y-1">
                        {currentEntry.keyTakeaways.map((takeaway, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2 text-xs sm:text-sm text-neutral-700 bg-neutral-50 p-2 rounded-md border border-neutral-100"
                          >
                            <span className="text-neutral-400 font-bold">•</span>
                            <span>{takeaway}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Items List with Toggleable Checkboxes */}
                  {currentEntry.actionItems && currentEntry.actionItems.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5 flex items-center gap-1.5">
                        <ListTodo className="h-3.5 w-3.5 text-neutral-600" /> Action Items ({currentEntry.actionItems.filter((a) => a.completed).length}/{currentEntry.actionItems.length})
                      </h4>
                      <div className="space-y-1.5">
                        {currentEntry.actionItems.map((item) => {
                          const priorityColors: Record<PriorityType, string> = {
                            high: 'bg-neutral-100 text-neutral-900 border-neutral-300 font-semibold',
                            medium: 'bg-neutral-100 text-neutral-700 border-neutral-200',
                            low: 'bg-neutral-100 text-neutral-500 border-neutral-200',
                          };

                          return (
                            <div
                              key={item.id}
                              id={`action-item-${item.id}`}
                              onClick={() => handleToggleActionItem(item.id)}
                              className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                                item.completed
                                  ? 'border-neutral-200 bg-neutral-50/60 opacity-50'
                                  : 'border-neutral-200 bg-white hover:border-neutral-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={item.completed}
                                onChange={() => {}} // Handled by parent container click
                                className="mt-0.5 h-3.5 w-3.5 rounded border-neutral-300 text-neutral-900 focus:ring-0"
                              />
                              <div className="flex-1 text-xs sm:text-sm">
                                <span className={item.completed ? 'line-through text-neutral-400' : 'text-neutral-800'}>
                                  {item.task}
                                </span>
                              </div>
                              <span
                                className={`rounded px-1.5 py-0.2 text-[10px] uppercase tracking-wide border ${
                                  priorityColors[item.priority] || priorityColors.medium
                                }`}
                              >
                                {item.priority}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Action Workbench Callout Card */}
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 text-amber-300">
                        <Zap className="h-4 w-4" />
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-neutral-900">
                          Autonomous Action Engine
                        </h5>
                        <p className="text-[11px] text-neutral-500">
                          {currentEntry.artifacts
                            ? `${(currentEntry.artifacts.email_drafts?.length || 0) + (currentEntry.artifacts.code_or_tech_specs?.length || 0) + (currentEntry.artifacts.calendar_blocks?.length || 0) + (currentEntry.artifacts.action_dag?.length || 0)} execution artifacts ready (emails, code, .ics, DAG).`
                            : 'Synthesize ready-to-execute emails, code specs, calendar blocks, and DAG tasks.'}
                        </p>
                      </div>
                    </div>

                    <button
                      id="btn-open-workbench-from-synthesis"
                      onClick={() => setIsWorkbenchOpen(true)}
                      className="flex items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-800 transition-colors shrink-0"
                    >
                      <Zap className="h-3 w-3 text-amber-300" />
                      <span>{currentEntry.artifacts ? 'View Workbench' : 'Open Workbench'}</span>
                    </button>
                  </div>

                  {/* Sentiment & Tags Card */}
                  <div className="border-t border-neutral-100 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-neutral-400">Sentiment:</span>
                      <span className="font-medium text-neutral-800 capitalize">
                        {currentEntry.sentiment || 'Reflective'}
                      </span>
                    </div>

                    <button
                      id="btn-re-synthesize"
                      onClick={handleSynthesize}
                      disabled={isSynthesizing}
                      className="text-neutral-500 hover:text-neutral-900 text-xs font-medium flex items-center gap-1"
                    >
                      <RefreshCw className={`h-3 w-3 ${isSynthesizing ? 'animate-spin' : ''}`} />
                      <span>Re-analyze</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Action Workbench Drawer (Directive 10) */}
      <ActionWorkbenchDrawer
        isOpen={isWorkbenchOpen}
        onClose={() => setIsWorkbenchOpen(false)}
        entry={currentEntry}
        onUpdateEntry={async (updated) => {
          setCurrentEntry(updated);
          await onSave(updated);
        }}
      />
    </div>
  );
};
