import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, ChevronRight, Pencil, Plus, Save, Trash2, UserCheck } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Alert, ArchivedBadge, Avatar, Badge, Card, Drawer, Field, Switch } from '../../components/ui';
import type { ApprovalCircuit, CircuitStep, CircuitStepKind } from '../../types';
import { resolveApprovers } from '../../utils/leave';

const KIND_LABEL: Record<CircuitStepKind, string> = {
  manager: 'Manager direct (N+1)',
  departmentHead: 'Responsable du département',
  employee: 'Personne nommée',
};

export function CircuitsSection() {
  const { db, companyId, addItem, updateCircuit, setArchived, toast } = useStore();
  const data = useCompanyData();
  const [editing, setEditing] = useState<ApprovalCircuit>();
  const [showArchived, setShowArchived] = useState(true);
  const [simEmployeeId, setSimEmployeeId] = useState(data.people.find((e) => e.managerId)?.id ?? '');
  const simEmployee = data.person(simEmployeeId);
  const circuits = data.circuits.filter((c) => showArchived || !c.archived);

  const create = () => setEditing({ id: '', companyId, name: '', description: '', exempt: false, steps: [{ kind: 'manager', label: KIND_LABEL.manager }] });

  return (
    <>
      <Card title="Circuits d’approbation" actions={<button type="button" className="btn btn-primary btn-sm" onClick={create}><Plus size={15} aria-hidden /> Nouveau circuit</button>} flush>
        <div className="settings-intro">
          <p className="small text-muted">Chaque circuit définit de 1 à 5 approbateurs ordonnés. Un circuit « dispensé » valide automatiquement les demandes.</p>
          <Switch checked={showArchived} onChange={setShowArchived} label="Afficher les archivés" />
        </div>
        <div className="sim-bar">
          <label htmlFor="sim-emp" className="small">Simuler pour :</label>
          <select id="sim-emp" value={simEmployeeId} onChange={(e) => setSimEmployeeId(e.target.value)}>
            {data.people.filter((e) => e.status !== 'inactif').map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {data.departmentName(e.departmentId)}</option>)}
          </select>
          <span className="small text-muted">Les étapes affichent l’approbateur résolu pour cet employé.</span>
        </div>
        <ul className="circuit-list">
          {circuits.map((c) => {
            const resolvedCount = simEmployee && !c.exempt ? resolveApprovers(db, simEmployee.id, c.id).length : 0;
            const users = data.profiles.filter((p) => p.circuitId === c.id).length;
            return (
              <li key={c.id} className={`circuit ${c.archived ? 'archived' : ''}`}>
                <div className="circuit-head">
                  <div>
                    <p className="person-name">{c.name} {c.archived && <ArchivedBadge />}</p>
                    <p className="small text-muted">{c.description} · {users} employé(s)</p>
                  </div>
                  <div className="row-gap">
                    {c.exempt ? <Badge tone="success" icon={<UserCheck size={13} aria-hidden />}>Dispensé</Badge> : <Badge tone="primary">{c.steps.length} niveau{c.steps.length > 1 ? 'x' : ''}</Badge>}
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(c)} disabled={c.archived}><Pencil size={14} aria-hidden /> Modifier</button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setArchived('circuits', c.id, !c.archived)}>
                      {c.archived ? <><ArchiveRestore size={14} aria-hidden /> Restaurer</> : <><Archive size={14} aria-hidden /> Archiver</>}
                    </button>
                  </div>
                </div>
                {c.exempt ? (
                  <div className="chain"><span className="chain-step exempt"><UserCheck size={16} aria-hidden /> Demande validée automatiquement à l’envoi</span></div>
                ) : (
                  <ol className="chain">
                    <li className="chain-start">Demande</li>
                    {c.steps.map((s, i) => {
                      const who = s.kind === 'employee' ? s.employeeId
                        : s.kind === 'manager' ? simEmployee?.managerId
                        : simEmployee?.departmentHeadId;
                      const person = data.person(who);
                      return (
                        <li key={i} className="chain-item">
                          <ChevronRight size={16} aria-hidden className="chain-arrow" />
                          <span className={`chain-step ${person ? '' : 'muted'}`}>
                            <span className="step-num">{i + 1}</span>
                            <span>
                              <span className="block small text-muted">{s.label}</span>
                              {person ? <span className="row-gap"><Avatar employee={person} size={20} /> {person.firstName} {person.lastName}</span> : <span className="small text-muted">Non défini pour cet employé</span>}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                    <li className="chain-item"><ChevronRight size={16} aria-hidden className="chain-arrow" /><span className="chain-end">Approuvée</span></li>
                    {resolvedCount < c.steps.length && (
                      <li className="chain-note small text-muted">
                        Pour cet employé : {resolvedCount} approbateur(s) distinct(s) — les doublons et étapes non définies sont ignorés.
                      </li>
                    )}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {editing && (
        <CircuitEditor
          circuit={editing}
          onClose={() => setEditing(undefined)}
          onSave={(c) => {
            if (c.id) updateCircuit(c); else addItem('circuits', { ...c, id: newId('ci') });
            toast(c.id ? 'Circuit mis à jour' : 'Circuit créé');
            setEditing(undefined);
          }}
        />
      )}
    </>
  );
}

function CircuitEditor({ circuit, onClose, onSave }: { circuit: ApprovalCircuit; onClose: () => void; onSave: (c: ApprovalCircuit) => void }) {
  const data = useCompanyData();
  const [c, setC] = useState(circuit);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => setC(circuit), [circuit]);
  const people = data.people.filter((e) => e.status !== 'inactif');

  const setStep = (i: number, patch: Partial<CircuitStep>) => setC((x) => ({ ...x, steps: x.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const move = (i: number, d: -1 | 1) => setC((x) => { const steps = [...x.steps]; [steps[i], steps[i + d]] = [steps[i + d], steps[i]]; return { ...x, steps }; });

  const nameError = !c.name.trim() ? 'Nom requis.' : undefined;
  const stepError = !c.exempt && c.steps.length === 0 ? 'Ajoutez au moins une étape.' : !c.exempt && c.steps.some((s) => s.kind === 'employee' && !s.employeeId) ? 'Choisissez la personne de chaque étape nommée.' : undefined;

  const save = () => {
    setSubmitted(true);
    if (nameError || stepError) return;
    onSave({ ...c, name: c.name.trim(), steps: c.exempt ? [] : c.steps });
  };

  return (
    <Drawer open onClose={onClose} title={circuit.id ? `Modifier « ${circuit.name} »` : 'Nouveau circuit'} subtitle="De 1 à 5 approbateurs, dans l’ordre de validation."
      footer={<><span className="spacer" /><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}><Save size={15} aria-hidden /> Enregistrer</button></>}>
      <div className="stack">
        <Field label="Nom" required error={submitted ? nameError : undefined}>{(id) => <input id={id} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />}</Field>
        <Field label="Description">{(id) => <input id={id} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} />}</Field>
        <Switch checked={c.exempt} onChange={(v) => setC({ ...c, exempt: v })} label="Profil dispensé d’approbation" />
        {c.exempt ? (
          <Alert tone="success" title="Validation automatique">Les demandes des employés rattachés à ce circuit seront approuvées dès l’envoi et tracées dans l’historique.</Alert>
        ) : (
          <>
            <ol className="step-editor">
              {c.steps.map((s, i) => (
                <li key={i}>
                  <span className="step-num">{i + 1}</span>
                  <div className="step-fields">
                    <label className="sr-only" htmlFor={`kind-${i}`}>Type d’approbateur, étape {i + 1}</label>
                    <select id={`kind-${i}`} value={s.kind} onChange={(e) => { const kind = e.target.value as CircuitStepKind; setStep(i, { kind, label: KIND_LABEL[kind], employeeId: undefined }); }}>
                      {(Object.keys(KIND_LABEL) as CircuitStepKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                    </select>
                    {s.kind === 'employee' && (
                      <>
                        <label className="sr-only" htmlFor={`emp-${i}`}>Personne, étape {i + 1}</label>
                        <select id={`emp-${i}`} value={s.employeeId ?? ''} onChange={(e) => { const p = data.person(e.target.value); setStep(i, { employeeId: e.target.value, label: p?.functionName ?? 'Personne nommée' }); }}>
                          <option value="">Choisir…</option>
                          {people.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} — {p.functionName}</option>)}
                        </select>
                      </>
                    )}
                  </div>
                  <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Monter l’étape ${i + 1}`}><ArrowUp size={16} /></button>
                  <button type="button" className="icon-btn" disabled={i === c.steps.length - 1} onClick={() => move(i, 1)} aria-label={`Descendre l’étape ${i + 1}`}><ArrowDown size={16} /></button>
                  <button type="button" className="icon-btn icon-btn-danger" onClick={() => setC((x) => ({ ...x, steps: x.steps.filter((_, j) => j !== i) }))} aria-label={`Supprimer l’étape ${i + 1}`}><Trash2 size={16} /></button>
                </li>
              ))}
            </ol>
            {submitted && stepError && <p className="field-error">{stepError}</p>}
            <button type="button" className="btn btn-ghost" disabled={c.steps.length >= 5}
              onClick={() => setC((x) => ({ ...x, steps: [...x.steps, { kind: 'employee', label: KIND_LABEL.employee }] }))}>
              <Plus size={15} aria-hidden /> Ajouter une étape {c.steps.length >= 5 && '(maximum atteint)'}
            </button>
          </>
        )}
      </div>
    </Drawer>
  );
}
