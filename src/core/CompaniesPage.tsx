// Section « Sociétés » du core tenant : identité, administrateur obligatoire et vue des accès.
import { useEffect, useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ArrowLeft, Building2, ExternalLink, Hash, Landmark, Mail, MapPin, Pencil, Plus, Search, ShieldCheck } from 'lucide-react';
import { navigate, newId, useStore } from '../store';
import { Alert, ArchivedBadge, Avatar, Badge, ColorField, Drawer, EmptyState, Field, PageHeader, SelectFilter, Tabs } from '../components/ui';
import type { Company, Database, ID, TenantUser } from '../types';
import { formatDate, TODAY } from '../utils/dates';
import {
  AppMark, appUsers, CompanyLogo, fullName, makeUser, QuotaMeter, useQuota, UserIdentityFields, UserPicker, useUserErrors,
} from './shared';

export function CompaniesPage({ param }: { param?: string }) {
  if (param && param !== 'nouvelle') return <CompanyDetail companyId={param} />;
  return <CompanyList createOpen={param === 'nouvelle'} />;
}

/** Utilisateurs ayant au moins un accès dans la société, plus son administrateur. */
function companyUserIds(db: Database, companyId: ID): ID[] {
  const ids = new Set<ID>();
  const admin = db.companies.find((c) => c.id === companyId)?.adminUserId;
  if (admin) ids.add(admin);
  db.assignments.filter((a) => a.companyId === companyId && a.enabled).forEach((a) => appUsers(db, a.appId, companyId).forEach((id) => ids.add(id)));
  return [...ids];
}

function UserStatusBadge({ user }: { user: TenantUser }) {
  if (user.status === 'invite') return <Badge tone="warning">Invitation envoyée</Badge>;
  if (user.status === 'desactive') return <Badge tone="muted">Désactivé</Badge>;
  return <Badge tone="success">Actif</Badge>;
}

function CompanyList({ createOpen }: { createOpen: boolean }) {
  const { db } = useStore();
  const quota = useQuota();
  const [q, setQ] = useState('');
  const [state, setState] = useState('actives');

  const list = useMemo(() => db.companies
    .filter((c) => !q || `${c.name} ${c.legalName} ${c.city} ${c.taxId}`.toLowerCase().includes(q.toLowerCase()))
    .filter((c) => !state || (state === 'actives' ? !c.archived : c.archived))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr')), [db.companies, q, state]);

  return (
    <>
      <PageHeader eyebrow="Core tenant · Organisation" icon={<Building2 size={20} strokeWidth={1.8} />}
        title="Sociétés"
        subtitle={`Sociétés du tenant ${db.tenant.name}. Chaque société a un administrateur qui gère ses accès dans le core tenant.`}
        actions={<>
          <QuotaMeter label="Sociétés" used={quota.companies} max={quota.maxCompanies} />
          <button type="button" className="btn btn-primary" disabled={quota.companiesFull} title={quota.companiesFull ? 'Quota de sociétés atteint' : undefined} onClick={() => navigate('core/societes/nouvelle')}><Plus size={15} aria-hidden /> Nouvelle société</button>
        </>}
      />
      {quota.companiesFull && (
        <Alert tone="warning" title={`Quota atteint : ${quota.companies} sociétés sur ${quota.maxCompanies}`}>
          Archivez une société ou passez à une offre supérieure (simulation dans l’en-tête) pour en créer une nouvelle.
        </Alert>
      )}
      <div className="filters">
        <div className="filter filter-search">
          <label htmlFor="co-q">Recherche</label>
          <div className="input-icon"><Search size={14} aria-hidden /><input id="co-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, ville, identifiant…" /></div>
        </div>
        <SelectFilter label="État" value={state} onChange={setState} allLabel="Toutes" options={[{ value: 'actives', label: 'Actives' }, { value: 'archivees', label: 'Archivées' }]} />
      </div>
      <p className="result-count">{list.length} société{list.length > 1 ? 's' : ''}</p>
      {list.length === 0 ? <EmptyState title="Aucune société" text="Modifiez les filtres ou créez une société." /> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Société</th>
                <th scope="col">Administrateur</th>
                <th scope="col">Localisation</th>
                <th scope="col">Applications</th>
                <th scope="col" className="num">Utilisateurs</th>
                <th scope="col">Créée le</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const admin = db.users.find((u) => u.id === c.adminUserId);
                const apps = db.assignments.filter((a) => a.companyId === c.id && a.enabled);
                return (
                  <tr key={c.id} className={`row-click ${c.archived ? 'row-archived' : ''}`} onClick={() => navigate(`core/societes/${c.id}`)}>
                    <td>
                      <span className="person">
                        <CompanyLogo company={c} size={28} />
                        <span><span className="person-name person-link">{c.name}</span> {c.archived && <ArchivedBadge />}<span className="person-sub">{c.legalName}</span></span>
                      </span>
                    </td>
                    <td>{admin ? <span className="person"><Avatar employee={admin} size={24} /><span className="small">{fullName(admin)}</span></span> : <span className="field-error">À désigner</span>}</td>
                    <td>{c.city} · {c.country}</td>
                    <td>{apps.length === 0 ? <span className="text-muted">Aucune</span> : apps.map((a) => <span key={a.appId} className="app-pill">{db.apps.find((x) => x.id === a.appId)?.name}</span>)}</td>
                    <td className="num">{companyUserIds(db, c.id).length}</td>
                    <td className="nowrap">{formatDate(c.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <CompanyForm open={createOpen && !quota.companiesFull} onClose={() => navigate('core/societes')} />
    </>
  );
}

const COLORS = ['#2f5bd3', '#0f8a7a', '#8a4fd1', '#c2410c', '#0e7490', '#b45309', '#be185d', '#4d7c0f'];

/** Création (avec administrateur obligatoire) ou modification de l'identité d'une société. */
function CompanyForm({ open, onClose, company }: { open: boolean; onClose: () => void; company?: Company }) {
  const { db, saveCompany, addUser, showCredentials, toast, tenantUser } = useStore();
  const quota = useQuota();
  const isNew = !company;
  const blank: Company = { id: '', name: '', legalName: '', taxId: '', city: '', country: 'Maroc', color: COLORS[db.companies.length % COLORS.length], createdAt: TODAY };
  const [f, setF] = useState<Company>(company ?? blank);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  /** « Me désigner comme administrateur » : l'utilisateur connecté devient l'admin de la société. */
  const [self, setSelf] = useState(false);
  const [adminId, setAdminId] = useState('');
  const [admin, setAdmin] = useState({ firstName: '', lastName: '', email: '' });
  const [submitted, setSubmitted] = useState(false);
  const userErrors = useUserErrors(admin);

  useEffect(() => {
    if (!open) return;
    setF(company ?? blank); setMode(quota.usersFull ? 'existing' : 'new'); setSelf(false); setAdminId(''); setAdmin({ firstName: '', lastName: '', email: '' }); setSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, company]);

  const errors: Record<string, string> = {};
  if (!f.name.trim()) errors.name = 'Nom requis.';
  if (!f.legalName.trim()) errors.legalName = 'Raison sociale requise.';
  if (!f.city.trim()) errors.city = 'Ville requise.';
  if (isNew && !self && mode === 'existing' && !adminId) errors.admin = 'Choisissez l’administrateur.';
  if (isNew && quota.companiesFull) errors.quota = 'Quota de sociétés atteint.';
  if (isNew && !self && mode === 'new' && quota.usersFull) errors.quota = 'Quota d’utilisateurs atteint : choisissez un utilisateur existant.';
  const adminInvalid = isNew && !self && mode === 'new' && Object.values(userErrors).some(Boolean);
  const err = (k: string) => (submitted ? errors[k] : undefined);

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length || adminInvalid) return;
    let adminUserId = company?.adminUserId;
    let created: TenantUser | undefined;
    if (isNew) {
      if (self) adminUserId = tenantUser.id;
      else if (mode === 'new') { created = makeUser(admin); addUser(created); adminUserId = created.id; } else adminUserId = adminId;
    }
    const saved: Company = { ...f, id: f.id || newId('c'), name: f.name.trim(), legalName: f.legalName.trim(), adminUserId };
    saveCompany(saved);
    toast(isNew ? `Société « ${saved.name} » créée` : 'Société mise à jour');
    onClose();
    if (created) showCredentials(created, `administrateur de la société ${saved.name}`);
    if (isNew) window.setTimeout(() => navigate(`core/societes/${saved.id}`), 0);
  };

  return (
    <>
      <Drawer open={open} onClose={onClose} title={isNew ? 'Nouvelle société' : `Modifier ${company?.name}`} subtitle="Les champs marqués d’un astérisque sont obligatoires."
        footer={<><span className="spacer" /><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>{isNew ? 'Créer la société' : 'Enregistrer'}</button></>}>
        <fieldset className="form-section">
          <legend>Identité</legend>
          <div className="form-grid">
            <Field label="Nom" required error={err('name')}>{(id) => <input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex. : Atlas Logistique" />}</Field>
            <Field label="Raison sociale" required error={err('legalName')}>{(id) => <input id={id} value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} placeholder="Ex. : Atlas Logistique SARL" />}</Field>
            <Field label="Identifiant fiscal" hint="ICE, SIRET… (valeur fictive)">{(id) => <input id={id} value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} />}</Field>
            <Field label="Couleur">{(id) => <ColorField id={id} value={f.color} onChange={(v) => setF({ ...f, color: v })} />}</Field>
            <Field label="Ville" required error={err('city')}>{(id) => <input id={id} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />}</Field>
            <Field label="Pays">{(id) => (
              <select id={id} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
                {['Maroc', 'France', 'Belgique', 'Tunisie', 'Sénégal', 'Côte d’Ivoire'].map((c) => <option key={c}>{c}</option>)}
              </select>
            )}</Field>
          </div>
        </fieldset>

        {isNew && (
          <fieldset className="form-section">
            <legend>Administrateur de la société <span className="req">*</span></legend>
            <p className="small text-muted mb-12">
              {self
                ? 'Vous disposerez de toutes les permissions du core tenant pour cette société (applications, administrateurs, utilisateurs). Aucun e-mail n’est envoyé : vous utilisez votre compte actuel.'
                : 'Il reçoit par e-mail son identifiant et un mot de passe temporaire, et dispose de toutes les permissions du core tenant pour cette société (applications, administrateurs, utilisateurs).'}
            </p>
            <label className={`self-admin ${self ? 'checked' : ''}`}>
              <input type="checkbox" checked={self} onChange={(e) => setSelf(e.target.checked)} />
              <Avatar employee={tenantUser} size={34} />
              <span className="self-admin-body">
                <span className="self-admin-title">Me désigner comme administrateur</span>
                <span className="self-admin-sub">{fullName(tenantUser)} · {tenantUser.email} · <span className="mono">{tenantUser.login}</span></span>
              </span>
              {self && <Badge tone="primary"><ShieldCheck size={12} aria-hidden /> Administrateur</Badge>}
            </label>
            {!self && (
              <>
                <div className="or-sep"><span>ou désigner une autre personne</span></div>
                <div className="radio-row mb-12" role="radiogroup" aria-label="Administrateur">
                  <label className={`radio-pill ${mode === 'new' ? 'checked' : ''} ${quota.usersFull ? 'disabled' : ''}`} title={quota.usersFull ? 'Quota d’utilisateurs atteint' : undefined}><input type="radio" name="co-admin" checked={mode === 'new'} disabled={quota.usersFull} onChange={() => setMode('new')} /> Créer un compte</label>
                  <label className={`radio-pill ${mode === 'existing' ? 'checked' : ''}`}><input type="radio" name="co-admin" checked={mode === 'existing'} onChange={() => setMode('existing')} /> Utilisateur existant</label>
                </div>
                {quota.usersFull && <p className="small text-warning mb-12">Quota d’utilisateurs atteint ({quota.users}/{quota.maxUsers}) : désignez un utilisateur existant.</p>}
                {mode === 'new'
                  ? <UserIdentityFields f={admin} setF={setAdmin} errors={submitted ? userErrors : {}} />
                  : <Field label="Utilisateur" required error={err('admin')}>{(id) => <UserPicker id={id} value={adminId} onChange={setAdminId} />}</Field>}
              </>
            )}
          </fieldset>
        )}
        {submitted && errors.quota && <p className="field-error">{errors.quota}</p>}
        {isNew && <p className="small text-muted">L’affectation aux applications se fait ensuite depuis la section <strong>Applications</strong> ou <strong>Utilisateurs</strong>.</p>}
      </Drawer>
    </>
  );
}

type Tab = 'applications' | 'utilisateurs' | 'infos';

function CompanyDetail({ companyId }: { companyId: ID }) {
  const { db, saveCompany, setCompanyId, showCredentials, toast } = useStore();
  const quota = useQuota();
  const company = db.companies.find((c) => c.id === companyId);
  const [tab, setTab] = useState<Tab>('applications');
  const [editOpen, setEditOpen] = useState(false);
  const [changing, setChanging] = useState(false);

  if (!company) return <EmptyState title="Société introuvable" action={<a className="btn btn-primary" href="#/core/societes">Retour aux sociétés</a>} />;

  const admin = db.users.find((u) => u.id === company.adminUserId);
  const userIds = companyUserIds(db, company.id);
  const companyApps = db.assignments.filter((a) => a.companyId === company.id && a.enabled)
    .map((a) => ({ a, app: db.apps.find((x) => x.id === a.appId)! })).filter((x) => x.app);

  return (
    <>
      <div className="breadcrumb">
        <button type="button" className="back-link" onClick={() => navigate('core/societes')}><ArrowLeft size={14} aria-hidden /> Sociétés</button>
        <span aria-hidden>/</span><span>{company.name}</span>
      </div>
      <div className="profile-header record-header">
        <CompanyLogo company={company} size={48} />
        <div className="grow">
          <h1>{company.name} {company.archived && <ArchivedBadge />}</h1>
          <ul className="record-meta">
            <li><Landmark size={13} aria-hidden /> {company.legalName}</li>
            <li><MapPin size={13} aria-hidden /> {company.city}, {company.country}</li>
            <li><Hash size={13} aria-hidden /> <span className="mono">{company.taxId || '—'}</span></li>
          </ul>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" disabled={!!company.archived && quota.companiesFull} title={company.archived && quota.companiesFull ? 'Quota de sociétés atteint' : undefined} onClick={() => { saveCompany({ ...company, archived: !company.archived }); toast(company.archived ? 'Société restaurée' : 'Société archivée — ses données restent consultables', 'info'); }}>
            {company.archived ? <><ArchiveRestore size={14} aria-hidden /> Restaurer</> : <><Archive size={14} aria-hidden /> Archiver</>}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setEditOpen(true)}><Pencil size={14} aria-hidden /> Modifier</button>
        </div>
      </div>

      <section className="panel admin-card">
        <div className="admin-card-label">
          <ShieldCheck size={14} aria-hidden /> Administrateur de la société
          <span className="admin-card-hint">· toutes les permissions du core tenant</span>
        </div>
        <div className="admin-card-row">
          <div className="grow">
            {admin ? (
              <span className="person">
                <Avatar employee={admin} size={34} />
                <span><span className="person-name">{fullName(admin)}</span> <UserStatusBadge user={admin} /><span className="person-sub">{admin.email} · <span className="mono">{admin.login}</span></span></span>
              </span>
            ) : <p className="field-error">Aucun administrateur — désignez-en un.</p>}
          </div>
        <div className="admin-card-actions">
          {changing ? (
            <UserPicker id="co-admin-change" value={company.adminUserId}
              onChange={(id) => { if (!id) return; saveCompany({ ...company, adminUserId: id }); setChanging(false); toast('Administrateur de la société modifié'); }} />
          ) : (
            <>
              {admin && <button type="button" className="btn btn-sm btn-ghost" onClick={() => { showCredentials(admin, `administrateur de la société ${company.name}`); toast(`Identifiants renvoyés à ${admin.email}`); }}><Mail size={13} aria-hidden /> Renvoyer les identifiants</button>}
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setChanging(true)}>Changer</button>
            </>
          )}
        </div>
        </div>
      </section>

      <Tabs<Tab> label="Sections de la société" value={tab} onChange={setTab} tabs={[
        { id: 'applications', label: 'Applications', count: companyApps.length },
        { id: 'utilisateurs', label: 'Utilisateurs', count: userIds.length },
        { id: 'infos', label: 'Informations' },
      ]} />

      {tab === 'applications' && (
        <section>
          <div className="section-head">
            <h2 className="section-title">Applications utilisées</h2>
            <a href="#/core/applications" className="link">Gérer dans Applications</a>
          </div>
          {companyApps.length === 0 ? (
            <EmptyState title="Aucune application" text="Ajoutez cette société depuis la page d’une application du catalogue."
              action={<a className="btn btn-primary" href="#/core/applications">Voir le catalogue</a>} />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th scope="col">Application</th><th scope="col">Administrateur</th><th scope="col" className="num">Utilisateurs</th><th scope="col">Depuis le</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {companyApps.map(({ a, app }) => {
                    const appAdmin = db.users.find((u) => u.id === a.adminUserId);
                    return (
                      <tr key={app.id}>
                        <td><span className="person"><AppMark app={app} size={26} /><a href={`#/core/applications/${app.id}`} className="person-name person-link">{app.name}</a></span></td>
                        <td>{appAdmin ? fullName(appAdmin) : <span className="field-error">À désigner</span>}</td>
                        <td className="num">{appUsers(db, app.id, company.id).length}</td>
                        <td className="nowrap">{formatDate(a.activatedAt)}</td>
                        <td className="actions">
                          <button type="button" className="btn btn-sm btn-ghost" disabled={!appAdmin} onClick={() => { setCompanyId(company.id); navigate(app.entry); }}>Ouvrir <ExternalLink size={12} aria-hidden /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'utilisateurs' && (
        <section>
          <div className="section-head">
            <h2 className="section-title">Utilisateurs affectés aux applications de la société</h2>
            <a href="#/core/utilisateurs" className="link">Gérer les utilisateurs</a>
          </div>
          {userIds.length === 0 ? <EmptyState title="Aucun utilisateur" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th scope="col">Utilisateur</th><th scope="col">Rôle</th><th scope="col">Applications affectées</th><th scope="col">Statut</th></tr></thead>
                <tbody>
                  {userIds.map((id) => {
                    const u = db.users.find((x) => x.id === id);
                    if (!u) return null;
                    const apps = companyApps.filter(({ app }) => appUsers(db, app.id, company.id).includes(id));
                    return (
                      <tr key={id} className="row-click" onClick={() => navigate(`core/utilisateurs/${id}`)}>
                        <td><span className="person"><Avatar employee={u} size={26} /><span><span className="person-name person-link">{fullName(u)}</span><span className="person-sub">{u.email}</span></span></span></td>
                        <td>{id === company.adminUserId ? <Badge tone="primary">Administrateur société</Badge> : <span className="text-muted small">Utilisateur</span>}</td>
                        <td>{apps.length ? apps.map(({ a, app }) => <span key={app.id} className="app-pill">{app.name}{a.adminUserId === id ? ' (admin)' : ''}</span>) : <span className="text-muted">—</span>}</td>
                        <td><UserStatusBadge user={u} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'infos' && (
        <section className="panel narrow">
          <dl className="detail-list">
            <div><dt>Nom</dt><dd>{company.name}</dd></div>
            <div><dt>Raison sociale</dt><dd>{company.legalName}</dd></div>
            <div><dt>Identifiant fiscal</dt><dd className="mono">{company.taxId || '—'}</dd></div>
            <div><dt>Localisation</dt><dd>{company.city}, {company.country}</dd></div>
            <div><dt>Créée le</dt><dd>{formatDate(company.createdAt)}</dd></div>
            <div><dt>État</dt><dd>{company.archived ? <ArchivedBadge /> : <Badge tone="success">Active</Badge>}</dd></div>
          </dl>
        </section>
      )}

      <CompanyForm open={editOpen} company={company} onClose={() => setEditOpen(false)} />
    </>
  );
}
