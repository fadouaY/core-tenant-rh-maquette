// Permissions ajoutées individuellement, en plus de celles du rôle (uniquement celles que le rôle ne contient pas).
import { useState } from 'react';
import { ChevronDown, Plus, ShieldCheck, X } from 'lucide-react';
import { PERMISSIONS } from '../../data/mock';
import type { Role } from '../../types';

export function ExtraPermissionsPicker({ role, value, onChange }: {
  role?: Role; value: string[]; onChange: (keys: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const inRole = new Set(role?.permissions ?? []);
  const available = PERMISSIONS.filter((p) => !inRole.has(p.key));
  const groups = [...new Set(available.map((p) => p.group))];
  const label = (key: string) => PERMISSIONS.find((p) => p.key === key)?.label ?? key;
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <div className="extra-perms">
      <div className="extra-perms-head">
        <span className="extra-perms-role"><ShieldCheck size={14} aria-hidden /> {role ? <>Le rôle <strong>{role.name}</strong> inclut {inRole.size} permission{inRole.size > 1 ? 's' : ''}.</> : 'Aucun rôle sélectionné.'}</span>
        <button type="button" className="btn btn-sm btn-ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)} disabled={available.length === 0}>
          <Plus size={13} aria-hidden /> Ajouter des permissions <ChevronDown size={13} aria-hidden className={open ? 'rot-180' : ''} />
        </button>
      </div>

      {value.length > 0 ? (
        <ul className="perm-chips" aria-label="Permissions ajoutées">
          {value.map((k) => (
            <li key={k} className="perm-chip">
              <span>{label(k)}</span>
              <button type="button" onClick={() => toggle(k)} aria-label={`Retirer ${label(k)}`}><X size={12} /></button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="extra-perms-empty">{available.length === 0 ? 'Ce rôle contient déjà toutes les permissions.' : 'Aucune permission supplémentaire.'}</p>
      )}

      {open && available.length > 0 && (
        <div className="perm-options" role="group" aria-label="Permissions hors rôle">
          {groups.map((g) => (
            <fieldset key={g} className="perm-group">
              <legend>{g}</legend>
              {available.filter((p) => p.group === g).map((p) => (
                <label key={p.key} className={`perm-option ${value.includes(p.key) ? 'on' : ''}`}>
                  <input type="checkbox" checked={value.includes(p.key)} onChange={() => toggle(p.key)} />
                  <span>{p.label}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
