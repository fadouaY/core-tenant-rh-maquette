import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Bell, Briefcase, Building2, ChevronRight, Eye, Info, ListChecks, Pencil, Plus, Save, SkipForward, Trash2, UserCheck } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Alert, ArchivedBadge, Avatar, Badge, Card, Drawer, Field, Switch } from '../../components/ui';
import type { ApprovalCircuit, CircuitIntervention, CircuitStep } from '../../types';
import { formatDate, TODAY } from '../../utils/dates';
import { circuitForDepartment, circuitStepsFor } from '../../utils/org';

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
    effectiveDate: TODAY, steps: [{ kind: 'manager', label: 'Responsable hiérarchique direct', intervention: 'approbation' }],
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
                      {' · '}{users} employé(s){c.effectiveDate ? ` · en vigueur depuis le ${formatDate(c.effectiveDate)}` : ''}{c.description ? ` · ${c.description}` : ''}
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
                              <span className="block small text-muted">{s.label}{s.intervention === 'consultation' && <span className="ci-consult"><Eye size={11} aria-hidden /> Consultation</span>}</span>
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

const INTERVENTION: Record<CircuitIntervention, string> = {
  approbation: 'Approbation requise (bloquant)',
  consultation: 'Consultation (pour information)',
};

/** Approbateur d'un niveau, encodé pour la liste : rôle dynamique ou personne nommée (« emp:<id> »). */
const approverValue = (s: CircuitStep) => (s.kind === 'employee' ? (s.employeeId ? `emp:${s.employeeId}` : '') : s.kind);

function CircuitEditor({ circuit, onClose, onSave }: { circuit: ApprovalCircuit; onClose: () => void; onSave: (c: ApprovalCircuit) => void }) {
  const data = useCompanyData();
  // Le profil « dispensé » n'est plus proposé : un ancien circuit dispensé repart d'un niveau manager.
  const init = (x: ApprovalCircuit): ApprovalCircuit => ({
    ...x, exempt: false, effectiveDate: x.effectiveDate ?? TODAY,
    steps: x.steps.length ? x.steps : [{ kind: 'manager', label: 'Responsable hiérarchique direct', intervention: 'approbation' }],
  });
  const [c, setC] = useState(() => init(circuit));
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => setC(init(circuit)), [circuit]);
  const people = data.people.filter((e) => e.status !== 'inactif');
  const current = data.circuits.find((x) => x.id !== c.id && !x.archived && x.departmentId && x.departmentId === c.departmentId);
  const leaving = circuit.departmentId && circuit.departmentId !== c.departmentId ? data.department(circuit.departmentId) : undefined;
  const subs = c.departmentId ? data.subDepartments(c.departmentId).filter((d) => !d.archived) : [];

  const setStep = (i: number, patch: Partial<CircuitStep>) => setC((x) => ({ ...x, steps: x.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const move = (i: number, d: -1 | 1) => setC((x) => { const steps = [...x.steps]; [steps[i], steps[i + d]] = [steps[i + d], steps[i]]; return { ...x, steps }; });
  /** Fonction affichée pour un niveau : celle de la personne nommée, sinon le rôle dynamique. */
  const fnOf = (s: CircuitStep) => (s.kind === 'employee' ? data.person(s.employeeId)?.functionName ?? s.label : s.kind === 'manager' ? 'Manager direct (N+1)' : 'Responsable du département');
  const setApprover = (i: number, value: string) => {
    if (value === 'manager' || value === 'departmentHead') {
      setStep(i, { kind: value, employeeId: undefined, label: value === 'manager' ? 'Manager direct (N+1)' : 'Responsable du département' });
    } else {
      const p = data.person(value.replace('emp:', ''));
      // Le niveau affiche la fonction de l'approbateur choisi.
      setStep(i, { kind: 'employee', employeeId: p?.id, label: p?.functionName ?? '' });
    }
  };

  const nameError = !c.name.trim() ? 'Nom requis.' : undefined;
  const depError = !c.departmentId ? 'Un circuit doit être affecté à un département.' : undefined;
  const dateError = !c.effectiveDate ? 'Date d’effet requise.' : undefined;
  const stepError = c.steps.length === 0 ? 'Ajoutez au moins un niveau.'
    : c.steps.some((s) => !approverValue(s)) ? 'Choisissez l’approbateur de chaque niveau.'
    : c.steps.every((s) => s.intervention === 'consultation') ? 'Au moins un niveau doit exiger une approbation.' : undefined;

  const save = () => {
    setSubmitted(true);
    if (nameError || depError || dateError || stepError) return;
    onSave({ ...c, name: c.name.trim(), exempt: false, steps: c.steps.map((s) => ({ ...s, label: fnOf(s), intervention: s.intervention ?? 'approbation' })) });
  };

  return (
    <Drawer open onClose={onClose} wide title={circuit.id ? `Modifier « ${circuit.name} »` : 'Nouveau circuit d’approbation'}
      subtitle="Paliers ordonnés et rattachement exclusif au département. Chaque niveau est notifié de la demande."
      footer={<><span className="spacer" /><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}><Save size={15} aria-hidden /> {circuit.id ? 'Enregistrer' : 'Créer le circuit'}</button></>}>
      <div className="fstack">
        <section className="ci-block">
          <div className="ci-grid">
            <Field label="Nom du circuit" required error={submitted ? nameError : undefined}>
              {(id) => <input id={id} value={c.name} placeholder="Ex. : Circuit Direction Logistique" onChange={(e) => setC({ ...c, name: e.target.value })} />}
            </Field>
            <Field label="Date d’effet de la version" required error={submitted ? dateError : undefined}>
              {(id) => <input id={id} type="date" value={c.effectiveDate ?? ''} onChange={(e) => setC({ ...c, effectiveDate: e.target.value || undefined })} />}
            </Field>
          </div>
          <div className="ci-dep field">
            <div className="ci-dep-head">
              <label htmlFor="ci-dep">Département affecté (exclusif) <span className="req" aria-hidden>*</span></label>
              <Badge tone="info">1 circuit = 1 département</Badge>
            </div>
            <select id="ci-dep" value={c.departmentId ?? ''} onChange={(e) => setC({ ...c, departmentId: e.target.value || undefined })}>
              <option value="">Sélectionner…</option>
              {data.activeDepartments.filter((d) => !d.parentId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {submitted && depError ? <p className="field-error">{depError}</p> : (
              <p className="ci-hint"><Info size={12} aria-hidden /> Tous les employés {subs.length ? `et les ${subs.length} sous-département${subs.length > 1 ? 's' : ''} ` : ''}de ce département utiliseront automatiquement ce circuit.</p>
            )}
          </div>
          {current && <Alert tone="warning" title="Remplacement">« {current.name} » est le circuit actuel de ce département : il sera archivé à l’enregistrement.</Alert>}
          {leaving && <Alert tone="warning" title="Département sans circuit">« {leaving.name} » n’aura plus de circuit : affectez-lui-en un autre pour y créer ou muter des employés.</Alert>}
        </section>

        <section className="ci-block">
          <div className="ci-steps-head">
            <div>
              <p className="ci-title"><ListChecks size={15} aria-hidden /> Chaîne ordonnée des niveaux d’approbation</p>
              <p className="small text-muted">Du niveau le plus bas au plus haut : un approbateur (sa fonction s’affiche) et un type d’intervention par niveau (5 au maximum).</p>
            </div>
            <button type="button" className="btn btn-sm btn-ghost" disabled={c.steps.length >= 5}
              onClick={() => setC((x) => ({ ...x, steps: [...x.steps, { kind: 'employee', label: '', intervention: 'approbation' }] }))}>
              <Plus size={14} aria-hidden /> Ajouter un niveau supérieur
            </button>
          </div>
          <div className="ci-table" role="table" aria-label="Niveaux d’approbation">
            <div className="ci-row ci-row-head" role="row">
              <span role="columnheader">Palier</span><span role="columnheader">Approbateur désigné</span><span role="columnheader">Fonction</span><span role="columnheader">Type d’intervention</span><span role="columnheader"><span className="sr-only">Actions</span></span>
            </div>
            {c.steps.map((s, i) => (
              <div key={i} className={`ci-row ${s.intervention === 'consultation' ? 'is-consult' : ''}`} role="row">
                <span role="cell"><span className="ci-level">Niveau {i + 1}</span></span>
                <span role="cell">
                  <label className="sr-only" htmlFor={`ci-appr-${i}`}>Approbateur, niveau {i + 1}</label>
                  <select id={`ci-appr-${i}`} value={approverValue(s)} onChange={(e) => setApprover(i, e.target.value)}>
                    <option value="">Choisir l’approbateur…</option>
                    <optgroup label="Selon le demandeur">
                      <option value="manager">Manager direct (N+1) du demandeur</option>
                      <option value="departmentHead">Responsable du département du demandeur</option>
                    </optgroup>
                    <optgroup label="Personne nommée">
                      {people.map((p) => <option key={p.id} value={`emp:${p.id}`}>{p.firstName} {p.lastName} ({p.matricule})</option>)}
                    </optgroup>
                  </select>
                </span>
                <span role="cell" className="ci-fn" title="Fonction de l’approbateur">
                  {fnOf(s) ? <><Briefcase size={12} aria-hidden /> {fnOf(s)}</> : <span className="text-muted">—</span>}
                </span>
                <span role="cell">
                  <label className="sr-only" htmlFor={`ci-int-${i}`}>Type d’intervention, niveau {i + 1}</label>
                  <select id={`ci-int-${i}`} value={s.intervention ?? 'approbation'} onChange={(e) => setStep(i, { intervention: e.target.value as CircuitIntervention })}>
                    {(Object.keys(INTERVENTION) as CircuitIntervention[]).map((k) => <option key={k} value={k}>{INTERVENTION[k]}</option>)}
                  </select>
                </span>
                <span role="cell" className="ci-actions">
                  <button type="button" className="icon-btn icon-btn-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Monter le niveau ${i + 1}`}><ArrowUp size={14} /></button>
                  <button type="button" className="icon-btn icon-btn-sm" disabled={i === c.steps.length - 1} onClick={() => move(i, 1)} aria-label={`Descendre le niveau ${i + 1}`}><ArrowDown size={14} /></button>
                  <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" onClick={() => setC((x) => ({ ...x, steps: x.steps.filter((_, j) => j !== i) }))} aria-label={`Supprimer le niveau ${i + 1}`}><Trash2 size={14} /></button>
                </span>
              </div>
            ))}
          </div>
          {submitted && stepError && <p className="field-error mt-8">{stepError}</p>}
          <p className="ci-hint mt-8"><Bell size={12} aria-hidden /> Chaque niveau reçoit une notification. Un niveau en consultation est informé sans bloquer la demande.</p>
        </section>
      </div>
    </Drawer>
  );
}
