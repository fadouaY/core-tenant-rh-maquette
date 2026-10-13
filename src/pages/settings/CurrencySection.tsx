// Devise de la société : symbole, code ISO et libellé, utilisés pour l'affichage et la saisie des salaires et primes.
import { useEffect, useState } from 'react';
import { Coins, RotateCcw, Save } from 'lucide-react';
import { useCompanyData, useStore } from '../../store';
import { Field } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import type { CurrencySetting } from '../../types';
import { formatMoney } from '../../utils/org';

/** Devises courantes proposées pour pré-remplir les trois champs. */
const PRESETS: Omit<CurrencySetting, 'companyId'>[] = [
  { symbol: 'DT', code: 'TND', label: 'Dinars' },
  { symbol: '€', code: 'EUR', label: 'Euros' },
  { symbol: '$', code: 'USD', label: 'Dollars' },
];

export function CurrencySection() {
  const { companyId, saveCurrency, toast } = useStore();
  const data = useCompanyData();
  const saved = data.currencySetting;
  const [f, setF] = useState(saved);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { setF(saved); setSubmitted(false); }, [saved, companyId]);

  const dirty = f.symbol !== saved.symbol || f.code !== saved.code || f.label !== saved.label;
  const errors: Record<string, string> = {};
  if (!f.symbol.trim() || f.symbol.trim().length > 5) errors.symbol = 'De 1 à 5 caractères.';
  if (!/^[A-Z]{3}$/.test(f.code.trim().toUpperCase())) errors.code = 'Code ISO de 3 lettres (ex. TND).';
  if (!f.label.trim()) errors.label = 'Libellé requis.';
  const err = (k: string) => (submitted ? errors[k] : undefined);
  const symbol = f.symbol.trim() || '—';

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    saveCurrency({ companyId, symbol: f.symbol.trim(), code: f.code.trim().toUpperCase(), label: f.label.trim() });
    toast(`Devise enregistrée : ${f.label.trim()} (${f.code.trim().toUpperCase()})`);
  };

  return (
    <div className="fstack">
      <FormCard icon={<Coins size={16} />} title="Devise de la société"
        subtitle="Utilisée pour l’affichage et la saisie des salaires et des primes de tous les employés de la société.">
        <div className="cur-presets">
          <span className="small text-muted">Pré-remplir :</span>
          {PRESETS.map((p) => (
            <button key={p.code} type="button" className={`cur-preset ${f.code === p.code ? 'on' : ''}`} onClick={() => setF({ ...f, ...p })}>
              <strong>{p.symbol}</strong> {p.code}
            </button>
          ))}
        </div>
        <div className="cur-grid">
          <Field label="Symbole" required error={err('symbol')} hint="Affiché après les montants.">
            {(id) => <input id={id} value={f.symbol} maxLength={5} placeholder="DT" onChange={(e) => setF({ ...f, symbol: e.target.value })} />}
          </Field>
          <Field label="Code ISO" required error={err('code')} hint="Norme ISO 4217.">
            {(id) => <input id={id} className="mono" value={f.code} maxLength={3} placeholder="TND" onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} />}
          </Field>
          <Field label="Libellé" required error={err('label')} hint="En toutes lettres.">
            {(id) => <input id={id} value={f.label} placeholder="Dinars" onChange={(e) => setF({ ...f, label: e.target.value })} />}
          </Field>
        </div>

        <div className="cur-preview" aria-live="polite">
          <span className="numbering-label">Aperçu</span>
          <div className="cur-preview-items">
            <span><small>Salaire de base</small><strong>{formatMoney(10740, symbol)}</strong><em>/ mois</em></span>
            <span><small>Prime</small><strong className="pos">+{formatMoney(250, symbol)}</strong></span>
            <span className="cur-preview-input"><small>Saisie</small><span className="input-suffix"><input readOnly value="3 800" aria-label="Exemple de saisie" /><span aria-hidden>{symbol}</span></span></span>
          </div>
          <span className="small text-muted">Montants exprimés en <strong>{f.label.trim() || '—'}</strong> ({f.code.trim().toUpperCase() || '—'}).</span>
        </div>

        <div className="save-bar">
          <button type="button" className="btn btn-ghost" disabled={!dirty} onClick={() => { setF(saved); setSubmitted(false); }}><RotateCcw size={14} aria-hidden /> Annuler</button>
          <button type="button" className="btn btn-primary" disabled={!dirty} onClick={save}><Save size={14} aria-hidden /> Enregistrer</button>
        </div>
      </FormCard>
    </div>
  );
}
