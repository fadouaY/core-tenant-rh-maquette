// Onglet « Documents » de la fiche employé (RH-17) : pièces obligatoires, ajout, remplacement et suppression
// des documents, avec suivi des dates d'expiration. Chaque opération est inscrite dans l'historique.
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, ListChecks, Paperclip, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import type { DocumentType, Employee, EmployeeDocument } from '../../types';
import { diffDays, formatDate, TODAY } from '../../utils/dates';
import { Badge, Field, Modal } from '../../components/ui';
import { FormCard } from '../../components/FormCard';

const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';
const formatOk = (type: DocumentType | undefined, name: string) => !type || (type.formats as string[]).includes(extOf(name));

function expiry(d: EmployeeDocument) {
  if (!d.expiresAt) return { label: 'Sans expiration', tone: 'muted' as const };
  const left = diffDays(TODAY, d.expiresAt);
  if (left < 0) return { label: `Expiré le ${formatDate(d.expiresAt)}`, tone: 'danger' as const };
  if (left <= 30) return { label: `Expire le ${formatDate(d.expiresAt)}`, tone: 'warning' as const };
  return { label: `Valide jusqu’au ${formatDate(d.expiresAt)}`, tone: 'success' as const };
}

export function DocumentsTab({ employee }: { employee: Employee }) {
  const { saveDocuments, toast } = useStore();
  const data = useCompanyData();
  const docs = [...(employee.documents ?? [])].sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const types = data.documentTypes.filter((t) => !t.archived);
  const typeOf = (id: string) => data.documentTypes.find((t) => t.id === id);
  const required = types.filter((t) => t.required);
  const provided = required.filter((t) => docs.some((d) => d.typeId === t.id));
  const alerts = docs.filter((d) => ['danger', 'warning'].includes(expiry(d).tone));

  const [draft, setDraft] = useState({ typeId: '', fileName: '', expiresAt: '' });
  const [fileKey, setFileKey] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [removing, setRemoving] = useState<EmployeeDocument>();
  const draftType = typeOf(draft.typeId);
  const errors: Record<string, string> = {};
  if (!draft.typeId) errors.typeId = 'Type requis.';
  if (!draft.fileName) errors.fileName = 'Fichier requis.';
  else if (!formatOk(draftType, draft.fileName)) errors.fileName = `Formats acceptés : ${draftType!.formats.join(', ')}.`;
  if (draft.expiresAt && draft.expiresAt < TODAY) errors.expiresAt = 'Date déjà passée.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const add = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const doc: EmployeeDocument = { id: newId('doc'), typeId: draft.typeId, fileName: draft.fileName, addedAt: TODAY, expiresAt: draft.expiresAt || undefined };
    saveDocuments(employee.id, [...(employee.documents ?? []), doc], `Document ajouté : ${draftType?.name} (${doc.fileName})`);
    toast('Document ajouté');
    setDraft({ typeId: '', fileName: '', expiresAt: '' });
    setFileKey((k) => k + 1);
    setSubmitted(false);
  };
  const replace = (d: EmployeeDocument, fileName: string) => {
    const type = typeOf(d.typeId);
    if (!formatOk(type, fileName)) { toast(`Format refusé : ${type!.formats.join(', ')} attendus.`, 'info'); return; }
    saveDocuments(employee.id, (employee.documents ?? []).map((x) => (x.id === d.id ? { ...x, fileName, addedAt: TODAY } : x)),
      `Document remplacé : ${type?.name} (${d.fileName} → ${fileName})`);
    toast('Document remplacé');
  };

  return (
    <div className="fstack">
      <FormCard icon={<ListChecks size={16} />} title="Pièces obligatoires"
        subtitle={required.length ? `${provided.length} sur ${required.length} fournie${provided.length > 1 ? 's' : ''}` : 'Aucune pièce obligatoire paramétrée (Paramètres › Types de documents).'}
        actions={required.length ? <Badge tone={provided.length === required.length ? 'success' : 'warning'}>{provided.length === required.length ? 'Dossier complet' : 'Dossier incomplet'}</Badge> : undefined}>
        {required.length > 0 && (
          <ul className="doc-check">
            {required.map((t) => {
              const ok = provided.includes(t);
              return (
                <li key={t.id} className={ok ? 'ok' : 'missing'}>
                  {ok ? <CheckCircle2 size={15} aria-hidden /> : <AlertTriangle size={15} aria-hidden />}
                  <span className="doc-check-name">{t.name}</span>
                  {ok ? <span className="small text-muted">Fournie</span> : (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDraft((d) => ({ ...d, typeId: t.id }))}><Plus size={12} aria-hidden /> Ajouter</button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {alerts.length > 0 && (
          <p className="rp-alert doc-alert"><AlertTriangle size={13} aria-hidden /> {alerts.length} document{alerts.length > 1 ? 's' : ''} expiré{alerts.length > 1 ? 's' : ''} ou à renouveler sous 30 jours.</p>
        )}
      </FormCard>

      <FormCard icon={<FileText size={16} />} title="Documents du dossier" subtitle={`${docs.length} document${docs.length > 1 ? 's' : ''} joint${docs.length > 1 ? 's' : ''}`}>
        <div className="doc-add">
          <Field label="Type de document" required error={err('typeId')}>
            {(id) => (
              <select id={id} value={draft.typeId} onChange={(e) => setDraft({ ...draft, typeId: e.target.value })}>
                <option value="">Sélectionner…</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.name}{t.required ? ' *' : ''}</option>)}
              </select>
            )}
          </Field>
          <Field label="Fichier" required error={err('fileName')} hint={draftType ? `Formats : ${draftType.formats.join(', ')}` : undefined}>
            {(id) => (
              <label className={`ffile ${draft.fileName ? 'has-file' : ''}`} htmlFor={id}>
                <Upload size={13} aria-hidden />
                <span className="ffile-name">{draft.fileName || 'Insérer un document…'}</span>
                <input key={fileKey} id={id} type="file" accept={draftType ? draftType.formats.map((f) => `.${f}`).join(',') : undefined}
                  onChange={(e) => setDraft({ ...draft, fileName: e.target.files?.[0]?.name ?? '' })} />
              </label>
            )}
          </Field>
          <Field label="Date d’expiration" error={err('expiresAt')} hint="Facultative (CIN, visite médicale…).">
            {(id) => <input id={id} type="date" value={draft.expiresAt} min={TODAY} onChange={(e) => setDraft({ ...draft, expiresAt: e.target.value })} />}
          </Field>
          <button type="button" className="btn btn-primary doc-add-btn" onClick={add}><Plus size={14} aria-hidden /> Ajouter</button>
        </div>

        {docs.length === 0 ? <p className="fempty mt-12">Aucun document joint au dossier.</p> : (
          <div className="table-wrap mt-12">
            <table className="table">
              <thead><tr><th scope="col">Type</th><th scope="col">Fichier</th><th scope="col">Ajouté le</th><th scope="col">Validité</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {docs.map((d) => {
                  const type = typeOf(d.typeId);
                  const ex = expiry(d);
                  return (
                    <tr key={d.id}>
                      <td><span className="person-name">{type?.name ?? '—'}</span>{type?.required && <span className="block small text-muted">Obligatoire</span>}</td>
                      <td><span className="rp-file"><Paperclip size={12} aria-hidden /> {d.fileName}</span></td>
                      <td className="nowrap">{formatDate(d.addedAt)}</td>
                      <td><Badge tone={ex.tone}>{ex.label}</Badge></td>
                      <td className="actions">
                        <label className="btn btn-sm btn-ghost doc-replace" title="Remplacer le fichier">
                          <RefreshCw size={13} aria-hidden /> Remplacer
                          <input type="file" accept={type ? type.formats.map((f) => `.${f}`).join(',') : undefined}
                            onChange={(e) => { const n = e.target.files?.[0]?.name; if (n) replace(d, n); e.target.value = ''; }} />
                        </label>
                        <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" title="Supprimer" aria-label={`Supprimer ${d.fileName}`} onClick={() => setRemoving(d)}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </FormCard>

      <Modal open={!!removing} onClose={() => setRemoving(undefined)} title="Supprimer ce document ?" size="sm"
        footer={<>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={() => setRemoving(undefined)}>Annuler</button>
          <button type="button" className="btn btn-danger" onClick={() => {
            const d = removing!;
            saveDocuments(employee.id, (employee.documents ?? []).filter((x) => x.id !== d.id), `Document supprimé : ${typeOf(d.typeId)?.name} (${d.fileName})`);
            setRemoving(undefined);
            toast('Document supprimé', 'info');
          }}><Trash2 size={14} aria-hidden /> Supprimer</button>
        </>}>
        {removing && <p>Le fichier <strong>{removing.fileName}</strong> sera retiré du dossier. La suppression reste tracée dans l’historique.</p>}
      </Modal>
    </div>
  );
}
