// Règles de présence : fonctions solo liées (suppléance) et présence minimale des fonctions groupe.
import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, Link2, Pencil, Plus, ShieldAlert, Users } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { ArchivedBadge, Avatar, Badge, Card, EmptyState, Field, Modal, Segmented, Switch } from '../../components/ui';
import type { FunctionLink, ID, JobFunction } from '../../types';
import { functionHolders, policyTypeIds, presenceEffect } from '../../utils/presence';
import { RulesSection } from './ReferenceSections';

/** Onglet « Règles et quotas » : quotas puis règles de présence. */
export function RulesAndPresence() {
  return (
    <div className="stack">
      <RulesSection />
      <h2 className="section-divider">Règles de présence</h2>
      <PresencePolicyCard />
      <SoloLinksCard />
      <GroupMinimumsCard />
    </div>
  );
}

function PresencePolicyCard() {
  const { db, companyId, setPresencePolicy, toast } = useStore();
  const data = useCompanyData();
  const types = policyTypeIds(db, companyId);
  const effect = presenceEffect(db, companyId);
  const save = (leaveTypeIds: ID[], eff: 'block' | 'warning') => setPresencePolicy({ companyId, leaveTypeIds, effect: eff });

  return (
    <Card title={<span className="row-gap"><ShieldAlert size={15} aria-hidden /> Application des règles</span>}>
      <div className="policy-grid">
        <div>
          <p className="label">Lorsqu’une règle n’est pas respectée</p>
          <Segmented<'block' | 'warning'> label="Effet des règles de présence" value={effect}
            onChange={(v) => { save([...types], v); toast(v === 'block' ? 'Les demandes en conflit seront bloquées' : 'Les demandes en conflit afficheront un avertissement'); }}
            options={[{ value: 'block', label: 'Bloquer la demande' }, { value: 'warning', label: 'Avertir seulement' }]} />
          <p className="small text-muted mt-8">Les approbateurs voient toujours le conflit dans le détail de la demande.</p>
        </div>
        <div>
          <p className="label">Types de congé soumis aux règles</p>
          <div className="check-grid">
            {data.leaveTypes.filter((t) => !t.archived).map((t) => (
              <label key={t.id} className="check">
                <input type="checkbox" checked={types.has(t.id)}
                  onChange={(e) => { const next = new Set(types); if (e.target.checked) next.add(t.id); else next.delete(t.id); save([...next], effect); }} />
                <span className="type-tag"><span className="type-dot" style={{ background: t.color }} aria-hidden />{t.name}</span>
              </label>
            ))}
          </div>
          <p className="small text-muted mt-8">Les absences imprévisibles (maladie…) sont généralement exclues.</p>
        </div>
      </div>
    </Card>
  );
}

function SoloLinksCard() {
  const { setArchived } = useStore();
  const data = useCompanyData();
  const [editing, setEditing] = useState<{ link?: FunctionLink }>();
  const holderNames = (fnId: ID) => data.employees.filter((e) => e.functionId === fnId && e.status !== 'inactif').map((e) => `${e.firstName} ${e.lastName}`).join(', ') || 'Vacant';

  return (
    <Card title={<span className="row-gap"><Link2 size={15} aria-hidden /> Fonctions solo liées</span>}
      actions={<button type="button" className="btn btn-sm btn-primary" onClick={() => setEditing({})}><Plus size={14} aria-hidden /> Lier des fonctions</button>} flush>
      <p className="card-intro">Les titulaires de fonctions liées se remplacent : ils ne peuvent pas être en congé le même jour ni sur une période qui se chevauche.</p>
      {data.functionLinks.length === 0 ? <EmptyState title="Aucune liaison" text="Liez au moins deux fonctions solo." /> : (
        <ul className="link-list">
          {data.functionLinks.map((l) => (
            <li key={l.id} className={l.archived ? 'archived' : ''}>
              <div className="grow">
                <p className="person-name">{l.name} {l.archived && <ArchivedBadge />}</p>
                <div className="link-chain">
                  {l.functionIds.map((id, i) => (
                    <span key={id} className="link-chain-item">
                      {i > 0 && <span className="link-sep" aria-label="lié à">⇄</span>}
                      <span className="fn-chip"><span className="fn-chip-name">{data.fn(id)?.name}</span><span className="fn-chip-holder">{holderNames(id)}</span></span>
                    </span>
                  ))}
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-ghost" disabled={l.archived} onClick={() => setEditing({ link: l })}><Pencil size={13} aria-hidden /> Modifier</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setArchived('functionLinks', l.id, !l.archived)}>
                {l.archived ? <><ArchiveRestore size={13} aria-hidden /> Restaurer</> : <><Archive size={13} aria-hidden /> Archiver</>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <LinkModal state={editing} onClose={() => setEditing(undefined)} />
    </Card>
  );
}

function LinkModal({ state, onClose }: { state?: { link?: FunctionLink }; onClose: () => void }) {
  const { companyId, addItem, updateItem, toast } = useStore();
  const data = useCompanyData();
  const link = state?.link;
  const [name, setName] = useState('');
  const [ids, setIds] = useState<ID[]>([]);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { if (state) { setName(link?.name ?? ''); setIds(link?.functionIds ?? []); setSubmitted(false); } }, [state, link]);
  if (!state) return null;

  const solos = data.functions.filter((f) => f.kind === 'solo' && !f.archived);
  const errors = { name: name.trim() ? '' : 'Nom requis.', ids: ids.length >= 2 ? '' : 'Sélectionnez au moins deux fonctions solo.' };
  const save = () => {
    setSubmitted(true);
    if (errors.name || errors.ids) return;
    const saved: FunctionLink = { ...(link ?? { id: newId('fl'), companyId }), name: name.trim(), functionIds: ids };
    if (link) updateItem('functionLinks', saved); else addItem('functionLinks', saved);
    toast(`Liaison « ${saved.name} » enregistrée`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={link ? `Modifier « ${link.name} »` : 'Lier des fonctions solo'}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>Enregistrer</button></>}>
      <Field label="Nom de la liaison" required error={submitted ? errors.name : undefined} hint="Ex. : Suppléance finance">
        {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <fieldset className="form-section mt-16">
        <legend>Fonctions solo concernées</legend>
        {submitted && errors.ids && <p className="field-error mb-12">{errors.ids}</p>}
        <div className="fn-pick-list">
          {solos.map((f) => {
            const holder = data.employees.find((e) => e.functionId === f.id && e.status !== 'inactif');
            const checked = ids.includes(f.id);
            return (
              <label key={f.id} className={`fn-pick ${checked ? 'checked' : ''}`}>
                <input type="checkbox" checked={checked} onChange={(e) => setIds((l) => (e.target.checked ? [...l, f.id] : l.filter((x) => x !== f.id)))} />
                {holder ? <Avatar employee={holder} size={26} /> : <span className="avatar" style={{ width: 26, height: 26 }} aria-hidden>—</span>}
                <span className="grow"><span className="person-name">{f.name}</span><span className="block small text-muted">{holder ? `${holder.firstName} ${holder.lastName}` : 'Vacant'} · {data.departmentName(f.departmentId) ?? 'Transverse'}</span></span>
              </label>
            );
          })}
        </div>
        <p className="small text-muted mt-8">Seules les fonctions de type « solo » peuvent être liées (Paramètres › Fonctions).</p>
      </fieldset>
    </Modal>
  );
}

function GroupMinimumsCard() {
  const { db, updateItem } = useStore();
  const data = useCompanyData();
  const groups = data.functions.filter((f) => f.kind === 'groupe' && !f.archived);

  const setMin = (f: JobFunction, value: string) => {
    updateItem('functions', { ...f, minPresent: value === '' ? undefined : Math.max(0, Number(value)) });
  };

  return (
    <Card title={<span className="row-gap"><Users size={15} aria-hidden /> Présence minimale des fonctions groupe</span>} flush>
      <p className="card-intro">Nombre de personnes qui doivent rester présentes chaque jour. Exemple : 3 ingénieurs et 2 requis → un seul peut être en congé sur une même période.</p>
      {groups.length === 0 ? <EmptyState title="Aucune fonction groupe" text="Définissez des fonctions de type « groupe » dans Paramètres › Fonctions." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Fonction</th>
                <th scope="col">Titulaires</th>
                <th scope="col" className="num">Effectif</th>
                <th scope="col">Présents minimum</th>
                <th scope="col">Absences simultanées</th>
                <th scope="col">Règle active</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((f) => {
                const holders = functionHolders(db, f.id);
                const max = f.minPresent != null ? Math.max(0, holders.length - f.minPresent) : undefined;
                return (
                  <tr key={f.id}>
                    <td><span className="person-name">{f.name}</span><span className="block small text-muted">{data.departmentName(f.departmentId) ?? 'Transverse'}</span></td>
                    <td><span className="avatar-stack">{holders.map((e) => <span key={e.id} title={`${e.firstName} ${e.lastName}`}><Avatar employee={e} size={24} /></span>)}</span></td>
                    <td className="num">{holders.length}</td>
                    <td>
                      <label className="sr-only" htmlFor={`min-${f.id}`}>Présents minimum pour {f.name}</label>
                      <input id={`min-${f.id}`} className="input-sm" type="number" min={0} max={holders.length} step={1}
                        value={f.minPresent ?? ''} placeholder="—" onChange={(e) => setMin(f, e.target.value)}
                      />
                    </td>
                    <td>
                      {max == null ? <span className="text-muted small">Non défini</span>
                        : max === 0 ? <Badge tone="danger">Aucune absence possible</Badge>
                        : <Badge tone="success">{max} à la fois</Badge>}
                    </td>
                    <td>
                      <Switch checked={f.minPresent != null} label={f.minPresent != null ? 'Oui' : 'Non'}
                        onChange={(v) => setMin(f, v ? String(Math.max(1, holders.length - 1)) : '')} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
