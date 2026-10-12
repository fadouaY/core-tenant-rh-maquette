// Statut RH de l'employé (RH-12) : libellés, couleurs, statut technique dérivé et parcours daté.
import type { Employee, EmployeeStatus, HrStatus, StatusChange } from '../types';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted' | 'primary';

export const HR_STATUS: Record<HrStatus, { label: string; tone: Tone; base: EmployeeStatus; departure?: boolean }> = {
  essai: { label: 'En période d’essai', tone: 'info', base: 'essai' },
  actif: { label: 'Actif', tone: 'success', base: 'actif' },
  suspendu: { label: 'Suspendu', tone: 'warning', base: 'actif' },
  preavis: { label: 'En préavis de départ', tone: 'warning', base: 'actif', departure: true },
  demissionnaire: { label: 'Démissionnaire', tone: 'danger', base: 'inactif', departure: true },
  licencie: { label: 'Licencié', tone: 'danger', base: 'inactif', departure: true },
  fin_contrat: { label: 'Fin de contrat', tone: 'muted', base: 'inactif', departure: true },
  retraite: { label: 'Retraité', tone: 'muted', base: 'inactif', departure: true },
  decede: { label: 'Décédé', tone: 'muted', base: 'inactif', departure: true },
};

export const HR_STATUS_ORDER = Object.keys(HR_STATUS) as HrStatus[];

export const DEPARTURE_TYPES = [
  'Démission', 'Licenciement', 'Rupture conventionnelle', 'Fin de contrat (CDD / stage)', 'Fin de période d’essai', 'Départ à la retraite', 'Décès', 'Autre',
];

/** Statut RH courant ; une fiche ancienne n'a que le statut technique. */
export function hrStatusOf(e: Pick<Employee, 'status' | 'hrStatus'>): HrStatus {
  return e.hrStatus ?? (e.status === 'inactif' ? 'fin_contrat' : e.status);
}

/** Parcours du statut, du plus ancien au plus récent ; à défaut d'historique, le statut courant depuis l'embauche. */
export function statusTimeline(e: Employee): StatusChange[] {
  const list = [...(e.statusHistory ?? [])].sort((a, b) => a.since.localeCompare(b.since));
  return list.length ? list : [{ id: `${e.id}-st0`, status: hrStatusOf(e), since: e.hireDate }];
}
