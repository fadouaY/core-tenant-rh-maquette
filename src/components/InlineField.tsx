// Champ modifiable sur place : la valeur s'affiche en lecture ; un clic (ou Entrée) ouvre l'éditeur,
// ✓ / Entrée enregistre, ✕ / Échap annule. Utilisé par les fiches pour éviter un formulaire séparé.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, Pencil, X } from 'lucide-react';

export function InlineField<T>({ label, value, display, render, validate, onSave, required, hint, className = '' }: {
  label: string;
  value: T;
  /** Valeur affichée en lecture ; vide = « Non renseigné ». */
  display: ReactNode;
  /** Éditeur : valeur en cours, modificateur et identifiant à poser sur le champ. */
  render: (draft: T, set: (v: T) => void, id: string) => ReactNode;
  validate?: (v: T) => string | undefined;
  onSave: (v: T) => void;
  required?: boolean;
  hint?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string>();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => {
    if (editing) box.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
  }, [editing]);

  const cancel = () => { setEditing(false); setDraft(value); setError(undefined); };
  const save = () => {
    const e = validate?.(draft);
    if (e) { setError(e); return; }
    if (draft !== value) onSave(draft);
    setEditing(false);
    setError(undefined);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') { e.preventDefault(); save(); }
  };
  const empty = display === undefined || display === null || display === '';

  return (
    <div className={`if ${editing ? 'is-editing' : ''} ${error ? 'has-error' : ''} ${className}`} ref={box}>
      <label className="if-label" htmlFor={editing ? id : undefined}>{label}{required && <span className="req" aria-hidden> *</span>}</label>
      {editing ? (
        <div className="if-edit" onKeyDown={onKey}>
          <div className="if-control field">{render(draft, setDraft, id)}</div>
          <button type="button" className="if-btn ok" onClick={save} aria-label={`Enregistrer ${label}`} title="Enregistrer (Entrée)"><Check size={14} /></button>
          <button type="button" className="if-btn" onClick={cancel} aria-label="Annuler" title="Annuler (Échap)"><X size={14} /></button>
        </div>
      ) : (
        <button type="button" className="if-value" onClick={() => setEditing(true)} aria-label={`Modifier ${label}`}>
          <span className={empty ? 'if-empty' : ''}>{empty ? 'Non renseigné' : display}</span>
          <Pencil size={13} aria-hidden className="if-pen" />
        </button>
      )}
      {error ? <p className="field-error">{error}</p> : hint && <p className="if-hint">{hint}</p>}
    </div>
  );
}
