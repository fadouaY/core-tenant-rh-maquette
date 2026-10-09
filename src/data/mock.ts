// Jeu de données fictif. Toutes les personnes, sociétés et valeurs sont inventées.
import type {
  AppAssignment, AppInfo, FunctionLink, PresencePolicy, TenantUser, UserAccess,
  ApprovalCircuit, ApprovalStep, Company, Database, Department, Employee, HistoryEntry, Holiday, HrEvent,
  JobFunction, LeaveProfile, LeaveRequest, LeaveRule, LeaveType, LoadingPeriod, Notification, DocumentType, EmployeeNumbering, Permission, Prime, Role, Schedule, Country,
} from '../types';
import { countLeaveDays, deriveProfiles } from '../utils/leave';
import { formatRange } from '../utils/dates';
import { countAuthorization } from '../utils/hours';

/** Permissions de l'application RH. */
export const PERMISSIONS: Permission[] = [
  { key: 'collaborateurs.voir', label: 'Consulter les profils congé', group: 'Collaborateurs' },
  { key: 'collaborateurs.configurer', label: 'Configurer les profils congé', group: 'Collaborateurs' },
  { key: 'soldes.ajuster', label: 'Ajuster les soldes et reports', group: 'Collaborateurs' },
  { key: 'conges.demander', label: 'Déposer une demande de congé', group: 'Congés' },
  { key: 'conges.voir_equipe', label: "Voir les congés de l'équipe", group: 'Congés' },
  { key: 'conges.voir_tous', label: 'Voir tous les congés de la société', group: 'Congés' },
  { key: 'conges.approuver', label: 'Approuver / refuser une demande', group: 'Congés' },
  { key: 'conges.annuler_tous', label: "Annuler la demande d'un tiers", group: 'Congés' },
  { key: 'calendrier.equipe', label: "Calendrier de l'équipe", group: 'Calendrier & événements' },
  { key: 'calendrier.societe', label: 'Calendrier de la société', group: 'Calendrier & événements' },
  { key: 'evenements.gerer', label: 'Créer et modifier des événements', group: 'Calendrier & événements' },
  { key: 'parametres.gerer', label: 'Gérer les paramètres', group: 'Administration' },
  { key: 'roles.gerer', label: 'Gérer les rôles et permissions', group: 'Administration' },
  { key: 'rapports.exporter', label: 'Exporter les rapports', group: 'Administration' },
];

const ALL = PERMISSIONS.map((p) => p.key);

const companies: Company[] = [
  { id: 'c1', name: 'Atlas Conseil', legalName: 'Atlas Conseil SARL', taxId: 'ICE 001234567000089', city: 'Casablanca', country: 'Maroc', color: '#2f5bd3', createdAt: '2024-01-15', adminUserId: 'u1' },
  { id: 'c2', name: 'Horizon Services', legalName: 'Horizon Services SAS', taxId: 'SIRET 812 345 678 00021', city: 'Lyon', country: 'France', color: '#0f8a7a', createdAt: '2024-06-03', adminUserId: 'u4' },
  { id: 'c3', name: 'Atlas Digital Lab', legalName: 'Atlas Digital Lab SARL', taxId: 'ICE 002345678000034', city: 'Rabat', country: 'Maroc', color: '#8a4fd1', createdAt: '2026-09-10', adminUserId: 'u6' },
];

/** Catalogue des applications du tenant. */
export const APPS: AppInfo[] = [
  {
    id: 'rh', name: 'Application RH', entry: 'tableau-de-bord',
    description: 'Gestion des employés, des congés, du calendrier, des événements et des circuits d’approbation.',
    features: ['Employés', 'Congés et soldes', 'Calendrier', 'Événements', 'Rôles et permissions'],
  },
];

const u = (id: string, firstName: string, lastName: string, email: string, createdAt: string, employeeLinks: Record<string, string> = {}, status: TenantUser['status'] = 'actif'): TenantUser =>
  ({ id, firstName, lastName, email, login: email.split('@')[0], status, createdAt, employeeLinks });

const users: TenantUser[] = [
  u('u1', 'Fadoua', 'Yakoubi', 'f.yakoubi@atlas-conseil.example', '2024-01-15', { c1: 'e1' }),
  u('u2', 'Karim', 'El Idrissi', 'k.elidrissi@atlas-conseil.example', '2024-01-15', { c1: 'e2' }),
  u('u3', 'Zineb', 'Mansouri', 'z.mansouri@atlas-conseil.example', '2024-02-01', { c1: 'e14' }),
  u('u4', 'Claire', 'Martin', 'c.martin@horizon-services.example', '2024-06-03', { c2: 'h1' }),
  u('u5', 'Julien', 'Moreau', 'j.moreau@horizon-services.example', '2024-06-10', { c2: 'h2' }),
  u('u6', 'Reda', 'Benkirane', 'r.benkirane@atlas-digital.example', '2026-09-10', {}, 'invite'),
  u('u7', 'Nora', 'Haddadi', 'n.haddadi@groupe-atlas.example', '2025-03-01'),
];

/** Accès des utilisateurs (hors administrateurs, qui ont un accès implicite). Nora (RH groupe) accède à RH dans deux sociétés. */
const accesses: UserAccess[] = [
  { userId: 'u2', appId: 'rh', companyId: 'c1' },
  { userId: 'u3', appId: 'rh', companyId: 'c1' },
  { userId: 'u5', appId: 'rh', companyId: 'c2' },
  { userId: 'u7', appId: 'rh', companyId: 'c1' },
  { userId: 'u7', appId: 'rh', companyId: 'c2' },
];

const assignments: AppAssignment[] = [
  { appId: 'rh', companyId: 'c1', enabled: true, adminUserId: 'u1', activatedAt: '2024-02-01' },
  { appId: 'rh', companyId: 'c2', enabled: true, adminUserId: 'u4', activatedAt: '2024-06-10' },
];

/** Départements et sous-départements (parentId), avec leur horaire organisationnel. */
const departments: Department[] = [
  { id: 'd1', companyId: 'c1', name: 'Direction générale', code: 'DG', headId: 'e2', scheduleId: 's1' },
  { id: 'd2', companyId: 'c1', name: 'Ressources humaines', code: 'RH', headId: 'e1', scheduleId: 's1' },
  { id: 'd2a', companyId: 'c1', name: 'Paie & administration du personnel', code: 'PAIE', headId: 'e14', parentId: 'd2', scheduleId: 's2' },
  { id: 'd3', companyId: 'c1', name: 'Finance & comptabilité', code: 'FIN', headId: 'e7', scheduleId: 's1' },
  { id: 'd4', companyId: 'c1', name: 'Conseil & projets', code: 'CSL', headId: 'e3', scheduleId: 's1' },
  { id: 'd4a', companyId: 'c1', name: 'Pôle transformation', code: 'TRF', headId: 'e4', parentId: 'd4' },
  { id: 'd5', companyId: 'c1', name: "Systèmes d'information", code: 'SI', headId: 'e9', scheduleId: 's1' },
  { id: 'd5a', companyId: 'c1', name: 'Infrastructure & support', code: 'INF', headId: 'e9', parentId: 'd5', scheduleId: 's3' },
  { id: 'd5b', companyId: 'c1', name: 'Développement', code: 'DEV', parentId: 'd5' },
  { id: 'd6', companyId: 'c1', name: 'Commercial', code: 'COM', headId: 'e12', scheduleId: 's1' },
  { id: 'd7', companyId: 'c1', name: 'Juridique (fusionné avec DG)', code: 'JUR', archived: true },
  { id: 'hd1', companyId: 'c2', name: 'Administration', code: 'ADM', headId: 'h1', scheduleId: 'hs1' },
  { id: 'hd2', companyId: 'c2', name: 'Exploitation', code: 'EXP', headId: 'h2', scheduleId: 'hs1' },
  { id: 'hd2a', companyId: 'c2', name: 'Équipes postées', code: 'POS', headId: 'h2', parentId: 'hd2', scheduleId: 'hs2' },
  { id: 'hd3', companyId: 'c2', name: 'Service client', code: 'SAV', headId: 'h4', scheduleId: 'hs1' },
];

const functions: JobFunction[] = [
  { id: 'f1', companyId: 'c1', name: 'Directeur général', departmentId: 'd1', interim: false, kind: 'solo' },
  { id: 'f2', companyId: 'c1', name: 'Responsable RH', departmentId: 'd2', interim: true, kind: 'solo' },
  { id: 'f3', companyId: 'c1', name: 'Chargé(e) RH', departmentId: 'd2', interim: true, kind: 'solo' },
  { id: 'f4', companyId: 'c1', name: 'Directeur administratif et financier', departmentId: 'd3', interim: true, kind: 'solo' },
  { id: 'f5', companyId: 'c1', name: 'Contrôleur de gestion', departmentId: 'd3', interim: true, kind: 'solo' },
  { id: 'f6', companyId: 'c1', name: 'Comptable', departmentId: 'd3', interim: false, kind: 'solo' },
  { id: 'f7', companyId: 'c1', name: 'Chef de projet', departmentId: 'd4', interim: false, kind: 'solo' },
  { id: 'f8', companyId: 'c1', name: 'Consultant senior', departmentId: 'd4', interim: false, kind: 'solo' },
  { id: 'f9', companyId: 'c1', name: 'Consultant junior', departmentId: 'd4', interim: true, kind: 'groupe', minPresent: 1 },
  { id: 'f10', companyId: 'c1', name: 'Responsable SI', departmentId: 'd5', interim: false, kind: 'solo' },
  { id: 'f11', companyId: 'c1', name: 'Développeur', departmentId: 'd5', interim: false, kind: 'groupe' },
  { id: 'f12', companyId: 'c1', name: 'Ingénieur systèmes', departmentId: 'd5', interim: true, kind: 'groupe', minPresent: 2 },
  { id: 'f13', companyId: 'c1', name: 'Responsable commercial', departmentId: 'd6', interim: false, kind: 'solo' },
  { id: 'f14', companyId: 'c1', name: "Chargé d'affaires", departmentId: 'd6', interim: false, kind: 'groupe' },
  { id: 'f15', companyId: 'c1', name: 'Assistant juridique', departmentId: 'd7', archived: true, interim: false, kind: 'solo' },
  { id: 'hf1', companyId: 'c2', name: 'Responsable administratif', departmentId: 'hd1', interim: false, kind: 'solo' },
  { id: 'hf2', companyId: 'c2', name: "Chef d'équipe", departmentId: 'hd2', interim: false, kind: 'solo' },
  { id: 'hf3', companyId: 'c2', name: 'Technicien', departmentId: 'hd2', interim: false, kind: 'groupe' },
  { id: 'hf4', companyId: 'c2', name: 'Conseiller client', departmentId: 'hd3', interim: true, kind: 'groupe', minPresent: 1 },
];

/** Fonctions solo liées (suppléance). */
const functionLinks: FunctionLink[] = [
  { id: 'fl1', companyId: 'c1', name: 'Suppléance finance', functionIds: ['f4', 'f5'] },
  { id: 'fl2', companyId: 'c1', name: 'Suppléance RH', functionIds: ['f2', 'f3'] },
];

/** Types de congé soumis aux règles de présence (les absences non planifiées, comme la maladie, en sont exclues). */
const presencePolicies: PresencePolicy[] = [
  { companyId: 'c1', leaveTypeIds: ['lt1', 'lt3', 'lt4', 'lt5', 'lt7'], effect: 'block' },
  { companyId: 'c2', leaveTypeIds: ['hlt1', 'hlt2'], effect: 'block' },
];

const schedules: Schedule[] = [
  { id: 's1', companyId: 'c1', name: 'Standard bureau', workDays: [1, 2, 3, 4, 5], startDate: '2026-01-01', endDate: '2026-12-31', weeklyHours: 37.5,
    exceptionalOffDays: [{ id: 'x1', date: '2026-12-24', label: 'Fermeture des bureaux — veille de fin d’année' }], slots: [
    { label: 'Matin', start: '09:00', end: '12:30' }, { label: 'Après-midi', start: '14:00', end: '18:00' }] },
  { id: 's2', companyId: 'c1', name: 'Journée continue', workDays: [1, 2, 3, 4, 5], startDate: '2026-01-01', endDate: '2026-12-31', weeklyHours: 40, slots: [
    { label: 'Journée', start: '08:30', end: '16:30' }] },
  { id: 's3', companyId: 'c1', name: 'Support du lundi au samedi', workDays: [1, 2, 3, 4, 5, 6], startDate: '2026-01-01', endDate: '2026-12-31', weeklyHours: 42, slots: [
    { label: 'Matin', start: '08:00', end: '12:00' }, { label: 'Après-midi', start: '13:00', end: '16:00' }] },
  { id: 's4', companyId: 'c1', name: 'Horaire aménagé (période 2026)', workDays: [1, 2, 3, 4, 5], archived: true, slots: [
    { label: 'Journée', start: '09:00', end: '15:30' }] },
  { id: 'hs1', companyId: 'c2', name: 'Horaire 35 h', workDays: [1, 2, 3, 4, 5], startDate: '2026-01-01', endDate: '2026-12-31', weeklyHours: 35, slots: [
    { label: 'Matin', start: '09:00', end: '12:00' }, { label: 'Après-midi', start: '13:00', end: '17:00' }] },
  { id: 'hs2', companyId: 'c2', name: 'Équipe en 2×8', workDays: [1, 2, 3, 4, 5, 6], startDate: '2026-01-01', endDate: '2026-12-31', weeklyHours: 40, slots: [
    { label: 'Poste du matin', start: '06:00', end: '14:00' }, { label: "Poste d'après-midi", start: '14:00', end: '22:00' }] },
];

const leaveTypes: LeaveType[] = [
  { id: 'lt1', companyId: 'c1', name: 'Congé annuel', code: 'CA', color: '#2f5bd3', paid: true, requiresProof: false, allowHalfDay: true, deductsFromAnnual: true, annualReference: true, tracked: false },
  { id: 'lt2', companyId: 'c1', name: 'Congé maladie', code: 'MAL', color: '#c4362f', paid: true, requiresProof: true, allowHalfDay: false, deductsFromAnnual: false, tracked: false },
  { id: 'lt3', companyId: 'c1', name: 'Récupération', code: 'REC', color: '#0f8a7a', paid: true, requiresProof: false, allowHalfDay: true, deductsFromAnnual: false, tracked: true },
  { id: 'lt4', companyId: 'c1', name: 'Congé sans solde', code: 'CSS', color: '#6b7280', paid: false, requiresProof: false, allowHalfDay: false, deductsFromAnnual: false, tracked: false },
  { id: 'lt5', companyId: 'c1', name: 'Congé exceptionnel (événement familial)', code: 'EXC', color: '#8a4fd1', paid: true, requiresProof: true, allowHalfDay: false, deductsFromAnnual: false, tracked: true },
  { id: 'lt6', companyId: 'c1', name: 'Congé ancienneté (ancien régime)', code: 'ANC', color: '#a16207', paid: true, requiresProof: false, allowHalfDay: false, deductsFromAnnual: false, tracked: false, archived: true },
  { id: 'lt7', companyId: 'c1', name: 'Jour de pont', code: 'PON', color: '#0e7490', paid: true, requiresProof: false, allowHalfDay: false, deductsFromAnnual: true, tracked: false },
  { id: 'lt8', companyId: 'c1', name: 'Autorisation d’absence', code: 'AUT', color: '#0891b2', paid: true, requiresProof: false, allowHalfDay: false, deductsFromAnnual: true, tracked: false, unit: 'heure' },
  { id: 'hlt4', companyId: 'c2', name: 'Autorisation d’absence', code: 'AUT', color: '#0891b2', paid: true, requiresProof: false, allowHalfDay: false, deductsFromAnnual: true, tracked: false, unit: 'heure' },
  { id: 'hlt1', companyId: 'c2', name: 'Congés payés', code: 'CP', color: '#0f8a7a', paid: true, requiresProof: false, allowHalfDay: true, deductsFromAnnual: true, annualReference: true, tracked: false },
  { id: 'hlt2', companyId: 'c2', name: 'RTT', code: 'RTT', color: '#2f5bd3', paid: true, requiresProof: false, allowHalfDay: true, deductsFromAnnual: false, tracked: true },
  { id: 'hlt3', companyId: 'c2', name: 'Arrêt maladie', code: 'MAL', color: '#c4362f', paid: true, requiresProof: true, allowHalfDay: false, deductsFromAnnual: false, tracked: false },
];

const leaveRules: LeaveRule[] = [
  { id: 'r1', companyId: 'c1', leaveTypeId: 'lt1', label: 'Congé annuel — base', annualQuota: 18, accrual: '1,5 j par mois travaillé', maxCarryOver: 5, minNoticeDays: 7, scope: 'Tous les employés' },
  { id: 'r2', companyId: 'c1', leaveTypeId: 'lt3', label: 'Récupération — heures supplémentaires', annualQuota: 6, accrual: 'Selon heures validées', maxCarryOver: 0, minNoticeDays: 2, scope: 'Conseil & projets, SI' },
  { id: 'r3', companyId: 'c1', leaveTypeId: 'lt5', label: 'Événements familiaux', annualQuota: 4, accrual: 'Par événement, sur justificatif', maxCarryOver: 0, minNoticeDays: 0, scope: 'Tous les employés' },
  { id: 'r4', companyId: 'c1', leaveTypeId: 'lt2', label: 'Maladie — sur certificat', annualQuota: null, accrual: 'Non applicable', maxCarryOver: 0, minNoticeDays: 0, scope: 'Tous les employés' },
  { id: 'r5', companyId: 'c1', leaveTypeId: 'lt1', label: 'Bonus ancienneté (ancienne grille)', annualQuota: 1.5, accrual: 'Tous les 5 ans', maxCarryOver: 0, minNoticeDays: 7, scope: 'Ancienneté ≥ 5 ans', archived: true },
  { id: 'hr1', companyId: 'c2', leaveTypeId: 'hlt1', label: 'Congés payés', annualQuota: 25, accrual: '2,08 j par mois', maxCarryOver: 5, minNoticeDays: 15, scope: 'Tous les salariés' },
  { id: 'hr2', companyId: 'c2', leaveTypeId: 'hlt2', label: 'RTT', annualQuota: 10, accrual: 'Annuel', maxCarryOver: 0, minNoticeDays: 3, scope: 'Cadres' },
];

const holidays: Holiday[] = [
  { id: 'h1', companyId: 'c1', name: "Jour de l'An", date: '2026-01-01', recurring: true },
  { id: 'h2', companyId: 'c1', name: 'Manifeste de l’Indépendance', date: '2026-01-11', recurring: true },
  { id: 'h3', companyId: 'c1', name: 'Fête du Travail', date: '2026-05-01', recurring: true },
  { id: 'h4', companyId: 'c1', name: 'Fête du Trône', date: '2026-07-30', recurring: true },
  { id: 'h5', companyId: 'c1', name: 'Marche Verte', date: '2026-11-06', recurring: true },
  { id: 'h6', companyId: 'c1', name: "Fête de l'Indépendance", date: '2026-11-18', recurring: true },
  { id: 'h7', companyId: 'c1', name: 'Pont exceptionnel (décision interne 2026)', date: '2026-10-30', recurring: false },
  { id: 'h8', companyId: 'c1', name: 'Pont de fin d’année 2025', date: '2025-12-26', recurring: false, archived: true },
  { id: 'hh1', companyId: 'c2', name: 'Toussaint', date: '2026-11-01', recurring: true },
  { id: 'hh2', companyId: 'c2', name: 'Armistice 1918', date: '2026-11-11', recurring: true },
  { id: 'hh3', companyId: 'c2', name: 'Noël', date: '2026-12-25', recurring: true },
];

const roles: Role[] = [
  { id: 'ro1', companyId: 'c1', name: 'Administrateur RH', description: 'Accès complet à la gestion RH de la société.', permissions: ALL },
  { id: 'ro2', companyId: 'c1', name: 'Manager', description: 'Suit son équipe et valide les demandes qui lui sont adressées.',
    permissions: ['employes.voir', 'conges.demander', 'conges.voir_equipe', 'conges.approuver', 'calendrier.equipe'] },
  { id: 'ro3', companyId: 'c1', name: 'Employé', description: 'Dépose ses demandes et consulte le calendrier de son équipe.',
    permissions: ['conges.demander', 'calendrier.equipe'] },
  { id: 'ro4', companyId: 'c1', name: 'Direction', description: 'Vision globale et validation finale.',
    permissions: ['employes.voir', 'conges.demander', 'conges.voir_tous', 'conges.approuver', 'calendrier.equipe', 'calendrier.societe', 'rapports.exporter'] },
  { id: 'ro5', companyId: 'c1', name: 'Super utilisateur (ancien)', description: 'Rôle hérité de l’ancien outil, ne plus attribuer.', permissions: ALL, archived: true },
  { id: 'hro1', companyId: 'c2', name: 'Administrateur RH', description: 'Accès complet.', permissions: ALL },
  { id: 'hro2', companyId: 'c2', name: 'Salarié', description: 'Accès standard.', permissions: ['conges.demander', 'calendrier.equipe'] },
];

/** Un circuit actif par département (RH-22) ; les sous-départements en héritent. */
const circuits: ApprovalCircuit[] = [
  { id: 'ci1', companyId: 'c1', name: 'Ressources humaines — manager direct', description: 'Une seule validation par le responsable hiérarchique.', exempt: false, departmentId: 'd2',
    steps: [{ kind: 'manager', label: 'Manager direct (N+1)' }] },
  { id: 'ci2', companyId: 'c1', name: 'Conseil & projets — 2 niveaux', description: 'Manager puis validation RH.', exempt: false, departmentId: 'd4',
    steps: [{ kind: 'manager', label: 'Manager direct (N+1)' }, { kind: 'employee', employeeId: 'e1', label: 'Responsable RH' }] },
  { id: 'ci3', companyId: 'c1', name: 'Finance — 3 niveaux', description: 'Manager, RH, puis Direction générale.', exempt: false, departmentId: 'd3',
    steps: [{ kind: 'manager', label: 'Manager direct (N+1)' }, { kind: 'employee', employeeId: 'e1', label: 'Responsable RH' }, { kind: 'employee', employeeId: 'e2', label: 'Directeur général' }] },
  { id: 'ci7', companyId: 'c1', name: 'Systèmes d’information — 2 niveaux', description: 'Manager puis responsable du département.', exempt: false, departmentId: 'd5',
    steps: [{ kind: 'manager', label: 'Manager direct (N+1)' }, { kind: 'departmentHead', label: 'Responsable du département' }] },
  { id: 'ci8', companyId: 'c1', name: 'Commercial — manager direct', description: 'Validation par le responsable hiérarchique.', exempt: false, departmentId: 'd6',
    steps: [{ kind: 'manager', label: 'Manager direct (N+1)' }] },
  { id: 'ci4', companyId: 'c1', name: 'Longue absence — 5 niveaux', description: 'Remplacé par les circuits par département.', exempt: false, archived: true,
    steps: [
      { kind: 'manager', label: 'Manager direct (N+1)' },
      { kind: 'departmentHead', label: 'Responsable du département' },
      { kind: 'employee', employeeId: 'e14', label: 'Chargée RH' },
      { kind: 'employee', employeeId: 'e1', label: 'Responsable RH' },
      { kind: 'employee', employeeId: 'e2', label: 'Directeur général' },
    ] },
  { id: 'ci5', companyId: 'c1', name: 'Direction générale — dispensé', description: 'Les demandes sont validées automatiquement à l’envoi.', exempt: true, departmentId: 'd1', steps: [] },
  { id: 'ci6', companyId: 'c1', name: 'Ancien circuit commercial', description: 'Remplacé par « Commercial — manager direct ».', exempt: false, archived: true,
    steps: [{ kind: 'employee', employeeId: 'e12', label: 'Responsable commercial' }, { kind: 'employee', employeeId: 'e7', label: 'DAF' }] },
  { id: 'hci1', companyId: 'c2', name: 'Exploitation — manager direct', description: 'Validation par le responsable.', exempt: false, departmentId: 'hd2', steps: [{ kind: 'manager', label: 'Manager direct (N+1)' }] },
  { id: 'hci2', companyId: 'c2', name: 'Administration — dispensé', description: 'Validation automatique.', exempt: true, departmentId: 'hd1', steps: [] },
  { id: 'hci3', companyId: 'c2', name: 'Service client — manager direct', description: 'Validation par le responsable.', exempt: false, departmentId: 'hd3', steps: [{ kind: 'manager', label: 'Manager direct (N+1)' }] },
];

/** Catalogue des primes (RH-27). */
const primes: Prime[] = [
  { id: 'pr1', companyId: 'c1', name: 'Prime de transport', code: 'TRANS', amount: 300, type: 'fixe', periodicity: 'mensuelle' },
  { id: 'pr2', companyId: 'c1', name: 'Prime de rendement', code: 'REND', amount: 1500, type: 'variable', periodicity: 'trimestrielle' },
  { id: 'pr3', companyId: 'c1', name: 'Prime d’astreinte', code: 'ASTR', amount: 800, type: 'variable', periodicity: 'mensuelle' },
  { id: 'pr4', companyId: 'c1', name: 'Prime de panier', code: 'PAN', amount: 200, type: 'fixe', periodicity: 'mensuelle' },
  { id: 'pr5', companyId: 'c1', name: 'Prime exceptionnelle projet ERP', code: 'ERP', amount: 2000, type: 'exceptionnelle', periodicity: 'ponctuelle', archived: true },
  { id: 'hpr1', companyId: 'c2', name: 'Prime de nuit', code: 'NUIT', amount: 120, type: 'variable', periodicity: 'mensuelle' },
  { id: 'hpr2', companyId: 'c2', name: 'Indemnité de transport', code: 'TRANS', amount: 50, type: 'fixe', periodicity: 'mensuelle' },
];

/** Types de documents du dossier employé (RH-17). */
const documentTypes: DocumentType[] = [
  { id: 'dt1', companyId: 'c1', name: 'Carte d’identité nationale (CIN)', code: 'CIN', required: true, formats: ['pdf', 'jpg', 'png'] },
  { id: 'dt2', companyId: 'c1', name: 'Contrat de travail signé', code: 'CONTRAT', required: true, formats: ['pdf'] },
  { id: 'dt3', companyId: 'c1', name: 'Relevé d’identité bancaire (RIB)', code: 'RIB', required: true, formats: ['pdf', 'jpg', 'png'] },
  { id: 'dt4', companyId: 'c1', name: 'Diplôme', code: 'DIPL', required: false, formats: ['pdf', 'jpg', 'png'] },
  { id: 'dt5', companyId: 'c1', name: 'Attestation médicale d’aptitude', code: 'MED', required: false, formats: ['pdf'] },
  { id: 'dt6', companyId: 'c1', name: 'Fiche de renseignements (ancien modèle)', code: 'FRA', required: false, formats: ['docx'], archived: true },
  { id: 'hdt1', companyId: 'c2', name: 'Pièce d’identité', code: 'ID', required: true, formats: ['pdf', 'jpg', 'png'] },
  { id: 'hdt2', companyId: 'c2', name: 'Contrat de travail signé', code: 'CONTRAT', required: true, formats: ['pdf'] },
];

/** Numérotation des matricules (numéro de souche), poursuivie après les fiches existantes. */
const numberings: EmployeeNumbering[] = [
  { companyId: 'c1', prefix: 'ATC', separator: '-', withYear: false, digits: 5, next: 1120 },
  { companyId: 'c2', prefix: 'HZS', separator: '-', withYear: false, digits: 5, next: 1036 },
];

/** Tableau de chargement (RH-25, RH-26) : périodes planifiées, sans chevauchement. */
const loadingPeriods: LoadingPeriod[] = [
  { id: 'lp1', companyId: 'c1', employeeId: 'e10', scheduleId: 's3', start: '2026-09-01', end: '2026-09-30', label: 'Astreinte support — septembre', reason: 'Rotation mensuelle du support.' },
  { id: 'lp2', companyId: 'c1', employeeId: 'e10', scheduleId: 's2', start: '2026-10-12', end: '2026-10-31', label: 'Bascule ERP', reason: 'Mise en production du nouvel ERP.' },
  { id: 'lp3', companyId: 'c1', employeeId: 'e17', scheduleId: 's3', start: '2026-10-05', end: '2026-10-25', label: 'Intégration — équipe support', reason: 'Prise de poste.' },
  { id: 'hlp1', companyId: 'c2', employeeId: 'h3', scheduleId: 'hs2', start: '2026-09-21', end: '2026-10-04', label: 'Rotation semaine A', reason: 'Planning des équipes postées.' },
  { id: 'hlp2', companyId: 'c2', employeeId: 'h3', scheduleId: 'hs1', start: '2026-10-05', end: '2026-10-18', label: 'Retour en horaire de jour', reason: 'Formation interne.' },
];

/** Compléments des fiches : état civil, rattachement fin, mode horaire, rémunération. */
const employeeExtras: Record<string, Partial<Employee>> = {
  e1: { maritalStatus: 'marie', childrenCount: 2, allowPrimes: true, primes: [{ primeId: 'pr1', since: '2018-03-12' }, { primeId: 'pr2', since: '2024-01-01' }] },
  e2: { maritalStatus: 'marie', childrenCount: 3, allowPrimes: true, primes: [{ primeId: 'pr2', since: '2012-09-01' }] },
  e4: { subDepartmentId: 'd4a' },
  e9: { allowPrimes: true, primes: [{ primeId: 'pr3', since: '2023-01-01' }] },
  e10: { scheduleMode: 'chargement', loadingSince: '2026-09-01', allowPrimes: true, primes: [{ primeId: 'pr3', since: '2026-09-01' }] },
  e11: { subDepartmentId: 'd5a' },
  e14: { subDepartmentId: 'd2a' },
  e15: { contractEnd: '2025-03-03' },
  e16: { contractEnd: '2027-02-26' },
  e17: { scheduleMode: 'chargement', loadingSince: '2026-10-05', subDepartmentId: 'd5a', contractEnd: '2027-04-04' },
  h2: { subDepartmentId: 'hd2a' },
  h3: { subDepartmentId: 'hd2a', scheduleMode: 'chargement', loadingSince: '2026-09-21', allowPrimes: true, primes: [{ primeId: 'hpr1', since: '2026-09-21' }] },
};

type EmpSeed = [
  id: string, first: string, last: string, dep: string, fn: string, hire: string, roleId: string,
  managerId: string | undefined, circuitId: string, approvers: string[], status?: Employee['status'], contract?: Employee['contract'], schedule?: string,
];

// Profils congé et accès (rôle, circuit, horaire, reports) générés à côté des fiches.
const profiles: LeaveProfile[] = [];

function makeEmployees(companyId: string, prefix: string, domain: string, seeds: EmpSeed[], defaultSchedule: string): Employee[] {
  return seeds.map(([id, first, last, dep, fn, hire, roleId, managerId, circuitId, approvers, status, contract, schedule], i) => {
    const login = `${first[0]}.${last.replace(/\s/g, '')}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    profiles.push({
      employeeId: id, companyId,
      scheduleId: schedule ?? defaultSchedule, roleId, extraPermissions: [], removedPermissions: [],
      circuitId, approverIds: approvers, carryOver: { lt1: i % 3 === 0 ? 3 : i % 3, hlt1: 2 },
    });
    return {
      id, companyId, firstName: first, lastName: last,
      matricule: `${prefix}-${String(1001 + i * 7).padStart(5, '0')}`,
      email: `${login}@${domain}`,
      phone: `6${String(10 + i).padStart(2, '0')}${String(23 + i * 3).padStart(2, '0')}45${String(60 + i).padStart(2, '0')}`,
      phoneCountryId: companyId === 'c1' ? 'ctry-c1-ma' : `ctry-${companyId}-fr`,
      birthDate: `19${85 + (i % 12)}-0${(i % 9) + 1}-1${i % 9}`,
      address: `${12 + i * 4} rue des Orangers, ${companyId === 'c1' ? 'Casablanca' : 'Lyon'}`,
      departmentId: dep, functionId: fn, hireDate: hire,
      contract: contract ?? 'CDI', status: status ?? 'actif', managerId,
      account: { login, active: status !== 'inactif', lastLogin: status === 'inactif' ? undefined : `2026-09-${String(20 + (i % 10)).padStart(2, '0')}T0${8 + (i % 2)}:1${i % 6}` },
      maritalStatus: (['celibataire', 'marie', 'divorce'] as const)[i % 3], childrenCount: i % 3 === 1 ? (i % 4) + 1 : 0,
      scheduleMode: 'organisation', allowPrimes: false, primes: [],
      salaries: [{ id: `sal-${id}`, since: hire, reason: 'Salaire d’embauche', amount: companyId === 'c1' ? 8000 + ((i * 1370) % 14000) : 2100 + i * 240 }],
      ...employeeExtras[id],
      history: employeeHistory(id, hire, companyId),
    };
  });
}

/** Historique de départ : recrutement, puis bascule au tableau de chargement le cas échéant. */
function employeeHistory(id: string, hire: string, companyId: string): Employee['history'] {
  const x = employeeExtras[id] ?? {};
  const list: Employee['history'] = [{ at: hire, kind: 'recrutement', label: 'Création du dossier (horaire organisationnel)' }];
  if (x.primes?.length) list.push({ at: x.primes[0].since, kind: 'primes', label: `Autorisation des primes et attribution de ${x.primes.length} prime(s)` });
  if (x.scheduleMode === 'chargement' && x.loadingSince) {
    list.push({ at: x.loadingSince, kind: 'horaire', label: 'Passage au tableau de chargement : fin de l’horaire hérité du département' });
    loadingPeriods.filter((p) => p.employeeId === id && p.companyId === companyId)
      .forEach((p) => list.push({ at: p.start, kind: 'planification', label: `Période planifiée « ${p.label} » ${formatRange(p.start, p.end)}` }));
  }
  return list.sort((a, b) => b.at.localeCompare(a.at));
}

const employees: Employee[] = [
  ...makeEmployees('c1', 'ATC', 'atlas-conseil.example', [
    ['e1', 'Fadoua', 'Yakoubi', 'd2', 'f2', '2018-03-12', 'ro1', 'e2', 'ci1', ['e2']],
    ['e2', 'Karim', 'El Idrissi', 'd1', 'f1', '2012-09-01', 'ro4', undefined, 'ci5', []],
    ['e3', 'Youssef', 'Alaoui', 'd4', 'f7', '2016-01-18', 'ro2', 'e2', 'ci1', ['e2']],
    ['e4', 'Nadia', 'Chraibi', 'd4', 'f8', '2019-06-03', 'ro3', 'e3', 'ci2', ['e3', 'e1']],
    ['e5', 'Mehdi', 'Tazi', 'd4', 'f9', '2026-07-01', 'ro3', 'e3', 'ci2', ['e3', 'e1'], 'essai'],
    ['e6', 'Imane', 'Berrada', 'd3', 'f5', '2020-02-10', 'ro3', 'e7', 'ci3', ['e7', 'e1', 'e2']],
    ['e7', 'Rachid', 'Amrani', 'd3', 'f4', '2014-11-24', 'ro2', 'e2', 'ci1', ['e2']],
    ['e8', 'Leila', 'Fassi', 'd3', 'f6', '2021-04-05', 'ro3', 'e7', 'ci3', ['e7', 'e1', 'e2']],
    ['e9', 'Omar', 'Benjelloun', 'd5', 'f10', '2017-05-15', 'ro2', 'e2', 'ci1', ['e2']],
    ['e10', 'Sara', 'Kettani', 'd5', 'f12', '2022-09-19', 'ro3', 'e9', 'ci1', ['e9']],
    ['e11', 'Hamza', 'Ouazzani', 'd5', 'f12', '2019-10-07', 'ro3', 'e9', 'ci1', ['e9'], 'actif', 'CDI', 's3'],
    ['e12', 'Ghita', 'Lahlou', 'd6', 'f13', '2015-03-02', 'ro2', 'e2', 'ci1', ['e2']],
    ['e13', 'Amine', 'Sefrioui', 'd6', 'f14', '2023-01-09', 'ro3', 'e12', 'ci1', ['e12']],
    ['e14', 'Zineb', 'Mansouri', 'd2', 'f3', '2022-02-14', 'ro3', 'e1', 'ci1', ['e1'], 'actif', 'CDI', 's2'],
    ['e15', 'Anas', 'Belkadi', 'd4', 'f9', '2024-03-04', 'ro3', 'e3', 'ci2', ['e3', 'e1'], 'inactif', 'CDD'],
    ['e16', 'Hajar', 'Squalli', 'd4', 'f9', '2026-09-01', 'ro3', 'e3', 'ci4', ['e3', 'e14', 'e1', 'e2'], 'essai', 'Stage'],
    ['e17', 'Yassine', 'Rami', 'd5', 'f12', '2026-10-05', 'ro3', 'e9', 'ci1', ['e9'], 'essai', 'CDD'],
  ], 's1'),
  ...makeEmployees('c2', 'HZS', 'horizon-services.example', [
    ['h1', 'Claire', 'Martin', 'hd1', 'hf1', '2015-04-01', 'hro1', undefined, 'hci2', []],
    ['h2', 'Julien', 'Moreau', 'hd2', 'hf2', '2017-09-11', 'hro2', 'h1', 'hci1', ['h1']],
    ['h3', 'Sophie', 'Lefèvre', 'hd2', 'hf3', '2021-01-04', 'hro2', 'h2', 'hci1', ['h2'], 'actif', 'CDI', 'hs2'],
    ['h4', 'Thomas', 'Girard', 'hd3', 'hf4', '2019-06-17', 'hro2', 'h1', 'hci1', ['h1']],
    ['h5', 'Camille', 'Roux', 'hd3', 'hf4', '2025-11-03', 'hro2', 'h4', 'hci1', ['h4'], 'essai'],
  ], 'hs1'),
];

const s = (order: number, approverId: string, status: ApprovalStep['status'], decidedAt?: string, comment?: string): ApprovalStep =>
  ({ order, approverId, status, decidedAt, comment });
const h = (at: string, label: string, actorId?: string): HistoryEntry => ({ at, label, actorId });

type ReqSeed = Omit<LeaveRequest, 'days' | 'companyId' | 'startPart' | 'endPart'> & Partial<Pick<LeaveRequest, 'startPart' | 'endPart' | 'companyId'>>;

const requestSeeds: ReqSeed[] = [
  { id: 'qa1', employeeId: 'e1', leaveTypeId: 'lt8', start: '2026-09-24', end: '2026-09-24', startTime: '10:00', endTime: '12:00', status: 'approuve', createdAt: '2026-09-21T09:10',
    comment: 'Rendez-vous administratif.', steps: [s(1, 'e2', 'approuve', '2026-09-21T11:02')],
    history: [h('2026-09-21T09:10', 'Demande d’autorisation envoyée', 'e1'), h('2026-09-21T11:02', 'Demande approuvée', 'e2')] },
  { id: 'q1', employeeId: 'e4', leaveTypeId: 'lt1', start: '2026-10-12', end: '2026-10-16', status: 'en_attente', createdAt: '2026-09-22T10:14',
    comment: 'Vacances en famille à Essaouira.',
    steps: [s(1, 'e3', 'approuve', '2026-09-23T09:02', 'OK pour moi, la livraison client est le 9.'), s(2, 'e1', 'en_attente')],
    history: [h('2026-09-22T10:14', 'Demande envoyée', 'e4'), h('2026-09-23T09:02', 'Étape 1 approuvée', 'e3')] },
  { id: 'q2', employeeId: 'e5', leaveTypeId: 'lt3', start: '2026-10-09', end: '2026-10-09', status: 'en_attente', createdAt: '2026-09-29T16:40',
    comment: 'Récupération suite à la mission du week-end du 19 septembre.',
    steps: [s(1, 'e3', 'en_attente'), s(2, 'e1', 'a_venir')], history: [h('2026-09-29T16:40', 'Demande envoyée', 'e5')] },
  { id: 'q3', employeeId: 'e11', leaveTypeId: 'lt1', start: '2026-09-28', end: '2026-10-09', status: 'approuve', createdAt: '2026-08-30T11:00', comment: '',
    steps: [s(1, 'e9', 'approuve', '2026-08-31T08:45')], history: [h('2026-08-30T11:00', 'Demande envoyée', 'e11'), h('2026-08-31T08:45', 'Demande approuvée', 'e9')] },
  { id: 'q4', employeeId: 'e10', leaveTypeId: 'lt2', start: '2026-10-01', end: '2026-10-02', status: 'approuve', createdAt: '2026-10-01T08:05',
    comment: 'Arrêt de 2 jours.', attachment: 'certificat_medical_kettani.pdf',
    steps: [s(1, 'e9', 'approuve', '2026-10-01T08:30', 'Bon rétablissement.')], history: [h('2026-10-01T08:05', 'Demande envoyée avec justificatif', 'e10'), h('2026-10-01T08:30', 'Demande approuvée', 'e9')] },
  { id: 'q5', employeeId: 'e8', leaveTypeId: 'lt1', start: '2026-10-26', end: '2026-11-04', status: 'en_attente', createdAt: '2026-09-18T14:20',
    comment: 'Voyage prévu de longue date.',
    steps: [s(1, 'e7', 'approuve', '2026-09-19T10:00', 'À arbitrer avec la clôture mensuelle.'), s(2, 'e1', 'en_attente'), s(3, 'e2', 'a_venir')],
    history: [h('2026-09-18T14:20', 'Demande envoyée', 'e8'), h('2026-09-19T10:00', 'Étape 1 approuvée', 'e7')] },
  { id: 'q6', employeeId: 'e13', leaveTypeId: 'lt1', start: '2026-10-19', end: '2026-10-23', status: 'refuse', createdAt: '2026-09-15T09:30', comment: '',
    steps: [s(1, 'e12', 'refuse', '2026-09-16T17:12', 'Salon Africa Business Expo : présence requise. Merci de proposer d’autres dates.')],
    history: [h('2026-09-15T09:30', 'Demande envoyée', 'e13'), h('2026-09-16T17:12', 'Demande refusée', 'e12')] },
  { id: 'q7', employeeId: 'e14', leaveTypeId: 'lt1', start: '2026-10-02', end: '2026-10-02', startPart: 'pm', status: 'en_attente', createdAt: '2026-09-30T12:10',
    comment: 'Rendez-vous administratif.', steps: [s(1, 'e1', 'en_attente')], history: [h('2026-09-30T12:10', 'Demande envoyée', 'e14')] },
  { id: 'q8', employeeId: 'e3', leaveTypeId: 'lt1', start: '2026-12-21', end: '2026-12-31', status: 'en_attente', createdAt: '2026-09-25T18:02', comment: 'Fêtes de fin d’année.',
    steps: [s(1, 'e2', 'en_attente')], history: [h('2026-09-25T18:02', 'Demande envoyée', 'e3')] },
  { id: 'q9', employeeId: 'e6', leaveTypeId: 'lt5', start: '2026-10-15', end: '2026-10-16', status: 'annule', createdAt: '2026-09-10T10:00', comment: 'Mariage de ma sœur.',
    attachment: 'faire_part.pdf',
    steps: [s(1, 'e7', 'approuve', '2026-09-11T09:00'), s(2, 'e1', 'ignore'), s(3, 'e2', 'ignore')],
    history: [h('2026-09-10T10:00', 'Demande envoyée', 'e6'), h('2026-09-11T09:00', 'Étape 1 approuvée', 'e7'), h('2026-09-20T15:41', 'Demande annulée par l’employée : date de l’événement reportée', 'e6')] },
  { id: 'q10', employeeId: 'e9', leaveTypeId: 'lt1', start: '2026-08-03', end: '2026-08-14', status: 'approuve', createdAt: '2026-06-15T09:00', comment: '',
    steps: [s(1, 'e2', 'approuve', '2026-06-16T11:20')], history: [h('2026-06-15T09:00', 'Demande envoyée', 'e9'), h('2026-06-16T11:20', 'Demande approuvée', 'e2')] },
  { id: 'q11', employeeId: 'e1', leaveTypeId: 'lt1', start: '2026-12-24', end: '2026-12-31', status: 'en_attente', createdAt: '2026-09-28T09:15', comment: '',
    steps: [s(1, 'e2', 'en_attente')], history: [h('2026-09-28T09:15', 'Demande envoyée', 'e1')] },
  { id: 'q12', employeeId: 'e12', leaveTypeId: 'lt1', start: '2026-10-05', end: '2026-10-06', status: 'approuve', createdAt: '2026-09-21T08:00', comment: '',
    steps: [s(1, 'e2', 'approuve', '2026-09-21T12:00')], history: [h('2026-09-21T08:00', 'Demande envoyée', 'e12'), h('2026-09-21T12:00', 'Demande approuvée', 'e2')] },
  { id: 'q13', employeeId: 'e2', leaveTypeId: 'lt1', start: '2026-10-26', end: '2026-10-29', status: 'approuve', createdAt: '2026-09-01T07:50', comment: '', exempt: true,
    steps: [], history: [h('2026-09-01T07:50', 'Demande envoyée — profil dispensé d’approbation, validée automatiquement', 'e2')] },
  { id: 'q14', employeeId: 'e11', leaveTypeId: 'lt6', start: '2026-05-11', end: '2026-05-12', status: 'approuve', createdAt: '2026-04-20T10:00', comment: '',
    steps: [s(1, 'e9', 'approuve', '2026-04-21T09:00')], history: [h('2026-04-20T10:00', 'Demande envoyée', 'e11'), h('2026-04-21T09:00', 'Demande approuvée', 'e9')] },
  { id: 'q15', employeeId: 'e1', leaveTypeId: 'lt1', start: '2026-07-27', end: '2026-08-07', status: 'approuve', createdAt: '2026-05-30T10:00', comment: '',
    steps: [s(1, 'e2', 'approuve', '2026-06-01T09:00')], history: [h('2026-05-30T10:00', 'Demande envoyée', 'e1'), h('2026-06-01T09:00', 'Demande approuvée', 'e2')] },
  { id: 'q16', employeeId: 'e10', leaveTypeId: 'lt1', start: '2026-10-19', end: '2026-10-20', status: 'en_attente', createdAt: '2026-09-30T17:30', comment: '',
    steps: [s(1, 'e9', 'en_attente')], history: [h('2026-09-30T17:30', 'Demande envoyée', 'e10')] },
  { id: 'hq1', companyId: 'c2', employeeId: 'h3', leaveTypeId: 'hlt1', start: '2026-10-05', end: '2026-10-09', status: 'en_attente', createdAt: '2026-09-20T10:00', comment: '',
    steps: [s(1, 'h2', 'en_attente')], history: [h('2026-09-20T10:00', 'Demande envoyée', 'h3')] },
  { id: 'hq2', companyId: 'c2', employeeId: 'h4', leaveTypeId: 'hlt2', start: '2026-10-02', end: '2026-10-02', status: 'approuve', createdAt: '2026-09-25T10:00', comment: '',
    steps: [s(1, 'h1', 'approuve', '2026-09-25T14:00')], history: [h('2026-09-25T10:00', 'Demande envoyée', 'h4'), h('2026-09-25T14:00', 'Demande approuvée', 'h1')] },
];

const events: HrEvent[] = [
  { id: 'ev1', companyId: 'c1', name: 'Clôture comptable mensuelle', type: 'Clôture', start: '2026-10-26', end: '2026-10-30', effect: 'block',
    description: 'Présence obligatoire de l’équipe Finance pour la clôture d’octobre.', allCompany: false, departmentIds: ['d3'], employeeIds: [] },
  { id: 'ev2', companyId: 'c1', name: 'Séminaire annuel Atlas', type: 'Séminaire', start: '2026-10-15', end: '2026-10-16', effect: 'warning',
    description: 'Deux jours de séminaire à Marrakech. Présence fortement recommandée.', allCompany: true, departmentIds: [], employeeIds: [] },
  { id: 'ev3', companyId: 'c1', name: 'Mise en production ERP', type: 'Projet', start: '2026-10-19', end: '2026-10-21', effect: 'block',
    description: 'Bascule du nouvel ERP. Gel des congés pour l’équipe SI.', allCompany: false, departmentIds: ['d5'], employeeIds: [] },
  { id: 'ev4', companyId: 'c1', name: 'Salon Africa Business Expo', type: 'Salon', start: '2026-10-20', end: '2026-10-22', effect: 'warning',
    description: 'Stand Atlas Conseil — hall B.', allCompany: false, departmentIds: ['d6'], employeeIds: ['e3'] },
  { id: 'ev5', companyId: 'c1', name: 'Formation sécurité incendie', type: 'Formation', start: '2026-10-08', end: '2026-10-08', effect: 'info',
    description: 'Session de 2 h en salle Atlas, 10 h – 12 h.', allCompany: true, departmentIds: [], employeeIds: [] },
  { id: 'ev6', companyId: 'c1', name: 'Inventaire de fin d’année', type: 'Clôture', start: '2026-12-28', end: '2026-12-31', effect: 'block',
    description: 'Inventaire physique et clôture annuelle.', allCompany: false, departmentIds: ['d3'], employeeIds: [] },
  { id: 'ev7', companyId: 'c1', name: 'Afterwork de rentrée', type: 'Vie d’entreprise', start: '2026-10-02', end: '2026-10-02', effect: 'info',
    description: 'Rooftop, à partir de 18 h 30.', allCompany: true, departmentIds: [], employeeIds: [] },
  { id: 'ev8', companyId: 'c1', name: 'Audit qualité ISO (reporté)', type: 'Audit', start: '2026-09-14', end: '2026-09-16', effect: 'warning',
    description: 'Événement archivé : audit reporté en 2027.', allCompany: true, departmentIds: [], employeeIds: [], archived: true },
  { id: 'hev1', companyId: 'c2', name: 'Inventaire entrepôt', type: 'Inventaire', start: '2026-10-29', end: '2026-10-30', effect: 'block',
    description: 'Équipe Exploitation mobilisée.', allCompany: false, departmentIds: ['hd2'], employeeIds: [] },
];

const notifications: Notification[] = [
  { id: 'n1', companyId: 'c1', at: '2026-09-30T12:10', title: 'Nouvelle demande à valider', body: 'Zineb Mansouri — congé annuel, 2 oct. après-midi', read: false, link: 'conges/demandes/q7' },
  { id: 'n2', companyId: 'c1', at: '2026-09-23T09:02', title: 'Étape 1 validée', body: 'La demande de Nadia Chraibi attend votre décision', read: false, link: 'conges/demandes/q1' },
  { id: 'n3', companyId: 'c1', at: '2026-09-30T16:06', title: 'Nouvelle arrivée', body: 'Yassine Rami rejoint les Systèmes d’information le 5 oct.', read: false, link: 'employes/e17' },
  { id: 'n4', companyId: 'c1', at: '2026-09-02T09:00', title: 'Nouvelle arrivée', body: 'Hajar Squalli a rejoint Conseil & projets', read: true, link: 'employes/e16' },
  { id: 'hn1', companyId: 'c2', at: '2026-09-20T10:00', title: 'Nouvelle demande', body: 'Sophie Lefèvre — congés payés', read: false, link: 'conges/demandes/hq1' },
];

const countries: Country[] = ['c1', 'c2'].flatMap((c) => [
  { id: `ctry-${c}-ma`, companyId: c, name: 'Maroc', dialCode: '212', digits: 9 },
  { id: `ctry-${c}-fr`, companyId: c, name: 'France', dialCode: '33', digits: 9 },
  { id: `ctry-${c}-tn`, companyId: c, name: 'Tunisie', dialCode: '216', digits: 8 },
  { id: `ctry-${c}-sn`, companyId: c, name: 'Sénégal', dialCode: '221', digits: 9, archived: c === 'c1' },
]);

function buildDatabase(): Database {
  const base: Database = {
    tenant: { name: 'Groupe Atlas', ownerUserId: 'u1', plan: 'Offre Business', maxCompanies: 5, maxUsers: 10 }, apps: APPS, assignments, users, accesses,
    companies, departments, functions, functionLinks, presencePolicies, employees, profiles, schedules, leaveTypes, leaveRules, holidays, countries, roles, circuits,
    primes, documentTypes, numberings, loadingPeriods, requests: [], events, notifications,
  };
  base.requests = requestSeeds.map((r) => {
    const startPart = r.startPart ?? 'full';
    const endPart = r.endPart ?? 'full';
    if (r.startTime && r.endTime) {
      const a = countAuthorization(base, r.employeeId, r.start, r.startTime, r.endTime);
      return { ...r, companyId: r.companyId ?? 'c1', startPart, endPart, days: a.days, hours: a.hours };
    }
    return { ...r, companyId: r.companyId ?? 'c1', startPart, endPart, days: countLeaveDays(base, r.employeeId, r.start, r.end, startPart, endPart).total };
  });
  return base;
}

export const initialDatabase = deriveProfiles(buildDatabase());

