// État local de la maquette « Application RH » : tout est en mémoire et se réinitialise au rechargement.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { initialDatabase } from './data/mock';
import { ensureAdminEmployee, provisionRh } from './core/provisioning';
import type {
  AppAssignment, ApprovalCircuit, Company, Database, PresencePolicy, DayPart, Employee, EmployeeHistoryEntry, EmployeeNumbering, HrEvent, ID, ISODate,
  LeaveProfile, LeaveRequest, LoadingPeriod, Role, Salary, Schedule, ScheduleMode, TenantUser,
} from './types';
import { formatDate, formatRange, nowStamp } from './utils/dates';
import { countLeaveDays, deriveProfiles, toPersonView } from './utils/leave';
import { circuitForDepartment, currencyOf, formatMoney, historyEntry, MARITAL_LABEL, nextMatricule, numberingOf, organisationalSchedule, rootDepartment, scheduleOn } from './utils/org';
import { countAuthorization } from './utils/hours';

export type CollectionKey =
  | 'departments' | 'functions' | 'functionLinks' | 'schedules' | 'leaveTypes' | 'leaveRules' | 'holidays' | 'countries' | 'roles' | 'circuits' | 'events' | 'primes' | 'documentTypes';

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'info' | 'danger';
}

export interface NewLeaveInput {
  employeeId: ID;
  leaveTypeId: ID;
  start: string;
  end: string;
  startPart: DayPart;
  endPart: DayPart;
  comment: string;
  attachment?: string;
  /** Autorisation en heures (même jour). */
  startTime?: string;
  endTime?: string;
}

interface StoreValue {
  db: Database;
  companyId: ID;
  setCompanyId: (id: ID) => void;
  /** Fiche employé de l'utilisateur dans l'application RH (l'administrateur RH de la société). */
  currentUser: Employee;
  /** Utilisateur connecté au core tenant. */
  tenantUser: TenantUser;
  /** Sociétés pour lesquelles une application est activée. */
  companiesFor: (appId: string) => Company[];
  saveCompany: (company: Company) => void;
  addUser: (user: TenantUser) => void;
  /** Session simulée (aucun mot de passe n'est vérifié ni conservé). */
  sessionUserId?: ID;
  login: (identifier: string, remember: boolean) => TenantUser | undefined;
  logout: () => void;
  /** Simulation de l'offre : modifie les quotas du tenant. */
  setQuotas: (maxCompanies: number, maxUsers: number) => void;
  /** Aperçu de l'e-mail d'identifiants à afficher (survit aux changements de page). */
  credentialsNotice?: { user: TenantUser; context?: string };
  showCredentials: (user: TenantUser, context?: string) => void;
  clearCredentials: () => void;
  updateUser: (user: TenantUser) => void;
  /** Donne ou retire l'accès d'un utilisateur à une application dans une société. */
  setAccess: (userId: ID, appId: string, companyId: ID, granted: boolean) => void;
  setAssignment: (appId: string, companyId: ID, patch: Partial<Pick<AppAssignment, 'enabled' | 'adminUserId'>>) => void;
  toasts: Toast[];
  toast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
  /** Enregistre la fiche ; les changements d'état civil, de rattachement et de statut sont historisés (RH-5, RH-6, RH-10). */
  saveEmployee: (employee: Employee, profile: LeaveProfile) => void;
  saveProfile: (profile: LeaveProfile) => void;
  /** Bascule au tableau de chargement ou retour à l'horaire organisationnel, à une date d'effet (RH-24). */
  setScheduleMode: (employeeId: ID, mode: ScheduleMode, effectiveDate: ISODate, reason: string) => void;
  /** Ajoute ou modifie une période du tableau de chargement (RH-26) ; le contrôle de chevauchement est fait avant. */
  savePeriod: (period: LoadingPeriod) => void;
  cancelPeriod: (periodId: ID) => void;
  addSalary: (employeeId: ID, salary: Salary) => void;
  /** Retirer l'autorisation révoque toutes les primes actives (RH-8). */
  setPrimesAllowed: (employeeId: ID, allowed: boolean) => void;
  assignPrime: (employeeId: ID, primeId: ID, since: ISODate) => void;
  removePrime: (employeeId: ID, primeId: ID) => void;
  /** Supprime un élément jamais utilisé (ex. prime jamais attribuée). */
  removeItem: (key: CollectionKey, id: ID) => void;
  /** Crée ou modifie un circuit ; s'il prend un département qui en avait déjà un, l'ancien est archivé (un circuit par département, RH-22). */
  saveCircuit: (circuit: ApprovalCircuit) => void;
  saveNumbering: (numbering: EmployeeNumbering) => void;
  /** Enregistre un scénario d'horaire et l'affecte aux (sous-)départements choisis ; ceux qui en sont retirés le perdent (RH-21). */
  saveSchedule: (schedule: Schedule, departmentIds: ID[]) => void;
  submitLeave: (input: NewLeaveInput) => LeaveRequest;
  decide: (requestId: ID, decision: 'approve' | 'refuse', comment: string) => void;
  cancelLeave: (requestId: ID, reason: string) => void;
  addEvent: (event: HrEvent) => void;
  updateRole: (role: Role) => void;
  setArchived: (key: CollectionKey, id: ID, archived: boolean) => void;
  addItem: <K extends CollectionKey>(key: K, item: Database[K][number]) => void;
  updateItem: <K extends CollectionKey>(key: K, item: Database[K][number]) => void;
  setPresencePolicy: (policy: PresencePolicy) => void;
  markNotificationsRead: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

let idCounter = 100;

/** Utilisé seulement si une société n'a encore aucune fiche (application RH non activée). */
const PLACEHOLDER_USER: Employee = {
  id: '', companyId: '', firstName: '?', lastName: '?', matricule: '', email: '', phone: '', birthDate: '', address: '',
  departmentId: '', functionId: '', hireDate: '', contract: 'CDI', status: 'actif', account: { login: '', active: false },
  maritalStatus: 'celibataire', childrenCount: 0, scheduleMode: 'organisation', salaries: [], allowPrimes: false, primes: [], history: [],
};
export const newId = (prefix: string) => `${prefix}${++idCounter}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setRawDb] = useState<Database>(initialDatabase);
  // Toute modification recalcule les champs dérivés des profils (horaire en vigueur, circuit, approbateurs).
  const setDb = useCallback((fn: (d: Database) => Database) => setRawDb((d) => deriveProfiles(fn(d))), []);
  const [companyId, setCompanyId] = useState<ID>('c1');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sessionUserId, setSessionUserId] = useState<ID | undefined>(() => {
    try { return localStorage.getItem('demo-session') ?? undefined; } catch { return undefined; }
  });
  const [credentialsNotice, setCredentialsNotice] = useState<{ user: TenantUser; context?: string }>();

  const tenantUser = db.users.find((u) => u.id === sessionUserId) ?? db.users.find((u) => u.id === db.tenant.ownerUserId)!;
  const companiesFor = (appId: string) => db.companies.filter((c) => !c.archived && db.assignments.some((a) => a.appId === appId && a.companyId === c.id && a.enabled));
  const rhAdmin = db.users.find((u) => u.id === db.assignments.find((a) => a.appId === 'rh' && a.companyId === companyId)?.adminUserId);
  const currentUser = db.employees.find((e) => e.id === rhAdmin?.employeeLinks[companyId])
    ?? db.employees.find((e) => e.companyId === companyId && e.status !== 'inactif')
    ?? PLACEHOLDER_USER;

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const notify = (d: Database, title: string, body: string, link?: string): Database => ({
    ...d,
    notifications: [{ id: newId('n'), companyId, at: nowStamp(), title, body, read: false, link }, ...d.notifications],
  });
  const personName = (d: Database, id: ID) => {
    const p = d.employees.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : '';
  };
  const updateRequest = (requestId: ID, fn: (r: LeaveRequest) => LeaveRequest) =>
    setDb((d) => ({ ...d, requests: d.requests.map((r) => (r.id === requestId ? fn(r) : r)) }));

  const value: StoreValue = {
    db, companyId, setCompanyId, currentUser, tenantUser, companiesFor, toasts, toast, dismissToast,

    saveCompany(company) {
      setDb((d) => ({
        ...d,
        companies: d.companies.some((c) => c.id === company.id) ? d.companies.map((c) => (c.id === company.id ? company : c)) : [...d.companies, company],
      }));
    },

    credentialsNotice,
    showCredentials(user, context) { setCredentialsNotice({ user, context }); },
    clearCredentials() { setCredentialsNotice(undefined); },

    setQuotas(maxCompanies, maxUsers) {
      setDb((d) => ({ ...d, tenant: { ...d.tenant, maxCompanies, maxUsers } }));
    },

    sessionUserId,
    login(identifier, remember) {
      const id = identifier.trim().toLowerCase();
      const user = db.users.find((u) => u.status !== 'desactive' && (u.email.toLowerCase() === id || u.login.toLowerCase() === id));
      if (!user) return undefined;
      setSessionUserId(user.id);
      try { if (remember) localStorage.setItem('demo-session', user.id); else localStorage.removeItem('demo-session'); } catch { /* facultatif */ }
      return user;
    },
    logout() {
      setSessionUserId(undefined);
      try { localStorage.removeItem('demo-session'); } catch { /* facultatif */ }
    },

    addUser(user) {
      setDb((d) => ({ ...d, users: [...d.users, user] }));
    },

    updateUser(user) {
      setDb((d) => ({ ...d, users: d.users.map((x) => (x.id === user.id ? user : x)) }));
    },

    setAccess(userId, appId, cid, granted) {
      setDb((d) => {
        const rest = d.accesses.filter((a) => !(a.userId === userId && a.appId === appId && a.companyId === cid));
        return { ...d, accesses: granted ? [...rest, { userId, appId, companyId: cid }] : rest };
      });
    },

    setAssignment(appId, cid, patch) {
      setDb((d) => {
        const existing = d.assignments.find((a) => a.appId === appId && a.companyId === cid);
        const next: AppAssignment = { appId, companyId: cid, enabled: false, activatedAt: existing?.activatedAt ?? nowStamp().slice(0, 10), ...existing, ...patch };
        if (patch.enabled && !existing?.enabled) next.activatedAt = nowStamp().slice(0, 10);
        let res: Database = {
          ...d,
          assignments: existing ? d.assignments.map((a) => (a === existing ? next : a)) : [...d.assignments, next],
        };
        // Préparation de l'application RH : socle de paramètres et fiche de l'administrateur.
        if (appId === 'rh' && next.enabled) {
          res = provisionRh(res, cid);
          if (next.adminUserId) res = ensureAdminEmployee(res, cid, next.adminUserId);
        }
        return res;
      });
    },

    saveEmployee(employee, profile) {
      setDb((d) => {
        const before = d.employees.find((e) => e.id === employee.id);
        const saved = { ...employee, history: [...changesOf(d, before, employee, currentUser.id), ...employee.history] };
        const hasProfile = d.profiles.some((p) => p.employeeId === employee.id);
        // Matricule attribué par la numérotation : le compteur passe au numéro suivant.
        const auto = !before ? nextMatricule(d, employee.companyId, employee.hireDate) : undefined;
        const numbering = auto && auto.matricule === employee.matricule ? { ...numberingOf(d, employee.companyId), next: auto.value + 1 } : undefined;
        return {
          ...d,
          numberings: numbering ? [...d.numberings.filter((n) => n.companyId !== numbering.companyId), numbering] : d.numberings,
          employees: before ? d.employees.map((e) => (e.id === employee.id ? saved : e)) : [...d.employees, saved],
          profiles: hasProfile ? d.profiles.map((p) => (p.employeeId === employee.id ? profile : p)) : [...d.profiles, profile],
        };
      });
    },

    setScheduleMode(employeeId, mode, effectiveDate, reason) {
      setDb((d) => mapEmployee(d, employeeId, (e) => {
        const motif = reason.trim() ? ` — motif : ${reason.trim()}` : '';
        const label = mode === 'chargement'
          ? `Passage au tableau de chargement à compter du ${formatDate(effectiveDate)} : fin de l’horaire hérité du département${motif}`
          : `Retour à l’horaire organisationnel à compter du ${formatDate(effectiveDate)} (${organisationalSchedule(d, e.departmentId, e.subDepartmentId).source})${motif}`;
        return {
          ...e, scheduleMode: mode, loadingSince: mode === 'chargement' ? effectiveDate : undefined,
          history: [historyEntry('horaire', label, currentUser.id, effectiveDate), ...e.history],
        };
      }));
    },

    savePeriod(period) {
      setDb((d) => {
        const exists = d.loadingPeriods.some((p) => p.id === period.id);
        const schedule = d.schedules.find((s) => s.id === period.scheduleId)?.name;
        const label = `${exists ? 'Période modifiée' : 'Période planifiée'} « ${period.label} » ${formatRange(period.start, period.end)} (${schedule})`;
        return mapEmployee({
          ...d,
          loadingPeriods: exists ? d.loadingPeriods.map((p) => (p.id === period.id ? period : p)) : [...d.loadingPeriods, period],
        }, period.employeeId, (e) => ({ ...e, history: [historyEntry('planification', label, currentUser.id), ...e.history] }));
      });
    },

    cancelPeriod(periodId) {
      setDb((d) => {
        const period = d.loadingPeriods.find((p) => p.id === periodId);
        if (!period) return d;
        return mapEmployee({ ...d, loadingPeriods: d.loadingPeriods.filter((p) => p.id !== periodId) }, period.employeeId, (e) => ({
          ...e, history: [historyEntry('planification', `Période annulée « ${period.label} » (${formatRange(period.start, period.end)})`, currentUser.id), ...e.history],
        }));
      });
    },

    addSalary(employeeId, salary) {
      setDb((d) => {
        const currency = currencyOf(d.companies.find((c) => c.id === d.employees.find((e) => e.id === employeeId)?.companyId));
        return mapEmployee(d, employeeId, (e) => ({
          ...e, salaries: [...e.salaries, salary],
          history: [historyEntry('salaire', `Salaire de base ${formatMoney(salary.amount, currency)} à compter du ${formatDate(salary.since)} — ${salary.reason}`, currentUser.id, salary.since), ...e.history],
        }));
      });
    },

    setPrimesAllowed(employeeId, allowed) {
      setDb((d) => mapEmployee(d, employeeId, (e) => ({
        ...e, allowPrimes: allowed, primes: allowed ? e.primes : [],
        history: [historyEntry('primes', allowed
          ? 'Autorisation des primes activée'
          : `Autorisation des primes retirée${e.primes.length ? ` : ${e.primes.length} prime(s) révoquée(s)` : ''}`, currentUser.id), ...e.history],
      })));
    },

    assignPrime(employeeId, primeId, since) {
      setDb((d) => {
        const prime = d.primes.find((p) => p.id === primeId);
        return mapEmployee(d, employeeId, (e) => (!e.allowPrimes || !prime || prime.archived || e.primes.some((p) => p.primeId === primeId) ? e : {
          ...e, primes: [...e.primes, { primeId, since }],
          history: [historyEntry('primes', `Attribution de la prime « ${prime.name} » à compter du ${formatDate(since)}`, currentUser.id, since), ...e.history],
        }));
      });
    },

    removePrime(employeeId, primeId) {
      setDb((d) => {
        const prime = d.primes.find((p) => p.id === primeId);
        return mapEmployee(d, employeeId, (e) => ({
          ...e, primes: e.primes.filter((p) => p.primeId !== primeId),
          history: [historyEntry('primes', `Retrait de la prime « ${prime?.name ?? primeId} »`, currentUser.id), ...e.history],
        }));
      });
    },

    removeItem(key, id) {
      setDb((d) => ({ ...d, [key]: (d[key] as { id: ID }[]).filter((x) => x.id !== id) }));
    },

    saveSchedule(schedule, departmentIds) {
      setDb((d) => ({
        ...d,
        schedules: d.schedules.some((s) => s.id === schedule.id) ? d.schedules.map((s) => (s.id === schedule.id ? schedule : s)) : [...d.schedules, schedule],
        departments: d.departments.map((dep) => (departmentIds.includes(dep.id) ? { ...dep, scheduleId: schedule.id }
          : dep.scheduleId === schedule.id ? { ...dep, scheduleId: undefined } : dep)),
      }));
    },

    saveNumbering(numbering) {
      setDb((d) => ({ ...d, numberings: [...d.numberings.filter((n) => n.companyId !== numbering.companyId), numbering] }));
    },

    saveCircuit(circuit) {
      setDb((d) => {
        const exists = d.circuits.some((c) => c.id === circuit.id);
        const circuits = (exists ? d.circuits.map((c) => (c.id === circuit.id ? circuit : c)) : [...d.circuits, circuit])
          .map((c) => (c.id !== circuit.id && !c.archived && circuit.departmentId && c.departmentId === circuit.departmentId ? { ...c, archived: true } : c));
        return { ...d, circuits };
      });
    },

    saveProfile(profile) {
      setDb((d) => ({ ...d, profiles: d.profiles.map((p) => (p.employeeId === profile.employeeId ? profile : p)) }));
    },

    submitLeave(input) {
      const profile = db.profiles.find((p) => p.employeeId === input.employeeId);
      const circuit = db.circuits.find((c) => c.id === profile?.circuitId);
      const exempt = !!circuit?.exempt || !profile || profile.approverIds.length === 0;
      const at = nowStamp();
      const req: LeaveRequest = {
        id: newId('q'), companyId, ...input,
        ...(input.startTime && input.endTime
          ? (() => { const a = countAuthorization(db, input.employeeId, input.start, input.startTime, input.endTime); return { days: a.days, hours: a.hours }; })()
          : { days: countLeaveDays(db, input.employeeId, input.start, input.end, input.startPart, input.endPart).total }),
        status: exempt ? 'approuve' : 'en_attente',
        createdAt: at, exempt,
        steps: exempt ? [] : profile!.approverIds.map((approverId, i) => ({ order: i + 1, approverId, status: i === 0 ? 'en_attente' : 'a_venir' })),
        history: [{
          at, actorId: currentUser.id,
          label: exempt
            ? 'Demande envoyée — profil dispensé d’approbation, validée automatiquement'
            : currentUser.id === input.employeeId ? 'Demande envoyée' : `Demande saisie par ${currentUser.firstName} ${currentUser.lastName} pour le compte de l’employé`,
        }],
      };
      setDb((d) => notify({ ...d, requests: [req, ...d.requests] }, 'Demande envoyée', `${personName(d, req.employeeId)} — ${req.days} j`, `conges/demandes/${req.id}`));
      return req;
    },

    decide(requestId, decision, comment) {
      const at = nowStamp();
      setDb((d) => {
        const r = d.requests.find((x) => x.id === requestId);
        if (!r) return d;
        const idx = r.steps.findIndex((s) => s.status === 'en_attente');
        if (idx < 0) return d;
        const step = r.steps[idx];
        const onBehalf = step.approverId !== currentUser.id ? ` (saisie par ${currentUser.firstName} ${currentUser.lastName} pour ${personName(d, step.approverId)})` : '';
        const steps = r.steps.map((s, i) => {
          if (i === idx) return { ...s, status: decision === 'approve' ? 'approuve' : 'refuse', decidedAt: at, comment: comment || undefined } as const;
          if (decision === 'refuse' && i > idx) return { ...s, status: 'ignore' } as const;
          if (decision === 'approve' && i === idx + 1) return { ...s, status: 'en_attente' } as const;
          return s;
        });
        const last = idx === r.steps.length - 1;
        const status = decision === 'refuse' ? 'refuse' : last ? 'approuve' : 'en_attente';
        const label = decision === 'refuse'
          ? `Demande refusée à l’étape ${idx + 1}${onBehalf}`
          : last ? `Étape ${idx + 1} approuvée — demande approuvée${onBehalf}` : `Étape ${idx + 1} approuvée${onBehalf}`;
        const updated: LeaveRequest = { ...r, steps, status, history: [...r.history, { at, actorId: step.approverId, label }] };
        return { ...d, requests: d.requests.map((x) => (x.id === requestId ? updated : x)) };
      });
      toast(decision === 'approve' ? 'Décision enregistrée : approuvée' : 'Décision enregistrée : refusée', decision === 'approve' ? 'success' : 'danger');
    },

    cancelLeave(requestId, reason) {
      const at = nowStamp();
      updateRequest(requestId, (r) => ({
        ...r,
        status: 'annule',
        steps: r.steps.map((s) => (s.status === 'en_attente' || s.status === 'a_venir' ? { ...s, status: 'ignore' } : s)),
        history: [...r.history, { at, actorId: currentUser.id, label: `Demande annulée${reason ? ` : ${reason}` : ''}` }],
      }));
      toast('Demande annulée', 'info');
    },

    addEvent(event) {
      setDb((d) => ({ ...d, events: [...d.events, event] }));
    },

    setArchived(key, id, archived) {
      setDb((d) => ({
        ...d,
        [key]: (d[key] as { id: ID; archived?: boolean }[]).map((x) => (x.id === id ? { ...x, archived } : x)),
      }));
      toast(archived ? 'Élément archivé — il reste visible dans l’historique' : 'Élément restauré', 'info');
    },

    addItem(key, item) {
      setDb((d) => ({ ...d, [key]: [...(d[key] as unknown[]), item] }));
    },

    setPresencePolicy(policy) {
      setDb((d) => ({ ...d, presencePolicies: [...d.presencePolicies.filter((x) => x.companyId !== policy.companyId), policy] }));
    },

    updateItem(key, item) {
      setDb((d) => ({ ...d, [key]: (d[key] as { id: ID }[]).map((x) => (x.id === (item as { id: ID }).id ? item : x)) }));
    },

    updateRole(role) {
      setDb((d) => ({ ...d, roles: d.roles.map((r) => (r.id === role.id ? role : r)) }));
    },

    markNotificationsRead() {
      setDb((d) => ({ ...d, notifications: d.notifications.map((n) => (n.companyId === companyId ? { ...n, read: true } : n)) }));
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/** Applique une transformation à une fiche employé. */
function mapEmployee(d: Database, employeeId: ID, fn: (e: Employee) => Employee): Database {
  return { ...d, employees: d.employees.map((e) => (e.id === employeeId ? fn(e) : e)) };
}

const STATUS_LABEL: Record<Employee['status'], string> = { actif: 'Actif', essai: 'Période d’essai', inactif: 'Inactif' };

/** Entrées d'historique déduites d'une modification de fiche (RH-5, RH-6, RH-12). */
function changesOf(d: Database, before: Employee | undefined, after: Employee, actorId: ID): EmployeeHistoryEntry[] {
  if (!before) {
    const circuit = circuitForDepartment(d, after.departmentId);
    const primes = after.primes.map((p) => d.primes.find((x) => x.id === p.primeId)?.name).filter(Boolean);
    return [
      ...(after.allowPrimes ? [historyEntry('primes', `Primes autorisées${primes.length ? ` : ${primes.join(', ')}` : ''}`, actorId, after.hireDate)] : []),
      historyEntry('circuit', `Circuit « ${circuit?.name ?? '—'} » appliqué automatiquement (département « ${rootDepartment(d, after.departmentId)?.name} »)`, actorId, after.hireDate),
      historyEntry('recrutement', `Création du dossier — ${scheduleOn(d, after, after.hireDate).source}`, actorId, after.hireDate),
    ];
  }
  const out: EmployeeHistoryEntry[] = [];
  if (before.maritalStatus !== after.maritalStatus || before.childrenCount !== after.childrenCount) {
    out.push(historyEntry('information', `Situation familiale : ${MARITAL_LABEL[after.maritalStatus]}, ${after.childrenCount} enfant(s) (avant : ${MARITAL_LABEL[before.maritalStatus]}, ${before.childrenCount})`, actorId));
  }
  if (before.departmentId !== after.departmentId || before.subDepartmentId !== after.subDepartmentId) {
    const name = (id?: ID) => d.departments.find((x) => x.id === id)?.name;
    const target = [name(after.departmentId), name(after.subDepartmentId)].filter(Boolean).join(' › ');
    const circuit = circuitForDepartment(d, after.departmentId);
    const schedule = after.scheduleMode === 'organisation'
      ? `nouvel horaire appliqué : ${organisationalSchedule(d, after.departmentId, after.subDepartmentId).schedule?.name ?? 'aucun'}`
      : 'horaire inchangé, géré par le tableau de chargement';
    out.push(historyEntry('mutation', `Mutation vers « ${target} » — circuit « ${circuit?.name ?? '—'} », ${schedule}`, actorId));
  }
  if (before.functionId !== after.functionId) {
    out.push(historyEntry('mutation', `Changement de fonction : ${d.functions.find((f) => f.id === after.functionId)?.name}`, actorId));
  }
  if (before.status !== after.status) out.push(historyEntry('statut', `Statut : ${STATUS_LABEL[before.status]} → ${STATUS_LABEL[after.status]}`, actorId));
  return out;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore doit être utilisé dans <StoreProvider>');
  return ctx;
}

/** Données de la société active et accesseurs pratiques. */
export function useCompanyData() {
  const { db, companyId } = useStore();
  return useMemo(() => {
    const by = <T extends { companyId: ID }>(list: T[]) => list.filter((x) => x.companyId === companyId);
    const employees = by(db.employees);
    const people = employees.map((e) => toPersonView(db, e));
    const peopleMap = new Map(people.map((p) => [p.id, p]));
    // « departments » : départements de premier niveau ; les sous-départements s'obtiennent par subDepartments(id).
    const allDepartments = by(db.departments);
    const departments = allDepartments.filter((d) => !d.parentId);
    return {
      company: db.companies.find((c) => c.id === companyId)!,
      employees,
      employee: (id?: ID) => db.employees.find((e) => e.id === id),
      /** Employés enrichis du nom de département et de fonction. */
      people,
      activePeople: people.filter((p) => p.status !== 'inactif'),
      person: (id?: ID) => (id ? peopleMap.get(id) : undefined),
      departments,
      activeDepartments: departments.filter((d) => !d.archived),
      subDepartments: (parentId?: ID) => allDepartments.filter((d) => parentId && d.parentId === parentId),
      department: (id?: ID) => db.departments.find((d) => d.id === id),
      departmentName: (id?: ID) => db.departments.find((d) => d.id === id)?.name,
      functions: by(db.functions),
      functionLinks: by(db.functionLinks),
      presencePolicy: db.presencePolicies.find((x) => x.companyId === companyId),
      fn: (id?: ID) => db.functions.find((f) => f.id === id),
      profiles: by(db.profiles),
      profile: (id?: ID) => db.profiles.find((p) => p.employeeId === id),
      schedules: by(db.schedules),
      leaveTypes: by(db.leaveTypes),
      leaveRules: by(db.leaveRules),
      holidays: by(db.holidays),
      countries: by(db.countries),
      country: (id?: ID) => db.countries.find((c) => c.id === id),
      roles: by(db.roles),
      circuits: by(db.circuits),
      primes: by(db.primes),
      documentTypes: by(db.documentTypes),
      prime: (id?: ID) => db.primes.find((p) => p.id === id),
      loadingPeriods: by(db.loadingPeriods),
      currency: currencyOf(db.companies.find((c) => c.id === companyId)),
      requests: by(db.requests),
      events: by(db.events),
      notifications: by(db.notifications),
      leaveType: (id?: ID) => db.leaveTypes.find((t) => t.id === id),
      role: (id?: ID) => db.roles.find((r) => r.id === id),
      circuit: (id?: ID) => db.circuits.find((c) => c.id === id),
      schedule: (id?: ID) => db.schedules.find((s) => s.id === id),
    };
  }, [db, companyId]);
}

// ---------- Routage minimal par hash (#/conges/demandes/q1) ----------

function readHash(): string[] {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

export function useRoute() {
  const [path, setPath] = useState<string[]>(readHash);
  useEffect(() => {
    const onChange = () => setPath(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export function navigate(to: string) {
  window.location.hash = '/' + to.replace(/^\//, '');
}
