import { useEffect, useState } from 'react';
import { Archive, ArchiveRestore, KeyRound, Plus, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { newId, useCompanyData, useStore } from '../../store';
import { Alert, ArchivedBadge, Card, Drawer, Field, Switch } from '../../components/ui';
import { FormCard } from '../../components/FormCard';
import { knownPermissions, PermissionMatrix, PermissionSummary } from './PermissionMatrix';

export function RolesSection() {
  const { updateRole, setArchived, toast } = useStore();
  const data = useCompanyData();
  const [selectedId, setSelectedId] = useState(data.roles[0]?.id);
  const [showArchived, setShowArchived] = useState(true);
  const [open, setOpen] = useState(false);
  const role = data.role(selectedId) ?? data.roles[0];
  const [perms, setPerms] = useState<string[]>(role?.permissions ?? []);
  useEffect(() => setPerms(role?.permissions ?? []), [role?.id, role?.permissions]);

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
          <PermissionMatrix value={perms} onChange={setPerms} disabled={role.archived} />
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

      <NewRoleModal open={open} onClose={() => setOpen(false)} onCreated={(id) => { setSelectedId(id); toast('Rôle créé'); }} />
    </div>
  );
}

/** Nouveau rôle : nom unique, description, permissions choisies directement (ou copiées d'un rôle existant). */
function NewRoleModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { companyId, addItem } = useStore();
  const data = useCompanyData();
  const [f, setF] = useState({ name: '', description: '', copyFrom: '' });
  const [perms, setPerms] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => { if (open) { setF({ name: '', description: '', copyFrom: '' }); setPerms([]); setSubmitted(false); } }, [open]);

  const nameError = !f.name.trim() ? 'Nom requis.'
    : data.roles.some((r) => r.name.trim().toLowerCase() === f.name.trim().toLowerCase()) ? 'Un rôle porte déjà ce nom.' : undefined;
  const save = () => {
    setSubmitted(true);
    if (nameError) return;
    const id = newId('ro');
    addItem('roles', { id, companyId, name: f.name.trim(), description: f.description.trim(), permissions: perms });
    onCreated(id);
    onClose();
  };

  return (
    <Drawer open={open} onClose={onClose} wide title="Nouveau rôle"
      subtitle="Un rôle regroupe des permissions de l’application RH ; il s’attribue ensuite depuis la fiche de chaque employé."
      footer={<>
        <span className="footer-note">{perms.length === 0 ? 'Aucune permission sélectionnée' : `${perms.length} permission${perms.length > 1 ? 's' : ''} sélectionnée${perms.length > 1 ? 's' : ''}`}</span>
        <span className="spacer" />
        <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button type="button" className="btn btn-primary" onClick={save}><Plus size={15} aria-hidden /> Créer le rôle</button>
      </>}>
      <div className="fstack">
        <FormCard icon={<ShieldCheck size={16} />} title="Identité du rôle" subtitle="Le nom est unique dans la société.">
          <div className="form-grid">
            <Field label="Nom du rôle" required error={submitted ? nameError : undefined}>{(id) => <input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. : Gestionnaire paie" autoFocus />}</Field>
            <Field label="Partir des permissions de" hint="Facultatif : pré-coche les permissions d’un rôle existant.">
              {(id) => (
                <select id={id} value={f.copyFrom} onChange={(e) => { setF({ ...f, copyFrom: e.target.value }); setPerms(knownPermissions(data.role(e.target.value)?.permissions ?? [])); }}>
                  <option value="">Partir de zéro</option>
                  {data.roles.filter((r) => !r.archived).map((r) => <option key={r.id} value={r.id}>{r.name} ({knownPermissions(r.permissions).length})</option>)}
                </select>
              )}
            </Field>
            <Field label="Description" className="span-2">
              {(id) => <textarea id={id} rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="À quoi sert ce rôle, à qui l’attribuer…" />}
            </Field>
          </div>
        </FormCard>
        <FormCard icon={<KeyRound size={16} />} title="Permissions" subtitle="Cochez individuellement, par groupe ou en totalité."
          actions={<PermissionSummary value={perms} onChange={setPerms} />}>
          <PermissionMatrix value={perms} onChange={setPerms} withSummary={false} />
        </FormCard>
      </div>
    </Drawer>
  );
}
