// Carte de section des formulaires longs : pictogramme, titre, sous-titre, actions à droite.
import type { ReactNode } from 'react';

export function FormCard({ icon, title, subtitle, actions, children, className = '' }: {
  icon: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`fcard ${className}`}>
      <header className="fcard-head">
        <span className="fcard-icon" aria-hidden>{icon}</span>
        <div className="fcard-text">
          <h3 className="fcard-title">{title}</h3>
          {subtitle && <p className="fcard-sub">{subtitle}</p>}
        </div>
        {actions && <div className="fcard-actions">{actions}</div>}
      </header>
      <div className="fcard-body">{children}</div>
    </section>
  );
}
