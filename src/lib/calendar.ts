/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalendarBlock } from '../types';

/**
 * Formats a Date object to iCalendar UTC string format: YYYYMMDDTHHMMSSZ
 */
function formatIcsDate(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

/**
 * Escapes characters for iCalendar text values (RFC 5545)
 */
function escapeIcsText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generates RFC 5545 .ics file content for a calendar time block
 */
export function generateIcsContent(block: CalendarBlock, startDate?: Date): string {
  const now = new Date();
  const start = startDate || new Date(Date.now() + 24 * 60 * 60 * 1000); // default to tomorrow
  // Set to 9:00 AM if using default
  if (!startDate) {
    start.setHours(9, 0, 0, 0);
  }
  const durationMs = (block.duration_minutes || 30) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);

  const uid = 'aura-block-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9) + '@aura.app';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Aura Reflections//Action Engine v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${escapeIcsText(block.event_title || 'Focus Time Block')}`,
    `DESCRIPTION:${escapeIcsText(block.agenda || 'Generated via Aura Action Engine')}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/**
 * Initiates browser download of a .ics file
 */
export function downloadIcsFile(block: CalendarBlock): void {
  const content = generateIcsContent(block);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const filename = (block.event_title || 'focus-block')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  link.download = `${filename || 'calendar-block'}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates direct Google Calendar web event creation URL
 */
export function getGoogleCalendarUrl(block: CalendarBlock): string {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  start.setHours(9, 0, 0, 0);
  const durationMs = (block.duration_minutes || 30) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);

  const datesParam = `${formatIcsDate(start)}/${formatIcsDate(end)}`;
  const textParam = encodeURIComponent(block.event_title || 'Focus Time Block');
  const detailsParam = encodeURIComponent(block.agenda || 'Generated via Aura Action Engine');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${textParam}&dates=${datesParam}&details=${detailsParam}`;
}
