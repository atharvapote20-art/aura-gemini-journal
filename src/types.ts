/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SentimentType = 'energized' | 'reflective' | 'focused' | 'stressed' | 'calm';
export type PriorityType = 'high' | 'medium' | 'low';

export interface ActionItem {
  id: string;
  task: string;
  priority: PriorityType;
  completed: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  modelUsed?: string;
}

export interface JournalSynthesis {
  title: string;
  summary: string;
  key_takeaways: string[];
  action_items: {
    task: string;
    priority: PriorityType;
  }[];
  sentiment: SentimentType;
  tags: string[];
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  messages: ChatMessage[];
  summary?: string;
  keyTakeaways?: string[];
  actionItems?: ActionItem[];
  sentiment?: SentimentType;
  tags: string[];
  isFavorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous?: boolean;
}
