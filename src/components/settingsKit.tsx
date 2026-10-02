// Briques communes aux onglets de paramétrage.
import { useState, type ReactNode } from 'react';
import { Archive, ArchiveRestore, Plus } from 'lucide-react';
import { useStore, type CollectionKey } from '../store';
import { ArchivedBadge, Card, ColorField, EmptyState, Field, Modal, Switch } from './ui';

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

/** Tableau d'éléments archivables : les archivés restent consultables, grisés. */
export function ArchivableTable<T extends { id: string; archived?: boolean }>({
  title, description, rows, columns, collection, addLabel, onAdd, nameOf, rowActions, emptyText,
}: {
  title: string;
  description: string;
  rows: T[];
  columns: Column<T>[];
  collection: CollectionKey;
  addLabel: string;
  onAdd: () => void;
  nameOf: (row: T) => string;
  /** Actions supplémentaires par ligne (ex. Modifier). */
  rowActions?: (row: T) => ReactNode;
  emptyText?: string;
}) {
  const { setArchived } = useStore();
  const [showArchived, setShowArchived] = useState(true);
  const archivedCount = rows.filter((r) => r.archived).length;
  const visible = rows.filter((r) => showArchived || !r.archived);

  return (
    <Card
      title={title}
      actions={<button type="button" className="btn btn-primary btn-sm" onClick={onAdd}><Plus size={15} aria-hidden /> {addLabel}</button>}
      flush
    >
      <div className="settings-intro">
        <p className="small text-muted">{description}</p>
        <Switch checked={showArchived} onChange={setShowArchived} label={`Afficher les archivés (${archivedCount})`} />
      </div>
      {visible.length === 0 ? <EmptyState title="Aucun élément" text={emptyText ?? "Ajoutez un premier élément pour commencer."} /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {columns.map((c) => <th key={c.header} scope="col" className={c.className}>{c.header}</th>)}
                <th scope="col">État</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={r.archived ? 'row-archived' : ''}>
                  {columns.map((c) => <td key={c.header} className={c.className}>{c.render(r)}</td>)}
                  <td>{r.archived ? <ArchivedBadge /> : <span className="badge badge-success">Actif</span>}</td>
                  <td className="actions">
                    {rowActions?.(r)}
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setArchived(collection, r.id, !r.archived)}
                      aria-label={`${r.archived ? 'Restaurer' : 'Archiver'} ${nameOf(r)}`}>
                      {r.archived ? <><ArchiveRestore size={14} aria-hidden /> Restaurer</> : <><Archive size={14} aria-hidden /> Archiver</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export type FieldDef =
  | { key: string; label: string; type: 'text' | 'date' | 'number' | 'color'; required?: boolean; placeholder?: string; hint?: string }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; required?: boolean; hint?: string }
  | { key: string; label: string; type: 'checkbox'; hint?: string };

export type FormValues = Record<string, string | boolean>;

/** Petite modale de création générique, pilotée par une liste de champs. */
export function QuickAddModal({ open, onClose, title, fields, initial, onSubmit }: {
  open: boolean; onClose: () => void; title: string; fields: FieldDef[]; initial: FormValues; onSubmit: (v: FormValues) => void;
}) {
  const [values, setValues] = useState<FormValues>(initial);
  const [submitted, setSubmitted] = useState(false);
  const close = () => { setValues(initial); setSubmitted(false); onClose(); };
  const missing = fields.filter((f) => f.type !== 'checkbox' && f.required && !String(values[f.key] ?? '').trim()).map((f) => f.key);

  const save = () => {
    setSubmitted(true);
    if (missing.length) return;
    onSubmit(values);
    close();
  };

  return (
    <Modal open={open} onClose={close} title={title}
      footer={<><button type="button" className="btn btn-ghost" onClick={close}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>Ajouter</button></>}>
      <div className="form-grid">
        {fields.map((f) => f.type === 'checkbox' ? (
          <label key={f.key} className="check span-2">
            <input type="checkbox" checked={!!values[f.key]} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.checked }))} /> {f.label}
          </label>
        ) : (
          <Field key={f.key} label={f.label} required={f.required} hint={f.hint}
            error={submitted && missing.includes(f.key) ? 'Champ requis.' : undefined}
            className={f.type === 'select' || f.type === 'text' ? 'span-2' : ''}>
            {(id) => f.type === 'color' ? (
              <ColorField id={id} value={String(values[f.key] ?? '#2f5bd3')} onChange={(v) => setValues((x) => ({ ...x, [f.key]: v }))} />
            ) : f.type === 'select' ? (
              <select id={id} value={String(values[f.key] ?? '')} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input id={id} type={f.type} value={String(values[f.key] ?? '')} placeholder={'placeholder' in f ? f.placeholder : undefined}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} step={f.type === 'number' ? '0.5' : undefined} />
            )}
          </Field>
        ))}
      </div>
    </Modal>
  );
}

export const yesNo = (v: boolean) => (v ? <span className="badge badge-success">Oui</span> : <span className="badge badge-neutral">Non</span>);
