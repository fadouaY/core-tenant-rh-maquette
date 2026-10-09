// Règles métier du rattachement organisationnel : circuit hérité du département (RH-22, RH-23),
// horaire organisationnel ou tableau de chargement (RH-6, RH-21, RH-24 à RH-26), primes (RH-8, RH-27).
import type {
  ApprovalCircuit, Company, Database, Department, Employee, EmployeeHistoryEntry, EmployeeNumbering, ID, ISODate, LoadingPeriod, Schedule,
} from '../types';
import { addDays, isoWeekday, TODAY } from './dates';

// ---------------------------------------------------------------- Départements

/** Département de premier niveau d'un département ou sous-département. */
export function rootDepartment(db: Database, departmentId?: ID): Department | undefined {
  const d = db.departments.find((x) => x.id === departmentId);
  return d?.parentId ? db.departments.find((x) => x.id === d.parentId) : d;
}

export const subDepartmentsOf = (db: Database, departmentId: ID) =>
  db.departments.filter((d) => d.parentId === departmentId);

// ---------------------------------------------------------------- Circuit (RH-22, RH-23)

/** Circuit actif affecté au département (ou au département parent d'un sous-département). */
export function circuitForDepartment(db: Database, departmentId?: ID): ApprovalCircuit | undefined {
  const root = rootDepartment(db, departmentId);
  return root ? db.circuits.find((c) => c.departmentId === root.id && !c.archived) : undefined;
}

export const circuitOfEmployee = (db: Database, e: Pick<Employee, 'departmentId'>) => circuitForDepartment(db, e.departmentId);

export interface CircuitStepView {
  label: string;
  approverId?: ID;
  /** « requester » : l'étape de l'employé lui-même ; « below » : niveau inférieur au sien ; « duplicate » : approbateur déjà présent. */
  skipped?: 'requester' | 'below' | 'duplicate' | 'undefined';
}

/**
 * Étapes du circuit pour un employé (RH-23) : approbateur résolu par niveau, et saut automatique si le demandeur
 * appartient au circuit — son niveau et les niveaux inférieurs sont sautés, la demande part au niveau suivant.
 */
export function circuitStepsFor(db: Database, employeeId: ID, circuit?: ApprovalCircuit): CircuitStepView[] {
  const e = db.employees.find((x) => x.id === employeeId);
  if (!e || !circuit || circuit.exempt) return [];
  const head = rootDepartment(db, e.subDepartmentId ?? e.departmentId)?.headId;
  const subHead = e.subDepartmentId ? db.departments.find((d) => d.id === e.subDepartmentId)?.headId : undefined;
  const steps: CircuitStepView[] = circuit.steps.map((s) => ({
    label: s.label,
    approverId: s.kind === 'manager' ? e.managerId : s.kind === 'departmentHead' ? (subHead ?? head) : s.employeeId,
  }));
  const own = steps.findIndex((s) => s.approverId === employeeId);
  const seen = new Set<ID>();
  return steps.map((s, i) => {
    if (own >= 0 && i < own) return { ...s, skipped: 'below' };
    if (i === own) return { ...s, skipped: 'requester' };
    if (!s.approverId) return { ...s, skipped: 'undefined' };
    if (seen.has(s.approverId)) return { ...s, skipped: 'duplicate' };
    seen.add(s.approverId);
    return s;
  });
}

/** Approbateurs effectifs, dans l'ordre. Vide = validation automatique (circuit dispensé ou dernier approbateur). */
export const approversFor = (db: Database, employeeId: ID, circuit?: ApprovalCircuit): ID[] =>
  circuitStepsFor(db, employeeId, circuit).filter((s) => !s.skipped).map((s) => s.approverId!);

// ---------------------------------------------------------------- Horaire (RH-6, RH-21, RH-24)

export interface ScheduleSource {
  schedule?: Schedule;
  /** Origine lisible : sous-département, département, période du tableau de chargement, ou « Non planifié ». */
  source: string;
  period?: LoadingPeriod;
  /** Mode tableau de chargement sans période couvrant la date. */
  unplanned?: boolean;
}

/** Horaire organisationnel : celui du sous-département s'il en a un, sinon celui du département. */
export function organisationalSchedule(db: Database, departmentId?: ID, subDepartmentId?: ID): ScheduleSource {
  const active = (id?: ID) => db.schedules.find((s) => s.id === id && !s.archived);
  const sub = db.departments.find((d) => d.id === subDepartmentId);
  if (sub && active(sub.scheduleId)) return { schedule: active(sub.scheduleId), source: `Sous-département « ${sub.name} »` };
  const dep = rootDepartment(db, departmentId);
  if (dep && active(dep.scheduleId)) return { schedule: active(dep.scheduleId), source: `Département « ${dep.name} »` };
  return { source: 'Aucun horaire défini pour le rattachement' };
}

export const periodsOf = (db: Database, employeeId: ID) =>
  db.loadingPeriods.filter((p) => p.employeeId === employeeId).sort((a, b) => a.start.localeCompare(b.start));

/** Horaire applicable à une date : hérité du rattachement, ou planifié dans le tableau de chargement. */
export function scheduleOn(db: Database, e: Employee, date: ISODate = TODAY): ScheduleSource {
  if (e.scheduleMode === 'chargement' && (!e.loadingSince || date >= e.loadingSince)) {
    const period = periodsOf(db, e.id).find((p) => p.start <= date && p.end >= date);
    const schedule = db.schedules.find((s) => s.id === period?.scheduleId);
    return period && schedule
      ? { schedule, period, source: `Tableau de chargement — ${period.label}` }
      : { source: 'Tableau de chargement — non planifié', unplanned: true };
  }
  return organisationalSchedule(db, e.departmentId, e.subDepartmentId);
}

/**
 * Jour travaillé selon l'horaire en vigueur : jours propres au (sous-)département s'il en a dans le scénario,
 * sinon jours par défaut ; un jour non travaillé exceptionnel du scénario est chômé (RH-21).
 */
export function isWorkingDay(db: Database, e: Employee, date: ISODate): boolean {
  const { schedule, period } = scheduleOn(db, e, date);
  if (!schedule) return [1, 2, 3, 4, 5].includes(isoWeekday(date));
  const scope = period ? [] : [e.subDepartmentId, e.departmentId].filter((x): x is ID => !!x);
  const own = scope.map((id) => schedule.departmentWorkDays?.[id]).find(Boolean);
  if (!(own ?? schedule.workDays).includes(isoWeekday(date))) return false;
  return !(schedule.exceptionalOffDays ?? []).some((x) => x.date === date && (!x.departmentId || scope.includes(x.departmentId)));
}

/** Jour férié actif de la société à cette date (récurrent : même jour et même mois). */
export const holidayOn = (db: Database, companyId: ID, date: ISODate) =>
  db.holidays.find((h) => h.companyId === companyId && !h.archived && (h.date === date || (h.recurring && h.date.slice(5) === date.slice(5))));

/**
 * Périodes non couvertes d'un employé en tableau de chargement, de `from` (au plus tôt sa date de bascule) jusqu'à
 * `horizon` jours plus tard (RH-24, RH-25). Sans période future, il reste « Non planifié » : aucun retour automatique.
 */
export function uncoveredRanges(db: Database, e: Employee, from: ISODate = TODAY, horizon = 30): { start: ISODate; end: ISODate }[] {
  if (e.scheduleMode !== 'chargement') return [];
  const start = e.loadingSince && e.loadingSince > from ? e.loadingSince : from;
  const end = addDays(start, horizon - 1);
  const gaps: { start: ISODate; end: ISODate }[] = [];
  let cursor = start;
  for (const p of periodsOf(db, e.id)) {
    if (p.end < cursor) continue;
    if (p.start > end) break;
    if (p.start > cursor) gaps.push({ start: cursor, end: addDays(p.start, -1) });
    cursor = addDays(p.end, 1);
    if (cursor > end) break;
  }
  if (cursor <= end) gaps.push({ start: cursor, end });
  return gaps;
}

/** Période existante qui chevauche l'intervalle demandé (contrôle anti-chevauchement strict, RH-26). */
export const overlappingPeriod = (db: Database, employeeId: ID, start: ISODate, end: ISODate, exceptId?: ID) =>
  db.loadingPeriods.find((p) => p.employeeId === employeeId && p.id !== exceptId && start <= p.end && end >= p.start);

/** Utilisation d'un horaire : départements, sous-départements et périodes du tableau de chargement à venir. */
export function scheduleUsage(db: Database, scheduleId: ID) {
  const departments = db.departments.filter((d) => d.scheduleId === scheduleId && !d.archived);
  const periods = db.loadingPeriods.filter((p) => p.scheduleId === scheduleId && p.end >= TODAY);
  return { departments, periods, inUse: departments.length > 0 || periods.length > 0 };
}

// ---------------------------------------------------------------- Rémunération (RH-8, RH-27)

const CURRENCY_BY_COUNTRY: Record<string, string> = { Maroc: 'MAD', France: 'EUR', Tunisie: 'TND' };
export const currencyOf = (company?: Pick<Company, 'country'>) => CURRENCY_BY_COUNTRY[company?.country ?? ''] ?? 'EUR';

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

/** Salaire en vigueur : le plus récent dont la date d'effet est passée. */
export function currentSalary(e: Pick<Employee, 'salaries'>, date: ISODate = TODAY) {
  return [...e.salaries].filter((s) => s.since <= date).sort((a, b) => b.since.localeCompare(a.since))[0];
}

/** Nombre d'employés auxquels une prime est attribuée (interdit sa suppression, RH-27). */
export const primeAssignments = (db: Database, primeId: ID) =>
  db.employees.filter((e) => e.primes.some((p) => p.primeId === primeId)).length;

// ---------------------------------------------------------------- Numérotation des matricules

/** Matricule produit par la numérotation : préfixe, année éventuelle, compteur complété de zéros. */
export function formatMatricule(n: Pick<EmployeeNumbering, 'prefix' | 'separator' | 'withYear' | 'digits'>, value: number, date: ISODate = TODAY): string {
  const parts = [n.prefix.trim().toUpperCase(), n.withYear ? date.slice(0, 4) : '', String(Math.max(0, value)).padStart(n.digits, '0')].filter(Boolean);
  return parts.join(n.separator);
}

/** Numérotation de la société (valeurs par défaut si elle n'a pas encore été paramétrée). */
export function numberingOf(db: Database, companyId: ID): EmployeeNumbering {
  return db.numberings.find((n) => n.companyId === companyId)
    ?? { companyId, prefix: (db.companies.find((c) => c.id === companyId)?.name ?? 'EMP').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(), separator: '-', withYear: false, digits: 5, next: 1 };
}

/** Prochain matricule libre : le compteur avance tant que le numéro est déjà pris. */
export function nextMatricule(db: Database, companyId: ID, date: ISODate = TODAY): { matricule: string; value: number } {
  const n = numberingOf(db, companyId);
  const taken = new Set(db.employees.filter((e) => e.companyId === companyId).map((e) => e.matricule.trim().toUpperCase()));
  let value = n.next;
  while (taken.has(formatMatricule(n, value, date))) value++;
  return { matricule: formatMatricule(n, value, date), value };
}

// ---------------------------------------------------------------- Historique (RH-10)

export const historyEntry = (kind: EmployeeHistoryEntry['kind'], label: string, actorId?: ID, at: ISODate = TODAY): EmployeeHistoryEntry =>
  ({ at, kind, label, actorId });

export const MARITAL_LABEL: Record<Employee['maritalStatus'], string> = { celibataire: 'Célibataire', marie: 'Marié(e)', divorce: 'Divorcé(e)' };
