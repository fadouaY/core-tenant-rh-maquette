// Parcours chronologique en étapes reliées (contrats, salaires, statuts) : de gauche à droite, du plus ancien au plus récent.
import type { ReactNode } from 'react';

export type WorkflowState = 'past' | 'current' | 'next' | 'stopped';

export interface WorkflowStep {
  id: string;
  state: WorkflowState;
  content: ReactNode;
}

export function Workflow({ steps, label }: { steps: WorkflowStep[]; label: string }) {
  return (
    <ol className="wf" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s.id} className={`wf-step ${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
          <span className="wf-rail" aria-hidden>
            <span className="wf-node">{i + 1}</span>
          </span>
          <div className="wf-card">{s.content}</div>
        </li>
      ))}
    </ol>
  );
}
