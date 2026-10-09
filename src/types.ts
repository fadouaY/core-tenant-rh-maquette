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

/**
 * Département ou sous-département (RH-14) : un sous-département porte `parentId`.
 * Le circuit d'approbation est porté par le circuit (`ApprovalCircuit.departmentId`), un seul par département ;
 * un sous-département hérite du circuit de son département.
 */
export interface Department extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  code: string;
  headId?: ID;
  /** Département parent : présent uniquement pour un sous-département. */
  parentId?: ID;
  /** Horaire organisationnel (RH-21) ; un sous-département sans horaire hérite de celui de son département. */
  scheduleId?: ID;
}

export type FunctionKind = 'solo' | 'groupe';

export interface JobFunction extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  departmentId?: ID;
  /**
   * Règles d'intérim appliquées à la fonction (RH-15). Sans intérim, aucune règle de présence ne s'applique et
   * `kind` / `minPresent` sont ignorés.
   */
  interim: boolean;
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

export type MaritalStatus = 'celibataire' | 'marie' | 'divorce';

/**
 * Mode horaire (RH-6, RH-24) : « organisation » = horaire hérité du (sous-)département ;
 * « chargement » = horaire planifié par périodes dans le tableau de chargement, sans retour automatique.
 */
export type ScheduleMode = 'organisation' | 'chargement';

/** Salaire de base daté (RH-8) : le salaire en vigueur est le plus récent dont la date d'effet est passée. */
export interface Salary {
  id: ID;
  amount: number;
  since: ISODate;
  reason: string;
}

/** Prime du catalogue attribuée à un employé (RH-8). */
export interface EmployeePrime {
  primeId: ID;
  since: ISODate;
}

export type EmployeeHistoryKind =
  | 'recrutement' | 'information' | 'mutation' | 'horaire' | 'planification' | 'primes' | 'salaire' | 'statut' | 'circuit';

/** Entrée de l'historique de l'employé (RH-10) : ajoutée par l'application, jamais modifiée. */
export interface EmployeeHistoryEntry {
  at: ISODate;
  kind: EmployeeHistoryKind;
  label: string;
  actorId?: ID;
}

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
  /** Sous-département facultatif, enfant de `departmentId`. */
  subDepartmentId?: ID;
  functionId: ID;
  hireDate: ISODate;
  contract: 'CDI' | 'CDD' | 'Stage';
  /** Fin du contrat (CDD, stage) ; absente pour un CDI. */
  contractEnd?: ISODate;
  status: EmployeeStatus;
  managerId?: ID;
  account: { login: string; active: boolean; lastLogin?: string };
  maritalStatus: MaritalStatus;
  childrenCount: number;
  scheduleMode: ScheduleMode;
  /** Date d'effet du passage au tableau de chargement (mode « chargement »). */
  loadingSince?: ISODate;
  salaries: Salary[];
  /** Autorisation des primes, décochée par défaut ; la retirer révoque les primes actives. */
  allowPrimes: boolean;
  primes: EmployeePrime[];
  history: EmployeeHistoryEntry[];
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
  /** Jours travaillés par défaut : 1 = lundi … 7 = dimanche (tableau de chargement, départements sans réglage propre). */
  workDays: number[];
  slots: TimeSlot[];
  /** Période d'application du scénario (RH-21). */
  startDate?: ISODate;
  endDate?: ISODate;
  /** Volume horaire hebdomadaire déclaré. */
  weeklyHours?: number;
  /** Jours travaillés propres à un département ou sous-département concerné. */
  departmentWorkDays?: Record<ID, number[]>;
  /** Jours non travaillés exceptionnels, distincts des jours fériés (RH-20). */
  exceptionalOffDays?: ExceptionalOffDay[];
}

export interface ExceptionalOffDay {
  id: ID;
  date: ISODate;
  label: string;
  /** Département concerné ; absent = tous les départements du scénario. */
  departmentId?: ID;
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

/**
 * Circuit d'approbation (RH-22) : affecté à un seul département, et un département n'a qu'un circuit actif.
 * Ses sous-départements en héritent ; il s'applique automatiquement aux employés (RH-23).
 */
export interface ApprovalCircuit extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  description: string;
  exempt: boolean;
  steps: CircuitStep[];
  departmentId?: ID;
}

/** Prime du catalogue de la société (RH-27). Archivée = désactivée : plus attribuable, attributions conservées. */
export interface Prime extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  code: string;
  amount: number;
  type: 'fixe' | 'variable' | 'exceptionnelle';
  /** Fréquence de versement ; « ponctuelle » = versée une seule fois. */
  periodicity: PrimePeriodicity;
}

export type PrimePeriodicity = 'mensuelle' | 'trimestrielle' | 'semestrielle' | 'annuelle' | 'ponctuelle';

/**
 * Type de document du dossier employé (RH-17). Nom et code uniques dans la société ; « obligatoire » = attendu
 * dans chaque dossier. Archivé = inactif : plus proposé au classement, documents existants conservés.
 */
export interface DocumentType extends Archivable {
  id: ID;
  companyId: ID;
  name: string;
  code: string;
  required: boolean;
  /** Formats acceptés au dépôt (extensions en minuscules). */
  formats: DocumentFormat[];
}

export type DocumentFormat = 'pdf' | 'jpg' | 'png' | 'docx';

/**
 * Numérotation des employés d'une société (numéro de souche) : le matricule est attribué automatiquement et dans
 * l'ordre à la création — préfixe, année éventuelle et compteur sur un nombre fixe de chiffres.
 */
export interface EmployeeNumbering {
  companyId: ID;
  prefix: string;
  separator: '-' | '/' | '';
  withYear: boolean;
  digits: number;
  /** Prochain numéro attribué. */
  next: number;
}

/** Période du tableau de chargement (RH-25, RH-26) : un horaire actif sur un intervalle, sans chevauchement. */
export interface LoadingPeriod {
  id: ID;
  companyId: ID;
  employeeId: ID;
  scheduleId: ID;
  start: ISODate;
  end: ISODate;
  label: string;
  reason: string;
}

/**
 * Paramétrage congé et accès d'un employé. `scheduleId`, `circuitId` et `approverIds` sont dérivés
 * (voir utils/org.ts) : ils ne se saisissent pas, ils suivent le rattachement et le mode horaire.
 */
export interface LeaveProfile {
  employeeId: ID;
  companyId: ID;
  /** Horaire en vigueur aujourd'hui ('' si l'employé n'est pas planifié dans le tableau de chargement). */
  scheduleId: ID;
  roleId: ID;
  extraPermissions: string[];
  removedPermissions: string[];
  /** Circuit du département ('' si le département n'en a pas). */
  circuitId: ID;
  /** Approbateurs résolus, dans l'ordre (vide si dispensé ou si l'employé est le dernier approbateur). */
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
  primes: Prime[];
  documentTypes: DocumentType[];
  numberings: EmployeeNumbering[];
  loadingPeriods: LoadingPeriod[];
  requests: LeaveRequest[];
  events: HrEvent[];
  notifications: Notification[];
}
