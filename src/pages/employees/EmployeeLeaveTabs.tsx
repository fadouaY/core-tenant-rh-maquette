// Onglets de paramétrage congé et accès de la fiche employé.
import { Fragment, useState } from 'react';
import { Check, Minus, Plus, RotateCcw, Save, Scale, Star, Trash2 } from 'lucide-react';
import { PERMISSIONS } from '../../data/mock';
import { useCompanyData, useStore } from '../../store';
import { Badge, Field } from '../../components/ui';
import type { ID, LeaveProfile, Role } from '../../types';
import { formatDays } from '../../utils/dates';
import { balanceTypes, getAnnualBalance, getBalance, profileRoleIds } from '../../utils/leave';
import { dayHours, formatDaysHours, formatHours } from '../../utils/hours';
import { FormCard } from '../../components/FormCard';

function SaveBar({ dirty, onReset, onSave }: { dirty: boolean; onReset: () => void; onSave: () => void }) {
  return (
    <div className="save-bar">
      <button type="button" className="btn btn-ghost" disabled={!dirty} onClick={onReset}><RotateCcw size={14} aria-hidden /> Annuler</button>
      <button type="button" className="btn btn-primary" disabled={!dirty} onClick={onSave}><Save size={14} aria-hidden /> Enregistrer</button>
    </div>
  );
}

export function ProfileTab({ profile }: { profile: LeaveProfile }) {
  const { db, saveProfile, toast } = useStore();
  const data = useCompanyData();
  const [carry, setCarry] = useState<Record<ID, number>>(profile.carryOver);
  const { ref, own } = balanceTypes(db, profile.companyId);
  // Le report s'applique au solde annuel (porté par le type de référence) et aux plafonds propres.
  const carryTypes = [...(ref ? [ref] : []), ...own];
  const deducting = data.leaveTypes.filter((t) => t.deductsFromAnnual && !t.archived);
  const annual = getAnnualBalance(db, profile.employeeId);
  const perDay = dayHours(db.schedules.find((x) => x.id === profile.scheduleId));
  const dirty = JSON.stringify(carry) !== JSON.stringify(profile.carryOver);

  return (
    <div className="emp-leave">
      <FormCard icon={<Scale size={16} />} title="Soldes 2026" subtitle="Jours non travaillés et jours fériés exclus du décompte.">
        <div className="annual-card">
          <div>
            <p className="annual-label">Solde annuel disponible</p>
            <p className="annual-value">{formatDaysHours(annual.available, perDay)} <span>sur {formatDays(annual.acquired)}</span></p>
            <p className="small text-muted">Pris {formatDaysHours(annual.taken, perDay)} · en attente {formatDaysHours(annual.pending, perDay)} · journée = {formatHours(perDay)}</p>
          </div>
          <div className="annual-types">
            <p className="small text-muted">Types imputés :</p>
            {deducting.map((t) => <span key={t.id} className="type-tag small"><span className="type-dot" style={{ background: t.color }} aria-hidden />{t.name}</span>)}
          </div>
        </div>
        {own.length > 0 && <h3 className="sub-title">Hors solde annuel — plafonds propres</h3>}
        {own.length > 0 && <table className="table table-compact">
          <thead><tr><th scope="col">Type</th><th scope="col" className="num">Acquis</th><th scope="col" className="num">Pris</th><th scope="col" className="num">En attente</th><th scope="col" className="num">Disponible</th></tr></thead>
          <tbody>
            {own.map((t) => {
              const b = getBalance(db, profile.employeeId, t.id);
              return (
                <tr key={t.id}>
                  <td><span className="type-tag"><span className="type-dot" style={{ background: t.color }} aria-hidden />{t.name}</span></td>
                  <td className="num">{formatDays(b.acquired)}</td>
                  <td className="num">{formatDays(b.taken)}</td>
                  <td className="num">{formatDays(b.pending)}</td>
                  <td className="num"><strong>{formatDays(b.available)}</strong></td>
                </tr>
              );
            })}
          </tbody>
        </table>}
        <p className="source-note">Quotas d’exemple (Paramètres › Règles et quotas) + reports saisis. Valeurs de démonstration.</p>
      </FormCard>
      <FormCard icon={<RotateCcw size={16} />} title="Reports de l’année précédente" subtitle="Ajoutés aux droits de l’année ; saisis par la RH.">
        <div className="form-grid one-col">
          {carryTypes.map((t) => (
            <Field key={t.id} label={t.annualReference ? 'Solde annuel (jours)' : `${t.name} (jours)`}>
              {(id) => <input id={id} type="number" min={0} step={0.5} value={carry[t.id] ?? 0} onChange={(e) => setCarry((c) => ({ ...c, [t.id]: Number(e.target.value) }))} />}
            </Field>
          ))}
        </div>
        <SaveBar dirty={dirty} onReset={() => setCarry(profile.carryOver)}
          onSave={() => { saveProfile({ ...profile, carryOver: carry }); toast('Profil congé mis à jour'); }} />
      </FormCard>
    </div>
  );
}

type PermState = 'herite' | 'ajoute' | 'retire' | 'aucun';
const PERM_LABEL: Record<PermState, [string, 'success' | 'primary' | 'danger' | 'muted']> = {
  herite: ['Héritée du rôle', 'success'], ajoute: ['Ajoutée', 'primary'], retire: ['Retirée', 'danger'], aucun: ['Non accordée', 'muted'],
};

export function AccessTab({ profile }: { profile: LeaveProfile }) {
  const { saveProfile, toast } = useStore();
  const data = useCompanyData();
  const [roleIds, setRoleIds] = useState(profileRoleIds(profile));
  const [extra, setExtra] = useState(profile.extraPermissions);
  const [removed, setRemoved] = useState(profile.removedPermissions);
  const roles = roleIds.map((id) => data.role(id)).filter((r): r is Role => !!r);
  const fromRoles = new Set(roles.flatMap((r) => r.permissions));
  const dirty = roleIds.join() !== profileRoleIds(profile).join() || extra.join() !== profile.extraPermissions.join() || removed.join() !== profile.removedPermissions.join();

  const stateOf = (key: string): PermState => {
    if (fromRoles.has(key)) return removed.includes(key) ? 'retire' : 'herite';
    return extra.includes(key) ? 'ajoute' : 'aucun';
  };
  const toggle = (key: string) => {
    const s = stateOf(key);
    if (s === 'herite') setRemoved((r) => [...r, key]);
    else if (s === 'retire') setRemoved((r) => r.filter((k) => k !== key));
    else if (s === 'ajoute') setExtra((x) => x.filter((k) => k !== key));
    else setExtra((x) => [...x, key]);
  };
  // Rôles cumulables : le premier est le rôle principal.
  const changeRoles = (ids: string[]) => {
    setRoleIds(ids);
    const perms = new Set(ids.flatMap((id) => data.role(id)?.permissions ?? []));
    setExtra((x) => x.filter((k) => !perms.has(k)));
    setRemoved((r) => r.filter((k) => perms.has(k)));
  };
  const toggleRole = (id: string) => changeRoles(roleIds.includes(id) ? roleIds.filter((x) => x !== id) : [...roleIds, id]);
  const groups = [...new Set(PERMISSIONS.map((p) => p.group))];
  const counts = PERMISSIONS.reduce((acc, p) => { acc[stateOf(p.key)]++; return acc; }, { herite: 0, ajoute: 0, retire: 0, aucun: 0 } as Record<PermState, number>);

  return (
    <div className="two-col access-layout">
      <section className="panel">
        <h2 className="panel-title">Rôles et permissions</h2>
        <p className="small text-muted">Un ou plusieurs rôles : leurs permissions se cumulent. Le premier coché est le rôle principal.</p>
        <div className="emp-role-list" role="group" aria-label="Rôles attribués">
          {data.roles.filter((r) => !r.archived || roleIds.includes(r.id)).map((r) => {
            const on = roleIds.includes(r.id);
            return (
              <label key={r.id} className={`role-card ${on ? 'checked' : ''}`} title={`${r.description} — ${r.permissions.length} permission${r.permissions.length > 1 ? 's' : ''}`}>
                <input type="checkbox" checked={on} onChange={() => toggleRole(r.id)} />
                <span className="role-card-check" aria-hidden><Check size={11} strokeWidth={3} /></span>
                <span className="role-card-name">{r.name}{r.archived ? ' (archivé)' : ''}</span>
                {roleIds[0] === r.id && <Badge tone="primary" icon={<Star size={10} aria-hidden />}>Principal</Badge>}
              </label>
            );
          })}
        </div>
        {roleIds.length === 0 && <p className="field-error mt-8">Attribuez au moins un rôle.</p>}
        <ul className="perm-summary">
          <li><Badge tone="success">{counts.herite}</Badge> héritées des rôles</li>
          <li><Badge tone="primary">{counts.ajoute}</Badge> ajoutées individuellement</li>
          <li><Badge tone="danger">{counts.retire}</Badge> retirées individuellement</li>
        </ul>
        <SaveBar dirty={dirty && roleIds.length > 0} onReset={() => { setRoleIds(profileRoleIds(profile)); setExtra(profile.extraPermissions); setRemoved(profile.removedPermissions); }}
          onSave={() => { saveProfile({ ...profile, roleId: roleIds[0], roleIds, extraPermissions: extra, removedPermissions: removed }); toast('Rôles et permissions mis à jour'); }} />
      </section>
      <section className="panel panel-flush">
        <div className="table-wrap">
          <table className="table table-compact">
            <thead><tr><th scope="col">Permission</th><th scope="col">Origine</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g}>
                  <tr className="group-row"><th colSpan={3} scope="colgroup">{g}</th></tr>
                  {PERMISSIONS.filter((p) => p.group === g).map((p) => {
                    const s = stateOf(p.key);
                    return (
                      <tr key={p.key} className={s === 'retire' ? 'row-struck' : ''}>
                        <td>{p.label}</td>
                        <td><Badge tone={PERM_LABEL[s][1]}>{PERM_LABEL[s][0]}</Badge></td>
                        <td className="actions">
                          <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggle(p.key)}>
                            {s === 'herite' && <><Minus size={13} aria-hidden /> Retirer</>}
                            {s === 'retire' && <><RotateCcw size={13} aria-hidden /> Rétablir</>}
                            {s === 'ajoute' && <><Trash2 size={13} aria-hidden /> Supprimer l’ajout</>}
                            {s === 'aucun' && <><Plus size={13} aria-hidden /> Ajouter</>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
