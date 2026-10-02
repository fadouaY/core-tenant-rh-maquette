// Modèle de données de la maquette « Application RH » (données fictives, aucune persistance).

export type ID = string;
/** Date au format ISO « AAAA-MM-JJ ». */
export type ISODate = string;

export interface Company {
  id: ID;
  name: string;
  legalName: string;
  /** Identifiant fiscal (ICE, SIRET…) — valeur fictive. */
  taxId: string;
  city: string;
  country: string;
  color: string;
  createdAt: ISODate;
  /** Administrateur de la société dans le core tenant (obligatoire à la création). */
  adminUserId?: ID;
  archived?: boolean;
}

interface Archivable {
  archived?: boolean;
}

/** Personne minimale affichable (avatar, nom). */
export interface Person {
  id: ID;
  firstName: string;
  lastName: string;
}

// ===================== Organisation et employés =====================

export interface Department extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  code: string;
  headId?: ID;
}

export type FunctionKind = 'solo' | 'groupe';

export interface JobFunction extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  departmentId?: ID;
  /** solo : une seule personne occupe la fonction ; groupe : plusieurs personnes. */
  kind: FunctionKind;
  /** Fonction groupe : nombre minimum de personnes présentes sur une même période. */
  minPresent?: number;
}

/** Fonctions solo liées : leurs titulaires ne peuvent pas être absents en même temps (suppléance). */
export interface FunctionLink extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  functionIds: ID[];
}

/** Paramètres d'application des règles de présence d'une société. */
export interface PresencePolicy {
  companyId: ID;
  /** Types de congé soumis aux règles (ex. : congés planifiés, hors maladie). */
  leaveTypeIds: ID[];
  effect: 'block' | 'warning';
}

export type EmployeeStatus = 'actif' | 'essai' | 'inactif';

export interface Employee extends Person {
  companyId: ID;
  matricule: string;
  email: string;
  /** Numéro national (chiffres uniquement), complété par l'indicatif du pays. */
  phone: string;
  phoneCountryId?: ID;
  birthDate: ISODate;
  address: string;
  departmentId: ID;
  functionId: ID;
  hireDate: ISODate;
  contract: 'CDI' | 'CDD' | 'Stage';
  status: EmployeeStatus;
  managerId?: ID;
  account: { login: string; active: boolean; lastLogin?: string };
}

// ===================== Congés =====================

/** Vue « personne » enrichie (département, fonction) utilisée par les écrans congés. */
export interface PersonView extends Person {
  companyId: ID;
  matricule: string;
  email: string;
  departmentId: ID;
  departmentName: string;
  departmentHeadId?: ID;
  functionName: string;
  managerId?: ID;
  hireDate: ISODate;
  status: EmployeeStatus;
}

export interface TimeSlot {
  label: string;
  start: string;
  end: string;
}

export interface Schedule extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  /** Jours travaillés : 1 = lundi … 7 = dimanche. */
  workDays: number[];
  slots: TimeSlot[];
}

export interface LeaveType extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  code: string;
  color: string;
  paid: boolean;
  requiresProof: boolean;
  allowHalfDay: boolean;
  /** Les jours pris sont-ils déduits du solde annuel de l'employé ? */
  deductsFromAnnual: boolean;
  /** Type de référence qui porte le solde annuel (quota + report), ex. « Congé annuel ». */
  annualReference?: boolean;
  /** Hors solde annuel uniquement : le type a-t-il son propre plafond (voir Règles et quotas) ? */
  tracked: boolean;
  /** « heure » : autorisation d'absence posée en heures (convertie en jours selon l'horaire). */
  unit?: 'jour' | 'heure';
}

export interface LeaveRule extends Archivable {
  id: ID;
  companyId: ID;
  leaveTypeId: ID;
  label: string;
  annualQuota: number | null;
  accrual: string;
  maxCarryOver: number;
  minNoticeDays: number;
  scope: string;
}

/** Pays : indicatif téléphonique et longueur du numéro national. */
export interface Country extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  /** Indicatif sans « + » (ex. « 212 »). */
  dialCode: string;
  /** Nombre exact de chiffres du numéro national. */
  digits: number;
}

export interface Holiday extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  date: ISODate;
  recurring: boolean;
}

export interface Permission {
  key: string;
  label: string;
  group: string;
}

export interface Role extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  description: string;
  permissions: string[];
}

export type CircuitStepKind = 'manager' | 'departmentHead' | 'employee';

export interface CircuitStep {
  kind: CircuitStepKind;
  employeeId?: ID;
  label: string;
}

export interface ApprovalCircuit extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  description: string;
  exempt: boolean;
  steps: CircuitStep[];
}

/** Paramétrage congé et accès d'un employé. */
export interface LeaveProfile {
  employeeId: ID;
  companyId: ID;
  scheduleId: ID;
  roleId: ID;
  extraPermissions: string[];
  removedPermissions: string[];
  circuitId: ID;
  /** Approbateurs résolus, dans l'ordre (vide si dispensé). */
  approverIds: ID[];
  /** Report de l'année précédente, par type de congé. */
  carryOver: Record<ID, number>;
}

export type LeaveStatus = 'en_attente' | 'approuve' | 'refuse' | 'annule';
export type StepStatus = 'en_attente' | 'approuve' | 'refuse' | 'a_venir' | 'ignore';
export type DayPart = 'full' | 'am' | 'pm';

export interface ApprovalStep {
  order: number;
  approverId: ID;
  status: StepStatus;
  decidedAt?: string;
  comment?: string;
}

export interface HistoryEntry {
  at: string;
  actorId?: ID;
  label: string;
}

export interface LeaveRequest {
  id: ID;
  companyId: ID;
  employeeId: ID;
  leaveTypeId: ID;
  start: ISODate;
  end: ISODate;
  startPart: DayPart;
  endPart: DayPart;
  /** Jours décomptés (fraction de journée pour une autorisation). */
  days: number;
  /** Autorisation en heures : plage horaire et heures décomptées. */
  startTime?: string;
  endTime?: string;
  hours?: number;
  status: LeaveStatus;
  createdAt: string;
  comment: string;
  attachment?: string;
  exempt?: boolean;
  steps: ApprovalStep[];
  history: HistoryEntry[];
}

export type EventEffect = 'info' | 'warning' | 'block';

export interface HrEvent extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  type: string;
  start: ISODate;
  end: ISODate;
  description: string;
  effect: EventEffect;
  allCompany: boolean;
  departmentIds: ID[];
  employeeIds: ID[];
}

export interface Notification {
  id: ID;
  companyId: ID;
  at: string;
  title: string;
  body: string;
  read: boolean;
  link?: string;
}

// ===================== Core tenant =====================

export interface Tenant {
  name: string;
  ownerUserId: ID;
  /** Offre souscrite (simulation) et quotas à ne pas dépasser. */
  plan: string;
  maxCompanies: number;
  maxUsers: number;
}

/** Utilisateur du tenant (compte de connexion). Il n'est pas rattaché à une société : ses accès le sont. */
export interface TenantUser extends Person {
  email: string;
  login: string;
  status: 'invite' | 'actif' | 'desactive';
  createdAt: ISODate;
  /** Fiche employé correspondante dans l'application RH, par société. */
  employeeLinks: Record<ID, ID>;
}

/** Accès d'un utilisateur à une application dans une société. */
export interface UserAccess {
  userId: ID;
  appId: string;
  companyId: ID;
}

export interface AppInfo {
  id: string;
  name: string;
  description: string;
  /** Route d'entrée de l'application dans la maquette. */
  entry: string;
  features: string[];
}

/** Activation d'une application pour une société, avec son administrateur. */
export interface AppAssignment {
  appId: string;
  companyId: ID;
  enabled: boolean;
  adminUserId?: ID;
  activatedAt: ISODate;
}

export interface Database {
  tenant: Tenant;
  apps: AppInfo[];
  assignments: AppAssignment[];
  users: TenantUser[];
  accesses: UserAccess[];
  companies: Company[];
  departments: Department[];
  functions: JobFunction[];
  functionLinks: FunctionLink[];
  presencePolicies: PresencePolicy[];
  employees: Employee[];
  profiles: LeaveProfile[];
  schedules: Schedule[];
  leaveTypes: LeaveType[];
  leaveRules: LeaveRule[];
  holidays: Holiday[];
  countries: Country[];
  roles: Role[];
  circuits: ApprovalCircuit[];
  requests: LeaveRequest[];
  events: HrEvent[];
  notifications: Notification[];
}
