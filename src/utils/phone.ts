// Numéros de téléphone : indicatif du pays + numéro national d'une longueur fixe (paramétrée par pays).
import type { Country } from '../types';

export const onlyDigits = (v: string) => v.replace(/\D/g, '');

/** « +212 6 12 34 56 78 » : le numéro national est groupé par deux chiffres. */
export function formatPhone(country: Pick<Country, 'dialCode'> | undefined, national: string): string {
  const d = onlyDigits(national);
  if (!d) return '';
  const groups: string[] = [];
  let i = d.length % 2;
  if (i) groups.push(d.slice(0, 1));
  for (; i < d.length; i += 2) groups.push(d.slice(i, i + 2));
  return `${country ? `+${country.dialCode} ` : ''}${groups.join(' ')}`;
}

/** Message d'erreur si le numéro ne respecte pas la longueur attendue pour le pays. */
export function phoneError(country: Country | undefined, national: string): string | undefined {
  const d = onlyDigits(national);
  if (!d) return undefined;
  if (!country) return 'Choisissez un indicatif.';
  if (d.length !== country.digits) return `${country.digits} chiffres attendus pour ${country.name} (${d.length} saisi${d.length > 1 ? 's' : ''}).`;
  return undefined;
}
