import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Building2, CalendarRange, Plus, Users } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { LeaveForm } from '../leave/LeaveForm';
import { ArchivedBadge, Card, EffectBadge, EFFECTS, EmptyState, Field, Modal, PageHeader, SelectFilter, Switch } from '../../components/ui';
import type { EventEffect, HrEvent } from '../../types';
import { formatRange, overlaps, TODAY } from '../../utils/dates';
import { eventTargets } from '../../utils/leave';

const EVENT_TYPES = ['Réunion', 'Séminaire', 'Formation', 'Clôture', 'Inventaire', 'Projet', 'Salon', 'Audit', 'Vie d’entreprise'];

export function EventsPage() {
  const { setArchived } = useStore();
  const data = useCompanyData();
  const [type, setType] = useState('');
  const [effect, setEffect] = useState('');
  const [when, setWhen] = useState('avenir');
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const list = useMemo(() => data.events
    .filter((e) => showArchived || !e.archived)
    .filter((e) => !type || e.type === type)
    .filter((e) => !effect || e.effect === effect)
    .filter((e) => when === '' || (when === 'avenir' ? e.end >= TODAY : e.end < TODAY))
    .sort((a, b) => a.start.localeCompare(b.start)), [data.events, type, effect, when, showArchived]);

  const impacted = (ev: HrEvent) => data.requests.filter((r) => {
    const emp = data.person(r.employeeId);
    return emp && (r.status === 'en_attente' || r.status === 'approuve') && overlaps(r.start, r.end, ev.start, ev.end) && eventTargets(ev, emp);
  });

  return (
    <>
      <PageHeader eyebrow="Application RH · Planification" icon={<CalendarRange size={20} strokeWidth={1.8} />}
        title="Événements"
        subtitle="Événements de la société et leur effet sur les demandes de congé."
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setLeaveOpen(true)}>Tester une demande de congé</button>
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}><Plus size={16} aria-hidden /> Nouvel événement</button>
          </>
        }
        toolbar={
          <div className="effect-cards">
            {(Object.keys(EFFECTS) as EventEffect[]).map((k) => (
              <div key={k} className={`effect-card effect-${k}`}>
                <EffectBadge effect={k} />
                <p className="small">{EFFECTS[k].help}</p>
              </div>
            ))}
          </div>
        }
      />
      <Card flush>
        <div className="filters">
          <SelectFilter label="Période" value={when} onChange={setWhen} allLabel="Toutes" options={[{ value: 'avenir', label: 'En cours et à venir' }, { value: 'passe', label: 'Passés' }]} />
          <SelectFilter label="Type" value={type} onChange={setType} options={[...new Set(data.events.map((e) => e.type))].map((t) => ({ value: t, label: t }))} />
          <SelectFilter label="Effet" value={effect} onChange={setEffect} options={(Object.keys(EFFECTS) as EventEffect[]).map((k) => ({ value: k, label: EFFECTS[k].label }))} />
          <div className="filter filter-check"><Switch checked={showArchived} onChange={setShowArchived} label="Afficher les archivés" /></div>
        </div>
        {list.length === 0 ? <EmptyState title="Aucun événement" text="Aucun événement ne correspond aux filtres." action={<button type="button" className="btn btn-sm btn-primary" onClick={() => setCreateOpen(true)}>Créer un événement</button>} /> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th scope="col">Événement</th><th scope="col">Type</th><th scope="col">Dates</th><th scope="col">Concerne</th><th scope="col">Effet</th><th scope="col">Demandes impactées</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {list.map((e) => {
                  const imp = impacted(e);
                  return (
                    <tr key={e.id} className={e.archived ? 'row-archived' : ''}>
                      <td><span className="person-name">{e.name}</span> {e.archived && <ArchivedBadge />}<span className="block small text-muted">{e.description}</span></td>
                      <td>{e.type}</td>
                      <td className="nowrap">{formatRange(e.start, e.end)}</td>
                      <td className="small">
                        {e.allCompany ? <span className="row-gap"><Building2 size={14} aria-hidden /> Toute la société</span> : (
                          <>
                            {e.departmentIds.map((d) => data.departmentName(d)).join(', ')}
                            {e.employeeIds.length > 0 && <span className="block text-muted"><Users size={13} aria-hidden className="inline-icon" /> {e.employeeIds.map((id) => { const p = data.person(id); return `${p?.firstName} ${p?.lastName}`; }).join(', ')}</span>}
                          </>
                        )}
                      </td>
                      <td><EffectBadge effect={e.effect} /></td>
                      <td className="small">
                        {e.effect === 'info' ? <span className="text-muted">—</span> : imp.length === 0 ? <span className="text-muted">Aucune</span> : (
                          <span title={imp.map((r) => data.person(r.employeeId)?.firstName).join(', ')}>
                            <strong>{imp.length}</strong> ({imp.map((r) => data.person(r.employeeId)?.firstName).join(', ')})
                          </span>
                        )}
                      </td>
                      <td className="actions">
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setArchived('events', e.id, !e.archived)}>
                          {e.archived ? <><ArchiveRestore size={14} aria-hidden /> Restaurer</> : <><Archive size={14} aria-hidden /> Archiver</>}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <EventForm open={createOpen} onClose={() => setCreateOpen(false)} />
      <LeaveForm open={leaveOpen} onClose={() => setLeaveOpen(false)} />
    </>
  );
}

function EventForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { companyId, addEvent, toast } = useStore();
  const data = useCompanyData();
  const empty = { name: '', type: 'Réunion', start: '', end: '', description: '', effect: 'info' as EventEffect, allCompany: true, departmentIds: [] as string[], employeeIds: [] as string[] };
  const [f, setF] = useState(empty);
  const [submitted, setSubmitted] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const toggleIn = (k: 'departmentIds' | 'employeeIds', id: string) => setF((x) => ({ ...x, [k]: x[k].includes(id) ? x[k].filter((i) => i !== id) : [...x[k], id] }));

  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = 'Nom requis.';
  if (!f.start) errors.start = 'Date de début requise.';
  if (!f.end || f.end < f.start) errors.end = 'Date de fin invalide.';
  if (!f.allCompany && f.departmentIds.length + f.employeeIds.length === 0) errors.target = 'Choisissez au moins un département ou une personne.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const close = () => { setF(empty); setSubmitted(false); onClose(); };
  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    addEvent({ id: newId('ev'), companyId, ...f, name: f.name.trim() });
    toast(`Événement « ${f.name.trim()} » créé`);
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Nouvel événement" size="lg"
      footer={<><button type="button" className="btn btn-ghost" onClick={close}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>Créer l’événement</button></>}>
      <div className="form-grid">
        <Field label="Nom" required error={err('name')} className="span-2">{(id) => <input id={id} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex. : Comité de direction trimestriel" />}</Field>
        <Field label="Type">{(id) => <select id={id} value={f.type} onChange={(e) => set('type', e.target.value)}>{EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>}</Field>
        <div />
        <Field label="Date de début" required error={err('start')}>{(id) => <input id={id} type="date" value={f.start} onChange={(e) => { set('start', e.target.value); if (!f.end || e.target.value > f.end) set('end', e.target.value); }} />}</Field>
        <Field label="Date de fin" required error={err('end')}>{(id) => <input id={id} type="date" value={f.end} min={f.start || undefined} onChange={(e) => set('end', e.target.value)} />}</Field>
        <Field label="Description" className="span-2">{(id) => <textarea id={id} rows={2} value={f.description} onChange={(e) => set('description', e.target.value)} />}</Field>
      </div>

      <fieldset className="form-section">
        <legend>Effet sur les demandes de congé</legend>
        <div className="effect-picker" role="radiogroup" aria-label="Effet">
          {(Object.keys(EFFECTS) as EventEffect[]).map((k) => (
            <label key={k} className={`effect-option effect-${k} ${f.effect === k ? 'checked' : ''}`}>
              <input type="radio" name="effect" checked={f.effect === k} onChange={() => set('effect', k)} />
              <EffectBadge effect={k} />
              <span className="small">{EFFECTS[k].help}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Personnes concernées</legend>
        <Switch checked={f.allCompany} onChange={(v) => set('allCompany', v)} label="Toute la société" />
        {!f.allCompany && (
          <div className="target-grid mt-12">
            <div>
              <p className="label">Départements</p>
              <div className="check-list">
                {data.activeDepartments.map((d) => (
                  <label key={d.id} className="check"><input type="checkbox" checked={f.departmentIds.includes(d.id)} onChange={() => toggleIn('departmentIds', d.id)} /> {d.name}</label>
                ))}
              </div>
            </div>
            <div>
              <p className="label">Personnes</p>
              <div className="check-list scroll">
                {data.people.filter((e) => e.status !== 'inactif').map((e) => (
                  <label key={e.id} className="check"><input type="checkbox" checked={f.employeeIds.includes(e.id)} onChange={() => toggleIn('employeeIds', e.id)} /> {e.firstName} {e.lastName}</label>
                ))}
              </div>
            </div>
            {err('target') && <p className="field-error span-2">{err('target')}</p>}
          </div>
        )}
      </fieldset>
    </Modal>
  );
}
