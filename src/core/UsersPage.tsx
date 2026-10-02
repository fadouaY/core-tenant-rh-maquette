// Section « Utilisateurs » du core tenant : comptes du tenant et leurs affectations application × société.
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Crown, Lock, Mail, Plus, Search, ShieldCheck, UserCheck, Users, UserX } from 'lucide-react';
import { navigate, useStore } from '../store';
import { Alert, Avatar, Badge, Drawer, EmptyState, PageHeader, SelectFilter, Switch, Tabs } from '../components/ui';
import type { Database, ID, TenantUser } from '../types';
import { formatDate } from '../utils/dates';
import { AppMark, CompanyLogo, fullName, QuotaMeter, useQuota, makeUser, UserIdentityFields, userAccesses, useUserErrors } from './shared';

export function UsersPage({ param }: { param?: string }) {
  if (param && param !== 'nouveau') return <UserDetail userId={param} />;
  return <UserList createOpen={param === 'nouveau'} />;
}

function StatusBadge({ user }: { user: TenantUser }) {
  if (user.status === 'invite') return <Badge tone="warning">Invitation envoyée</Badge>;
  if (user.status === 'desactive') return <Badge tone="muted">Désactivé</Badge>;
  return <Badge tone="success">Actif</Badge>;
}

/** Rôles du core tenant d'un utilisateur. */
function coreRoles(db: Database, userId: ID) {
  const roles: string[] = [];
  if (db.tenant.ownerUserId === userId) roles.push(`Propriétaire du tenant`);
  db.companies.filter((c) => c.adminUserId === userId && !c.archived).forEach((c) => roles.push(`Admin société · ${c.name}`));
  return roles;
}

/** Couples application × société activés, auxquels un utilisateur peut être affecté. */
function grantable(db: Database) {
  return db.assignments
    .filter((a) => a.enabled)
    .map((a) => ({ a, app: db.apps.find((x) => x.id === a.appId)!, company: db.companies.find((c) => c.id === a.companyId)! }))
    .filter((x) => x.app && x.company && !x.company.archived);
}

function UserList({ createOpen }: { createOpen: boolean }) {
  const { db } = useStore();
  const quota = useQuota();
  const [q, setQ] = useState('');
  const [access, setAccess] = useState('');
  const [status, setStatus] = useState('');
  const combos = grantable(db);

  const list = useMemo(() => db.users
    .filter((u) => !q || `${fullName(u)} ${u.email}`.toLowerCase().includes(q.toLowerCase()))
    .filter((u) => !status || u.status === status)
    .filter((u) => !access || userAccesses(db, u.id).some((x) => `${x.appId}:${x.companyId}` === access))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr')), [db, q, status, access]);

  return (
    <>
      <PageHeader eyebrow="Core tenant · Comptes" icon={<Users size={20} strokeWidth={1.8} />}
        title="Utilisateurs"
        subtitle={`Comptes du tenant ${db.tenant.name}. Un utilisateur peut accéder à plusieurs applications, et à une même application dans plusieurs sociétés.`}
        actions={<>
          <QuotaMeter label="Utilisateurs" used={quota.users} max={quota.maxUsers} />
          <button type="button" className="btn btn-primary" disabled={quota.usersFull} title={quota.usersFull ? 'Quota d’utilisateurs atteint' : undefined} onClick={() => navigate('core/utilisateurs/nouveau')}><Plus size={15} aria-hidden /> Nouvel utilisateur</button>
        </>}
      />
      {quota.usersFull && (
        <Alert tone="warning" title={`Quota atteint : ${quota.users} utilisateurs sur ${quota.maxUsers}`}>
          Désactivez un compte ou passez à une offre supérieure (simulation dans l’en-tête) pour en créer un nouveau.
        </Alert>
      )}
      <div className="filters">
        <div className="filter filter-search">
          <label htmlFor="us-q">Recherche</label>
          <div className="input-icon"><Search size={14} aria-hidden /><input id="us-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou e-mail…" /></div>
        </div>
        <SelectFilter label="Application" value={access} onChange={setAccess} options={combos.map(({ app, company }) => ({ value: `${app.id}:${company.id}`, label: `${app.name} · ${company.name}` }))} />
        <SelectFilter label="Statut" value={status} onChange={setStatus} options={[{ value: 'actif', label: 'Actif' }, { value: 'invite', label: 'Invitation envoyée' }, { value: 'desactive', label: 'Désactivé' }]} />
      </div>
      <p className="result-count">{list.length} utilisateur{list.length > 1 ? 's' : ''}</p>
      {list.length === 0 ? <EmptyState title="Aucun utilisateur" text="Modifiez les filtres." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Utilisateur</th>
                <th scope="col">Rôle core tenant</th>
                <th scope="col">Applications affectées</th>
                <th scope="col">Statut</th>
                <th scope="col">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const roles = coreRoles(db, u.id);
                const acc = userAccesses(db, u.id);
                return (
                  <tr key={u.id} className={`row-click ${u.status === 'desactive' ? 'row-archived' : ''}`} onClick={() => navigate(`core/utilisateurs/${u.id}`)}>
                    <td><span className="person"><Avatar employee={u} size={28} /><span><span className="person-name person-link">{fullName(u)}</span><span className="person-sub">{u.email}</span></span></span></td>
                    <td>{roles.length ? roles.map((r) => <Badge key={r} tone="primary">{r}</Badge>) : <span className="text-muted small">Utilisateur</span>}</td>
                    <td>
                      {acc.length === 0 ? <span className="text-muted small">Aucune application</span> : (
                        <span className="access-chips">
                          {acc.map((x) => {
                            const c = db.companies.find((y) => y.id === x.companyId);
                            return (
                              <span key={`${x.appId}:${x.companyId}`} className="access-chip">
                                <span className="access-dot" style={{ background: c?.color }} aria-hidden />
                                {db.apps.find((y) => y.id === x.appId)?.id.toUpperCase()} · {c?.name}
                                {x.admin && <Crown size={11} aria-label="administrateur" className="text-warning" />}
                              </span>
                            );
                          })}
                        </span>
                      )}
                    </td>
                    <td><StatusBadge user={u} /></td>
                    <td className="nowrap">{formatDate(u.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <NewUserDrawer open={createOpen && !quota.usersFull} onClose={() => navigate('core/utilisateurs')} />
    </>
  );
}

/** Grille d’affectation : une carte par application, une ligne par société où elle est activée. */
function AccessGrid({ userId, value, onToggle }: { userId?: ID; value: Set<string>; onToggle: (key: string, on: boolean) => void }) {
  const { db } = useStore();
  const combos = grantable(db);
  if (combos.length === 0) return <EmptyState title="Aucune application activée" text="Activez d’abord une application pour une société." />;
  return (
    <div className="stack">
      {db.apps.map((app) => {
        const rows = combos.filter((x) => x.app.id === app.id);
        if (rows.length === 0) return null;
        return (
          <section key={app.id} className="access-app">
            <div className="access-app-head"><AppMark app={app} size={28} /><span className="person-name">{app.name}</span></div>
            <ul>
              {rows.map(({ a, company }) => {
                const key = `${app.id}:${company.id}`;
                const isAdmin = !!userId && a.adminUserId === userId;
                return (
                  <li key={key}>
                    <CompanyLogo company={company} size={24} />
                    <span className="grow"><span className="person-name">{company.name}</span><span className="block small text-muted">{company.city}</span></span>
                    {isAdmin ? (
                      <span className="row-gap"><Badge tone="primary" icon={<Crown size={11} aria-hidden />}>Administrateur</Badge><Lock size={13} aria-label="Modifiable depuis la page de l’application" className="text-muted" /></span>
                    ) : (
                      <Switch checked={value.has(key)} label={value.has(key) ? 'Affecté' : 'Non affecté'} onChange={(on) => onToggle(key, on)} />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function NewUserDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addUser, setAccess, showCredentials, toast } = useStore();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '' });
  const [grants, setGrants] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const errors = useUserErrors(f);
  useEffect(() => { if (open) { setF({ firstName: '', lastName: '', email: '' }); setGrants(new Set()); setSubmitted(false); } }, [open]);

  const save = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    const user = makeUser(f);
    addUser(user);
    grants.forEach((k) => { const [appId, companyId] = k.split(':'); setAccess(user.id, appId, companyId, true); });
    toast(`${fullName(user)} créé(e) et affecté(e) à ${grants.size} application(s)`);
    onClose();
    showCredentials(user);
    window.setTimeout(() => navigate(`core/utilisateurs/${user.id}`), 0);
  };

  return (
    <>
      <Drawer open={open} onClose={onClose} title="Nouvel utilisateur" subtitle="Il recevra ses identifiants par e-mail."
        footer={<><span className="footer-note">{grants.size} affectation(s) sélectionnée(s)</span><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}><Mail size={14} aria-hidden /> Créer et envoyer les identifiants</button></>}>
        <fieldset className="form-section">
          <legend>Identité</legend>
          <UserIdentityFields f={f} setF={setF} errors={submitted ? errors : {}} />
        </fieldset>
        <fieldset className="form-section">
          <legend>Affecter aux applications</legend>
          <p className="small text-muted mb-12">Affectez l’utilisateur aux applications de votre choix, dans une ou plusieurs sociétés. Les affectations pourront être modifiées ensuite.</p>
          <AccessGrid value={grants} onToggle={(k, on) => setGrants((g) => { const n = new Set(g); if (on) n.add(k); else n.delete(k); return n; })} />
        </fieldset>
      </Drawer>
    </>
  );
}

type Tab = 'acces' | 'roles' | 'infos';

function UserDetail({ userId }: { userId: ID }) {
  const { db, setAccess, updateUser, showCredentials, toast } = useStore();
  const quota = useQuota();
  const user = db.users.find((u) => u.id === userId);
  const [tab, setTab] = useState<Tab>('acces');
  if (!user) return <EmptyState title="Utilisateur introuvable" action={<a className="btn btn-primary" href="#/core/utilisateurs">Retour aux utilisateurs</a>} />;

  const current = new Set(db.accesses.filter((a) => a.userId === user.id).map((a) => `${a.appId}:${a.companyId}`));
  const roles = coreRoles(db, user.id);
  const adminOfApps = db.assignments.filter((a) => a.enabled && a.adminUserId === user.id);
  const total = userAccesses(db, user.id).length;

  return (
    <>
      <div className="breadcrumb">
        <button type="button" className="back-link" onClick={() => navigate('core/utilisateurs')}><ArrowLeft size={14} aria-hidden /> Utilisateurs</button>
        <span aria-hidden>/</span><span>{fullName(user)}</span>
      </div>
      <div className="profile-header">
        <Avatar employee={user} size={56} />
        <div className="grow">
          <h1>{fullName(user)}</h1>
          <p className="text-muted">{user.email} · identifiant <span className="mono">{user.login}</span></p>
          <div className="row-gap mt-8"><StatusBadge user={user} />{roles.map((r) => <Badge key={r} tone="primary">{r}</Badge>)}</div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" onClick={() => { showCredentials(user); toast(`Identifiants renvoyés à ${user.email}`); }}><Mail size={14} aria-hidden /> Renvoyer les identifiants</button>
          {user.status === 'desactive' ? (
            <button type="button" className="btn btn-ghost" disabled={quota.usersFull} title={quota.usersFull ? 'Quota d’utilisateurs atteint' : undefined} onClick={() => { updateUser({ ...user, status: 'actif' }); toast('Compte réactivé'); }}><UserCheck size={14} aria-hidden /> Réactiver</button>
          ) : (
            <button type="button" className="btn btn-ghost-danger" disabled={roles.length > 0 || adminOfApps.length > 0}
              title={roles.length || adminOfApps.length ? 'Désignez d’abord un autre administrateur' : undefined}
              onClick={() => { updateUser({ ...user, status: 'desactive' }); toast('Compte désactivé', 'info'); }}><UserX size={14} aria-hidden /> Désactiver</button>
          )}
        </div>
      </div>

      <Tabs<Tab> label="Sections de l’utilisateur" value={tab} onChange={setTab} tabs={[
        { id: 'acces', label: 'Applications affectées', count: total },
        { id: 'roles', label: 'Rôles core tenant', count: roles.length },
        { id: 'infos', label: 'Informations' },
      ]} />

      {tab === 'acces' && (
        <div className="narrow-wide">
          <p className="small text-muted mb-12">Affectez l’utilisateur à une application pour chaque société souhaitée. Les droits détaillés se règlent dans l’application (ex. rôle dans l’Application RH).</p>
          <AccessGrid userId={user.id} value={current}
            onToggle={(k, on) => { const [appId, companyId] = k.split(':'); setAccess(user.id, appId, companyId, on); toast(on ? 'Utilisateur affecté à l’application' : 'Affectation retirée', on ? 'success' : 'info'); }} />
        </div>
      )}

      {tab === 'roles' && (
        <section className="panel narrow">
          {roles.length === 0 && adminOfApps.length === 0 ? <p className="text-muted">Aucun rôle d’administration : simple utilisateur des applications auxquelles il est affecté.</p> : (
            <ul className="plain-list role-list">
              {db.tenant.ownerUserId === user.id && <li><Crown size={14} aria-hidden className="inline-icon text-warning" /> Propriétaire du tenant {db.tenant.name} — toutes les permissions</li>}
              {db.companies.filter((c) => c.adminUserId === user.id).map((c) => (
                <li key={c.id}><ShieldCheck size={14} aria-hidden className="inline-icon text-primary" /> Administrateur de la société <a href={`#/core/societes/${c.id}`} className="link">{c.name}</a> — toutes les permissions du core pour cette société</li>
              ))}
              {adminOfApps.map((a) => (
                <li key={`${a.appId}:${a.companyId}`}><ShieldCheck size={14} aria-hidden className="inline-icon text-primary" /> Administrateur de {db.apps.find((x) => x.id === a.appId)?.name} pour {db.companies.find((c) => c.id === a.companyId)?.name}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'infos' && (
        <section className="panel narrow">
          <dl className="detail-list">
            <div><dt>Nom</dt><dd>{fullName(user)}</dd></div>
            <div><dt>E-mail</dt><dd>{user.email}</dd></div>
            <div><dt>Identifiant</dt><dd className="mono">{user.login}</dd></div>
            <div><dt>Statut</dt><dd><StatusBadge user={user} /></dd></div>
            <div><dt>Créé le</dt><dd>{formatDate(user.createdAt)}</dd></div>
            <div><dt>Fiches RH liées</dt><dd>{Object.keys(user.employeeLinks).length ? Object.keys(user.employeeLinks).map((cid) => db.companies.find((c) => c.id === cid)?.name).join(', ') : '—'}</dd></div>
          </dl>
        </section>
      )}

    </>
  );
}
