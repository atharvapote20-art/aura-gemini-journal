/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Strips all undefined values recursively to ensure Firestore zero-crash payload hygiene.
 */
export function sanitizePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizePayload(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (value !== undefined) {
        cleanObj[key] = sanitizePayload(value);
      }
    }
    return cleanObj as T;
  }
  return obj;
}

/**
 * Client & Server PII Masking utility
 * Masks API keys, tokens, credit cards, and social security numbers prior to sending prompts to models.
 */
export function maskPII(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // 1. Google API keys (AIzaSy...)
  sanitized = sanitized.replace(/AIzaSy[A-Za-z0-9_-]{33}/g, '[REDACTED_API_KEY]');

  // 2. Generic secret tokens / Bearer tokens
  sanitized = sanitized.replace(/bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_TOKEN]');
  sanitized = sanitized.replace(/(?:sk-[a-zA-Z0-9]{32,})/g, '[REDACTED_SECRET_KEY]');

  // 3. Credit card numbers (13 to 19 digits)
  sanitized = sanitized.replace(/\b(?:\d{4}[ -]?){3}\d{1,4}\b/g, '[REDACTED_CARD_NUMBER]');

  // 4. US Social Security Numbers (XXX-XX-XXXX)
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]');

  return sanitized;
}
