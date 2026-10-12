import { useEffect, useState } from 'react';
import {
  Briefcase, CalendarClock, Check, CheckCircle2, Clock, FileSignature, FileText, GitBranch, Hash, History, KeyRound, Link2, Lock, Plus,
  Save, ShieldCheck, Star, Trash2, Upload, UserRound, Users,
} from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import type { ContractType, Employee, EmployeeContract, EmployeeDocument, LeaveProfile, MaritalStatus, Role } from '../../types';
import { formatDate, TODAY } from '../../utils/dates';
import { dayHours } from '../../utils/hours';
import { defaultProfile, profileRoleIds } from '../../utils/leave';
import { activeContract } from '../../utils/contracts';
import { circuitForDepartment, formatMoney, MARITAL_LABEL, nextMatricule, organisationalSchedule } from '../../utils/org';
import { Alert, Avatar, Badge, Drawer, employeeStatusOptions, Field, Switch } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import { PhoneField } from '../../components/PhoneField';
import { phoneError } from '../../utils/phone';
import { PERMISSIONS } from '../../data/mock';
import { ExtraPermissionsPicker } from './ExtraPermissions';
import { PRIME_PERIODICITY } from './EmployeeSections';

const CONTRACT_LABEL: Record<ContractType, string> = {
  CDI: 'Contrat à durée indéterminée (CDI)',
  CDD: 'Contrat à durée déterminée (CDD)',
  Stage: 'Convention de stage',
};

function blankEmployee(companyId: string, defaults: Partial<Employee>): Employee {
  return {
    id: '', companyId, firstName: '', lastName: '', matricule: '', companyMatricule: '', email: '', phone: '', birthDate: '', address: '',
    departmentId: '', functionId: '', hireDate: TODAY, contract: 'CDI', status: 'essai',
    account: { login: '', active: true },
    maritalStatus: 'celibataire', childrenCount: 0, scheduleMode: 'organisation',
    contracts: [], documents: [],
    salaries: [], allowPrimes: false, primes: [], history: [],
    ...defaults,
  };
}

/**
 * Création (RH-3) et modification (RH-5, RH-6) d'une fiche employé, en cinq sections :
 * état civil, profil professionnel et mode horaire, contrats et rémunération, compte et accès, documents.
 * Le matricule application est attribué par la numérotation ; le matricule société est saisi.
 * L'horaire et le circuit découlent du rattachement.
 */
export function EmployeeForm({ open, onClose, employee, onSaved }: {
  open: boolean; onClose: () => void; employee?: Employee; onSaved?: (e: Employee) => void;
}) {
  const { db, companyId, saveEmployee, toast } = useStore();
  const data = useCompanyData();
  const deps = data.departments.filter((d) => !d.archived);
  const [form, setForm] = useState<Employee>(() => blankEmployee(companyId, {}));
  const [profile, setProfile] = useState<LeaveProfile>(() => defaultProfile(db, blankEmployee(companyId, {})));
  const [salary, setSalary] = useState('');
  const [withHistory, setWithHistory] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const isNew = !employee;

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setSalary('');
    const base = employee ?? blankEmployee(companyId, {
      phoneCountryId: data.countries.find((c) => !c.archived && c.name === data.company.country)?.id ?? data.countries.find((c) => !c.archived)?.id,
    });
    // Fiche existante : retrouve l'utilisateur du core tenant déjà lié.
    const linked = base.account.userId ?? db.users.find((u) => base.id && u.employeeLinks[companyId] === base.id)?.id;
    setForm({ ...base, account: { ...base.account, userId: linked }, contracts: base.contracts ?? [], documents: base.documents ?? [] });
    setWithHistory(!!base.contracts?.length);
    setProfile(data.profile(base.id) ?? defaultProfile(db, base));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee, companyId]);

  // Nouveau dossier : matricule suivant de la numérotation (il dépend de l'année d'embauche si elle y figure).
  const matricule = isNew ? nextMatricule(db, companyId, form.hireDate || TODAY).matricule : form.matricule;

  const setP = <K extends keyof LeaveProfile>(k: K, v: LeaveProfile[K]) => setProfile((p) => ({ ...p, [k]: v }));
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setForm((f) => ({ ...f, [k]: v }));
  const subs = data.subDepartments(form.departmentId).filter((d) => !d.archived || d.id === form.subDepartmentId);
  const fns = data.functions.filter((f) => !f.archived && (!form.departmentId || !f.departmentId || f.departmentId === form.departmentId));
  const managers = data.employees.filter((e) => e.id !== form.id && e.status !== 'inactif');
  const selectedFn = data.fn(form.functionId);
  const soloTakenBy = selectedFn?.interim && selectedFn.kind === 'solo' ? data.employees.find((e) => e.id !== form.id && e.functionId === selectedFn.id && e.status !== 'inactif') : undefined;
  const fnLinks = selectedFn ? data.functionLinks.filter((l) => !l.archived && l.functionIds.includes(selectedFn.id)) : [];

  // Rattachement automatique (RH-3, RH-6, RH-23).
  const circuit = form.departmentId ? circuitForDepartment(db, form.departmentId) : undefined;
  const orgSchedule = organisationalSchedule(db, form.departmentId, form.subDepartmentId);
  const orgHours = orgSchedule.schedule ? orgSchedule.schedule.weeklyHours ?? Math.round(dayHours(orgSchedule.schedule) * orgSchedule.schedule.workDays.length * 10) / 10 : undefined;
  const loading = form.scheduleMode === 'chargement';
  const moved = !!employee && (employee.departmentId !== form.departmentId || employee.subDepartmentId !== form.subDepartmentId);
  const activePrimes = data.primes.filter((p) => !p.archived);
  const needsEnd = form.contract !== 'CDI';
  const contracts = form.contracts ?? [];
  const documents = form.documents ?? [];
  const docTypes = data.documentTypes.filter((t) => !t.archived);

  // Comptes du core tenant : actifs ou invités, non liés à une autre fiche de la société.
  const tenantUsers = db.users.filter((u) => u.status !== 'desactive' && (!u.employeeLinks[companyId] || u.employeeLinks[companyId] === form.id || u.id === form.account.userId));
  const linkedUser = db.users.find((u) => u.id === form.account.userId);
  const roleIds = profileRoleIds(profile);
  const roles = data.roles.filter((r) => !r.archived || roleIds.includes(r.id));
  const selectedRoles = roleIds.map((id) => data.role(id)).filter((r): r is Role => !!r);
  const rolePerms = new Set(selectedRoles.flatMap((r) => r.permissions));

  const errors: Record<string, string> = {};
  if (!form.firstName.trim()) errors.firstName = 'Prénom requis.';
  if (!form.lastName.trim()) errors.lastName = 'Nom requis.';
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Adresse e-mail invalide.';
  if (!matricule.trim()) errors.matricule = 'Matricule requis.';
  else if (data.employees.some((e) => e.id !== form.id && e.matricule.trim().toLowerCase() === matricule.trim().toLowerCase())) {
    errors.matricule = 'Ce matricule est déjà attribué à un autre employé.';
  }
  const companyMat = (form.companyMatricule ?? '').trim();
  if (!companyMat) { if (isNew) errors.companyMatricule = 'Matricule société requis.'; }
  else if (data.employees.some((e) => e.id !== form.id && (e.companyMatricule ?? '').trim().toLowerCase() === companyMat.toLowerCase())) {
    errors.companyMatricule = 'Ce matricule société est déjà utilisé.';
  }
  if (!Number.isInteger(form.childrenCount) || form.childrenCount < 0) errors.childrenCount = 'Nombre entier positif ou nul.';
  if (!form.departmentId) errors.departmentId = 'Choisissez un département.';
  else if (!circuit) errors.circuit = 'Aucun circuit d’approbation actif pour ce département.';
  if (loading && !(Number(form.weeklyHours) > 0 && Number(form.weeklyHours) <= 80)) errors.weeklyHours = 'Entre 1 et 80 heures.';
  if (!form.functionId) errors.functionId = 'Choisissez une fonction.';
  if (!form.hireDate) errors.hireDate = 'Date d’embauche requise.';
  if (isNew && needsEnd && !form.contractEnd) errors.contractEnd = `Date de fin requise pour un contrat ${form.contract}.`;
  else if (isNew && needsEnd && form.contractEnd && form.hireDate && form.contractEnd <= form.hireDate) errors.contractEnd = 'La fin doit suivre la date d’embauche.';
  if (isNew && !(Number(salary) > 0)) errors.salary = 'Montant strictement positif.';
  const phoneCountry = data.country(form.phoneCountryId);
  const phoneErr = phoneError(phoneCountry, form.phone);
  if (phoneErr) errors.phone = phoneErr;
  if (isNew && form.account.active && !form.account.userId) errors.user = 'Sélectionnez l’utilisateur du core tenant.';
  if (form.account.active && roleIds.length === 0) errors.roles = 'Attribuez au moins un rôle.';
  if (isNew && withHistory) contracts.forEach((c, i) => {
    if (!c.start) errors[`c${i}start`] = 'Début requis.';
    if (c.type !== 'CDI' && !c.end) errors[`c${i}end`] = 'Fin requise.';
    else if (c.end && c.start && c.end <= c.start) errors[`c${i}end`] = 'Après le début.';
  });
  documents.forEach((d, i) => {
    const type = data.documentTypes.find((t) => t.id === d.typeId);
    if (!d.typeId) errors[`d${i}type`] = 'Type requis.';
    if (!d.fileName) errors[`d${i}file`] = 'Fichier requis.';
    else if (type && !type.formats.includes(d.fileName.split('.').pop()?.toLowerCase() as never)) errors[`d${i}file`] = `Formats : ${type.formats.join(', ')}.`;
  });
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const id = form.id || newId('e');
    // Création : le contrat initial (date d'embauche) ouvre le parcours, suivi des contrats saisis.
    const newContracts: EmployeeContract[] = [
      { id: newId('ctr'), kind: 'initial', type: form.contract, start: form.hireDate, end: needsEnd ? form.contractEnd : undefined },
      ...(withHistory ? contracts.map((c) => ({ ...c, kind: c.kind ?? 'nouveau' as const, end: c.type === 'CDI' ? undefined : c.end })) : []),
    ];
    const inForce = isNew ? activeContract(newContracts) : undefined;
    const saved: Employee = {
      ...form, id, matricule: matricule.trim(), companyMatricule: companyMat,
      contract: inForce?.type ?? form.contract,
      contractEnd: isNew ? (inForce ? inForce.closedAt ?? inForce.end : undefined) : form.contractEnd,
      loadingSince: isNew && loading ? form.hireDate : form.loadingSince,
      weeklyHours: loading ? Number(form.weeklyHours) : form.weeklyHours,
      account: { ...form.account, login: form.account.active ? linkedUser?.login ?? form.account.login : form.account.login },
      contracts: isNew ? newContracts : form.contracts,
      documents,
      salaries: isNew ? [{ id: newId('sal'), amount: Number(salary), since: form.hireDate, reason: 'Salaire d’embauche' }] : form.salaries,
      primes: form.allowPrimes ? form.primes.map((p) => ({ ...p, since: isNew ? form.hireDate : p.since })) : [],
    };
    saveEmployee(saved, { ...profile, employeeId: id, companyId: saved.companyId });
    toast(isNew ? `Dossier de ${saved.firstName} ${saved.lastName} créé — matricule ${saved.matricule}` : 'Fiche employé mise à jour');
    onSaved?.(saved);
    onClose();
  };

  const autoEmail = () => {
    if (!form.firstName || !form.lastName || form.email) return;
    const login = `${form.firstName[0]}.${form.lastName.replace(/\s/g, '')}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    set('email', `${login}@${data.company.name.toLowerCase().replace(/\s/g, '-')}.example`);
  };

  const selectUser = (userId: string) => {
    const u = db.users.find((x) => x.id === userId);
    setForm((f) => ({
      ...f,
      account: { ...f.account, userId: u?.id, login: u?.login ?? '' },
      firstName: f.firstName || u?.firstName || '', lastName: f.lastName || u?.lastName || '', email: f.email || u?.email || '',
    }));
  };

  const togglePrime = (primeId: string, on: boolean) => setForm((f) => ({
    ...f, primes: on ? [...f.primes, { primeId, since: f.hireDate }] : f.primes.filter((p) => p.primeId !== primeId),
  }));

  // Rôles cumulables : le premier est le rôle principal ; les permissions ajoutées déjà couvertes par les rôles sont retirées.
  const applyRoles = (ids: string[]) => setProfile((p) => {
    const covered = new Set(ids.flatMap((id) => data.role(id)?.permissions ?? []));
    return { ...p, roleIds: ids, roleId: ids[0] ?? '', extraPermissions: p.extraPermissions.filter((k) => !covered.has(k)), removedPermissions: [] };
  });
  const toggleRole = (id: string) => applyRoles(roleIds.includes(id) ? roleIds.filter((x) => x !== id) : [...roleIds, id]);
  const makePrimary = (id: string) => applyRoles([id, ...roleIds.filter((x) => x !== id)]);
  /** Rôle sélectionné dont toutes les permissions sont déjà apportées par un autre rôle sélectionné. */
  const coveredBy = (r: Role) => selectedRoles.find((s) => s.id !== r.id && r.permissions.every((k) => s.permissions.includes(k))
    && (s.permissions.length > r.permissions.length || roleIds.indexOf(s.id) < roleIds.indexOf(r.id)));

  const setContract =(i: number, patch: Partial<EmployeeContract>) => set('contracts', contracts.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const addContract = () => set('contracts', [...contracts, { id: newId('ctr'), type: 'CDD', start: '', end: '' }]);
  const setDoc = (i: number, patch: Partial<EmployeeDocument>) => set('documents', documents.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const addDoc = () => set('documents', [...documents, { id: newId('doc'), typeId: '', fileName: '', addedAt: TODAY }]);

  const scheduleBadge = !form.departmentId ? null : loading
    ? <Badge tone="warning" icon={<CalendarClock size={11} aria-hidden />}>Tableau de chargement (RH-24){Number(form.weeklyHours) > 0 ? ` · ${form.weeklyHours} h/sem.` : ''}</Badge>
    : orgSchedule.schedule
      ? <Badge tone="primary" icon={<Clock size={11} aria-hidden />}>{orgSchedule.schedule.name}{orgHours ? ` · ${orgHours} h/sem.` : ''}</Badge>
      : <Badge tone="danger">Aucun horaire défini</Badge>;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={employee ? `Modifier ${employee.firstName} ${employee.lastName}` : 'Créer le dossier d’un nouvel employé'}
      subtitle={<>Société active : <strong>{data.company.name}</strong> · les champs marqués d’un astérisque sont obligatoires.</>}
      footer={
        <>
          {submitted && Object.keys(errors).length > 0
            ? <span className="footer-note text-danger">{Object.keys(errors).length} champ(s) à corriger</span>
            : isNew && <span className="footer-note">Matricule attribué : <strong className="mono">{matricule}</strong></span>}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={submitted && !!errors.circuit}>
            <Save size={15} aria-hidden /> {isNew ? 'Créer le dossier' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="fstack">
        {/* 1. Informations générales et état civil */}
        <FormCard icon={<UserRound size={16} />} title={<><span className="fstep">1</span> Informations générales et état civil</>}>
          <div className="form-grid">
            <Field label="Prénom" required error={err('firstName')}>{(id) => <input id={id} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} onBlur={autoEmail} autoComplete="off" placeholder="Ex. : Mohamed" />}</Field>
            <Field label="Nom" required error={err('lastName')}>{(id) => <input id={id} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} onBlur={autoEmail} autoComplete="off" placeholder="Ex. : Bennani" />}</Field>
            <Field label="Matricule application" required error={err('matricule')}
              hint={isNew ? <>Attribué automatiquement (Paramètres › Numérotation des employés).</> : 'Unique dans la société ; toute modification est historisée.'}>
              {(id) => isNew
                ? <span className="input-locked"><Hash size={13} aria-hidden /><input id={id} value={matricule} readOnly aria-readonly /><Lock size={12} aria-hidden /></span>
                : <input id={id} value={form.matricule} onChange={(e) => set('matricule', e.target.value)} />}
            </Field>
            <Field label="Matricule société" required={isNew} error={err('companyMatricule')} hint="Code interne attribué par la société (paie, badge…), saisi manuellement.">
              {(id) => <input id={id} value={form.companyMatricule ?? ''} onChange={(e) => set('companyMatricule', e.target.value)} autoComplete="off" placeholder="Ex. : AC-00457" className="mono" />}
            </Field>
            <Field label="E-mail professionnel" required error={err('email')}>{(id) => <input id={id} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="prenom.nom@societe.ma" />}</Field>
            <Field label="Téléphone" error={err('phone')} hint={phoneCountry ? `${phoneCountry.digits} chiffres attendus pour ${phoneCountry.name}.` : 'Indicatifs paramétrés dans Paramètres › Pays et téléphone.'}>
              {(id) => (
                <PhoneField id={id} invalid={!!err('phone')} value={form.phone} countryId={form.phoneCountryId}
                  countries={data.countries.filter((c) => !c.archived || c.id === form.phoneCountryId)}
                  onChange={(countryId, phone) => setForm((f) => ({ ...f, phoneCountryId: countryId, phone }))} />
              )}
            </Field>
            <div className="fhighlight">
              <Field label="Date de naissance">{(id) => <input id={id} type="date" value={form.birthDate} max={TODAY} onChange={(e) => set('birthDate', e.target.value)} />}</Field>
              <Field label="Situation matrimoniale" required hint={employee ? 'Historisée.' : undefined}>
                {(id) => (
                  <select id={id} value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value as MaritalStatus)}>
                    {(Object.keys(MARITAL_LABEL) as MaritalStatus[]).map((k) => <option key={k} value={k}>{MARITAL_LABEL[k]}</option>)}
                  </select>
                )}
              </Field>
              <Field label="Enfants à charge" required error={err('childrenCount')}>
                {(id) => <input id={id} type="number" min={0} step={1} value={form.childrenCount} onChange={(e) => set('childrenCount', e.target.value === '' ? 0 : Number(e.target.value))} />}
              </Field>
            </div>
            <Field label="Adresse postale" className="span-2">{(id) => <input id={id} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Rue, ville, code postal" />}</Field>
          </div>
        </FormCard>

        {/* 2. Profil professionnel et mode horaire */}
        <FormCard icon={<Briefcase size={16} />} title={<><span className="fstep">2</span> Profil professionnel et mode horaire</>}
          subtitle="Choisissez d’abord le département : son horaire actuel et son circuit d’approbation s’affichent.">
          <div className="form-grid">
            <Field label="Département" required error={err('departmentId')}>
              {(id) => (
                <select id={id} value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value, subDepartmentId: undefined, functionId: '' }))}>
                  <option value="">Sélectionner un département…</option>
                  {deps.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </Field>
            <Field label="Sous-département" hint={form.departmentId && subs.length === 0 ? 'Ce département n’a pas de sous-département.' : undefined}>
              {(id) => (
                <select id={id} value={form.subDepartmentId ?? ''} disabled={subs.length === 0} onChange={(e) => set('subDepartmentId', e.target.value || undefined)}>
                  <option value="">Aucun sous-département</option>
                  {subs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </Field>
          </div>

          {/* Mode horaire : proposé une fois le rattachement connu. */}
          <div className="fmode">
            <p className="fmode-title">Mode d’horaire applicable</p>
            {!form.departmentId ? (
              <p className="fnote"><Clock size={13} aria-hidden /> Sélectionnez un département pour afficher son horaire actuel et choisir le mode.</p>
            ) : isNew ? (
              <div className="deduct-choice mode-choice" role="radiogroup" aria-label="Mode horaire">
                <label className={`deduct-option ${!loading ? 'checked' : ''}`}>
                  <input type="radio" name="emp-mode" checked={!loading} onChange={() => set('scheduleMode', 'organisation')} />
                  <Clock size={18} aria-hidden />
                  <span>
                    <span className="person-name">Horaire organisationnel</span>
                    <span className="block small text-muted">Par défaut : hérité du {form.subDepartmentId ? 'sous-département' : 'département'}.</span>
                    {orgSchedule.schedule ? (
                      <span className="fmode-sched">
                        <strong>{orgSchedule.schedule.name}</strong>
                        <span>{orgSchedule.schedule.slots.map((s) => `${s.start}–${s.end}`).join(' · ')}{orgHours ? ` · ${orgHours} h/sem.` : ''}</span>
                      </span>
                    ) : <span className="block small text-warning">Aucun horaire défini pour ce rattachement.</span>}
                  </span>
                </label>
                <label className={`deduct-option ${loading ? 'checked' : ''}`}>
                  <input type="radio" name="emp-mode" checked={loading} onChange={() => setForm((f) => ({ ...f, scheduleMode: 'chargement', weeklyHours: f.weeklyHours ?? orgHours }))} />
                  <CalendarClock size={18} aria-hidden />
                  <span><span className="person-name">Tableau de chargement</span><span className="block small text-muted">Géré par les rotations (périodes planifiées), dès la date d’embauche.</span></span>
                </label>
              </div>
            ) : (
              <p className="fnote"><Clock size={13} aria-hidden /> Mode horaire : <strong>{loading ? 'tableau de chargement' : 'organisationnel'}</strong> — il se change depuis la fiche (action dédiée, avec date d’effet).</p>
            )}
            {form.departmentId && loading && (
              <div className="fhours">
                <Field label="Régime hebdomadaire contractuel (heures)" required error={err('weeklyHours')}
                  hint="Ex. : 45 h, 42 h, 40 h. Ce volume sera pré-rempli lors de la planification d’un créneau dans le tableau de chargement.">
                  {(id) => <span className="input-suffix"><input id={id} type="number" min={1} max={80} step={0.5} value={form.weeklyHours ?? ''} onChange={(e) => set('weeklyHours', e.target.value === '' ? undefined : Number(e.target.value))} /><span aria-hidden>h / sem.</span></span>}
                </Field>
              </div>
            )}
          </div>

          <div className="form-grid mt-12">
            <div className="field-group">
              <Field label="Fonction" required error={err('functionId')}>
                {(id) => (
                  <select id={id} value={form.functionId} onChange={(e) => set('functionId', e.target.value)}>
                    <option value="">Sélectionner…</option>
                    {fns.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                )}
              </Field>
              {selectedFn && (
                <div className={`frule ${selectedFn.interim ? 'on' : ''}`}>
                  <ShieldCheck size={14} aria-hidden />
                  <div>
                    {!selectedFn.interim ? <span>Sans règle d’intérim : aucune règle de présence ne s’applique.</span> : (
                      <>
                        <span className="frule-badges">
                          <Badge tone="info">Règle d’intérim · {selectedFn.kind === 'solo' ? 'solo' : 'groupe'}</Badge>
                          {selectedFn.kind === 'groupe' && selectedFn.minPresent ? <Badge tone="neutral">Min. {selectedFn.minPresent} présent(s)</Badge> : null}
                          {fnLinks.map((l) => <Badge key={l.id} tone="neutral" icon={<Link2 size={11} aria-hidden />}>{l.name}</Badge>)}
                        </span>
                        <span className="block small text-muted">
                          {selectedFn.kind === 'solo' ? 'Une seule personne occupe la fonction ; ses absences sont couvertes par la suppléance.' : 'Plusieurs personnes : un minimum de présents est exigé sur une même période.'}
                        </span>
                        {soloTakenBy && <span className="block small text-warning">Fonction solo déjà occupée par {soloTakenBy.firstName} {soloTakenBy.lastName}.</span>}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <Field label="Responsable hiérarchique (N+1)">
              {(id) => (
                <select id={id} value={form.managerId ?? ''} onChange={(e) => set('managerId', e.target.value || undefined)}>
                  <option value="">Aucun responsable</option>
                  {managers.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                </select>
              )}
            </Field>
            <Field label="Date d’embauche" required error={err('hireDate')}>{(id) => <input id={id} type="date" value={form.hireDate} onChange={(e) => set('hireDate', e.target.value)} />}</Field>
            <Field label={isNew ? 'Statut initial' : 'Statut'} required hint={form.status === 'inactif' ? 'Un employé inactif ne peut plus déposer de demande ; son historique est conservé.' : undefined}>
              {(id) => (
                <select id={id} value={form.status} onChange={(e) => set('status', e.target.value as Employee['status'])}>
                  {employeeStatusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
            </Field>
          </div>

          <div className={`finherit ${errors.circuit && form.departmentId ? 'invalid' : ''}`}>
            <p className="finherit-title">Horaire et circuit d’approbation hérités</p>
            {!form.departmentId ? <p className="small text-muted">Sélectionnez un département.</p> : (
              <div className="finherit-rows">
                <div className="finherit-row">
                  {scheduleBadge}
                  <span className="small text-muted">
                    {loading
                      ? (isNew ? `Horaires gérés via les rotations du tableau de chargement — « non planifié » à partir du ${formatDate(form.hireDate || TODAY)} tant qu’aucune période n’est saisie.` : moved ? 'Le changement de rattachement ne modifie pas l’horaire.' : 'Géré par périodes.')
                      : `${orgSchedule.source}${moved ? ' · nouvel horaire appliqué' : ''}`}
                  </span>
                </div>
                <div className="finherit-row">
                  {circuit
                    ? <Badge tone="success" icon={<GitBranch size={11} aria-hidden />}>Circuit actif : {circuit.name} ({circuit.exempt ? 'dispensé' : `${circuit.steps.length} étape${circuit.steps.length > 1 ? 's' : ''}`})</Badge>
                    : <Badge tone="danger" icon={<GitBranch size={11} aria-hidden />}>Aucun circuit actif</Badge>}
                  <span className="small text-muted">Circuit du département, appliqué automatiquement.</span>
                </div>
                {selectedFn && (
                  <div className="finherit-row">
                    <Badge tone={selectedFn.interim ? 'info' : 'muted'} icon={<ShieldCheck size={11} aria-hidden />}>
                      {selectedFn.name} · {selectedFn.interim ? `intérim ${selectedFn.kind}` : 'sans intérim'}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </div>
          {errors.circuit && form.departmentId && (
            <Alert tone="danger" title={isNew ? 'Création bloquée' : 'Rattachement impossible'}>
              Le département « {data.departmentName(form.departmentId)} » n’a aucun circuit d’approbation actif. Affectez-lui un circuit dans Paramètres › Circuits d’approbation.
            </Alert>
          )}
        </FormCard>

        {/* 3. Contrats, salaire et primes */}
        <FormCard icon={<FileSignature size={16} />} title={<><span className="fstep">3</span> Contrats, salaire et primes</>}
          subtitle={isNew ? 'Le contrat initial démarre à la date d’embauche.' : 'Le salaire et les primes se gèrent dans l’onglet Rémunération de la fiche.'}>
          {isNew ? (<>
          <div className="form-grid">
            <Field label={isNew ? 'Type de contrat initial' : 'Type de contrat en cours'} required>
              {(id) => (
                <select id={id} value={form.contract} onChange={(e) => set('contract', e.target.value as ContractType)}>
                  {(Object.keys(CONTRACT_LABEL) as ContractType[]).map((k) => <option key={k} value={k}>{CONTRACT_LABEL[k]}</option>)}
                </select>
              )}
            </Field>
            <Field label="Date de fin de contrat" required={needsEnd} error={err('contractEnd')} hint={needsEnd ? undefined : 'Sans objet pour un CDI.'}>
              {(id) => <input id={id} type="date" value={needsEnd ? form.contractEnd ?? '' : ''} disabled={!needsEnd} min={form.hireDate} onChange={(e) => set('contractEnd', e.target.value || undefined)} />}
            </Field>
            {isNew && (
              <Field label={`Salaire initial brut mensuel (${data.currency})`} required error={err('salary')} hint="Date d’effet : la date d’embauche.">
                {(id) => <span className="input-suffix"><input id={id} type="number" min={0} step={100} value={salary} onChange={(e) => setSalary(e.target.value)} /><span aria-hidden>{data.currency}</span></span>}
              </Field>
            )}
          </div>

          <div className="fprimes">
            <label className="fcheck">
              <input type="checkbox" checked={withHistory} onChange={(e) => { setWithHistory(e.target.checked); if (e.target.checked && contracts.length === 0) addContract(); }} />
              <History size={14} aria-hidden /> Saisir le parcours contractuel (tous les contrats signés par l’employé)
            </label>
            {withHistory && (
              <div className="frows">
                <div className="frows-head frow-contract" aria-hidden><span>Type de contrat</span><span>Date de début</span><span>Date de fin</span><span /></div>
                {contracts.map((c, i) => (
                  <div key={c.id} className="frow frow-contract">
                    <Field label="Type de contrat">
                      {(id) => (
                        <select id={id} value={c.type} onChange={(e) => setContract(i, { type: e.target.value as ContractType })}>
                          {(Object.keys(CONTRACT_LABEL) as ContractType[]).map((k) => <option key={k} value={k}>{k === 'Stage' ? 'Stage' : k}</option>)}
                        </select>
                      )}
                    </Field>
                    <Field label="Date de début" error={err(`c${i}start`)}>{(id) => <input id={id} type="date" value={c.start} onChange={(e) => setContract(i, { start: e.target.value })} />}</Field>
                    <Field label="Date de fin" error={err(`c${i}end`)}>
                      {(id) => <input id={id} type="date" value={c.type === 'CDI' ? '' : c.end ?? ''} disabled={c.type === 'CDI'} min={c.start} onChange={(e) => setContract(i, { end: e.target.value })} />}
                    </Field>
                    <button type="button" className="icon-btn icon-btn-danger" aria-label={`Supprimer le contrat ${i + 1}`} onClick={() => set('contracts', contracts.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                  </div>
                ))}
                <button type="button" className="btn btn-ghost btn-sm frows-add" onClick={addContract}><Plus size={13} aria-hidden /> Ajouter un contrat</button>
              </div>
            )}
          </div>
          </>) : (
            <p className="fnote"><FileSignature size={13} aria-hidden /> Contrat actif : <strong>{form.contract}</strong>{form.contractEnd ? ` jusqu’au ${formatDate(form.contractEnd)}` : ""} — les contrats (ajout, renouvellement, clôture) se gèrent dans l’onglet <strong>Contrats</strong> de la fiche.</p>
          )}

          {isNew && (
            <div className="fprimes">
              <Switch checked={form.allowPrimes} onChange={(v) => setForm((f) => ({ ...f, allowPrimes: v, primes: v ? f.primes : [] }))} label="Autoriser les primes pour cet employé" />
              <span className="small text-muted">Décoché par défaut.</span>
              {form.allowPrimes && (
                activePrimes.length === 0
                  ? <p className="small text-muted mt-8">Aucune prime active dans le catalogue (Paramètres › Catalogue des primes).</p>
                  : (
                    <div className="perm-options">
                      {activePrimes.map((p) => {
                        const on = form.primes.some((x) => x.primeId === p.id);
                        return (
                          <label key={p.id} className={`perm-option ${on ? 'on' : ''}`}>
                            <input type="checkbox" checked={on} onChange={(e) => togglePrime(p.id, e.target.checked)} />
                            <span>{p.name} <span className="text-muted small">— {formatMoney(p.amount, data.currency)}, {PRIME_PERIODICITY[p.periodicity].toLowerCase()}</span></span>
                          </label>
                        );
                      })}
                    </div>
                  )
              )}
            </div>
          )}
        </FormCard>

        {/* 4. Compte utilisateur, rôle et permissions */}
        <FormCard icon={<KeyRound size={16} />} title={<><span className="fstep">4</span> Compte utilisateur, rôle et permissions</>}
          subtitle="Le compte est un utilisateur du core tenant ; il reçoit l’accès à l’application RH de la société."
          actions={<Switch checked={form.account.active} onChange={(v) => set('account', { ...form.account, active: v })} label="Accès activé" />}>
          {!form.account.active ? (
            <p className="fnote"><Users size={13} aria-hidden /> Sans compte, l’employé n’accède pas à l’application RH ; son dossier est géré par la RH.</p>
          ) : (
            <div className="form-grid">
              <Field label="Utilisateur du core tenant" required={isNew} error={err('user')} hint="Comptes du Core tenant › Utilisateurs, non liés à une autre fiche.">
                {(id) => (
                  <select id={id} value={form.account.userId ?? ''} onChange={(e) => selectUser(e.target.value)}>
                    <option value="">Sélectionner un utilisateur…</option>
                    {tenantUsers.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {u.email}{u.status === 'invite' ? ' (invité)' : ''}</option>)}
                  </select>
                )}
              </Field>
              <div className="fuser">
                {linkedUser ? (
                  <>
                    <Avatar employee={linkedUser} size={34} />
                    <div className="fuser-text">
                      <strong>{linkedUser.firstName} {linkedUser.lastName}</strong>
                      <span className="small text-muted">Identifiant : <span className="mono">{linkedUser.login}</span></span>
                    </div>
                    {linkedUser.status === 'invite' ? <Badge tone="warning">Invitation envoyée</Badge> : <Badge tone="success" icon={<CheckCircle2 size={11} aria-hidden />}>Actif</Badge>}
                  </>
                ) : <span className="small text-muted">Aucun utilisateur sélectionné.</span>}
              </div>

              <div className="span-2 frole">
                <div className="frole-head">
                  <div>
                    <p className="extra-perms-title">Rôles <span className="req" aria-hidden>*</span></p>
                    <p className="field-hint">Un ou plusieurs rôles : leurs permissions se cumulent. Le premier coché est le rôle principal.</p>
                  </div>
                  <div className="frole-summary" aria-live="polite">
                    <span><strong>{roleIds.length}</strong> rôle{roleIds.length > 1 ? 's' : ''}</span>
                    <span className="frole-meter" aria-hidden><span style={{ width: `${(rolePerms.size / PERMISSIONS.length) * 100}%` }} /></span>
                    <span><strong>{rolePerms.size}</strong>/{PERMISSIONS.length} permissions</span>
                  </div>
                </div>
                <div className="role-list" role="group" aria-label="Rôles attribués">
                  {roles.map((r) => {
                    const on = roleIds.includes(r.id);
                    const primary = roleIds[0] === r.id;
                    const cover = on ? coveredBy(r) : undefined;
                    return (
                      <label key={r.id} className={`role-card ${on ? 'checked' : ''} ${cover ? 'covered' : ''}`} title={`${r.name} — ${r.permissions.length} permission${r.permissions.length > 1 ? 's' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => toggleRole(r.id)} />
                        <span className="role-card-check" aria-hidden><Check size={11} strokeWidth={3} /></span>
                        <span className="role-card-name">{r.name}</span>
                        {primary ? <Badge tone="primary" icon={<Star size={10} aria-hidden />}>Principal</Badge>
                          : on && !cover && <button type="button" className="role-card-link" onClick={(e) => { e.preventDefault(); makePrimary(r.id); }}>Définir principal</button>}
                      </label>
                    );
                  })}
                </div>
                {selectedRoles.filter((r) => coveredBy(r)).map((r) => (
                  <p key={r.id} className="role-card-note">« {r.name} » est déjà couvert par « {coveredBy(r)!.name} » : il n’ajoute aucune permission.</p>
                ))}
                {err('roles') && <p className="field-error mt-8">{err('roles')}</p>}
              </div>
              <div className="span-2 extra-perms-field">
                <p className="extra-perms-title">Permissions supplémentaires <span className="text-muted">(hors rôles)</span></p>
                <ExtraPermissionsPicker roles={selectedRoles} value={profile.extraPermissions} onChange={(keys) => setP('extraPermissions', keys)} />
              </div>
            </div>
          )}
        </FormCard>

        {/* 5. Documents de l'employé */}
        <FormCard icon={<FileText size={16} />} title={<><span className="fstep">5</span> Documents de l’employé</>}
          subtitle="Facultatif : joignez les pièces déjà disponibles. Les types sont paramétrés dans Paramètres › Types de documents.">
          {docTypes.some((t) => t.required) && (
            <div className="fdoc-required">
              <span className="small text-muted">Pièces obligatoires :</span>
              {docTypes.filter((t) => t.required).map((t) => {
                const ok = documents.some((d) => d.typeId === t.id && d.fileName);
                return <Badge key={t.id} tone={ok ? 'success' : 'muted'} icon={ok ? <CheckCircle2 size={11} aria-hidden /> : undefined}>{t.name}</Badge>;
              })}
            </div>
          )}
          {documents.length === 0 ? (
            <p className="fnote"><FileText size={13} aria-hidden /> Aucun document joint pour l’instant.</p>
          ) : (
            <div className="frows">
              <div className="frows-head frow-doc" aria-hidden><span>Type de document</span><span>Fichier</span><span>Expire le</span><span /></div>
              {documents.map((d, i) => {
                const type = data.documentTypes.find((t) => t.id === d.typeId);
                return (
                  <div key={d.id} className="frow frow-doc">
                    <Field label="Type de document" error={err(`d${i}type`)}>
                      {(id) => (
                        <select id={id} value={d.typeId} onChange={(e) => setDoc(i, { typeId: e.target.value })}>
                          <option value="">Sélectionner…</option>
                          {docTypes.map((t) => <option key={t.id} value={t.id}>{t.name}{t.required ? ' *' : ''}</option>)}
                        </select>
                      )}
                    </Field>
                    <Field label="Fichier" error={err(`d${i}file`)} hint={type ? `Formats : ${type.formats.join(', ')}` : undefined}>
                      {(id) => (
                        <label className={`ffile ${d.fileName ? 'has-file' : ''}`} htmlFor={id}>
                          <Upload size={13} aria-hidden />
                          <span className="ffile-name">{d.fileName || 'Insérer un document…'}</span>
                          <input id={id} type="file" accept={type ? type.formats.map((f) => `.${f}`).join(',') : undefined}
                            onChange={(e) => setDoc(i, { fileName: e.target.files?.[0]?.name ?? '' })} />
                        </label>
                      )}
                    </Field>
                    <Field label="Expire le">{(id) => <input id={id} type="date" value={d.expiresAt ?? ''} onChange={(e) => setDoc(i, { expiresAt: e.target.value || undefined })} />}</Field>
                    <button type="button" className="icon-btn icon-btn-danger" aria-label={`Supprimer le document ${i + 1}`} onClick={() => set('documents', documents.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
          <button type="button" className="btn btn-ghost btn-sm frows-add" onClick={addDoc} disabled={docTypes.length === 0}><Plus size={13} aria-hidden /> Ajouter un document</button>
        </FormCard>
      </div>
    </Drawer>
  );
}
