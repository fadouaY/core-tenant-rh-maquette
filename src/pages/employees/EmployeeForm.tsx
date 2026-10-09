import { useEffect, useState } from 'react';
import {
  Briefcase, CalendarClock, Clock, FileSignature, GitBranch, Hash, KeyRound, Lock, Save, UserRound, Users,
} from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import type { Employee, LeaveProfile, MaritalStatus } from '../../types';
import { formatDate, TODAY } from '../../utils/dates';
import { defaultProfile } from '../../utils/leave';
import { circuitForDepartment, formatMoney, MARITAL_LABEL, nextMatricule, organisationalSchedule } from '../../utils/org';
import { Alert, Drawer, employeeStatusOptions, Field, Switch } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import { PhoneField } from '../../components/PhoneField';
import { phoneError } from '../../utils/phone';
import { ExtraPermissionsPicker } from './ExtraPermissions';
import { PRIME_PERIODICITY } from './EmployeeSections';

function blankEmployee(companyId: string, defaults: Partial<Employee>): Employee {
  return {
    id: '', companyId, firstName: '', lastName: '', matricule: '', email: '', phone: '', birthDate: '', address: '',
    departmentId: '', functionId: '', hireDate: TODAY, contract: 'CDI', status: 'essai',
    account: { login: '', active: true },
    maritalStatus: 'celibataire', childrenCount: 0, scheduleMode: 'organisation',
    salaries: [], allowPrimes: false, primes: [], history: [],
    ...defaults,
  };
}

/**
 * Création (RH-3) et modification (RH-5, RH-6) d'une fiche employé, en quatre sections :
 * état civil, profil professionnel et mode horaire, contrat et rémunération, compte et accès.
 * Le matricule est attribué par la numérotation de la société ; l'horaire et le circuit découlent du rattachement.
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
  const [submitted, setSubmitted] = useState(false);
  const isNew = !employee;

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setSalary('');
    const base = employee ?? blankEmployee(companyId, {
      phoneCountryId: data.countries.find((c) => !c.archived && c.name === data.company.country)?.id ?? data.countries.find((c) => !c.archived)?.id,
    });
    setForm(base);
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

  // Rattachement automatique (RH-3, RH-6, RH-23).
  const circuit = form.departmentId ? circuitForDepartment(db, form.departmentId) : undefined;
  const orgSchedule = organisationalSchedule(db, form.departmentId, form.subDepartmentId);
  const loading = form.scheduleMode === 'chargement';
  const moved = !!employee && (employee.departmentId !== form.departmentId || employee.subDepartmentId !== form.subDepartmentId);
  const activePrimes = data.primes.filter((p) => !p.archived);
  const needsEnd = form.contract !== 'CDI';

  const errors: Record<string, string> = {};
  if (!form.firstName.trim()) errors.firstName = 'Prénom requis.';
  if (!form.lastName.trim()) errors.lastName = 'Nom requis.';
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Adresse e-mail invalide.';
  if (!matricule.trim()) errors.matricule = 'Matricule requis.';
  else if (data.employees.some((e) => e.id !== form.id && e.matricule.trim().toLowerCase() === matricule.trim().toLowerCase())) {
    errors.matricule = 'Ce matricule est déjà attribué à un autre employé.';
  }
  if (!Number.isInteger(form.childrenCount) || form.childrenCount < 0) errors.childrenCount = 'Nombre entier positif ou nul.';
  if (!form.departmentId) errors.departmentId = 'Choisissez un département.';
  else if (!circuit) errors.circuit = 'Aucun circuit d’approbation actif pour ce département.';
  if (!form.functionId) errors.functionId = 'Choisissez une fonction.';
  if (!form.hireDate) errors.hireDate = 'Date d’embauche requise.';
  if (needsEnd && !form.contractEnd) errors.contractEnd = `Date de fin requise pour un contrat ${form.contract}.`;
  else if (needsEnd && form.contractEnd && form.hireDate && form.contractEnd <= form.hireDate) errors.contractEnd = 'La fin doit suivre la date d’embauche.';
  if (isNew && !(Number(salary) > 0)) errors.salary = 'Montant strictement positif.';
  const phoneCountry = data.country(form.phoneCountryId);
  const phoneErr = phoneError(phoneCountry, form.phone);
  if (phoneErr) errors.phone = phoneErr;
  if (form.account.active && !form.account.login.trim()) errors.login = 'Identifiant requis pour un compte actif.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const id = form.id || newId('e');
    const saved: Employee = {
      ...form, id, matricule: matricule.trim(),
      contractEnd: needsEnd ? form.contractEnd : undefined,
      loadingSince: isNew && loading ? form.hireDate : form.loadingSince,
      salaries: isNew ? [{ id: newId('sal'), amount: Number(salary), since: form.hireDate, reason: 'Salaire d’embauche' }] : form.salaries,
      primes: form.allowPrimes ? form.primes.map((p) => ({ ...p, since: isNew ? form.hireDate : p.since })) : [],
    };
    saveEmployee(saved, { ...profile, employeeId: id, companyId: saved.companyId });
    toast(isNew ? `Dossier de ${saved.firstName} ${saved.lastName} créé — matricule ${saved.matricule}` : 'Fiche employé mise à jour');
    onSaved?.(saved);
    onClose();
  };

  const autoLogin = () => {
    if (!form.firstName || !form.lastName) return;
    const login = `${form.firstName[0]}.${form.lastName.replace(/\s/g, '')}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    setForm((f) => ({ ...f, account: { ...f.account, login: f.account.login || login }, email: f.email || `${login}@${data.company.name.toLowerCase().replace(/\s/g, '-')}.example` }));
  };

  const togglePrime = (primeId: string, on: boolean) => setForm((f) => ({
    ...f, primes: on ? [...f.primes, { primeId, since: f.hireDate }] : f.primes.filter((p) => p.primeId !== primeId),
  }));

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
            <Field label="Prénom" required error={err('firstName')}>{(id) => <input id={id} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} onBlur={autoLogin} autoComplete="off" placeholder="Ex. : Mohamed" />}</Field>
            <Field label="Nom" required error={err('lastName')}>{(id) => <input id={id} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} onBlur={autoLogin} autoComplete="off" placeholder="Ex. : Bennani" />}</Field>
            <Field label="Matricule" required error={err('matricule')}
              hint={isNew ? <>Attribué automatiquement (Paramètres › Numérotation des employés).</> : 'Unique dans la société ; toute modification est historisée.'}>
              {(id) => isNew
                ? <span className="input-locked"><Hash size={13} aria-hidden /><input id={id} value={matricule} readOnly aria-readonly /><Lock size={12} aria-hidden /></span>
                : <input id={id} value={form.matricule} onChange={(e) => set('matricule', e.target.value)} />}
            </Field>
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
            <Field label="E-mail professionnel" required error={err('email')}>{(id) => <input id={id} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="prenom.nom@societe.ma" />}</Field>
            <Field label="Adresse postale">{(id) => <input id={id} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Rue, ville, code postal" />}</Field>
          </div>
        </FormCard>

        {/* 2. Profil professionnel et mode horaire */}
        <FormCard icon={<Briefcase size={16} />} title={<><span className="fstep">2</span> Profil professionnel et mode horaire</>}
          subtitle="L’horaire organisationnel et le circuit d’approbation découlent du rattachement.">
          {isNew ? (
            <div className="deduct-choice mode-choice" role="radiogroup" aria-label="Mode horaire">
              <label className={`deduct-option ${!loading ? 'checked' : ''}`}>
                <input type="radio" name="emp-mode" checked={!loading} onChange={() => set('scheduleMode', 'organisation')} />
                <Clock size={18} aria-hidden />
                <span><span className="person-name">Horaire organisationnel</span><span className="block small text-muted">Par défaut : hérité du département ou du sous-département.</span></span>
              </label>
              <label className={`deduct-option ${loading ? 'checked' : ''}`}>
                <input type="radio" name="emp-mode" checked={loading} onChange={() => set('scheduleMode', 'chargement')} />
                <CalendarClock size={18} aria-hidden />
                <span><span className="person-name">Tableau de chargement</span><span className="block small text-muted">Horaire planifié par périodes (rotations), dès la date d’embauche.</span></span>
              </label>
            </div>
          ) : (
            <p className="fnote"><Clock size={13} aria-hidden /> Mode horaire : <strong>{loading ? 'tableau de chargement' : 'organisationnel'}</strong> — il se change depuis la fiche (action dédiée, avec date d’effet).</p>
          )}
          <div className="form-grid mt-12">
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
                  <option value="">Aucun</option>
                  {subs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              )}
            </Field>
            <Field label="Fonction" required error={err('functionId')} hint={soloTakenBy ? `Fonction solo déjà occupée par ${soloTakenBy.firstName} ${soloTakenBy.lastName}.` : selectedFn ? (!selectedFn.interim ? 'Sans règle d’intérim.' : selectedFn.kind === 'solo' ? 'Intérim solo (une seule personne).' : 'Intérim groupe (plusieurs personnes).') : undefined}>
              {(id) => (
                <select id={id} value={form.functionId} onChange={(e) => set('functionId', e.target.value)}>
                  <option value="">Sélectionner…</option>
                  {fns.map((f) => <option key={f.id} value={f.id}>{f.name}{f.interim ? ` (${f.kind === 'solo' ? 'solo' : 'groupe'})` : ''}</option>)}
                </select>
              )}
            </Field>
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
              <dl>
                <div>
                  <dt><Clock size={13} aria-hidden /> Horaire</dt>
                  <dd>
                    {loading ? <>Planifié dans le tableau de chargement<span className="block small text-muted">{isNew ? `« Non planifié » à partir du ${formatDate(form.hireDate || TODAY)} tant qu’aucune période n’est saisie.` : moved ? 'Le changement de rattachement ne modifie pas l’horaire.' : 'Géré par périodes.'}</span></>
                      : orgSchedule.schedule ? <>{orgSchedule.schedule.name}<span className="block small text-muted">{orgSchedule.source}{moved ? ' · nouvel horaire appliqué' : ''}</span></>
                      : <span className="text-warning">Aucun horaire défini pour ce rattachement</span>}
                  </dd>
                </div>
                <div>
                  <dt><GitBranch size={13} aria-hidden /> Circuit</dt>
                  <dd>{circuit ? <>{circuit.name}<span className="block small text-muted">Circuit du département, appliqué automatiquement</span></> : <span className="text-danger">Aucun circuit actif</span>}</dd>
                </div>
              </dl>
            )}
          </div>
          {errors.circuit && form.departmentId && (
            <Alert tone="danger" title={isNew ? 'Création bloquée' : 'Rattachement impossible'}>
              Le département « {data.departmentName(form.departmentId)} » n’a aucun circuit d’approbation actif. Affectez-lui un circuit dans Paramètres › Circuits d’approbation.
            </Alert>
          )}
        </FormCard>

        {/* 3. Contrat, salaire et primes */}
        <FormCard icon={<FileSignature size={16} />} title={<><span className="fstep">3</span> Contrat, salaire et primes</>}
          subtitle={isNew ? undefined : 'Le salaire et les primes se gèrent dans l’onglet Rémunération de la fiche.'}>
          <div className="form-grid">
            <Field label={isNew ? 'Type de contrat initial' : 'Type de contrat'} required>
              {(id) => (
                <select id={id} value={form.contract} onChange={(e) => set('contract', e.target.value as Employee['contract'])}>
                  <option value="CDI">Contrat à durée indéterminée (CDI)</option>
                  <option value="CDD">Contrat à durée déterminée (CDD)</option>
                  <option value="Stage">Convention de stage</option>
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
          actions={<Switch checked={form.account.active} onChange={(v) => set('account', { ...form.account, active: v })} label="Accès activé" />}>
          {!form.account.active ? (
            <p className="fnote"><Users size={13} aria-hidden /> Sans compte, l’employé n’accède pas à l’application RH ; son dossier est géré par la RH.</p>
          ) : (
            <div className="form-grid">
              <Field label="Identifiant" required error={err('login')} hint="Aucun mot de passe n’est géré dans la maquette.">
                {(id) => <input id={id} value={form.account.login} onChange={(e) => set('account', { ...form.account, login: e.target.value })} autoComplete="off" />}
              </Field>
              <Field label="Rôle" hint="Les permissions du rôle s’appliquent automatiquement.">
                {(id) => (
                  <select id={id} value={profile.roleId} onChange={(e) => {
                    const perms = data.role(e.target.value)?.permissions ?? [];
                    setProfile((p) => ({ ...p, roleId: e.target.value, extraPermissions: p.extraPermissions.filter((k) => !perms.includes(k)), removedPermissions: [] }));
                  }}>
                    {data.roles.filter((r) => !r.archived || r.id === profile.roleId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}
              </Field>
              <div className="span-2 extra-perms-field">
                <p className="extra-perms-title">Permissions supplémentaires <span className="text-muted">(hors rôle)</span></p>
                <ExtraPermissionsPicker role={data.role(profile.roleId)} value={profile.extraPermissions} onChange={(keys) => setP('extraPermissions', keys)} />
              </div>
            </div>
          )}
        </FormCard>
      </div>
    </Drawer>
  );
}
