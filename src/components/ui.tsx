// Composants d'interface réutilisables.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Archive, Ban, CheckCircle2, Info, Inbox, Maximize2, Minimize2, X, XCircle } from 'lucide-react';
import type { EmployeeStatus, EventEffect, LeaveStatus, LeaveType, Person, StepStatus } from '../types';
import { useStore } from '../store';

// ---------- Badges ----------

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted' | 'primary';

export function Badge({ tone = 'neutral', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{icon}{children}</span>;
}

const LEAVE_STATUS: Record<LeaveStatus, [string, Tone]> = {
  en_attente: ['En attente', 'warning'],
  approuve: ['Approuvée', 'success'],
  refuse: ['Refusée', 'danger'],
  annule: ['Annulée', 'muted'],
};
export const leaveStatusLabel = (s: LeaveStatus) => LEAVE_STATUS[s][0];
export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  const [label, tone] = LEAVE_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const STEP_STATUS: Record<StepStatus, [string, Tone]> = {
  en_attente: ['En attente de décision', 'warning'],
  approuve: ['Approuvé', 'success'],
  refuse: ['Refusé', 'danger'],
  a_venir: ['À venir', 'neutral'],
  ignore: ['Sans objet', 'muted'],
};
export function StepStatusBadge({ status }: { status: StepStatus }) {
  const [label, tone] = STEP_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

const EMP_STATUS: Record<EmployeeStatus, [string, Tone]> = {
  actif: ['Actif', 'success'],
  essai: ["Période d'essai", 'info'],
  inactif: ['Inactif', 'muted'],
};
export const employeeStatusOptions = Object.entries(EMP_STATUS).map(([value, [label]]) => ({ value, label }));
export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const [label, tone] = EMP_STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export const EFFECTS: Record<EventEffect, { label: string; tone: Tone; icon: ReactNode; help: string }> = {
  info: { label: 'Informatif', tone: 'info', icon: <Info size={13} aria-hidden />, help: 'Affiché dans le calendrier, sans impact sur les demandes.' },
  warning: { label: 'Avertissement', tone: 'warning', icon: <AlertTriangle size={13} aria-hidden />, help: 'La demande reste possible mais un avertissement est affiché.' },
  block: { label: 'Bloquant', tone: 'danger', icon: <Ban size={13} aria-hidden />, help: 'Les demandes de congé chevauchant ces dates sont bloquées.' },
};
export function EffectBadge({ effect }: { effect: EventEffect }) {
  const e = EFFECTS[effect];
  return <Badge tone={e.tone} icon={e.icon}>{e.label}</Badge>;
}

export function ArchivedBadge() {
  return <Badge tone="muted" icon={<Archive size={12} aria-hidden />}>Archivé</Badge>;
}

export function LeaveTypeTag({ type }: { type?: LeaveType }) {
  if (!type) return <span className="text-muted">—</span>;
  return (
    <span className="type-tag">
      <span className="type-dot" style={{ background: type.color }} aria-hidden />
      {type.name}
      {type.archived && <ArchivedBadge />}
    </span>
  );
}

// ---------- Personnes ----------

const AVATAR_COLORS = ['#2f5bd3', '#0f8a7a', '#8a4fd1', '#c2410c', '#0e7490', '#b45309', '#be185d', '#4d7c0f'];

export function Avatar({ employee, size = 28 }: { employee?: Person; size?: number }) {
  if (!employee) return <span className="avatar" style={{ width: size, height: size }} aria-hidden>?</span>;
  const initials = `${employee.firstName[0]}${employee.lastName[0]}`;
  const color = AVATAR_COLORS[[...employee.id].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }} aria-hidden>
      {initials}
    </span>
  );
}

export function PersonCell({ employee, sub, link }: { employee?: Person; sub?: ReactNode; link?: boolean }) {
  if (!employee) return <span className="text-muted">—</span>;
  return (
    <span className="person">
      <Avatar employee={employee} />
      <span>
        <span className={link ? 'person-name person-link' : 'person-name'}>{employee.firstName} {employee.lastName}</span>
        {sub && <span className="person-sub">{sub}</span>}
      </span>
    </span>
  );
}

// ---------- Mise en page ----------

/** En-tête de page : ligne de contexte, icône de section, titre, description, actions et barre d'outils. */
export function PageHeader({ title, subtitle, actions, toolbar, before, eyebrow, icon }: {
  title: string; subtitle?: ReactNode; actions?: ReactNode; toolbar?: ReactNode; before?: ReactNode; eyebrow?: string; icon?: ReactNode;
}) {
  return (
    <header className="page-header">
      {before}
      <div className="page-header-top">
        <div className="ph-main">
          {icon && <span className="ph-icon" aria-hidden>{icon}</span>}
          <div className="ph-text">
            {eyebrow && <p className="ph-eyebrow">{eyebrow}</p>}
            <h1>{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {toolbar && <div className="page-toolbar">{toolbar}</div>}
    </header>
  );
}

export function Card({ title, actions, children, className = '', flush }: {
  title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-header">
          {title && <h2 className="card-title">{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </div>
      )}
      <div className={flush ? 'card-body-flush' : 'card-body'}>{children}</div>
    </section>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <Inbox size={28} aria-hidden />}</div>
      <p className="empty-title">{title}</p>
      {text && <p className="empty-text">{text}</p>}
      {action}
    </div>
  );
}

export function Alert({ tone, title, children }: { tone: 'info' | 'warning' | 'danger' | 'success'; title?: string; children?: ReactNode }) {
  const icon = { info: <Info size={18} />, warning: <AlertTriangle size={18} />, danger: <XCircle size={18} />, success: <CheckCircle2 size={18} /> }[tone];
  return (
    <div className={`alert alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="alert-icon" aria-hidden>{icon}</span>
      <div>
        {title && <p className="alert-title">{title}</p>}
        {children && <div className="alert-body">{children}</div>}
      </div>
    </div>
  );
}

// ---------- Onglets ----------

export function Tabs<T extends string>({ tabs, value, onChange, label }: {
  tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (id: T) => void; label: string;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          className={`tab ${value === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.count != null && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Formulaires ----------

export function Field({ label, children, hint, error, required, className = '' }: {
  label: string; children: (id: string) => ReactNode; hint?: ReactNode; error?: string; required?: boolean; className?: string;
}) {
  const id = useId();
  return (
    <div className={`field ${error ? 'has-error' : ''} ${className}`}>
      <label htmlFor={id}>{label}{required && <span className="req" aria-hidden> *</span>}</label>
      {children(id)}
      {error ? <p className="field-error">{error}</p> : hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function SelectFilter({ label, value, onChange, options, allLabel = 'Tous' }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; allLabel?: string;
}) {
  const id = useId();
  return (
    <div className="filter">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={`switch ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch-track" aria-hidden><span className="switch-thumb" /></span>
      <span>{label}</span>
    </label>
  );
}

// ---------- Superpositions (modale / panneau latéral) ----------

let openOverlays = 0;

function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      // Seule la superposition la plus haute réagit à Échap.
      const overlays = document.querySelectorAll('.overlay');
      if (e.key === 'Escape' && overlays[overlays.length - 1]?.contains(ref.current)) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    openOverlays++;
    document.body.style.overflow = 'hidden';
    // Focus sur la boîte de dialogue elle-même : annoncée par les lecteurs d'écran, sans faire défiler le contenu.
    window.setTimeout(() => ref.current?.focus({ preventScroll: true }), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      openOverlays--;
      if (openOverlays === 0) document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open]);
  return ref;
}

/** Fenêtre centrée commune aux modales et aux formulaires, avec passage en plein écran. */
function Dialog({ open, onClose, title, subtitle, children, footer, width }: {
  open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode;
  width: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const ref = useOverlay(open, onClose);
  const titleId = useId();
  const [full, setFull] = useState(false);
  useEffect(() => { if (!open) setFull(false); }, [open]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dialog dialog-${width} ${full ? 'fullscreen' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="overlay-header">
          <div className="grow">
            <h2 id={titleId}>{title}</h2>
            {subtitle && <div className="overlay-subtitle">{subtitle}</div>}
          </div>
          <div className="overlay-tools">
            <button type="button" className="icon-btn overlay-close" onClick={() => setFull((v) => !v)}
              aria-label={full ? 'Réduire la fenêtre' : 'Ouvrir en plein écran'} title={full ? 'Réduire' : 'Plein écran'} aria-pressed={full}>
              {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button type="button" className="icon-btn overlay-close" onClick={onClose} aria-label="Fermer" title="Fermer"><X size={18} /></button>
          </div>
        </div>
        <div className="overlay-body">{children}</div>
        {footer && <div className="overlay-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg';
}) {
  return <Dialog open={open} onClose={onClose} title={title} footer={footer} width={size}>{children}</Dialog>;
}

/** Formulaires de création / détail : désormais affichés en fenêtre centrée (plus large si « wide »). */
export function Drawer({ open, onClose, title, subtitle, children, footer, wide }: {
  open: boolean; onClose: () => void; title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  return <Dialog open={open} onClose={onClose} title={title} subtitle={subtitle} footer={footer} width={wide ? 'xl' : 'lg'}>{children}</Dialog>;
}

// ---------- Notifications éphémères ----------

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.tone}`}>
          {t.tone === 'success' ? <CheckCircle2 size={18} aria-hidden /> : t.tone === 'danger' ? <XCircle size={18} aria-hidden /> : <Info size={18} aria-hidden />}
          <span>{t.message}</span>
          <button type="button" className="icon-btn" onClick={() => dismissToast(t.id)} aria-label="Fermer la notification"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

// ---------- Sélecteur de couleur compact ----------

const COLOR_PRESETS = ['#2f5bd3', '#0b5cc0', '#0f8a7a', '#1e7d45', '#b45309', '#c2410c', '#c4362f', '#be185d', '#8a4fd1', '#6b7280'];

/** Petite pastille de couleur + code hexadécimal + couleurs prédéfinies (remplace le grand champ natif). */
export function ColorField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="color-field">
      <span className="color-swatch" style={{ background: value }} title="Choisir une couleur personnalisée">
        <input id={id} type="color" className="color-native" value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
      <span className="color-hex">{value.toUpperCase()}</span>
      <span className="color-presets" role="group" aria-label="Couleurs prédéfinies">
        {COLOR_PRESETS.map((c) => (
          <button key={c} type="button" className={`color-preset ${c.toLowerCase() === value.toLowerCase() ? 'active' : ''}`} style={{ background: c }}
            aria-label={`Couleur ${c}`} aria-pressed={c.toLowerCase() === value.toLowerCase()} onClick={() => onChange(c)} />
        ))}
      </span>
    </div>
  );
}
