import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Building2, ChevronRight, Pencil, Plus, Save, SkipForward, Trash2, UserCheck } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Alert, ArchivedBadge, Avatar, Badge, Card, Drawer, Field, Switch } from '../../components/ui';
import type { ApprovalCircuit, CircuitStep, CircuitStepKind } from '../../types';
import { circuitForDepartment, circuitStepsFor } from '../../utils/org';

const KIND_LABEL: Record<CircuitStepKind, string> = {
  manager: 'Manager direct (N+1)',
  departmentHead: 'Responsable du département',
  employee: 'Personne nommée',
};

/**
 * Circuits d'approbation (RH-22) : chacun est affecté à un seul département, qui n'a qu'un circuit actif ;
 * il s'applique automatiquement aux employés du département et de ses sous-départements (RH-23).
 */
export function CircuitsSection() {
  const { db, companyId, saveCircuit, setArchived, toast } = useStore();
  const data = useCompanyData();
  const [editing, setEditing] = useState<ApprovalCircuit>();
  const [showArchived, setShowArchived] = useState(true);
  const [simEmployeeId, setSimEmployeeId] = useState(data.people.find((e) => e.managerId)?.id ?? '');
  const simEmployee = data.person(simEmployeeId);
  const circuits = data.circuits.filter((c) => showArchived || !c.archived);
  const uncovered = data.activeDepartments.filter((d) => !circuitForDepartment(db, d.id));

  const create = () => setEditing({
    id: '', companyId, name: '', description: '', exempt: false, departmentId: uncovered[0]?.id,
    steps: [{ kind: 'manager', label: KIND_LABEL.manager }],
  });

  const toggleArchive = (c: ApprovalCircuit) => {
    const dep = data.department(c.departmentId);
    if (!c.archived && dep && !dep.archived) {
      toast(`« ${c.name} » est le circuit de « ${dep.name} » : affectez un autre circuit à ce département, celui-ci sera archivé automatiquement.`, 'danger');
      return;
    }
    if (c.archived && c.departmentId && circuitForDepartment(db, c.departmentId)) {
      toast(`« ${data.departmentName(c.departmentId)} » a déjà un circuit actif : un département n’a qu’un circuit.`, 'danger');
      return;
    }
    setArchived('circuits', c.id, !c.archived);
  };

  return (
    <>
      {uncovered.length > 0 && (
        <Alert tone="warning" title="Départements sans circuit">
          {uncovered.map((d) => d.name).join(', ')} : la création et la mutation d’employés y sont bloquées tant qu’aucun circuit ne leur est affecté.
        </Alert>
      )}
      <Card title="Circuits d’approbation" actions={<button type="button" className="btn btn-primary btn-sm" onClick={create}><Plus size={15} aria-hidden /> Nouveau circuit</button>} flush>
        <div className="settings-intro">
          <p className="small text-muted">Un circuit par département, hérité par ses sous-départements. De 1 à 5 niveaux ; si le demandeur est l’approbateur d’un niveau, ce niveau et les précédents sont sautés.</p>
          <Switch checked={showArchived} onChange={setShowArchived} label="Afficher les archivés" />
        </div>
        <div className="sim-bar">
          <label htmlFor="sim-emp" className="small">Simuler pour :</label>
          <select id="sim-emp" value={simEmployeeId} onChange={(e) => setSimEmployeeId(e.target.value)}>
            {data.people.filter((e) => e.status !== 'inactif').map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {data.departmentName(e.departmentId)}</option>)}
          </select>
          <span className="small text-muted">Son circuit est celui de son département ; les sauts automatiques sont indiqués.</span>
        </div>
        <ul className="circuit-list">
          {circuits.map((c) => {
            const users = data.profiles.filter((p) => p.circuitId === c.id).length;
            const appliesToSim = !!simEmployee && data.profile(simEmployee.id)?.circuitId === c.id;
            const steps = simEmployee ? circuitStepsFor(db, simEmployee.id, c) : [];
            return (
              <li key={c.id} className={`circuit ${c.archived ? 'archived' : ''}`}>
                <div className="circuit-head">
                  <div>
                    <p className="person-name">{c.name} {c.archived && <ArchivedBadge />}</p>
                    <p className="small text-muted">
                      <Building2 size={12} aria-hidden className="inline-icon" /> {c.departmentId ? data.departmentName(c.departmentId) : 'Aucun département'}
                      {' · '}{users} employé(s){c.description ? ` · ${c.description}` : ''}
                    </p>
                  </div>
                  <div className="row-gap">
                    {appliesToSim && <Badge tone="info">Circuit de {simEmployee?.firstName}</Badge>}
                    {c.exempt ? <Badge tone="success" icon={<UserCheck size={13} aria-hidden />}>Dispensé</Badge> : <Badge tone="primary">{c.steps.length} niveau{c.steps.length > 1 ? 'x' : ''}</Badge>}
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(c)} disabled={c.archived}><Pencil size={14} aria-hidden /> Modifier</button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggleArchive(c)}>
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
                      const resolved = steps[i];
                      const person = data.person(resolved?.approverId);
                      const skipped = resolved?.skipped;
                      return (
                        <li key={i} className="chain-item">
                          <ChevronRight size={16} aria-hidden className="chain-arrow" />
                          <span className={`chain-step ${person && !skipped ? '' : 'muted'}`}>
                            <span className="step-num">{i + 1}</span>
                            <span>
                              <span className="block small text-muted">{s.label}</span>
                              {person ? <span className="row-gap"><Avatar employee={person} size={20} /> {person.firstName} {person.lastName}</span> : <span className="small text-muted">Non défini pour cet employé</span>}
                              {skipped && person && <span className="block small text-muted"><SkipForward size={11} aria-hidden className="inline-icon" /> {skipped === 'requester' ? 'Demandeur : niveau sauté' : skipped === 'below' ? 'Niveau inférieur au demandeur : sauté' : 'Doublon : sauté'}</span>}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                    <li className="chain-item"><ChevronRight size={16} aria-hidden className="chain-arrow" /><span className="chain-end">Approuvée</span></li>
                    {simEmployee && steps.length > 0 && steps.every((s) => s.skipped) && (
                      <li className="chain-note small text-muted">Pour cet employé, tous les niveaux sont sautés : demande approuvée automatiquement.</li>
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
            const replaced = c.departmentId ? data.circuits.find((x) => x.id !== c.id && !x.archived && x.departmentId === c.departmentId) : undefined;
            saveCircuit(c.id ? c : { ...c, id: newId('ci') });
            toast(`${c.id ? 'Circuit mis à jour' : 'Circuit créé'}${replaced ? ` — « ${replaced.name} » archivé` : ''}`);
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
  const current = data.circuits.find((x) => x.id !== c.id && !x.archived && x.departmentId && x.departmentId === c.departmentId);
  const leaving = circuit.departmentId && circuit.departmentId !== c.departmentId ? data.department(circuit.departmentId) : undefined;

  const setStep = (i: number, patch: Partial<CircuitStep>) => setC((x) => ({ ...x, steps: x.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const move = (i: number, d: -1 | 1) => setC((x) => { const steps = [...x.steps]; [steps[i], steps[i + d]] = [steps[i + d], steps[i]]; return { ...x, steps }; });

  const nameError = !c.name.trim() ? 'Nom requis.' : undefined;
  const depError = !c.departmentId ? 'Un circuit doit être affecté à un département.' : undefined;
  const stepError = !c.exempt && c.steps.length === 0 ? 'Ajoutez au moins une étape.' : !c.exempt && c.steps.some((s) => s.kind === 'employee' && !s.employeeId) ? 'Choisissez la personne de chaque étape nommée.' : undefined;

  const save = () => {
    setSubmitted(true);
    if (nameError || depError || stepError) return;
    onSave({ ...c, name: c.name.trim(), steps: c.exempt ? [] : c.steps });
  };

  return (
    <Drawer open onClose={onClose} title={circuit.id ? `Modifier « ${circuit.name} »` : 'Nouveau circuit'} subtitle="Affecté à un département ; de 1 à 5 approbateurs, dans l’ordre de validation."
      footer={<><span className="spacer" /><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}><Save size={15} aria-hidden /> Enregistrer</button></>}>
      <div className="stack">
        <Field label="Nom" required error={submitted ? nameError : undefined}>{(id) => <input id={id} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />}</Field>
        <Field label="Département" required error={submitted ? depError : undefined} hint="Ses sous-départements héritent du circuit.">
          {(id) => (
            <select id={id} value={c.departmentId ?? ''} onChange={(e) => setC({ ...c, departmentId: e.target.value || undefined })}>
              <option value="">Sélectionner…</option>
              {data.activeDepartments.map((d) => {
                const other = data.circuits.find((x) => x.id !== c.id && !x.archived && x.departmentId === d.id);
                return <option key={d.id} value={d.id}>{d.name}{other ? ` — remplace « ${other.name} »` : ''}</option>;
              })}
            </select>
          )}
        </Field>
        {current && <Alert tone="warning" title="Remplacement">« {current.name} » est le circuit actuel de ce département : il sera archivé à l’enregistrement.</Alert>}
        {leaving && <Alert tone="warning" title="Département sans circuit">« {leaving.name} » n’aura plus de circuit : affectez-lui-en un autre pour y créer ou muter des employés.</Alert>}
        <Field label="Description">{(id) => <input id={id} value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} />}</Field>
        <Switch checked={c.exempt} onChange={(v) => setC({ ...c, exempt: v })} label="Profil dispensé d’approbation" />
        {c.exempt ? (
          <Alert tone="success" title="Validation automatique">Les demandes des employés du département seront approuvées dès l’envoi et tracées dans l’historique.</Alert>
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
