import type { ISODate } from '../types';

/** Date « du jour » figée pour la démonstration. */
export const TODAY: ISODate = '2026-10-01';

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function toISO(d: Date): ISODate {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMonths(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 1 = lundi … 7 = dimanche. */
export function isoWeekday(s: ISODate): number {
  const w = parseISO(s).getDay();
  return w === 0 ? 7 : w;
}

export function startOfWeek(s: ISODate): ISODate {
  return addDays(s, 1 - isoWeekday(s));
}

export function startOfMonth(s: ISODate): ISODate {
  return s.slice(0, 8) + '01';
}

export function endOfMonth(s: ISODate): ISODate {
  return addDays(addMonths(s, 1), -1);
}

export function overlaps(aStart: ISODate, aEnd: ISODate, bStart: ISODate, bEnd: ISODate): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

const fmtShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const fmtWeekdayShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

export const formatDate = (s: ISODate) => fmtShort.format(parseISO(s));
export const formatDayMonth = (s: ISODate) => fmtDayMonth.format(parseISO(s));
export const formatLong = (s: ISODate) => fmtLong.format(parseISO(s));
export const formatMonth = (s: ISODate) => {
  const v = fmtMonth.format(parseISO(s));
  return v.charAt(0).toUpperCase() + v.slice(1);
};
export const formatWeekdayShort = (s: ISODate) => fmtWeekdayShort.format(parseISO(s)).replace('.', '');

export function formatRange(start: ISODate, end: ISODate): string {
  if (start === end) return formatDate(start);
  if (start.slice(0, 4) === end.slice(0, 4)) return `${formatDayMonth(start)} → ${formatDate(end)}`;
  return `${formatDate(start)} → ${formatDate(end)}`;
}

/** Horodatage « AAAA-MM-JJTHH:mm » → « 12 oct. 2026 à 09:30 ». */
export function formatDateTime(s: string): string {
  const [date, time] = s.split('T');
  return time ? `${formatDate(date)} à ${time.slice(0, 5)}` : formatDate(date);
}

export function nowStamp(): string {
  const d = new Date();
  return `${TODAY}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDays(n: number): string {
  const v = Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
  return `${v} j`;
}
