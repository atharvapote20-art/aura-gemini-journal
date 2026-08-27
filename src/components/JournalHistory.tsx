/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Calendar,
  Sparkles,
  BookOpen,
  CheckCircle2,
  ListTodo,
  Tag,
  Trash2,
  ArrowUpRight,
  Star,
  Download,
  Copy,
  Layers,
  Flame,
} from 'lucide-react';
import { JournalEntry, SentimentType } from '../types';

interface JournalHistoryProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (id: string) => Promise<void>;
  onToggleFavorite: (entry: JournalEntry) => Promise<void>;
  onNewEntry: () => void;
}

export const JournalHistory: React.FC<JournalHistoryProps> = ({
  entries,
  onSelectEntry,
  onDeleteEntry,
  onToggleFavorite,
  onNewEntry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSentiment, setSelectedSentiment] = useState<SentimentType | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string | 'all'>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    entries.forEach((e) => e.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet);
  }, [entries]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      // Search
      const matchesSearch =
        searchQuery === '' ||
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (entry.summary && entry.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
        entry.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      // Sentiment filter
      const matchesSentiment = selectedSentiment === 'all' || entry.sentiment === selectedSentiment;

      // Tag filter
      const matchesTag = selectedTag === 'all' || entry.tags.includes(selectedTag);

      // Favorite filter
      const matchesFavorite = !favoritesOnly || entry.isFavorite;

      return matchesSearch && matchesSentiment && matchesTag && matchesFavorite;
    });
  }, [entries, searchQuery, selectedSentiment, selectedTag, favoritesOnly]);

  // Aggregate Stats
  const totalEntries = entries.length;
  const totalActionItems = entries.reduce((acc, e) => acc + (e.actionItems?.length || 0), 0);
  const completedActionItems = entries.reduce(
    (acc, e) => acc + (e.actionItems?.filter((a) => a.completed).length || 0),
    0
  );

  const handleCopy = (entry: JournalEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const md = `# ${entry.title || 'Untitled'}\n\n${entry.content}\n\n${
      entry.summary ? `Summary: ${entry.summary}` : ''
    }`;
    navigator.clipboard.writeText(md);
    setCopiedId(entry.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sentimentBadgeColors: Record<SentimentType, { bg: string; text: string; icon: string }> = {
    energized: { bg: 'bg-neutral-100 text-neutral-800 border-neutral-200', text: 'text-neutral-800', icon: '⚡' },
    reflective: { bg: 'bg-neutral-100 text-neutral-800 border-neutral-200', text: 'text-neutral-800', icon: '🔮' },
    focused: { bg: 'bg-neutral-100 text-neutral-800 border-neutral-200', text: 'text-neutral-800', icon: '🎯' },
    stressed: { bg: 'bg-neutral-100 text-neutral-800 border-neutral-200', text: 'text-neutral-800', icon: '🌊' },
    calm: { bg: 'bg-neutral-100 text-neutral-800 border-neutral-200', text: 'text-neutral-800', icon: '🍃' },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header & Stats Banner */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900">Reflection Archive</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            All private entries and Gemini syntheses, isolated securely in Cloud Firestore.
          </p>
        </div>

        {/* Stats Strip */}
        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-neutral-200 shadow-xs">
          <div className="text-left pr-3 border-r border-neutral-100">
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Reflections</p>
            <p className="text-sm font-semibold text-neutral-900">{totalEntries}</p>
          </div>
          <div className="text-left pr-3 border-r border-neutral-100">
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Actions Done</p>
            <p className="text-sm font-semibold text-neutral-900">
              {completedActionItems}/{totalActionItems}
            </p>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wider">Dialogues</p>
            <p className="text-sm font-semibold text-neutral-900">
              {entries.reduce((acc, e) => acc + (e.messages?.length || 0), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
            <input
              id="input-history-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reflections, insights, tags..."
              className="w-full rounded-lg border border-neutral-200 bg-white pl-8 pr-3 py-2 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
            />
          </div>

          {/* Action button: New entry */}
          <button
            id="btn-history-new-entry"
            onClick={onNewEntry}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-800 whitespace-nowrap self-stretch sm:self-auto justify-center"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Write New Reflection</span>
          </button>
        </div>

        {/* Sentiment & Tag Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-neutral-100 text-xs">
          <span className="text-neutral-400 font-medium flex items-center gap-1">
            <Filter className="h-3 w-3" /> Sentiment:
          </span>
          {(['all', 'energized', 'reflective', 'focused', 'stressed', 'calm'] as const).map((sent) => (
            <button
              key={sent}
              onClick={() => setSelectedSentiment(sent)}
              className={`rounded-md px-2 py-0.5 capitalize text-xs transition-colors ${
                selectedSentiment === sent
                  ? 'bg-neutral-900 text-white font-medium'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70'
              }`}
            >
              {sent}
            </button>
          ))}

          <span className="text-neutral-300 ml-1">|</span>

          <button
            onClick={() => setFavoritesOnly(!favoritesOnly)}
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs transition-colors ${
              favoritesOnly
                ? 'bg-neutral-900 text-white font-medium'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70'
            }`}
          >
            <Star className={`h-3 w-3 ${favoritesOnly ? 'fill-white text-white' : 'text-neutral-400'}`} />
            <span>Favorites</span>
          </button>

          {allTags.length > 0 && (
            <>
              <span className="text-neutral-300 ml-1">|</span>
              <span className="text-neutral-400 font-medium">Tag:</span>
              <button
                onClick={() => setSelectedTag('all')}
                className={`rounded-md px-2 py-0.5 text-xs ${
                  selectedTag === 'all' ? 'bg-neutral-900 text-white font-medium' : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                All
              </button>
              {allTags.slice(0, 8).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`rounded-md px-2 py-0.5 text-xs ${
                    selectedTag === tag ? 'bg-neutral-900 text-white font-medium' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/70'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Grid of Journal Entries */}
      {filteredEntries.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-12 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-neutral-300 mb-2" />
          <h3 className="text-sm font-semibold text-neutral-900">No reflections found</h3>
          <p className="mt-1 text-xs text-neutral-500 max-w-sm mx-auto">
            {searchQuery || selectedSentiment !== 'all' || selectedTag !== 'all' || favoritesOnly
              ? 'Try adjusting your search query or filters.'
              : 'Begin by writing your first stream-of-consciousness reflection with Gemini.'}
          </p>
          <button
            onClick={onNewEntry}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-neutral-800"
          >
            Create First Entry
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntries.map((entry) => {
            const hasActions = entry.actionItems && entry.actionItems.length > 0;
            const completedCount = entry.actionItems?.filter((a) => a.completed).length || 0;
            const totalCount = entry.actionItems?.length || 0;

            return (
              <div
                key={entry.id}
                id={`history-card-${entry.id}`}
                onClick={() => onSelectEntry(entry)}
                className="group relative flex flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 shadow-xs transition-colors hover:border-neutral-300 hover:bg-neutral-50/50 cursor-pointer"
              >
                <div>
                  {/* Top Metadata */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {new Date(entry.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {entry.sentiment && (
                        <span
                          className={`rounded border px-1.5 py-0.2 text-[10px] capitalize ${
                            sentimentBadgeColors[entry.sentiment]?.bg || 'bg-neutral-100 text-neutral-700 border-neutral-200'
                          }`}
                        >
                          {sentimentBadgeColors[entry.sentiment]?.icon} {entry.sentiment}
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(entry);
                        }}
                        title={entry.isFavorite ? 'Remove Favorite' : 'Mark as Favorite'}
                        className="p-0.5 text-neutral-300 hover:text-neutral-800 transition-colors"
                      >
                        <Star className={`h-3.5 w-3.5 ${entry.isFavorite ? 'fill-neutral-900 text-neutral-900' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm sm:text-base font-semibold text-neutral-900 group-hover:text-neutral-950 transition-colors line-clamp-1">
                    {entry.title || 'Untitled Reflection'}
                  </h3>

                  {/* Executive Summary Snippet or Content */}
                  <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed line-clamp-3">
                    {entry.summary || entry.content || 'No content written yet.'}
                  </p>

                  {/* Action Items Progress if available */}
                  {hasActions && (
                    <div className="mt-3 rounded-lg bg-neutral-50 border border-neutral-100 p-2">
                      <div className="flex items-center justify-between text-[11px] font-medium text-neutral-700 mb-1">
                        <span className="flex items-center gap-1">
                          <ListTodo className="h-3 w-3 text-neutral-600" /> Action Items
                        </span>
                        <span>
                          {completedCount}/{totalCount} Done
                        </span>
                      </div>
                      <div className="h-1 w-full bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-neutral-900 transition-all"
                          style={{
                            width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Dialogue count indicator */}
                  {entry.messages && entry.messages.length > 0 && (
                    <div className="mt-2.5 inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-600 font-normal">
                      <Sparkles className="h-3 w-3 text-neutral-800" />
                      <span>{entry.messages.length} dialogue messages</span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Tags & Quick actions */}
                <div className="mt-4 border-t border-neutral-100 pt-3 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {entry.tags?.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] text-neutral-500 bg-neutral-100 px-1.5 py-0.5 rounded border border-neutral-200/60">
                        #{tag}
                      </span>
                    ))}
                    {entry.tags?.length > 3 && (
                      <span className="text-[10px] text-neutral-400">+{entry.tags.length - 3}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleCopy(entry, e)}
                      title="Copy Markdown"
                      className="p-1 text-neutral-400 hover:text-neutral-700 transition-colors"
                    >
                      {copiedId === entry.id ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-neutral-900" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteEntry(entry.id);
                      }}
                      title="Delete Entry"
                      className="p-1 text-neutral-300 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <span className="text-xs font-semibold text-neutral-900 group-hover:translate-x-0.5 transition-transform flex items-center ml-1">
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
