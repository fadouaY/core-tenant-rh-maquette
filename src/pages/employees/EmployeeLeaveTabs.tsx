// Onglets de paramétrage congé et accès de la fiche employé.
import { Fragment, useState } from 'react';
import { Minus, Plus, RotateCcw, Save, Scale, Trash2 } from 'lucide-react';
import { PERMISSIONS } from '../../data/mock';
import { useCompanyData, useStore } from '../../store';
import { Badge, Field } from '../../components/ui';
import type { ID, LeaveProfile } from '../../types';
import { formatDays } from '../../utils/dates';
import { balanceTypes, getAnnualBalance, getBalance } from '../../utils/leave';
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
  const [roleId, setRoleId] = useState(profile.roleId);
  const [extra, setExtra] = useState(profile.extraPermissions);
  const [removed, setRemoved] = useState(profile.removedPermissions);
  const role = data.role(roleId);
  const dirty = roleId !== profile.roleId || extra.join() !== profile.extraPermissions.join() || removed.join() !== profile.removedPermissions.join();

  const stateOf = (key: string): PermState => {
    if (role?.permissions.includes(key)) return removed.includes(key) ? 'retire' : 'herite';
    return extra.includes(key) ? 'ajoute' : 'aucun';
  };
  const toggle = (key: string) => {
    const s = stateOf(key);
    if (s === 'herite') setRemoved((r) => [...r, key]);
    else if (s === 'retire') setRemoved((r) => r.filter((k) => k !== key));
    else if (s === 'ajoute') setExtra((x) => x.filter((k) => k !== key));
    else setExtra((x) => [...x, key]);
  };
  const changeRole = (id: string) => {
    setRoleId(id);
    const perms = data.role(id)?.permissions ?? [];
    setExtra((x) => x.filter((k) => !perms.includes(k)));
    setRemoved((r) => r.filter((k) => perms.includes(k)));
  };
  const groups = [...new Set(PERMISSIONS.map((p) => p.group))];
  const counts = PERMISSIONS.reduce((acc, p) => { acc[stateOf(p.key)]++; return acc; }, { herite: 0, ajoute: 0, retire: 0, aucun: 0 } as Record<PermState, number>);

  return (
    <div className="two-col access-layout">
      <section className="panel">
        <h2 className="panel-title">Rôle et permissions</h2>
        <Field label="Rôle">
          {(id) => (
            <select id={id} value={roleId} onChange={(e) => changeRole(e.target.value)}>
              {data.roles.filter((r) => !r.archived || r.id === roleId).map((r) => <option key={r.id} value={r.id}>{r.name}{r.archived ? ' (archivé)' : ''}</option>)}
            </select>
          )}
        </Field>
        <p className="small text-muted mt-8">{role?.description}</p>
        <ul className="perm-summary">
          <li><Badge tone="success">{counts.herite}</Badge> héritées du rôle</li>
          <li><Badge tone="primary">{counts.ajoute}</Badge> ajoutées individuellement</li>
          <li><Badge tone="danger">{counts.retire}</Badge> retirées individuellement</li>
        </ul>
        <SaveBar dirty={dirty} onReset={() => { setRoleId(profile.roleId); setExtra(profile.extraPermissions); setRemoved(profile.removedPermissions); }}
          onSave={() => { saveProfile({ ...profile, roleId, extraPermissions: extra, removedPermissions: removed }); toast('Accès mis à jour'); }} />
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
