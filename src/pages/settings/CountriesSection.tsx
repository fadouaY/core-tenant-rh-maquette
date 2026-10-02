// Pays : indicatif téléphonique et nombre exact de chiffres du numéro national (utilisés par le champ Téléphone).
import { useEffect, useState } from 'react';
import { Globe, Pencil } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Field, Modal } from '../../components/ui';
import type { Country } from '../../types';
import { ArchivableTable } from '../../components/settingsKit';
import { formatPhone, onlyDigits } from '../../utils/phone';

export function CountriesSection() {
  const data = useCompanyData();
  const [editing, setEditing] = useState<{ country?: Country }>();
  return (
    <>
      <ArchivableTable
        title="Pays" addLabel="Ajouter un pays" collection="countries" onAdd={() => setEditing({})}
        description="Détermine, pour le téléphone d’un employé, l’indicatif proposé et le nombre exact de chiffres attendu pour le numéro national."
        rows={data.countries} nameOf={(c) => c.name}
        rowActions={(c) => (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing({ country: c })} aria-label={`Modifier ${c.name}`}><Pencil size={13} aria-hidden /> Modifier</button>
        )}
        columns={[
          { header: 'Pays', render: (c) => <span className="country-cell"><span className="country-icon" aria-hidden><Globe size={14} /></span><span className="person-name">{c.name}</span></span> },
          { header: 'Indicatif', render: (c) => <span className="dial-chip">+{c.dialCode}</span> },
          { header: 'Chiffres du numéro national', className: 'num', render: (c) => c.digits },
          { header: 'Exemple', render: (c) => <span className="mono small text-muted">{formatPhone(c, '6'.padEnd(c.digits, '0'))}</span> },
          { header: 'Employés', className: 'num', render: (c) => data.employees.filter((e) => e.phoneCountryId === c.id).length },
        ]}
      />
      <CountryModal open={!!editing} country={editing?.country} onClose={() => setEditing(undefined)} />
    </>
  );
}

function CountryModal({ open, country, onClose }: { open: boolean; country?: Country; onClose: () => void }) {
  const { companyId, addItem, updateItem, toast } = useStore();
  const data = useCompanyData();
  const [name, setName] = useState('');
  const [dial, setDial] = useState('');
  const [digits, setDigits] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(country?.name ?? '');
    setDial(country?.dialCode ?? '');
    setDigits(country ? String(country.digits) : '');
    setSubmitted(false);
  }, [open, country]);

  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = 'Nom requis.';
  else if (data.countries.some((c) => c.id !== country?.id && c.name.toLowerCase() === name.trim().toLowerCase())) errors.name = 'Ce pays existe déjà.';
  if (!/^\d{1,4}$/.test(dial)) errors.dial = 'De 1 à 4 chiffres.';
  const n = Number(digits);
  if (!Number.isInteger(n) || n < 4 || n > 15) errors.digits = 'Entre 4 et 15 chiffres.';
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    const item: Country = { ...(country ?? { id: newId('ctry'), companyId }), name: name.trim(), dialCode: dial, digits: n };
    if (country) updateItem('countries', item); else addItem('countries', item);
    toast(country ? 'Pays mis à jour' : 'Pays ajouté');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={country ? `Modifier ${country.name}` : 'Nouveau pays'}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>Enregistrer</button></>}>
      <div className="form-grid">
        <Field label="Nom" required error={err('name')} className="span-2">
          {(id) => <input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Tunisie" autoFocus />}
        </Field>
        <Field label="Indicatif" required error={err('dial')} hint="Le « + » est ajouté automatiquement.">
          {(id) => (
            <div className="input-prefix"><span aria-hidden>+</span>
              <input id={id} inputMode="numeric" value={dial} maxLength={4} onChange={(e) => setDial(onlyDigits(e.target.value))} placeholder="216" />
            </div>
          )}
        </Field>
        <Field label="Chiffres du numéro national" required error={err('digits')}>
          {(id) => <input id={id} type="number" min={4} max={15} value={digits} onChange={(e) => setDigits(e.target.value)} placeholder="8" />}
        </Field>
      </div>
      {!errors.dial && !errors.digits && (
        <p className="phone-preview">Aperçu : <span className="mono">{formatPhone({ dialCode: dial }, '6'.padEnd(n, '0'))}</span></p>
      )}
    </Modal>
  );
}
