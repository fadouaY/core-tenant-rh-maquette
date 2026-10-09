// Catalogue des primes de la société (RH-27).
import { useEffect, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Field, Modal } from '../../components/ui';
import { ArchivableTable } from '../../components/settingsKit';
import type { Prime } from '../../types';
import { formatMoney, primeAssignments } from '../../utils/org';
import { PRIME_PERIODICITY, PRIME_TYPE } from '../employees/EmployeeSections';

/**
 * Nom unique, montant strictement positif. Archiver = désactiver : la prime n'est plus attribuable, les attributions
 * existantes sont conservées. Une prime déjà attribuée ne peut pas être supprimée.
 */
export function PrimesSection() {
  const { db, removeItem, toast } = useStore();
  const data = useCompanyData();
  const [editing, setEditing] = useState<{ prime?: Prime }>();

  const remove = (p: Prime) => {
    const n = primeAssignments(db, p.id);
    if (n > 0) { toast(`« ${p.name} » est attribuée à ${n} employé(s) : elle ne peut pas être supprimée, seulement désactivée (archivée).`, 'danger'); return; }
    removeItem('primes', p.id);
    toast(`Prime « ${p.name} » supprimée`, 'info');
  };

  return (
    <>
      <ArchivableTable
        title="Catalogue des primes" addLabel="Ajouter une prime" collection="primes" onAdd={() => setEditing({})}
        description="Primes attribuables aux employés dont les primes sont autorisées. Une prime archivée est désactivée : elle n’est plus proposée mais reste sur les fiches où elle est attribuée."
        rows={data.primes} nameOf={(p) => p.name}
        rowActions={(p) => (
          <>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing({ prime: p })} aria-label={`Modifier ${p.name}`}><Pencil size={13} aria-hidden /> Modifier</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => remove(p)} aria-label={`Supprimer ${p.name}`}><Trash2 size={13} aria-hidden /> Supprimer</button>
          </>
        )}
        columns={[
          { header: 'Prime', render: (p) => <span className="person-name">{p.name}</span> },
          { header: 'Code', render: (p) => <span className="mono">{p.code}</span> },
          { header: 'Type', render: (p) => PRIME_TYPE[p.type] },
          { header: 'Périodicité', render: (p) => PRIME_PERIODICITY[p.periodicity] },
          { header: 'Montant', className: 'num', render: (p) => formatMoney(p.amount, data.currency) },
          { header: 'Attribuée à', className: 'num', render: (p) => primeAssignments(db, p.id) },
        ]}
      />
      <PrimeModal state={editing} onClose={() => setEditing(undefined)} />
    </>
  );
}

function PrimeModal({ state, onClose }: { state?: { prime?: Prime }; onClose: () => void }) {
  const { companyId, addItem, updateItem, toast } = useStore();
  const data = useCompanyData();
  const prime = state?.prime;
  const [f, setF] = useState({ name: '', code: '', amount: '', type: 'fixe' as Prime['type'], periodicity: 'mensuelle' as Prime['periodicity'] });
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!state) return;
    setSubmitted(false);
    setF({ name: prime?.name ?? '', code: prime?.code ?? '', amount: prime ? String(prime.amount) : '', type: prime?.type ?? 'fixe', periodicity: prime?.periodicity ?? 'mensuelle' });
  }, [state, prime]);
  if (!state) return null;

  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = 'Nom requis.';
  else if (data.primes.some((p) => p.id !== prime?.id && p.name.trim().toLowerCase() === f.name.trim().toLowerCase())) errors.name = 'Une prime porte déjà ce nom dans la société.';
  if (!(Number(f.amount) > 0)) errors.amount = 'Le montant doit être strictement positif.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const saved: Prime = {
      ...(prime ?? { id: newId('pr'), companyId }),
      name: f.name.trim(), code: (f.code.trim() || f.name.trim().slice(0, 4)).toUpperCase(), amount: Number(f.amount), type: f.type, periodicity: f.periodicity,
    };
    if (prime) updateItem('primes', saved); else addItem('primes', saved);
    toast(`Prime « ${saved.name} » ${prime ? 'mise à jour' : 'ajoutée'}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={prime ? `Modifier « ${prime.name} »` : 'Nouvelle prime'}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>{prime ? 'Enregistrer' : 'Ajouter'}</button></>}>
      <div className="form-grid">
        <Field label="Nom" required error={err('name')} className="span-2">{(id) => <input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. : Prime de transport" />}</Field>
        <Field label="Code" hint="Facultatif : déduit du nom.">{(id) => <input id={id} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />}</Field>
        <Field label="Type">
          {(id) => (
            <select id={id} value={f.type} onChange={(e) => { const type = e.target.value as Prime['type']; setF({ ...f, type, periodicity: type === 'exceptionnelle' ? 'ponctuelle' : f.periodicity }); }}>
              {(Object.keys(PRIME_TYPE) as Prime['type'][]).map((k) => <option key={k} value={k}>{PRIME_TYPE[k]}</option>)}
            </select>
          )}
        </Field>
        <Field label="Périodicité" required hint={f.type === 'exceptionnelle' ? 'Une prime exceptionnelle est en général ponctuelle.' : undefined}>
          {(id) => (
            <select id={id} value={f.periodicity} onChange={(e) => setF({ ...f, periodicity: e.target.value as Prime['periodicity'] })}>
              {(Object.keys(PRIME_PERIODICITY) as Prime['periodicity'][]).map((k) => <option key={k} value={k}>{PRIME_PERIODICITY[k]}</option>)}
            </select>
          )}
        </Field>
        <Field label={`Montant (${data.currency})`} required error={err('amount')}>{(id) => <input id={id} type="number" min={0} step={10} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />}</Field>
      </div>
    </Modal>
  );
}
