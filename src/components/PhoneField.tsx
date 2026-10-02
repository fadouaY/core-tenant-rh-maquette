// Champ téléphone : indicatif choisi parmi les pays paramétrés + numéro national limité au nombre de chiffres attendu.
import type { Country } from '../types';
import { onlyDigits } from '../utils/phone';

export function PhoneField({ id, countries, countryId, value, onChange, describedBy, invalid }: {
  id: string; countries: Country[]; countryId?: string; value: string;
  onChange: (countryId: string | undefined, national: string) => void; describedBy?: string; invalid?: boolean;
}) {
  const country = countries.find((c) => c.id === countryId);
  return (
    <div className={`phone-field ${invalid ? 'invalid' : ''}`}>
      <label htmlFor={`${id}-dial`} className="sr-only">Indicatif</label>
      <select id={`${id}-dial`} value={countryId ?? ''} onChange={(e) => onChange(e.target.value || undefined, value)}>
        {!country && <option value="">Indicatif</option>}
        {countries.map((c) => <option key={c.id} value={c.id} title={c.name}>+{c.dialCode}</option>)}
      </select>
      <input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" aria-describedby={describedBy}
        value={value} maxLength={country?.digits ?? 15}
        placeholder={country ? '0'.repeat(country.digits).replace(/0/g, '•') : 'Numéro'}
        onChange={(e) => onChange(countryId, onlyDigits(e.target.value))} />
    </div>
  );
}
