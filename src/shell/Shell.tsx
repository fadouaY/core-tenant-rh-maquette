// Shell commun : barre supérieure, navigation principale (rail) et sous-navigation de section.
// Deux modes : « core » (console du tenant) et « rh » (Application RH).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AppWindow, Bell, Building2, CalendarCheck, CalendarDays, CalendarRange, Check, ChevronDown, ClipboardList, Grip, LayoutGrid, Menu,
  LogOut, Scale, Search, Settings, UserRound, Users, X, type LucideIcon,
} from 'lucide-react';
import { navigate, useStore } from '../store';
import { Avatar } from '../components/ui';
import { CoreLogo, RhLogo } from '../components/Logo';
import { formatDateTime, formatRange } from '../utils/dates';
import { SETTINGS_SECTIONS } from '../pages/settings/SettingsPage';
import { CompanyLogo, QuotaMeter, quotaUsage } from '../core/shared';

export type ShellMode = 'core' | 'rh';
interface NavItem { id: string; label: string; icon: LucideIcon; short?: string; group?: string }

const RAIL: Record<ShellMode, NavItem[]> = {
  core: [
    { id: 'applications', label: 'Applications', icon: AppWindow },
    { id: 'societes', label: 'Sociétés', icon: Building2 },
    { id: 'utilisateurs', label: 'Utilisateurs', icon: Users },
  ],
  rh: [
    { id: 'tableau-de-bord', label: 'Tableau de bord', short: 'Accueil', icon: LayoutGrid },
    { id: 'employes', label: 'Employés', icon: Users },
    { id: 'conges', label: 'Congés', icon: CalendarCheck },
    { id: 'calendrier', label: 'Calendrier', icon: CalendarDays },
    { id: 'evenements', label: 'Événements', icon: CalendarRange },
    { id: 'parametres', label: 'Paramètres', icon: Settings },
  ],
};

/** Sous-navigation des sections RH qui en ont une. */
const SUBNAV: Record<string, { title: string; items: NavItem[] }> = {
  conges: {
    title: 'Congés',
    items: [
      { id: 'demandes', label: 'Demandes', icon: ClipboardList },
      { id: 'soldes', label: 'Soldes', icon: Scale },
    ],
  },
  parametres: { title: 'Paramètres', items: SETTINGS_SECTIONS.map(({ id, label, icon, group }) => ({ id, label, icon, group })) },
};

const prefix = (mode: ShellMode) => (mode === 'core' ? 'core/' : '');

export function Shell({ mode, app, section, children }: { mode: ShellMode; app: string; section: string; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { db, companyId, currentUser } = useStore();
  const sub = mode === 'rh' ? SUBNAV[app] : undefined;
  const toProcess = mode === 'rh'
    ? db.requests.filter((r) => r.companyId === companyId && r.steps.some((s) => s.status === 'en_attente' && s.approverId === currentUser.id)).length
    : 0;
  const counts: Record<string, number> = { demandes: toProcess, conges: toProcess };

  useEffect(() => setMobileOpen(false), [app, section]);

  return (
    <div className={`shell shell-${mode}`}>
      <a href="#main" className="skip-link">Aller au contenu</a>
      <Topbar mode={mode} onMenu={() => setMobileOpen(true)} />
      <div className="shell-body">
        <div className={`nav-wrap ${mobileOpen ? 'open' : ''}`}>
          <nav className="rail" aria-label="Navigation principale">
            {RAIL[mode].map(({ id, label, short, icon: I }) => (
              <a key={id} href={`#/${prefix(mode)}${id}`} className={`rail-item ${app === id ? 'active' : ''}`} aria-current={app === id ? 'page' : undefined}
                title={label} aria-label={counts[id] > 0 ? `${label} (${counts[id]} à traiter)` : label}>
                <span className="rail-icon">
                  <I size={19} aria-hidden strokeWidth={1.8} />
                  {counts[id] > 0 && <span className="rail-count" aria-hidden>{counts[id]}</span>}
                </span>
                <span className="rail-label" aria-hidden>{short ?? label}</span>
              </a>
            ))}
          </nav>
          <button type="button" className="icon-btn nav-close" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu"><X size={18} /></button>
        </div>
        {mobileOpen && <div className="nav-backdrop" onClick={() => setMobileOpen(false)} aria-hidden />}
        <main id="main" className={`content ${sub ? 'has-tabs' : ''}`} tabIndex={-1}>
          {sub && <SectionTabs app={app} section={section} sub={sub} counts={counts} />}
          {children}
        </main>
      </div>
    </div>
  );
}

/** Sous-navigation horizontale : une ligne d'onglets en tête de la carte de contenu. */
function SectionTabs({ app, section, sub, counts }: {
  app: string; section: string; sub: { title: string; items: NavItem[] }; counts: Record<string, number>;
}) {
  const ref = useRef<HTMLElement>(null);
  // Garde l'onglet actif visible quand la barre défile horizontalement.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [section]);
  return (
    <nav ref={ref} className="section-tabs" aria-label={`Navigation ${sub.title}`}>
      <div className="stabs-row">
        {sub.items.map(({ id, label, icon: I }) => (
          <a key={id} href={`#/${app}/${id}`} className={`stab ${section === id ? 'active' : ''}`} aria-current={section === id ? 'page' : undefined}>
            <I size={15} aria-hidden strokeWidth={1.9} />
            <span>{label}</span>
            {counts[id] > 0 && <span className="stab-count" aria-label={`${counts[id]} à traiter`}>{counts[id]}</span>}
          </a>
        ))}
      </div>
    </nav>
  );
}

function useClickOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) closeRef.current(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return ref;
}

function Topbar({ mode, onMenu }: { mode: ShellMode; onMenu: () => void }) {
  const { db, companyId, setCompanyId, currentUser, tenantUser, companiesFor, markNotificationsRead, logout } = useStore();
  const [panel, setPanel] = useState<'' | 'company' | 'notif' | 'profile' | 'search' | 'quota'>('');
  const [query, setQuery] = useState('');
  const close = () => setPanel('');
  const companyRef = useClickOutside(panel === 'company', close);
  const notifRef = useClickOutside(panel === 'notif', close);
  const profileRef = useClickOutside(panel === 'profile', close);
  const searchRef = useClickOutside(panel === 'search', close);
  const quotaRef = useClickOutside(panel === 'quota', close);
  const company = db.companies.find((c) => c.id === companyId)!;
  const rhCompanies = companiesFor('rh');
  const notifications = db.notifications.filter((n) => n.companyId === companyId);
  const unread = notifications.filter((n) => !n.read).length;
  const me = mode === 'core' ? tenantUser : currentUser;
  const quota = quotaUsage(db);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    if (mode === 'core') {
      return {
        companies: db.companies.filter((c) => `${c.name} ${c.legalName} ${c.city}`.toLowerCase().includes(q)).slice(0, 6),
        apps: db.apps.filter((a) => `${a.name} ${a.description}`.toLowerCase().includes(q)),
        emps: [], reqs: [],
      };
    }
    const emps = db.employees.filter((e) => e.companyId === companyId && `${e.firstName} ${e.lastName} ${e.matricule}`.toLowerCase().includes(q)).slice(0, 5);
    const reqs = db.requests.filter((r) => {
      const p = db.employees.find((d) => d.id === r.employeeId);
      return r.companyId === companyId && `${p?.firstName} ${p?.lastName}`.toLowerCase().includes(q);
    }).slice(0, 4);
    return { emps, reqs, companies: [], apps: [] };
  }, [query, db, companyId, mode]);
  const total = results ? results.emps.length + results.reqs.length + results.companies.length + results.apps.length : 0;

  const go = (to: string) => { navigate(to); setQuery(''); close(); };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button type="button" className="icon-btn menu-btn" onClick={onMenu} aria-label="Ouvrir le menu"><Menu size={20} /></button>
        {mode === 'rh' && (
          <a href="#/core/applications" className="icon-btn launcher" title="Core tenant — applications" aria-label="Retour au core tenant (applications)"><Grip size={18} /></a>
        )}
        {mode === 'core' ? (
          <a href="#/core/applications" className="brand">
            <CoreLogo />
            <span className="brand-text"><span className="brand-name">Core tenant</span><span className="brand-sub">{db.tenant.name}</span></span>
          </a>
        ) : (
          <a href="#/tableau-de-bord" className="brand"><RhLogo /><span className="brand-text"><span className="brand-name">Application RH</span><span className="brand-sub">{db.tenant.name}</span></span></a>
        )}
        {mode === 'rh' && (
          <div className="dropdown-wrap" ref={companyRef}>
            <button type="button" className="tenant-btn" aria-haspopup="menu" aria-expanded={panel === 'company'}
              aria-label={`Société active : ${company.name}. Changer de société`} onClick={() => setPanel(panel === 'company' ? '' : 'company')}>
              <CompanyLogo company={company} size={28} />
              <span className="tenant-name">{company.name}</span>
              <ChevronDown size={14} aria-hidden />
            </button>
            {panel === 'company' && (
              <div className="dropdown" role="menu">
                <p className="dropdown-title">Sociétés ayant l’Application RH</p>
                {rhCompanies.map((c) => (
                  <button key={c.id} role="menuitemradio" aria-checked={c.id === companyId} type="button" className="dropdown-item"
                    onClick={() => { setCompanyId(c.id); close(); navigate('tableau-de-bord'); }}>
                    <CompanyLogo company={c} size={22} />
                    <span className="grow"><span className="dropdown-strong">{c.name}</span><span className="dropdown-sub">{c.city}</span></span>
                    {c.id === companyId && <Check size={15} aria-hidden className="text-primary" />}
                  </button>
                ))}
                <button type="button" className="dropdown-item dropdown-footer" onClick={() => go('core/applications/rh')}>
                  <Settings size={14} aria-hidden /> Gérer l’accès dans le core tenant
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="search dropdown-wrap" ref={searchRef}>
        <Search size={16} className="search-icon" aria-hidden />
        <input type="search" placeholder={mode === 'core' ? 'Rechercher une société, une application' : 'Rechercher'} aria-label="Recherche globale" value={query}
          onChange={(e) => { setQuery(e.target.value); setPanel('search'); }} onFocus={() => setPanel('search')} />
        {panel === 'search' && results && (
          <div className="dropdown search-results">
            {total === 0 && <p className="dropdown-empty">Aucun résultat pour « {query} »</p>}
            {results.companies.length > 0 && <p className="dropdown-title">Sociétés</p>}
            {results.companies.map((c) => (
              <button key={c.id} type="button" className="dropdown-item" onClick={() => go(`core/societes/${c.id}`)}>
                <CompanyLogo company={c} size={22} />
                <span><span className="dropdown-strong">{c.name}</span><span className="dropdown-sub">{c.city} · {c.country}</span></span>
              </button>
            ))}
            {results.apps.length > 0 && <p className="dropdown-title">Applications</p>}
            {results.apps.map((a) => (
              <button key={a.id} type="button" className="dropdown-item" onClick={() => go(`core/applications/${a.id}`)}>
                <AppWindow size={15} aria-hidden /><span className="dropdown-strong">{a.name}</span>
              </button>
            ))}
            {results.emps.length > 0 && <p className="dropdown-title">Employés</p>}
            {results.emps.map((e) => (
              <button key={e.id} type="button" className="dropdown-item" onClick={() => go(`employes/${e.id}`)}>
                <Avatar employee={e} size={24} />
                <span><span className="dropdown-strong">{e.firstName} {e.lastName}</span><span className="dropdown-sub">{e.matricule}</span></span>
              </button>
            ))}
            {results.reqs.length > 0 && <p className="dropdown-title">Demandes de congé</p>}
            {results.reqs.map((r) => {
              const p = db.employees.find((d) => d.id === r.employeeId);
              return (
                <button key={r.id} type="button" className="dropdown-item" onClick={() => go(`conges/demandes/${r.id}`)}>
                  <CalendarCheck size={15} aria-hidden />
                  <span><span className="dropdown-strong">{p?.firstName} {p?.lastName}</span><span className="dropdown-sub">{formatRange(r.start, r.end)}</span></span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="topbar-right">
        {mode === 'core' && (
          <div className="dropdown-wrap" ref={quotaRef}>
            <button type="button" className="quota-btn" aria-haspopup="dialog" aria-expanded={panel === 'quota'} aria-label="Quotas de l’offre" onClick={() => setPanel(panel === 'quota' ? '' : 'quota')}>
              <QuotaMeter label="Sociétés" used={quota.companies} max={quota.maxCompanies} compact />
              <QuotaMeter label="Utilisateurs" used={quota.users} max={quota.maxUsers} compact />
            </button>
            {panel === 'quota' && <QuotaPanel />}
          </div>
        )}
        {mode === 'rh' && (
          <div className="dropdown-wrap" ref={notifRef}>
            <button type="button" className="icon-btn" aria-haspopup="dialog" aria-expanded={panel === 'notif'}
              aria-label={`Notifications${unread ? ` (${unread} non lues)` : ''}`} onClick={() => setPanel(panel === 'notif' ? '' : 'notif')}>
              <Bell size={19} strokeWidth={1.75} />
              {unread > 0 && <span className="notif-dot">{unread}</span>}
            </button>
            {panel === 'notif' && (
              <div className="dropdown dropdown-right notif-panel">
                <div className="dropdown-head">
                  <p className="dropdown-title">Notifications</p>
                  {unread > 0 && <button type="button" className="link-btn" onClick={markNotificationsRead}>Tout marquer comme lu</button>}
                </div>
                {notifications.length === 0 && <p className="dropdown-empty">Aucune notification</p>}
                {notifications.map((n) => (
                  <button key={n.id} type="button" className={`dropdown-item notif-item ${n.read ? '' : 'unread'}`} onClick={() => n.link && go(n.link)}>
                    <span className="notif-bullet" aria-hidden />
                    <span>
                      <span className="dropdown-strong">{n.title}</span>
                      <span className="dropdown-sub">{n.body}</span>
                      <span className="dropdown-time">{formatDateTime(n.at)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="dropdown-wrap" ref={profileRef}>
          <button type="button" className="profile-btn" aria-haspopup="menu" aria-expanded={panel === 'profile'}
            aria-label={`Profil de ${me.firstName} ${me.lastName}`} onClick={() => setPanel(panel === 'profile' ? '' : 'profile')}>
            <Avatar employee={me} size={30} />
          </button>
          {panel === 'profile' && (
            <div className="dropdown dropdown-right" role="menu">
              <div className="profile-card">
                <Avatar employee={me} size={36} />
                <span>
                  <span className="dropdown-strong">{me.firstName} {me.lastName}</span>
                  <span className="dropdown-sub">{me.email}</span>
                  <span className="dropdown-time">{mode === 'core' ? (db.tenant.ownerUserId === me.id ? `Propriétaire du tenant ${db.tenant.name}` : `Tenant ${db.tenant.name}`) : `Administrateur RH · ${company.name}`}</span>
                </span>
              </div>
              {mode === 'core' ? (
                <button role="menuitem" type="button" className="dropdown-item" onClick={() => go('tableau-de-bord')}><AppWindow size={15} aria-hidden /> Ouvrir l’Application RH</button>
              ) : (
                <>
                  <button role="menuitem" type="button" className="dropdown-item" onClick={() => go(`employes/${currentUser.id}`)}><UserRound size={15} aria-hidden /> Ma fiche</button>
                  <button role="menuitem" type="button" className="dropdown-item" onClick={() => go('calendrier/perso')}><CalendarDays size={15} aria-hidden /> Mon calendrier</button>
                  <button role="menuitem" type="button" className="dropdown-item" onClick={() => go('conges/demandes/nouvelle')}><CalendarCheck size={15} aria-hidden /> Demander un congé</button>
                  <button role="menuitem" type="button" className="dropdown-item" onClick={() => go('core/applications')}><Grip size={15} aria-hidden /> Core tenant</button>
                </>
              )}
              <button role="menuitem" type="button" className="dropdown-item dropdown-footer danger" onClick={() => { close(); logout(); navigate('connexion'); }}><LogOut size={15} aria-hidden /> Se déconnecter</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/** Détail de l'offre et simulation des quotas. */
function QuotaPanel() {
  const { db, setQuotas, toast } = useStore();
  const q = quotaUsage(db);
  const [mc, setMc] = useState(String(db.tenant.maxCompanies));
  const [mu, setMu] = useState(String(db.tenant.maxUsers));
  const invalid = !(Number(mc) >= 1) || !(Number(mu) >= 1);
  return (
    <div className="dropdown dropdown-right quota-panel" role="dialog" aria-label="Quotas de l’offre">
      <p className="dropdown-title">{db.tenant.plan}</p>
      <div className="quota-panel-body">
        <QuotaMeter label="Sociétés actives" used={q.companies} max={q.maxCompanies} />
        <QuotaMeter label="Utilisateurs actifs" used={q.users} max={q.maxUsers} />
        <p className="small text-muted">Les sociétés archivées et les comptes désactivés ne sont pas comptés.</p>
        <div className="quota-sim">
          <p className="label">Simuler l’offre</p>
          <div className="form-grid">
            <label className="field"><span className="field-label">Max. sociétés</span><input type="number" min={1} value={mc} onChange={(e) => setMc(e.target.value)} /></label>
            <label className="field"><span className="field-label">Max. utilisateurs</span><input type="number" min={1} value={mu} onChange={(e) => setMu(e.target.value)} /></label>
          </div>
          <button type="button" className="btn btn-sm btn-primary mt-8" disabled={invalid}
            onClick={() => { setQuotas(Number(mc), Number(mu)); toast(`Quotas simulés : ${mc} sociétés, ${mu} utilisateurs`, 'info'); }}>Appliquer</button>
        </div>
      </div>
    </div>
  );
}
