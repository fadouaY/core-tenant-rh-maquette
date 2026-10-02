// Règles de présence (exemples de démonstration) :
//  - fonctions solo liées : leurs titulaires ne peuvent pas être absents le même jour ;
//  - fonction groupe : un nombre minimum de personnes doit rester présent chaque jour.
import type { Database, Employee, ID, ISODate, LeaveRequest } from '../types';
import { eachDay, isoWeekday, overlaps } from './dates';

export interface PresenceConflict {
  kind: 'solo' | 'groupe';
  rule: string;
  message: string;
  people: Employee[];
  days: ISODate[];
}

/** Types de congé soumis aux règles : ceux de la politique, ou par défaut les types imputés au solde annuel. */
export function policyTypeIds(db: Database, companyId: ID): Set<ID> {
  const policy = db.presencePolicies.find((p) => p.companyId === companyId);
  if (policy) return new Set(policy.leaveTypeIds);
  return new Set(db.leaveTypes.filter((t) => t.companyId === companyId && t.deductsFromAnnual).map((t) => t.id));
}

export function presenceEffect(db: Database, companyId: ID): 'block' | 'warning' {
  return db.presencePolicies.find((p) => p.companyId === companyId)?.effect ?? 'block';
}

/** Effectif actif d'une fonction. */
export function functionHolders(db: Database, functionId: ID): Employee[] {
  return db.employees.filter((e) => e.functionId === functionId && e.status !== 'inactif');
}

export function findPresenceConflicts(
  db: Database, employeeId: ID, leaveTypeId: ID, start: ISODate, end: ISODate, excludeRequestId?: ID,
): PresenceConflict[] {
  const employee = db.employees.find((e) => e.id === employeeId);
  if (!employee || !start || !end || end < start) return [];
  const types = policyTypeIds(db, employee.companyId);
  if (!types.has(leaveTypeId)) return [];

  const fn = db.functions.find((f) => f.id === employee.functionId);
  if (!fn) return [];
  const schedule = db.schedules.find((s) => s.id === db.profiles.find((p) => p.employeeId === employeeId)?.scheduleId);
  const workDays = schedule?.workDays ?? [1, 2, 3, 4, 5];
  const days = eachDay(start, end).filter((d) => workDays.includes(isoWeekday(d)));

  /** Absences (approuvées ou en attente) des autres personnes, sur les types soumis aux règles. */
  const absencesOf = (ids: ID[]): LeaveRequest[] => db.requests.filter((r) =>
    ids.includes(r.employeeId) && r.id !== excludeRequestId && types.has(r.leaveTypeId) &&
    (r.status === 'approuve' || r.status === 'en_attente') && overlaps(r.start, r.end, start, end));

  const conflicts: PresenceConflict[] = [];

  // 1. Fonctions solo liées
  if (fn.kind === 'solo') {
    for (const link of db.functionLinks.filter((l) => l.companyId === employee.companyId && !l.archived && l.functionIds.includes(fn.id))) {
      const others = db.employees.filter((e) => e.id !== employeeId && e.status !== 'inactif' && link.functionIds.includes(e.functionId) && e.functionId !== fn.id);
      const reqs = absencesOf(others.map((o) => o.id));
      if (reqs.length === 0) continue;
      const conflictDays = days.filter((d) => reqs.some((r) => r.start <= d && r.end >= d));
      if (conflictDays.length === 0) continue;
      const people = others.filter((o) => reqs.some((r) => r.employeeId === o.id));
      conflicts.push({
        kind: 'solo', rule: link.name, days: conflictDays, people,
        message: `${people.map((p) => `${p.firstName} ${p.lastName}`).join(', ')} (fonction liée) est déjà absent(e) sur la période : les deux fonctions ne peuvent pas être absentes le même jour.`,
      });
    }
  }

  // 2. Présence minimale d'une fonction groupe
  if (fn.kind === 'groupe' && fn.minPresent != null) {
    const holders = functionHolders(db, fn.id);
    const maxAbsent = Math.max(0, holders.length - fn.minPresent);
    const others = holders.filter((h) => h.id !== employeeId);
    const reqs = absencesOf(others.map((o) => o.id));
    const conflictDays = days.filter((d) => {
      const absentOthers = new Set(reqs.filter((r) => r.start <= d && r.end >= d).map((r) => r.employeeId));
      return absentOthers.size + 1 > maxAbsent;
    });
    if (conflictDays.length > 0) {
      const people = others.filter((o) => reqs.some((r) => r.employeeId === o.id && conflictDays.some((d) => r.start <= d && r.end >= d)));
      conflicts.push({
        kind: 'groupe', rule: fn.name, days: conflictDays, people,
        message: maxAbsent === 0
          ? `« ${fn.name} » : ${fn.minPresent} présent(s) requis pour ${holders.length} personne(s) — aucune absence possible.`
          : `« ${fn.name} » : ${fn.minPresent} présent(s) requis sur ${holders.length}, soit ${maxAbsent} absence(s) simultanée(s) au maximum.${people.length ? ` Déjà absent(s) : ${people.map((p) => `${p.firstName} ${p.lastName}`).join(', ')}.` : ''}`,
      });
    }
  }
  return conflicts;
}
