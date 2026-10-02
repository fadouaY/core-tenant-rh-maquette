// Préparation de l'application RH pour une société (valeurs de démonstration).
// Quand le core tenant active l'application RH pour une société vide, on crée un socle
// minimal (département, fonction, horaire, type de congé, rôles, circuits) et la fiche
// de l'administrateur choisi, pour que l'application soit immédiatement utilisable.
import { PERMISSIONS } from '../data/mock';
import type { Database, Employee, ID, TenantUser } from '../types';
import { TODAY } from '../utils/dates';

let seq = 500;
const id = (prefix: string) => `${prefix}${++seq}`;

const has = (list: { companyId: ID }[], companyId: ID) => list.some((x) => x.companyId === companyId);

/** Crée le paramétrage RH minimal d'une société si elle n'en a pas encore. */
export function provisionRh(db: Database, companyId: ID): Database {
  let d = db;
  if (!has(d.departments, companyId)) {
    const depId = id('d');
    d = {
      ...d,
      departments: [...d.departments, { id: depId, companyId, name: 'Direction générale', code: 'DG' }],
      functions: [...d.functions, { id: id('f'), companyId, name: 'Administrateur RH', departmentId: depId, kind: 'solo' }],
    };
  }
  if (!has(d.countries, companyId)) {
    d = { ...d, countries: [...d.countries,
      { id: id('ctry'), companyId, name: 'Maroc', dialCode: '212', digits: 9 },
      { id: id('ctry'), companyId, name: 'France', dialCode: '33', digits: 9 },
    ] };
  }
  if (!has(d.schedules, companyId)) {
    d = { ...d, schedules: [...d.schedules, { id: id('s'), companyId, name: 'Standard bureau', workDays: [1, 2, 3, 4, 5],
      slots: [{ label: 'Matin', start: '09:00', end: '12:30' }, { label: 'Après-midi', start: '14:00', end: '18:00' }] }] };
  }
  if (!has(d.leaveTypes, companyId)) {
    const ltId = id('lt');
    d = {
      ...d,
      leaveTypes: [...d.leaveTypes, { id: ltId, companyId, name: 'Congé annuel', code: 'CA', color: '#2f5bd3', paid: true, requiresProof: false, allowHalfDay: true, deductsFromAnnual: true, annualReference: true, tracked: false }],
      leaveRules: [...d.leaveRules, { id: id('r'), companyId, leaveTypeId: ltId, label: 'Congé annuel — base', annualQuota: 18, accrual: '1,5 j par mois', maxCarryOver: 5, minNoticeDays: 7, scope: 'Tous les employés' }],
    };
  }
  if (!has(d.roles, companyId)) {
    d = { ...d, roles: [...d.roles,
      { id: id('ro'), companyId, name: 'Administrateur RH', description: 'Accès complet à l’application RH de la société.', permissions: PERMISSIONS.map((p) => p.key) },
      { id: id('ro'), companyId, name: 'Employé', description: 'Dépose ses demandes et consulte le calendrier de son équipe.', permissions: ['conges.demander', 'calendrier.equipe'] },
    ] };
  }
  if (!has(d.circuits, companyId)) {
    d = { ...d, circuits: [...d.circuits,
      { id: id('ci'), companyId, name: 'Standard — manager direct', description: 'Validation par le responsable hiérarchique.', exempt: false, steps: [{ kind: 'manager', label: 'Manager direct (N+1)' }] },
      { id: id('ci'), companyId, name: 'Dispensé d’approbation', description: 'Validation automatique à l’envoi.', exempt: true, steps: [] },
    ] };
  }
  if (!d.presencePolicies.some((x) => x.companyId === companyId)) {
    d = { ...d, presencePolicies: [...d.presencePolicies, { companyId, leaveTypeIds: d.leaveTypes.filter((t) => t.companyId === companyId && t.deductsFromAnnual).map((t) => t.id), effect: 'block' }] };
  }
  return d;
}

/** Garantit que l'administrateur a une fiche employé avec le rôle d'administration RH. */
export function ensureAdminEmployee(db: Database, companyId: ID, userId: ID): Database {
  const user = db.users.find((u) => u.id === userId);
  if (!user) return db;
  const adminRole = db.roles.find((r) => r.companyId === companyId && !r.archived && r.name.startsWith('Administrateur'));
  const exempt = db.circuits.find((c) => c.companyId === companyId && !c.archived && c.exempt);
  let d = db;
  let employeeId = user.employeeLinks[companyId];
  if (!employeeId || !d.employees.some((e) => e.id === employeeId)) {
    const employee = employeeFromUser(d, user, companyId);
    employeeId = employee.id;
    d = {
      ...d,
      employees: [...d.employees, employee],
      profiles: [...d.profiles, {
        employeeId, companyId,
        scheduleId: d.schedules.find((s) => s.companyId === companyId && !s.archived)?.id ?? '',
        roleId: adminRole?.id ?? '', extraPermissions: [], removedPermissions: [],
        circuitId: exempt?.id ?? '', approverIds: [], carryOver: {},
      }],
      users: d.users.map((u) => (u.id === userId ? { ...u, employeeLinks: { ...u.employeeLinks, [companyId]: employeeId! } } : u)),
    };
  } else if (adminRole) {
    // Fiche existante : on lui donne le rôle d'administrateur RH.
    d = { ...d, profiles: d.profiles.map((p) => (p.employeeId === employeeId ? { ...p, roleId: adminRole.id } : p)) };
  }
  return d;
}

function employeeFromUser(d: Database, user: TenantUser, companyId: ID): Employee {
  const dep = d.departments.find((x) => x.companyId === companyId && !x.archived);
  const fn = d.functions.find((x) => x.companyId === companyId && !x.archived && (!x.departmentId || x.departmentId === dep?.id));
  const count = d.employees.filter((e) => e.companyId === companyId).length;
  const company = d.companies.find((c) => c.id === companyId);
  return {
    id: id('e'), companyId: companyId, firstName: user.firstName, lastName: user.lastName,
    matricule: `${(company?.name ?? 'SOC').slice(0, 3).toUpperCase()}-${String(1001 + count * 7).padStart(5, '0')}`,
    email: user.email, phone: '', birthDate: '', address: '',
    departmentId: dep?.id ?? '', functionId: fn?.id ?? '', hireDate: TODAY, contract: 'CDI', status: 'actif',
    account: { login: user.email.split('@')[0], active: true },
  };
}
