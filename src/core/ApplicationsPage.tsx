// Section « Applications » du core tenant : catalogue, sociétés utilisatrices et administrateur
// de l'application dans chaque société.
import { useEffect, useState } from 'react';
import { AlertTriangle, AppWindow, ArrowLeft, ArrowRight, ExternalLink, Plus, Search, Settings2, UserMinus } from 'lucide-react';
import { navigate, useStore } from '../store';
import { Avatar, Badge, EmptyState, Field, Modal, PageHeader } from '../components/ui';
import type { AppInfo, ID } from '../types';
import { formatDate } from '../utils/dates';
import { AdminPicker, AppMark, appUsers, CompanyLogo, fullName, NewUserModal, quotaUsage, UserPicker } from './shared';

export function ApplicationsPage({ param }: { param?: string }) {
  const { db } = useStore();
  const app = param ? db.apps.find((a) => a.id === param) : undefined;
  if (param && !app) return <EmptyState title="Application introuvable" action={<a className="btn btn-primary" href="#/core/applications">Retour au catalogue</a>} />;
  return app ? <AppDetail app={app} /> : <Catalogue />;
}

/** Ouvre une application dans le contexte d'une société. */
function useOpenApp() {
  const { setCompanyId } = useStore();
  return (app: AppInfo, companyId: ID) => { setCompanyId(companyId); navigate(app.entry); };
}

function Catalogue() {
  const { db, companyId, companiesFor } = useStore();
  const open = useOpenApp();

  return (
    <>
      <PageHeader eyebrow="Core tenant · Catalogue" icon={<AppWindow size={20} strokeWidth={1.8} />} title="Applications" subtitle={`Catalogue des applications du tenant ${db.tenant.name}. Chaque application est utilisée par une ou plusieurs sociétés, avec un administrateur par société.`} />
      <div className="catalogue">
        {db.apps.map((app) => {
          const companies = companiesFor(app.id);
          const missingAdmin = db.assignments.filter((a) => a.appId === app.id && a.enabled && !a.adminUserId).length;
          const target = companies.find((c) => c.id === companyId) ?? companies[0];
          return (
            <article key={app.id} className="app-card">
              <div className="app-card-head">
                <AppMark app={app} />
                <div className="grow">
                  <h2 className="app-card-name">{app.name}</h2>
                  <p className="text-muted small">Utilisée par {companies.length} société{companies.length > 1 ? 's' : ''}</p>
                </div>
                <Badge tone="success">Disponible</Badge>
              </div>
              <p className="app-card-text">{app.description}</p>
              <ul className="feature-list" aria-label="Fonctionnalités">
                {app.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <div className="app-card-companies" aria-label="Sociétés utilisatrices">
                {companies.map((c) => <span key={c.id} title={c.name}><CompanyLogo company={c} size={22} /></span>)}
                {missingAdmin > 0 && <span className="small text-warning"><AlertTriangle size={12} aria-hidden className="inline-icon" />{missingAdmin} sans administrateur</span>}
              </div>
              <div className="app-card-actions">
                <button type="button" className="btn btn-ghost" onClick={() => navigate(`core/applications/${app.id}`)}><Settings2 size={14} aria-hidden /> Sociétés et administrateurs</button>
                <button type="button" className="btn btn-primary" disabled={!target} onClick={() => target && open(app, target.id)}>
                  Ouvrir <ArrowRight size={14} aria-hidden />
                </button>
              </div>
            </article>
          );
        })}
        <article className="app-card app-card-placeholder" aria-label="Emplacement pour de futures applications">
          <span className="app-card-placeholder-icon" aria-hidden><Plus size={18} /></span>
          <p className="app-card-placeholder-title">Bientôt d’autres applications</p>
          <p className="small text-muted">Paie, notes de frais, recrutement… rejoindront le catalogue.</p>
        </article>
      </div>
    </>
  );
}

function AppDetail({ app }: { app: AppInfo }) {
  const { db, setAssignment, toast } = useStore();
  const open = useOpenApp();
  const [addOpen, setAddOpen] = useState(false);
  const [removeId, setRemoveId] = useState<ID>();
  const [usersOf, setUsersOf] = useState<ID>();

  const rows = db.assignments
    .filter((a) => a.appId === app.id && a.enabled)
    .map((a) => ({ a, company: db.companies.find((c) => c.id === a.companyId)! }))
    .filter((r) => r.company)
    .sort((x, y) => x.company.name.localeCompare(y.company.name, 'fr'));
  const available = db.companies.filter((c) => !c.archived && !rows.some((r) => r.company.id === c.id));
  const userName = (id?: ID) => fullName(db.users.find((x) => x.id === id));
  const removing = rows.find((r) => r.company.id === removeId);

  return (
    <>
      <div className="breadcrumb">
        <button type="button" className="back-link" onClick={() => navigate('core/applications')}><ArrowLeft size={14} aria-hidden /> Applications</button>
        <span aria-hidden>/</span><span>{app.name}</span>
      </div>
      <div className="profile-header">
        <AppMark app={app} size={52} />
        <div className="grow">
          <h1>{app.name}</h1>
          <p className="text-muted">{app.description}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" disabled={available.length === 0} onClick={() => setAddOpen(true)}><Plus size={15} aria-hidden /> Ajouter une société</button>
        </div>
      </div>

      <section>
        <div className="section-head">
          <h2 className="section-title">Sociétés utilisatrices ({rows.length})</h2>
          <span className="small text-muted">Un administrateur et des utilisateurs par société, choisis parmi les utilisateurs du tenant.</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState title="Aucune société" text="Ajoutez une société pour qu’elle puisse utiliser l’application."
            action={<button type="button" className="btn btn-primary" onClick={() => setAddOpen(true)}>Ajouter une société</button>} />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Société</th>
                  <th scope="col">Administrateur de l’application</th>
                  <th scope="col">Utilisateurs</th>
                  <th scope="col">Depuis le</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ a, company }) => {
                  const members = appUsers(db, app.id, company.id).map((id) => db.users.find((u) => u.id === id)!).filter(Boolean);
                  return (
                    <tr key={company.id}>
                      <td>
                        <span className="person">
                          <CompanyLogo company={company} size={26} />
                          <span><a href={`#/core/societes/${company.id}`} className="person-name person-link">{company.name}</a><span className="person-sub">{company.city} · {company.country}</span></span>
                        </span>
                      </td>
                      <td>
                        <AdminPicker companyId={company.id} value={a.adminUserId}
                          onChange={(userId) => { if (!userId) return; setAssignment(app.id, company.id, { adminUserId: userId }); toast(`${userName(userId) || 'Le nouvel utilisateur'} administre ${app.name} pour ${company.name}`); }} />
                        {!a.adminUserId && <span className="field-error">Administrateur à désigner</span>}
                      </td>
                      <td>
                        <button type="button" className="members-btn" onClick={() => setUsersOf(company.id)} aria-label={`Gérer les utilisateurs de ${app.name} pour ${company.name}`}>
                          <span className="avatar-stack">{members.slice(0, 4).map((u) => <Avatar key={u.id} employee={u} size={22} />)}</span>
                          <span className="small">{members.length} utilisateur{members.length > 1 ? 's' : ''}</span>
                          <span className="link small">Gérer</span>
                        </button>
                      </td>
                      <td className="nowrap">{formatDate(a.activatedAt)}</td>
                      <td className="actions">
                        <button type="button" className="btn btn-sm btn-ghost" disabled={!a.adminUserId} onClick={() => open(app, company.id)}>Ouvrir <ExternalLink size={12} aria-hidden /></button>
                        <button type="button" className="btn btn-sm btn-ghost-danger" onClick={() => setRemoveId(company.id)}><UserMinus size={13} aria-hidden /> Retirer</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="source-note">Quand une société est ajoutée, elle reçoit un paramétrage de départ (département, horaire, congé annuel, rôles, circuits) et l’administrateur obtient le rôle « Administrateur RH » — valeurs de démonstration.</p>
      </section>

      <AddCompanyModal app={app} open={addOpen} onClose={() => setAddOpen(false)} />
      <AppUsersModal app={app} companyId={usersOf} onClose={() => setUsersOf(undefined)} />
      <Modal open={!!removing} onClose={() => setRemoveId(undefined)} title={`Retirer ${removing?.company.name ?? ''} ?`} size="sm"
        footer={<>
          <button type="button" className="btn btn-ghost" onClick={() => setRemoveId(undefined)}>Annuler</button>
          <button type="button" className="btn btn-danger" onClick={() => { setAssignment(app.id, removeId!, { enabled: false }); toast(`${removing?.company.name} n’utilise plus ${app.name}`, 'info'); setRemoveId(undefined); }}>Retirer l’accès</button>
        </>}>
        <p>La société n’aura plus accès à {app.name}. Ses données et ses utilisateurs sont conservés et seront retrouvés si vous l’ajoutez de nouveau.</p>
      </Modal>
    </>
  );
}

/** Utilisateurs d'une application dans une société : liste actuelle et affectation depuis la liste du tenant. */
function AppUsersModal({ app, companyId, onClose }: { app: AppInfo; companyId?: ID; onClose: () => void }) {
  const { db, setAccess, toast } = useStore();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<ID[]>([]);
  const [create, setCreate] = useState(false);
  useEffect(() => { setQ(''); setSelected([]); }, [companyId]);
  if (!companyId) return null;
  const company = db.companies.find((c) => c.id === companyId)!;
  const admin = db.assignments.find((a) => a.appId === app.id && a.companyId === companyId)?.adminUserId;
  const memberIds = appUsers(db, app.id, companyId);
  const candidates = db.users
    .filter((u) => u.status !== 'desactive' && !memberIds.includes(u.id))
    .filter((u) => !q || `${fullName(u)} ${u.email}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'));

  const add = () => {
    selected.forEach((id) => setAccess(id, app.id, companyId, true));
    toast(`${selected.length} utilisateur(s) affecté(s) à ${app.name} — ${company.name}`);
    setSelected([]);
  };

  return (
    <Modal open onClose={onClose} title={`Utilisateurs · ${app.name} · ${company.name}`} size="lg"
      footer={<button type="button" className="btn btn-primary" onClick={onClose}>Terminé</button>}>
      <div className="members-grid">
        <section>
          <h3 className="sub-title">Utilisateurs affectés ({memberIds.length})</h3>
          <ul className="member-list">
            {memberIds.map((id) => {
              const u = db.users.find((x) => x.id === id)!;
              return (
                <li key={id}>
                  <Avatar employee={u} size={28} />
                  <span className="grow"><span className="person-name">{fullName(u)}</span><span className="block small text-muted">{u.email}</span></span>
                  {id === admin ? <Badge tone="primary">Administrateur</Badge> : (
                    <button type="button" className="icon-btn icon-btn-sm icon-btn-danger" aria-label={`Retirer l’affectation de ${fullName(u)}`} title="Retirer l’affectation"
                      onClick={() => { setAccess(id, app.id, companyId, false); toast(`Affectation retirée pour ${fullName(u)}`, 'info'); }}><UserMinus size={14} /></button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <div className="section-head">
            <h3 className="sub-title">Affecter depuis la liste des utilisateurs</h3>
            <button type="button" className="link-btn" disabled={quotaUsage(db).usersFull} title={quotaUsage(db).usersFull ? 'Quota d’utilisateurs atteint' : undefined} onClick={() => setCreate(true)}>+ Nouvel utilisateur</button>
          </div>
          <div className="input-icon mb-12">
            <Search size={14} aria-hidden />
            <input className="search-sm" type="search" aria-label="Rechercher un utilisateur" placeholder="Nom ou e-mail…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {candidates.length === 0 ? <p className="small text-muted">Tous les utilisateurs sont déjà affectés.</p> : (
            <ul className="picker-list">
              {candidates.map((u) => {
                const checked = selected.includes(u.id);
                return (
                  <li key={u.id}>
                    <label className={`picker-item ${checked ? 'selected' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={(e) => setSelected((l) => (e.target.checked ? [...l, u.id] : l.filter((x) => x !== u.id)))} />
                      <Avatar employee={u} size={26} />
                      <span className="grow"><span className="person-name">{fullName(u)}</span><span className="block small text-muted">{u.email}</span></span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="save-bar">
            <button type="button" className="btn btn-primary" disabled={selected.length === 0} onClick={add}><Plus size={14} aria-hidden /> Affecter ({selected.length})</button>
          </div>
        </section>
      </div>
      <NewUserModal open={create} onClose={() => setCreate(false)} onCreated={(u) => setSelected((l) => [...l, u.id])} />
    </Modal>
  );
}

/** Ajout d'une société utilisatrice avec désignation obligatoire de son administrateur. */
function AddCompanyModal({ app, open, onClose }: { app: AppInfo; open: boolean; onClose: () => void }) {
  const { db, setAssignment, toast } = useStore();
  const available = db.companies.filter((c) => !c.archived && !db.assignments.some((a) => a.appId === app.id && a.companyId === c.id && a.enabled));
  const [companyId, setCompanyId] = useState('');
  const [adminId, setAdminId] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const first = available[0];
    setCompanyId(first?.id ?? ''); setAdminId(first?.adminUserId ?? ''); setSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const errors = { company: companyId ? '' : 'Choisissez une société.', admin: adminId ? '' : 'Choisissez l’administrateur.' };
  const save = () => {
    setSubmitted(true);
    if (errors.company || errors.admin) return;
    setAssignment(app.id, companyId, { enabled: true, adminUserId: adminId });
    toast(`${db.companies.find((c) => c.id === companyId)?.name} utilise maintenant ${app.name}`);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`Ajouter une société à ${app.name}`}
      footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}>Ajouter</button></>}>
      {available.length === 0 ? <p>Toutes les sociétés actives utilisent déjà cette application.</p> : (
        <div className="stack">
          <Field label="Société" required error={submitted ? errors.company || undefined : undefined}>
            {(id) => (
              <select id={id} value={companyId} onChange={(e) => { setCompanyId(e.target.value); setAdminId(db.companies.find((c) => c.id === e.target.value)?.adminUserId ?? ''); }}>
                {available.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}
              </select>
            )}
          </Field>
          <Field label="Administrateur de l’application dans cette société" required error={submitted ? errors.admin || undefined : undefined}
            hint="Proposé par défaut : l’administrateur de la société. Tout utilisateur du tenant peut être choisi.">
            {(id) => <UserPicker id={id} value={adminId} onChange={setAdminId} />}
          </Field>
        </div>
      )}
    </Modal>
  );
}
