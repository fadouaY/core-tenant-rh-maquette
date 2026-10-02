// Paramètres d'organisation : départements et fonctions.
import { useEffect, useState } from 'react';
import { Pencil, UserRound, Users } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Alert, ArchivedBadge, Avatar, Badge, Field, Modal, PersonCell } from '../../components/ui';
import type { JobFunction } from '../../types';
import { ArchivableTable, QuickAddModal } from '../../components/settingsKit';

export function DepartmentsSection() {
  const { companyId, addItem, toast } = useStore();
  const data = useCompanyData();
  const [open, setOpen] = useState(false);
  return (
    <>
      <ArchivableTable
        title="Départements" addLabel="Ajouter un département" collection="departments" onAdd={() => setOpen(true)}
        description="Structure organisationnelle de la société. Un département archivé n’est plus proposé mais reste rattaché aux anciens dossiers."
        rows={data.departments} nameOf={(d) => d.name}
        columns={[
          { header: 'Nom', render: (d) => <span className="person-name">{d.name}</span> },
          { header: 'Code', render: (d) => <span className="mono">{d.code}</span> },
          { header: 'Responsable', render: (d) => <PersonCell employee={data.employee(d.headId)} /> },
          { header: 'Effectif', className: 'num', render: (d) => data.employees.filter((e) => e.departmentId === d.id && e.status !== 'inactif').length },
        ]}
      />
      <QuickAddModal open={open} onClose={() => setOpen(false)} title="Nouveau département"
        initial={{ name: '', code: '', headId: '' }}
        fields={[
          { key: 'name', label: 'Nom', type: 'text', required: true, placeholder: 'Ex. : Marketing' },
          { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'MKT' },
          { key: 'headId', label: 'Responsable', type: 'select', options: [{ value: '', label: 'À définir' }, ...data.employees.filter((e) => e.status !== 'inactif').map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName}` }))] },
        ]}
        onSubmit={(v) => { addItem('departments', { id: newId('d'), companyId, name: String(v.name), code: String(v.code).toUpperCase(), headId: String(v.headId) || undefined }); toast('Département ajouté'); }}
      />
    </>
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
        description="Une fonction solo est occupée par une seule personne ; une fonction groupe par plusieurs. Les règles de présence se paramètrent dans « Règles et quotas »."
        rows={data.functions} nameOf={(f) => f.name}
        rowActions={(f) => (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing({ fn: f })} aria-label={`Modifier ${f.name}`}><Pencil size={13} aria-hidden /> Modifier</button>
        )}
        columns={[
          { header: 'Fonction', render: (f) => <span className="person-name">{f.name}</span> },
          { header: 'Type', render: (f) => <FunctionKindBadge kind={f.kind} /> },
          { header: 'Département', render: (f) => <>{data.department(f.departmentId)?.name ?? 'Transverse'} {data.department(f.departmentId)?.archived && <ArchivedBadge />}</> },
          { header: 'Titulaires', render: (f) => {
            const h = holders(f);
            return (
              <span className="holders">
                <span className="avatar-stack">{h.slice(0, 4).map((e) => <Avatar key={e.id} employee={e} size={22} />)}</span>
                <span className="small">{h.length === 0 ? <span className="text-muted">Aucun</span> : h.length === 1 ? `${h[0].firstName} ${h[0].lastName}` : `${h.length} personnes`}</span>
                {f.kind === 'solo' && h.length > 1 && <Badge tone="warning">{h.length} titulaires pour une fonction solo</Badge>}
              </span>
            );
          } },
          { header: 'Présence min.', render: (f) => (f.kind === 'groupe' && f.minPresent != null
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
  const [f, setF] = useState({ name: '', departmentId: '', kind: 'solo' as JobFunction['kind'], minPresent: '' });
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!state) return;
    setSubmitted(false);
    setF({ name: fn?.name ?? '', departmentId: fn?.departmentId ?? (data.activeDepartments[0]?.id ?? ''), kind: fn?.kind ?? 'solo', minPresent: fn?.minPresent != null ? String(fn.minPresent) : '' });
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
      name: f.name.trim(), departmentId: f.departmentId || undefined, kind: f.kind,
      minPresent: f.kind === 'groupe' && f.minPresent !== '' ? Number(f.minPresent) : undefined,
    };
    if (fn) updateItem('functions', saved); else addItem('functions', saved);
    toast(`Fonction « ${saved.name} » ${fn ? 'mise à jour' : 'ajoutée'} (${saved.kind === 'solo' ? 'solo' : 'groupe'})`);
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
        <legend>Type de fonction</legend>
        <div className="deduct-choice" role="radiogroup" aria-label="Type de fonction">
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
      </fieldset>
    </Modal>
  );
}
