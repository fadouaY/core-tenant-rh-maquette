// Fiche employé — en-tête, vue d'ensemble (RH-4) et temps de travail (RH-6, RH-21, RH-24).
// Ordre de lecture : qui est-ce et où en est-il (en-tête, repères, alertes), puis le détail par thème.
import type { ReactNode } from 'react';
import {
  AlertTriangle, AtSign, Briefcase, CalendarCheck, CalendarClock, ChevronRight, Clock, Coffee, FileSignature, History, KeyRound, MapPin,
  Moon, Phone, UserRound, Users,
} from 'lucide-react';
import { useCompanyData, useStore } from '../../store';
import { Avatar, Badge, EmployeeStatusBadge } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import type { Employee, LeaveProfile, Schedule, TimeSlot } from '../../types';
import { diffDays, formatDate, formatDateTime, formatDayMonth, formatRange, TODAY } from '../../utils/dates';
import { dayHours, formatDaysHours, toMinutes } from '../../utils/hours';
import { getAnnualBalance } from '../../utils/leave';
import {
  circuitForDepartment, currentSalary, formatMoney, MARITAL_LABEL, periodsOf, scheduleOn, uncoveredRanges,
} from '../../utils/org';
import { formatPhone } from '../../utils/phone';
import { PRIME_PERIODICITY } from './EmployeeSections';

export type EmployeeTab = 'apercu' | 'temps' | 'conges' | 'remuneration' | 'acces' | 'historique';

/** Ancienneté lisible : « 4 ans et 2 mois », « 3 mois », « Arrivé ce mois-ci ». */
export function seniority(hireDate: string, today = TODAY): string {
  if (hireDate > today) return `Arrivée le ${formatDate(hireDate)}`;
  const [y1, m1, d1] = hireDate.split('-').map(Number);
  const [y2, m2, d2] = today.split('-').map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  const years = Math.floor(months / 12); months %= 12;
  if (!years && !months) return 'Moins d’un mois';
  return [years && `${years} an${years > 1 ? 's' : ''}`, months && `${months} mois`].filter(Boolean).join(' et ');
}

/** Jours travaillés de l'employé dans son horaire : jours propres à son (sous-)département, sinon ceux du scénario. */
function workDaysFor(e: Employee, s?: Schedule, organisational = true) {
  if (!s) return [];
  const own = organisational ? [e.subDepartmentId, e.departmentId].map((id) => (id ? s.departmentWorkDays?.[id] : undefined)).find(Boolean) : undefined;
  return own ?? s.workDays;
}

// ------------------------------------------------------------------ En-tête

export function EmployeeHero({ employee, profile, actions, onTab }: {
  employee: Employee; profile: LeaveProfile; actions: ReactNode; onTab: (t: EmployeeTab) => void;
}) {
  const { db } = useStore();
  const data = useCompanyData();
  const manager = data.employee(employee.managerId);
  const today = scheduleOn(db, employee);
  const balance = getAnnualBalance(db, employee.id);
  const absence = data.requests.find((r) => r.employeeId === employee.id && r.status === 'approuve' && r.start <= TODAY && r.end >= TODAY);
  const nextAbsence = data.requests.filter((r) => r.employeeId === employee.id && r.status === 'approuve' && r.start > TODAY).sort((a, b) => a.start.localeCompare(b.start))[0];
  const pending = data.requests.filter((r) => r.employeeId === employee.id && r.status === 'en_attente').length;
  const circuit = circuitForDepartment(db, employee.departmentId);
  const sub = data.department(employee.subDepartmentId);

  return (
    <>
      <header className="emp-hero">
        <Avatar employee={employee} size={64} />
        <div className="emp-hero-main">
          <h1>{employee.firstName} {employee.lastName}</h1>
          <p className="emp-hero-role">
            {data.fn(employee.functionId)?.name}
            <span aria-hidden> · </span>{data.department(employee.departmentId)?.name}{sub && <> <ChevronRight size={12} aria-hidden className="inline-icon" /> {sub.name}</>}
          </p>
          <div className="emp-hero-tags">
            <span className="emp-matricule">{employee.matricule}</span>
            <EmployeeStatusBadge status={employee.status} />
            <Badge tone="neutral">{employee.contract}</Badge>
            <Badge tone="primary" icon={<KeyRound size={11} aria-hidden />}>{data.role(profile.roleId)?.name}</Badge>
            {employee.scheduleMode === 'chargement' && <Badge tone="warning" icon={<CalendarClock size={11} aria-hidden />}>Tableau de chargement</Badge>}
          </div>
        </div>
        <div className="emp-hero-actions">{actions}</div>
      </header>

      {/* Quatre repères : ce qu'on cherche en premier en ouvrant une fiche. */}
      <dl className="emp-facts">
        <div>
          <dt><Briefcase size={13} aria-hidden /> Ancienneté</dt>
          <dd>{seniority(employee.hireDate)}</dd>
          <span>Depuis le {formatDate(employee.hireDate)}</span>
        </div>
        <button type="button" className="emp-fact-link" onClick={() => onTab('temps')}>
          <dt><Clock size={13} aria-hidden /> Horaire aujourd’hui</dt>
          <dd className={today.unplanned ? 'danger' : ''}>{today.unplanned ? 'Non planifié' : today.schedule?.name ?? '—'}</dd>
          <span>{today.unplanned ? 'Tableau de chargement' : today.period ? today.period.label : employee.scheduleMode === 'organisation' ? 'Horaire du département' : today.source}</span>
        </button>
        <button type="button" className="emp-fact-link" onClick={() => onTab('conges')}>
          <dt><CalendarCheck size={13} aria-hidden /> Solde de congés</dt>
          <dd className={balance.available < 0 ? 'danger' : ''}>{balance.tracked ? formatDaysHours(balance.available, dayHours(today.schedule)) : '—'}</dd>
          <span>{pending ? `${pending} demande${pending > 1 ? 's' : ''} en attente` : nextAbsence ? `Prochain congé le ${formatDayMonth(nextAbsence.start)}` : 'Aucune demande en attente'}</span>
        </button>
        <div>
          <dt><Users size={13} aria-hidden /> Responsable</dt>
          <dd>{manager ? <a className="link" href={`#/employes/${manager.id}`}>{manager.firstName} {manager.lastName}</a> : '—'}</dd>
          <span>{manager ? data.fn(manager.functionId)?.name : 'Aucun responsable direct'}</span>
        </div>
      </dl>

      {(absence || today.unplanned || !circuit || employee.status === 'inactif') && (
        <ul className="emp-alerts">
          {employee.status === 'inactif' && <li className="muted"><UserRound size={14} aria-hidden /> Employé inactif : il ne peut plus déposer de demande, son dossier est conservé.</li>}
          {absence && <li className="info"><CalendarCheck size={14} aria-hidden /> En congé jusqu’au {formatDayMonth(absence.end)} inclus.</li>}
          {today.unplanned && <li className="danger"><AlertTriangle size={14} aria-hidden /> Non planifié aujourd’hui dans le tableau de chargement. <button type="button" className="link-btn" onClick={() => onTab('temps')}>Voir les périodes</button></li>}
          {!circuit && <li className="danger"><AlertTriangle size={14} aria-hidden /> Le département n’a pas de circuit d’approbation : les demandes ne peuvent pas être validées.</li>}
        </ul>
      )}
    </>
  );
}

// ------------------------------------------------------------------ Vue d'ensemble

/** Ligne libellé / valeur, avec une valeur vide explicite. */
function Item({ label, children, wide }: { label: string; children?: ReactNode; wide?: boolean }) {
  const empty = children === undefined || children === null || children === '';
  return (
    <div className={`emp-item ${wide ? 'wide' : ''}`}>
      <dt>{label}</dt>
      <dd className={empty ? 'empty' : ''}>{empty ? 'Non renseigné' : children}</dd>
    </div>
  );
}

export function OverviewTab({ employee, profile, onTab }: { employee: Employee; profile: LeaveProfile; onTab: (t: EmployeeTab) => void }) {
  const data = useCompanyData();
  const salary = currentSalary(employee);
  const primes = employee.primes.map((p) => data.prime(p.primeId)).filter(Boolean);
  const recent = [...employee.history].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
  const age = employee.birthDate ? Math.floor(diffDays(employee.birthDate, TODAY) / 365.25) : undefined;

  return (
    <div className="emp-layout">
      <div className="emp-main">
        <FormCard icon={<UserRound size={16} />} title="Identité et situation familiale">
          <dl className="emp-grid">
            <Item label="Prénom">{employee.firstName}</Item>
            <Item label="Nom">{employee.lastName}</Item>
            <Item label="Date de naissance">{employee.birthDate && <>{formatDate(employee.birthDate)} <span className="text-muted">· {age} ans</span></>}</Item>
            <Item label="Matricule"><span className="mono">{employee.matricule}</span></Item>
            <Item label="Situation familiale">{MARITAL_LABEL[employee.maritalStatus]}</Item>
            <Item label="Enfants à charge">{employee.childrenCount === 0 ? 'Aucun' : employee.childrenCount}</Item>
          </dl>
        </FormCard>

        <FormCard icon={<Briefcase size={16} />} title="Poste et rattachement" subtitle="L’horaire et le circuit d’approbation découlent du rattachement.">
          <dl className="emp-grid">
            <Item label="Fonction">
              {data.fn(employee.functionId)?.name}
              {data.fn(employee.functionId)?.interim && <span className="emp-sub">Intérim {data.fn(employee.functionId)?.kind}</span>}
            </Item>
            <Item label="Département">
              {data.department(employee.departmentId)?.name}
              {employee.subDepartmentId && <span className="emp-sub">Sous-département : {data.department(employee.subDepartmentId)?.name}</span>}
            </Item>
            <Item label="Mode horaire">
              {employee.scheduleMode === 'organisation' ? 'Organisationnel' : 'Tableau de chargement'}
              <button type="button" className="emp-sub link-btn" onClick={() => onTab('temps')}>Voir le temps de travail</button>
            </Item>
            <Item label="Circuit d’approbation">
              {data.circuit(profile.circuitId)?.name}
              <button type="button" className="emp-sub link-btn" onClick={() => onTab('conges')}>Voir les approbateurs</button>
            </Item>
          </dl>
        </FormCard>

        <FormCard icon={<FileSignature size={16} />} title="Contrat et rémunération"
          actions={<button type="button" className="btn btn-sm btn-ghost" onClick={() => onTab('remuneration')}>Détail <ChevronRight size={13} aria-hidden /></button>}>
          <dl className="emp-grid">
            <Item label="Type de contrat">{employee.contract}{employee.contractEnd && <span className="emp-sub">Jusqu’au {formatDate(employee.contractEnd)}{employee.contractEnd < TODAY ? ' (échu)' : ''}</span>}</Item>
            <Item label="Date d’embauche">{formatDate(employee.hireDate)} <span className="text-muted">· {seniority(employee.hireDate)}</span></Item>
            <Item label="Salaire de base">{salary && <><strong>{formatMoney(salary.amount, data.currency)}</strong> <span className="text-muted">/ mois</span><span className="emp-sub">Depuis le {formatDate(salary.since)}</span></>}</Item>
            <Item label="Primes">
              {!employee.allowPrimes ? <span className="text-muted">Non autorisées</span>
                : primes.length === 0 ? <span className="text-muted">Autorisées, aucune attribuée</span>
                : <span className="emp-chips">{primes.map((p) => <span key={p!.id} className="emp-chip">{p!.name} · {formatMoney(p!.amount, data.currency)} <span className="text-muted">({PRIME_PERIODICITY[p!.periodicity].toLowerCase()})</span></span>)}</span>}
            </Item>
          </dl>
        </FormCard>
      </div>

      <aside className="emp-aside">
        <FormCard icon={<AtSign size={16} />} title="Coordonnées">
          <ul className="emp-contact">
            <li><AtSign size={14} aria-hidden /><a className="link" href={`mailto:${employee.email}`}>{employee.email}</a></li>
            <li><Phone size={14} aria-hidden />{formatPhone(data.country(employee.phoneCountryId), employee.phone) || <span className="text-muted">Non renseigné</span>}</li>
            <li><MapPin size={14} aria-hidden />{employee.address || <span className="text-muted">Non renseignée</span>}</li>
          </ul>
        </FormCard>

        <FormCard icon={<KeyRound size={16} />} title="Compte utilisateur"
          actions={<button type="button" className="btn btn-sm btn-ghost" onClick={() => onTab('acces')}>Accès <ChevronRight size={13} aria-hidden /></button>}>
          <dl className="emp-grid one">
            <Item label="Accès">{employee.account.active ? <Badge tone="success">Actif</Badge> : <Badge tone="muted">Désactivé</Badge>}</Item>
            <Item label="Identifiant">{employee.account.login && <span className="mono">{employee.account.login}</span>}</Item>
            <Item label="Rôle">{data.role(profile.roleId)?.name}</Item>
            <Item label="Dernière connexion">{employee.account.lastLogin ? formatDateTime(employee.account.lastLogin) : 'Jamais'}</Item>
          </dl>
        </FormCard>

        <FormCard icon={<History size={16} />} title="Activité récente"
          actions={<button type="button" className="btn btn-sm btn-ghost" onClick={() => onTab('historique')}>Tout voir <ChevronRight size={13} aria-hidden /></button>}>
          {recent.length === 0 ? <p className="fempty">Aucun événement.</p> : (
            <ol className="emp-feed">
              {recent.map((h, i) => (
                <li key={i}><span className="emp-feed-date">{formatDate(h.at)}</span><span>{h.label}</span></li>
              ))}
            </ol>
          )}
        </FormCard>
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ Temps de travail

const WEEK = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const slotMinutes = (s: TimeSlot) => { const d = toMinutes(s.end) - toMinutes(s.start); return d > 0 ? d : d + 24 * 60; };
const fmtH = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`;

/** Semaine type d'un horaire : créneaux par jour travaillé, repos sinon. */
function WeekPlan({ schedule, workDays }: { schedule: Schedule; workDays: number[] }) {
  const perDay = schedule.slots.reduce((sum, s) => sum + slotMinutes(s), 0);
  return (
    <>
      <ul className="emp-week">
        {WEEK.map((d, i) => {
          const on = workDays.includes(i + 1);
          return (
            <li key={d} className={on ? '' : 'off'}>
              <span className="emp-week-day">{d}</span>
              {on ? (
                <span className="emp-week-slots">
                  {schedule.slots.map((s, k) => (
                    <span key={k} className={`emp-slot ${toMinutes(s.end) < toMinutes(s.start) ? 'night' : ''}`}>
                      {toMinutes(s.end) < toMinutes(s.start) && <Moon size={11} aria-hidden />}{s.start}–{s.end}
                    </span>
                  ))}
                </span>
              ) : <span className="emp-week-rest">Repos</span>}
              <span className="emp-week-total">{on ? fmtH(perDay) : '—'}</span>
            </li>
          );
        })}
      </ul>
      <p className="emp-week-foot">
        <Coffee size={12} aria-hidden /> {schedule.slots.length > 1 ? `${schedule.slots.length} créneaux par jour` : '1 créneau par jour'}
        <span aria-hidden> · </span>{fmtH(perDay * workDays.length)} par semaine{schedule.weeklyHours ? ` (volume déclaré : ${schedule.weeklyHours.toLocaleString('fr-FR')} h)` : ''}
      </p>
    </>
  );
}

export function WorkTimeTab({ employee, onSwitch }: { employee: Employee; onSwitch: () => void }) {
  const { db } = useStore();
  const data = useCompanyData();
  const now = scheduleOn(db, employee);
  const loading = employee.scheduleMode === 'chargement';
  const periods = periodsOf(db, employee.id).sort((a, b) => b.start.localeCompare(a.start));
  const gaps = uncoveredRanges(db, employee);

  return (
    <div className="fstack">
      <FormCard icon={<Clock size={16} />} title="Mode horaire"
        subtitle={loading
          ? `Tableau de chargement depuis le ${employee.loadingSince ? formatDate(employee.loadingSince) : '—'} : l’horaire est planifié par périodes, sans retour automatique au département.`
          : `Horaire organisationnel : hérité — ${now.source}.`}
        actions={<button type="button" className="btn btn-sm btn-ghost" disabled={employee.status === 'inactif'} onClick={onSwitch}>{loading ? 'Revenir à l’horaire du département' : 'Passer au tableau de chargement'}</button>}>
        {now.schedule ? (
          <>
            <p className="emp-schedule-name"><strong>{now.schedule.name}</strong>{now.period && <span className="text-muted"> — période « {now.period.label} », {formatRange(now.period.start, now.period.end)}</span>}</p>
            <WeekPlan schedule={now.schedule} workDays={workDaysFor(employee, now.schedule, !now.period)} />
          </>
        ) : (
          <p className="fempty">{now.unplanned ? 'Aucune période en cours : l’employé est « Non planifié » aujourd’hui.' : 'Aucun horaire défini pour ce rattachement.'}</p>
        )}
      </FormCard>

      {loading && (
        <FormCard icon={<CalendarClock size={16} />} title="Périodes planifiées" subtitle="Tableau de chargement : un horaire actif par période, sans chevauchement."
          actions={<a className="btn btn-sm btn-ghost" href="#/chargement">Ouvrir le tableau de chargement <ChevronRight size={13} aria-hidden /></a>}>
          {gaps.length > 0 && (
            <p className="emp-gap"><AlertTriangle size={14} aria-hidden /> Non planifié sur les 30 prochains jours : {gaps.map((g) => formatRange(g.start, g.end)).join(' · ')}</p>
          )}
          {periods.length === 0 ? <p className="fempty">Aucune période planifiée.</p> : (
            <ol className="emp-periods">
              {periods.map((p) => {
                const state = p.end < TODAY ? 'past' : p.start <= TODAY ? 'current' : 'next';
                return (
                  <li key={p.id} className={state}>
                    <span className="emp-period-dates">{formatRange(p.start, p.end)}</span>
                    <span className="emp-period-main"><strong>{p.label}</strong><span className="text-muted"> · {data.schedule(p.scheduleId)?.name}</span>{p.reason && <span className="emp-sub">{p.reason}</span>}</span>
                    <Badge tone={state === 'current' ? 'success' : state === 'next' ? 'info' : 'muted'}>{state === 'current' ? 'En cours' : state === 'next' ? 'À venir' : 'Terminée'}</Badge>
                  </li>
                );
              })}
            </ol>
          )}
        </FormCard>
      )}
    </div>
  );
}

