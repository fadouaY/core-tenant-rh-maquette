// Autorisations d'absence en heures : décompte d'après les créneaux de l'horaire de l'employé.
// Une journée de solde vaut la durée de travail d'une journée de son horaire (ex. 09:00–12:30 + 14:00–18:00 = 7 h 30).
import type { Database, ID, ISODate, LeaveRequest, Schedule, TimeSlot } from '../types';
import { isoWeekday, TODAY } from './dates';
import { isWorkingDay, scheduleOn } from './org';
import { profileOf } from './leave';

export const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };

/** Horaire de l'employé à une date : hérité du rattachement ou planifié dans le tableau de chargement. */
export function scheduleOf(db: Database, employeeId: ID, date: ISODate = TODAY): Schedule | undefined {
  const employee = db.employees.find((e) => e.id === employeeId);
  return employee ? scheduleOn(db, employee, date).schedule : undefined;
}

/** Durée d'un créneau en minutes ; un créneau de nuit (fin avant début) traverse minuit. */
export const slotMinutes = (s: TimeSlot) => { const d = toMinutes(s.end) - toMinutes(s.start); return d > 0 ? d : d + 24 * 60; };

/** Jours où un créneau s'applique : les siens, sinon les jours travaillés du scénario. */
export const slotDays = (schedule: Pick<Schedule, 'workDays'>, slot: TimeSlot) => slot.days ?? schedule.workDays;

/** Créneaux d'un jour de la semaine (1 = lundi … 7 = dimanche). */
export const slotsOn = (schedule: Pick<Schedule, 'slots' | 'workDays'>, weekday: number) =>
  schedule.slots.filter((s) => slotDays(schedule, s).includes(weekday));

/** Jours travaillés d'un scénario : ceux couverts par au moins un créneau. */
export const scheduleDays = (schedule: Pick<Schedule, 'slots' | 'workDays'>) =>
  [...new Set(schedule.slots.flatMap((s) => slotDays(schedule, s)))].sort();

/** Volume hebdomadaire calculé d'après les créneaux et leurs jours (en heures). */
export const weeklyMinutes = (schedule: Pick<Schedule, 'slots' | 'workDays'>) =>
  schedule.slots.reduce((sum, s) => sum + slotMinutes(s) * slotDays(schedule, s).length, 0);

/**
 * Durée de travail d'une journée (en heures) : celle du jour indiqué, sinon la moyenne d'un jour travaillé
 * (sert à convertir heures et jours de solde). 8 h par défaut sans horaire.
 */
export function dayHours(schedule?: Pick<Schedule, 'slots' | 'workDays'>, weekday?: number): number {
  if (!schedule || schedule.slots.length === 0) return 8;
  if (weekday) return slotsOn(schedule, weekday).reduce((sum, s) => sum + slotMinutes(s), 0) / 60;
  const days = scheduleDays(schedule).length;
  return days ? weeklyMinutes(schedule) / days / 60 : 8;
}

export interface AuthorizationCount {
  /** Heures réellement décomptées (intersection avec les créneaux). */
  hours: number;
  /** Équivalent en jours de solde. */
  days: number;
  dayHours: number;
  workingDay: boolean;
  holiday?: string;
  /** Minutes demandées hors créneaux (pause, avant/après la journée), non décomptées. */
  outsideMinutes: number;
  slots: TimeSlot[];
}

export function countAuthorization(db: Database, employeeId: ID, date: ISODate, from: string, to: string): AuthorizationCount {
  const schedule = scheduleOf(db, employeeId, date);
  const slots = schedule && date ? slotsOn(schedule, isoWeekday(date)) : schedule?.slots ?? [];
  const perDay = (schedule && date ? dayHours(schedule, isoWeekday(date)) : 0) || dayHours(schedule);
  const base: AuthorizationCount = { hours: 0, days: 0, dayHours: perDay, workingDay: false, outsideMinutes: 0, slots };
  if (!date || !from || !to || toMinutes(to) <= toMinutes(from)) return base;
  const companyId = profileOf(db, employeeId)?.companyId;
  const holiday = db.holidays.find((h) => h.companyId === companyId && !h.archived && h.date === date)?.name;
  const employee = db.employees.find((e) => e.id === employeeId);
  const workingDay = !!employee && isWorkingDay(db, employee, date) && !holiday;
  const a = toMinutes(from);
  const b = toMinutes(to);
  const inside = workingDay
    ? slots.reduce((sum, s) => sum + Math.max(0, Math.min(b, toMinutes(s.end)) - Math.max(a, toMinutes(s.start))), 0)
    : 0;
  const hours = inside / 60;
  return { ...base, hours, days: hours / perDay, workingDay, holiday, outsideMinutes: b - a - inside };
}

/** « 2 h », « 1 h 30 », « 45 min ». */
export function formatHours(hours: number): string {
  const total = Math.round(Math.abs(hours) * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const sign = hours < 0 ? '− ' : '';
  if (!h) return `${sign}${m} min`;
  return `${sign}${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`;
}

/** Solde en jours complets + heures restantes : « 19 j 5 h 30 » (une journée = durée de l'horaire). */
export function formatDaysHours(days: number, perDay: number): string {
  const sign = days < 0 ? '− ' : '';
  const totalMin = Math.round(Math.abs(days) * perDay * 60);
  const dayMin = Math.round(perDay * 60);
  const d = Math.floor(totalMin / dayMin);
  const rest = totalMin - d * dayMin;
  if (!rest) return `${sign}${d} j`;
  return `${sign}${d ? `${d} j ` : ''}${formatHours(rest / 60)}`;
}

/** Durée d'une demande : en heures pour une autorisation, en jours sinon. */
export function formatRequestDuration(r: Pick<LeaveRequest, 'days' | 'hours'>): string {
  if (r.hours != null) return formatHours(r.hours);
  const v = Number.isInteger(r.days) ? String(r.days) : r.days.toFixed(1).replace('.', ',');
  return `${v} j`;
}

export const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Heures proposées, créneau par créneau (pas de 15 min) : départs possibles et fins possibles après « from ». */
export function slotTimes(slots: TimeSlot[], step = 15) {
  const starts = slots.map((s) => {
    const times: string[] = [];
    for (let m = toMinutes(s.start); m < toMinutes(s.end); m += step) times.push(fromMinutes(m));
    return { label: s.label, times };
  });
  const endsAfter = (from: string) => slots
    .map((s) => {
      const times: string[] = [];
      for (let m = toMinutes(s.start) + step; m <= toMinutes(s.end); m += step) if (!from || m > toMinutes(from)) times.push(fromMinutes(m));
      return { label: s.label, times };
    })
    .filter((g) => g.times.length);
  return { starts, endsAfter };
}

/** Prochain jour travaillé (non férié) à partir de « from », pour pré-remplir une autorisation. */
export function nextWorkingDay(db: Database, employeeId: ID, from: ISODate): ISODate {
  const employee = db.employees.find((e) => e.id === employeeId);
  const companyId = profileOf(db, employeeId)?.companyId;
  const holidays = new Set(db.holidays.filter((h) => h.companyId === companyId && !h.archived).map((h) => h.date));
  const d = new Date(`${from}T12:00:00`);
  for (let i = 0; i < 14; i++) {
    const iso = d.toISOString().slice(0, 10);
    if (employee && isWorkingDay(db, employee, iso) && !holidays.has(iso)) return iso;
    d.setDate(d.getDate() + 1);
  }
  return from;
}

/** Journées types d'un scénario : créneaux regroupés par jeu de jours identique, du lundi au dimanche. */
export function scheduleDayTypes(schedule: Pick<Schedule, 'slots' | 'workDays'>) {
  const map = new Map<string, { days: number[]; slots: TimeSlot[] }>();
  for (const slot of schedule.slots) {
    const days = [...slotDays(schedule, slot)].sort();
    const key = days.join(',');
    if (!map.has(key)) map.set(key, { days, slots: [] });
    map.get(key)!.slots.push(slot);
  }
  return [...map.values()].sort((a, b) => (a.days[0] ?? 9) - (b.days[0] ?? 9));
}
