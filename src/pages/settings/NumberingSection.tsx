// Numéro de souche : format et compteur des codes attribués à la création — matricules des employés,
// codes des départements et des fonctions. Chaque série a son préfixe, sa longueur et son prochain numéro.
import { useEffect, useState } from 'react';
import { Briefcase, Building2, IdCard, RotateCcw, Save } from 'lucide-react';
import { useStore } from '../../store';
import { Alert, Field, Switch } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import type { EmployeeNumbering, NumberingEntity } from '../../types';
import { TODAY } from '../../utils/dates';
import { formatMatricule, nameCode, numberingOf, takenCodes } from '../../utils/org';

const SEPARATORS: { value: EmployeeNumbering['separator']; label: string }[] = [
  { value: '-', label: 'Tiret ( - )' }, { value: '/', label: 'Barre oblique ( / )' }, { value: '', label: 'Aucun' },
];

const SERIES: { id: NumberingEntity; label: string; item: string; icon: typeof IdCard; yearLabel: string }[] = [
  { id: 'employe', label: 'Employés', item: 'matricule', icon: IdCard, yearLabel: 'Inclure l’année d’embauche dans le matricule' },
  { id: 'departement', label: 'Départements', item: 'code de département', icon: Building2, yearLabel: 'Inclure l’année de création dans le code' },
  { id: 'fonction', label: 'Fonctions', item: 'code de fonction', icon: Briefcase, yearLabel: 'Inclure l’année de création dans le code' },
];

export function NumberingSection() {
  const { db, companyId } = useStore();
  const [entity, setEntity] = useState<NumberingEntity>('employe');
  return (
    <div className="fstack">
      <div className="num-series" role="tablist" aria-label="Séries numérotées">
        {SERIES.map((s) => {
          const n = numberingOf(db, companyId, s.id);
          const Icon = s.icon;
          return (
            <button key={s.id} type="button" role="tab" aria-selected={entity === s.id} className={`num-serie ${entity === s.id ? 'on' : ''}`} onClick={() => setEntity(s.id)}>
              <span className="num-serie-icon"><Icon size={16} aria-hidden /></span>
              <span className="num-serie-text">
                <strong>{s.label}</strong>
                <span>{s.id === 'employe' ? 'Prochain' : 'Ex. « Financier »'} : <code>{s.id === 'employe' ? formatMatricule(n, n.next) : nameCode(n, 'Financier')}</code></span>
              </span>
            </button>
          );
        })}
      </div>
      <NumberingEditor key={`${companyId}-${entity}`} entity={entity} />
    </div>
  );
}

function NumberingEditor({ entity }: { entity: NumberingEntity }) {
  const { db, companyId, saveNumbering, toast } = useStore();
  const serie = SERIES.find((s) => s.id === entity)!;
  // Départements et fonctions : code = préfixe + premières lettres du nom (pas de compteur).
  const byName = entity !== 'employe';
  const saved = numberingOf(db, companyId, entity);
  const [n, setN] = useState<EmployeeNumbering>(saved);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { setN(numberingOf(db, companyId, entity)); setSubmitted(false); }, [companyId, entity]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof EmployeeNumbering>(k: K, v: EmployeeNumbering[K]) => setN((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(n) !== JSON.stringify(saved);
  const taken = takenCodes(db, companyId, entity);
  const preview = [0, 1, 2].map((i) => formatMatricule(n, n.next + i));
  const collision = preview.find((m) => taken.has(m));
  // Plus haut code existant avec ce préfixe (repère pour reprendre une numérotation).
  const samples = ['Financier', entity === 'departement' ? 'Marketing digital' : 'Comptable', entity === 'departement' ? 'Logistique' : 'Chef de projet'];
  const highest = [...taken].filter((m) => m.startsWith(n.prefix.trim().toUpperCase())).sort().reverse()[0];

  const errors: Record<string, string> = {};
  if (!/^[A-Za-z0-9]{1,8}$/.test(n.prefix.trim())) errors.prefix = 'De 1 à 8 lettres ou chiffres.';
  if (!byName && (!Number.isInteger(n.digits) || n.digits < 3 || n.digits > 8)) errors.digits = 'Entre 3 et 8 chiffres.';
  if (byName && (!Number.isInteger(n.letters ?? 3) || (n.letters ?? 3) < 2 || (n.letters ?? 3) > 6)) errors.letters = 'Entre 2 et 6 lettres.';
  if (!byName && (!Number.isInteger(n.next) || n.next < 1)) errors.next = 'Entier strictement positif.';
  else if (!byName && String(n.next).length > n.digits) errors.next = `Dépasse ${n.digits} chiffres : augmentez la longueur.`;
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    saveNumbering({ ...n, prefix: n.prefix.trim().toUpperCase() });
    toast(`Numérotation des ${serie.label.toLowerCase()} enregistrée`);
  };

  return (
    <div className="fstack">
      <FormCard icon={<serie.icon size={16} />} title={`Numéro de souche — ${serie.label.toLowerCase()}`}
        subtitle={byName ? `Le ${serie.item} est déduit du nom saisi : préfixe + premières lettres du nom ; un numéro est ajouté si le code existe déjà.` : `Chaque création reçoit automatiquement le ${serie.item} suivant ; le compteur avance d’un à chaque création et saute un numéro déjà pris.`}>
        <div className="numbering">
          <div className="form-grid">
            <Field label="Préfixe" required error={err('prefix')} hint={entity === "employe" ? "Ex. : initiales de la société." : entity === "departement" ? "Ex. : DEP." : "Ex. : FCT."}>
              {(id) => <input id={id} value={n.prefix} maxLength={8} onChange={(e) => set('prefix', e.target.value.toUpperCase())} />}
            </Field>
            <Field label="Séparateur">
              {(id) => (
                <select id={id} value={n.separator} onChange={(e) => set('separator', e.target.value as EmployeeNumbering['separator'])}>
                  {SEPARATORS.map((s) => <option key={s.label} value={s.value}>{s.label}</option>)}
                </select>
              )}
            </Field>
            {byName ? (
              <Field label="Nombre de lettres du nom" required error={err('letters')} hint="Premières lettres du nom reprises dans le code (accents et espaces ignorés).">
                {(id) => <input id={id} type="number" min={2} max={6} value={n.letters ?? 3} onChange={(e) => set('letters', Number(e.target.value))} />}
              </Field>
            ) : (<>
            <Field label="Nombre de chiffres" required error={err('digits')} hint="Le compteur est complété par des zéros.">
              {(id) => <input id={id} type="number" min={3} max={8} value={n.digits} onChange={(e) => set('digits', Number(e.target.value))} />}
            </Field>
            <Field label="Prochain numéro" required error={err('next')} hint="Modifiable pour reprendre une numérotation existante.">
              {(id) => <input id={id} type="number" min={1} value={n.next} onChange={(e) => set('next', Number(e.target.value))} />}
            </Field>
            </>)}
          </div>
          {!byName && <div className="mt-12">
            <Switch checked={n.withYear} onChange={(v) => set('withYear', v)} label={serie.yearLabel} />
          </div>}

          {byName ? (
            <div className="numbering-preview" aria-live="polite">
              <span className="numbering-label">Aperçu à partir de noms</span>
              <div className="numbering-codes names">
                {samples.map((name) => <span key={name} className="num-sample"><span>{name}</span><span aria-hidden>→</span><code>{nameCode(n, name, taken)}</code></span>)}
              </div>
              <span className="small text-muted">Les codes existants sont conservés ; seul le code des nouvelles créations est déduit du nom.</span>
            </div>
          ) : (
            <div className="numbering-preview" aria-live="polite">
              <span className="numbering-label">Aperçu des prochains codes</span>
              <div className="numbering-codes">
                {preview.map((m, i) => <code key={m} className={i === 0 ? 'next' : ''}>{m}</code>)}
              </div>
              <span className="small text-muted">
                La prochaine création recevra <strong>{preview[0]}</strong>{n.withYear ? ` (année ${TODAY.slice(0, 4)})` : ''}.
                {highest && <> Plus haut code existant : <span className="mono">{highest}</span>.</>}
              </span>
            </div>
          )}
          {!byName && collision && <Alert tone="warning" title="Numéro déjà attribué">{collision} existe déjà : il sera sauté automatiquement à la création.</Alert>}
        </div>
        <div className="save-bar">
          <button type="button" className="btn btn-ghost" disabled={!dirty} onClick={() => { setN(saved); setSubmitted(false); }}><RotateCcw size={14} aria-hidden /> Annuler</button>
          <button type="button" className="btn btn-primary" disabled={!dirty} onClick={save}><Save size={14} aria-hidden /> Enregistrer</button>
        </div>
      </FormCard>
    </div>
  );
}
