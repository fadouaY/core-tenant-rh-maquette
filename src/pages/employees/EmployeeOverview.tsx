// Fiche employé — en-tête, vue d'ensemble (RH-4) et temps de travail (RH-6, RH-21, RH-24).
// Ordre de lecture : qui est-ce et où en est-il (en-tête, repères, alertes), puis le détail par thème.
import type { ReactNode } from 'react';
import {
  AlertTriangle, AtSign, Briefcase, Building2, CalendarCheck, CalendarClock, ChevronRight, Clock, FileSignature, FileText, History, KeyRound,
  MapPin, Moon, Paperclip, Phone, Sunrise, Sunset, UserRound, Users, Wallet,
} from 'lucide-react';
import { useCompanyData, useStore } from '../../store';
import { Avatar, Badge, EmployeeStatusBadge } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import type { Employee, LeaveProfile, Prime, Role, Schedule, TimeSlot } from '../../types';
import { diffDays, formatDate, formatDateTime, formatDayMonth, formatRange, TODAY } from '../../utils/dates';
import { dayHours, formatDaysHours, slotDays, slotMinutes, slotsOn, toMinutes } from '../../utils/hours';
import { getAnnualBalance, profileRoleIds } from '../../utils/leave';
import {
  circuitForDepartment, currentSalary, formatMoney, MARITAL_LABEL, organisationalSchedule, periodsOf, scheduleOn, uncoveredRanges,
} from '../../utils/org';
import { formatPhone } from '../../utils/phone';
import { hrStatusOf } from '../../utils/status';
import { CONTRACT_KIND_LABEL, CONTRACT_STATUS, contractsOf, contractStatus, effectiveEnd } from '../../utils/contracts';
import { PERMISSIONS } from '../../data/mock';
import { PRIME_PERIODICITY } from './EmployeeSections';

export type EmployeeTab = 'apercu' | 'infos' | 'temps' | 'contrats' | 'documents' | 'conges' | 'remuneration' | 'acces' | 'historique';

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
            <EmployeeStatusBadge status={employee.status} hr={hrStatusOf(employee)} />
            <Badge tone="neutral">{employee.contract}</Badge>
            {profileRoleIds(profile).map((id) => <Badge key={id} tone="primary" icon={<KeyRound size={11} aria-hidden />}>{data.role(id)?.name}</Badge>)}
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

// ------------------------------------------------------------------ Vue d'ensemble (rapport de la fiche)

/** Information du rapport : libellé au-dessus de la valeur ; une valeur vide est signalée explicitement. */
function Row({ label, children, hint, wide }: { label: string; children?: ReactNode; hint?: ReactNode; wide?: boolean }) {
  const empty = children === undefined || children === null || children === '' || children === false;
  return (
    <div className={`rp-row ${wide ? 'wide' : ''}`}>
      <dt>{label}</dt>
      <dd className={empty ? 'is-empty' : ''}>
        {empty ? 'Non renseigné' : children}
        {!empty && hint && <span className="rp-hint">{hint}</span>}
      </dd>
    </div>
  );
}

/** Section du rapport : titre, lien vers l'onglet où l'on modifie, contenu. */
function Section({ icon, title, children, onOpen, openLabel = 'Gérer' }: {
  icon: ReactNode; title: string; children: ReactNode; onOpen?: () => void; openLabel?: string;
}) {
  return (
    <section className="rp-sec">
      <header className="rp-sec-head">
        <span className="rp-sec-icon" aria-hidden>{icon}</span>
        <h3>{title}</h3>
        {onOpen && <button type="button" className="rp-sec-link" onClick={onOpen}>{openLabel} <ChevronRight size={12} aria-hidden /></button>}
      </header>
      {children}
    </section>
  );
}

export function OverviewTab({ employee, profile, onTab }: { employee: Employee; profile: LeaveProfile; onTab: (t: EmployeeTab) => void }) {
  const { db } = useStore();
  const data = useCompanyData();
  const fn = data.fn(employee.functionId);
  const links = fn ? data.functionLinks.filter((l) => !l.archived && l.functionIds.includes(fn.id)) : [];
  const manager = data.employee(employee.managerId);
  const now = scheduleOn(db, employee);
  const loading = employee.scheduleMode === 'chargement';
  const weekly = loading ? employee.weeklyHours
    : now.schedule ? now.schedule.weeklyHours ?? Math.round(dayHours(now.schedule) * workDaysFor(employee, now.schedule).length * 10) / 10 : undefined;
  const circuit = circuitForDepartment(db, employee.departmentId);
  const approvers = profile.approverIds.map((id) => data.employee(id)).filter((e): e is Employee => !!e);
  const salary = currentSalary(employee);
  const primes = employee.primes.map((p) => data.prime(p.primeId)).filter((p): p is Prime => !!p);
  const primesMonthly = primes.reduce((s, p) => s + (p.periodicity === 'mensuelle' ? p.amount : 0), 0);
  const balance = getAnnualBalance(db, employee.id);
  const requests = data.requests.filter((r) => r.employeeId === employee.id);
  const pending = requests.filter((r) => r.status === 'en_attente').length;
  const nextLeave = requests.filter((r) => r.status === 'approuve' && r.start > TODAY).sort((a, b) => a.start.localeCompare(b.start))[0];
  const user = db.users.find((u) => u.id === employee.account.userId) ?? db.users.find((u) => u.employeeLinks[employee.companyId] === employee.id);
  const roles = profileRoleIds(profile).map((id) => data.role(id)).filter((r): r is Role => !!r);
  const perms = new Set([...roles.flatMap((r) => r.permissions), ...profile.extraPermissions]);
  profile.removedPermissions.forEach((k) => perms.delete(k));
  const docs = employee.documents ?? [];
  const requiredTypes = data.documentTypes.filter((t) => !t.archived && t.required);
  const missingDocs = requiredTypes.filter((t) => !docs.some((d) => d.typeId === t.id));
  const contracts = contractsOf(employee);
  const age = employee.birthDate ? Math.floor(diffDays(employee.birthDate, TODAY) / 365.25) : undefined;
  const recent = [...employee.history].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);
  const phone = formatPhone(data.country(employee.phoneCountryId), employee.phone);

  // Complétude du dossier : informations attendues dans une fiche complète.
  const checks: [string, boolean][] = [
    ['Matricule société', !!employee.companyMatricule], ['Date de naissance', !!employee.birthDate], ['Téléphone', !!employee.phone],
    ['Adresse', !!employee.address], ['Responsable N+1', !!manager], ['Compte utilisateur', !!user],
    ...requiredTypes.map((t): [string, boolean] => [t.name, docs.some((d) => d.typeId === t.id)]),
  ];
  const done = checks.filter(([, ok]) => ok).length;
  const pct = Math.round((done / checks.length) * 100);
  const missing = checks.filter(([, ok]) => !ok).map(([l]) => l);

  return (
    <div className="rp">
      <div className={`rp-complete ${pct === 100 ? 'ok' : ''}`}>
        <div className="rp-complete-main">
          <span className="rp-complete-pct">{pct} %</span>
          <span className="rp-complete-text">
            <strong>Complétude du dossier</strong>
            <span className="rp-hint">{done} élément{done > 1 ? 's' : ''} sur {checks.length} renseigné{done > 1 ? 's' : ''}</span>
          </span>
          <span className="rp-meter" aria-hidden><span style={{ width: `${pct}%` }} /></span>
        </div>
        {missing.length > 0 && (
          <div className="rp-missing"><span>À compléter :</span>{missing.map((m) => <span key={m} className="rp-tag warn">{m}</span>)}</div>
        )}
      </div>

      <div className="rp-grid">
        <div className="rp-col">
          <Section icon={<UserRound size={14} />} title="Identité et état civil" onOpen={() => onTab('infos')} openLabel="Infos générales">
            <dl className="rp-list">
              <Row label="Matricule application"><span className="mono">{employee.matricule}</span></Row>
              <Row label="Matricule société">{employee.companyMatricule && <span className="mono">{employee.companyMatricule}</span>}</Row>
              <Row label="Date de naissance" hint={age !== undefined ? `${age} ans` : undefined}>{employee.birthDate && formatDate(employee.birthDate)}</Row>
              <Row label="Situation familiale">{MARITAL_LABEL[employee.maritalStatus]}</Row>
              <Row label="Enfants à charge">{employee.childrenCount === 0 ? 'Aucun' : employee.childrenCount}</Row>
            </dl>
          </Section>

          <Section icon={<Briefcase size={14} />} title="Poste et rattachement">
            <dl className="rp-list cols-4">
              <Row label="Fonction">
                {fn?.name}
                {fn && (
                  <span className="rp-tags">
                    <span className={`rp-tag ${fn.interim ? 'info' : ''}`}>{fn.interim ? `Intérim ${fn.kind}` : 'Sans intérim'}</span>
                    {fn.interim && fn.kind === 'groupe' && fn.minPresent ? <span className="rp-tag">Min. {fn.minPresent} présent(s)</span> : null}
                    {links.map((l) => <span key={l.id} className="rp-tag">{l.name}</span>)}
                  </span>
                )}
              </Row>
              <Row label="Département" hint={employee.subDepartmentId ? `› ${data.department(employee.subDepartmentId)?.name}` : undefined}>{data.department(employee.departmentId)?.name}</Row>
              <Row label="Responsable N+1" hint={manager ? data.fn(manager.functionId)?.name : undefined}>
                {manager && <a className="link" href={`#/employes/${manager.id}`}>{manager.firstName} {manager.lastName}</a>}
              </Row>
              <Row label="Date d’embauche" hint={seniority(employee.hireDate)}>{formatDate(employee.hireDate)}</Row>
            </dl>
          </Section>

          <Section icon={<Clock size={14} />} title="Horaire et approbation" onOpen={() => onTab('temps')} openLabel="Horaire">
            <dl className="rp-list">
              <Row label="Mode horaire" hint={loading ? (employee.loadingSince ? `Depuis le ${formatDate(employee.loadingSince)}` : undefined) : 'Hérité du rattachement'}>
                {loading ? 'Tableau de chargement' : 'Organisationnel'}
              </Row>
              <Row label="Horaire en vigueur" hint={now.schedule ? now.schedule.slots.map((s) => `${s.start}–${s.end}`).join(' · ') : undefined}>
                {now.schedule ? now.schedule.name : now.unplanned ? <Badge tone="danger">Non planifié</Badge> : undefined}
              </Row>
              <Row label={loading ? 'Régime contractuel' : 'Volume hebdo.'}>{weekly ? `${weekly.toLocaleString('fr-FR')} h` : undefined}</Row>
              <Row label="Circuit d’approbation" wide>
                {circuit ? (
                  <span className="rp-circuit">
                    <span className="rp-circuit-name">{circuit.name}</span>
                    {circuit.exempt ? <span className="rp-tag">Dispensé</span>
                      : approvers.length > 0 && <ol className="rp-steps">{approvers.map((a, i) => <li key={a.id}><span>{i + 1}</span>{a.firstName} {a.lastName}</li>)}</ol>}
                  </span>
                ) : <Badge tone="danger">Aucun circuit actif</Badge>}
              </Row>
            </dl>
          </Section>

          <Section icon={<FileSignature size={14} />} title="Contrats" onOpen={() => onTab('contrats')} openLabel="Contrats">
            <table className="rp-table">
              <thead><tr><th>Type</th><th>Début</th><th>Fin</th><th>État</th></tr></thead>
              <tbody>
                {contracts.map((c) => {
                  const st = CONTRACT_STATUS[contractStatus(c)];
                  return (
                    <tr key={c.id}>
                      <td><strong>{c.type}</strong><span className="rp-hint">{CONTRACT_KIND_LABEL[c.kind ?? 'nouveau']}</span></td>
                      <td>{c.start ? formatDate(c.start) : '—'}</td>
                      <td>{effectiveEnd(c) ? formatDate(effectiveEnd(c)!) : <span className="text-muted">Indéterminée</span>}</td>
                      <td><Badge tone={st.tone}>{st.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Section>

          <Section icon={<FileText size={14} />} title="Documents" onOpen={() => onTab('documents')} openLabel="Documents">
            {docs.length === 0 ? <p className="rp-empty">Aucun document joint au dossier.</p> : (
              <table className="rp-table">
                <thead><tr><th>Type</th><th>Fichier</th><th>Ajouté le</th><th>Expiration</th></tr></thead>
                <tbody>
                  {docs.map((d) => {
                    const expired = !!d.expiresAt && d.expiresAt < TODAY;
                    return (
                      <tr key={d.id}>
                        <td><strong>{data.documentTypes.find((t) => t.id === d.typeId)?.name ?? '—'}</strong></td>
                        <td className="rp-file"><Paperclip size={12} aria-hidden /> {d.fileName}</td>
                        <td>{formatDate(d.addedAt)}</td>
                        <td>{d.expiresAt ? <Badge tone={expired ? 'danger' : 'neutral'}>{expired ? 'Expiré le ' : ''}{formatDate(d.expiresAt)}</Badge> : <span className="text-muted">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {missingDocs.length > 0 && (
              <p className="rp-alert"><AlertTriangle size={13} aria-hidden /> Pièces obligatoires manquantes : {missingDocs.map((t) => t.name).join(', ')}.</p>
            )}
          </Section>
        </div>

        <div className="rp-col">
          <Section icon={<AtSign size={14} />} title="Coordonnées">
            <ul className="rp-contact">
              <li><AtSign size={13} aria-hidden /><a className="link" href={`mailto:${employee.email}`}>{employee.email}</a></li>
              <li><Phone size={13} aria-hidden />{phone || <span className="rp-missing-val">Téléphone non renseigné</span>}</li>
              <li><MapPin size={13} aria-hidden />{employee.address || <span className="rp-missing-val">Adresse non renseignée</span>}</li>
            </ul>
          </Section>

          <Section icon={<Wallet size={14} />} title="Rémunération" onOpen={() => onTab('remuneration')} openLabel="Rémunération">
            <div className="rp-figure">
              <span className="rp-figure-value">{salary ? formatMoney(salary.amount, data.currency) : '—'}<small> brut / mois</small></span>
              {salary && <span className="rp-hint">Depuis le {formatDate(salary.since)}</span>}
            </div>
            <div className="rp-sub">
              <span className="rp-sub-label">Primes</span>
              {!employee.allowPrimes ? <span className="text-muted">Non autorisées</span>
                : primes.length === 0 ? <span className="text-muted">Autorisées, aucune attribuée</span>
                : <ul className="rp-primes">{primes.map((p) => <li key={p.id}><span>{p.name} <small>{PRIME_PERIODICITY[p.periodicity].toLowerCase()}</small></span><span>{formatMoney(p.amount, data.currency)}</span></li>)}</ul>}
              {primesMonthly > 0 && salary && <p className="rp-total"><span>Total mensuel estimé</span><strong>{formatMoney(salary.amount + primesMonthly, data.currency)}</strong></p>}
            </div>
          </Section>

          <Section icon={<CalendarCheck size={14} />} title="Congés" onOpen={() => onTab('conges')} openLabel="Congés">
            <div className="rp-kpis">
              <div><span className={balance.available < 0 ? 'danger' : ''}>{balance.tracked ? formatDaysHours(balance.available, dayHours(now.schedule)) : '—'}</span><small>Disponible</small></div>
              <div><span>{balance.tracked ? `${balance.taken.toLocaleString('fr-FR')} j` : '—'}</span><small>Pris</small></div>
              <div><span className={pending ? 'warn' : ''}>{pending}</span><small>En attente</small></div>
            </div>
            <p className="rp-foot">{nextLeave ? <>Prochain congé : <strong>{formatRange(nextLeave.start, nextLeave.end)}</strong></> : 'Aucun congé à venir.'}</p>
          </Section>

          <Section icon={<KeyRound size={14} />} title="Compte, rôles et permissions" onOpen={() => onTab('acces')} openLabel="Rôles et permissions">
            <div className="rp-account">
              {user ? (
                <span className="rp-user">
                  <Avatar employee={user} size={28} />
                  <span><strong>{user.firstName} {user.lastName}</strong><span className="rp-hint mono">{user.login}</span></span>
                </span>
              ) : <span className="rp-missing-val">Aucun utilisateur core tenant associé</span>}
              {!employee.account.active ? <Badge tone="muted">Accès désactivé</Badge> : user?.status === 'invite' ? <Badge tone="warning">Invité</Badge> : <Badge tone="success">Accès actif</Badge>}
            </div>
            <dl className="rp-list cols-2">
              <Row label={roles.length > 1 ? 'Rôles' : 'Rôle'} wide>
                {roles.length > 0 && <span className="rp-tags">{roles.map((r, i) => <span key={r.id} className={`rp-tag ${i === 0 ? 'primary' : ''}`}>{r.name}{i === 0 && roles.length > 1 ? ' · principal' : ''}</span>)}</span>}
              </Row>
              <Row label="Permissions" hint={profile.extraPermissions.length ? `dont ${profile.extraPermissions.length} hors rôle` : undefined}>{`${perms.size} / ${PERMISSIONS.length}`}</Row>
              <Row label="Dernière connexion">{employee.account.lastLogin ? formatDateTime(employee.account.lastLogin) : <span className="text-muted">Jamais</span>}</Row>
            </dl>
          </Section>

          <Section icon={<History size={15} />} title="Activité récente" onOpen={() => onTab('historique')} openLabel="Historique">
            {recent.length === 0 ? <p className="rp-empty">Aucun événement.</p> : (
              <ol className="emp-feed rp-pad">
                {recent.map((h, i) => <li key={i}><span className="emp-feed-date">{formatDate(h.at)}</span><span>{h.label}</span></li>)}
              </ol>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Horaire

const WEEK = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const WEEK_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const fmtH = (min: number) => `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`;
/** Pictogramme du créneau selon son heure de début : matin, après-midi, nuit. */
const slotIcon = (s: TimeSlot) => {
  const start = toMinutes(s.start);
  if (toMinutes(s.end) < start || start >= 20 * 60) return <Moon size={13} aria-hidden />;
  return start < 12 * 60 ? <Sunrise size={13} aria-hidden /> : <Sunset size={13} aria-hidden />;
};

/** Horaire détaillé : en-tête (nom, source, volume), créneaux quotidiens, répartition de la semaine. */
function SchedulePanel({ schedule, workDays, mode, source, status }: {
  schedule: Schedule; workDays: number[]; mode: 'organisation' | 'chargement'; source: ReactNode; status: ReactNode;
}) {
  // Chaque créneau s'applique à ses propres jours : heures par jour et volume en découlent.
  const minutesOn = (day: number) => (workDays.includes(day) ? slotsOn(schedule, day).reduce((sum, s) => sum + slotMinutes(s), 0) : 0);
  const total = WEEK.reduce((sum, _, i) => sum + minutesOn(i + 1), 0);
  const worked = WEEK.filter((_, i) => minutesOn(i + 1) > 0).length;
  const weekly = schedule.weeklyHours ?? Math.round(total / 6) / 10;
  const daysLabel = (days: number[]) => {
    const sorted = [...days].sort();
    const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
    return consecutive && sorted.length > 2 ? `${WEEK[sorted[0] - 1]}–${WEEK[sorted[sorted.length - 1] - 1]}` : sorted.map((d) => WEEK[d - 1]).join(', ');
  };
  return (
    <div className="hr-panel">
      <div className="hr-panel-head">
        <div className="hr-panel-title">
          <span className={`hr-mode-tag ${mode}`}>{mode === 'organisation' ? 'Organisationnel' : 'Tableau de chargement'}</span>
          <strong>{schedule.name}</strong>
          <span className="hr-source"><Building2 size={12} aria-hidden /> {source}</span>
        </div>
        <div className="hr-panel-badges">
          <span className="hr-hours"><Clock size={12} aria-hidden /> {weekly.toLocaleString('fr-FR')} h / semaine</span>
          {status}
        </div>
      </div>

      <p className="hr-label">Créneaux horaires</p>
      <ul className="hr-slots">
        {schedule.slots.map((s, i) => (
          <li key={i}>
            <span className="hr-slot-icon">{slotIcon(s)}</span>
            <span className="hr-slot-name">{s.label || `Créneau ${i + 1}`}<span className="hr-slot-days">{daysLabel(slotDays(schedule, s))}</span></span>
            <span className="hr-slot-time">{s.start} <span aria-hidden>→</span> {s.end}</span>
            <span className="hr-slot-dur">{fmtH(slotMinutes(s))}</span>
          </li>
        ))}
      </ul>

      <p className="hr-label">Répartition hebdomadaire des jours</p>
      <ul className="hr-days">
        {WEEK.map((d, i) => {
          const min = minutesOn(i + 1);
          return (
            <li key={d} className={min ? 'on' : 'off'} title={`${WEEK_LONG[i]} : ${min ? `travaillé, ${fmtH(min)}` : 'repos'}`}>
              <span className="hr-day">{d}</span>
              <span className="hr-day-state">{min ? fmtH(min) : 'Repos'}</span>
            </li>
          );
        })}
      </ul>
      <p className="hr-foot">
        {worked} jour{worked > 1 ? 's' : ''} travaillé{worked > 1 ? 's' : ''} · {fmtH(total)} par semaine
        {schedule.slots.length > 1 ? ` en ${schedule.slots.length} créneaux` : ''}
      </p>
    </div>
  );
}

export function WorkTimeTab({ employee, onSwitch }: { employee: Employee; onSwitch: () => void }) {
  const { db } = useStore();
  const data = useCompanyData();
  const now = scheduleOn(db, employee);
  const org = organisationalSchedule(db, employee.departmentId, employee.subDepartmentId);
  const loading = employee.scheduleMode === 'chargement';
  const periods = periodsOf(db, employee.id).sort((a, b) => b.start.localeCompare(a.start));
  const gaps = uncoveredRanges(db, employee);
  const inactive = employee.status === 'inactif';

  return (
    <div className="fstack">
      <FormCard icon={<Clock size={16} />} title="Rattachement organisationnel et mode d’horaire"
        actions={<span className={`hr-mode-tag ${loading ? 'chargement' : 'organisation'}`}>{loading ? 'Tableau de chargement' : 'Organisationnel'}</span>}>
        <div className="hr-mode">
          <p className="hr-mode-title">Mode de gestion de l’horaire de travail</p>
          <div className="hr-mode-options" role="radiogroup" aria-label="Mode d’horaire">
            <label className={`hr-mode-option ${!loading ? 'checked' : ''} ${inactive ? 'disabled' : ''}`}>
              <input type="radio" name="hr-mode" checked={!loading} disabled={inactive} onChange={() => loading && onSwitch()} />
              <span><strong>Horaire organisationnel</strong> <span className="text-muted">(par défaut — hérité du département ou du sous-département)</span></span>
            </label>
            <label className={`hr-mode-option ${loading ? 'checked' : ''} ${inactive ? 'disabled' : ''}`}>
              <input type="radio" name="hr-mode" checked={loading} disabled={inactive} onChange={() => !loading && onSwitch()} />
              <span><strong>Tableau de chargement</strong> <span className="text-muted">(géré par les rotations du planning)</span></span>
            </label>
          </div>
          <p className="hr-mode-hint">
            {loading
              ? <>Depuis le <strong>{employee.loadingSince ? formatDate(employee.loadingSince) : '—'}</strong>{employee.weeklyHours ? <> · régime contractuel <strong>{employee.weeklyHours.toLocaleString('fr-FR')} h / semaine</strong></> : null} — pas de retour automatique à l’horaire du département.</>
              : 'Changer de mode demande une date d’effet ; le changement est inscrit dans l’historique.'}
          </p>

          {now.schedule ? (
            <SchedulePanel schedule={now.schedule} workDays={workDaysFor(employee, now.schedule, !now.period)}
              mode={loading ? 'chargement' : 'organisation'}
              source={now.period ? <>Période « {now.period.label} » · {formatRange(now.period.start, now.period.end)}</> : <><strong>Source :</strong> {now.source}</>}
              status={<Badge tone="success">Actif</Badge>} />
          ) : (
            <p className="hr-empty"><AlertTriangle size={14} aria-hidden /> {now.unplanned ? 'Aucune période en cours : l’employé est « Non planifié » aujourd’hui.' : 'Aucun horaire défini pour ce rattachement.'}</p>
          )}
          {loading && org.schedule && (
            <p className="hr-mode-hint">Horaire du département (non appliqué) : <strong>{org.schedule.name}</strong> — {org.source}.</p>
          )}
        </div>
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
