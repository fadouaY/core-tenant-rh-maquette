// Logos de la maquette (SVG inline, sans dépendance).
// Couleurs pilotables en CSS : --logo-bg (tuile) et --logo-fg (motif). Par défaut : tuile blanche, motif en dégradé bleu.
import { useId } from 'react';

function Gradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3b82f6" />
        <stop offset="1" stopColor="#0b3a7e" />
      </linearGradient>
    </defs>
  );
}

/**
 * Logo du core tenant : quatre petites sociétés reliées à un espace central.
 * Les sociétés (carrés des coins) convergent vers le noyau commun.
 */
export function CoreLogo({ size = 32 }: { size?: number }) {
  const g = useId();
  const fg = `var(--logo-fg, url(#${g}))`;
  const sats = [[4.5, 4.5], [21.5, 4.5], [4.5, 21.5], [21.5, 21.5]];
  // Liens : du coin intérieur de chaque société vers l'angle correspondant du noyau.
  const links = [[10.5, 10.5, 12.2, 12.2], [21.5, 10.5, 19.8, 12.2], [10.5, 21.5, 12.2, 19.8], [21.5, 21.5, 19.8, 19.8]];
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo">
      <Gradient id={g} />
      <rect width="32" height="32" rx="9" style={{ fill: 'var(--logo-bg, #fff)' }} />
      {links.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1.8" strokeLinecap="round" style={{ stroke: fg, opacity: 0.72 }} />
      ))}
      {sats.map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="6" height="6" rx="1.7" style={{ fill: fg, opacity: 0.72 }} />
      ))}
      <rect x="11.5" y="11.5" width="9" height="9" rx="2.6" style={{ fill: fg }} />
    </svg>
  );
}

/** Logo de l'Application RH : même tuile, monogramme « RH ». */
export function RhLogo({ size = 32 }: { size?: number }) {
  const g = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo">
      <Gradient id={g} />
      <rect width="32" height="32" rx="9" style={{ fill: 'var(--logo-bg, #fff)' }} />
      <text x="16" y="21" textAnchor="middle" fontFamily="Segoe UI, system-ui, sans-serif" fontWeight="800" fontSize="13" letterSpacing="-.3"
        style={{ fill: `var(--logo-fg, url(#${g}))` }}>RH</text>
    </svg>
  );
}
