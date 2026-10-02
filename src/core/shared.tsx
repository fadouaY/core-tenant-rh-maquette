// Briques communes du core tenant.
import { useEffect, useState, type CSSProperties } from 'react';
import { Mail, UserPlus } from 'lucide-react';
import { newId, useStore } from '../store';
import { Field, Modal } from '../components/ui';
import type { AppInfo, Company, Database, ID, TenantUser } from '../types';
import { TODAY } from '../utils/dates';

/** Logo de société : monogramme sur la couleur de la société, avec reflet et liseré discrets. */
export function CompanyLogo({ company, size = 30 }: { company: Pick<Company, 'color' | 'name'>; size?: number }) {
  const words = company.name.split(/[\s-]+/).filter((w) => w && w[0] === w[0].toUpperCase());
  const initials = (words.length ? words.slice(0, 2).map((w) => w[0]).join('') : company.name.slice(0, 2)).toUpperCase();
  return (
    <span className="company-logo" style={{ '--co': company.color, width: size, height: size, fontSize: Math.round(size * 0.36), borderRadius: Math.max(6, Math.round(size * 0.26)) } as CSSProperties} aria-hidden>
      {initials}
    </span>
  );
}

export function AppMark({ app, size = 44 }: { app: Pick<AppInfo, 'id'>; size?: number }) {
  return <span className={`app-mark app-mark-${app.id}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden>{app.id.toUpperCase()}</span>;
}

export const fullName = (u?: Pick<TenantUser, 'firstName' | 'lastName'>) => (u ? `${u.firstName} ${u.lastName}` : '');

/** Utilisateurs ayant accès à une application dans une société (administrateur compris). */
export function appUsers(db: Database, appId: string, companyId: ID): ID[] {
  const admin = db.assignments.find((a) => a.appId === appId && a.companyId === companyId && a.enabled)?.adminUserId;
  const ids = db.accesses.filter((a) => a.appId === appId && a.companyId === companyId).map((a) => a.userId);
  return [...new Set([...(admin ? [admin] : []), ...ids])];
}

/** Accès d'un utilisateur : liste des couples application × société, avec son rôle. */
export function userAccesses(db: Database, userId: ID) {
  const out: { appId: string; companyId: ID; admin: boolean }[] = [];
  for (const a of db.assignments.filter((x) => x.enabled)) {
    const admin = a.adminUserId === userId;
    const member = db.accesses.some((x) => x.userId === userId && x.appId === a.appId && x.companyId === a.companyId);
    if (admin || member) out.push({ appId: a.appId, companyId: a.companyId, admin });
  }
  return out;
}

/** Sélecteur parmi tous les utilisateurs du tenant, avec création d'un nouvel utilisateur. */
export function UserPicker({ id, value, onChange, disabled, placeholder = 'Choisir un utilisateur…' }: {
  id: string; value?: ID; onChange: (userId: ID) => void; disabled?: boolean; placeholder?: string;
}) {
  const { db } = useStore();
  const [create, setCreate] = useState(false);
  const usersFull = quotaUsage(db).usersFull;
  const users = db.users.filter((u) => u.status !== 'desactive').sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr'));
  return (
    <div className="admin-picker">
      <select id={id} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {users.map((u) => <option key={u.id} value={u.id}>{fullName(u)} — {u.email}</option>)}
      </select>
      <button type="button" className="icon-btn icon-btn-sm" title={usersFull ? 'Quota d’utilisateurs atteint' : 'Créer un utilisateur'} aria-label="Créer un utilisateur"
        disabled={disabled || usersFull} onClick={() => setCreate(true)}><UserPlus size={15} /></button>
      <NewUserModal open={create} onClose={() => setCreate(false)} onCreated={(u) => onChange(u.id)} />
    </div>
  );
}

/** Ancien nom conservé pour les écrans existants. */
export function AdminPicker({ companyId, value, onChange, disabled }: {
  companyId: ID; value?: ID; onChange: (userId: ID) => void; disabled?: boolean;
}) {
  return <UserPicker id={`admin-${companyId}`} value={value} onChange={onChange} disabled={disabled} placeholder="Choisir un administrateur…" />;
}

/** Création rapide d'un utilisateur du tenant, avec envoi (fictif) de ses identifiants. */
export function NewUserModal({ open, onClose, onCreated, title = 'Nouvel utilisateur' }: {
  open: boolean; onClose: () => void; onCreated?: (u: TenantUser) => void; title?: string;
}) {
  const { db, addUser, showCredentials } = useStore();
  const usersFull = quotaUsage(db).usersFull;
  const [f, setF] = useState({ firstName: '', lastName: '', email: '' });
  const [submitted, setSubmitted] = useState(false);
  const errors = useUserErrors(f);
  useEffect(() => { if (open) { setF({ firstName: '', lastName: '', email: '' }); setSubmitted(false); } }, [open]);

  const save = () => {
    setSubmitted(true);
    if (usersFull || Object.values(errors).some(Boolean)) return;
    const user = makeUser(f);
    addUser(user);
    onCreated?.(user);
    onClose();
    showCredentials(user);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={title} size="sm"
        footer={<><button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button><button type="button" className="btn btn-primary" onClick={save}><Mail size={14} aria-hidden /> Créer et envoyer les identifiants</button></>}>
        <UserIdentityFields f={f} setF={setF} errors={submitted ? errors : {}} />
      </Modal>
    </>
  );
}

export function useUserErrors(f: { firstName: string; lastName: string; email: string }) {
  const { db } = useStore();
  return {
    firstName: f.firstName.trim() ? '' : 'Prénom requis.',
    lastName: f.lastName.trim() ? '' : 'Nom requis.',
    email: !/^\S+@\S+\.\S+$/.test(f.email) ? 'Adresse e-mail invalide.' : db.users.some((u) => u.email === f.email.trim()) ? 'Cet e-mail est déjà utilisé.' : '',
  };
}

export function makeUser(f: { firstName: string; lastName: string; email: string }): TenantUser {
  const email = f.email.trim();
  return { id: newId('u'), firstName: f.firstName.trim(), lastName: f.lastName.trim(), email, login: email.split('@')[0], status: 'invite', createdAt: TODAY, employeeLinks: {} };
}

export function UserIdentityFields({ f, setF, errors }: {
  f: { firstName: string; lastName: string; email: string };
  setF: (v: { firstName: string; lastName: string; email: string }) => void;
  errors: Partial<Record<'firstName' | 'lastName' | 'email', string>>;
}) {
  return (
    <div className="form-grid">
      <Field label="Prénom" required error={errors.firstName || undefined}>{(id) => <input id={id} value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />}</Field>
      <Field label="Nom" required error={errors.lastName || undefined}>{(id) => <input id={id} value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />}</Field>
      <Field label="E-mail" required className="span-2" error={errors.email || undefined} hint="L’identifiant de connexion est déduit de l’e-mail.">
        {(id) => <input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}
      </Field>
    </div>
  );
}

/** Aperçu de l'e-mail d'identifiants (aucun e-mail n'est réellement envoyé). */
export function CredentialsSentModal({ user, onClose, context }: { user?: TenantUser; onClose: () => void; context?: string }) {
  const { db } = useStore();
  if (!user) return null;
  return (
    <Modal open onClose={onClose} title="Identifiants envoyés" size="md"
      footer={<button type="button" className="btn btn-primary" onClick={onClose}>Fermer</button>}>
      <p className="small text-muted mb-12">Aperçu de l’e-mail envoyé à {fullName(user)}. Démonstration : aucun e-mail n’est réellement envoyé.</p>
      <div className="email-preview">
        <div className="email-head">
          <p><span className="text-muted">À :</span> {user.email}</p>
          <p><span className="text-muted">Objet :</span> Vos accès au tenant {db.tenant.name}</p>
        </div>
        <div className="email-body">
          <p>Bonjour {user.firstName},</p>
          <p>Un compte a été créé pour vous sur le tenant <strong>{db.tenant.name}</strong>{context ? <> — {context}</> : null}.</p>
          <dl className="email-creds">
            <div><dt>Identifiant</dt><dd className="mono">{user.login}</dd></div>
            <div><dt>Mot de passe temporaire</dt><dd className="mono">•••••••••• <span className="small text-muted">(généré, à changer à la première connexion)</span></dd></div>
          </dl>
          <span className="btn btn-sm btn-primary email-cta" aria-hidden>Se connecter</span>
        </div>
      </div>
    </Modal>
  );
}

/** Fenêtre globale d'aperçu des identifiants, pilotée par le store. */
export function CredentialsNotice() {
  const { credentialsNotice, clearCredentials } = useStore();
  return <CredentialsSentModal user={credentialsNotice?.user} context={credentialsNotice?.context} onClose={clearCredentials} />;
}

// ---------- Quotas du tenant ----------

/** Consommation des quotas : sociétés non archivées, utilisateurs non désactivés. */
export function quotaUsage(db: Database) {
  const companies = db.companies.filter((c) => !c.archived).length;
  const users = db.users.filter((u) => u.status !== 'desactive').length;
  return {
    companies, maxCompanies: db.tenant.maxCompanies, companiesFull: companies >= db.tenant.maxCompanies,
    users, maxUsers: db.tenant.maxUsers, usersFull: users >= db.tenant.maxUsers,
  };
}

export function useQuota() {
  const { db } = useStore();
  return quotaUsage(db);
}

/** Jauge de quota (en-tête de page ou barre supérieure). */
export function QuotaMeter({ label, used, max, compact }: { label: string; used: number; max: number; compact?: boolean }) {
  const ratio = max > 0 ? Math.min(1, used / max) : 1;
  const tone = used >= max ? 'full' : ratio >= 0.8 ? 'warn' : 'ok';
  return (
    <span className={`quota quota-${tone} ${compact ? 'quota-compact' : ''}`} title={`${label} : ${used} sur ${max}`}>
      <span className="quota-text"><span className="quota-label">{label}</span> <strong>{used}</strong><span className="quota-max">/{max}</span></span>
      <span className="quota-bar" aria-hidden><span style={{ width: `${ratio * 100}%` }} /></span>
    </span>
  );
}
