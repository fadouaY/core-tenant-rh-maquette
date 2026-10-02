import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import type { Employee, LeaveProfile } from '../../types';
import { TODAY } from '../../utils/dates';
import { defaultProfile, resolveApprovers } from '../../utils/leave';
import { Drawer, employeeStatusOptions, Field, Switch } from '../../components/ui';
import { PhoneField } from '../../components/PhoneField';
import { phoneError } from '../../utils/phone';
import { ExtraPermissionsPicker } from './ExtraPermissions';

function blankEmployee(companyId: string, defaults: Partial<Employee>): Employee {
  return {
    id: '', companyId, firstName: '', lastName: '', matricule: '', email: '', phone: '', birthDate: '', address: '',
    departmentId: '', functionId: '', hireDate: TODAY, contract: 'CDI', status: 'essai',
    account: { login: '', active: true }, ...defaults,
  };
}

export function EmployeeForm({ open, onClose, employee, onSaved }: {
  open: boolean; onClose: () => void; employee?: Employee; onSaved?: (e: Employee) => void;
}) {
  const { db, companyId, saveEmployee, toast } = useStore();
  const data = useCompanyData();
  const deps = data.departments.filter((d) => !d.archived);
  const [form, setForm] = useState<Employee>(() => blankEmployee(companyId, {}));
  const [profile, setProfile] = useState<LeaveProfile>(() => defaultProfile(db, blankEmployee(companyId, {})));
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    const base = employee ?? blankEmployee(companyId, {
      matricule: `${data.company.name.slice(0, 2).toUpperCase()}C-${String(2000 + data.employees.length * 7).padStart(5, '0')}`,
      phoneCountryId: data.countries.find((c) => !c.archived && c.name === data.company.country)?.id ?? data.countries.find((c) => !c.archived)?.id,
    });
    setForm(base);
    setProfile(data.profile(base.id) ?? defaultProfile(db, base));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, employee, companyId]);

  const setP = <K extends keyof LeaveProfile>(k: K, v: LeaveProfile[K]) => setProfile((p) => ({ ...p, [k]: v }));
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setForm((f) => ({ ...f, [k]: v }));
  const fns = data.functions.filter((f) => !f.archived && (!form.departmentId || !f.departmentId || f.departmentId === form.departmentId));
  const managers = data.employees.filter((e) => e.id !== form.id && e.status !== 'inactif');
  const selectedFn = data.fn(form.functionId);
  const soloTakenBy = selectedFn?.kind === 'solo' ? data.employees.find((e) => e.id !== form.id && e.functionId === selectedFn.id && e.status !== 'inactif') : undefined;

  const errors: Record<string, string> = {};
  if (!form.firstName.trim()) errors.firstName = 'Prénom requis.';
  if (!form.lastName.trim()) errors.lastName = 'Nom requis.';
  if (!/^\S+@\S+\.\S+$/.test(form.email)) errors.email = 'Adresse e-mail invalide.';
  if (!form.departmentId) errors.departmentId = 'Choisissez un département.';
  if (!form.functionId) errors.functionId = 'Choisissez une fonction.';
  if (!form.hireDate) errors.hireDate = 'Date d’embauche requise.';
  const phoneCountry = data.country(form.phoneCountryId);
  const phoneErr = phoneError(phoneCountry, form.phone);
  if (phoneErr) errors.phone = phoneErr;
  if (form.account.active && !form.account.login.trim()) errors.login = 'Identifiant requis pour un compte actif.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const isNew = !form.id;
    const saved: Employee = { ...form, id: form.id || newId('e') };
    let savedProfile: LeaveProfile = { ...profile, employeeId: saved.id, companyId: saved.companyId };
    // Approbateurs recalculés à la création ou si le circuit / le responsable change.
    if (isNew || profile.circuitId !== data.profile(saved.id)?.circuitId || saved.managerId !== employee?.managerId) {
      const tmp = { ...db, employees: [...db.employees.filter((e) => e.id !== saved.id), saved] };
      savedProfile = { ...savedProfile, approverIds: resolveApprovers(tmp, saved.id, savedProfile.circuitId) };
    }
    saveEmployee(saved, savedProfile);
    toast(isNew ? `${saved.firstName} ${saved.lastName} a été ajouté(e)` : 'Fiche employé mise à jour');
    onSaved?.(saved);
    onClose();
  };

  const autoLogin = () => {
    if (!form.firstName || !form.lastName) return;
    const login = `${form.firstName[0]}.${form.lastName.replace(/\s/g, '')}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    setForm((f) => ({ ...f, account: { ...f.account, login: f.account.login || login }, email: f.email || `${login}@${data.company.name.toLowerCase().replace(/\s/g, '-')}.example` }));
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      wide
      title={employee ? `Modifier ${employee.firstName} ${employee.lastName}` : 'Ajouter un employé'}
      subtitle="Les champs marqués d’un astérisque sont obligatoires."
      footer={
        <>
          {submitted && Object.keys(errors).length > 0 && <span className="footer-note text-danger">{Object.keys(errors).length} champ(s) à corriger</span>}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button type="button" className="btn btn-primary" onClick={save}><Save size={15} aria-hidden /> Enregistrer</button>
        </>
      }
    >
      <fieldset className="form-section">
        <legend>Informations personnelles</legend>
        <div className="form-grid">
          <Field label="Prénom" required error={err('firstName')}>{(id) => <input id={id} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} onBlur={autoLogin} autoComplete="off" />}</Field>
          <Field label="Nom" required error={err('lastName')}>{(id) => <input id={id} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} onBlur={autoLogin} autoComplete="off" />}</Field>
          <Field label="Date de naissance">{(id) => <input id={id} type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />}</Field>
          <Field label="Téléphone" error={err('phone')} hint={phoneCountry ? `${phoneCountry.digits} chiffres attendus pour ${phoneCountry.name}.` : 'Indicatifs paramétrés dans Paramètres › Pays et téléphone.'}>
            {(id) => (
              <PhoneField id={id} invalid={!!err('phone')} value={form.phone} countryId={form.phoneCountryId}
                countries={data.countries.filter((c) => !c.archived || c.id === form.phoneCountryId)}
                onChange={(countryId, phone) => setForm((f) => ({ ...f, phoneCountryId: countryId, phone }))} />
            )}
          </Field>
          <Field label="E-mail professionnel" required error={err('email')} className="span-2">{(id) => <input id={id} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />}</Field>
          <Field label="Adresse" className="span-2">{(id) => <input id={id} value={form.address} onChange={(e) => set('address', e.target.value)} />}</Field>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Informations professionnelles</legend>
        <div className="form-grid">
          <Field label="Société" hint="Tenant actif ; changez-le depuis la barre supérieure.">
            {(id) => <select id={id} value={form.companyId} disabled><option value={form.companyId}>{data.company.name}</option></select>}
          </Field>
          <Field label="Matricule">{(id) => <input id={id} value={form.matricule} onChange={(e) => set('matricule', e.target.value)} />}</Field>
          <Field label="Département" required error={err('departmentId')}>
            {(id) => (
              <select id={id} value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value, functionId: '' }))}>
                <option value="">Sélectionner…</option>
                {deps.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Fonction" required error={err('functionId')} hint={soloTakenBy ? `Fonction solo déjà occupée par ${soloTakenBy.firstName} ${soloTakenBy.lastName}.` : selectedFn ? (selectedFn.kind === 'solo' ? 'Fonction solo (une seule personne).' : 'Fonction groupe (plusieurs personnes).') : undefined}>
            {(id) => (
              <select id={id} value={form.functionId} onChange={(e) => set('functionId', e.target.value)}>
                <option value="">Sélectionner…</option>
                {fns.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.kind === 'solo' ? 'solo' : 'groupe'})</option>)}
              </select>
            )}
          </Field>
          <Field label="Responsable hiérarchique (N+1)">
            {(id) => (
              <select id={id} value={form.managerId ?? ''} onChange={(e) => set('managerId', e.target.value || undefined)}>
                <option value="">Aucun</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
              </select>
            )}
          </Field>
          <Field label="Date d’embauche" required error={err('hireDate')}>{(id) => <input id={id} type="date" value={form.hireDate} onChange={(e) => set('hireDate', e.target.value)} />}</Field>
          <Field label="Contrat">
            {(id) => (
              <select id={id} value={form.contract} onChange={(e) => set('contract', e.target.value as Employee['contract'])}>
                <option>CDI</option><option>CDD</option><option>Stage</option>
              </select>
            )}
          </Field>
          <Field label="Statut" hint={form.status === 'inactif' ? 'Un employé inactif ne peut plus déposer de demande ; son historique est conservé.' : undefined}>
            {(id) => (
              <select id={id} value={form.status} onChange={(e) => set('status', e.target.value as Employee['status'])}>
                {employeeStatusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Horaire de travail">
            {(id) => (
              <select id={id} value={profile.scheduleId} onChange={(e) => setP('scheduleId', e.target.value)}>
                {data.schedules.filter((s) => !s.archived || s.id === profile.scheduleId).map((s) => (
                  <option key={s.id} value={s.id}>{s.name} — {s.slots.map((sl) => `${sl.start}-${sl.end}`).join(' / ')}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Circuit d’approbation" hint="Les approbateurs sont déduits du circuit et du responsable.">
            {(id) => (
              <select id={id} value={profile.circuitId} onChange={(e) => setP('circuitId', e.target.value)}>
                {data.circuits.filter((c) => !c.archived || c.id === profile.circuitId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </Field>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Compte utilisateur</legend>
        <Switch checked={form.account.active} onChange={(v) => set('account', { ...form.account, active: v })} label="Accès à l’application activé" />
        {form.account.active && (
          <div className="form-grid mt-12">
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
      </fieldset>

    </Drawer>
  );
}
