// Onglets de paramétrage congé et accès de la fiche employé.
import { Fragment, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Minus, Plus, RotateCcw, Save, Search, Trash2, UserCheck, UserPlus } from 'lucide-react';
import { PERMISSIONS } from '../../data/mock';
import { useCompanyData, useStore } from '../../store';
import { Alert, Avatar, Badge, EmptyState, Field, Modal } from '../../components/ui';
import type { ID, LeaveProfile } from '../../types';
import { formatDays } from '../../utils/dates';
import { balanceTypes, getAnnualBalance, getBalance, resolveApprovers } from '../../utils/leave';
import { dayHours, formatDaysHours, formatHours } from '../../utils/hours';

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
  const [scheduleId, setScheduleId] = useState(profile.scheduleId);
  const [carry, setCarry] = useState<Record<ID, number>>(profile.carryOver);
  const { ref, own } = balanceTypes(db, profile.companyId);
  // Le report s'applique au solde annuel (porté par le type de référence) et aux plafonds propres.
  const carryTypes = [...(ref ? [ref] : []), ...own];
  const deducting = data.leaveTypes.filter((t) => t.deductsFromAnnual && !t.archived);
  const annual = getAnnualBalance(db, profile.employeeId);
  const perDay = dayHours(db.schedules.find((x) => x.id === profile.scheduleId));
  const dirty = scheduleId !== profile.scheduleId || JSON.stringify(carry) !== JSON.stringify(profile.carryOver);
  const schedule = data.schedule(scheduleId);

  return (
    <div className="two-col">
      <section className="panel">
        <h2 className="panel-title">Temps de travail</h2>
        <Field label="Horaire de référence" hint="Les jours non travaillés de l’horaire sont exclus du décompte (exemple).">
          {(id) => (
            <select id={id} value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
              {data.schedules.filter((s) => !s.archived || s.id === scheduleId).map((s) => <option key={s.id} value={s.id}>{s.name}{s.archived ? ' (archivé)' : ''}</option>)}
            </select>
          )}
        </Field>
        <p className="small text-muted mt-8">{schedule?.slots.map((s) => `${s.label} ${s.start}–${s.end}`).join(' · ')}</p>
        <h2 className="panel-title mt-16">Reports de l’année précédente</h2>
        <div className="form-grid">
          {carryTypes.map((t) => (
            <Field key={t.id} label={t.annualReference ? 'Solde annuel (jours)' : `${t.name} (jours)`}>
              {(id) => <input id={id} type="number" min={0} step={0.5} value={carry[t.id] ?? 0} onChange={(e) => setCarry((c) => ({ ...c, [t.id]: Number(e.target.value) }))} />}
            </Field>
          ))}
        </div>
        <SaveBar dirty={dirty} onReset={() => { setScheduleId(profile.scheduleId); setCarry(profile.carryOver); }}
          onSave={() => { saveProfile({ ...profile, scheduleId, carryOver: carry }); toast('Profil congé mis à jour'); }} />
      </section>
      <section className="panel">
        <h2 className="panel-title">Soldes 2026</h2>
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
      </section>
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

const MAX_APPROVERS = 5;

export function ApproversTab({ profile }: { profile: LeaveProfile }) {
  const { db, saveProfile, toast } = useStore();
  const data = useCompanyData();
  const [circuitId, setCircuitId] = useState(profile.circuitId);
  const [ids, setIds] = useState<ID[]>(profile.approverIds);
  const [picker, setPicker] = useState<{ position: number }>();
  const circuit = data.circuit(circuitId);
  const exempt = !!circuit?.exempt;
  const dirty = circuitId !== profile.circuitId || ids.join() !== profile.approverIds.join();
  const fromCircuit = resolveApprovers(db, profile.employeeId, circuitId);
  const customized = !exempt && ids.join() !== fromCircuit.join();
  const managerId = data.person(profile.employeeId)?.managerId;
  const canSave = dirty && (exempt || ids.length > 0);

  const move = (i: number, d: -1 | 1) => setIds((list) => { const n = [...list]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const applyCircuit = (id: string) => { setCircuitId(id); setIds(resolveApprovers(db, profile.employeeId, id)); };
  const insert = (personId: ID, position: number) => setIds((list) => { const n = [...list]; n.splice(position, 0, personId); return n; });
  const reset = () => { setCircuitId(profile.circuitId); setIds(profile.approverIds); };
  const save = () => { saveProfile({ ...profile, circuitId, approverIds: exempt ? [] : ids }); toast('Approbateurs enregistrés'); };

  return (
    <div className="stack">
      <div className="two-col approvers-layout">
        <section className="panel">
          <h2 className="panel-title">Circuit appliqué</h2>
          <Field label="Circuit d’approbation" hint="Changer de circuit recalcule la liste à partir du responsable et du département de l’employé.">
            {(id) => (
              <select id={id} value={circuitId} onChange={(e) => applyCircuit(e.target.value)}>
                {data.circuits.filter((c) => !c.archived || c.id === circuitId).map((c) => <option key={c.id} value={c.id}>{c.name}{c.exempt ? ' — dispensé' : ` — ${c.steps.length} niveau(x)`}</option>)}
              </select>
            )}
          </Field>
          <p className="small text-muted mt-8">{circuit?.description}</p>
          {customized && (
            <div className="custom-note">
              <Badge tone="warning">Liste personnalisée</Badge>
              <span className="small text-muted">La liste diffère du circuit.</span>
              <button type="button" className="link-btn" onClick={() => setIds(fromCircuit)}>Revenir au circuit</button>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="panel-title">{exempt ? 'Approbation' : `Approbateurs ordonnés (${ids.length}/${MAX_APPROVERS})`}</h2>
            {!exempt && (
              <button type="button" className="btn btn-sm btn-primary" disabled={ids.length >= MAX_APPROVERS} onClick={() => setPicker({ position: ids.length })}>
                <UserPlus size={14} aria-hidden /> Ajouter un approbateur
              </button>
            )}
          </div>
          {exempt ? (
            <Alert tone="success" title="Profil dispensé d’approbation">
              <UserCheck size={13} aria-hidden className="inline-icon" /> Les demandes sont validées automatiquement à l’envoi et tracées dans l’historique.
              Pour ajouter des approbateurs, choisissez un circuit avec approbation.
            </Alert>
          ) : (
            <>
              {ids.length === 0 && <Alert tone="warning" title="Aucun approbateur">Ajoutez au moins un approbateur ou choisissez un circuit dispensé.</Alert>}
              <ol className="approver-steps">
                {ids.map((id, i) => {
                  const a = data.person(id);
                  return (
                    <li key={id} className="approver-step">
                      <span className="step-num">{i + 1}</span>
                      <Avatar employee={a} size={30} />
                      <span className="grow">
                        <span className="person-name">{a?.firstName} {a?.lastName}</span>
                        <span className="block small text-muted">{a?.functionName} · {a?.departmentName}{id === managerId ? ' · responsable direct' : ''}</span>
                      </span>
                      <button type="button" className="icon-btn icon-btn-sm" title="Insérer un approbateur avant" aria-label={`Insérer un approbateur avant ${a?.firstName}`} disabled={ids.length >= MAX_APPROVERS} onClick={() => setPicker({ position: i })}><Plus size={14} /></button>
                      <button type="button" className="icon-btn icon-btn-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Monter ${a?.firstName}`}><ArrowUp size={14} /></button>
                      <button type="button" className="icon-btn icon-btn-sm" disabled={i === ids.length - 1} onClick={() => move(i, 1)} aria-label={`Descendre ${a?.firstName}`}><ArrowDown size={14} /></button>
                      <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" onClick={() => setIds((l) => l.filter((x) => x !== id))} aria-label={`Retirer ${a?.firstName}`}><Trash2 size={14} /></button>
                    </li>
                  );
                })}
                {Array.from({ length: MAX_APPROVERS - ids.length }, (_, k) => (
                  <li key={`slot-${k}`} className="approver-step slot">
                    <span className="step-num muted">{ids.length + k + 1}</span>
                    {k === 0 ? (
                      <button type="button" className="slot-btn" onClick={() => setPicker({ position: ids.length })}>
                        <UserPlus size={15} aria-hidden /> Ajouter l’étape {ids.length + 1}
                      </button>
                    ) : <span className="small text-muted">Étape libre</span>}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
      </div>

      {dirty && (
        <div className="unsaved-bar" role="status">
          <span>Modifications non enregistrées{!exempt && ids.length === 0 ? ' — ajoutez au moins un approbateur' : ''}.</span>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={reset}><RotateCcw size={14} aria-hidden /> Annuler</button>
          <button type="button" className="btn btn-primary" disabled={!canSave} onClick={save}><Save size={14} aria-hidden /> Enregistrer</button>
        </div>
      )}

      <ApproverPicker
        open={!!picker}
        position={picker?.position ?? ids.length}
        count={ids.length}
        excluded={[profile.employeeId, ...ids]}
        onClose={() => setPicker(undefined)}
        onPick={(personId, position) => { insert(personId, position); setPicker(undefined); }}
      />
    </div>
  );
}

/** Fenêtre de choix d'un approbateur : recherche, liste des collaborateurs et position dans le circuit. */
function ApproverPicker({ open, position, count, excluded, onClose, onPick }: {
  open: boolean; position: number; count: number; excluded: ID[]; onClose: () => void; onPick: (id: ID, position: number) => void;
}) {
  const data = useCompanyData();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<ID>('');
  const [pos, setPos] = useState(position);
  useEffect(() => { if (open) { setQ(''); setSelected(''); setPos(position); } }, [open, position]);

  const candidates = data.activePeople
    .filter((p) => !excluded.includes(p.id))
    .filter((p) => !q || `${p.firstName} ${p.lastName} ${p.functionName} ${p.departmentName}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'));

  return (
    <Modal open={open} onClose={onClose} title="Ajouter un approbateur"
      footer={<>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button type="button" className="btn btn-primary" disabled={!selected} onClick={() => onPick(selected, pos)}>Ajouter à l’étape {pos + 1}</button>
      </>}>
      <div className="picker-head">
        <div className="input-icon grow">
          <Search size={14} aria-hidden />
          <input type="search" aria-label="Rechercher un collaborateur" placeholder="Nom, fonction, département…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="picker-pos">
          <span className="small text-muted">Position</span>
          <select value={pos} onChange={(e) => setPos(Number(e.target.value))}>
            {Array.from({ length: count + 1 }, (_, i) => <option key={i} value={i}>{i === count ? `Étape ${i + 1} (à la fin)` : `Étape ${i + 1}`}</option>)}
          </select>
        </label>
      </div>
      {candidates.length === 0 ? <EmptyState title="Aucun collaborateur" text="Modifiez la recherche." /> : (
        <ul className="picker-list" role="listbox" aria-label="Collaborateurs">
          {candidates.map((p) => (
            <li key={p.id}>
              <button type="button" role="option" aria-selected={selected === p.id} className={`picker-item ${selected === p.id ? 'selected' : ''}`}
                onClick={() => setSelected(p.id)} onDoubleClick={() => onPick(p.id, pos)}>
                <Avatar employee={p} size={30} />
                <span className="grow">
                  <span className="person-name">{p.firstName} {p.lastName}</span>
                  <span className="block small text-muted">{p.functionName} · {p.departmentName}</span>
                </span>
                {selected === p.id && <Badge tone="primary">Sélectionné</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
