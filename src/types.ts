/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SentimentType = 'energized' | 'reflective' | 'focused' | 'stressed' | 'calm';
export type PriorityType = 'high' | 'medium' | 'low';
export type ArtifactToneType = 'diplomatic' | 'assertive' | 'direct';

export interface EmailDraft {
  id?: string;
  recipient_role: string;
  subject: string;
  body: string;
  tone: ArtifactToneType;
}

export interface CodeTechSpec {
  id?: string;
  title: string;
  language: string;
  snippet: string;
  explanation: string;
}

export interface CalendarBlock {
  id?: string;
  event_title: string;
  duration_minutes: number;
  agenda: string;
}

export interface DagTask {
  id: string;
  task: string;
  priority: PriorityType;
  estimated_minutes: number;
  depends_on: string[];
  completed: boolean;
}

export interface ArtifactsCollection {
  email_drafts: EmailDraft[];
  code_or_tech_specs: CodeTechSpec[];
  calendar_blocks: CalendarBlock[];
  action_dag: DagTask[];
}

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
  artifacts?: ArtifactsCollection;
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
  artifacts?: ArtifactsCollection;
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
