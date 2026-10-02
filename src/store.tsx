// État local de la maquette « Application RH » : tout est en mémoire et se réinitialise au rechargement.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { initialDatabase } from './data/mock';
import { ensureAdminEmployee, provisionRh } from './core/provisioning';
import type {
  AppAssignment, ApprovalCircuit, Company, Database, PresencePolicy, DayPart, Employee, HrEvent, ID, LeaveProfile, LeaveRequest, Role, TenantUser,
} from './types';
import { nowStamp } from './utils/dates';
import { countLeaveDays, toPersonView } from './utils/leave';
import { countAuthorization } from './utils/hours';

export type CollectionKey =
  | 'departments' | 'functions' | 'functionLinks' | 'schedules' | 'leaveTypes' | 'leaveRules' | 'holidays' | 'countries' | 'roles' | 'circuits' | 'events';

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
  saveEmployee: (employee: Employee, profile: LeaveProfile) => void;
  saveProfile: (profile: LeaveProfile) => void;
  submitLeave: (input: NewLeaveInput) => LeaveRequest;
  decide: (requestId: ID, decision: 'approve' | 'refuse', comment: string) => void;
  cancelLeave: (requestId: ID, reason: string) => void;
  addEvent: (event: HrEvent) => void;
  updateRole: (role: Role) => void;
  updateCircuit: (circuit: ApprovalCircuit) => void;
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
};
export const newId = (prefix: string) => `${prefix}${++idCounter}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(initialDatabase);
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
        const exists = d.employees.some((e) => e.id === employee.id);
        const hasProfile = d.profiles.some((p) => p.employeeId === employee.id);
        return {
          ...d,
          employees: exists ? d.employees.map((e) => (e.id === employee.id ? employee : e)) : [...d.employees, employee],
          profiles: hasProfile ? d.profiles.map((p) => (p.employeeId === employee.id ? profile : p)) : [...d.profiles, profile],
        };
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

    updateCircuit(circuit) {
      setDb((d) => ({ ...d, circuits: d.circuits.map((c) => (c.id === circuit.id ? circuit : c)) }));
    },

    markNotificationsRead() {
      setDb((d) => ({ ...d, notifications: d.notifications.map((n) => (n.companyId === companyId ? { ...n, read: true } : n)) }));
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
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
    const departments = by(db.departments);
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
