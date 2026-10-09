// Matrice des permissions d'un rôle : une carte par groupe, « Tout cocher » global et par groupe.
import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { PERMISSIONS } from '../../data/mock';

const GROUPS = [...new Set(PERMISSIONS.map((p) => p.group))];
const ALL = PERMISSIONS.map((p) => p.key);

/** Ne garde que les permissions du catalogue (un ancien rôle peut porter des clés retirées). */
export const knownPermissions = (keys: string[]) => keys.filter((k) => ALL.includes(k));

/** Case « tout cocher » : cochée si tout est coché, intermédiaire si une partie l'est. */
function SelectAll({ keys, value, onChange, disabled, label, className = '' }: {
  keys: string[]; value: string[]; onChange: (keys: string[]) => void; disabled?: boolean; label: string; className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const count = keys.filter((k) => value.includes(k)).length;
  const all = count === keys.length;
  useEffect(() => { if (ref.current) ref.current.indeterminate = count > 0 && !all; }, [count, all]);
  return (
    <label className={`perm-all ${all ? 'on' : count ? 'partial' : ''} ${className}`}>
      <input ref={ref} type="checkbox" checked={all} disabled={disabled}
        onChange={(e) => onChange(e.target.checked ? [...new Set([...value, ...keys])] : value.filter((k) => !keys.includes(k)))} />
      <span>{label}</span>
    </label>
  );
}

/** En-tête de la matrice : progression et « Tout cocher » (à placer dans les actions d'une carte). */
export function PermissionSummary({ value, onChange, disabled }: { value: string[]; onChange: (keys: string[]) => void; disabled?: boolean }) {
  const count = ALL.filter((k) => value.includes(k)).length;
  return (
    <div className="perm-head">
      <span className="perm-progress" aria-label={`${count} permissions sur ${ALL.length}`}>
        <span className="perm-progress-value"><strong>{count}</strong> / {ALL.length}</span>
        <span className="perm-progress-bar" aria-hidden><span style={{ width: `${(count / ALL.length) * 100}%` }} /></span>
      </span>
      <SelectAll keys={ALL} value={value} onChange={onChange} disabled={disabled} label="Tout cocher" className="perm-all-main" />
    </div>
  );
}

export function PermissionMatrix({ value, onChange, disabled, withSummary = true }: {
  value: string[]; onChange: (keys: string[]) => void; disabled?: boolean; withSummary?: boolean;
}) {
  return (
    <>
      {withSummary && <PermissionSummary value={value} onChange={onChange} disabled={disabled} />}
      <div className="perm-cards">
        {GROUPS.map((g) => {
          const perms = PERMISSIONS.filter((p) => p.group === g);
          const keys = perms.map((p) => p.key);
          const count = keys.filter((k) => value.includes(k)).length;
          return (
            <section key={g} className="perm-card" aria-label={g}>
              <header className="perm-card-head">
                <span className="perm-card-title">{g}</span>
                <span className={`perm-count ${count === keys.length ? 'full' : count ? 'some' : ''}`}>{count}/{keys.length}</span>
                <SelectAll keys={keys} value={value} onChange={onChange} disabled={disabled} label="Tout" />
              </header>
              <ul className="perm-rows">
                {perms.map((p) => {
                  const on = value.includes(p.key);
                  return (
                    <li key={p.key}>
                      <label className={`perm-row ${on ? 'on' : ''} ${disabled ? 'disabled' : ''}`}>
                        <input type="checkbox" checked={on} disabled={disabled}
                          onChange={(e) => onChange(e.target.checked ? [...value, p.key] : value.filter((k) => k !== p.key))} />
                        <span className="perm-tick" aria-hidden><Check size={11} strokeWidth={3} /></span>
                        <span>{p.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
