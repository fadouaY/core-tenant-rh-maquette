import { useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Plus, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { PERMISSIONS } from '../../data/mock';
import { newId, useCompanyData, useStore } from '../../store';
import { Alert, ArchivedBadge, Card, Switch } from '../../components/ui';
import { QuickAddModal } from '../../components/settingsKit';

export function RolesSection() {
  const { companyId, addItem, updateRole, setArchived, toast } = useStore();
  const data = useCompanyData();
  const [selectedId, setSelectedId] = useState(data.roles[0]?.id);
  const [showArchived, setShowArchived] = useState(true);
  const [open, setOpen] = useState(false);
  const role = data.role(selectedId) ?? data.roles[0];
  const [perms, setPerms] = useState<string[]>(role?.permissions ?? []);
  useEffect(() => setPerms(role?.permissions ?? []), [role?.id, role?.permissions]);

  const groups = useMemo(() => [...new Set(PERMISSIONS.map((p) => p.group))], []);
  const dirty = role && perms.slice().sort().join() !== role.permissions.slice().sort().join();
  const holders = data.profiles.filter((p) => p.roleId === role?.id);
  const roles = data.roles.filter((r) => showArchived || !r.archived);

  return (
    <div className="roles-layout">
      <Card title="Rôles" actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)}><Plus size={15} aria-hidden /> Nouveau rôle</button>} flush>
        <div className="settings-intro"><Switch checked={showArchived} onChange={setShowArchived} label="Afficher les archivés" /></div>
        <ul className="select-list" role="listbox" aria-label="Rôles">
          {roles.map((r) => (
            <li key={r.id}>
              <button type="button" role="option" aria-selected={r.id === role?.id} className={`select-item ${r.id === role?.id ? 'selected' : ''} ${r.archived ? 'archived' : ''}`} onClick={() => setSelectedId(r.id)}>
                <ShieldCheck size={16} aria-hidden />
                <span className="grow">
                  <span className="person-name">{r.name}</span> {r.archived && <ArchivedBadge />}
                  <span className="block small text-muted">{r.permissions.length} permissions · {data.profiles.filter((p) => p.roleId === r.id).length} personne(s)</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {role && (
        <Card
          title={<>Permissions — {role.name}</>}
          actions={
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setArchived('roles', role.id, !role.archived)}>
              {role.archived ? <><ArchiveRestore size={14} aria-hidden /> Restaurer</> : <><Archive size={14} aria-hidden /> Archiver</>}
            </button>
          }
        >
          <p className="small text-muted mb-12">{role.description}</p>
          {role.archived && <Alert tone="warning" title="Rôle archivé">Il n’est plus proposé à l’attribution. Les {holders.length} personne(s) qui le détiennent conservent leurs accès jusqu’à réaffectation.</Alert>}
          <div className="perm-matrix">
            {groups.map((g) => (
              <fieldset key={g} className="perm-group">
                <legend>{g}</legend>
                {PERMISSIONS.filter((p) => p.group === g).map((p) => (
                  <label key={p.key} className="check">
                    <input type="checkbox" checked={perms.includes(p.key)} disabled={role.archived}
                      onChange={(e) => setPerms((list) => (e.target.checked ? [...list, p.key] : list.filter((k) => k !== p.key)))} />
                    {p.label}
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          <p className="small text-muted mt-12">
            Les permissions héritées s’appliquent à {holders.length} personne(s). Des ajouts ou retraits individuels sont possibles depuis l’onglet « Accès » de chaque fiche employé.
          </p>
          <div className="row-gap mt-12">
            <button type="button" className="btn btn-ghost" disabled={!dirty} onClick={() => setPerms(role.permissions)}><RotateCcw size={15} aria-hidden /> Annuler</button>
            <button type="button" className="btn btn-primary" disabled={!dirty} onClick={() => { updateRole({ ...role, permissions: perms }); toast(`Rôle « ${role.name} » mis à jour`); }}>
              <Save size={15} aria-hidden /> Enregistrer
            </button>
          </div>
        </Card>
      )}

      <QuickAddModal open={open} onClose={() => setOpen(false)} title="Nouveau rôle"
        initial={{ name: '', description: '', copyFrom: data.roles.find((r) => !r.archived)?.id ?? '' }}
        fields={[
          { key: 'name', label: 'Nom', type: 'text', required: true },
          { key: 'description', label: 'Description', type: 'text' },
          { key: 'copyFrom', label: 'Copier les permissions de', type: 'select', options: [{ value: '', label: 'Aucune permission' }, ...data.roles.filter((r) => !r.archived).map((r) => ({ value: r.id, label: r.name }))] },
        ]}
        onSubmit={(v) => {
          const id = newId('ro');
          addItem('roles', { id, companyId, name: String(v.name), description: String(v.description), permissions: [...(data.role(String(v.copyFrom))?.permissions ?? [])] });
          setSelectedId(id);
          toast('Rôle créé');
        }}
      />
    </div>
  );
}
