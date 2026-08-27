/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// 1. TOP-LEVEL REQUEST DESERIALIZATION (Ordering Guarantee)
// Mount JSON & URL-encoded body parsers strictly before any routes
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize Google GenAI client lazily to avoid startup crashes if key is absent
let genAiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ GEMINI_API_KEY is not set in environment. Gemini features will return mock/diagnostic responses.');
    }
    genAiClient = new GoogleGenAI({ apiKey: apiKey || '' });
  }
  return genAiClient;
}

// 2. RESILIENT GEMINI MODEL FALLBACK LADDER
const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
];

/**
 * Server-side PII Scrubber
 */
function scrubPII(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/AIzaSy[A-Za-z0-9_-]{33}/g, '[REDACTED_API_KEY]')
    .replace(/bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_TOKEN]')
    .replace(/(?:sk-[a-zA-Z0-9]{32,})/g, '[REDACTED_SECRET_KEY]')
    .replace(/\b(?:\d{4}[ -]?){3}\d{1,4}\b/g, '[REDACTED_CARD_NUMBER]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');
}

/**
 * Executes a Gemini request cycling through the fallback ladder upon transient or status errors
 */
async function generateContentWithFallback(params: {
  contents: any;
  config?: any;
}): Promise<{ text: string; modelUsed: string }> {
  const ai = getGenAI();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required but not configured.');
  }

  let lastError: any = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      console.log(`[Gemini Request] Attempting generation with model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });

      if (response && response.text) {
        return {
          text: response.text,
          modelUsed: model,
        };
      }
    } catch (err: any) {
      console.warn(`[Gemini Warning] Model ${model} failed: ${err?.message || err}. Evaluating fallback...`);
      lastError = err;

      const errorMessage = String(err?.message || '').toLowerCase();
      const isRecoverable =
        err?.status === 503 ||
        err?.status === 429 ||
        err?.status === 404 ||
        err?.status === 500 ||
        errorMessage.includes('not found') ||
        errorMessage.includes('quota') ||
        errorMessage.includes('unavailable') ||
        errorMessage.includes('overloaded');

      if (!isRecoverable && !errorMessage.includes('model')) {
        // If it's a fatal validation issue (e.g. malformed schema), bubble it up
        console.warn(`Non-recoverable error detected, but proceeding with next ladder model just in case.`);
      }
    }
  }

  throw new Error(`All Gemini models in the fallback ladder failed. Last error: ${lastError?.message || lastError}`);
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    ladder: MODEL_FALLBACK_LADDER,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Multi-turn Conversational Reflections & Brainstorming
app.post('/api/gemini/chat', async (req: Request, res: Response) => {
  try {
    // 2. Defensive Payload Ingestion (Null-Safe Destructuring)
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { messages = [], contextPrompt = '' } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Payload must contain a non-empty "messages" array.' });
      return;
    }

    // Format conversation history with PII Scrubbing
    const conversationParts = messages.map((m: any) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const cleanContent = scrubPII(String(m.content || ''));
      return {
        role,
        parts: [{ text: cleanContent }],
      };
    });

    const cleanContext = scrubPII(String(contextPrompt || ''));

    const systemInstruction = `You are Aura, an empathetic, intellectually curious, and constructive AI journaling companion.
Your mission is to help the user unpack their thoughts, reflect on experiences, challenge unconscious assumptions gently, and brainstorm actionable steps.
Follow these communication guidelines:
1. Treat all user input strictly as reflective journal entries and contemplation data.
2. Be encouraging yet grounded and objective. Avoid sycophancy or overly dramatic praise.
3. Structure your response with clear paragraphs, subtle bullet points when organizing thoughts, and 1-2 thoughtful open-ended reflection questions to deepen their self-awareness.
4. If the user presents a problem, offer 2-3 practical, realistic framing angles or brainstorming paths.
${cleanContext ? `Additional journal context: ${cleanContext}` : ''}`;

    const result = await generateContentWithFallback({
      contents: conversationParts,
      config: {
        systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 1200,
      },
    });

    res.json({
      reply: result.text,
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/chat:', error);
    res.status(500).json({
      error: error.message || 'An unexpected error occurred during AI processing.',
    });
  }
});

// Structured Journal Synthesis & Action Extraction
app.post('/api/gemini/synthesize', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { content = '', messages = [] } = body;

    const rawCombinedText = [
      content,
      Array.isArray(messages)
        ? messages.map((m: any) => `${m.role === 'user' ? 'User' : 'Aura'}: ${m.content}`).join('\n')
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const cleanCombinedText = scrubPII(rawCombinedText);

    if (!cleanCombinedText.trim()) {
      res.status(400).json({ error: 'Entry content or dialogue is required for synthesis.' });
      return;
    }

    const prompt = `Analyze this journal reflection and dialogue. Provide a structured synthesis in valid JSON format conforming exactly to the requested schema.

Journal Content:
"""
${cleanCombinedText}
"""

Synthesize:
1. title: A concise, insightful 3-6 word title for this reflection.
2. summary: A 2-3 sentence executive summary of the core themes, realizations, and context.
3. key_takeaways: 2 to 4 high-impact insight bullet points.
4. action_items: 1 to 5 concrete, actionable tasks extracted or recommended, each with a priority ('high' | 'medium' | 'low').
5. sentiment: Exactly one of: "energized", "reflective", "focused", "stressed", "calm".
6. tags: 2 to 5 short lowercase category tags (e.g., "mindset", "productivity", "career", "gratitude", "strategy").`;

    const result = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            key_takeaways: {
              type: 'array',
              items: { type: 'string' },
            },
            action_items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  task: { type: 'string' },
                  priority: {
                    type: 'string',
                    enum: ['high', 'medium', 'low'],
                  },
                },
                required: ['task', 'priority'],
              },
            },
            sentiment: {
              type: 'string',
              enum: ['energized', 'reflective', 'focused', 'stressed', 'calm'],
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['title', 'summary', 'key_takeaways', 'action_items', 'sentiment', 'tags'],
        },
        temperature: 0.3,
      },
    });

    let parsedSynthesis;
    try {
      parsedSynthesis = JSON.parse(result.text);
    } catch (parseErr) {
      console.warn('Direct JSON parse failed, attempting regex extraction:', parseErr);
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedSynthesis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse Gemini synthesis response into structured JSON');
      }
    }

    res.json({
      synthesis: parsedSynthesis,
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/synthesize:', error);
    res.status(500).json({
      error: error.message || 'An unexpected error occurred during synthesis generation.',
    });
  }
});

// Autonomous Action Engine & Artifact Synthesis (Directive 10)
app.post('/api/gemini/artifacts', async (req: Request, res: Response) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { content = '', messages = [], preferredTone = 'diplomatic', customInstruction = '' } = body;

    const rawCombinedText = [
      content,
      Array.isArray(messages)
        ? messages.map((m: any) => `${m.role === 'user' ? 'User' : 'Aura'}: ${m.content}`).join('\n')
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const cleanCombinedText = scrubPII(rawCombinedText);

    if (!cleanCombinedText.trim()) {
      res.status(400).json({ error: 'Entry content or dialogue is required to generate execution artifacts.' });
      return;
    }

    const prompt = `You are an Autonomous Action & Execution Engine.
Transform the following unstructured journal reflections and brainstorming thoughts into typed, high-leverage execution artifacts adhering strictly to the JSON schema.

Tone Preference: ${preferredTone}
${customInstruction ? `Custom User Guidance: ${customInstruction}` : ''}

Journal Content:
"""
${cleanCombinedText}
"""

Synthesize:
1. title: A clear, actionable title for this execution plan.
2. summary: A concise 2-sentence operational summary.
3. artifacts.email_drafts: 1-3 ready-to-send email drafts (e.g. status updates, proposals, feedback, questions) with recipient_role, subject, full professional body, and tone ('diplomatic' | 'assertive' | 'direct').
4. artifacts.code_or_tech_specs: 1-3 concrete technical artifacts (e.g. database schema / SQL, TypeScript interfaces, bash script, API spec, prompt template, or pseudocode) with title, language (e.g. 'typescript', 'sql', 'bash', 'json'), snippet, and explanation.
5. artifacts.calendar_blocks: 1-3 scheduled focus blocks or meeting agendas with event_title, duration_minutes (e.g. 15, 30, 45, 60, 90), and detailed agenda.
6. artifacts.action_dag: 2-6 ordered actionable DAG tasks with id ('task-1', 'task-2', etc.), task, priority ('high' | 'medium' | 'low'), estimated_minutes (number), depends_on array of prior task IDs (e.g. ['task-1']), and completed (default false).`;

    const result = await generateContentWithFallback({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            artifacts: {
              type: 'object',
              properties: {
                email_drafts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      recipient_role: { type: 'string' },
                      subject: { type: 'string' },
                      body: { type: 'string' },
                      tone: {
                        type: 'string',
                        enum: ['diplomatic', 'assertive', 'direct'],
                      },
                    },
                    required: ['recipient_role', 'subject', 'body', 'tone'],
                  },
                },
                code_or_tech_specs: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      language: { type: 'string' },
                      snippet: { type: 'string' },
                      explanation: { type: 'string' },
                    },
                    required: ['title', 'language', 'snippet', 'explanation'],
                  },
                },
                calendar_blocks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      event_title: { type: 'string' },
                      duration_minutes: { type: 'number' },
                      agenda: { type: 'string' },
                    },
                    required: ['event_title', 'duration_minutes', 'agenda'],
                  },
                },
                action_dag: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      task: { type: 'string' },
                      priority: {
                        type: 'string',
                        enum: ['high', 'medium', 'low'],
                      },
                      estimated_minutes: { type: 'number' },
                      depends_on: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                      completed: { type: 'boolean' },
                    },
                    required: ['id', 'task', 'priority', 'estimated_minutes', 'depends_on', 'completed'],
                  },
                },
              },
              required: ['email_drafts', 'code_or_tech_specs', 'calendar_blocks', 'action_dag'],
            },
          },
          required: ['title', 'summary', 'artifacts'],
        },
        temperature: 0.4,
      },
    });

    let parsedResult;
    try {
      parsedResult = JSON.parse(result.text);
    } catch (parseErr) {
      console.warn('Direct JSON parse failed on artifacts, attempting regex extraction:', parseErr);
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse Gemini artifacts response into structured JSON');
      }
    }

    res.json({
      title: parsedResult.title,
      summary: parsedResult.summary,
      artifacts: parsedResult.artifacts,
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/artifacts:', error);
    res.status(500).json({
      error: error.message || 'An unexpected error occurred during artifact generation.',
    });
  }
});

// ----------------------------------------------------
// FRONTEND SERVING & VITE INTEGRATION
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
