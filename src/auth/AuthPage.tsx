// Écran d'authentification du core tenant (maquette : aucun mot de passe n'est vérifié, envoyé ni conservé).
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, Eye, EyeOff, Gauge, LayoutGrid, Loader2, Lock, Mail, Receipt,
} from 'lucide-react';
import { navigate, useStore } from '../store';
import { CoreLogo } from '../components/Logo';
import './auth.css';

export type AuthMode = 'connexion' | 'inscription' | 'mot-de-passe-oublie';

export function AuthPage({ mode, onDone }: { mode: AuthMode; onDone: () => void }) {
  const { db } = useStore();
  return (
    <div className="auth">
      <aside className="auth-side"><Pitch tenant={db.tenant.name} /></aside>

      <div className="auth-right">
        <header className="auth-top">
          <a href="#/connexion" className="auth-logo"><CoreLogo size={30} /><span>Core tenant</span></a>
          {mode === 'inscription'
            ? <span className="auth-top-cta">Déjà inscrit ? <a href="#/connexion" className="auth-pill">Se connecter</a></span>
            : <span className="auth-top-cta">Nouveau ? <a href="#/inscription" className="auth-pill">Créer un espace</a></span>}
        </header>

        <main className="auth-main" id="main">
          <div className="auth-stage">
            <div className={`auth-card ${mode === 'inscription' ? 'wide' : ''}`}>
              <span className="auth-medal" aria-hidden><CoreLogo size={42} /></span>
              {mode === 'connexion' && <LoginForm onDone={onDone} />}
              {mode === 'inscription' && <RegisterForm />}
              {mode === 'mot-de-passe-oublie' && <ForgotForm />}
            </div>
          </div>
        </main>

        <footer className="auth-footer">
          <span className="auth-secure"><Lock size={12} aria-hidden /> Connexion chiffrée (simulée)</span>
          <span className="auth-dot" aria-hidden>·</span>
          <span>Maquette : aucune donnée n’est transmise</span>
        </footer>
      </div>
    </div>
  );
}

/** Panneau de gauche (pleine hauteur) : ce que le core tenant permet de faire. */
function Pitch({ tenant }: { tenant: string }) {
  const features = [
    { icon: <LayoutGrid size={18} />, title: 'Centralisez vos applications' },
    { icon: <Building2 size={18} />, title: 'Organisez vos sociétés et vos employés' },
    { icon: <Gauge size={18} />, title: 'Suivez vos licences et quotas' },
    { icon: <Receipt size={18} />, title: 'Consultez vos factures et échéances' },
  ];
  return (
    <section className="auth-pitch" aria-labelledby="pitch-title">
      <span className="auth-pitch-mark" aria-hidden><CoreLogo size={300} /></span>
      <a href="#/connexion" className="auth-pitch-logo"><CoreLogo size={34} /><span>Core tenant</span></a>
      <div className="auth-pitch-body">
        <p className="auth-eyebrow">Plateforme multi-sociétés</p>
        <h2 id="pitch-title">Pilotez tout votre groupe <span>depuis un seul espace.</span></h2>
        <p className="auth-lead">Sociétés, applications, licences et facturation : l’essentiel de votre tenant réuni au même endroit.</p>
        <ul className="auth-features">
          {features.map((f) => (
            <li key={f.title}>
              <span className="auth-feature-icon" aria-hidden>{f.icon}</span>
              <span className="auth-feature-title">{f.title}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="auth-pitch-foot">© 2026 {tenant}</p>
    </section>
  );
}

// ---------- Champs ----------

function AuthField({ label, error, hint, children, aside }: {
  label: string; error?: string; hint?: ReactNode; aside?: ReactNode; children: (id: string, describedBy?: string) => ReactNode;
}) {
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div className={`auth-field ${error ? 'invalid' : ''}`}>
      <div className="auth-field-top"><label htmlFor={id}>{label}</label>{aside}</div>
      <div className="auth-input">{children(id, error || hint ? msgId : undefined)}</div>
      {error ? <p className="auth-error" id={msgId}>{error}</p> : hint ? <div className="auth-hint" id={msgId}>{hint}</div> : null}
    </div>
  );
}

function PasswordInput({ id, value, onChange, describedBy, autoComplete, placeholder }: {
  id: string; value: string; onChange: (v: string) => void; describedBy?: string; autoComplete: string; placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  return (
    <>
      <input id={id} type={visible ? 'text' : 'password'} value={value} autoComplete={autoComplete} placeholder={placeholder}
        aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)}
        onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))} onBlur={() => setCaps(false)} />
      {caps && <span className="caps-hint" role="status">Verr. Maj</span>}
      <button type="button" className="auth-eye" aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={visible} onClick={() => setVisible((v) => !v)}>
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button type="submit" className="auth-submit" disabled={loading}>
      {loading ? <><Loader2 size={16} className="spin" aria-hidden /> Veuillez patienter…</> : <>{children} <ArrowRight size={16} aria-hidden /></>}
    </button>
  );
}

// ---------- Connexion ----------

function LoginForm({ onDone }: { onDone: () => void }) {
  const { db, login } = useStore();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const owner = db.users.find((u) => u.id === db.tenant.ownerUserId);

  const errors = {
    identifier: identifier.trim() ? '' : 'Saisissez votre identifiant ou votre e-mail.',
    password: password ? '' : 'Saisissez votre mot de passe.',
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true); setError('');
    if (errors.identifier || errors.password) return;
    setLoading(true);
    window.setTimeout(() => {
      const user = login(identifier, remember);
      setLoading(false);
      if (!user) { setError('Identifiant ou mot de passe incorrect.'); return; }
      onDone();
    }, 700);
  };

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <div className="auth-heading">
        <h1>Bon retour</h1>
        <p>Connectez-vous à l’espace d’administration de <strong>{db.tenant.name}</strong>.</p>
      </div>
      {error && <div className="auth-alert" role="alert"><Lock size={15} aria-hidden /> {error}</div>}
      <AuthField label="Identifiant ou e-mail" error={submitted ? errors.identifier : undefined}>
        {(id, d) => <input id={id} value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" aria-describedby={d} placeholder="prenom.nom@societe.com" autoFocus />}
      </AuthField>
      <AuthField label="Mot de passe" error={submitted ? errors.password : undefined}
        aside={<a href="#/mot-de-passe-oublie" className="auth-link small">Oublié ?</a>}>
        {(id, d) => <PasswordInput id={id} value={password} onChange={setPassword} describedBy={d} autoComplete="current-password" placeholder="Votre mot de passe" />}
      </AuthField>
      <label className="auth-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> <span>Rester connecté sur cet appareil</span></label>
      <SubmitButton loading={loading}>Se connecter</SubmitButton>
      {owner && (
        <button type="button" className="auth-demo" onClick={() => setIdentifier(owner.login)}>
          <span className="auth-demo-badge">Démo</span>
          <span>Remplir avec <strong>{owner.login}</strong> · tout mot de passe</span>
        </button>
      )}
    </form>
  );
}

// ---------- Inscription (2 étapes) ----------

const RULES = [
  { id: 'len', label: '8 caractères minimum', test: (v: string) => v.length >= 8 },
  { id: 'up', label: 'Une majuscule', test: (v: string) => /[A-Z]/.test(v) },
  { id: 'num', label: 'Un chiffre', test: (v: string) => /\d/.test(v) },
  { id: 'sym', label: 'Un caractère spécial', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];
const STRENGTH = ['Très faible', 'Faible', 'Moyen', 'Bon', 'Excellent'];

function RegisterForm() {
  const { db } = useStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [f, setF] = useState({ organisation: '', firstName: '', lastName: '', username: '', email: '', password: '', confirm: '' });
  const [terms, setTerms] = useState(false);
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const usernameTouched = useRef(false);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  // Propose un nom d'utilisateur à partir du prénom et du nom.
  useEffect(() => {
    if (usernameTouched.current || !f.firstName || !f.lastName) return;
    set('username', `${f.firstName[0]}.${f.lastName}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9.]/g, ''));
  }, [f.firstName, f.lastName]);

  const passed = RULES.filter((r) => r.test(f.password)).length;
  const errors = useMemo(() => ({
    organisation: f.organisation.trim() ? '' : 'Nom de l’organisation requis.',
    firstName: f.firstName.trim() ? '' : 'Prénom requis.',
    lastName: f.lastName.trim() ? '' : 'Nom requis.',
    username: !/^[a-z0-9.]{3,}$/.test(f.username) ? '3 caractères minimum : lettres minuscules, chiffres ou points.'
      : db.users.some((u) => u.login === f.username) ? 'Ce nom d’utilisateur est déjà pris.' : '',
    email: !/^\S+@\S+\.\S+$/.test(f.email) ? 'Adresse e-mail invalide.' : '',
    password: passed < RULES.length ? 'Le mot de passe ne respecte pas toutes les règles.' : '',
    confirm: f.confirm !== f.password || !f.confirm ? 'Les mots de passe ne correspondent pas.' : '',
    terms: terms ? '' : 'Vous devez accepter les conditions d’utilisation.',
  }), [f, terms, passed, db.users]);
  const stepFields: Record<1 | 2, (keyof typeof errors)[]> = {
    1: ['organisation', 'firstName', 'lastName'],
    2: ['username', 'email', 'password', 'confirm', 'terms'],
  };
  const err = (k: keyof typeof errors) => (submitted[stepFields[1].includes(k) ? 1 : 2] ? errors[k] || undefined : undefined);
  const stepValid = (s: 1 | 2) => stepFields[s].every((k) => !errors[k]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted((x) => ({ ...x, [step]: true }));
    if (!stepValid(step)) return;
    if (step === 1) { setStep(2); return; }
    setLoading(true);
    window.setTimeout(() => { setLoading(false); setDone(true); }, 900);
  };

  if (done) {
    return (
      <div className="auth-success">
        <span className="auth-success-icon" aria-hidden><Mail size={22} /></span>
        <h2>Vérifiez votre boîte e-mail</h2>
        <p>Un lien d’activation a été envoyé à <strong>{f.email}</strong> pour ouvrir l’espace <strong>{f.organisation}</strong>.</p>
        <ul className="auth-steps">
          <li className="ok"><CheckCircle2 size={16} aria-hidden /> Compte créé pour {f.firstName} {f.lastName}</li>
          <li className="ok"><CheckCircle2 size={16} aria-hidden /> Identifiant : <span className="mono">{f.username}</span></li>
          <li><span className="auth-step-dot" aria-hidden /> Activation par e-mail (simulée)</li>
        </ul>
        <button type="button" className="auth-submit" onClick={() => navigate('connexion')}>Aller à la connexion <ArrowRight size={16} aria-hidden /></button>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={submit} noValidate>
      <div className="auth-heading">
        <h1>Créer votre espace</h1>
        <p>Deux minutes pour ouvrir votre tenant. Vous en serez l’administrateur.</p>
      </div>
      <ol className="auth-stepper" aria-label="Étapes de l’inscription">
        {(['Organisation', 'Compte'] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2;
          const state = step === n ? 'current' : step > n ? 'done' : 'todo';
          return (
            <li key={label} className={state} aria-current={step === n ? 'step' : undefined}>
              <span className="auth-step-num">{state === 'done' ? <Check size={12} aria-hidden /> : n}</span>{label}
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <div className="auth-step-panel" key="s1">
          <AuthField label="Nom de l’organisation" error={err('organisation')} hint="Le nom de votre groupe ou de votre société principale.">
            {(id, d) => <input id={id} value={f.organisation} onChange={(e) => set('organisation', e.target.value)} aria-describedby={d} placeholder="Ex. : Groupe Atlas" autoComplete="organization" autoFocus />}
          </AuthField>
          <div className="auth-row">
            <AuthField label="Prénom" error={err('firstName')}>
              {(id, d) => <input id={id} value={f.firstName} onChange={(e) => set('firstName', e.target.value)} aria-describedby={d} autoComplete="given-name" />}
            </AuthField>
            <AuthField label="Nom" error={err('lastName')}>
              {(id, d) => <input id={id} value={f.lastName} onChange={(e) => set('lastName', e.target.value)} aria-describedby={d} autoComplete="family-name" />}
            </AuthField>
          </div>
          <SubmitButton loading={false}>Continuer</SubmitButton>
        </div>
      ) : (
        <div className="auth-step-panel" key="s2">
          <AuthField label="Nom d’utilisateur" error={err('username')} hint="Proposé à partir de votre nom, modifiable.">
            {(id, d) => <input id={id} value={f.username} onChange={(e) => { usernameTouched.current = true; set('username', e.target.value.toLowerCase()); }} aria-describedby={d} autoComplete="username" autoFocus />}
          </AuthField>
          <AuthField label="E-mail professionnel" error={err('email')}>
            {(id, d) => <input id={id} type="email" value={f.email} onChange={(e) => set('email', e.target.value)} aria-describedby={d} autoComplete="email" placeholder="prenom.nom@societe.com" />}
          </AuthField>
          <AuthField label="Mot de passe" error={err('password')}
            hint={(
              <div className="pw-meter">
                <div className={`pw-bars s${passed}`} aria-hidden>{RULES.map((r) => <span key={r.id} />)}</div>
                <span className="pw-label">{f.password ? STRENGTH[passed] : 'Robustesse'}</span>
                <ul className="pw-rules">
                  {RULES.map((r) => {
                    const ok = r.test(f.password);
                    return <li key={r.id} className={ok ? 'ok' : ''}>{ok ? <Check size={12} aria-hidden /> : <span className="pw-dot" aria-hidden />}{r.label}<span className="sr-only">{ok ? ' : respecté' : ' : non respecté'}</span></li>;
                  })}
                </ul>
              </div>
            )}>
            {(id, d) => <PasswordInput id={id} value={f.password} onChange={(v) => set('password', v)} describedBy={d} autoComplete="new-password" />}
          </AuthField>
          <AuthField label="Confirmation du mot de passe" error={err('confirm')}>
            {(id, d) => <PasswordInput id={id} value={f.confirm} onChange={(v) => set('confirm', v)} describedBy={d} autoComplete="new-password" />}
          </AuthField>
          <label className={`auth-check ${err('terms') ? 'invalid' : ''}`}>
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
            <span>J’accepte les conditions d’utilisation et la politique de confidentialité.</span>
          </label>
          {err('terms') && <p className="auth-error">{err('terms')}</p>}
          <div className="auth-actions">
            <button type="button" className="auth-secondary" onClick={() => setStep(1)}><ArrowLeft size={15} aria-hidden /> Retour</button>
            <SubmitButton loading={loading}>Créer mon espace</SubmitButton>
          </div>
        </div>
      )}
    </form>
  );
}

// ---------- Mot de passe oublié ----------

function ForgotForm() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sent, setSent] = useState(false);
  const error = /^\S+@\S+\.\S+$/.test(email) ? '' : 'Adresse e-mail invalide.';
  if (sent) {
    return (
      <div className="auth-success">
        <span className="auth-success-icon" aria-hidden><Mail size={22} /></span>
        <h2>E-mail envoyé</h2>
        <p>Si un compte existe pour <strong>{email}</strong>, vous recevrez un lien de réinitialisation valable 30 minutes.</p>
        <button type="button" className="auth-submit" onClick={() => navigate('connexion')}>Retour à la connexion <ArrowRight size={16} aria-hidden /></button>
      </div>
    );
  }
  return (
    <form className="auth-form" onSubmit={(e) => { e.preventDefault(); setSubmitted(true); if (!error) setSent(true); }} noValidate>
      <div className="auth-heading">
        <h1>Mot de passe oublié</h1>
        <p>Indiquez votre e-mail : nous vous enverrons un lien pour en définir un nouveau.</p>
      </div>
      <AuthField label="E-mail" error={submitted ? error || undefined : undefined}>
        {(id, d) => <input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={d} autoComplete="email" autoFocus />}
      </AuthField>
      <SubmitButton loading={false}>Envoyer le lien</SubmitButton>
      <button type="button" className="auth-back" onClick={() => navigate('connexion')}><ArrowLeft size={15} aria-hidden /> Retour à la connexion</button>
    </form>
  );
}
