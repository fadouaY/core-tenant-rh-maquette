// Types de documents du dossier employé (RH-17).
import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Badge, Field, Modal, Switch } from '../../components/ui';
import { ArchivableTable } from '../../components/settingsKit';
import type { DocumentFormat, DocumentType } from '../../types';

const FORMATS: DocumentFormat[] = ['pdf', 'jpg', 'png', 'docx'];

/** Nom et code uniques dans la société ; un type archivé n'est plus proposé mais ses documents restent classés. */
export function DocumentTypesSection() {
  const data = useCompanyData();
  const [editing, setEditing] = useState<{ type?: DocumentType }>();
  return (
    <>
      <ArchivableTable
        title="Types de documents" addLabel="Ajouter un type" collection="documentTypes" onAdd={() => setEditing({})}
        description="Classement des pièces du dossier employé. Un type obligatoire est attendu dans chaque dossier ; seuls les formats indiqués sont acceptés au dépôt. Un type archivé n’est plus proposé, les documents déjà classés sont conservés."
        rows={data.documentTypes} nameOf={(t) => t.name}
        rowActions={(t) => (
          <button type="button" className="btn btn-sm btn-ghost" disabled={t.archived} onClick={() => setEditing({ type: t })} aria-label={`Modifier ${t.name}`}><Pencil size={13} aria-hidden /> Modifier</button>
        )}
        columns={[
          { header: 'Type de document', render: (t) => <span className="person-name">{t.name}</span> },
          { header: 'Code', render: (t) => <span className="mono">{t.code}</span> },
          { header: 'Obligatoire', render: (t) => (t.required ? <Badge tone="warning">Obligatoire</Badge> : <Badge tone="neutral">Facultatif</Badge>) },
          { header: 'Formats acceptés', render: (t) => <span className="small mono">{t.formats.map((f) => f.toUpperCase()).join(' · ')}</span> },
        ]}
      />
      <DocumentTypeModal state={editing} onClose={() => setEditing(undefined)} />
    </>
  );
}

function DocumentTypeModal({ state, onClose }: { state?: { type?: DocumentType }; onClose: () => void }) {
  const { companyId, addItem, updateItem, toast } = useStore();
  const data = useCompanyData();
  const type = state?.type;
  const [f, setF] = useState({ name: '', code: '', required: false, formats: ['pdf'] as DocumentFormat[] });
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!state) return;
    setSubmitted(false);
    setF({ name: type?.name ?? '', code: type?.code ?? '', required: type?.required ?? false, formats: type?.formats ?? ['pdf'] });
  }, [state, type]);
  if (!state) return null;

  const others = data.documentTypes.filter((t) => t.id !== type?.id);
  const code = (f.code.trim() || f.name.trim().slice(0, 4)).toUpperCase();
  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = 'Intitulé requis.';
  else if (others.some((t) => t.name.trim().toLowerCase() === f.name.trim().toLowerCase())) errors.name = 'Ce type existe déjà dans la société.';
  if (code && others.some((t) => t.code.toUpperCase() === code)) errors.code = 'Ce code est déjà utilisé dans la société.';
  if (f.formats.length === 0) errors.formats = 'Choisissez au moins un format.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const toggleFormat = (fmt: DocumentFormat, on: boolean) =>
    setF((x) => ({ ...x, formats: on ? FORMATS.filter((y) => y === fmt || x.formats.includes(y)) : x.formats.filter((y) => y !== fmt) }));

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const saved: DocumentType = { ...(type ?? { id: newId('dt'), companyId }), name: f.name.trim(), code, required: f.required, formats: f.formats };
    if (type) updateItem('documentTypes', saved); else addItem('documentTypes', saved);
    toast(`Type de document « ${saved.name} » ${type ? 'mis à jour' : 'ajouté'}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={type ? `Modifier « ${type.name} »` : 'Nouveau type de document'}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>{type ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <div className="form-grid">
        <Field label="Intitulé" required error={err('name')} className="span-2">{(id) => <input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. : Carte d’identité nationale" />}</Field>
        <Field label="Code" error={err('code')} hint="Facultatif : déduit de l’intitulé.">{(id) => <input id={id} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="CIN" />}</Field>
      </div>
      <div className="mt-12">
        <Switch checked={f.required} onChange={(v) => setF({ ...f, required: v })} label="Document obligatoire dans chaque dossier employé" />
      </div>
      <fieldset className="form-section mt-16">
        <legend>Formats acceptés</legend>
        <div className="perm-options">
          {FORMATS.map((fmt) => {
            const on = f.formats.includes(fmt);
            return (
              <label key={fmt} className={`perm-option ${on ? 'on' : ''}`}>
                <input type="checkbox" checked={on} onChange={(e) => toggleFormat(fmt, e.target.checked)} />
                <span className="mono">{fmt.toUpperCase()}</span>
              </label>
            );
          })}
        </div>
        {err('formats') && <p className="field-error">{err('formats')}</p>}
      </fieldset>
    </Modal>
  );
}
