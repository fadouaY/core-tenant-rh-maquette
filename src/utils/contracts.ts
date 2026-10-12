// Contrats de l'employé (RH-7) : parcours complet, contrat en vigueur et état de chaque contrat.
import type { ContractKind, ContractPolicy, ContractTypeDef, Employee, EmployeeContract, ISODate } from '../types';
import { TODAY } from './dates';

/** Type de contrat du catalogue de la société, d'après son code. */
export const contractTypeDef = (types: ContractTypeDef[], code: string) => types.find((t) => t.code === code);
export const contractTypeName = (types: ContractTypeDef[], code: string) => contractTypeDef(types, code)?.name ?? code;
/** À durée déterminée : une date de fin est exigée (repli : tout sauf le CDI). */
export const isFixedTerm = (types: ContractTypeDef[], code: string) => contractTypeDef(types, code)?.fixedTerm ?? code !== 'CDI';

export const CONTRACT_KIND_LABEL: Record<ContractKind, string> = {
  initial: 'Contrat initial',
  renouvellement: 'Renouvellement',
  avenant: 'Avenant',
  nouveau: 'Nouveau contrat',
};

export type ContractStatus = 'actif' | 'a_venir' | 'termine' | 'cloture';

export const CONTRACT_STATUS: Record<ContractStatus, { label: string; tone: 'success' | 'info' | 'muted' | 'danger' }> = {
  actif: { label: 'Actif', tone: 'success' },
  a_venir: { label: 'À venir', tone: 'info' },
  termine: { label: 'Terminé', tone: 'muted' },
  cloture: { label: 'Clôturé', tone: 'danger' },
};

/** Date de fin effective : la clôture anticipée prime sur l'échéance prévue. */
export const effectiveEnd = (c: EmployeeContract): ISODate | undefined => c.closedAt ?? c.end;

export function contractStatus(c: EmployeeContract, today: ISODate = TODAY): ContractStatus {
  if (c.closedAt && c.closedAt < today) return 'cloture';
  if (c.start > today) return 'a_venir';
  const end = effectiveEnd(c);
  if (end && end < today) return c.closedAt ? 'cloture' : 'termine';
  return 'actif';
}

/**
 * Parcours contractuel complet, du plus récent au plus ancien. Une fiche créée avant la gestion des contrats
 * n'a que `contract` / `contractEnd` : le contrat initial en est déduit (début = date d'embauche).
 */
export function contractsOf(e: Employee): EmployeeContract[] {
  const list = (e.contracts ?? []).map((c) => ({ ...c, kind: c.kind ?? 'nouveau' as ContractKind }));
  const all = list.some((c) => c.kind === 'initial')
    ? list
    : [{ id: `${e.id}-initial`, kind: 'initial' as ContractKind, type: e.contract, start: e.hireDate, end: e.contractEnd }, ...list];
  return all.sort((a, b) => b.start.localeCompare(a.start));
}

/** Contrat en vigueur aujourd'hui, à défaut le plus récent déjà commencé. */
export function activeContract(list: EmployeeContract[], today: ISODate = TODAY): EmployeeContract | undefined {
  const started = list.filter((c) => c.start <= today).sort((a, b) => b.start.localeCompare(a.start));
  return started.find((c) => contractStatus(c, today) === 'actif') ?? started[0];
}

/** Autre contrat (non clôturé avant) dont la période chevauche celle donnée. */
export function overlappingContract(list: EmployeeContract[], start: ISODate, end: ISODate | undefined, exceptId?: string) {
  const far = '9999-12-31';
  return list.find((c) => c.id !== exceptId && c.start <= (end ?? far) && (effectiveEnd(c) ?? far) >= start);
}

/** Fin de période d'essai : veille du même jour, N mois après le début (ex. 1 mois depuis le 15/01 → 14/02). */
export function trialEndOf(start: ISODate, months: number): ISODate {
  const [y, m, d] = start.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  target.setUTCDate(target.getUTCDate() - 1);
  return target.toISOString().slice(0, 10);
}

/** Délai d'alerte avant l'échéance d'un contrat (30 jours par défaut). */
export const expiryAlertDays = (policies: ContractPolicy[], companyId: string) => policies.find((p) => p.companyId === companyId)?.expiryAlertDays ?? 30;

/** Contrats en cours dont l'échéance tombe dans le délai d'alerte, du plus proche au plus lointain. */
export function expiringContracts(employees: Employee[], days: number, today: ISODate = TODAY) {
  return employees.filter((e) => e.status !== 'inactif').flatMap((e) => contractsOf(e)
    .filter((c) => contractStatus(c, today) === 'actif' && effectiveEnd(c))
    .map((c) => ({ employee: e, contract: c, left: Math.round((Date.parse(effectiveEnd(c)!) - Date.parse(today)) / 86400000) }))
    .filter((x) => x.left >= 0 && x.left <= days))
    .sort((a, b) => a.left - b.left);
}
