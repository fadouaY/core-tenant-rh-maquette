// Numérotation des employés (numéro de souche) : format et compteur des matricules attribués à la création.
import { useEffect, useState } from 'react';
import { Hash, RotateCcw, Save } from 'lucide-react';
import { useCompanyData, useStore } from '../../store';
import { Alert, Field, Switch } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import type { EmployeeNumbering } from '../../types';
import { TODAY } from '../../utils/dates';
import { formatMatricule, numberingOf } from '../../utils/org';

const SEPARATORS: { value: EmployeeNumbering['separator']; label: string }[] = [
  { value: '-', label: 'Tiret ( - )' }, { value: '/', label: 'Barre oblique ( / )' }, { value: '', label: 'Aucun' },
];

export function NumberingSection() {
  const { db, companyId, saveNumbering, toast } = useStore();
  const data = useCompanyData();
  const saved = numberingOf(db, companyId);
  const [n, setN] = useState<EmployeeNumbering>(saved);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { setN(numberingOf(db, companyId)); setSubmitted(false); }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof EmployeeNumbering>(k: K, v: EmployeeNumbering[K]) => setN((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(n) !== JSON.stringify(saved);
  const taken = new Set(data.employees.map((e) => e.matricule.trim().toUpperCase()));
  const preview = [0, 1, 2].map((i) => formatMatricule(n, n.next + i));
  const collision = preview.find((m) => taken.has(m));
  // Plus haut matricule existant avec ce préfixe (repère pour reprendre une numérotation).
  const highest = data.employees.map((e) => e.matricule).filter((m) => m.toUpperCase().startsWith(n.prefix.trim().toUpperCase())).sort().reverse()[0];

  const errors: Record<string, string> = {};
  if (!/^[A-Za-z0-9]{1,8}$/.test(n.prefix.trim())) errors.prefix = 'De 1 à 8 lettres ou chiffres.';
  if (!Number.isInteger(n.digits) || n.digits < 3 || n.digits > 8) errors.digits = 'Entre 3 et 8 chiffres.';
  if (!Number.isInteger(n.next) || n.next < 1) errors.next = 'Entier strictement positif.';
  else if (String(n.next).length > n.digits) errors.next = `Dépasse ${n.digits} chiffres : augmentez la longueur.`;
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    saveNumbering({ ...n, prefix: n.prefix.trim().toUpperCase() });
    toast('Numérotation des employés enregistrée');
  };

  return (
    <div className="fstack">
      <FormCard icon={<Hash size={16} />} title="Numéro de souche des matricules"
        subtitle="Chaque nouvel employé reçoit automatiquement le matricule suivant ; le compteur avance d’un à chaque création et saute un numéro déjà pris.">
        <div className="numbering">
          <div className="form-grid">
            <Field label="Préfixe" required error={err('prefix')} hint="Ex. : initiales de la société.">
              {(id) => <input id={id} value={n.prefix} maxLength={8} onChange={(e) => set('prefix', e.target.value.toUpperCase())} />}
            </Field>
            <Field label="Séparateur">
              {(id) => (
                <select id={id} value={n.separator} onChange={(e) => set('separator', e.target.value as EmployeeNumbering['separator'])}>
                  {SEPARATORS.map((s) => <option key={s.label} value={s.value}>{s.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Nombre de chiffres" required error={err('digits')} hint="Le compteur est complété par des zéros.">
              {(id) => <input id={id} type="number" min={3} max={8} value={n.digits} onChange={(e) => set('digits', Number(e.target.value))} />}
            </Field>
            <Field label="Prochain numéro" required error={err('next')} hint="Modifiable pour reprendre une numérotation existante.">
              {(id) => <input id={id} type="number" min={1} value={n.next} onChange={(e) => set('next', Number(e.target.value))} />}
            </Field>
          </div>
          <div className="mt-12">
            <Switch checked={n.withYear} onChange={(v) => set('withYear', v)} label="Inclure l’année d’embauche dans le matricule" />
          </div>

          <div className="numbering-preview" aria-live="polite">
            <span className="numbering-label">Aperçu des prochains matricules</span>
            <div className="numbering-codes">
              {preview.map((m, i) => <code key={m} className={i === 0 ? 'next' : ''}>{m}</code>)}
            </div>
            <span className="small text-muted">
              Le prochain employé créé recevra <strong>{preview[0]}</strong>{n.withYear ? ` (année ${TODAY.slice(0, 4)} pour une embauche cette année)` : ''}.
              {highest && <> Plus haut matricule existant : <span className="mono">{highest}</span>.</>}
            </span>
          </div>
          {collision && <Alert tone="warning" title="Numéro déjà attribué">{collision} existe déjà : il sera sauté automatiquement à la création.</Alert>}
        </div>
        <div className="save-bar">
          <button type="button" className="btn btn-ghost" disabled={!dirty} onClick={() => { setN(saved); setSubmitted(false); }}><RotateCcw size={14} aria-hidden /> Annuler</button>
          <button type="button" className="btn btn-primary" disabled={!dirty} onClick={save}><Save size={14} aria-hidden /> Enregistrer</button>
        </div>
      </FormCard>
    </div>
  );
}
