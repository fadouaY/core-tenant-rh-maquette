// Paramètres d'organisation : départements et sous-départements (RH-14), fonctions.
import { useEffect, useState } from 'react';
import { CornerDownRight, Pencil, Plus, UserRound, Users } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Alert, ArchivedBadge, Avatar, Badge, Field, Modal, PersonCell, Switch } from '../../components/ui';
import type { Department, JobFunction } from '../../types';
import { ArchivableTable } from '../../components/settingsKit';
import { circuitForDepartment } from '../../utils/org';

/** Départements et sous-départements (RH-14) : responsable, horaire organisationnel, circuit obligatoire. */
export function DepartmentsSection() {
  const { db } = useStore();
  const data = useCompanyData();
  const [editing, setEditing] = useState<{ dep?: Department; parentId?: string }>();
  // Arborescence : chaque département suivi de ses sous-départements.
  const rows = data.departments.flatMap((d) => [d, ...data.subDepartments(d.id)]);
  const staff = (d: Department) => data.employees.filter((e) => (d.parentId ? e.subDepartmentId === d.id : e.departmentId === d.id) && e.status !== 'inactif');
  const noCircuit = data.activeDepartments.filter((d) => !circuitForDepartment(db, d.id));

  return (
    <>
      {noCircuit.length > 0 && (
        <Alert tone="warning" title="Département sans circuit d’approbation">
          {noCircuit.map((d) => d.name).join(', ')} : aucun employé ne peut y être créé ni muté tant qu’un circuit actif ne lui est pas affecté (Paramètres › Circuits d’approbation).
        </Alert>
      )}
      <ArchivableTable
        title="Départements" addLabel="Ajouter un département" collection="departments" onAdd={() => setEditing({})}
        description="Arborescence de la société. Chaque département a un circuit d’approbation unique, hérité par ses sous-départements ; l’horaire d’un sous-département remplace celui de son département."
        rows={rows} nameOf={(d) => d.name}
        rowClassName={(d) => (d.parentId ? 'row-sub' : '')}
        archiveBlockedBy={(d) => {
          const n = staff(d).length;
          if (n > 0) return `« ${d.name} » compte encore ${n} employé(s) actif(s) : réaffectez-les avant de l’archiver.`;
          if (!d.parentId && data.subDepartments(d.id).some((s) => !s.archived)) return `Archivez d’abord les sous-départements de « ${d.name} ».`;
          return undefined;
        }}
        rowActions={(d) => (
          <>
            {!d.parentId && !d.archived && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing({ parentId: d.id })} aria-label={`Ajouter un sous-département à ${d.name}`}><Plus size={13} aria-hidden /> Sous-département</button>
            )}
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing({ dep: d })} aria-label={`Modifier ${d.name}`}><Pencil size={13} aria-hidden /> Modifier</button>
          </>
        )}
        columns={[
          { header: 'Nom', render: (d) => d.parentId
            ? <span className="sub-dep"><CornerDownRight size={13} aria-hidden /> {d.name}</span>
            : <span className="person-name">{d.name}</span> },
          { header: 'Code', render: (d) => <span className="mono">{d.code}</span> },
          { header: 'Responsable', render: (d) => <PersonCell employee={data.employee(d.headId)} /> },
          { header: 'Horaire', render: (d) => {
            const own = data.schedule(d.scheduleId);
            if (own) return <span className="small">{own.name}</span>;
            const parent = data.schedule(data.department(d.parentId)?.scheduleId);
            return d.parentId && parent ? <span className="small text-muted">Hérité : {parent.name}</span> : <Badge tone="warning">Aucun</Badge>;
          } },
          { header: 'Circuit', render: (d) => {
            const c = circuitForDepartment(db, d.id);
            if (d.parentId) return <span className="small text-muted">{c ? `Hérité : ${c.name}` : 'Hérité : aucun'}</span>;
            return c ? <span className="small">{c.name}</span> : d.archived ? <span className="text-muted">—</span> : <Badge tone="danger">Aucun circuit</Badge>;
          } },
          { header: 'Effectif', className: 'num', render: (d) => staff(d).length },
        ]}
      />
      <DepartmentModal state={editing} onClose={() => setEditing(undefined)} />
    </>
  );
}

function DepartmentModal({ state, onClose }: { state?: { dep?: Department; parentId?: string }; onClose: () => void }) {
  const { companyId, addItem, updateItem, toast } = useStore();
  const data = useCompanyData();
  const dep = state?.dep;
  const [f, setF] = useState({ name: '', code: '', headId: '', parentId: '', scheduleId: '' });
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!state) return;
    setSubmitted(false);
    setF({ name: dep?.name ?? '', code: dep?.code ?? '', headId: dep?.headId ?? '', parentId: dep?.parentId ?? state.parentId ?? '', scheduleId: dep?.scheduleId ?? '' });
  }, [state, dep]);
  if (!state) return null;

  const isSub = !!f.parentId;
  const hasSubs = !!dep && data.subDepartments(dep.id).length > 0;
  const siblings = isSub ? data.subDepartments(f.parentId) : data.departments;
  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = 'Nom requis.';
  else if (siblings.some((d) => d.id !== dep?.id && d.name.trim().toLowerCase() === f.name.trim().toLowerCase())) errors.name = 'Ce nom existe déjà à ce niveau.';
  if (!f.code.trim()) errors.code = 'Code requis.';
  if (!isSub && !f.scheduleId) errors.scheduleId = 'Un département doit avoir un horaire organisationnel.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const saved: Department = {
      ...(dep ?? { id: newId('d'), companyId }),
      name: f.name.trim(), code: f.code.trim().toUpperCase(), headId: f.headId || undefined,
      parentId: f.parentId || undefined, scheduleId: f.scheduleId || undefined,
    };
    if (dep) updateItem('departments', saved); else addItem('departments', saved);
    toast(`${isSub ? 'Sous-département' : 'Département'} « ${saved.name} » ${dep ? 'mis à jour' : 'ajouté'}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={dep ? `Modifier « ${dep.name} »` : isSub ? 'Nouveau sous-département' : 'Nouveau département'}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>{dep ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <div className="form-grid">
        <Field label="Nom" required error={err('name')}>{(id) => <input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. : Marketing" />}</Field>
        <Field label="Code" required error={err('code')}>{(id) => <input id={id} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="MKT" />}</Field>
        <Field label="Département parent" hint={hasSubs ? 'Ce département a des sous-départements : il reste de premier niveau.' : 'Laisser vide pour un département de premier niveau.'}>
          {(id) => (
            <select id={id} value={f.parentId} disabled={hasSubs || !!dep} onChange={(e) => setF({ ...f, parentId: e.target.value })}>
              <option value="">Aucun (département)</option>
              {data.activeDepartments.filter((d) => d.id !== dep?.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Responsable">
          {(id) => (
            <select id={id} value={f.headId} onChange={(e) => setF({ ...f, headId: e.target.value })}>
              <option value="">À définir</option>
              {data.employees.filter((e) => e.status !== 'inactif').map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </select>
          )}
        </Field>
        <Field label="Horaire organisationnel" required={!isSub} error={err('scheduleId')} className="span-2"
          hint={isSub ? 'Facultatif : sans horaire propre, le sous-département hérite de celui de son département.' : 'Appliqué aux employés en mode organisationnel.'}>
          {(id) => (
            <select id={id} value={f.scheduleId} onChange={(e) => setF({ ...f, scheduleId: e.target.value })}>
              <option value="">{isSub ? 'Hériter du département' : 'Sélectionner…'}</option>
              {data.schedules.filter((s) => !s.archived || s.id === f.scheduleId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </Field>
      </div>
      {!isSub && !dep && <p className="small text-muted mt-12">Affectez ensuite un circuit d’approbation à ce département (Paramètres › Circuits d’approbation) : la création d’employés y est bloquée sans circuit.</p>}
    </Modal>
  );
}

export function FunctionsSection() {
  const data = useCompanyData();
  const [editing, setEditing] = useState<{ fn?: JobFunction }>();
  const holders = (f: JobFunction) => data.employees.filter((e) => e.functionId === f.id && e.status !== 'inactif');

  return (
    <>
      <ArchivableTable
        title="Fonctions" addLabel="Ajouter une fonction" collection="functions" onAdd={() => setEditing({})}
        description="Les règles d’intérim ne s’appliquent qu’aux fonctions qui les activent : solo (une seule personne, suppléance par une fonction liée) ou groupe (présence minimale). Les règles de présence se paramètrent dans « Règles et quotas »."
        rows={data.functions} nameOf={(f) => f.name}
        rowActions={(f) => (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing({ fn: f })} aria-label={`Modifier ${f.name}`}><Pencil size={13} aria-hidden /> Modifier</button>
        )}
        columns={[
          { header: 'Fonction', render: (f) => <span className="person-name">{f.name}</span> },
          { header: 'Intérim', render: (f) => (f.interim ? <FunctionKindBadge kind={f.kind} /> : <span className="text-muted small">Sans règle</span>) },
          { header: 'Département', render: (f) => <>{data.department(f.departmentId)?.name ?? 'Transverse'} {data.department(f.departmentId)?.archived && <ArchivedBadge />}</> },
          { header: 'Titulaires', render: (f) => {
            const h = holders(f);
            return (
              <span className="holders">
                <span className="avatar-stack">{h.slice(0, 4).map((e) => <Avatar key={e.id} employee={e} size={22} />)}</span>
                <span className="small">{h.length === 0 ? <span className="text-muted">Aucun</span> : h.length === 1 ? `${h[0].firstName} ${h[0].lastName}` : `${h.length} personnes`}</span>
                {f.interim && f.kind === 'solo' && h.length > 1 && <Badge tone="warning">{h.length} titulaires pour une fonction solo</Badge>}
              </span>
            );
          } },
          { header: 'Présence min.', render: (f) => (f.interim && f.kind === 'groupe' && f.minPresent != null
            ? <span className="small">{f.minPresent} sur {holders(f).length}</span>
            : <span className="text-muted small">—</span>) },
        ]}
      />
      <FunctionModal state={editing} onClose={() => setEditing(undefined)} />
    </>
  );
}

export function FunctionKindBadge({ kind }: { kind: JobFunction['kind'] }) {
  return kind === 'solo'
    ? <Badge tone="neutral" icon={<UserRound size={11} aria-hidden />}>Solo</Badge>
    : <Badge tone="info" icon={<Users size={11} aria-hidden />}>Groupe</Badge>;
}

function FunctionModal({ state, onClose }: { state?: { fn?: JobFunction }; onClose: () => void }) {
  const { companyId, addItem, updateItem, toast } = useStore();
  const data = useCompanyData();
  const fn = state?.fn;
  const [f, setF] = useState({ name: '', departmentId: '', interim: false, kind: 'solo' as JobFunction['kind'], minPresent: '' });
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!state) return;
    setSubmitted(false);
    setF({ name: fn?.name ?? '', departmentId: fn?.departmentId ?? (data.activeDepartments[0]?.id ?? ''), interim: fn?.interim ?? false, kind: fn?.kind ?? 'solo', minPresent: fn?.minPresent != null ? String(fn.minPresent) : '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  if (!state) return null;

  const count = fn ? data.employees.filter((e) => e.functionId === fn.id && e.status !== 'inactif').length : 0;
  const nameError = !f.name.trim() ? 'Intitulé requis.' : '';
  const save = () => {
    setSubmitted(true);
    if (nameError) return;
    const saved: JobFunction = {
      ...(fn ?? { id: newId('f'), companyId }),
      name: f.name.trim(), departmentId: f.departmentId || undefined, interim: f.interim, kind: f.kind,
      minPresent: f.interim && f.kind === 'groupe' && f.minPresent !== '' ? Number(f.minPresent) : undefined,
    };
    if (fn) updateItem('functions', saved); else addItem('functions', saved);
    toast(`Fonction « ${saved.name} » ${fn ? 'mise à jour' : 'ajoutée'}${saved.interim ? ` — intérim ${saved.kind}` : ''}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={fn ? `Modifier « ${fn.name} »` : 'Nouvelle fonction'}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>{fn ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <div className="form-grid">
        <Field label="Intitulé" required error={submitted ? nameError : undefined}>{(id) => <input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="Département">
          {(id) => (
            <select id={id} value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}>
              <option value="">Transverse</option>
              {data.activeDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </Field>
      </div>
      <fieldset className="form-section mt-16">
        <legend>Règles d’intérim</legend>
        <Switch checked={f.interim} onChange={(v) => setF({ ...f, interim: v })} label="Appliquer les règles d’intérim à cette fonction" />
        {!f.interim ? (
          <p className="small text-muted mt-8">Aucune contrainte de suppléance ni de présence minimale : les absences des titulaires ne sont pas contrôlées.</p>
        ) : (<>
        <div className="deduct-choice mt-12" role="radiogroup" aria-label="Type de fonction">
          <label className={`deduct-option ${f.kind === 'solo' ? 'checked' : ''}`}>
            <input type="radio" name="fn-kind" checked={f.kind === 'solo'} onChange={() => setF({ ...f, kind: 'solo' })} />
            <UserRound size={18} aria-hidden />
            <span><span className="person-name">Fonction solo</span><span className="block small text-muted">Une seule personne. Peut être liée à d’autres fonctions solo pour la suppléance.</span></span>
          </label>
          <label className={`deduct-option ${f.kind === 'groupe' ? 'checked' : ''}`}>
            <input type="radio" name="fn-kind" checked={f.kind === 'groupe'} onChange={() => setF({ ...f, kind: 'groupe' })} />
            <Users size={18} aria-hidden />
            <span><span className="person-name">Fonction groupe</span><span className="block small text-muted">Plusieurs personnes. On fixe le nombre minimum de présents.</span></span>
          </label>
        </div>
        {f.kind === 'solo' && count > 1 && <Alert tone="warning" title="Plusieurs titulaires">{count} personnes occupent cette fonction : le type « groupe » serait plus adapté.</Alert>}
        {f.kind === 'groupe' && (
          <div className="cap-row">
            <Field label="Présence minimale (personnes)" hint={fn ? `Effectif actif : ${count}. Exemple : 3 personnes et 2 requises → 1 absence possible à la fois.` : 'Peut aussi être réglée dans « Règles et quotas ».'}>
              {(id) => <input id={id} type="number" min={0} step={1} value={f.minPresent} onChange={(e) => setF({ ...f, minPresent: e.target.value })} placeholder="Non défini" />}
            </Field>
          </div>
        )}
        </>)}
      </fieldset>
    </Modal>
  );
}
